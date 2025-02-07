-- Create analytics functions
CREATE OR REPLACE FUNCTION get_engagement_metrics(
  time_range TEXT DEFAULT '24h',
  content_type TEXT DEFAULT NULL,
  user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  start_time TIMESTAMP;
  result JSONB;
BEGIN
  -- Calculate start time based on range
  start_time := CASE time_range
    WHEN '1h' THEN NOW() - INTERVAL '1 hour'
    WHEN '24h' THEN NOW() - INTERVAL '24 hours'
    WHEN '7d' THEN NOW() - INTERVAL '7 days'
    WHEN '30d' THEN NOW() - INTERVAL '30 days'
    ELSE NOW() - INTERVAL '24 hours'
  END;

  WITH metrics AS (
    SELECT
      COUNT(DISTINCT ae.id) as total_events,
      COUNT(DISTINCT ae.user_id) as unique_users,
      COUNT(DISTINCT ae.content_id) as content_count,
      COUNT(DISTINCT CASE WHEN ae.event_type = 'view' THEN ae.id END) as views,
      COUNT(DISTINCT CASE WHEN ae.event_type = 'like' THEN ae.id END) as likes,
      COUNT(DISTINCT CASE WHEN ae.event_type = 'comment' THEN ae.id END) as comments,
      COUNT(DISTINCT CASE WHEN ae.event_type = 'share' THEN ae.id END) as shares,
      COUNT(DISTINCT CASE WHEN ae.event_type = 'report' THEN ae.id END) as reports,
      COALESCE(AVG(CASE 
        WHEN ae.metadata->>'time_spent' IS NOT NULL 
        THEN (ae.metadata->>'time_spent')::FLOAT 
      END), 0) as avg_time_spent,
      COUNT(DISTINCT CASE 
        WHEN ae.created_at > NOW() - INTERVAL '1 hour' 
        THEN ae.id 
      END) as events_last_hour
    FROM analytics_events ae
    WHERE ae.created_at >= start_time
      AND (content_type IS NULL OR ae.metadata->>'content_type' = content_type)
      AND (user_id IS NULL OR ae.user_id = user_id)
  )
  SELECT jsonb_build_object(
    'total_events', total_events,
    'unique_users', unique_users,
    'content_count', content_count,
    'engagement', jsonb_build_object(
      'views', views,
      'likes', likes,
      'comments', comments,
      'shares', shares,
      'reports', reports,
      'avg_time_spent', avg_time_spent,
      'engagement_rate', CASE 
        WHEN views > 0 
        THEN ((likes + comments + shares)::FLOAT / views * 100)::NUMERIC(10,2)
        ELSE 0 
      END
    ),
    'activity', jsonb_build_object(
      'events_last_hour', events_last_hour,
      'trend', CASE 
        WHEN events_last_hour > (total_events::FLOAT / 24) THEN 'increasing'
        WHEN events_last_hour < (total_events::FLOAT / 24) THEN 'decreasing'
        ELSE 'stable'
      END
    )
  ) INTO result
  FROM metrics;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to track analytics events
CREATE OR REPLACE FUNCTION track_analytics_event(
  event_type TEXT,
  user_id UUID,
  content_id UUID,
  metadata JSONB DEFAULT '{}'
)
RETURNS void AS $$
BEGIN
  -- Insert event
  INSERT INTO analytics_events (
    event_type,
    user_id,
    content_id,
    metadata
  ) VALUES (
    event_type,
    user_id,
    content_id,
    metadata
  );

  -- Update user cohort data
  INSERT INTO user_cohorts (
    user_id,
    cohort_date,
    last_active_date
  ) VALUES (
    user_id,
    DATE_TRUNC('day', (
      SELECT created_at 
      FROM auth.users 
      WHERE id = user_id
    )),
    NOW()
  )
  ON CONFLICT (user_id, cohort_date) 
  DO UPDATE SET last_active_date = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to calculate engagement score
CREATE OR REPLACE FUNCTION calculate_engagement_score(
  likes INT,
  comments INT,
  shares INT,
  views INT,
  time_spent INT
)
RETURNS FLOAT AS $$
DECLARE
  like_weight FLOAT := 1.0;
  comment_weight FLOAT := 2.0;
  share_weight FLOAT := 3.0;
  view_weight FLOAT := 0.1;
  time_weight FLOAT := 0.05;
  total_weight FLOAT;
  engagement_score FLOAT;
BEGIN
  -- Calculate total engagement score
  engagement_score := (
    (likes * like_weight) +
    (comments * comment_weight) +
    (shares * share_weight) +
    (views * view_weight) +
    (time_spent * time_weight)
  );

  -- Normalize score to be between 0 and 1
  total_weight := (
    like_weight + 
    comment_weight + 
    share_weight + 
    view_weight +
    time_weight
  );

  RETURN LEAST(engagement_score / (total_weight * 100), 1.0);
END;
$$ LANGUAGE plpgsql;

-- Function to get retention metrics
CREATE OR REPLACE FUNCTION get_retention_metrics(
  time_range TEXT DEFAULT '30d'
)
RETURNS TABLE (
  cohort_date DATE,
  total_users INT,
  day_1 NUMERIC,
  day_7 NUMERIC,
  day_30 NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH cohorts AS (
    SELECT
      DATE_TRUNC('day', uc.cohort_date)::DATE as cohort_date,
      COUNT(DISTINCT uc.user_id) as total_users,
      COUNT(DISTINCT CASE 
        WHEN uc.last_active_date >= uc.cohort_date + INTERVAL '1 day'
        THEN uc.user_id 
      END)::NUMERIC / COUNT(DISTINCT uc.user_id) * 100 as day_1,
      COUNT(DISTINCT CASE 
        WHEN uc.last_active_date >= uc.cohort_date + INTERVAL '7 days'
        THEN uc.user_id 
      END)::NUMERIC / COUNT(DISTINCT uc.user_id) * 100 as day_7,
      COUNT(DISTINCT CASE 
        WHEN uc.last_active_date >= uc.cohort_date + INTERVAL '30 days'
        THEN uc.user_id 
      END)::NUMERIC / COUNT(DISTINCT uc.user_id) * 100 as day_30
    FROM user_cohorts uc
    WHERE uc.cohort_date >= NOW() - time_range::INTERVAL
    GROUP BY DATE_TRUNC('day', uc.cohort_date)
  )
  SELECT
    c.cohort_date,
    c.total_users,
    ROUND(c.day_1, 2) as day_1,
    ROUND(c.day_7, 2) as day_7,
    ROUND(c.day_30, 2) as day_30
  FROM cohorts c
  ORDER BY c.cohort_date DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get content performance metrics
CREATE OR REPLACE FUNCTION get_content_performance(
  content_type TEXT DEFAULT NULL,
  time_range TEXT DEFAULT '7d',
  limit_count INT DEFAULT 10
)
RETURNS TABLE (
  content_id UUID,
  total_engagement INT,
  views INT,
  likes INT,
  comments INT,
  shares INT,
  engagement_rate NUMERIC,
  trending_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH metrics AS (
    SELECT
      ae.content_id,
      COUNT(DISTINCT ae.id) as total_engagement,
      COUNT(DISTINCT CASE WHEN ae.event_type = 'view' THEN ae.id END) as views,
      COUNT(DISTINCT CASE WHEN ae.event_type = 'like' THEN ae.id END) as likes,
      COUNT(DISTINCT CASE WHEN ae.event_type = 'comment' THEN ae.id END) as comments,
      COUNT(DISTINCT CASE WHEN ae.event_type = 'share' THEN ae.id END) as shares,
      CASE 
        WHEN COUNT(DISTINCT CASE WHEN ae.event_type = 'view' THEN ae.id END) > 0
        THEN (
          COUNT(DISTINCT CASE WHEN ae.event_type IN ('like', 'comment', 'share') THEN ae.id END)::NUMERIC /
          COUNT(DISTINCT CASE WHEN ae.event_type = 'view' THEN ae.id END) * 100
        )
        ELSE 0
      END as engagement_rate,
      -- Trending score based on recent engagement weighted by time
      SUM(
        CASE
          WHEN ae.created_at > NOW() - INTERVAL '1 hour'
          THEN 4  -- Higher weight for very recent engagement
          WHEN ae.created_at > NOW() - INTERVAL '6 hours'
          THEN 2  -- Medium weight for recent engagement
          ELSE 1  -- Base weight for older engagement
        END
      ) as trending_score
    FROM analytics_events ae
    WHERE ae.created_at >= NOW() - time_range::INTERVAL
      AND (content_type IS NULL OR ae.metadata->>'content_type' = content_type)
    GROUP BY ae.content_id
  )
  SELECT
    m.content_id,
    m.total_engagement,
    m.views,
    m.likes,
    m.comments,
    m.shares,
    ROUND(m.engagement_rate, 2) as engagement_rate,
    m.trending_score
  FROM metrics m
  ORDER BY m.trending_score DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Create RLS policies
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_cohorts ENABLE ROW LEVEL SECURITY;

-- Policies for analytics_events
CREATE POLICY "Allow insert analytics events for authenticated users"
  ON analytics_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow view analytics events for moderators and admins"
  ON analytics_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('moderator', 'admin')
    )
  );

-- Policies for user_cohorts
CREATE POLICY "Allow view cohort data for moderators and admins"
  ON user_cohorts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('moderator', 'admin')
    )
  );

CREATE POLICY "Allow update own cohort data"
  ON user_cohorts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id); 