-- Create token gate tables
CREATE TABLE token_gates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id UUID NOT NULL,
  contract_address TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  min_token_balance TEXT,
  required_token_ids TEXT[],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(content_id)
);

CREATE TABLE token_gate_access_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_gate_id UUID REFERENCES token_gates(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  wallet_address TEXT NOT NULL,
  access_granted BOOLEAN NOT NULL,
  token_balance TEXT,
  owned_token_ids TEXT[],
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create function to log token gate access
CREATE OR REPLACE FUNCTION log_token_gate_access(
  p_token_gate_id UUID,
  p_user_id UUID,
  p_wallet_address TEXT,
  p_access_granted BOOLEAN,
  p_token_balance TEXT DEFAULT NULL,
  p_owned_token_ids TEXT[] DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS void AS $$
BEGIN
  INSERT INTO token_gate_access_logs (
    token_gate_id,
    user_id,
    wallet_address,
    access_granted,
    token_balance,
    owned_token_ids,
    error_message,
    metadata
  ) VALUES (
    p_token_gate_id,
    p_user_id,
    p_wallet_address,
    p_access_granted,
    p_token_balance,
    p_owned_token_ids,
    p_error_message,
    p_metadata
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check token gate access
CREATE OR REPLACE FUNCTION check_token_gate_access(
  p_content_id UUID,
  p_user_id UUID,
  p_wallet_address TEXT
)
RETURNS TABLE (
  has_access BOOLEAN,
  gate_exists BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  v_token_gate_id UUID;
BEGIN
  -- Check if content has a token gate
  SELECT id INTO v_token_gate_id
  FROM token_gates
  WHERE content_id = p_content_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      TRUE as has_access,
      FALSE as gate_exists,
      NULL::TEXT as error_message;
    RETURN;
  END IF;

  -- Check recent successful access within cache period (e.g., 1 hour)
  IF EXISTS (
    SELECT 1
    FROM token_gate_access_logs
    WHERE token_gate_id = v_token_gate_id
      AND user_id = p_user_id
      AND wallet_address = p_wallet_address
      AND access_granted = TRUE
      AND created_at > NOW() - INTERVAL '1 hour'
  ) THEN
    RETURN QUERY SELECT
      TRUE as has_access,
      TRUE as gate_exists,
      NULL::TEXT as error_message;
    RETURN;
  END IF;

  -- Return false if recent access was denied (prevent spam)
  IF EXISTS (
    SELECT 1
    FROM token_gate_access_logs
    WHERE token_gate_id = v_token_gate_id
      AND user_id = p_user_id
      AND wallet_address = p_wallet_address
      AND access_granted = FALSE
      AND created_at > NOW() - INTERVAL '5 minutes'
  ) THEN
    RETURN QUERY SELECT
      FALSE as has_access,
      TRUE as gate_exists,
      'Please wait before trying again'::TEXT as error_message;
    RETURN;
  END IF;

  -- Return gate exists but requires verification
  RETURN QUERY SELECT
    FALSE as has_access,
    TRUE as gate_exists,
    'Requires verification'::TEXT as error_message;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes
CREATE INDEX idx_token_gates_content ON token_gates(content_id);
CREATE INDEX idx_token_gates_contract ON token_gates(contract_address);
CREATE INDEX idx_token_gate_access_logs_gate ON token_gate_access_logs(token_gate_id);
CREATE INDEX idx_token_gate_access_logs_user ON token_gate_access_logs(user_id);
CREATE INDEX idx_token_gate_access_logs_wallet ON token_gate_access_logs(wallet_address);
CREATE INDEX idx_token_gate_access_logs_recent ON token_gate_access_logs(created_at DESC);

-- Enable Row Level Security
ALTER TABLE token_gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_gate_access_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for token gates
CREATE POLICY "Anyone can view token gates"
  ON token_gates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Content owners can manage token gates"
  ON token_gates FOR ALL
  TO authenticated
  USING (
    content_id IN (
      SELECT id FROM content WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    content_id IN (
      SELECT id FROM content WHERE user_id = auth.uid()
    )
  );

-- Create policies for access logs
CREATE POLICY "Users can view their own access logs"
  ON token_gate_access_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can create access logs"
  ON token_gate_access_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create trigger to update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_token_gates_updated_at
  BEFORE UPDATE ON token_gates
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column(); 