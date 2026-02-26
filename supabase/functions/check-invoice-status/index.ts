// Supabase Edge Function: Check Invoice Status
// Purpose: Polling fallback to check and sync invoice status from Xendit

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CheckStatusRequest {
  bookingId: string
}

// Xendit v3 Payment Session Response (actual API response structure)
interface XenditSessionResponse {
  payment_session_id: string
  reference_id: string
  status: 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'CANCELED'
  session_type: string
  mode: string
  amount: number
  currency: string
  country: string
  payment_link_url?: string
  expires_at: string
  created: string
  updated: string
  payment_request_id?: string  // Just an ID, not nested object
  payment_token_id?: string
  metadata?: Record<string, string>
}

// Xendit v3 Payment Request Response (fetched separately)
interface XenditPaymentRequestResponse {
  id: string
  reference_id: string
  business_id: string
  currency: string
  amount: number
  country: string
  status: 'PENDING' | 'REQUIRES_ACTION' | 'SUCCEEDED' | 'FAILED'
  payment_method: {
    id: string
    type: string
    reusability: string
    status: string
    card?: {
      currency: string
      channel_properties: {
        skip_three_d_secure?: boolean
        failure_return_url?: string
        success_return_url?: string
      }
      card_information: {
        token_id: string
        masked_card_number: string
        cardholder_name?: string
        expiry_month: string
        expiry_year: string
        fingerprint: string
        type: string
        network: string
        country: string
        issuer?: string
      }
    }
    ewallet?: {
      channel_code: string
      channel_properties?: Record<string, string>
    }
    qr_code?: {
      channel_code: string
    }
    over_the_counter?: {
      channel_code: string
    }
  }
  created: string
  updated: string
  metadata?: Record<string, string>
}

// Fetch Payment Request details from Xendit
async function fetchPaymentRequest(
  paymentRequestId: string,
  xenditAuth: string
): Promise<XenditPaymentRequestResponse | null> {
  try {
    const response = await fetch(`https://api.xendit.co/payment_requests/${paymentRequestId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${xenditAuth}`,
      }
    })

    if (!response.ok) {
      console.error('Failed to fetch payment request:', response.status, await response.text())
      return null
    }

    return await response.json()
  } catch (error) {
    console.error('Error fetching payment request:', error)
    return null
  }
}

// Map v3 session status to v2-compatible status for our internal use
// Now accepts optional payment request to determine actual payment status
function mapSessionStatusToInvoiceStatus(
  session: XenditSessionResponse,
  paymentRequest?: XenditPaymentRequestResponse | null
): 'PENDING' | 'PAID' | 'EXPIRED' | 'FAILED' {
  switch (session.status) {
    case 'ACTIVE':
      return 'PENDING'
    case 'COMPLETED':
      // When session is COMPLETED, check the payment request status
      if (paymentRequest?.status === 'SUCCEEDED') {
        return 'PAID'
      }
      // If no payment request or status isn't SUCCEEDED, still treat COMPLETED as PAID
      // (COMPLETED session means payment was successful in most cases)
      return 'PAID'
    case 'EXPIRED':
      return 'EXPIRED'
    case 'CANCELED':
      return 'FAILED'
    default:
      return 'PENDING'
  }
}

