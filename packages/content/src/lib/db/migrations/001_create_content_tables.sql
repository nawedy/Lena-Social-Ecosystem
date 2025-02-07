-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Create enum types
CREATE TYPE content_type AS ENUM (
  'text',
  'image',
  'video',
  'audio'
);

CREATE TYPE content_status AS ENUM (
  'processing',
  'success',
  'failed'
);

-- Create content table
CREATE TABLE content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  type content_type NOT NULL,
  title TEXT,
  description TEXT,
  tags TEXT[],
  original_url TEXT NOT NULL,
  processed_url TEXT,
  thumbnail_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  status content_status NOT NULL DEFAULT 'processing',
  error TEXT,
  location GEOGRAPHY(POINT),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create content_versions table for version history
CREATE TABLE content_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  version INT NOT NULL,
  url TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(content_id, version)
);

-- Create content_analytics table
CREATE TABLE content_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  views BIGINT NOT NULL DEFAULT 0,
  likes BIGINT NOT NULL DEFAULT 0,
  shares BIGINT NOT NULL DEFAULT 0,
  comments BIGINT NOT NULL DEFAULT 0,
  watch_time BIGINT NOT NULL DEFAULT 0, -- in seconds
  engagement_rate FLOAT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create content_processing_logs table
CREATE TABLE content_processing_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  metadata JSONB,
  duration INT, -- in milliseconds
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_content_user_id ON content(user_id);
CREATE INDEX idx_content_type ON content(type);
CREATE INDEX idx_content_status ON content(status);
CREATE INDEX idx_content_created_at ON content(created_at);
CREATE INDEX idx_content_location ON content USING GIST(location);
CREATE INDEX idx_content_tags ON content USING GIN(tags);

CREATE INDEX idx_content_versions_content_id ON content_versions(content_id);
CREATE INDEX idx_content_analytics_content_id ON content_analytics(content_id);
CREATE INDEX idx_content_processing_logs_content_id ON content_processing_logs(content_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER set_timestamp_content
  BEFORE UPDATE ON content
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_content_analytics
  BEFORE UPDATE ON content_analytics
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

-- Create function to update analytics
CREATE OR REPLACE FUNCTION update_content_analytics(
  content_id UUID,
  views_delta INT DEFAULT 0,
  likes_delta INT DEFAULT 0,
  shares_delta INT DEFAULT 0,
  comments_delta INT DEFAULT 0,
  watch_time_delta INT DEFAULT 0
)
RETURNS void AS $$
BEGIN
  INSERT INTO content_analytics (content_id)
  VALUES (content_id)
  ON CONFLICT (content_id) DO UPDATE
  SET
    views = content_analytics.views + views_delta,
    likes = content_analytics.likes + likes_delta,
    shares = content_analytics.shares + shares_delta,
    comments = content_analytics.comments + comments_delta,
    watch_time = content_analytics.watch_time + watch_time_delta,
    engagement_rate = (
      (content_analytics.likes + likes_delta + content_analytics.comments + comments_delta)::FLOAT /
      NULLIF(content_analytics.views + views_delta, 0)
    );
END;
$$ LANGUAGE plpgsql;

-- Create function to get trending content
CREATE OR REPLACE FUNCTION get_trending_content(
  content_type content_type = NULL,
  time_window INTERVAL = INTERVAL '24 hours',
  limit_count INT = 10
)
RETURNS TABLE (
  content_id UUID,
  engagement_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    (
      (ca.views * 1 +
       ca.likes * 2 +
       ca.comments * 3 +
       ca.shares * 4)::FLOAT /
      EXTRACT(EPOCH FROM (NOW() - c.created_at))
    ) as score
  FROM content c
  JOIN content_analytics ca ON c.id = ca.content_id
  WHERE
    (content_type IS NULL OR c.type = content_type) AND
    c.created_at > NOW() - time_window AND
    c.status = 'success'
  ORDER BY score DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql; 