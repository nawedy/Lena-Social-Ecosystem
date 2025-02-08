-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Create custom types
CREATE TYPE debate_status AS ENUM ('draft', 'active', 'closed', 'archived');
CREATE TYPE argument_type AS ENUM ('claim', 'evidence', 'rebuttal', 'counter', 'clarification');
CREATE TYPE source_type AS ENUM ('academic', 'news', 'expert', 'data', 'other');
CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected');

-- Create tables
CREATE TABLE debates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  creator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status debate_status NOT NULL DEFAULT 'draft',
  tags TEXT[] DEFAULT '{}',
  category TEXT,
  visibility TEXT NOT NULL DEFAULT 'public',
  settings JSONB DEFAULT '{}',
  metrics JSONB DEFAULT '{}',
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE argument_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  debate_id UUID REFERENCES debates(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES argument_nodes(id),
  author_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type argument_type NOT NULL,
  content TEXT NOT NULL,
  sources JSONB[] DEFAULT '{}',
  metrics JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type source_type NOT NULL,
  url TEXT,
  title TEXT NOT NULL,
  authors TEXT[],
  publication_date DATE,
  publisher TEXT,
  description TEXT,
  metrics JSONB DEFAULT '{}',
  verification_status verification_status DEFAULT 'pending',
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE expert_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  credentials TEXT[] NOT NULL,
  institution TEXT,
  field_of_expertise TEXT[] NOT NULL,
  verification_status verification_status DEFAULT 'pending',
  verification_documents JSONB DEFAULT '{}',
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE expert_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expert_id UUID REFERENCES expert_profiles(id) ON DELETE CASCADE,
  argument_id UUID REFERENCES argument_nodes(id) ON DELETE CASCADE,
  review_content TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  metrics JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE debate_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  debate_id UUID REFERENCES debates(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  permissions TEXT[] DEFAULT '{}',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  metrics JSONB DEFAULT '{}',
  UNIQUE(debate_id, user_id)
);

CREATE TABLE debate_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  argument_id UUID REFERENCES argument_nodes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(argument_id, user_id)
);

CREATE TABLE debate_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  category TEXT,
  metrics JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_debates_creator ON debates(creator_id);
CREATE INDEX idx_debates_status ON debates(status);
CREATE INDEX idx_debates_category ON debates(category);
CREATE INDEX idx_debates_tags ON debates USING gin(tags);
CREATE INDEX idx_debates_created ON debates(created_at);

CREATE INDEX idx_argument_nodes_debate ON argument_nodes(debate_id);
CREATE INDEX idx_argument_nodes_parent ON argument_nodes(parent_id);
CREATE INDEX idx_argument_nodes_author ON argument_nodes(author_id);
CREATE INDEX idx_argument_nodes_type ON argument_nodes(type);
CREATE INDEX idx_argument_nodes_status ON argument_nodes(status);

CREATE INDEX idx_sources_type ON sources(type);
CREATE INDEX idx_sources_verification ON sources(verification_status);
CREATE INDEX idx_sources_verified_by ON sources(verified_by);

CREATE INDEX idx_expert_profiles_user ON expert_profiles(user_id);
CREATE INDEX idx_expert_profiles_verification ON expert_profiles(verification_status);
CREATE INDEX idx_expert_profiles_expertise ON expert_profiles USING gin(field_of_expertise);

CREATE INDEX idx_expert_reviews_expert ON expert_reviews(expert_id);
CREATE INDEX idx_expert_reviews_argument ON expert_reviews(argument_id);

CREATE INDEX idx_debate_participants_debate ON debate_participants(debate_id);
CREATE INDEX idx_debate_participants_user ON debate_participants(user_id);
CREATE INDEX idx_debate_participants_role ON debate_participants(role);

CREATE INDEX idx_debate_votes_argument ON debate_votes(argument_id);
CREATE INDEX idx_debate_votes_user ON debate_votes(user_id);

CREATE INDEX idx_debate_tags_name ON debate_tags(name);
CREATE INDEX idx_debate_tags_category ON debate_tags(category);

-- Create functions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
CREATE TRIGGER update_debates_updated_at
  BEFORE UPDATE ON debates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_argument_nodes_updated_at
  BEFORE UPDATE ON argument_nodes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sources_updated_at
  BEFORE UPDATE ON sources
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expert_profiles_updated_at
  BEFORE UPDATE ON expert_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expert_reviews_updated_at
  BEFORE UPDATE ON expert_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE debates ENABLE ROW LEVEL SECURITY;
ALTER TABLE argument_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE expert_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE expert_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE debate_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE debate_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE debate_tags ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Public debates are viewable by everyone"
  ON debates FOR SELECT
  USING (visibility = 'public');

CREATE POLICY "Users can create debates"
  ON debates FOR INSERT
  TO authenticated
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Creators can update their own debates"
  ON debates FOR UPDATE
  TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Participants can view debate arguments"
  ON argument_nodes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM debate_participants
      WHERE debate_participants.debate_id = argument_nodes.debate_id
      AND debate_participants.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM debates
      WHERE debates.id = argument_nodes.debate_id
      AND debates.visibility = 'public'
    )
  );

CREATE POLICY "Participants can create arguments"
  ON argument_nodes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM debate_participants
      WHERE debate_participants.debate_id = argument_nodes.debate_id
      AND debate_participants.user_id = auth.uid()
    )
  );

CREATE POLICY "Authors can update their own arguments"
  ON argument_nodes FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid()); 