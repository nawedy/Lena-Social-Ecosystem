-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Create custom types
CREATE TYPE video_status AS ENUM ('processing', 'published', 'private', 'archived');
CREATE TYPE interaction_type AS ENUM ('like', 'share', 'comment', 'view', 'follow');
CREATE TYPE report_reason AS ENUM ('inappropriate', 'copyright', 'spam', 'harassment', 'other');
CREATE TYPE report_status AS ENUM ('pending', 'reviewed', 'resolved');
CREATE TYPE verification_status AS ENUM ('unverified', 'pending', 'verified', 'rejected');

-- Create videos table
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(100) NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration INTEGER NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  status video_status DEFAULT 'processing',
  visibility BOOLEAN DEFAULT true,
  allow_comments BOOLEAN DEFAULT true,
  allow_duets BOOLEAN DEFAULT true,
  music_title VARCHAR(255),
  music_artist VARCHAR(255),
  original_sound BOOLEAN DEFAULT true,
  location TEXT,
  tags TEXT[],
  mentions TEXT[],
  categories TEXT[],
  views INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  token_gated BOOLEAN DEFAULT false,
  token_contract TEXT,
  token_id TEXT,
  token_standard TEXT,
  nft BOOLEAN DEFAULT false,
  ipfs_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create video_interactions table
CREATE TABLE video_interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type interaction_type NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(video_id, user_id, type)
);

-- Create comments table
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  likes_count INTEGER DEFAULT 0,
  replies_count INTEGER DEFAULT 0,
  pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create hashtags table
CREATE TABLE hashtags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  video_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  trending_score FLOAT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create video_hashtags table
CREATE TABLE video_hashtags (
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  hashtag_id UUID REFERENCES hashtags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (video_id, hashtag_id)
);

-- Create user_profiles table
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username VARCHAR(30) UNIQUE NOT NULL,
  display_name VARCHAR(50),
  bio TEXT,
  avatar_url TEXT,
  website TEXT,
  location TEXT,
  verification_status verification_status DEFAULT 'unverified',
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  videos_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  wallet_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create follows table
CREATE TABLE follows (
  follower_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id)
);

-- Create reports table
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  reason report_reason NOT NULL,
  description TEXT,
  status report_status DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create video_analytics table
CREATE TABLE video_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  views_count INTEGER DEFAULT 0,
  unique_viewers INTEGER DEFAULT 0,
  average_watch_time FLOAT DEFAULT 0,
  completion_rate FLOAT DEFAULT 0,
  engagement_rate FLOAT DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  saves_count INTEGER DEFAULT 0,
  demographics JSONB DEFAULT '{}',
  traffic_sources JSONB DEFAULT '{}',
  viewer_retention JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_videos_user ON videos(user_id);
CREATE INDEX idx_videos_created ON videos(created_at);
CREATE INDEX idx_videos_status ON videos(status);
CREATE INDEX idx_videos_visibility ON videos(visibility);
CREATE INDEX idx_videos_token_gated ON videos(token_gated) WHERE token_gated = true;
CREATE INDEX idx_videos_nft ON videos(nft) WHERE nft = true;
CREATE INDEX idx_videos_tags ON videos USING gin(tags);
CREATE INDEX idx_videos_categories ON videos USING gin(categories);

CREATE INDEX idx_interactions_video ON video_interactions(video_id);
CREATE INDEX idx_interactions_user ON video_interactions(user_id);
CREATE INDEX idx_interactions_type ON video_interactions(type);
CREATE INDEX idx_interactions_created ON video_interactions(created_at);

CREATE INDEX idx_comments_video ON comments(video_id);
CREATE INDEX idx_comments_user ON comments(user_id);
CREATE INDEX idx_comments_parent ON comments(parent_id);
CREATE INDEX idx_comments_created ON comments(created_at);

CREATE INDEX idx_hashtags_name ON hashtags(name);
CREATE INDEX idx_hashtags_trending ON hashtags(trending_score DESC);

CREATE INDEX idx_profiles_username ON user_profiles(username);
CREATE INDEX idx_profiles_wallet ON user_profiles(wallet_address);
CREATE INDEX idx_profiles_verification ON user_profiles(verification_status);

CREATE INDEX idx_follows_follower ON follows(follower_id);
CREATE INDEX idx_follows_following ON follows(following_id);

CREATE INDEX idx_reports_video ON reports(video_id);
CREATE INDEX idx_reports_reporter ON reports(reporter_id);
CREATE INDEX idx_reports_status ON reports(status);

CREATE INDEX idx_analytics_video ON video_analytics(video_id);

-- Create functions and triggers
CREATE OR REPLACE FUNCTION update_video_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE videos
    SET 
      likes_count = CASE 
        WHEN NEW.type = 'like' THEN likes_count + 1
        ELSE likes_count
      END,
      comments_count = CASE 
        WHEN NEW.type = 'comment' THEN comments_count + 1
        ELSE comments_count
      END,
      shares_count = CASE 
        WHEN NEW.type = 'share' THEN shares_count + 1
        ELSE shares_count
      END,
      views = CASE 
        WHEN NEW.type = 'view' THEN views + 1
        ELSE views
      END
    WHERE id = NEW.video_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE videos
    SET 
      likes_count = CASE 
        WHEN OLD.type = 'like' THEN likes_count - 1
        ELSE likes_count
      END,
      comments_count = CASE 
        WHEN OLD.type = 'comment' THEN comments_count - 1
        ELSE comments_count
      END,
      shares_count = CASE 
        WHEN OLD.type = 'share' THEN shares_count - 1
        ELSE shares_count
      END
    WHERE id = OLD.video_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_video_counts_trigger
AFTER INSERT OR DELETE ON video_interactions
FOR EACH ROW
EXECUTE FUNCTION update_video_counts();

-- Update user profile counts
CREATE OR REPLACE FUNCTION update_profile_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.type = 'follow' THEN
      UPDATE user_profiles
      SET followers_count = followers_count + 1
      WHERE id = NEW.video_id;
      
      UPDATE user_profiles
      SET following_count = following_count + 1
      WHERE id = NEW.user_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.type = 'follow' THEN
      UPDATE user_profiles
      SET followers_count = followers_count - 1
      WHERE id = OLD.video_id;
      
      UPDATE user_profiles
      SET following_count = following_count - 1
      WHERE id = OLD.user_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profile_counts_trigger
AFTER INSERT OR DELETE ON video_interactions
FOR EACH ROW
EXECUTE FUNCTION update_profile_counts();

-- Update hashtag counts
CREATE OR REPLACE FUNCTION update_hashtag_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE hashtags
    SET video_count = video_count + 1
    WHERE id = NEW.hashtag_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE hashtags
    SET video_count = video_count - 1
    WHERE id = OLD.hashtag_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_hashtag_counts_trigger
AFTER INSERT OR DELETE ON video_hashtags
FOR EACH ROW
EXECUTE FUNCTION update_hashtag_counts();

-- Update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_videos_updated_at
BEFORE UPDATE ON videos
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at
BEFORE UPDATE ON comments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_analytics_updated_at
BEFORE UPDATE ON video_analytics
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column(); 