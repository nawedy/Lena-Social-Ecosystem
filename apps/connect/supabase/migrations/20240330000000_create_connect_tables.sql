-- Create professional networking tables
CREATE TABLE professional_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  headline TEXT,
  bio TEXT,
  current_position TEXT,
  company TEXT,
  industry TEXT,
  location TEXT,
  website TEXT,
  resume_url TEXT,
  availability_status TEXT CHECK (availability_status IN ('open', 'closed', 'considering')),
  verified BOOLEAN DEFAULT false,
  verification_data JSONB DEFAULT '{}',
  skills TEXT[] DEFAULT '{}',
  languages TEXT[] DEFAULT '{}',
  certifications JSONB[] DEFAULT '{}',
  education JSONB[] DEFAULT '{}',
  experience JSONB[] DEFAULT '{}',
  achievements JSONB[] DEFAULT '{}',
  privacy_settings JSONB DEFAULT '{
    "profile_visibility": "public",
    "connection_visibility": "connections",
    "endorsement_visibility": "public",
    "activity_visibility": "connections"
  }',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE professional_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')) NOT NULL,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(requester_id, recipient_id)
);

CREATE TABLE skill_endorsements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES professional_profiles(id) ON DELETE CASCADE NOT NULL,
  endorser_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  skill TEXT NOT NULL,
  level INTEGER CHECK (level BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(profile_id, endorser_id, skill)
);

CREATE TABLE job_listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poster_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT,
  type TEXT CHECK (type IN ('full-time', 'part-time', 'contract', 'freelance', 'internship')),
  remote_policy TEXT CHECK (remote_policy IN ('remote', 'hybrid', 'on-site')),
  salary_range JSONB,
  required_skills TEXT[],
  required_experience TEXT,
  benefits JSONB,
  application_url TEXT,
  token_requirements JSONB DEFAULT NULL,
  status TEXT CHECK (status IN ('draft', 'active', 'paused', 'closed')) NOT NULL,
  applicant_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE job_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES job_listings(id) ON DELETE CASCADE NOT NULL,
  applicant_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  cover_letter TEXT,
  resume_url TEXT,
  portfolio_url TEXT,
  answers JSONB DEFAULT '{}',
  status TEXT CHECK (status IN ('submitted', 'reviewed', 'shortlisted', 'rejected', 'withdrawn')) NOT NULL,
  feedback TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(job_id, applicant_id)
);

CREATE TABLE recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES professional_profiles(id) ON DELETE CASCADE NOT NULL,
  recommender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  relationship TEXT NOT NULL,
  content TEXT NOT NULL,
  position TEXT,
  company TEXT,
  status TEXT CHECK (status IN ('pending', 'published', 'rejected')) NOT NULL,
  privacy TEXT CHECK (privacy IN ('public', 'connections', 'private')) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE professional_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES professional_profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  achievement_date DATE,
  achievement_url TEXT,
  achievement_type TEXT CHECK (achievement_type IN ('award', 'certification', 'publication', 'patent', 'other')),
  issuer TEXT,
  verification_status TEXT CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
  verification_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_professional_profiles_user ON professional_profiles(user_id);
CREATE INDEX idx_professional_profiles_skills ON professional_profiles USING gin(skills);
CREATE INDEX idx_professional_profiles_industry ON professional_profiles(industry);
CREATE INDEX idx_professional_profiles_location ON professional_profiles(location);
CREATE INDEX idx_professional_profiles_verified ON professional_profiles(verified);

CREATE INDEX idx_professional_connections_requester ON professional_connections(requester_id);
CREATE INDEX idx_professional_connections_recipient ON professional_connections(recipient_id);
CREATE INDEX idx_professional_connections_status ON professional_connections(status);

CREATE INDEX idx_skill_endorsements_profile ON skill_endorsements(profile_id);
CREATE INDEX idx_skill_endorsements_endorser ON skill_endorsements(endorser_id);
CREATE INDEX idx_skill_endorsements_skill ON skill_endorsements(skill);

CREATE INDEX idx_job_listings_poster ON job_listings(poster_id);
CREATE INDEX idx_job_listings_status ON job_listings(status);
CREATE INDEX idx_job_listings_type ON job_listings(type);
CREATE INDEX idx_job_listings_location ON job_listings(location);
CREATE INDEX idx_job_listings_skills ON job_listings USING gin(required_skills);
CREATE INDEX idx_job_listings_created ON job_listings(created_at);

CREATE INDEX idx_job_applications_job ON job_applications(job_id);
CREATE INDEX idx_job_applications_applicant ON job_applications(applicant_id);
CREATE INDEX idx_job_applications_status ON job_applications(status);

