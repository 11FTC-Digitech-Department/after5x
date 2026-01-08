CREATE OR REPLACE FUNCTION public.handle_booking_status_change()
RETURNS TRIGGER AS $$
DECLARE
    notification_title TEXT;
    notification_body TEXT;
    target_user_id UUID;
BEGIN
    IF OLD.status = NEW.status THEN RETURN NEW; END IF;
    target_user_id := NEW.customer_id;

    CASE NEW.status
        WHEN 'confirmed' THEN
            notification_title := 'Booking Confirmed';
            notification_body := 'A provider has accepted your request.';
        WHEN 'on_the_way' THEN
            notification_title := 'Provider On The Way';
            notification_body := 'Your service provider has started travelling.';
        WHEN 'arrived' THEN
            notification_title := 'Provider Arrived';
            notification_body := 'Your provider is at the service location.';
        WHEN 'payment_pending' THEN
            notification_title := 'Service Complete';
            notification_body := 'Work is finished. Please review the invoice.';
        WHEN 'paid' THEN
            notification_title := 'Payment Received';
            notification_body := 'Thank you! Your payment has been confirmed.';
        WHEN 'cancelled' THEN
            notification_title := 'Booking Cancelled';
            notification_body := 'Your booking has been cancelled.';
        ELSE
            RETURN NEW;
    END CASE;

    INSERT INTO public.notifications (user_id, title, body, data)
    VALUES (target_user_id, notification_title, notification_body, jsonb_build_object('type', 'booking_status_update', 'booking_id', NEW.id, 'new_status', NEW.status));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_customer_status ON public.bookings;
CREATE TRIGGER trigger_notify_customer_status AFTER UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.handle_booking_status_change();