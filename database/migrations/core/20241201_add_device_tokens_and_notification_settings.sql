-- Add device_tokens table for push notifications
CREATE TABLE IF NOT EXISTS device_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    gig_worker_id UUID NOT NULL REFERENCES gig_partners(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('web', 'android', 'ios')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(gig_worker_id, platform)
);

-- Add notification preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    gig_worker_id UUID NOT NULL REFERENCES gig_partners(id) ON DELETE CASCADE,
    case_allocated BOOLEAN DEFAULT true,
    case_timeout BOOLEAN DEFAULT true,
    qc_rework BOOLEAN DEFAULT true,
    general_notifications BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(gig_worker_id)
);

-- Add app settings table for VAPID keys
CREATE TABLE IF NOT EXISTS app_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default notification preferences for existing gig workers
INSERT INTO notification_preferences (gig_worker_id, case_allocated, case_timeout, qc_rework, general_notifications)
SELECT 
    id as gig_worker_id,
    true as case_allocated,
    true as case_timeout,
    true as qc_rework,
    true as general_notifications
FROM gig_partners
WHERE id NOT IN (SELECT gig_worker_id FROM notification_preferences);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_device_tokens_gig_worker_id ON device_tokens(gig_worker_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_active ON device_tokens(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_notification_preferences_gig_worker_id ON notification_preferences(gig_worker_id);

-- Add RLS policies
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Device tokens policies
CREATE POLICY "Gig workers can manage their own device tokens" ON device_tokens
    FOR ALL USING (
        gig_worker_id IN (
            SELECT id FROM gig_partners 
            WHERE user_id = auth.uid()
        )
    );

-- Notification preferences policies
CREATE POLICY "Gig workers can manage their own notification preferences" ON notification_preferences
    FOR ALL USING (
        gig_worker_id IN (
            SELECT id FROM gig_partners 
            WHERE user_id = auth.uid()
        )
    );

-- App settings policies (admin only)
CREATE POLICY "Only admins can manage app settings" ON app_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid() 
            AND role IN ('super_admin', 'ops_team')
        )
    );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_device_tokens_updated_at 
    BEFORE UPDATE ON device_tokens 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at 
    BEFORE UPDATE ON notification_preferences 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_app_settings_updated_at 
    BEFORE UPDATE ON app_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
