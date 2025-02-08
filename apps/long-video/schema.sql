-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enum types
CREATE TYPE video_status AS ENUM ('draft', 'processing', 'published', 'private', 'unlisted');
CREATE TYPE video_quality AS ENUM ('240p', '360p', '480p', '720p', '1080p', '1440p', '2160p');
CREATE TYPE monetization_type AS ENUM ('free', 'premium', 'pay_per_view', 'subscription');
CREATE TYPE revenue_source AS ENUM ('ads', 'subscriptions', 'donations', 'pay_per_view');

-- Channels table
CREATE TABLE channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    handle VARCHAR(30) UNIQUE NOT NULL,
    description TEXT,
    avatar_url TEXT,
    banner_url TEXT,
    theme_color VARCHAR(7),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    verified BOOLEAN DEFAULT false,
    subscriber_count BIGINT DEFAULT 0,
    total_views BIGINT DEFAULT 0,
    customization_json JSONB,
    CONSTRAINT valid_handle CHECK (handle ~* '^[a-zA-Z0-9_]{3,30}$')
);

-- Videos table
CREATE TABLE videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    status video_status DEFAULT 'processing',
    duration INTEGER, -- in seconds
    thumbnail_url TEXT,
    preview_gif_url TEXT,
    ipfs_hash TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    view_count BIGINT DEFAULT 0,
    like_count BIGINT DEFAULT 0,
    dislike_count BIGINT DEFAULT 0,
    monetization_type monetization_type DEFAULT 'free',
    price DECIMAL(10,2), -- for pay_per_view content
    tags TEXT[],
    metadata JSONB, -- for flexible metadata storage
    chapters JSONB[], -- array of chapter objects with timestamps
    transcription_url TEXT,
    is_premiere BOOLEAN DEFAULT false,
    premiere_scheduled_at TIMESTAMPTZ
);

-- Video Versions table (for different quality versions)
CREATE TABLE video_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    quality video_quality NOT NULL,
    ipfs_hash TEXT NOT NULL,
    file_size BIGINT, -- in bytes
    bitrate INTEGER, -- in kbps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(video_id, quality)
);

-- Playlists table
CREATE TABLE playlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    privacy_status video_status DEFAULT 'private',
    video_count INTEGER DEFAULT 0
);

-- Playlist Items table
CREATE TABLE playlist_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(playlist_id, position)
);

-- Series table (for episodic content)
CREATE TABLE series (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    season_count INTEGER DEFAULT 1,
    episode_count INTEGER DEFAULT 0,
    status video_status DEFAULT 'private'
);

-- Series Episodes table
CREATE TABLE series_episodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    season_number INTEGER NOT NULL,
    episode_number INTEGER NOT NULL,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(series_id, season_number, episode_number)
);

-- Comments table
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    like_count INTEGER DEFAULT 0,
    dislike_count INTEGER DEFAULT 0,
    is_pinned BOOLEAN DEFAULT false,
    timestamp INTEGER -- optional timestamp reference in video
);

-- Analytics table
CREATE TABLE video_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    views INTEGER DEFAULT 0,
    unique_viewers INTEGER DEFAULT 0,
    watch_time BIGINT DEFAULT 0, -- in seconds
    average_view_duration DECIMAL(10,2),
    likes INTEGER DEFAULT 0,
    dislikes INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    subscriber_gained INTEGER DEFAULT 0,
    subscriber_lost INTEGER DEFAULT 0,
    demographics JSONB,
    traffic_sources JSONB,
    device_types JSONB,
    retention_graph JSONB,
    UNIQUE(video_id, date)
);

-- Revenue table
CREATE TABLE revenue_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    source revenue_source NOT NULL,
    transaction_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
);

-- Captions table
CREATE TABLE captions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    language VARCHAR(5) NOT NULL, -- ISO language code
    caption_url TEXT NOT NULL,
    is_auto_generated BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(video_id, language)
);

-- Indexes for performance
CREATE INDEX idx_videos_channel_id ON videos(channel_id);
CREATE INDEX idx_videos_status ON videos(status);
CREATE INDEX idx_videos_published_at ON videos(published_at);
CREATE INDEX idx_comments_video_id ON comments(video_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_playlist_items_video_id ON playlist_items(video_id);
CREATE INDEX idx_video_analytics_date ON video_analytics(date);
CREATE INDEX idx_revenue_events_channel_id ON revenue_events(channel_id);

-- Functions and Triggers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_channels_updated_at
    BEFORE UPDATE ON channels
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_videos_updated_at
    BEFORE UPDATE ON videos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_playlists_updated_at
    BEFORE UPDATE ON playlists
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_series_updated_at
    BEFORE UPDATE ON series
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- RLS Policies
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_events ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (to be expanded based on specific requirements)
CREATE POLICY "Public channels are viewable by everyone"
    ON channels FOR SELECT
    USING (true);

CREATE POLICY "Public videos are viewable by everyone"
    ON videos FOR SELECT
    USING (status = 'published');

CREATE POLICY "Users can view their own private content"
    ON videos FOR SELECT
    USING (channel_id IN (
        SELECT id FROM channels WHERE user_id = auth.uid()
    ));

-- Computed Columns
ALTER TABLE videos ADD COLUMN engagement_rate 
    DECIMAL GENERATED ALWAYS AS (
        CASE 
            WHEN view_count = 0 THEN 0
            ELSE ((like_count - dislike_count)::DECIMAL / view_count * 100)
        END
    ) STORED; 