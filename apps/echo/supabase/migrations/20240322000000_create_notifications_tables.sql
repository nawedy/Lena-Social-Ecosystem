-- Create notifications tables
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  type TEXT NOT NULL CHECK (type IN ('like', 'repost', 'reply', 'mention', 'follow', 'tag')),
  content TEXT NOT NULL,
  reference_id UUID NOT NULL,
  reference_type TEXT NOT NULL CHECK (reference_type IN ('post', 'comment', 'profile')),
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create notification settings table for user preferences
CREATE TABLE notification_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
  email_notifications BOOLEAN DEFAULT true,
  push_notifications BOOLEAN DEFAULT true,
  browser_notifications BOOLEAN DEFAULT true,
  notification_types JSONB DEFAULT '{
    "like": true,
    "repost": true,
    "reply": true,
    "mention": true,
    "follow": true,
    "tag": true
  }',
  quiet_hours JSONB DEFAULT '{
    "enabled": false,
    "start": "22:00",
    "end": "08:00",
    "timezone": "UTC"
  }',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create notification devices table for push notifications
CREATE TABLE notification_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  device_token TEXT NOT NULL,
  device_type TEXT NOT NULL CHECK (device_type IN ('ios', 'android', 'web')),
  device_name TEXT,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, device_token)
);

-- Create indexes for better query performance
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_actor_id ON notifications(actor_id);
CREATE INDEX idx_notifications_reference_id ON notifications(reference_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notification_devices_user_id ON notification_devices(user_id);
CREATE INDEX idx_notification_devices_token ON notification_devices(device_token);

-- Create function to update notification timestamps
CREATE OR REPLACE FUNCTION update_notification_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to check quiet hours
CREATE OR REPLACE FUNCTION is_quiet_hours(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  settings RECORD;
  user_time TIME;
BEGIN
  -- Get user's notification settings
  SELECT * INTO settings
  FROM notification_settings
  WHERE notification_settings.user_id = user_id;

  -- If quiet hours not enabled, return false
  IF NOT (settings.quiet_hours->>'enabled')::BOOLEAN THEN
    RETURN false;
  END IF;

  -- Get current time in user's timezone
  SELECT CURRENT_TIME AT TIME ZONE settings.quiet_hours->>'timezone' INTO user_time;

  -- Check if current time is within quiet hours
  RETURN user_time >= (settings.quiet_hours->>'start')::TIME
    AND user_time <= (settings.quiet_hours->>'end')::TIME;
END;
$$ LANGUAGE plpgsql;

-- Create function to handle notification creation
CREATE OR REPLACE FUNCTION create_notification()
RETURNS TRIGGER AS $$
DECLARE
  notification_enabled BOOLEAN;
  is_quiet BOOLEAN;
BEGIN
  -- Check if user has enabled this type of notification
  SELECT (notification_types->>NEW.type)::BOOLEAN INTO notification_enabled
  FROM notification_settings
  WHERE user_id = NEW.user_id;

  -- Check quiet hours
  SELECT is_quiet_hours(NEW.user_id) INTO is_quiet;

  -- Only create notification if enabled and not in quiet hours
  IF notification_enabled AND NOT is_quiet THEN
    -- Create notification record
    INSERT INTO notifications (
      user_id,
      actor_id,
      type,
      content,
      reference_id,
      reference_type
    ) VALUES (
      NEW.user_id,
      NEW.actor_id,
      NEW.type,
      NEW.content,
      NEW.reference_id,
      NEW.reference_type
    );

    -- Send push notification if enabled
    PERFORM send_push_notification(
      NEW.user_id,
      NEW.content,
      NEW.type
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to send push notifications
CREATE OR REPLACE FUNCTION send_push_notification(
  user_id UUID,
  content TEXT,
  notification_type TEXT
)
RETURNS void AS $$
BEGIN
  -- This is a placeholder for actual push notification logic
  -- In a real implementation, you would integrate with a push notification service
  -- like Firebase Cloud Messaging or Apple Push Notification Service
  NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_notifications_timestamp
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_timestamp();

CREATE TRIGGER update_notification_settings_timestamp
  BEFORE UPDATE ON notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_timestamp();

-- Create RLS policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_devices ENABLE ROW LEVEL SECURITY;

-- Create policies for notifications
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create policies for notification settings
CREATE POLICY "Users can view their own notification settings"
  ON notification_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification settings"
  ON notification_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification settings"
  ON notification_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create policies for notification devices
CREATE POLICY "Users can view their own notification devices"
  ON notification_devices FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own notification devices"
  ON notification_devices FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id); 