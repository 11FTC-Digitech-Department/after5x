-- Storage bucket for promotion/story images (attached to offers.story_image_url)
-- Public bucket: images load without auth; admins upload via Studio or admin UI

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'promotions',
  'promotions',
  true,
  5242880,  -- 5MB
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Public read: anyone can view promotion images
CREATE POLICY "Public read promotions"
ON storage.objects FOR SELECT
USING (bucket_id = 'promotions');

-- Admins can upload/update/delete promotion images
CREATE POLICY "Admins manage promotions"
ON storage.objects FOR ALL
USING (bucket_id = 'promotions' AND public.is_admin())
WITH CHECK (bucket_id = 'promotions' AND public.is_admin());
