-- Enable PostGIS for location-based queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create hashtags table
CREATE TABLE hashtags (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    tag TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create post_hashtags table for many-to-many relationship
CREATE TABLE post_hashtags (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
    hashtag_id UUID REFERENCES hashtags(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(post_id, hashtag_id)
);

-- Add location column to posts table
ALTER TABLE posts
ADD COLUMN location GEOGRAPHY(POINT);

-- Create indexes
CREATE INDEX hashtags_tag_idx ON hashtags(tag);
CREATE INDEX post_hashtags_post_id_idx ON post_hashtags(post_id);
CREATE INDEX post_hashtags_hashtag_id_idx ON post_hashtags(hashtag_id);
CREATE INDEX posts_location_idx ON posts USING GIST(location);

-- Create function to extract and save hashtags from post content
CREATE OR REPLACE FUNCTION process_post_hashtags()
RETURNS TRIGGER AS $$
DECLARE
    hashtag TEXT;
    hashtag_id UUID;
BEGIN
    -- Delete existing hashtags for this post if updating
    IF TG_OP = 'UPDATE' THEN
        DELETE FROM post_hashtags WHERE post_id = NEW.id;
    END IF;

    -- Extract hashtags using regex
    FOR hashtag IN
        SELECT DISTINCT substring(word from 2)
        FROM regexp_matches(NEW.content, '#([A-Za-z0-9_]+)', 'g') AS word
    LOOP
        -- Insert hashtag if it doesn't exist
        INSERT INTO hashtags (tag)
        VALUES (hashtag)
        ON CONFLICT (tag) DO NOTHING
        RETURNING id INTO hashtag_id;

        -- If hashtag_id is null, get it from the existing hashtag
        IF hashtag_id IS NULL THEN
            SELECT id INTO hashtag_id FROM hashtags WHERE tag = hashtag;
        END IF;

        -- Create post_hashtag relationship
        INSERT INTO post_hashtags (post_id, hashtag_id)
        VALUES (NEW.id, hashtag_id);
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to process hashtags on post insert/update
CREATE TRIGGER process_post_hashtags_trigger
    AFTER INSERT OR UPDATE OF content ON posts
    FOR EACH ROW
    EXECUTE FUNCTION process_post_hashtags();

-- Create function to search hashtags
CREATE OR REPLACE FUNCTION search_hashtags(search_query TEXT)
RETURNS TABLE (
    tag TEXT,
    count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT h.tag, COUNT(ph.id)::BIGINT
    FROM hashtags h
    LEFT JOIN post_hashtags ph ON h.id = ph.hashtag_id
    WHERE h.tag ILIKE '%' || search_query || '%'
    GROUP BY h.tag
    ORDER BY COUNT(ph.id) DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function to get trending hashtags
CREATE OR REPLACE FUNCTION get_trending_hashtags()
RETURNS TABLE (
    tag TEXT,
    count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT h.tag, COUNT(ph.id)::BIGINT
    FROM hashtags h
    JOIN post_hashtags ph ON h.id = ph.hashtag_id
    JOIN posts p ON ph.post_id = p.id
    WHERE p.created_at > NOW() - INTERVAL '7 days'
    GROUP BY h.tag
    ORDER BY COUNT(ph.id) DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function to search posts by location
CREATE OR REPLACE FUNCTION search_posts_by_location(
    lat DOUBLE PRECISION,
    long DOUBLE PRECISION,
    radius_km DOUBLE PRECISION
)
RETURNS TABLE (
    id UUID,
    author_id UUID,
    content TEXT,
    media_url TEXT,
    media_type TEXT,
    location GEOGRAPHY,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    distance DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.*,
        ST_Distance(p.location, ST_MakePoint(long, lat)::geography) / 1000 as distance
    FROM posts p
    WHERE ST_DWithin(
        p.location,
        ST_MakePoint(long, lat)::geography,
        radius_km * 1000  -- Convert km to meters
    )
    ORDER BY distance;
END;
$$ LANGUAGE plpgsql;

-- Set up RLS policies
ALTER TABLE hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_hashtags ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Hashtags are viewable by everyone"
    ON hashtags FOR SELECT
    USING (true);

CREATE POLICY "Post hashtags are viewable by everyone"
    ON post_hashtags FOR SELECT
    USING (true);

CREATE POLICY "Users can create hashtags"
    ON hashtags FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Post owners can create post hashtags"
    ON post_hashtags FOR INSERT
    USING (EXISTS (
        SELECT 1 FROM posts
        WHERE id = post_hashtags.post_id
        AND author_id = auth.uid()
    )); 