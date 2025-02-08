-- Create auth-related tables
CREATE TABLE auth_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  last_attempt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(email)
);

CREATE TABLE auth_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE mfa_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  totp_enabled BOOLEAN DEFAULT false,
  totp_secret TEXT,
  sms_enabled BOOLEAN DEFAULT false,
  phone_number TEXT,
  backup_codes TEXT[],
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

CREATE TABLE session_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  device_name TEXT,
  device_type TEXT,
  ip_address TEXT,
  last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_trusted BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, device_id)
);

CREATE TABLE security_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_recovery (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  recovery_code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT false,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_auth_attempts_email ON auth_attempts(email);
CREATE INDEX idx_auth_attempts_last_attempt ON auth_attempts(last_attempt);

CREATE INDEX idx_auth_events_user ON auth_events(user_id);
CREATE INDEX idx_auth_events_type ON auth_events(event_type);
CREATE INDEX idx_auth_events_created ON auth_events(created_at);

CREATE INDEX idx_session_devices_user ON session_devices(user_id);
CREATE INDEX idx_session_devices_device ON session_devices(device_id);
CREATE INDEX idx_session_devices_last_active ON session_devices(last_active);

CREATE INDEX idx_security_questions_user ON security_questions(user_id);

CREATE INDEX idx_user_recovery_user ON user_recovery(user_id);
CREATE INDEX idx_user_recovery_code ON user_recovery(recovery_code);
CREATE INDEX idx_user_recovery_expires ON user_recovery(expires_at);

-- Create functions
CREATE OR REPLACE FUNCTION check_mfa_requirement()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if MFA is required for the user
  IF EXISTS (
    SELECT 1
    FROM user_settings
    WHERE user_id = NEW.user_id
    AND require_mfa = true
  ) AND NOT EXISTS (
    SELECT 1
    FROM mfa_settings
    WHERE user_id = NEW.user_id
    AND (totp_enabled = true OR sms_enabled = true)
  ) THEN
    RAISE EXCEPTION 'MFA is required for this account';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION cleanup_expired_recovery_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM user_recovery
  WHERE expires_at < NOW()
  OR (used = true AND used_at < NOW() - INTERVAL '30 days');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION hash_security_answer()
RETURNS TRIGGER AS $$
BEGIN
  -- Hash the answer before storing
  NEW.answer_hash := crypt(NEW.answer_hash, gen_salt('bf'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
CREATE TRIGGER check_mfa_requirement_trigger
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION check_mfa_requirement();

CREATE TRIGGER hash_security_answer_trigger
  BEFORE INSERT OR UPDATE ON security_questions
  FOR EACH ROW
  EXECUTE FUNCTION hash_security_answer();

-- Create scheduled task for cleanup
SELECT cron.schedule(
  'cleanup-recovery-codes',
  '0 0 * * *', -- Run daily at midnight
  $$
    SELECT cleanup_expired_recovery_codes();
  $$
);

-- Enable Row Level Security
ALTER TABLE auth_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE mfa_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_recovery ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own auth attempts"
  ON auth_attempts FOR SELECT
  TO authenticated
  USING (email = auth.email());

CREATE POLICY "Users can view their own auth events"
  ON auth_events FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own MFA settings"
  ON mfa_settings FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view their own devices"
  ON session_devices FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own devices"
  ON session_devices FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can manage their own security questions"
  ON security_questions FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto; 