-- Create moderation tables
CREATE TABLE moderation_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id UUID NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('post', 'comment', 'user')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'flagged')),
  assigned_to UUID REFERENCES auth.users(id),
  moderation_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE content_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id UUID NOT NULL,
  reporter_id UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ai_content_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id UUID NOT NULL,
  toxicity_score FLOAT NOT NULL DEFAULT 0,
  spam_probability FLOAT NOT NULL DEFAULT 0,
  adult_content_score FLOAT NOT NULL DEFAULT 0,
  violence_score FLOAT NOT NULL DEFAULT 0,
  hate_speech_score FLOAT NOT NULL DEFAULT 0,
  detected_languages TEXT[] DEFAULT '{}',
  detected_entities TEXT[] DEFAULT '{}',
  content_categories TEXT[] DEFAULT '{}',
  recommendation TEXT NOT NULL CHECK (recommendation IN ('approve', 'reject', 'review')),
  confidence FLOAT NOT NULL DEFAULT 0,
  raw_analysis JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE moderation_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id UUID NOT NULL,
  moderator_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL CHECK (action IN ('approve', 'reject', 'flag')),
  reason TEXT,
  previous_status TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE moderation_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auto_moderation_enabled BOOLEAN DEFAULT true,
  toxicity_threshold FLOAT DEFAULT 0.8,
  spam_threshold FLOAT DEFAULT 0.8,
  adult_content_threshold FLOAT DEFAULT 0.8,
  violence_threshold FLOAT DEFAULT 0.8,
  hate_speech_threshold FLOAT DEFAULT 0.8,
  min_confidence_threshold FLOAT DEFAULT 0.9,
  auto_reject_thresholds JSONB DEFAULT '{
    "toxicity": 0.9,
    "spam": 0.9,
    "adult_content": 0.9,
    "violence": 0.9,
    "hate_speech": 0.9
  }',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_moderation_queue_content ON moderation_queue(content_id);
