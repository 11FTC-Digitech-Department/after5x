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

interface XenditInvoiceResponse {
  id: string
  external_id: string
  user_id: string
  status: string
  merchant_name: string
  amount: number
  payer_email: string
  description: string
  expiry_date: string
  invoice_url: string
  available_banks: any[]
  available_retail_outlets: any[]
  available_ewallets: any[]
  should_exclude_credit_card: boolean
  should_send_email: boolean
  created: string
  updated: string
  currency: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const xenditSecretKey = Deno.env.get('XENDIT_SECRET_KEY')!
    const appUrl = Deno.env.get('APP_URL') || 'http://localhost:8100'

    // Initialize Supabase client with service role for full access
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get the JWT from the request header to identify the user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the user token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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

    // 5. Generate external ID for tracking
    const externalId = `booking-${bookingId}-${Date.now()}`

    // 6. Prepare Xendit invoice payload
    const invoiceExpiry = new Date()
    invoiceExpiry.setHours(invoiceExpiry.getHours() + 24) // 24 hour expiry

    const xenditPayload = {
      external_id: externalId,
      amount: booking.grand_total,
      payer_email: profile.email,
      description: `Payment for Service Booking #${bookingId.slice(-6).toUpperCase()}`,
      currency: 'PHP',
      invoice_duration: 86400, // 24 hours in seconds
      customer: {
        given_names: profile.full_name,
        email: profile.email,
        mobile_number: profile.phone_number || undefined
      },
      customer_notification_preference: {
        invoice_created: ['email'],
        invoice_reminder: ['email'],
        invoice_paid: ['email']
      },
      success_redirect_url: `${appUrl}/c/payment/${bookingId}?status=success`,
      failure_redirect_url: `${appUrl}/c/payment/${bookingId}?status=failed`,
      payment_methods: ['CREDIT_CARD', 'GCASH', 'GRAB_PAY', 'PAYMAYA', 'BPI', 'UNIONBANK', 'CEBUANA', 'ECPAY'],
      metadata: {
        booking_id: bookingId,
        customer_id: booking.customer_id
      }
    }

    // 7. Call Xendit Create Invoice API
    const xenditAuth = btoa(`${xenditSecretKey}:`)
    const xenditResponse = await fetch('https://api.xendit.co/v2/invoices', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${xenditAuth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(xenditPayload)
    })

    if (!xenditResponse.ok) {
      const errorData = await xenditResponse.json()
      console.error('Xendit API error:', errorData)
      return new Response(
        JSON.stringify({ error: 'Failed to create payment invoice', details: errorData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const xenditInvoice: XenditInvoiceResponse = await xenditResponse.json()

    // 8. Store invoice in database
    const { data: invoiceRecord, error: invoiceError } = await supabase.rpc('create_invoice_record', {
      p_booking_id: bookingId,
      p_customer_id: booking.customer_id,
      p_amount: booking.grand_total,
      p_xendit_invoice_id: xenditInvoice.id,
      p_xendit_invoice_url: xenditInvoice.invoice_url,
      p_xendit_external_id: externalId,
      p_expires_at: xenditInvoice.expiry_date
    })

    if (invoiceError) {
      console.error('Failed to store invoice record:', invoiceError)
      // Invoice was created in Xendit but failed to store - log for reconciliation
    }

    // 9. Return success response
    return new Response(
      JSON.stringify({
        success: true,
        invoiceId: invoiceRecord || null,
        invoiceUrl: xenditInvoice.invoice_url,
        xenditInvoiceId: xenditInvoice.id,
        amount: xenditInvoice.amount,
        expiresAt: xenditInvoice.expiry_date,
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
