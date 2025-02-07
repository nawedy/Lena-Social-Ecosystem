-- Create analytics tables
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  content_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE analytics_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric_type TEXT NOT NULL,
  value FLOAT NOT NULL,
  dimensions JSONB DEFAULT '{}',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_cohorts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cohort_date DATE NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  last_active_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(cohort_date, user_id)
);

-- Create indexes
CREATE INDEX idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_events_user ON analytics_events(user_id);
CREATE INDEX idx_analytics_events_created ON analytics_events(created_at);
CREATE INDEX idx_analytics_metrics_type ON analytics_metrics(metric_type);
CREATE INDEX idx_analytics_metrics_timestamp ON analytics_metrics(timestamp);
CREATE INDEX idx_user_cohorts_date ON user_cohorts(cohort_date);
CREATE INDEX idx_user_cohorts_user ON user_cohorts(user_id);

-- Create function to get engagement metrics
CREATE OR REPLACE FUNCTION get_engagement_metrics(time_range TEXT)
RETURNS JSON AS $$
DECLARE
  start_date TIMESTAMP;
  result JSON;
BEGIN
  -- Set start date based on time range
  start_date := CASE time_range
    WHEN 'day' THEN NOW() - INTERVAL '1 day'
    WHEN 'week' THEN NOW() - INTERVAL '1 week'
    WHEN 'month' THEN NOW() - INTERVAL '1 month'
    WHEN 'year' THEN NOW() - INTERVAL '1 year'
    ELSE NOW() - INTERVAL '1 week'
  END;

  -- Get metrics
  WITH metrics AS (
    SELECT
      COUNT(DISTINCT CASE WHEN event_type = 'post_created' THEN content_id END) as total_posts,
      COUNT(DISTINCT user_id) as total_users,
      COUNT(*) as total_interactions,
      COUNT(*) / NULLIF(COUNT(DISTINCT user_id), 0)::FLOAT as avg_engagement_rate,
      json_agg(
        json_build_object(
          'date', DATE_TRUNC('hour', created_at),
          'posts', SUM(CASE WHEN event_type = 'post_created' THEN 1 ELSE 0 END),
          'users', COUNT(DISTINCT user_id),
          'interactions', COUNT(*)
        )
      ) FILTER (WHERE created_at >= start_date) as timeline_data
    FROM analytics_events
    WHERE created_at >= start_date
  ),
  content_breakdown AS (
    SELECT
      json_agg(
        json_build_object(
          'type', event_type,
          'count', COUNT(*),
          'engagement', AVG(COALESCE((metadata->>'engagement_score')::FLOAT, 0))
        )
      ) as breakdown
    FROM analytics_events
    WHERE created_at >= start_date
    GROUP BY event_type
  ),
  user_growth AS (
    SELECT
      json_agg(
        json_build_object(
          'date', DATE_TRUNC('day', created_at),
          'newUsers', COUNT(DISTINCT CASE WHEN event_type = 'user_created' THEN user_id END),
          'activeUsers', COUNT(DISTINCT user_id),
          'churnedUsers', COUNT(DISTINCT CASE WHEN event_type = 'user_churned' THEN user_id END)
        )
      ) as growth
    FROM analytics_events
    WHERE created_at >= start_date
    GROUP BY DATE_TRUNC('day', created_at)
    ORDER BY DATE_TRUNC('day', created_at)
  ),
  retention_data AS (
    WITH cohorts AS (
      SELECT
        DATE_TRUNC('week', c.cohort_date) as cohort_week,
        COUNT(DISTINCT c.user_id) as cohort_size,
        ARRAY_AGG(
          COUNT(DISTINCT CASE 
            WHEN e.created_at >= c.cohort_date + (n || ' week')::INTERVAL
              AND e.created_at < c.cohort_date + ((n + 1) || ' week')::INTERVAL
            THEN e.user_id
          END)::FLOAT / COUNT(DISTINCT c.user_id)
          ORDER BY n
        ) as retention_rates
      FROM user_cohorts c
      CROSS JOIN generate_series(0, 11) as n
      LEFT JOIN analytics_events e ON e.user_id = c.user_id
      WHERE c.cohort_date >= start_date
      GROUP BY DATE_TRUNC('week', c.cohort_date)
      ORDER BY cohort_week DESC
      LIMIT 12
    )
    SELECT
      json_agg(
        json_build_object(
          'cohort', TO_CHAR(cohort_week, 'YYYY-MM-DD'),
          'size', cohort_size,
          'retentionRates', retention_rates
        )
      ) as retention
    FROM cohorts
  )
  SELECT
    json_build_object(
      'totalPosts', m.total_posts,
      'totalUsers', m.total_users,
      'totalInteractions', m.total_interactions,
      'averageEngagementRate', m.avg_engagement_rate,
      'timelineData', m.timeline_data,
      'contentBreakdown', cb.breakdown,
      'userGrowth', ug.growth,
      'retentionData', rd.retention
    ) INTO result
  FROM metrics m
  CROSS JOIN content_breakdown cb
  CROSS JOIN user_growth ug
  CROSS JOIN retention_data rd;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create function to track analytics events
CREATE OR REPLACE FUNCTION track_analytics_event(
  event_type TEXT,
  user_id UUID,
  content_id UUID DEFAULT NULL,
  metadata JSONB DEFAULT '{}'
)
RETURNS void AS $$
BEGIN
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

  -- Update user cohorts
  INSERT INTO user_cohorts (
    cohort_date,
    user_id,
    last_active_date
  ) VALUES (
    DATE_TRUNC('day', CURRENT_DATE),
    user_id,
    CURRENT_DATE
  )
  ON CONFLICT (cohort_date, user_id)
  DO UPDATE SET
    last_active_date = CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Create function to calculate engagement score
CREATE OR REPLACE FUNCTION calculate_engagement_score(
  likes INT,
  comments INT,
  shares INT,
  views INT,
  time_spent INT
)
RETURNS FLOAT AS $$
BEGIN
  RETURN (
    (likes * 1.0 + comments * 2.0 + shares * 3.0) / NULLIF(views, 0)::FLOAT
  ) * (LEAST(time_spent, 300)::FLOAT / 300.0);
END;
$$ LANGUAGE plpgsql;

-- Create RLS policies
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_cohorts ENABLE ROW LEVEL SECURITY;

-- Create policies for analytics events
CREATE POLICY "Allow insert analytics events"
  ON analytics_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow read own analytics events"
  ON analytics_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for analytics metrics
CREATE POLICY "Allow read analytics metrics"
  ON analytics_metrics FOR SELECT
  TO authenticated
  USING (true);

-- Create policies for user cohorts
CREATE POLICY "Allow read own cohort data"
  ON user_cohorts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create trigger to track user activity
CREATE OR REPLACE FUNCTION update_user_activity()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM track_analytics_event(
    'user_activity',
    NEW.user_id,
    NEW.content_id,
    json_build_object(
      'event_type', NEW.event_type,
      'metadata', NEW.metadata
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_user_activity
  AFTER INSERT ON analytics_events
  FOR EACH ROW
  WHEN (NEW.event_type NOT IN ('user_activity', 'user_created', 'user_churned'))
  EXECUTE FUNCTION update_user_activity(); 