CREATE INDEX idx_moderation_queue_status ON moderation_queue(status);
CREATE INDEX idx_moderation_queue_assigned ON moderation_queue(assigned_to);
CREATE INDEX idx_content_reports_content ON content_reports(content_id);
CREATE INDEX idx_content_reports_reporter ON content_reports(reporter_id);
CREATE INDEX idx_content_reports_status ON content_reports(status);
CREATE INDEX idx_ai_analysis_content ON ai_content_analysis(content_id);
CREATE INDEX idx_ai_analysis_recommendation ON ai_content_analysis(recommendation);
CREATE INDEX idx_moderation_actions_content ON moderation_actions(content_id);
CREATE INDEX idx_moderation_actions_moderator ON moderation_actions(moderator_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_moderation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to analyze content
CREATE OR REPLACE FUNCTION analyze_content(
  content_id UUID,
  content_text TEXT,
  content_type TEXT
)
RETURNS void AS $$
DECLARE
  analysis_result JSONB;
  settings RECORD;
BEGIN
  -- Get moderation settings
  SELECT * INTO settings FROM moderation_settings LIMIT 1;

  -- This is a placeholder for actual AI analysis
  -- In production, this would call an external AI service
  analysis_result = json_build_object(
    'toxicity_score', random(),
    'spam_probability', random(),
    'adult_content_score', random(),
    'violence_score', random(),
    'hate_speech_score', random(),
    'detected_languages', ARRAY['en'],
    'detected_entities', ARRAY['entity1', 'entity2'],
    'content_categories', ARRAY['category1', 'category2'],
    'recommendation',
    CASE
      WHEN random() > 0.8 THEN 'reject'
      WHEN random() > 0.6 THEN 'review'
      ELSE 'approve'
    END,
    'confidence', random()
  );

  -- Insert analysis results
  INSERT INTO ai_content_analysis (
    content_id,
    toxicity_score,
    spam_probability,
    adult_content_score,
    violence_score,
    hate_speech_score,
    detected_languages,
    detected_entities,
    content_categories,
    recommendation,
    confidence,
    raw_analysis
  ) VALUES (
    content_id,
    (analysis_result->>'toxicity_score')::FLOAT,
    (analysis_result->>'spam_probability')::FLOAT,
    (analysis_result->>'adult_content_score')::FLOAT,
    (analysis_result->>'violence_score')::FLOAT,
    (analysis_result->>'hate_speech_score')::FLOAT,
    (analysis_result->>'detected_languages')::TEXT[],
    (analysis_result->>'detected_entities')::TEXT[],
    (analysis_result->>'content_categories')::TEXT[],
    analysis_result->>'recommendation',
    (analysis_result->>'confidence')::FLOAT,
    analysis_result
  );

  -- Auto-moderate if enabled and confidence is high enough
  IF settings.auto_moderation_enabled AND (analysis_result->>'confidence')::FLOAT >= settings.min_confidence_threshold THEN
    IF (analysis_result->>'toxicity_score')::FLOAT >= (settings.auto_reject_thresholds->>'toxicity')::FLOAT OR
       (analysis_result->>'spam_probability')::FLOAT >= (settings.auto_reject_thresholds->>'spam')::FLOAT OR
       (analysis_result->>'adult_content_score')::FLOAT >= (settings.auto_reject_thresholds->>'adult_content')::FLOAT OR
       (analysis_result->>'violence_score')::FLOAT >= (settings.auto_reject_thresholds->>'violence')::FLOAT OR
       (analysis_result->>'hate_speech_score')::FLOAT >= (settings.auto_reject_thresholds->>'hate_speech')::FLOAT THEN
      
      -- Auto-reject the content
      UPDATE moderation_queue
      SET status = 'rejected',
          moderation_notes = 'Auto-rejected by AI moderation system'
      WHERE moderation_queue.content_id = analyze_content.content_id;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create function to handle content reports
CREATE OR REPLACE FUNCTION handle_content_report()
RETURNS TRIGGER AS $$
BEGIN
  -- Add content to moderation queue if not already present
  INSERT INTO moderation_queue (content_id, content_type)
  VALUES (NEW.content_id, TG_ARGV[0])
  ON CONFLICT (content_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_moderation_queue_timestamp
  BEFORE UPDATE ON moderation_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_moderation_timestamp();

CREATE TRIGGER update_content_reports_timestamp
  BEFORE UPDATE ON content_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_moderation_timestamp();

CREATE TRIGGER update_ai_analysis_timestamp
  BEFORE UPDATE ON ai_content_analysis
  FOR EACH ROW
  EXECUTE FUNCTION update_moderation_timestamp();

-- Create RLS policies
ALTER TABLE moderation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_content_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for moderation queue
CREATE POLICY "Allow moderators to view queue"
  ON moderation_queue FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('moderator', 'admin')
    )
  );

CREATE POLICY "Allow moderators to update queue"
  ON moderation_queue FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('moderator', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('moderator', 'admin')
    )
  );

-- Create policies for content reports
CREATE POLICY "Allow authenticated users to create reports"
  ON content_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Allow users to view their own reports"
  ON content_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

CREATE POLICY "Allow moderators to view all reports"
  ON content_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('moderator', 'admin')
    )
  );

-- Create policies for AI analysis
CREATE POLICY "Allow moderators to view AI analysis"
  ON ai_content_analysis FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('moderator', 'admin')
    )
  );

-- Create policies for moderation actions
CREATE POLICY "Allow moderators to create actions"
  ON moderation_actions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('moderator', 'admin')
    )
  );

CREATE POLICY "Allow moderators to view actions"
  ON moderation_actions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('moderator', 'admin')
    )
  );

-- Create policies for moderation settings
CREATE POLICY "Allow admins to manage settings"
  ON moderation_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Insert default moderation settings
INSERT INTO moderation_settings DEFAULT VALUES; 