// Map Xendit payment methods to our enum
function mapPaymentMethodType(paymentMethod: string): string {
  const methodMap: Record<string, string> = {
    'CREDIT_CARD': 'CARD',
    'DEBIT_CARD': 'CARD',
    'GCASH': 'EWALLET',
    'GRAB_PAY': 'EWALLET',
    'PAYMAYA': 'EWALLET',
    'OVO': 'EWALLET',
    'DANA': 'EWALLET',
    'LINKAJA': 'EWALLET',
    'SHOPEEPAY': 'EWALLET',
    'BPI': 'BANK_TRANSFER',
    'BDO': 'BANK_TRANSFER',
    'UNIONBANK': 'BANK_TRANSFER',
    'CHINABANK': 'BANK_TRANSFER',
    'METROBANK': 'BANK_TRANSFER',
    'RCBC': 'BANK_TRANSFER',
    'CEBUANA': 'RETAIL_OUTLET',
    'ECPAY': 'RETAIL_OUTLET',
    '7ELEVEN': 'RETAIL_OUTLET',
    'LBC': 'RETAIL_OUTLET',
    'QRPH': 'QR_CODE',
    'INSTAPAY': 'QR_CODE'
  }
  return methodMap[paymentMethod] || 'EWALLET'
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const xenditSecretKey = Deno.env.get('XENDIT_SECRET_KEY')

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

    // Auth header present check

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
    const { bookingId }: CheckStatusRequest = await req.json()

    if (!bookingId) {
      return new Response(
        JSON.stringify({ error: 'Missing bookingId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1. Get booking to verify ownership
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, customer_id, status')
      .eq('id', bookingId)
      .single()

    if (bookingError || !booking) {
      return new Response(
        JSON.stringify({ error: 'Booking not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify ownership
    if (booking.customer_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized access to booking' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Get latest invoice for this booking
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (invoiceError || !invoice) {
      // No invoice exists - return current status
      return new Response(
        JSON.stringify({
          success: true,
          bookingId,
          bookingStatus: booking.status,
          invoiceStatus: 'NONE',
          invoiceId: null,
          invoiceUrl: null,
          amount: null,
          needsSync: false
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. If invoice is already PAID or booking is completed, just return current status
    if (invoice.status === 'PAID' || booking.status === 'paid' || booking.status === 'completed') {
      return new Response(
        JSON.stringify({
          success: true,
          bookingId,
          bookingStatus: booking.status,
          invoiceStatus: invoice.status,
          invoiceId: invoice.id,
          invoiceUrl: invoice.xendit_invoice_url,
          amount: invoice.amount,
          paidAt: invoice.paid_at,
          paymentMethod: invoice.payment_method,
          paymentChannel: invoice.payment_channel,
          needsSync: false
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Check with Xendit API for current status
    console.log('Checking Xendit API for invoice:', invoice.xendit_invoice_id)

    if (!xenditSecretKey) {
      console.error('Missing XENDIT_SECRET_KEY')
      return new Response(
        JSON.stringify({ error: 'Missing Xendit configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const xenditAuth = btoa(`${xenditSecretKey}:`)
    // Use v3 Payment Sessions API
    const xenditResponse = await fetch(`https://api.xendit.co/sessions/${invoice.xendit_invoice_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${xenditAuth}`,
      }
    })

    if (!xenditResponse.ok) {
      // Xendit API error - return current DB status
      const errorText = await xenditResponse.text()
      console.error('Xendit API error:', xenditResponse.status, errorText)
      return new Response(
        JSON.stringify({
          success: true,
          bookingId,
          bookingStatus: booking.status,
          invoiceStatus: invoice.status,
          invoiceId: invoice.id,
          invoiceUrl: invoice.xendit_invoice_url,
          amount: invoice.amount,
          needsSync: false,
          xenditError: true,
          xenditErrorDetails: errorText
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const xenditSession: XenditSessionResponse = await xenditResponse.json()
    console.log('Xendit session response:', xenditSession.payment_session_id, 'status:', xenditSession.status)

    // If session is COMPLETED and has a payment_request_id, fetch the payment request details
    let paymentRequest: XenditPaymentRequestResponse | null = null
    if (xenditSession.status === 'COMPLETED' && xenditSession.payment_request_id) {
      console.log('Session COMPLETED, fetching payment request:', xenditSession.payment_request_id)
      paymentRequest = await fetchPaymentRequest(xenditSession.payment_request_id, xenditAuth)
      if (paymentRequest) {
        console.log('Payment request status:', paymentRequest.status)
      }
    }

    // Map v3 status to v2-compatible status
    const mappedStatus = mapSessionStatusToInvoiceStatus(xenditSession, paymentRequest)
    console.log('Xendit session status:', xenditSession.status, 'Payment request status:', paymentRequest?.status, 'Mapped status:', mappedStatus, 'DB status:', invoice.status)

    // Extract payment details from payment request response
    const paymentMethod = paymentRequest?.payment_method?.ewallet?.channel_code ||
                          paymentRequest?.payment_method?.qr_code?.channel_code ||
                          paymentRequest?.payment_method?.over_the_counter?.channel_code ||
                          paymentRequest?.payment_method?.type || null
    const paidAt = paymentRequest?.updated || null
    const feesPaid = 0 // Fees not directly available in payment request response

    // 5. If Xendit status differs from DB, sync the status
    if (mappedStatus !== invoice.status) {
      console.log(`Status mismatch detected: DB=${invoice.status}, Xendit=${mappedStatus}`)

      if (mappedStatus === 'PAID') {
        // Update invoice status
        const paymentMethodType = mapPaymentMethodType(paymentMethod || '')
        console.log('Updating invoice to PAID:', invoice.xendit_invoice_id, 'method:', paymentMethodType)

        const { error: invoiceUpdateError } = await supabase.rpc('update_invoice_paid', {
          p_xendit_invoice_id: invoice.xendit_invoice_id,
          p_payment_method: paymentMethod,
          p_payment_method_type: paymentMethodType,
          p_payment_channel: paymentMethod,
          p_fees_paid: feesPaid
        })

        if (invoiceUpdateError) {
          console.error('Failed to update invoice:', invoiceUpdateError)
          throw new Error(`Failed to update invoice: ${invoiceUpdateError.message}`)
        }

        // Update booking status to paid
        console.log('Updating booking status to paid:', bookingId)
        const { error: bookingPaidError } = await supabase.rpc('update_booking_payment_status', {
          p_booking_id: bookingId,
          p_new_status: 'paid'
        })

        if (bookingPaidError) {
          console.error('Failed to update booking to paid:', bookingPaidError)
          throw new Error(`Failed to update booking: ${bookingPaidError.message}`)
        }

        // Credit provider wallet
        console.log('Crediting provider wallet for booking:', bookingId)
        const { error: walletError } = await supabase.rpc('credit_provider_wallet', {
          p_booking_id: bookingId,
          p_invoice_id: invoice.id
        })

        if (walletError) {
          console.error('Failed to credit wallet:', walletError)
          // Don't throw here - wallet credit is not critical for payment confirmation
        }

        // Auto-complete the booking
        console.log('Auto-completing booking:', bookingId)
        const { error: bookingCompleteError } = await supabase.rpc('update_booking_payment_status', {
          p_booking_id: bookingId,
          p_new_status: 'completed'
        })

        if (bookingCompleteError) {
          console.error('Failed to auto-complete booking:', bookingCompleteError)
          // Don't throw - booking is already paid
        }

        return new Response(
          JSON.stringify({
            success: true,
            bookingId,
            bookingStatus: 'completed',
            invoiceStatus: 'PAID',
            invoiceId: invoice.id,
            invoiceUrl: invoice.xendit_invoice_url,
            amount: invoice.amount,
            paidAt: paidAt,
            paymentMethod: paymentMethod,
            paymentChannel: paymentMethod,
            needsSync: true,
            synced: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      } else if (mappedStatus === 'EXPIRED') {
        // Update invoice status to expired
        await supabase.rpc('update_invoice_expired', {
          p_xendit_invoice_id: invoice.xendit_invoice_id
        })

        return new Response(
          JSON.stringify({
            success: true,
            bookingId,
            bookingStatus: booking.status,
            invoiceStatus: 'EXPIRED',
            invoiceId: invoice.id,
            invoiceUrl: invoice.xendit_invoice_url,
            amount: invoice.amount,
            needsSync: true,
            synced: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // 6. Return current status (no sync needed)
    return new Response(
      JSON.stringify({
        success: true,
        bookingId,
        bookingStatus: booking.status,
        invoiceStatus: invoice.status,
        invoiceId: invoice.id,
        invoiceUrl: invoice.xendit_invoice_url,
        amount: invoice.amount,
        expiresAt: invoice.expires_at,
        needsSync: false
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error checking invoice status:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
