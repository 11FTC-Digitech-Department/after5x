-- FINAL RLS LAYER
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

-- Helper Functions (Already defined in 01, ensuring existence for all RLS)

-- Policies
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users view own customer data" ON public.customers FOR SELECT USING (auth.uid() = id OR public.is_admin());
CREATE POLICY "Users update own customer data" ON public.customers FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users manage own payment methods" ON public.user_payment_methods FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Providers are viewable by everyone" ON public.providers FOR SELECT USING (true);
CREATE POLICY "Providers update own data" ON public.providers FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Agencies public view" ON public.agencies FOR SELECT USING (true);
CREATE POLICY "Agency owners manage agency" ON public.agencies FOR ALL USING (auth.uid() = owner_id OR public.is_admin());
CREATE POLICY "Users see own addresses" ON public.user_addresses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users manage own addresses" ON public.user_addresses FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Public view categories" ON public.service_categories FOR SELECT USING (true);
CREATE POLICY "Public view services" ON public.services FOR SELECT USING (true);
CREATE POLICY "Public view variants" ON public.service_variants FOR SELECT USING (true);
CREATE POLICY "Public view materials" ON public.materials_catalog FOR SELECT USING (true);
CREATE POLICY "Admins manage categories" ON public.service_categories FOR ALL USING (public.is_admin());
CREATE POLICY "Admins manage services" ON public.services FOR ALL USING (public.is_admin());
CREATE POLICY "Admins manage variants" ON public.service_variants FOR ALL USING (public.is_admin());
CREATE POLICY "Admins manage materials" ON public.materials_catalog FOR ALL USING (public.is_admin());
CREATE POLICY "Public view offerings" ON public.provider_offerings FOR SELECT USING (true);
CREATE POLICY "Providers manage offerings" ON public.provider_offerings FOR ALL USING (auth.uid() = provider_id OR public.is_agency_owner_of_provider(provider_id) OR public.is_admin());

CREATE POLICY "Booking visibility" ON public.bookings FOR SELECT USING (auth.uid() = customer_id OR auth.uid() = provider_id OR public.is_agency_owner_of_provider(provider_id) OR public.is_admin());
CREATE POLICY "Customers create bookings" ON public.bookings FOR INSERT WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Participants update booking" ON public.bookings FOR UPDATE USING (auth.uid() = customer_id OR auth.uid() = provider_id OR public.is_admin());

CREATE POLICY "Booking items visibility" ON public.booking_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_items.booking_id AND (b.customer_id = auth.uid() OR b.provider_id = auth.uid() OR public.is_agency_owner_of_provider(b.provider_id) OR public.is_admin())));
CREATE POLICY "Booking materials visibility" ON public.booking_materials FOR SELECT USING (EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_materials.booking_id AND (b.customer_id = auth.uid() OR b.provider_id = auth.uid() OR public.is_agency_owner_of_provider(b.provider_id))));
CREATE POLICY "Providers add materials" ON public.booking_materials FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_materials.booking_id AND b.provider_id = auth.uid()));
CREATE POLICY "Timeline visibility" ON public.booking_timeline FOR SELECT USING (EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_timeline.booking_id AND (b.customer_id = auth.uid() OR b.provider_id = auth.uid() OR public.is_agency_owner_of_provider(b.provider_id))));
CREATE POLICY "Media visibility" ON public.booking_media FOR SELECT USING (EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_media.booking_id AND (b.customer_id = auth.uid() OR b.provider_id = auth.uid() OR public.is_agency_owner_of_provider(b.provider_id))));
CREATE POLICY "Participants upload media" ON public.booking_media FOR INSERT WITH CHECK (auth.uid() = uploader_id AND EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_media.booking_id AND (b.customer_id = auth.uid() OR b.provider_id = auth.uid())));

CREATE POLICY "Chat visibility" ON public.booking_chats FOR SELECT USING (EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_chats.booking_id AND (b.customer_id = auth.uid() OR b.provider_id = auth.uid() OR public.is_agency_owner_of_provider(b.provider_id))));
CREATE POLICY "Chat insert" ON public.booking_chats FOR INSERT WITH CHECK (auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_chats.booking_id AND (b.customer_id = auth.uid() OR b.provider_id = auth.uid()) AND b.status IN ('confirmed', 'on_the_way', 'arrived', 'in_progress', 'payment_pending')));

CREATE POLICY "Owner views wallet" ON public.wallets FOR SELECT USING (auth.uid() = owner_id OR public.is_admin());
CREATE POLICY "Customers view own invoices" ON public.invoices FOR SELECT USING (auth.uid() = customer_id OR public.is_admin());
CREATE POLICY "Providers view own payouts" ON public.payouts FOR SELECT USING (auth.uid() = provider_id OR public.is_agency_owner_of_provider(provider_id) OR public.is_admin());
CREATE POLICY "Public view reviews" ON public.reviews FOR SELECT USING (is_public = true);
CREATE POLICY "Participants create reviews" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = reviewer_id AND EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = reviews.booking_id AND (b.customer_id = auth.uid() OR b.provider_id = auth.uid())));

CREATE POLICY "Requesters view own tickets" ON public.support_tickets FOR SELECT USING (auth.uid() = requester_id OR public.is_admin());
CREATE POLICY "Requesters create tickets" ON public.support_tickets FOR INSERT WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Requesters update own tickets" ON public.support_tickets FOR UPDATE USING (auth.uid() = requester_id OR public.is_admin());
CREATE POLICY "Participants view messages" ON public.support_ticket_messages FOR SELECT USING (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = support_ticket_messages.ticket_id AND (t.requester_id = auth.uid() OR public.is_admin())));
CREATE POLICY "Participants create messages" ON public.support_ticket_messages FOR INSERT WITH CHECK (auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = support_ticket_messages.ticket_id AND (t.requester_id = auth.uid() OR public.is_admin())));

CREATE POLICY "Users see own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Public read settings" ON public.system_settings FOR SELECT USING (true);
CREATE POLICY "Admins manage settings" ON public.system_settings FOR ALL USING (public.is_admin());
CREATE POLICY "Admins view audit logs" ON public.audit_logs FOR SELECT USING (public.is_admin());