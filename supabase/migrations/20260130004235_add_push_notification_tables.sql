-- Push Notification Tables Migration
-- Adds device_tokens and notification_preferences tables for FCM push notifications

-- ============================================================================
-- Table: device_tokens
-- Stores FCM device tokens for push notification delivery
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.device_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    token TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
    app_type TEXT NOT NULL CHECK (app_type IN ('customer', 'experts')),
    device_id TEXT, -- Optional device identifier for managing multiple devices
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure unique token per user per app type
    UNIQUE(user_id, token, app_type)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON public.device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_token ON public.device_tokens(token);
CREATE INDEX IF NOT EXISTS idx_device_tokens_active ON public.device_tokens(is_active) WHERE is_active = TRUE;

-- Enable RLS
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies for device_tokens
CREATE POLICY "Users can view their own device tokens"
ON public.device_tokens FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own device tokens"
ON public.device_tokens FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own device tokens"
ON public.device_tokens FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own device tokens"
ON public.device_tokens FOR DELETE
USING (auth.uid() = user_id);

-- ============================================================================
-- Table: notification_preferences
-- Stores user notification preferences aligned with existing UI settings pages
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,

    -- Master toggle
    push_enabled BOOLEAN DEFAULT TRUE,

    -- ========================================
    -- Customer preferences (customer app)
    -- Matches: customer/notification-settings.page.ts
    -- ========================================

    -- Booking Updates section
    booking_confirmed BOOLEAN DEFAULT TRUE,    -- When booking is confirmed by provider
    booking_started BOOLEAN DEFAULT TRUE,      -- When provider starts working (IN_PROGRESS)
    booking_completed BOOLEAN DEFAULT TRUE,    -- When service is completed
    booking_cancelled BOOLEAN DEFAULT TRUE,    -- When booking is cancelled

    -- Provider Updates section
    provider_on_way BOOLEAN DEFAULT TRUE,      -- When provider is heading to location
    provider_arrived BOOLEAN DEFAULT TRUE,     -- When provider arrives

    -- ========================================
    -- Provider/Expert preferences (experts app)
    -- Matches: provider/notification-settings.page.ts
    -- ========================================

    -- Job Notifications section
    new_job BOOLEAN DEFAULT TRUE,              -- New job requests matching services
    job_confirmed BOOLEAN DEFAULT TRUE,        -- When customer confirms
    job_cancelled BOOLEAN DEFAULT TRUE,        -- When customer cancels
    job_reminder BOOLEAN DEFAULT TRUE,         -- Reminders before scheduled jobs

    -- Payment Notifications section
    payment_received BOOLEAN DEFAULT TRUE,     -- When payment is confirmed
    payout_processed BOOLEAN DEFAULT TRUE,     -- When earnings are transferred

    -- Account Updates section
    verification_status BOOLEAN DEFAULT TRUE,  -- Document verification updates
    reviews BOOLEAN DEFAULT TRUE,              -- When customers leave reviews

    -- ========================================
    -- Common preferences (both apps)
    -- ========================================

    -- Promotions & Updates section
    promotions BOOLEAN DEFAULT FALSE,          -- Special offers (default: false)
    news_updates BOOLEAN DEFAULT TRUE,         -- New features and updates

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user lookup
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON public.notification_preferences(user_id);

-- Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notification_preferences
CREATE POLICY "Users can view their own notification preferences"
ON public.notification_preferences FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification preferences"
ON public.notification_preferences FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification preferences"
ON public.notification_preferences FOR UPDATE
USING (auth.uid() = user_id);

-- ============================================================================
-- Function: get_or_create_notification_preferences
-- Returns existing preferences or creates default ones for a user
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_or_create_notification_preferences(p_user_id UUID)
RETURNS notification_preferences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    prefs notification_preferences;
BEGIN
    -- Try to get existing preferences
    SELECT * INTO prefs FROM notification_preferences WHERE user_id = p_user_id;

    -- If not found, create with defaults
    IF NOT FOUND THEN
        INSERT INTO notification_preferences (user_id)
        VALUES (p_user_id)
        RETURNING * INTO prefs;
    END IF;

    RETURN prefs;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_or_create_notification_preferences(UUID) TO authenticated;

-- ============================================================================
-- Extend notification_logs table for push notification tracking
-- ============================================================================
ALTER TABLE public.notification_logs
ADD COLUMN IF NOT EXISTS fcm_message_id TEXT,
ADD COLUMN IF NOT EXISTS fcm_response JSONB,
ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'pending'
    CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'failed', 'filtered'));

-- ============================================================================
-- Trigger: Auto-update updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to device_tokens
DROP TRIGGER IF EXISTS update_device_tokens_updated_at ON public.device_tokens;
CREATE TRIGGER update_device_tokens_updated_at
    BEFORE UPDATE ON public.device_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to notification_preferences
DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON public.notification_preferences;
CREATE TRIGGER update_notification_preferences_updated_at
    BEFORE UPDATE ON public.notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
