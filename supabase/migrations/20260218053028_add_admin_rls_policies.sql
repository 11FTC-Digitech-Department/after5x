-- Allow admin to update any user's profile (role, activated, etc.)
CREATE POLICY "Admins update any profile"
ON public.profiles FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Allow admin to update any provider record (verification_status, status)
CREATE POLICY "Admins update any provider"
ON public.providers FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Allow admin to see all booking timelines
CREATE POLICY "Admins view all timelines"
ON public.booking_timeline FOR SELECT
USING (public.is_admin());

-- Allow admin to see all booking media
CREATE POLICY "Admins view all media"
ON public.booking_media FOR SELECT
USING (public.is_admin());
