-- Create storage-related tables
CREATE TABLE storage_metadata (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cid TEXT NOT NULL,
  name TEXT NOT NULL,
  size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  encryption JSONB DEFAULT '{
    "enabled": false
  }',
  ipfs JSONB NOT NULL,
  metadata JSONB DEFAULT '{}',
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(cid)
);

CREATE TABLE storage_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  storage_id UUID REFERENCES storage_metadata(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  cid TEXT NOT NULL,
  size BIGINT NOT NULL,
  encryption JSONB DEFAULT '{
    "enabled": false
  }',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(storage_id, chunk_index)
);

CREATE TABLE storage_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  storage_id UUID REFERENCES storage_metadata(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  access_type TEXT NOT NULL CHECK (access_type IN ('read', 'write', 'admin')),
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(storage_id, user_id)
);

CREATE TABLE storage_sharing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  storage_id UUID REFERENCES storage_metadata(id) ON DELETE CASCADE,
  shared_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  access_type TEXT NOT NULL CHECK (access_type IN ('read', 'write')),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(storage_id, shared_with)
);

-- Create indexes
CREATE INDEX idx_storage_metadata_user ON storage_metadata(user_id);
CREATE INDEX idx_storage_metadata_cid ON storage_metadata(cid);
CREATE INDEX idx_storage_metadata_created ON storage_metadata(created_at);

CREATE INDEX idx_storage_chunks_storage ON storage_chunks(storage_id);
CREATE INDEX idx_storage_chunks_cid ON storage_chunks(cid);

CREATE INDEX idx_storage_access_storage ON storage_access(storage_id);
CREATE INDEX idx_storage_access_user ON storage_access(user_id);
CREATE INDEX idx_storage_access_expires ON storage_access(expires_at);

CREATE INDEX idx_storage_sharing_storage ON storage_sharing(storage_id);
CREATE INDEX idx_storage_sharing_shared_by ON storage_sharing(shared_by);
CREATE INDEX idx_storage_sharing_shared_with ON storage_sharing(shared_with);
CREATE INDEX idx_storage_sharing_expires ON storage_sharing(expires_at);

-- Create functions
CREATE OR REPLACE FUNCTION check_storage_access(
  p_storage_id UUID,
  p_user_id UUID,
  p_required_access TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_owner BOOLEAN;
  v_has_access BOOLEAN;
  v_is_shared BOOLEAN;
BEGIN
  -- Check if user is the owner
  SELECT EXISTS (
    SELECT 1
    FROM storage_metadata
    WHERE id = p_storage_id
    AND user_id = p_user_id
  ) INTO v_is_owner;

  IF v_is_owner THEN
    RETURN TRUE;
  END IF;

  -- Check direct access
  SELECT EXISTS (
    SELECT 1
    FROM storage_access
    WHERE storage_id = p_storage_id
    AND user_id = p_user_id
    AND access_type IN (p_required_access, 'admin')
    AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
  ) INTO v_has_access;

  IF v_has_access THEN
    RETURN TRUE;
  END IF;

  -- Check shared access
  SELECT EXISTS (
    SELECT 1
    FROM storage_sharing
    WHERE storage_id = p_storage_id
    AND shared_with = p_user_id
    AND access_type = p_required_access
    AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
  ) INTO v_is_shared;

  RETURN v_is_shared;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to cleanup expired access
CREATE OR REPLACE FUNCTION cleanup_expired_storage_access()
RETURNS void AS $$
BEGIN
  -- Delete expired direct access
  DELETE FROM storage_access
  WHERE expires_at < CURRENT_TIMESTAMP;

  -- Delete expired sharing
  DELETE FROM storage_sharing
  WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create scheduled task for cleanup
SELECT cron.schedule(
  'cleanup-storage-access',
  '0 * * * *', -- Run hourly
  $$
    SELECT cleanup_expired_storage_access();
  $$
);

-- Enable Row Level Security
ALTER TABLE storage_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_sharing ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own files"
  ON storage_metadata FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM storage_access
      WHERE storage_id = id
      AND user_id = auth.uid()
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    )
    OR EXISTS (
      SELECT 1
      FROM storage_sharing
      WHERE storage_id = id
      AND shared_with = auth.uid()
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    )
  );

CREATE POLICY "Users can manage their own files"
  ON storage_metadata FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can access chunks of accessible files"
  ON storage_chunks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM storage_metadata
      WHERE id = storage_id
      AND (
        user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM storage_access
          WHERE storage_id = storage_metadata.id
          AND user_id = auth.uid()
          AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
        )
        OR EXISTS (
          SELECT 1
          FROM storage_sharing
          WHERE storage_id = storage_metadata.id
          AND shared_with = auth.uid()
          AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
        )
      )
    )
  );

CREATE POLICY "Users can manage access to their files"
  ON storage_access FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM storage_metadata
      WHERE id = storage_id
      AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM storage_metadata
      WHERE id = storage_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage sharing of their files"
  ON storage_sharing FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM storage_metadata
      WHERE id = storage_id
      AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM storage_metadata
      WHERE id = storage_id
      AND user_id = auth.uid()
    )
  ); 