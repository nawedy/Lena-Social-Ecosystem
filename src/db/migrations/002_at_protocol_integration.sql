-- Add AT Protocol specific fields to beta_users
ALTER TABLE beta_users
ADD COLUMN at_handle TEXT,
ADD COLUMN at_did TEXT,
ADD COLUMN at_jwt TEXT,
ADD COLUMN at_refresh_jwt TEXT,
ADD COLUMN at_service TEXT DEFAULT 'bsky.social',
ADD COLUMN at_email_verified BOOLEAN DEFAULT false,
ADD COLUMN at_profile_complete BOOLEAN DEFAULT false;

-- Create AT Protocol specific indexes
CREATE INDEX idx_beta_users_at_handle ON beta_users(at_handle);
CREATE INDEX idx_beta_users_at_did ON beta_users(at_did);

-- Create AT Protocol analytics table
CREATE TABLE at_protocol_analytics (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES beta_users(did),
    event_type TEXT NOT NULL,
    repo TEXT,
    collection TEXT,
    rkey TEXT,
    cid TEXT,
    uri TEXT,
    event_data JSONB NOT NULL,
    client_timestamp TIMESTAMP WITH TIME ZONE,
    server_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for AT Protocol analytics
CREATE INDEX idx_at_analytics_user_id ON at_protocol_analytics(user_id);
CREATE INDEX idx_at_analytics_event_type ON at_protocol_analytics(event_type);
CREATE INDEX idx_at_analytics_repo ON at_protocol_analytics(repo);
CREATE INDEX idx_at_analytics_collection ON at_protocol_analytics(collection);

-- Create AT Protocol feature flags
INSERT INTO beta_feature_flags (name, description, enabled, metadata) VALUES
('at.custom_feeds', 'Enable custom feed algorithms', true, '{"requires_indexing": true}'),
('at.content_moderation', 'Enable advanced content moderation', true, '{"requires_labeler": true}'),
('at.thread_participation', 'Enable thread participation features', true, '{}'),
('at.rich_text', 'Enable rich text formatting', false, '{"experimental": true}'),
('at.media_attachments', 'Enable enhanced media attachments', true, '{"max_size_mb": 50}');