CREATE INDEX idx_recommendations_profile ON recommendations(profile_id);
CREATE INDEX idx_recommendations_recommender ON recommendations(recommender_id);
CREATE INDEX idx_recommendations_status ON recommendations(status);

CREATE INDEX idx_achievements_profile ON professional_achievements(profile_id);
CREATE INDEX idx_achievements_type ON professional_achievements(achievement_type);
CREATE INDEX idx_achievements_verification ON professional_achievements(verification_status);

-- Create functions
CREATE OR REPLACE FUNCTION update_connection_status(
  p_connection_id UUID,
  p_new_status TEXT
)
RETURNS void AS $$
BEGIN
  UPDATE professional_connections
  SET 
    status = p_new_status,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = p_connection_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check connection status
CREATE OR REPLACE FUNCTION check_connection_status(
  p_user_id_1 UUID,
  p_user_id_2 UUID
)
RETURNS TABLE (
  connected BOOLEAN,
  status TEXT,
  connection_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE WHEN c.status = 'accepted' THEN true ELSE false END as connected,
    c.status,
    c.id
  FROM professional_connections c
  WHERE (c.requester_id = p_user_id_1 AND c.recipient_id = p_user_id_2)
     OR (c.requester_id = p_user_id_2 AND c.recipient_id = p_user_id_1)
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update job listing counts
CREATE OR REPLACE FUNCTION update_job_listing_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE job_listings
    SET applicant_count = applicant_count + 1
    WHERE id = NEW.job_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE job_listings
    SET applicant_count = applicant_count - 1
    WHERE id = OLD.job_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_job_listing_counts_trigger
  AFTER INSERT OR DELETE ON job_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_job_listing_counts();

-- Enable Row Level Security
ALTER TABLE professional_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_endorsements ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_achievements ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view public profiles"
  ON professional_profiles FOR SELECT
  TO authenticated
  USING (
    (privacy_settings->>'profile_visibility')::TEXT = 'public'
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM professional_connections
      WHERE status = 'accepted'
      AND ((requester_id = auth.uid() AND recipient_id = user_id)
        OR (recipient_id = auth.uid() AND requester_id = user_id))
    )
  );

CREATE POLICY "Users can manage their own profiles"
  ON professional_profiles FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can manage their connections"
  ON professional_connections FOR ALL
  TO authenticated
  USING (requester_id = auth.uid() OR recipient_id = auth.uid())
  WITH CHECK (requester_id = auth.uid() OR recipient_id = auth.uid());

CREATE POLICY "Users can view endorsements"
  ON skill_endorsements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create endorsements"
  ON skill_endorsements FOR INSERT
  TO authenticated
  WITH CHECK (endorser_id = auth.uid());

CREATE POLICY "Anyone can view active job listings"
  ON job_listings FOR SELECT
  TO authenticated
  USING (status = 'active' OR poster_id = auth.uid());

CREATE POLICY "Users can manage their job listings"
  ON job_listings FOR ALL
  TO authenticated
  USING (poster_id = auth.uid())
  WITH CHECK (poster_id = auth.uid());

CREATE POLICY "Users can manage their job applications"
  ON job_applications FOR ALL
  TO authenticated
  USING (applicant_id = auth.uid())
  WITH CHECK (applicant_id = auth.uid());

CREATE POLICY "Job posters can view applications"
  ON job_applications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM job_listings
      WHERE id = job_id AND poster_id = auth.uid()
    )
  );

CREATE POLICY "Users can view public recommendations"
  ON recommendations FOR SELECT
  TO authenticated
  USING (
    status = 'published'
    AND (
      privacy = 'public'
      OR recommender_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM professional_connections
        WHERE status = 'accepted'
        AND ((requester_id = auth.uid() AND recipient_id = recommender_id)
          OR (recipient_id = auth.uid() AND requester_id = recommender_id))
      )
    )
  );

CREATE POLICY "Users can manage their recommendations"
  ON recommendations FOR ALL
  TO authenticated
  USING (recommender_id = auth.uid())
  WITH CHECK (recommender_id = auth.uid());

CREATE POLICY "Users can view verified achievements"
  ON professional_achievements FOR SELECT
  TO authenticated
  USING (verification_status = 'verified' OR profile_id IN (
    SELECT id FROM professional_profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can manage their achievements"
  ON professional_achievements FOR ALL
  TO authenticated
  USING (profile_id IN (
    SELECT id FROM professional_profiles WHERE user_id = auth.uid()
  ))
  WITH CHECK (profile_id IN (
    SELECT id FROM professional_profiles WHERE user_id = auth.uid()
  )); 