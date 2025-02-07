-- Create argument analysis tables
CREATE TABLE argument_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  argument_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  composite_scores JSONB NOT NULL DEFAULT '{
    "trustworthiness": 0,
    "relevance": 0,
    "impact": 0,
    "consensus": 0
  }',
  ai_analysis JSONB NOT NULL DEFAULT '{
    "logicalCoherence": 0,
    "evidenceStrength": 0,
    "biasDetection": 0,
    "fallacyDetection": [],
    "counterarguments": []
  }'
);

CREATE TABLE source_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  author TEXT,
  publication_date TIMESTAMP WITH TIME ZONE,
  domain TEXT,
  trust_score FLOAT DEFAULT 0,
  bias_score FLOAT DEFAULT 0,
  factuality_score FLOAT DEFAULT 0,
  academic_references INTEGER DEFAULT 0,
  peer_reviewed BOOLEAN DEFAULT FALSE,
  citations INTEGER DEFAULT 0,
  source_diversity FLOAT DEFAULT 0,
  temporal_relevance FLOAT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE expert_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  argument_id UUID NOT NULL,
  expert_id UUID NOT NULL,
  expert_name TEXT NOT NULL,
  credentials TEXT[] NOT NULL,
  institution TEXT NOT NULL,
  review TEXT NOT NULL,
  rating FLOAT NOT NULL CHECK (rating >= 0 AND rating <= 5),
  confidence FLOAT NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  verification_status TEXT NOT NULL CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE community_moderation (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  argument_id UUID NOT NULL,
  user_id UUID NOT NULL,
  moderation_action TEXT NOT NULL CHECK (moderation_action IN ('flag', 'approve', 'reject')),
  reason TEXT NOT NULL,
  evidence TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),
  supporting_votes INTEGER DEFAULT 0,
  opposing_votes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE moderation_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  moderation_id UUID NOT NULL REFERENCES community_moderation(id),
  user_id UUID NOT NULL,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('support', 'oppose')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(moderation_id, user_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_argument_analysis_argument_id ON argument_analysis(argument_id);
CREATE INDEX idx_source_analysis_source_id ON source_analysis(source_id);
CREATE INDEX idx_expert_reviews_argument_id ON expert_reviews(argument_id);
CREATE INDEX idx_expert_reviews_expert_id ON expert_reviews(expert_id);
CREATE INDEX idx_community_moderation_argument_id ON community_moderation(argument_id);
CREATE INDEX idx_community_moderation_user_id ON community_moderation(user_id);
CREATE INDEX idx_moderation_votes_moderation_id ON moderation_votes(moderation_id);
CREATE INDEX idx_moderation_votes_user_id ON moderation_votes(user_id);

-- Create function to handle moderation votes
CREATE OR REPLACE FUNCTION vote_moderation_action(
  moderation_id UUID,
  user_id UUID,
  vote_type TEXT
) RETURNS void AS $$
DECLARE
  existing_vote TEXT;
BEGIN
  -- Check for existing vote
  SELECT v.vote_type INTO existing_vote
  FROM moderation_votes v
  WHERE v.moderation_id = vote_moderation_action.moderation_id
    AND v.user_id = vote_moderation_action.user_id;
    
  -- Handle vote
  IF existing_vote IS NULL THEN
    -- Insert new vote
    INSERT INTO moderation_votes (moderation_id, user_id, vote_type)
    VALUES (vote_moderation_action.moderation_id, vote_moderation_action.user_id, vote_moderation_action.vote_type);
    
    -- Update vote counts
    IF vote_type = 'support' THEN
      UPDATE community_moderation
      SET supporting_votes = supporting_votes + 1
      WHERE id = vote_moderation_action.moderation_id;
    ELSE
      UPDATE community_moderation
      SET opposing_votes = opposing_votes + 1
      WHERE id = vote_moderation_action.moderation_id;
    END IF;
  ELSIF existing_vote != vote_type THEN
    -- Update existing vote
    UPDATE moderation_votes
    SET vote_type = vote_moderation_action.vote_type
    WHERE moderation_id = vote_moderation_action.moderation_id
      AND user_id = vote_moderation_action.user_id;
      
    -- Update vote counts
    IF vote_type = 'support' THEN
      UPDATE community_moderation
      SET supporting_votes = supporting_votes + 1,
          opposing_votes = opposing_votes - 1
      WHERE id = vote_moderation_action.moderation_id;
    ELSE
      UPDATE community_moderation
      SET supporting_votes = supporting_votes - 1,
          opposing_votes = opposing_votes + 1
      WHERE id = vote_moderation_action.moderation_id;
    END IF;
  END IF;
  
  -- Update moderation status based on votes
  UPDATE community_moderation
  SET status = CASE
    WHEN supporting_votes > opposing_votes * 2 THEN 'accepted'
    WHEN opposing_votes > supporting_votes * 2 THEN 'rejected'
    ELSE 'pending'
  END
  WHERE id = vote_moderation_action.moderation_id;
END;
$$ LANGUAGE plpgsql;

-- Create RLS policies
ALTER TABLE argument_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE expert_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_moderation ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_votes ENABLE ROW LEVEL SECURITY;

-- Create policies for argument analysis
CREATE POLICY "Allow public read access to argument analysis"
  ON argument_analysis FOR SELECT
  TO authenticated
  USING (true);

-- Create policies for source analysis
CREATE POLICY "Allow public read access to source analysis"
  ON source_analysis FOR SELECT
  TO authenticated
  USING (true);

-- Create policies for expert reviews
CREATE POLICY "Allow public read access to verified expert reviews"
  ON expert_reviews FOR SELECT
  TO authenticated
  USING (verification_status = 'verified');

CREATE POLICY "Allow experts to create reviews"
  ON expert_reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IN (
    SELECT user_id FROM expert_credentials WHERE verified = true
  ));

-- Create policies for community moderation
CREATE POLICY "Allow public read access to community moderation"
  ON community_moderation FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to create moderation actions"
  ON community_moderation FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create policies for moderation votes
CREATE POLICY "Allow public read access to moderation votes"
  ON moderation_votes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to vote"
  ON moderation_votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to update their own votes"
  ON moderation_votes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id); 