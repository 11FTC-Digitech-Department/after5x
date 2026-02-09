-- Migration: Add storage bucket for chat images
-- Purpose: Store images shared in booking chats

-- Create storage bucket for chat images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-images',
  'chat-images',
  false,  -- Private bucket - access controlled by policies
  5242880,  -- 5MB file size limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policy: Authenticated users can upload to their own folder
-- Path structure: {user_id}/{booking_id}/{filename}
CREATE POLICY "Users upload own chat images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Booking participants can view chat images
-- Images are viewable if the user is a participant in any booking
-- where this image was shared via booking_chats
CREATE POLICY "Booking participants view chat images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-images' AND
  (
    -- User owns the image (uploaded it)
    auth.uid()::text = (storage.foldername(name))[1]
    OR
    -- User is a participant in a booking where this image was shared
    EXISTS (
      SELECT 1 FROM booking_chats bc
      JOIN bookings b ON b.id = bc.booking_id
      WHERE bc.message_type = 'IMAGE'
        AND bc.content LIKE '%' || storage.filename(name) || '%'
        AND (b.customer_id = auth.uid() OR b.provider_id = auth.uid())
    )
  )
);

-- Policy: Users can delete their own uploaded images
CREATE POLICY "Users delete own chat images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
