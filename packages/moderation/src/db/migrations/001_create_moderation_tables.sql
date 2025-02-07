-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enum types
CREATE TYPE moderation_status AS ENUM (
  'pending',
  'approved',
  'rejected',
  'flagged',
  'under_review'
);

CREATE TYPE moderation_reason AS ENUM (
  'hate_speech',
  'harassment',
  'violence',
  'adult',
  'spam',
  'copyright',
  'misinformation',
  'other'
);

CREATE TYPE content_type AS ENUM (
  'text',
  'image',
  'video',
  'audio'
);

-- Create moderation results table
CREATE TABLE moderation_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id UUID NOT NULL,
  content_type content_type NOT NULL,
  status moderation_status NOT NULL DEFAULT 'pending',
  reason moderation_reason,
  confidence FLOAT NOT NULL DEFAULT 0,
  moderated_by TEXT NOT NULL CHECK (moderated_by IN ('ai', 'human', 'community')),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create moderation appeals table
CREATE TABLE moderation_appeals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  moderation_id UUID NOT NULL REFERENCES moderation_results(id),
  user_id UUID NOT NULL,
  reason TEXT NOT NULL,
  evidence TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create community flags table
CREATE TABLE community_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id UUID NOT NULL,
  user_id UUID NOT NULL,
  reason moderation_reason NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_moderation_results_content_id ON moderation_results(content_id);
CREATE INDEX idx_moderation_results_status ON moderation_results(status);
CREATE INDEX idx_moderation_appeals_moderation_id ON moderation_appeals(moderation_id);
CREATE INDEX idx_moderation_appeals_user_id ON moderation_appeals(user_id);
CREATE INDEX idx_community_flags_content_id ON community_flags(content_id);
CREATE INDEX idx_community_flags_user_id ON community_flags(user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER set_timestamp_moderation_results
  BEFORE UPDATE ON moderation_results
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_moderation_appeals
  BEFORE UPDATE ON moderation_appeals
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

-- Create function to get moderation stats
CREATE OR REPLACE FUNCTION get_moderation_stats()
RETURNS TABLE (
  total_content BIGINT,
  pending_reviews BIGINT,
  approved_content BIGINT,
  rejected_content BIGINT,
  flagged_content BIGINT,
  average_review_time FLOAT,
  appeal_rate FLOAT,
  appeal_success_rate FLOAT
) AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'pending') as pending,
      COUNT(*) FILTER (WHERE status = 'approved') as approved,
      COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
      COUNT(*) FILTER (WHERE status = 'flagged') as flagged,
      AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) FILTER (WHERE status != 'pending') as avg_review_time,
      (SELECT COUNT(*)::FLOAT / NULLIF(COUNT(*) FILTER (WHERE status = 'rejected'), 0)
       FROM moderation_appeals) as appeal_rate,
      (SELECT COUNT(*)::FLOAT / NULLIF(COUNT(*), 0) FILTER (WHERE status = 'approved')
       FROM moderation_appeals) as appeal_success
    FROM moderation_results
  )
  SELECT
    total as total_content,
    pending as pending_reviews,
    approved as approved_content,
    rejected as rejected_content,
    flagged as flagged_content,
    COALESCE(avg_review_time, 0) as average_review_time,
    COALESCE(appeal_rate, 0) as appeal_rate,
    COALESCE(appeal_success, 0) as appeal_success_rate
  FROM stats;
END;
$$ LANGUAGE plpgsql; 