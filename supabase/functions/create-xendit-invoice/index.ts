// Supabase Edge Function: Create Xendit Invoice
// Purpose: Create a Xendit invoice when customer initiates payment

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateInvoiceRequest {
  bookingId: string
}

// Xendit v3 Payment Session Response (actual API response structure)
interface XenditSessionResponse {
  payment_session_id: string  // This is the actual field name from Xendit v3 API
  reference_id: string
  status: 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'CANCELED'
  session_type: string
  mode: string
  amount: number
  currency: string
  country: string
  payment_link_url: string
  expires_at: string
  created: string  // Xendit uses 'created' not 'created_at'
  updated: string  // Xendit uses 'updated' not 'updated_at'
  customer_id?: string
  metadata?: Record<string, string>
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const publicBaseUrl = Deno.env.get('PUBLIC_BASE_URL') || supabaseUrl
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const xenditSecretKey = Deno.env.get('XENDIT_SECRET_KEY')
    const appUrl = Deno.env.get('APP_URL') || 'http://localhost:8100'

    // Validate required environment variables
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing required env vars:', { supabaseUrl: !!supabaseUrl, supabaseServiceKey: !!supabaseServiceKey })
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the JWT from the request header to identify the user
    // Check both cases for header name (some proxies lowercase headers)
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization')

    // Auth header present check (no sensitive data logged)

