-- Create marketplace tables
CREATE TABLE marketplace_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  parent_id UUID REFERENCES marketplace_categories(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE marketplace_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price DECIMAL(18,8) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  images TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'sold')),
  stock INTEGER,
  metadata JSONB DEFAULT '{}',
  token_gated BOOLEAN DEFAULT false,
  nft_contract TEXT,
  min_token_balance TEXT,
  required_token_ids TEXT[],
  chain_id INTEGER,
  views INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE marketplace_product_categories (
  product_id UUID REFERENCES marketplace_products(id) ON DELETE CASCADE,
  category_id UUID REFERENCES marketplace_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, category_id)
);

CREATE TABLE marketplace_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  seller_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  product_id UUID REFERENCES marketplace_products(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'fulfilled', 'cancelled', 'refunded')),
  amount DECIMAL(18,8) NOT NULL,
  currency TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  payment_id TEXT,
  transaction_hash TEXT,
  escrow_address TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE marketplace_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES marketplace_orders(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  product_id UUID REFERENCES marketplace_products(id) ON DELETE SET NULL,
  seller_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  verified_purchase BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(order_id, reviewer_id)
);

CREATE TABLE marketplace_disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES marketplace_orders(id) ON DELETE CASCADE,
  initiator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  respondent_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'cancelled')),
  reason TEXT NOT NULL,
  resolution TEXT,
  evidence JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_products_seller ON marketplace_products(seller_id);
CREATE INDEX idx_products_status ON marketplace_products(status);
CREATE INDEX idx_products_token_gated ON marketplace_products(token_gated) WHERE token_gated = true;
CREATE INDEX idx_products_price ON marketplace_products(price);
CREATE INDEX idx_products_created ON marketplace_products(created_at);
CREATE INDEX idx_products_views ON marketplace_products(views);

CREATE INDEX idx_orders_buyer ON marketplace_orders(buyer_id);
CREATE INDEX idx_orders_seller ON marketplace_orders(seller_id);
CREATE INDEX idx_orders_product ON marketplace_orders(product_id);
CREATE INDEX idx_orders_status ON marketplace_orders(status);
CREATE INDEX idx_orders_created ON marketplace_orders(created_at);

CREATE INDEX idx_reviews_product ON marketplace_reviews(product_id);
CREATE INDEX idx_reviews_seller ON marketplace_reviews(seller_id);
CREATE INDEX idx_reviews_reviewer ON marketplace_reviews(reviewer_id);
CREATE INDEX idx_reviews_rating ON marketplace_reviews(rating);

CREATE INDEX idx_disputes_order ON marketplace_disputes(order_id);
CREATE INDEX idx_disputes_status ON marketplace_disputes(status);
CREATE INDEX idx_disputes_initiator ON marketplace_disputes(initiator_id);
CREATE INDEX idx_disputes_respondent ON marketplace_disputes(respondent_id);

-- Create functions
CREATE OR REPLACE FUNCTION update_product_views()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE marketplace_products
  SET views = views + 1
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calculate_seller_reputation(seller_id UUID)
RETURNS FLOAT AS $$
DECLARE
  avg_rating FLOAT;
BEGIN
  SELECT AVG(rating)::FLOAT
  INTO avg_rating
  FROM marketplace_reviews
  WHERE seller_id = calculate_seller_reputation.seller_id
    AND verified_purchase = true;
  
  RETURN COALESCE(avg_rating, 0);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_token_requirements(
  product_id UUID,
  buyer_address TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  product_record RECORD;
BEGIN
  -- Get product token requirements
  SELECT token_gated, nft_contract, min_token_balance, required_token_ids, chain_id
  INTO product_record
  FROM marketplace_products
  WHERE id = product_id;

  -- If not token gated, allow purchase
  IF NOT product_record.token_gated THEN
    RETURN true;
  END IF;

  -- Check token requirements using TokenGateService
  -- This is a placeholder - actual implementation would call external service
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_product_views_trigger
  AFTER INSERT ON marketplace_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_product_views();

-- Enable Row Level Security
ALTER TABLE marketplace_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_disputes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public read access to categories"
  ON marketplace_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow public read access to active products"
  ON marketplace_products FOR SELECT
  TO authenticated
  USING (status = 'active' OR seller_id = auth.uid());

CREATE POLICY "Allow sellers to manage their products"
  ON marketplace_products FOR ALL
  TO authenticated
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Allow public read access to product categories"
  ON marketplace_product_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow sellers to manage product categories"
  ON marketplace_product_categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM marketplace_products
      WHERE id = product_id AND seller_id = auth.uid()
    )
  );

CREATE POLICY "Allow users to view their orders"
  ON marketplace_orders FOR SELECT
  TO authenticated
  USING (buyer_id = auth.uid() OR seller_id = auth.uid());

CREATE POLICY "Allow buyers to create orders"
  ON marketplace_orders FOR INSERT
  TO authenticated
  WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "Allow order participants to view reviews"
  ON marketplace_reviews FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM marketplace_orders
      WHERE id = order_id
      AND (buyer_id = auth.uid() OR seller_id = auth.uid())
    )
  );

CREATE POLICY "Allow buyers to create reviews"
  ON marketplace_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM marketplace_orders
      WHERE id = order_id
      AND buyer_id = auth.uid()
      AND status = 'fulfilled'
    )
  );

CREATE POLICY "Allow dispute participants to view disputes"
  ON marketplace_disputes FOR SELECT
  TO authenticated
  USING (initiator_id = auth.uid() OR respondent_id = auth.uid());

CREATE POLICY "Allow order participants to create disputes"
  ON marketplace_disputes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM marketplace_orders
      WHERE id = order_id
      AND (buyer_id = auth.uid() OR seller_id = auth.uid())
    )
  ); 