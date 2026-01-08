-- 1. ANNOUNCEMENTS
CREATE TABLE public.announcements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    summary TEXT,
    content TEXT NOT NULL,
    banner_url TEXT,
    target_roles app_role[], 
    is_published BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_pinned BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. READS
CREATE TABLE public.announcement_reads (
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    announcement_id UUID REFERENCES public.announcements(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, announcement_id)
);

CREATE INDEX idx_announcements_published ON public.announcements(is_published, published_at);
CREATE INDEX idx_announcements_expiry ON public.announcements(expires_at);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage announcements" ON public.announcements FOR ALL USING (public.is_admin());
CREATE POLICY "Users view relevant announcements" ON public.announcements FOR SELECT USING (
    is_published = true AND (expires_at IS NULL OR expires_at > NOW()) AND (
        target_roles IS NULL OR target_roles = '{}' OR 
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = ANY(announcements.target_roles))
    ) OR public.is_admin()
);

CREATE POLICY "Users manage own reads" ON public.announcement_reads FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admins view all reads" ON public.announcement_reads FOR SELECT USING (public.is_admin());

CREATE OR REPLACE VIEW public.view_user_announcements WITH (security_invoker = true) AS
SELECT a.id, a.title, a.summary, a.banner_url, a.published_at, a.is_pinned,
    EXISTS (SELECT 1 FROM public.announcement_reads ar WHERE ar.announcement_id = a.id AND ar.user_id = auth.uid()) as is_read
FROM public.announcements a
WHERE a.is_published = true AND (a.expires_at IS NULL OR a.expires_at > NOW());