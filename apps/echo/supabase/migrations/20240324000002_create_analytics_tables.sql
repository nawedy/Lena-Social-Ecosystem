-- Create analytics tables
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  content_id UUID NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_cohorts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  cohort_date DATE NOT NULL,
  last_active_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, cohort_date)
);

CREATE TABLE analytics_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric_type TEXT NOT NULL,
  value NUMERIC NOT NULL,
  dimensions JSONB DEFAULT '{}',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_analytics_events_user ON analytics_events(user_id);
CREATE INDEX idx_analytics_events_content ON analytics_events(content_id);
CREATE INDEX idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_events_created ON analytics_events(created_at);
CREATE INDEX idx_analytics_events_metadata ON analytics_events USING gin(metadata);

CREATE INDEX idx_user_cohorts_user ON user_cohorts(user_id);
CREATE INDEX idx_user_cohorts_date ON user_cohorts(cohort_date);
CREATE INDEX idx_user_cohorts_active ON user_cohorts(last_active_date);

CREATE INDEX idx_analytics_metrics_type ON analytics_metrics(metric_type);
CREATE INDEX idx_analytics_metrics_timestamp ON analytics_metrics(timestamp);
CREATE INDEX idx_analytics_metrics_dimensions ON analytics_metrics USING gin(dimensions);

-- Create trigger to update analytics metrics
CREATE OR REPLACE FUNCTION update_analytics_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Update total events count
  INSERT INTO analytics_metrics (
    metric_type,
    value,
    dimensions
  ) VALUES (
    'total_events',
    1,
    jsonb_build_object(
      'event_type', NEW.event_type,
      'content_type', NEW.metadata->>'content_type'
    )
  );

  -- Update user activity
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO analytics_metrics (
      metric_type,
      value,
      dimensions
    ) VALUES (
      'user_activity',
      1,
      jsonb_build_object(
        'user_id', NEW.user_id,
        'event_type', NEW.event_type
      )
    );
  END IF;

  -- Update content engagement
  INSERT INTO analytics_metrics (
    metric_type,
    value,
    dimensions
  ) VALUES (
    'content_engagement',
    1,
    jsonb_build_object(
      'content_id', NEW.content_id,
      'event_type', NEW.event_type
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER analytics_events_metrics_trigger
  AFTER INSERT ON analytics_events
  FOR EACH ROW
  EXECUTE FUNCTION update_analytics_metrics(); 