-- Create audio-related enums
CREATE TYPE audio_license_type AS ENUM ('basic', 'premium', 'exclusive');
CREATE TYPE audio_order_status AS ENUM ('pending', 'paid', 'delivered', 'completed', 'cancelled', 'disputed');
CREATE TYPE audio_dispute_status AS ENUM ('open', 'resolved', 'closed');
CREATE TYPE audio_dispute_resolution AS ENUM ('refund', 'release', 'partial_refund');

-- Create audio tracks table
CREATE TABLE audio_tracks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  audio_url TEXT NOT NULL,
  artwork_url TEXT NOT NULL,
  preview_url TEXT NOT NULL,
  duration INTEGER NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  currency TEXT NOT NULL,
  artist_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bpm INTEGER,
  key TEXT,
  plays INTEGER DEFAULT 0,
  downloads INTEGER DEFAULT 0,
  rating DECIMAL(3,2),
  review_count INTEGER DEFAULT 0,
  token_gated BOOLEAN DEFAULT false,
  token_contract TEXT,
  token_id TEXT,
  token_standard TEXT CHECK (token_standard IN ('ERC721', 'ERC1155', 'ERC20')),
  nft BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create audio genres table
CREATE TABLE audio_genres (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  parent_id UUID REFERENCES audio_genres(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create audio track genres table
CREATE TABLE audio_track_genres (
  track_id UUID REFERENCES audio_tracks(id) ON DELETE CASCADE,
  genre_id UUID REFERENCES audio_genres(id) ON DELETE CASCADE,
  PRIMARY KEY (track_id, genre_id)
);

-- Create audio reviews table
CREATE TABLE audio_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  track_id UUID NOT NULL REFERENCES audio_tracks(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (track_id, reviewer_id)
);

-- Create audio licenses table
CREATE TABLE audio_licenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  track_id UUID NOT NULL REFERENCES audio_tracks(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES profiles(id),
  seller_id UUID NOT NULL REFERENCES profiles(id),
  type audio_license_type NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  currency TEXT NOT NULL,
  rights TEXT[] NOT NULL,
  restrictions TEXT[] NOT NULL,
  territory TEXT[] NOT NULL,
  duration TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create audio orders table
CREATE TABLE audio_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  track_id UUID NOT NULL REFERENCES audio_tracks(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES profiles(id),
  seller_id UUID NOT NULL REFERENCES profiles(id),
  license_id UUID REFERENCES audio_licenses(id),
  status audio_order_status NOT NULL DEFAULT 'pending',
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('crypto', 'fiat')),
  transaction_hash TEXT,
  escrow_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create audio disputes table
CREATE TABLE audio_disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES audio_orders(id) ON DELETE CASCADE,
  initiator_id UUID NOT NULL REFERENCES profiles(id),
  respondent_id UUID NOT NULL REFERENCES profiles(id),
  reason TEXT NOT NULL,
  evidence TEXT[] NOT NULL,
  status audio_dispute_status NOT NULL DEFAULT 'open',
  resolution audio_dispute_resolution,
  resolution_amount DECIMAL(12,2),
  resolution_notes TEXT,
  mediator_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_audio_tracks_artist ON audio_tracks(artist_id);
CREATE INDEX idx_audio_tracks_token_gated ON audio_tracks(token_gated) WHERE token_gated = true;
CREATE INDEX idx_audio_tracks_nft ON audio_tracks(nft) WHERE nft = true;
CREATE INDEX idx_audio_tracks_price ON audio_tracks(price);
CREATE INDEX idx_audio_tracks_created ON audio_tracks(created_at);
CREATE INDEX idx_audio_tracks_plays ON audio_tracks(plays);
CREATE INDEX idx_audio_tracks_downloads ON audio_tracks(downloads);
CREATE INDEX idx_audio_tracks_rating ON audio_tracks(rating);

CREATE INDEX idx_audio_genres_slug ON audio_genres(slug);
CREATE INDEX idx_audio_genres_parent ON audio_genres(parent_id);

CREATE INDEX idx_audio_reviews_track ON audio_reviews(track_id);
CREATE INDEX idx_audio_reviews_reviewer ON audio_reviews(reviewer_id);
CREATE INDEX idx_audio_reviews_rating ON audio_reviews(rating);

CREATE INDEX idx_audio_licenses_track ON audio_licenses(track_id);
CREATE INDEX idx_audio_licenses_buyer ON audio_licenses(buyer_id);
CREATE INDEX idx_audio_licenses_seller ON audio_licenses(seller_id);

CREATE INDEX idx_audio_orders_track ON audio_orders(track_id);
CREATE INDEX idx_audio_orders_buyer ON audio_orders(buyer_id);
CREATE INDEX idx_audio_orders_seller ON audio_orders(seller_id);
CREATE INDEX idx_audio_orders_status ON audio_orders(status);
CREATE INDEX idx_audio_orders_created ON audio_orders(created_at);

CREATE INDEX idx_audio_disputes_order ON audio_disputes(order_id);
CREATE INDEX idx_audio_disputes_initiator ON audio_disputes(initiator_id);
CREATE INDEX idx_audio_disputes_respondent ON audio_disputes(respondent_id);
CREATE INDEX idx_audio_disputes_status ON audio_disputes(status);

-- Create functions
CREATE OR REPLACE FUNCTION update_audio_track_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE audio_tracks
  SET rating = (
    SELECT AVG(rating)::DECIMAL(3,2)
    FROM audio_reviews
    WHERE track_id = NEW.track_id
  ),
  review_count = (
    SELECT COUNT(*)
    FROM audio_reviews
    WHERE track_id = NEW.track_id
  )
  WHERE id = NEW.track_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_audio_track_rating_trigger
  AFTER INSERT OR UPDATE OR DELETE ON audio_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_audio_track_rating();

CREATE TRIGGER update_audio_tracks_updated_at
  BEFORE UPDATE ON audio_tracks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_audio_orders_updated_at
  BEFORE UPDATE ON audio_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_audio_disputes_updated_at
  BEFORE UPDATE ON audio_disputes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column(); 