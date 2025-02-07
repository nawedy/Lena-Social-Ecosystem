-- Create security-related tables
CREATE TABLE user_security_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  encryption_enabled BOOLEAN DEFAULT false,
  mfa_enabled BOOLEAN DEFAULT false,
  session_timeout INTEGER DEFAULT 60, -- minutes
  ipfs_encryption BOOLEAN DEFAULT true,
  metadata_stripping BOOLEAN DEFAULT true,
  tracking_protection BOOLEAN DEFAULT true,
  encryption_keys JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

CREATE TABLE active_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_id TEXT NOT NULL,
  device_type TEXT,
  browser TEXT,
  os TEXT,
  ip_address TEXT,
  location TEXT,
  last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, session_id)
);

CREATE TABLE auth_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL,
  ip_address TEXT,
  location TEXT,
  device_info JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE encryption_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  key_type TEXT NOT NULL,
  public_key TEXT,
  encrypted_private_key TEXT,
  key_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, key_type)
);

-- Create indexes
CREATE INDEX idx_security_settings_user ON user_security_settings(user_id);
CREATE INDEX idx_active_sessions_user ON active_sessions(user_id);
CREATE INDEX idx_active_sessions_last_active ON active_sessions(last_active);
CREATE INDEX idx_auth_events_user ON auth_events(user_id);
CREATE INDEX idx_auth_events_created ON auth_events(created_at);
CREATE INDEX idx_encryption_keys_user ON encryption_keys(user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_security_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_security_settings_timestamp
  BEFORE UPDATE ON user_security_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_security_timestamp();

CREATE TRIGGER update_encryption_keys_timestamp
  BEFORE UPDATE ON encryption_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_security_timestamp();

-- Create function to log auth events
CREATE OR REPLACE FUNCTION log_auth_event(
  p_user_id UUID,
  p_event_type TEXT,
  p_ip_address TEXT,
  p_location TEXT,
  p_device_info JSONB,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS void AS $$
BEGIN
  INSERT INTO auth_events (
    user_id,
    event_type,
    ip_address,
    location,
    device_info,
    metadata
  ) VALUES (
    p_user_id,
    p_event_type,
    p_ip_address,
    p_location,
    p_device_info,
    p_metadata
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to manage sessions
CREATE OR REPLACE FUNCTION manage_user_session(
  p_user_id UUID,
  p_session_id TEXT,
  p_device_info JSONB
)
RETURNS void AS $$
DECLARE
  v_timeout INTEGER;
BEGIN
  -- Get user's session timeout setting
  SELECT session_timeout INTO v_timeout
  FROM user_security_settings
  WHERE user_id = p_user_id;

  -- Delete expired sessions
  DELETE FROM active_sessions
  WHERE user_id = p_user_id
    AND last_active < NOW() - (COALESCE(v_timeout, 60) || ' minutes')::INTERVAL;

  -- Insert or update current session
  INSERT INTO active_sessions (
    user_id,
    session_id,
    device_type,
    browser,
    os,
    ip_address,
    location,
    last_active
  ) VALUES (
    p_user_id,
    p_session_id,
    p_device_info->>'device_type',
    p_device_info->>'browser',
    p_device_info->>'os',
    p_device_info->>'ip_address',
    p_device_info->>'location',
    CURRENT_TIMESTAMP
  )
  ON CONFLICT (user_id, session_id)
  DO UPDATE SET
    last_active = CURRENT_TIMESTAMP,
    device_type = EXCLUDED.device_type,
    browser = EXCLUDED.browser,
    os = EXCLUDED.os,
    ip_address = EXCLUDED.ip_address,
    location = EXCLUDED.location;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable Row Level Security
ALTER TABLE user_security_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE encryption_keys ENABLE ROW LEVEL SECURITY;

-- Create security policies
CREATE POLICY "Users can view their own security settings"
  ON user_security_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own security settings"
  ON user_security_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert their security settings"
  ON user_security_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own sessions"
  ON active_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own sessions"
  ON active_sessions FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own auth events"
  ON auth_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert auth events"
  ON auth_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view their own encryption keys"
  ON encryption_keys FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own encryption keys"
  ON encryption_keys FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id); 