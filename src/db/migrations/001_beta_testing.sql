-- Beta Users Table
CREATE TABLE beta_users (
    id SERIAL PRIMARY KEY,
    did TEXT NOT NULL UNIQUE,
    handle TEXT NOT NULL,
    invited_by TEXT,
    invitation_code TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_active_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Beta Feedback Table
CREATE TABLE beta_feedback (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES beta_users(did),
    type TEXT NOT NULL CHECK (type IN ('general', 'bug', 'feature')),
    title TEXT,
    description TEXT NOT NULL,
    priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved', 'closed')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Beta Analytics Table
CREATE TABLE beta_analytics (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES beta_users(did),
    event_type TEXT NOT NULL,
    event_data JSONB NOT NULL,
    client_timestamp TIMESTAMP WITH TIME ZONE,
    server_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Beta Feature Flags Table
CREATE TABLE beta_feature_flags (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    enabled BOOLEAN DEFAULT false,
    user_percentage INTEGER DEFAULT 100 CHECK (user_percentage BETWEEN 0 AND 100),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Beta User Feature Access Table
CREATE TABLE beta_user_features (
    user_id TEXT NOT NULL REFERENCES beta_users(did),
    feature_id INTEGER NOT NULL REFERENCES beta_feature_flags(id),
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, feature_id)
);

-- Create indexes
CREATE INDEX idx_beta_users_handle ON beta_users(handle);
CREATE INDEX idx_beta_users_status ON beta_users(status);
CREATE INDEX idx_beta_feedback_user_id ON beta_feedback(user_id);
CREATE INDEX idx_beta_feedback_type ON beta_feedback(type);
CREATE INDEX idx_beta_feedback_status ON beta_feedback(status);
CREATE INDEX idx_beta_analytics_user_id ON beta_analytics(user_id);
CREATE INDEX idx_beta_analytics_event_type ON beta_analytics(event_type);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_beta_feedback_updated_at
    BEFORE UPDATE ON beta_feedback
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_beta_feature_flags_updated_at
    BEFORE UPDATE ON beta_feature_flags
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
