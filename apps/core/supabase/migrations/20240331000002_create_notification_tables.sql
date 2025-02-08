-- Create notification-related tables
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  priority TEXT NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  channel TEXT NOT NULL CHECK (channel IN ('inApp', 'email', 'webPush', 'all')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'delivered', 'read')),
  error TEXT
);

CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  channels JSONB NOT NULL DEFAULT '{
    "inApp": true,
    "email": true,
    "webPush": true
  }',
  types JSONB NOT NULL DEFAULT '{}',
  quiet_hours JSONB NOT NULL DEFAULT '{
    "enabled": false,
    "start": "22:00",
    "end": "08:00",
    "timezone": "UTC"
  }',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, subscription->>'endpoint')
);

CREATE TABLE notification_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,
  title_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  data_template JSONB DEFAULT '{}',
  priority TEXT NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  channel TEXT NOT NULL CHECK (channel IN ('inApp', 'email', 'webPush', 'all')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(type)
);

-- Create indexes
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created ON notifications(created_at);
CREATE INDEX idx_notifications_read ON notifications(read) WHERE NOT read;
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_priority ON notifications(priority);

CREATE INDEX idx_notification_preferences_user ON notification_preferences(user_id);
CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);
CREATE INDEX idx_notification_templates_type ON notification_templates(type);

-- Create functions
CREATE OR REPLACE FUNCTION update_notification_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION process_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_preferences JSONB;
  v_type_config JSONB;
  v_should_send BOOLEAN;
BEGIN
  -- Get user preferences
  SELECT types->NEW.type
  INTO v_type_config
  FROM notification_preferences
  WHERE user_id = NEW.user_id;

  -- Check if notification type is enabled
  IF v_type_config IS NULL OR NOT (v_type_config->>'enabled')::BOOLEAN THEN
    RETURN NULL;
  END IF;

  -- Check quiet hours if applicable
  IF EXISTS (
    SELECT 1
    FROM notification_preferences
    WHERE user_id = NEW.user_id
    AND (quiet_hours->>'enabled')::BOOLEAN = true
    AND is_quiet_hours(
      (quiet_hours->>'start')::TEXT,
      (quiet_hours->>'end')::TEXT,
      (quiet_hours->>'timezone')::TEXT
    )
  ) THEN
    -- Store notification but don't send if in quiet hours
    NEW.status = 'pending';
    RETURN NEW;
  END IF;

  -- Set status to sent
  NEW.status = 'sent';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION is_quiet_hours(
  start_time TEXT,
  end_time TEXT,
  timezone TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  current_time TIMESTAMP WITH TIME ZONE;
  quiet_start TIMESTAMP WITH TIME ZONE;
  quiet_end TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get current time in user's timezone
  current_time := CURRENT_TIMESTAMP AT TIME ZONE timezone;
  
  -- Parse quiet hours
  quiet_start := (current_date || ' ' || start_time)::TIMESTAMP AT TIME ZONE timezone;
  quiet_end := (current_date || ' ' || end_time)::TIMESTAMP AT TIME ZONE timezone;
  
  -- Adjust if end time is before start time (spans midnight)
  IF quiet_end < quiet_start THEN
    quiet_end := quiet_end + INTERVAL '1 day';
  END IF;
  
  -- Check if current time is within quiet hours
  RETURN current_time >= quiet_start AND current_time <= quiet_end;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_notification_preferences_timestamp
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_timestamp();

CREATE TRIGGER update_push_subscriptions_timestamp
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_timestamp();

CREATE TRIGGER update_notification_templates_timestamp
  BEFORE UPDATE ON notification_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_timestamp();

CREATE TRIGGER process_notification_trigger
  BEFORE INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION process_notification();

-- Enable Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can manage their notification preferences"
  ON notification_preferences FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can manage their push subscriptions"
  ON push_subscriptions FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Only admins can manage notification templates"
  ON notification_templates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  ); 