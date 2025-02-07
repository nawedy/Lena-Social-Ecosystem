-- Create key rotation tables
CREATE TABLE key_backups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  key_id UUID REFERENCES encryption_keys(id) ON DELETE CASCADE NOT NULL,
  backup_key_id UUID REFERENCES encryption_keys(id) ON DELETE CASCADE NOT NULL,
  encrypted_data TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(key_id, backup_key_id)
);

CREATE TABLE key_rotation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  old_key_id UUID REFERENCES encryption_keys(id) ON DELETE CASCADE NOT NULL,
  new_key_id UUID REFERENCES encryption_keys(id) ON DELETE CASCADE NOT NULL,
  rotation_type TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE key_recovery_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  key_id UUID REFERENCES encryption_keys(id) ON DELETE CASCADE NOT NULL,
  encrypted_code TEXT NOT NULL,
  used BOOLEAN DEFAULT false,
  used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create function to log key rotation
CREATE OR REPLACE FUNCTION log_key_rotation(
  p_user_id UUID,
  p_old_key_id UUID,
  p_new_key_id UUID,
  p_rotation_type TEXT,
  p_status TEXT,
  p_error_message TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS void AS $$
BEGIN
  INSERT INTO key_rotation_logs (
    user_id,
    old_key_id,
    new_key_id,
    rotation_type,
    status,
    error_message,
    metadata
  ) VALUES (
    p_user_id,
    p_old_key_id,
    p_new_key_id,
    p_rotation_type,
    p_status,
    p_error_message,
    p_metadata
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to generate recovery codes
CREATE OR REPLACE FUNCTION generate_recovery_codes(
  p_user_id UUID,
  p_key_id UUID,
  p_count INTEGER DEFAULT 10
)
RETURNS void AS $$
DECLARE
  v_code TEXT;
  v_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Set expiration date (90 days from now)
  v_expires_at := NOW() + INTERVAL '90 days';

  -- Generate specified number of recovery codes
  FOR i IN 1..p_count LOOP
    -- Generate random code
    v_code := encode(gen_random_bytes(32), 'base64');

    -- Insert encrypted code
    INSERT INTO key_recovery_codes (
      user_id,
      key_id,
      encrypted_code,
      expires_at,
      metadata
    ) VALUES (
      p_user_id,
      p_key_id,
      v_code, -- In production, this should be encrypted
      v_expires_at,
      jsonb_build_object(
        'sequence', i,
        'total', p_count
      )
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to validate recovery code
CREATE OR REPLACE FUNCTION validate_recovery_code(
  p_user_id UUID,
  p_key_id UUID,
  p_code TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_valid BOOLEAN;
BEGIN
  -- Check if code exists, is unused, and not expired
  UPDATE key_recovery_codes
  SET 
    used = true,
    used_at = NOW()
  WHERE user_id = p_user_id
    AND key_id = p_key_id
    AND encrypted_code = p_code -- In production, compare encrypted values
    AND NOT used
    AND (expires_at IS NULL OR expires_at > NOW())
  RETURNING true INTO v_valid;

  RETURN COALESCE(v_valid, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes
CREATE INDEX idx_key_backups_user ON key_backups(user_id);
CREATE INDEX idx_key_backups_key ON key_backups(key_id);
CREATE INDEX idx_key_rotation_logs_user ON key_rotation_logs(user_id);
CREATE INDEX idx_key_rotation_logs_old_key ON key_rotation_logs(old_key_id);
CREATE INDEX idx_key_rotation_logs_new_key ON key_rotation_logs(new_key_id);
CREATE INDEX idx_key_recovery_codes_user ON key_recovery_codes(user_id);
CREATE INDEX idx_key_recovery_codes_key ON key_recovery_codes(key_id);
CREATE INDEX idx_key_recovery_codes_unused ON key_recovery_codes(used) WHERE NOT used;

-- Enable Row Level Security
ALTER TABLE key_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_rotation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_recovery_codes ENABLE ROW LEVEL SECURITY;

-- Create policies for key backups
CREATE POLICY "Users can view their own key backups"
  ON key_backups FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own key backups"
  ON key_backups FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Create policies for key rotation logs
CREATE POLICY "Users can view their own key rotation logs"
  ON key_rotation_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Create policies for recovery codes
CREATE POLICY "Users can view their own recovery codes"
  ON key_recovery_codes FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own recovery codes"
  ON key_recovery_codes FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid()); 