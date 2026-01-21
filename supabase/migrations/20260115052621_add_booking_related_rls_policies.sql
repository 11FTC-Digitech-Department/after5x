-- Add missing INSERT policies for booking_items
CREATE POLICY "Customers create booking items" ON public.booking_items FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.id = booking_items.booking_id
        AND b.customer_id = auth.uid()
    )
);

-- Add missing INSERT policies for booking_timeline
-- Timeline entries can be created by the system (SECURITY DEFINER functions)
-- or by booking participants for certain actions
CREATE POLICY "System creates timeline entries" ON public.booking_timeline FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.id = booking_timeline.booking_id
        AND (b.customer_id = auth.uid() OR b.provider_id = auth.uid() OR public.is_admin())
    )
);

-- Add missing UPDATE policies for booking_materials (customers should be able to approve)
CREATE POLICY "Customers approve materials" ON public.booking_materials FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.id = booking_materials.booking_id
        AND b.customer_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.id = booking_materials.booking_id
        AND b.customer_id = auth.uid()
    )
);

-- Add missing INSERT policies for booking_materials (providers can add materials)
-- Note: This policy already exists in the security.sql file, but let's make sure it's correct
-- The existing policy allows providers to insert, which is good

-- Ensure booking_items has proper UPDATE policies too (for when providers modify items)
CREATE POLICY "Providers update booking items" ON public.booking_items FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.id = booking_items.booking_id
        AND b.provider_id = auth.uid()
    )
);