-- Add in-app notification when customer cancels before provider is assigned
-- (existing logic only notifies provider when assigned, or customer when provider cancels)

CREATE OR REPLACE FUNCTION public.handle_booking_status_change_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT;
  v_body TEXT;
  v_type TEXT;
  v_data JSONB;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  v_data := jsonb_build_object('bookingId', NEW.id, 'booking_id', NEW.id);

  CASE NEW.status
    WHEN 'confirmed' THEN
      v_type := 'booking_confirmed';
      v_title := 'Booking Confirmed';
      v_body := 'A provider has accepted your request.';
      INSERT INTO public.notifications (user_id, type, title, body, message, data, read)
      VALUES (NEW.customer_id, v_type, v_title, v_body, v_body, v_data, false);

    WHEN 'on_the_way' THEN
      v_type := 'provider_en_route';
      v_title := 'Provider On The Way';
      v_body := 'Your service provider has started travelling.';
      INSERT INTO public.notifications (user_id, type, title, body, message, data, read)
      VALUES (NEW.customer_id, v_type, v_title, v_body, v_body, v_data, false);

    WHEN 'arrived' THEN
      v_type := 'provider_arrived';
      v_title := 'Provider Arrived';
      v_body := 'Your provider is at the service location.';
      INSERT INTO public.notifications (user_id, type, title, body, message, data, read)
      VALUES (NEW.customer_id, v_type, v_title, v_body, v_body, v_data, false);

    WHEN 'payment_pending' THEN
      v_type := 'booking_completed';
      v_title := 'Service Complete';
      v_body := 'Work is finished. Please review the invoice.';
      INSERT INTO public.notifications (user_id, type, title, body, message, data, read)
      VALUES (NEW.customer_id, v_type, v_title, v_body, v_body, v_data, false);

    WHEN 'paid' THEN
      v_type := 'booking_completed';
      v_title := 'Payment Received';
      v_body := 'Thank you! Your payment has been confirmed.';
      INSERT INTO public.notifications (user_id, type, title, body, message, data, read)
      VALUES (NEW.customer_id, v_type, v_title, v_body, v_body, v_data, false);

    WHEN 'completed' THEN
      v_type := 'booking_completed';
      v_title := 'Booking Completed';
      v_body := 'Thank you for using After5! We hope you enjoyed the service.';
      INSERT INTO public.notifications (user_id, type, title, body, message, data, read)
      VALUES (NEW.customer_id, v_type, v_title, v_body, v_body, v_data, false);

    WHEN 'cancelled' THEN
      -- Add cancelled_by so client can skip duplicate toast when user initiated
      v_data := v_data || jsonb_build_object('cancelled_by', NEW.cancelled_by);

      -- Always notify customer (for their notification history)
      v_type := 'booking_cancelled';
      v_title := 'Booking Cancelled';
      v_body := 'Your booking has been cancelled.';
      INSERT INTO public.notifications (user_id, type, title, body, message, data, read)
      VALUES (NEW.customer_id, v_type, v_title, v_body, v_body, v_data, false);

      -- Also notify provider when customer cancelled and provider was assigned
      IF NEW.cancelled_by = NEW.customer_id AND NEW.provider_id IS NOT NULL THEN
        v_type := 'booking_cancelled';
        v_title := 'Job Cancelled';
        v_body := 'Booking has been cancelled by the customer.';
        INSERT INTO public.notifications (user_id, type, title, body, message, data, read)
        VALUES (NEW.provider_id, v_type, v_title, v_body, v_body, v_data, false);
      END IF;

    WHEN 'rejected' THEN
      v_type := 'booking_rejected';
      v_title := 'Booking Not Accepted';
      v_body := 'Your booking request was not accepted. Please try again.';
      INSERT INTO public.notifications (user_id, type, title, body, message, data, read)
      VALUES (NEW.customer_id, v_type, v_title, v_body, v_body, v_data, false);

    ELSE
      NULL;
  END CASE;

  RETURN NEW;
END;
$$;
