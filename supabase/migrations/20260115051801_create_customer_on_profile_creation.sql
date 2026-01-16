-- Function to create customer record when profile with role 'customer' is created
CREATE OR REPLACE FUNCTION create_customer_on_profile_creation()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create customer record if role is 'customer'
    IF NEW.role = 'customer' THEN
        INSERT INTO public.customers (id, created_at, updated_at)
        VALUES (NEW.id, NEW.created_at, NEW.updated_at)
        ON CONFLICT (id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on profiles table
DROP TRIGGER IF EXISTS trigger_create_customer_on_profile ON public.profiles;
CREATE TRIGGER trigger_create_customer_on_profile
    AFTER INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION create_customer_on_profile_creation();

-- Also create customer records for existing profiles with role 'customer' that don't have customer records
INSERT INTO public.customers (id, created_at, updated_at)
SELECT p.id, p.created_at, p.updated_at
FROM public.profiles p
LEFT JOIN public.customers c ON p.id = c.id
WHERE p.role = 'customer' AND c.id IS NULL
ON CONFLICT (id) DO NOTHING;