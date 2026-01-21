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

interface XenditInvoiceResponse {
  id: string
  external_id: string
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'FAILED'
  amount: number
  paid_amount?: number
  paid_at?: string
  payment_method?: string
  payment_channel?: string
  payment_destination?: string
  fees_paid_amount?: number
  expiry_date: string
  currency: string
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const xenditSecretKey = Deno.env.get('XENDIT_SECRET_KEY')!

    // Initialize Supabase client
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
    const xenditAuth = btoa(`${xenditSecretKey}:`)
    const xenditResponse = await fetch(`https://api.xendit.co/v2/invoices/${invoice.xendit_invoice_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${xenditAuth}`,
      }
    })

    if (!xenditResponse.ok) {
      // Xendit API error - return current DB status
      console.error('Xendit API error:', await xenditResponse.text())
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
          xenditError: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const xenditInvoice: XenditInvoiceResponse = await xenditResponse.json()

    // 5. If Xendit status differs from DB, sync the status
    if (xenditInvoice.status !== invoice.status) {
      console.log(`Status mismatch detected: DB=${invoice.status}, Xendit=${xenditInvoice.status}`)

      if (xenditInvoice.status === 'PAID') {
        // Update invoice status
        const paymentMethodType = mapPaymentMethodType(xenditInvoice.payment_method || '')
        await supabase.rpc('update_invoice_paid', {
          p_xendit_invoice_id: invoice.xendit_invoice_id,
          p_payment_method: xenditInvoice.payment_method || null,
          p_payment_method_type: paymentMethodType,
          p_payment_channel: xenditInvoice.payment_channel || xenditInvoice.payment_destination || null,
          p_fees_paid: xenditInvoice.fees_paid_amount || 0
        })

        // Update booking status
        await supabase.rpc('update_booking_payment_status', {
          p_booking_id: bookingId,
          p_new_status: 'paid'
        })

        // Credit provider wallet
        await supabase.rpc('credit_provider_wallet', {
          p_booking_id: bookingId,
          p_invoice_id: invoice.id
        })

        // Auto-complete
        await supabase.rpc('update_booking_payment_status', {
          p_booking_id: bookingId,
          p_new_status: 'completed'
        })

        return new Response(
          JSON.stringify({
            success: true,
            bookingId,
            bookingStatus: 'completed',
            invoiceStatus: 'PAID',
            invoiceId: invoice.id,
            invoiceUrl: invoice.xendit_invoice_url,
            amount: invoice.amount,
            paidAt: xenditInvoice.paid_at,
            paymentMethod: xenditInvoice.payment_method,
            paymentChannel: xenditInvoice.payment_channel,
            needsSync: true,
            synced: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      } else if (xenditInvoice.status === 'EXPIRED') {
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
