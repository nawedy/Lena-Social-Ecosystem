-- Beta Invitations Table
CREATE TABLE beta_invitations (
    id SERIAL PRIMARY KEY,
    inviter_did TEXT NOT NULL REFERENCES beta_users(did),
    invitee_email TEXT NOT NULL,
    invitation_code TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
    accepted_by_did TEXT REFERENCES beta_users(did),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days')
);

-- Create indexes for beta_invitations
CREATE INDEX idx_invitations_inviter ON beta_invitations(inviter_did);
CREATE INDEX idx_invitations_code ON beta_invitations(invitation_code);
CREATE INDEX idx_invitations_status ON beta_invitations(status);
CREATE INDEX idx_invitations_email ON beta_invitations(invitee_email);

-- Add invitation tracking to beta_users
ALTER TABLE beta_users
ADD COLUMN invitations_sent INTEGER DEFAULT 0,
ADD COLUMN invitations_accepted INTEGER DEFAULT 0,
ADD COLUMN max_invitations INTEGER DEFAULT 5;

-- Create function to update invitation counts
CREATE OR REPLACE FUNCTION update_invitation_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE beta_users
        SET invitations_sent = invitations_sent + 1
        WHERE did = NEW.inviter_did;
    ELSIF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status = 'pending' THEN
        UPDATE beta_users
        SET invitations_accepted = invitations_accepted + 1
        WHERE did = NEW.inviter_did;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for invitation tracking
CREATE TRIGGER track_invitation_sent
    AFTER INSERT ON beta_invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_invitation_counts();

CREATE TRIGGER track_invitation_accepted
    AFTER UPDATE ON beta_invitations
    FOR EACH ROW
    WHEN (NEW.status = 'accepted' AND OLD.status = 'pending')
    EXECUTE FUNCTION update_invitation_counts();

-- Create function to expire invitations
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS void AS $$
BEGIN
    UPDATE beta_invitations
    SET status = 'expired'
    WHERE status = 'pending'
    AND expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to expire invitations (runs daily)
SELECT cron.schedule('expire_invitations', '0 0 * * *', 'SELECT expire_old_invitations();');
