-- Soft deletion for notifications: is_deleted, deleted_at
-- RLS updated to hide soft-deleted rows; clean_old_notifications hard-deletes only soft-deleted after 90 days

-- Add columns
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Partial index for active notifications (list queries)
CREATE INDEX IF NOT EXISTS idx_notifications_user_active
  ON public.notifications (user_id, created_at DESC)
  WHERE is_deleted = FALSE;

-- Drop existing SELECT policy and recreate with soft-delete filter
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id AND is_deleted = FALSE);

-- Update get_user_notifications to exclude soft-deleted
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
SET search_path = public
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
      AND n.is_deleted = FALSE
    ORDER BY n.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- Update clean_old_notifications: only hard-delete soft-deleted rows older than 90 days
CREATE OR REPLACE FUNCTION public.clean_old_notifications()
RETURNS void AS $$
BEGIN
    DELETE FROM public.notifications
    WHERE is_deleted = TRUE
      AND deleted_at IS NOT NULL
      AND deleted_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;
