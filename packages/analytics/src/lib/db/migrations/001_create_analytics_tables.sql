-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "timescaledb";

-- Create analytics events table
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_name TEXT NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}',
  user_id UUID,
  session_id UUID,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create analytics users table
CREATE TABLE analytics_users (
  user_id UUID PRIMARY KEY,
  properties JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create content engagements table
CREATE TABLE content_engagements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id UUID NOT NULL,
  user_id UUID,
  session_id UUID NOT NULL,
  type TEXT NOT NULL,
  duration INTEGER,
  progress FLOAT,
  metadata JSONB NOT NULL DEFAULT '{}',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create content analytics table
CREATE TABLE content_analytics (
  content_id UUID PRIMARY KEY,
  views BIGINT NOT NULL DEFAULT 0,
  unique_views BIGINT NOT NULL DEFAULT 0,
  likes BIGINT NOT NULL DEFAULT 0,
  shares BIGINT NOT NULL DEFAULT 0,
  comments BIGINT NOT NULL DEFAULT 0,
  total_watch_time BIGINT NOT NULL DEFAULT 0,
  average_watch_time FLOAT,
  completion_rate FLOAT,
  engagement_rate FLOAT,
  retention_curve JSONB NOT NULL DEFAULT '[]',
  demographics JSONB NOT NULL DEFAULT '{}',
  devices JSONB NOT NULL DEFAULT '{}',
  referrers JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create user analytics table
CREATE TABLE user_analytics (
  user_id UUID PRIMARY KEY,
  total_views BIGINT NOT NULL DEFAULT 0,
  total_likes BIGINT NOT NULL DEFAULT 0,
  total_shares BIGINT NOT NULL DEFAULT 0,
  total_comments BIGINT NOT NULL DEFAULT 0,
  total_watch_time BIGINT NOT NULL DEFAULT 0,
  average_engagement_rate FLOAT,
  content_preferences JSONB NOT NULL DEFAULT '[]',
  viewing_history JSONB NOT NULL DEFAULT '[]',
  interaction_times JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create hypertables for time-series data
SELECT create_hypertable('analytics_events', 'timestamp');
SELECT create_hypertable('content_engagements', 'timestamp');

-- Create indexes
CREATE INDEX idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX idx_analytics_events_session_id ON analytics_events(session_id);
CREATE INDEX idx_analytics_events_name ON analytics_events(event_name);
CREATE INDEX idx_analytics_events_timestamp ON analytics_events(timestamp DESC);

CREATE INDEX idx_content_engagements_content_id ON content_engagements(content_id);
CREATE INDEX idx_content_engagements_user_id ON content_engagements(user_id);
CREATE INDEX idx_content_engagements_session_id ON content_engagements(session_id);
CREATE INDEX idx_content_engagements_type ON content_engagements(type);
CREATE INDEX idx_content_engagements_timestamp ON content_engagements(timestamp DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER set_timestamp_analytics_users
  BEFORE UPDATE ON analytics_users
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_content_analytics
  BEFORE UPDATE ON content_analytics
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_user_analytics
  BEFORE UPDATE ON user_analytics
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

-- Create function to update content analytics
CREATE OR REPLACE FUNCTION update_content_analytics(
  p_content_id UUID,
  p_engagement_type TEXT,
  p_duration INTEGER DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO content_analytics (content_id)
  VALUES (p_content_id)
  ON CONFLICT (content_id) DO UPDATE
  SET
    views = CASE
      WHEN p_engagement_type = 'view' THEN content_analytics.views + 1
      ELSE content_analytics.views
    END,
    likes = CASE
      WHEN p_engagement_type = 'like' THEN content_analytics.likes + 1
      ELSE content_analytics.likes
    END,
    shares = CASE
      WHEN p_engagement_type = 'share' THEN content_analytics.shares + 1
      ELSE content_analytics.shares
    END,
    comments = CASE
      WHEN p_engagement_type = 'comment' THEN content_analytics.comments + 1
      ELSE content_analytics.comments
    END,
    total_watch_time = CASE
      WHEN p_engagement_type = 'watch' AND p_duration IS NOT NULL
      THEN content_analytics.total_watch_time + p_duration
      ELSE content_analytics.total_watch_time
    END,
    average_watch_time = CASE
      WHEN p_engagement_type = 'watch' AND p_duration IS NOT NULL
      THEN (content_analytics.total_watch_time + p_duration)::FLOAT / content_analytics.views
      ELSE content_analytics.average_watch_time
    END,
    engagement_rate = (
      content_analytics.likes + content_analytics.comments + content_analytics.shares
    )::FLOAT / NULLIF(content_analytics.views, 0);
END;
$$ LANGUAGE plpgsql;

-- Create function to generate analytics report
CREATE OR REPLACE FUNCTION generate_analytics_report(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_period TEXT DEFAULT 'day'
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  WITH metrics AS (
    SELECT
      COUNT(DISTINCT e.id) as total_events,
      COUNT(DISTINCT e.user_id) as unique_users,
      COUNT(DISTINCT e.session_id) as total_sessions,
      COUNT(DISTINCT CASE WHEN e.event_name = 'content_view' THEN e.id END) as total_views,
      COUNT(DISTINCT CASE WHEN e.event_name = 'content_like' THEN e.id END) as total_likes,
      COUNT(DISTINCT CASE WHEN e.event_name = 'content_share' THEN e.id END) as total_shares
    FROM analytics_events e
    WHERE e.timestamp BETWEEN p_start_date AND p_end_date
  ),
  previous_metrics AS (
    SELECT
      COUNT(DISTINCT e.id) as total_events,
      COUNT(DISTINCT e.user_id) as unique_users,
      COUNT(DISTINCT e.session_id) as total_sessions,
      COUNT(DISTINCT CASE WHEN e.event_name = 'content_view' THEN e.id END) as total_views,
      COUNT(DISTINCT CASE WHEN e.event_name = 'content_like' THEN e.id END) as total_likes,
      COUNT(DISTINCT CASE WHEN e.event_name = 'content_share' THEN e.id END) as total_shares
    FROM analytics_events e
    WHERE e.timestamp BETWEEN
      p_start_date - (p_end_date - p_start_date) AND
      p_start_date
  ),
  trends AS (
    SELECT
      time_bucket(
        CASE p_period
          WHEN 'hour' THEN INTERVAL '1 hour'
          WHEN 'day' THEN INTERVAL '1 day'
          WHEN 'week' THEN INTERVAL '1 week'
          WHEN 'month' THEN INTERVAL '1 month'
          ELSE INTERVAL '1 day'
        END,
        timestamp
      ) as period,
      COUNT(DISTINCT id) as events,
      COUNT(DISTINCT user_id) as users,
      COUNT(DISTINCT session_id) as sessions
    FROM analytics_events
    WHERE timestamp BETWEEN p_start_date AND p_end_date
    GROUP BY period
    ORDER BY period
  )
  SELECT json_build_object(
    'period', p_period,
    'startDate', p_start_date,
    'endDate', p_end_date,
    'metrics', (
      SELECT json_build_object(
        'totalEvents', json_build_object(
          'current', m.total_events,
          'previous', pm.total_events,
          'change', (m.total_events - pm.total_events)::FLOAT / NULLIF(pm.total_events, 0) * 100
        ),
        'uniqueUsers', json_build_object(
          'current', m.unique_users,
          'previous', pm.unique_users,
          'change', (m.unique_users - pm.unique_users)::FLOAT / NULLIF(pm.unique_users, 0) * 100
        ),
        'totalSessions', json_build_object(
          'current', m.total_sessions,
          'previous', pm.total_sessions,
          'change', (m.total_sessions - pm.total_sessions)::FLOAT / NULLIF(pm.total_sessions, 0) * 100
        )
      )
      FROM metrics m, previous_metrics pm
    ),
    'trends', (
      SELECT json_object_agg(
        metric,
        json_build_object(
          'data', data,
          'trend', trend
        )
      )
      FROM (
        SELECT
          'events' as metric,
          json_agg(
            json_build_object(
              'timestamp', period,
              'value', events
            )
          ) as data,
          CASE
            WHEN MIN(events) = MAX(events) THEN 0
            ELSE (MAX(events) - MIN(events))::FLOAT / MIN(events) * 100
          END as trend
        FROM trends
        GROUP BY metric
        UNION ALL
        SELECT
          'users' as metric,
          json_agg(
            json_build_object(
              'timestamp', period,
              'value', users
            )
          ) as data,
          CASE
            WHEN MIN(users) = MAX(users) THEN 0
            ELSE (MAX(users) - MIN(users))::FLOAT / MIN(users) * 100
          END as trend
        FROM trends
        GROUP BY metric
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create function to get realtime analytics
CREATE OR REPLACE FUNCTION get_realtime_analytics()
RETURNS JSON AS $$
DECLARE
  result JSON;
  active_window INTERVAL := INTERVAL '5 minutes';
BEGIN
  WITH realtime_metrics AS (
    SELECT
      COUNT(DISTINCT user_id) as active_users,
      COUNT(DISTINCT CASE WHEN event_name = 'content_view' THEN id END) as current_views,
      json_agg(
        json_build_object(
          'type', event_name,
          'contentId', (properties->>'content_id')::UUID,
          'timestamp', timestamp,
          'metadata', properties
        )
        ORDER BY timestamp DESC
        LIMIT 10
      ) as recent_events,
      json_agg(
        DISTINCT jsonb_build_object(
          'contentId', (properties->>'content_id')::UUID,
          'activeViews', COUNT(*) FILTER (WHERE event_name = 'content_view'),
          'engagementRate', (
            COUNT(*) FILTER (WHERE event_name IN ('content_like', 'content_comment', 'content_share'))::FLOAT /
            NULLIF(COUNT(*) FILTER (WHERE event_name = 'content_view'), 0)
          )
        )
        ORDER BY COUNT(*) FILTER (WHERE event_name = 'content_view') DESC
        LIMIT 5
      ) as popular_content
    FROM analytics_events
    WHERE
      timestamp >= NOW() - active_window AND
      properties ? 'content_id'
    GROUP BY TRUE
  )
  SELECT json_build_object(
    'activeUsers', active_users,
    'currentViews', current_views,
    'popularContent', popular_content,
    'recentEvents', recent_events
  )
  INTO result
  FROM realtime_metrics;

  RETURN result;
END;
$$ LANGUAGE plpgsql; 