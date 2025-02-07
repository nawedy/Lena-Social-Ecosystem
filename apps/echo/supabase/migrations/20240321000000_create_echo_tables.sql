-- Create Echo platform tables
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  media_urls TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  sentiment_score FLOAT DEFAULT 0,
  trending_score FLOAT DEFAULT 0,
  is_verified BOOLEAN DEFAULT false,
  is_breaking_news BOOLEAN DEFAULT false,
  likes INTEGER DEFAULT 0,
  reposts INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE trending_topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tag TEXT NOT NULL UNIQUE,
  count INTEGER DEFAULT 0,
  sentiment FLOAT DEFAULT 0,
  velocity FLOAT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE news_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT,
  urgency TEXT NOT NULL CHECK (urgency IN ('low', 'medium', 'high')),
  source_url TEXT,
  verified_by UUID REFERENCES auth.users(id),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE post_interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('like', 'repost', 'reply')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(post_id, user_id, interaction_type)
);

CREATE TABLE user_follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id UUID NOT NULL REFERENCES auth.users(id),
  following_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(follower_id, following_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_created_at ON posts(created_at);
CREATE INDEX idx_posts_trending_score ON posts(trending_score);
CREATE INDEX idx_trending_topics_count ON trending_topics(count);
CREATE INDEX idx_news_alerts_active ON news_alerts(active);
CREATE INDEX idx_post_interactions_post_id ON post_interactions(post_id);
CREATE INDEX idx_post_interactions_user_id ON post_interactions(user_id);
CREATE INDEX idx_user_follows_follower_id ON user_follows(follower_id);
CREATE INDEX idx_user_follows_following_id ON user_follows(following_id);

-- Create function to update trending topics
CREATE OR REPLACE FUNCTION update_trending_topics()
RETURNS TRIGGER AS $$
BEGIN
  -- Update or insert trending topics
  INSERT INTO trending_topics (tag, count, sentiment)
  SELECT
    UNNEST(NEW.tags) as tag,
    1 as count,
    NEW.sentiment_score as sentiment
  ON CONFLICT (tag)
  DO UPDATE SET
    count = trending_topics.count + 1,
    sentiment = (trending_topics.sentiment * trending_topics.count + NEW.sentiment_score) / (trending_topics.count + 1),
    updated_at = CURRENT_TIMESTAMP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to update post metrics
CREATE OR REPLACE FUNCTION update_post_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Update post counts based on interaction type
  IF NEW.interaction_type = 'like' THEN
    UPDATE posts SET likes = likes + 1 WHERE id = NEW.post_id;
  ELSIF NEW.interaction_type = 'repost' THEN
    UPDATE posts SET reposts = reposts + 1 WHERE id = NEW.post_id;
  ELSIF NEW.interaction_type = 'reply' THEN
    UPDATE posts SET replies = replies + 1 WHERE id = NEW.post_id;
  END IF;

  -- Update trending score
  UPDATE posts
  SET trending_score = (
    (EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) - EXTRACT(EPOCH FROM created_at)) / 3600.0 +
    likes * 1.5 +
    reposts * 2.0 +
    replies * 1.0
  )
  WHERE id = NEW.post_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_trending_topics_trigger
AFTER INSERT ON posts
FOR EACH ROW
EXECUTE FUNCTION update_trending_topics();

CREATE TRIGGER update_post_metrics_trigger
AFTER INSERT ON post_interactions
FOR EACH ROW
EXECUTE FUNCTION update_post_metrics();

-- Create RLS policies
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE trending_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;

-- Create policies for posts
CREATE POLICY "Allow public read access to posts"
  ON posts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow users to create posts"
  ON posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to update their own posts"
  ON posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to delete their own posts"
  ON posts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for trending topics
CREATE POLICY "Allow public read access to trending topics"
  ON trending_topics FOR SELECT
  TO authenticated
  USING (true);

-- Create policies for news alerts
CREATE POLICY "Allow public read access to news alerts"
  ON news_alerts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow verified users to create news alerts"
  ON news_alerts FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND is_verified = true
  ));

-- Create policies for post interactions
CREATE POLICY "Allow public read access to post interactions"
  ON post_interactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow users to create interactions"
  ON post_interactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create policies for user follows
CREATE POLICY "Allow public read access to user follows"
  ON user_follows FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow users to manage their follows"
  ON user_follows FOR ALL
  TO authenticated
  USING (auth.uid() = follower_id)
  WITH CHECK (auth.uid() = follower_id); 