    if (!authHeader) {
      // Log all headers for debugging (without sensitive values)
      const headerNames = Array.from(req.headers.keys())
      console.error('Missing auth header. Available headers:', headerNames)
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client with service role for full access
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify the user token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.error('Auth verification failed:', authError?.message || 'No user returned')
      return new Response(
        JSON.stringify({ error: 'Invalid authorization token', details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // User authenticated

    // Parse request body
    const { bookingId }: CreateInvoiceRequest = await req.json()

    if (!bookingId) {
      return new Response(
        JSON.stringify({ error: 'Missing bookingId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1. Get booking details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        id,
        customer_id,
        status,
        grand_total,
        grand_total_after_voucher,
        address_snapshot,
        customers (
          id,
          xendit_customer_id,
          profiles (
            email,
            full_name,
            phone_number
          )
        )
      `)
      .eq('id', bookingId)
      .single()

    if (bookingError || !booking) {
      return new Response(
        JSON.stringify({ error: 'Booking not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the user owns this booking
    if (booking.customer_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized access to booking' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Verify booking is in PAYMENT_PENDING status
    if (booking.status !== 'payment_pending') {
      return new Response(
        JSON.stringify({ error: `Invalid booking status: ${booking.status}. Expected: payment_pending` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Check for existing valid invoice
    const { data: existingInvoice } = await supabase
      .from('invoices')
      .select('*')
      .eq('booking_id', bookingId)
      .in('status', ['PENDING'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (existingInvoice && existingInvoice.expires_at) {
      const expiresAt = new Date(existingInvoice.expires_at)
      if (expiresAt > new Date()) {
        // Return existing valid invoice
        return new Response(
          JSON.stringify({
            success: true,
            invoiceId: existingInvoice.id,
            invoiceUrl: existingInvoice.xendit_invoice_url,
            xenditInvoiceId: existingInvoice.xendit_invoice_id,
            amount: existingInvoice.amount,
            expiresAt: existingInvoice.expires_at,
            isExisting: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // 4. Get customer details
    const customer = (booking as any).customers
    const profile = customer?.profiles

    if (!profile?.email) {
      return new Response(
        JSON.stringify({ error: 'Customer email not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5. Generate reference ID for tracking (v3 uses reference_id instead of external_id)
    const referenceId = `booking-${bookingId}-${Date.now()}`

    // 6. Prepare Xendit v3 Payment Session payload
    // Parse customer name for individual_detail (surname is required, min 1 char)
    const nameParts = (profile.full_name || 'Customer').trim().split(' ').filter(Boolean)
    const givenNames = nameParts[0] || 'Customer'
    const surname = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '-'

    const successReturnUrl = `${publicBaseUrl}/functions/v1/payment-redirect?booking=${bookingId}&status=success`
    const cancelReturnUrl = `${publicBaseUrl}/functions/v1/payment-redirect?booking=${bookingId}&status=failed`
    const returnUrlDebug = {
      supabaseUrl,
      publicBaseUrl,
      appUrl,
      successReturnUrl,
      cancelReturnUrl,
      publicBaseUrlIsHttps: publicBaseUrl.startsWith('https://'),
      supabaseUrlIsHttps: supabaseUrl.startsWith('https://'),
      successReturnUrlIsHttps: successReturnUrl.startsWith('https://'),
      cancelReturnUrlIsHttps: cancelReturnUrl.startsWith('https://'),
    }
    console.log('Xendit return URL debug:', returnUrlDebug)

    const xenditPayload: Record<string, any> = {
      reference_id: referenceId,
      session_type: 'PAY',
      mode: 'PAYMENT_LINK',
      amount: booking.grand_total_after_voucher ?? booking.grand_total,
      currency: 'PHP',
      country: 'PH',
      // Use email for notifications without creating a formal customer record
      customer_email: profile.email,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      description: `Payment for Service Booking #${bookingId.slice(-6).toUpperCase()}`,
      // Use HTTPS redirect URL that will redirect to app deeplink
      success_return_url: successReturnUrl,
      cancel_return_url: cancelReturnUrl,
      // Channel codes available for Payment Sessions API
      allowed_payment_channels: [
        'CARDS',        // Visa, Mastercard, JCB
        'GCASH',        // GCash e-wallet
        'GRABPAY',      // GrabPay e-wallet
        'SHOPEEPAY',    // ShopeePay e-wallet
        'CEBUANA',      // Cebuana Over-The-Counter
        'LBC',          // LBC Over-The-Counter
        '7ELEVEN',      // 7-Eleven Over-The-Counter
        'QRPH'          // QR Philippines
      ],
      metadata: {
        booking_id: bookingId,
        customer_id: booking.customer_id
      }
    }

    // 7. Call Xendit v3 Payment Sessions API
    const xenditAuth = btoa(`${xenditSecretKey}:`)
    const xenditResponse = await fetch('https://api.xendit.co/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${xenditAuth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(xenditPayload)
    })

    if (!xenditResponse.ok) {
      const errorData = await xenditResponse.json()
      console.error('Xendit API error:', { errorData, returnUrlDebug })
      return new Response(
        JSON.stringify({ error: 'Failed to create payment invoice', details: errorData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const xenditSession: XenditSessionResponse = await xenditResponse.json()
    console.log('Xendit session created:', xenditSession.payment_session_id, 'status:', xenditSession.status)

    // Validate we got a session ID
    if (!xenditSession.payment_session_id) {
      console.error('Xendit response missing payment_session_id:', xenditSession)
      return new Response(
        JSON.stringify({ error: 'Invalid Xendit response - missing session ID' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 8. Store invoice in database (using payment_session_id as the xendit invoice ID)
    const { data: invoiceRecord, error: invoiceError } = await supabase.rpc('create_invoice_record', {
      p_booking_id: bookingId,
      p_customer_id: booking.customer_id,
      p_amount: booking.grand_total,
      p_xendit_invoice_id: xenditSession.payment_session_id,
      p_xendit_invoice_url: xenditSession.payment_link_url,
      p_xendit_external_id: referenceId,
      p_expires_at: xenditSession.expires_at
    })

    if (invoiceError) {
      console.error('Failed to store invoice record:', invoiceError)
      // This is critical - fail the request so user knows something went wrong
      return new Response(
        JSON.stringify({ error: 'Failed to create invoice record', details: invoiceError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Invoice record created:', invoiceRecord ? 'success' : 'no record returned')

    // 9. Return success response (map v3 fields to existing response format)
    return new Response(
      JSON.stringify({
        success: true,
        invoiceId: invoiceRecord || null,
        invoiceUrl: xenditSession.payment_link_url,
        xenditInvoiceId: xenditSession.payment_session_id,
        amount: xenditSession.amount,
        expiresAt: xenditSession.expires_at,
        isExisting: false
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error creating invoice:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
