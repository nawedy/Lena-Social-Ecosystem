-- Create debate metrics tables
CREATE TABLE debate_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  debate_id UUID NOT NULL REFERENCES debates(id),
  total_arguments INTEGER DEFAULT 0,
  total_participants INTEGER DEFAULT 0,
  average_strength FLOAT DEFAULT 0,
  average_fact_checker_score FLOAT DEFAULT 0,
  average_expert_consensus FLOAT DEFAULT 0,
  engagement_metrics JSONB DEFAULT '{
    "views": 0,
    "shares": 0,
    "reactions": 0,
    "comments": 0
  }',
  sentiment_analysis JSONB DEFAULT '{
    "positive": 0,
    "neutral": 0,
    "negative": 0
  }',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE debate_timeline_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  debate_id UUID NOT NULL REFERENCES debates(id),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  argument_count INTEGER DEFAULT 0,
  participant_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE debate_contributor_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  debate_id UUID NOT NULL REFERENCES debates(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  contributions INTEGER DEFAULT 0,
  avg_strength FLOAT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(debate_id, user_id)
);

CREATE TABLE debate_argument_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  debate_id UUID NOT NULL REFERENCES debates(id),
  type TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(debate_id, type)
);

-- Create indexes for better query performance
CREATE INDEX idx_debate_metrics_debate_id ON debate_metrics(debate_id);
CREATE INDEX idx_debate_timeline_metrics_debate_id ON debate_timeline_metrics(debate_id);
CREATE INDEX idx_debate_timeline_metrics_timestamp ON debate_timeline_metrics(timestamp);
CREATE INDEX idx_debate_contributor_metrics_debate_id ON debate_contributor_metrics(debate_id);
CREATE INDEX idx_debate_contributor_metrics_user_id ON debate_contributor_metrics(user_id);
CREATE INDEX idx_debate_argument_types_debate_id ON debate_argument_types(debate_id);

-- Create function to update metrics when arguments change
CREATE OR REPLACE FUNCTION update_debate_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Update main metrics
  WITH metrics AS (
    SELECT
      COUNT(*) as total_arguments,
      COUNT(DISTINCT user_id) as total_participants,
      AVG(strength) as average_strength,
      AVG(fact_checker_score) as average_fact_checker_score,
      AVG(expert_consensus) as average_expert_consensus
    FROM argument_nodes
    WHERE debate_id = NEW.debate_id
  )
  UPDATE debate_metrics
  SET
    total_arguments = metrics.total_arguments,
    total_participants = metrics.total_participants,
    average_strength = metrics.average_strength,
    average_fact_checker_score = metrics.average_fact_checker_score,
    average_expert_consensus = metrics.average_expert_consensus,
    updated_at = CURRENT_TIMESTAMP
  FROM metrics
  WHERE debate_id = NEW.debate_id;

  -- Update timeline metrics
  INSERT INTO debate_timeline_metrics (
    debate_id,
    timestamp,
    argument_count,
    participant_count
  )
  SELECT
    NEW.debate_id,
    date_trunc('hour', CURRENT_TIMESTAMP),
    COUNT(*),
    COUNT(DISTINCT user_id)
  FROM argument_nodes
  WHERE debate_id = NEW.debate_id
  GROUP BY date_trunc('hour', CURRENT_TIMESTAMP);

  -- Update contributor metrics
  INSERT INTO debate_contributor_metrics (
    debate_id,
    user_id,
    contributions,
    avg_strength
  )
  SELECT
    debate_id,
    user_id,
    COUNT(*) as contributions,
    AVG(strength) as avg_strength
  FROM argument_nodes
  WHERE debate_id = NEW.debate_id
  GROUP BY debate_id, user_id
  ON CONFLICT (debate_id, user_id)
  DO UPDATE SET
    contributions = EXCLUDED.contributions,
    avg_strength = EXCLUDED.avg_strength,
    updated_at = CURRENT_TIMESTAMP;

  -- Update argument type counts
  INSERT INTO debate_argument_types (
    debate_id,
    type,
    count
  )
  SELECT
    debate_id,
    type,
    COUNT(*) as count
  FROM argument_nodes
  WHERE debate_id = NEW.debate_id
  GROUP BY debate_id, type
  ON CONFLICT (debate_id, type)
  DO UPDATE SET
    count = EXCLUDED.count,
    updated_at = CURRENT_TIMESTAMP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for metrics updates
CREATE TRIGGER update_debate_metrics_trigger
AFTER INSERT OR UPDATE OR DELETE ON argument_nodes
FOR EACH ROW
EXECUTE FUNCTION update_debate_metrics();

-- Create RLS policies
ALTER TABLE debate_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE debate_timeline_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE debate_contributor_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE debate_argument_types ENABLE ROW LEVEL SECURITY;

-- Create policies for debate metrics
CREATE POLICY "Allow public read access to debate metrics"
  ON debate_metrics FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow public read access to timeline metrics"
  ON debate_timeline_metrics FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow public read access to contributor metrics"
  ON debate_contributor_metrics FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow public read access to argument type metrics"
  ON debate_argument_types FOR SELECT
  TO authenticated
  USING (true); 