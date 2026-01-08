-- 1. ENUMS
CREATE TYPE invoice_status AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'FAILED');
CREATE TYPE payout_status AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE ticket_category AS ENUM ('DISPUTE', 'BILLING', 'TECHNICAL', 'OTHER');
CREATE TYPE ticket_status AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
CREATE TYPE chat_message_type AS ENUM ('TEXT', 'IMAGE', 'LOCATION');

-- 2. INVOICES
CREATE TABLE public.invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
    customer_id UUID REFERENCES public.customers(id) NOT NULL,
    xendit_invoice_id TEXT UNIQUE,
    xendit_invoice_url TEXT,
    payment_method TEXT,
    amount DECIMAL(12,2) NOT NULL,
    status invoice_status DEFAULT 'PENDING',
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PAYOUTS
CREATE TABLE public.payouts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    provider_id UUID REFERENCES public.providers(id) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    breakdown_details JSONB DEFAULT '{}'::JSONB,
    xendit_disbursement_id TEXT UNIQUE,
    status payout_status DEFAULT 'PROCESSING',
    proof_of_transfer_url TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. REVIEWS
CREATE TABLE public.reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
    reviewer_id UUID REFERENCES public.profiles(id) NOT NULL,
    target_id UUID REFERENCES public.profiles(id) NOT NULL,
    rating INT CHECK (rating >= 1 AND rating <= 5) NOT NULL,
    comment TEXT,
    tags TEXT[],
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(booking_id, reviewer_id)
);

-- 5. CHATS
CREATE TABLE public.booking_chats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES public.profiles(id) NOT NULL,
    message_type chat_message_type DEFAULT 'TEXT',
    content TEXT NOT NULL,
    read_at TIMESTAMPTZ,
    is_archived BOOLEAN DEFAULT FALSE, 
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. SUPPORT TICKETS
CREATE TABLE public.support_tickets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_ref_id TEXT NOT NULL UNIQUE,
    requester_id UUID REFERENCES public.profiles(id) NOT NULL,
    booking_id UUID REFERENCES public.bookings(id),
    subject TEXT NOT NULL,
    category ticket_category NOT NULL,
    priority TEXT CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'CRITICAL')) DEFAULT 'NORMAL',
    status ticket_status DEFAULT 'OPEN',
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. MESSAGES
CREATE TABLE public.support_ticket_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id UUID REFERENCES public.support_tickets(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES public.profiles(id) NOT NULL,
    content TEXT NOT NULL,
    attachments TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoices_booking ON public.invoices(booking_id);
CREATE INDEX idx_payouts_provider ON public.payouts(provider_id);
CREATE INDEX idx_reviews_target ON public.reviews(target_id);
CREATE INDEX idx_chats_booking ON public.booking_chats(booking_id, created_at);
CREATE INDEX idx_tickets_requester ON public.support_tickets(requester_id);

CREATE TRIGGER update_invoices_modtime BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_tickets_modtime BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();