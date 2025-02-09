-- Enum types
CREATE TYPE wallet_status AS ENUM ('active', 'inactive', 'locked');
CREATE TYPE transaction_type AS ENUM ('send', 'receive', 'exchange', 'stake', 'unstake', 'reward');
CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'failed');
CREATE TYPE currency_type AS ENUM ('crypto', 'fiat');

-- KYC related tables
CREATE TYPE kyc_status AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE document_type AS ENUM ('passport', 'national_id', 'drivers_license', 'utility_bill', 'proof_of_income', 'tax_documents');

-- Wallets table
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  currency TEXT NOT NULL,
  address TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  status wallet_status DEFAULT 'active',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, currency)
);

-- Transactions table
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id UUID NOT NULL REFERENCES wallets(id),
  type transaction_type NOT NULL,
  status transaction_status NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  amount DECIMAL NOT NULL,
  currency TEXT NOT NULL,
  fee DECIMAL NOT NULL,
  hash TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Balances table
CREATE TABLE balances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id UUID NOT NULL REFERENCES wallets(id),
  currency TEXT NOT NULL,
  amount DECIMAL NOT NULL DEFAULT 0,
  usd_value DECIMAL NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(wallet_id, currency)
);

-- Multi-sig approvals table
CREATE TABLE multi_sig_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL REFERENCES transactions(id),
  approver_id UUID NOT NULL REFERENCES auth.users(id),
  signature TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(transaction_id, approver_id)
);

-- Price feed table
CREATE TABLE price_feed (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  currency TEXT NOT NULL,
  price_usd DECIMAL NOT NULL,
  volume_24h DECIMAL,
  market_cap DECIMAL,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(currency)
);

-- Bank accounts table
CREATE TABLE bank_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  account_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  routing_number TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  country TEXT NOT NULL,
  currency TEXT NOT NULL,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- KYC related tables
CREATE TABLE user_kyc (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  level INTEGER NOT NULL DEFAULT 0,
  status kyc_status NOT NULL DEFAULT 'pending',
  risk_score INTEGER,
  last_review TIMESTAMPTZ,
  next_review TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE kyc_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  type document_type NOT NULL,
  document_url TEXT NOT NULL,
  status kyc_status NOT NULL DEFAULT 'pending',
  verification_notes TEXT,
  metadata JSONB DEFAULT '{}',
  expiry_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE compliance_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  provider TEXT NOT NULL,
  reference_id TEXT,
  results JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE transfer_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  currency TEXT NOT NULL,
  type currency_type NOT NULL,
  daily_limit DECIMAL NOT NULL,
  daily_used DECIMAL NOT NULL DEFAULT 0,
  monthly_limit DECIMAL NOT NULL,
  monthly_used DECIMAL NOT NULL DEFAULT 0,
  annual_limit DECIMAL NOT NULL,
  annual_used DECIMAL NOT NULL DEFAULT 0,
  last_reset TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, currency, type)
);

-- Create indexes
CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_transactions_wallet_id ON transactions(wallet_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_balances_wallet_id ON balances(wallet_id);
CREATE INDEX idx_price_feed_last_updated ON price_feed(last_updated);
CREATE INDEX idx_kyc_documents_user_id ON kyc_documents(user_id);
CREATE INDEX idx_compliance_checks_user_id ON compliance_checks(user_id);
CREATE INDEX idx_transfer_limits_user_id ON transfer_limits(user_id);

-- Create functions
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_wallets_updated_at
  BEFORE UPDATE ON wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_bank_accounts_updated_at
  BEFORE UPDATE ON bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_user_kyc_updated_at
  BEFORE UPDATE ON user_kyc
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_kyc_documents_updated_at
  BEFORE UPDATE ON kyc_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_transfer_limits_updated_at
  BEFORE UPDATE ON transfer_limits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- RLS Policies
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_kyc ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own wallets"
  ON wallets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own transactions"
  ON transactions FOR SELECT
  USING (wallet_id IN (
    SELECT id FROM wallets WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can view their own balances"
  ON balances FOR SELECT
  USING (wallet_id IN (
    SELECT id FROM wallets WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can view their own bank accounts"
  ON bank_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own KYC status"
  ON user_kyc FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own KYC documents"
  ON kyc_documents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own compliance checks"
  ON compliance_checks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own transfer limits"
  ON transfer_limits FOR SELECT
  USING (auth.uid() = user_id);

-- Functions for compliance
CREATE OR REPLACE FUNCTION get_transaction_totals(
  user_id UUID,
  currency TEXT
) RETURNS TABLE (
  daily DECIMAL,
  monthly DECIMAL,
  annual DECIMAL
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(amount) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day'), 0) as daily,
    COALESCE(SUM(amount) FILTER (WHERE created_at >= NOW() - INTERVAL '1 month'), 0) as monthly,
    COALESCE(SUM(amount) FILTER (WHERE created_at >= NOW() - INTERVAL '1 year'), 0) as annual
  FROM transactions t
  JOIN wallets w ON t.wallet_id = w.id
  WHERE w.user_id = $1 AND t.currency = $2 AND t.status = 'completed';
END;
$$; 