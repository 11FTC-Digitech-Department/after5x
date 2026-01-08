-- 1. CUSTOMER ACTIVITY
CREATE OR REPLACE VIEW public.view_customer_bookings_detailed WITH (security_invoker = true) AS
SELECT b.id as booking_id, b.created_at, b.scheduled_for, b.status, b.booking_type, b.grand_total,
    p.full_name as provider_name, p.avatar_url as provider_avatar, prov.agency_id,
    i.status as payment_status, i.xendit_invoice_url,
    EXISTS (SELECT 1 FROM public.reviews r WHERE r.booking_id = b.id AND r.reviewer_id = b.customer_id) as has_reviewed
FROM public.bookings b
LEFT JOIN public.providers prov ON b.provider_id = prov.id
LEFT JOIN public.profiles p ON prov.id = p.id
LEFT JOIN public.invoices i ON b.id = i.booking_id
WHERE b.customer_id = auth.uid();

-- 2. PROVIDER EARNINGS
CREATE OR REPLACE VIEW public.view_provider_earnings_monthly WITH (security_invoker = true) AS
SELECT b.provider_id, DATE_TRUNC('month', b.finished_work_at) as month_start, COUNT(b.id) as total_jobs,
    SUM(b.provider_earnings) as total_earnings, SUM(b.total_materials_amount) as total_reimbursements
FROM public.bookings b
WHERE b.status IN ('payment_pending', 'paid')
GROUP BY b.provider_id, DATE_TRUNC('month', b.finished_work_at);

-- 3. PROVIDER STATS (FIXED: replaced p.is_online with p.status)
CREATE OR REPLACE VIEW public.view_provider_stats_dashboard WITH (security_invoker = true) AS
SELECT p.id as provider_id, p.rating_avg, p.rating_count, p.status,
    (SELECT COUNT(*) FROM public.bookings b WHERE b.provider_id = p.id AND b.status IN ('confirmed', 'on_the_way', 'arrived', 'in_progress')) as active_jobs_count,
    (SELECT COALESCE(SUM(provider_earnings), 0) FROM public.bookings b WHERE b.provider_id = p.id AND b.status IN ('payment_pending', 'paid') AND b.finished_work_at >= CURRENT_DATE) as earnings_today,
    (SELECT COUNT(*) FROM public.bookings b WHERE b.provider_id = p.id AND b.created_at > (NOW() - INTERVAL '30 days') AND b.status = 'paid') as jobs_completed_30d
FROM public.providers p;

-- 4. ADMIN STATS (FIXED: replaced is_verified=true with verification_status='verified')
CREATE OR REPLACE VIEW public.view_admin_system_health WITH (security_invoker = true) AS
SELECT
    (SELECT COUNT(*) FROM public.profiles WHERE role = 'customer') as total_customers,
    (SELECT COUNT(*) FROM public.providers WHERE verification_status = 'verified') as verified_providers,
    (SELECT COUNT(*) FROM public.bookings WHERE status = 'in_progress') as active_jobs_now,
    (SELECT SUM(grand_total) FROM public.bookings WHERE status = 'paid') as all_time_gmv;