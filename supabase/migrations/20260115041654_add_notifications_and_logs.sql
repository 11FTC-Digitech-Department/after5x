-- Alter existing notifications table to add missing columns
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT FALSE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Update existing records to have message = body if message is null
UPDATE public.notifications SET message = body WHERE message IS NULL;
UPDATE public.notifications SET type = COALESCE(data->>'type', 'general') WHERE type IS NULL;
UPDATE public.notifications SET read = is_read WHERE read IS NULL;

-- Make message column NOT NULL after populating
ALTER TABLE public.notifications ALTER COLUMN message SET NOT NULL;
ALTER TABLE public.notifications ALTER COLUMN type SET NOT NULL;

-- Rename is_read to read for consistency (if it exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'is_read') THEN
        -- Column exists, we already updated read column above
        ALTER TABLE public.notifications DROP COLUMN IF EXISTS is_read;
    END IF;
END $$;

-- Create notification_logs table for tracking sent notifications
CREATE TABLE public.notification_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL,
    recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    channel TEXT NOT NULL, -- 'push', 'sms', 'email', 'in_app'
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'sent', -- 'sent', 'delivered', 'failed'
    error_message TEXT,
    metadata JSONB DEFAULT '{}'
);

-- Create indexes for better performance
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX idx_notification_logs_booking_id ON public.notification_logs(booking_id);
CREATE INDEX idx_notification_logs_recipient_id ON public.notification_logs(recipient_id);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

-- RLS Policies for notification_logs (admin only for viewing)
CREATE POLICY "Users can view logs for their bookings"
ON public.notification_logs FOR SELECT
USING (
    auth.uid() = recipient_id OR
    EXISTS (
        SELECT 1 FROM bookings
        WHERE bookings.id = notification_logs.booking_id
        AND (bookings.customer_id = auth.uid() OR bookings.provider_id = auth.uid())
    )
);

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(notification_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.notifications
    SET read = TRUE, read_at = NOW(), updated_at = NOW()
    WHERE id = notification_id AND user_id = auth.uid();

    RETURN FOUND;
END;
$$;

-- Function to get user notifications with pagination
CREATE OR REPLACE FUNCTION get_user_notifications(p_limit INTEGER DEFAULT 20, p_offset INTEGER DEFAULT 0)
RETURNS TABLE (
    id UUID,
    type TEXT,
    title TEXT,
    message TEXT,
    data JSONB,
    read BOOLEAN,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        n.id,
        n.type,
        n.title,
        n.message,
        n.data,
        n.read,
        n.read_at,
        n.created_at
    FROM public.notifications n
    WHERE n.user_id = auth.uid()
    ORDER BY n.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;