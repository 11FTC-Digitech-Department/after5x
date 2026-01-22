// Supabase Edge Function: Xendit Webhook Handler
// Purpose: Handle Xendit webhook callbacks for invoice status updates

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-callback-token',
}

// Xendit v3 webhook event types
type WebhookEvent = 
  // Payment API events (v3)
  | 'payment.capture' 
  | 'payment.authorization'
  | 'payment.failure'
  // Session events (if any)
  | 'payment_session.completed' 
  | 'payment_session.expired'
  // Legacy v2 invoice events
  | 'invoices' 
  | 'invoice.paid' 
  | 'invoice.expired'

// Xendit v3 Payment Capture Webhook (payment.capture event)
interface XenditPaymentWebhook {
  event: 'payment.capture' | 'payment.authorization' | 'payment.failure'
  business_id: string
  created: string
  data: {
    payment_id: string
    business_id: string
    status: 'SUCCEEDED' | 'FAILED' | 'PENDING' | 'AUTHORIZED'
    payment_request_id: string
    request_amount: number
    customer_id?: string
    channel_code: string
    country: string
    currency: string
    reference_id: string
    description?: string
    channel_properties?: Record<string, string>
    type: string
    created: string
    updated: string
    failure_code?: string
    metadata?: Record<string, string>
  }
}

// Xendit v3 Payment Session Webhook (if session events are sent)
interface XenditSessionWebhook {
  id: string
  payment_session_id?: string
  reference_id: string
  status: 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'CANCELED'
  session_type?: string
  mode?: string
  amount?: number
  currency?: string
  country?: string
  expires_at?: string
  created_at?: string
  updated_at?: string
  payment_request_id?: string
  metadata?: {
    booking_id?: string
    customer_id?: string
  }
}

// Legacy Xendit v2 Invoice Webhook (for backward compatibility)
interface XenditInvoiceWebhook {
  id: string
  external_id: string
  user_id: string
  is_high: boolean
  payment_method: string
  status: 'PAID' | 'EXPIRED' | 'PENDING'
  merchant_name: string
  amount: number
  paid_amount?: number
  bank_code?: string
  paid_at?: string
  payer_email?: string
  description?: string
  adjusted_received_amount?: number
  fees_paid_amount?: number
  updated: string
  created: string
  currency: string
  payment_channel?: string
  payment_destination?: string
  metadata?: {
    booking_id?: string
    customer_id?: string
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const xenditCallbackToken = Deno.env.get('XENDIT_CALLBACK_TOKEN')!

    // 1. Verify webhook signature
    const callbackToken = req.headers.get('x-callback-token')
    if (callbackToken !== xenditCallbackToken) {
      console.error('Invalid callback token')
      return new Response(
        JSON.stringify({ error: 'Invalid callback token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse webhook payload - could be v3 payment event, v3 session event, or v2 invoice
    const rawWebhook = await req.json()
    console.log('Received webhook:', JSON.stringify(rawWebhook, null, 2))

    let xenditId: string
    let isPaid: boolean
    let isExpired: boolean
    let bookingId: string | undefined
    let paymentMethod: string | null = null
    let paymentChannel: string | null = null
    let feesPaid: number = 0

    // Determine webhook type by checking for event field first (v3 payment events)
    const isV3PaymentEvent = rawWebhook.event && 
      ['payment.capture', 'payment.authorization', 'payment.failure'].includes(rawWebhook.event)
    
    // Check for session-based webhooks
    const isSessionWebhook = rawWebhook.session_type || rawWebhook.payment_session_id ||
      (rawWebhook.status && ['ACTIVE', 'COMPLETED', 'CANCELED', 'EXPIRED'].includes(rawWebhook.status) && !rawWebhook.event)

    if (isV3PaymentEvent) {
      // Handle v3 Payment API webhook (payment.capture, payment.failure, etc.)
      const webhook = rawWebhook as XenditPaymentWebhook
      const paymentData = webhook.data
      
      // For payment events, we need to find the invoice by reference_id (which contains booking ID)
      xenditId = paymentData.payment_request_id || paymentData.payment_id
      
      // payment.capture with SUCCEEDED status means payment is complete
      isPaid = webhook.event === 'payment.capture' && paymentData.status === 'SUCCEEDED'
      isExpired = false // Payment events don't have expiry, only failure
      const isFailed = webhook.event === 'payment.failure' || paymentData.status === 'FAILED'

      // Extract booking ID from reference_id (format: booking-{uuid}-{timestamp})
      // or from metadata if available
      bookingId = paymentData.metadata?.booking_id
      if (!bookingId && paymentData.reference_id) {
        const match = paymentData.reference_id.match(/^booking-([a-f0-9-]+)-/)
        if (match) {
          bookingId = match[1]
        }
      }

      // Extract payment details
      paymentMethod = paymentData.channel_code || null
      paymentChannel = paymentData.channel_code || null
      feesPaid = 0 // Not directly available in payment webhook

      console.log(`v3 payment webhook - Event: ${webhook.event}, Payment: ${paymentData.payment_id}, Status: ${paymentData.status}, Reference: ${paymentData.reference_id}`)

      // For payment events, we need to look up the invoice by booking_id since xenditId is the payment_request_id
      if (bookingId && (isPaid || isFailed)) {
        // Find invoice by booking_id instead of xendit_invoice_id
        const { data: invoiceByBooking, error: lookupByBookingError } = await supabase
          .from('invoices')
          .select('id, xendit_invoice_id, booking_id')
          .eq('booking_id', bookingId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (invoiceByBooking) {
          // Use the xendit_invoice_id from our database for updating
          xenditId = invoiceByBooking.xendit_invoice_id
          console.log(`Found invoice ${invoiceByBooking.id} with xendit_id ${xenditId} for booking ${bookingId}`)
        } else {
          console.warn(`No invoice found for booking ${bookingId}`)
        }
      }

    } else if (isSessionWebhook) {
      // Handle v3 Payment Session webhook
      const webhook = rawWebhook as XenditSessionWebhook
      xenditId = webhook.id || webhook.payment_session_id || ''

      // Session COMPLETED means payment succeeded
      isPaid = webhook.status === 'COMPLETED'
      isExpired = webhook.status === 'EXPIRED'

      // Extract booking ID from metadata or reference_id
      bookingId = webhook.metadata?.booking_id
      if (!bookingId && webhook.reference_id) {
        const match = webhook.reference_id.match(/^booking-([a-f0-9-]+)-/)
        if (match) {
          bookingId = match[1]
        }
      }

      paymentMethod = null // Session webhooks don't include payment method details
      paymentChannel = null
      feesPaid = 0

      console.log(`v3 session webhook - Session ${xenditId}: status=${webhook.status}`)
    } else {
      // Handle v2 Invoice webhook (backward compatibility)
      const webhook = rawWebhook as XenditInvoiceWebhook
      xenditId = webhook.id

      isPaid = webhook.status === 'PAID'
      isExpired = webhook.status === 'EXPIRED'

      // Extract booking ID from metadata or external_id
      bookingId = webhook.metadata?.booking_id
      if (!bookingId && webhook.external_id) {
        const match = webhook.external_id.match(/^booking-([a-f0-9-]+)-/)
        if (match) {
          bookingId = match[1]
        }
      }

      paymentMethod = webhook.payment_method || null
      paymentChannel = webhook.payment_channel || webhook.payment_destination || null
      feesPaid = webhook.fees_paid_amount || 0

      console.log(`v2 webhook - Invoice ${xenditId}: status=${webhook.status}`)
    }

    // 2. Handle payment success
    if (isPaid) {
      console.log(`Payment ${xenditId} has been paid`)

      if (!bookingId) {
        console.error('Could not determine booking ID from webhook')
        return new Response(
          JSON.stringify({ error: 'Missing booking ID' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // First, verify the invoice exists in our database
      const { data: existingInvoice, error: lookupError } = await supabase
        .from('invoices')
        .select('id, booking_id')
        .eq('xendit_invoice_id', xenditId)
        .maybeSingle()

      if (lookupError) {
        console.error('Error looking up invoice:', lookupError)
      }

      if (!existingInvoice) {
        // Invoice not found - this might be a test webhook or stale data
        console.warn(`Invoice not found for xendit_id: ${xenditId}. This may be a test webhook.`)
        return new Response(
          JSON.stringify({ success: true, message: 'Webhook acknowledged (invoice not found - possibly test data)' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Update invoice status
      const paymentMethodType = mapPaymentMethodType(paymentMethod || '')
      const { data: invoiceId, error: invoiceError } = await supabase.rpc('update_invoice_paid', {
        p_xendit_invoice_id: xenditId,
        p_payment_method: paymentMethod,
        p_payment_method_type: paymentMethodType,
        p_payment_channel: paymentChannel,
        p_fees_paid: feesPaid
      })

      if (invoiceError) {
        console.error('Failed to update invoice:', invoiceError)
        // Continue processing - we still need to update booking
      }

      // Update booking status to PAID
      const { error: bookingStatusError } = await supabase.rpc('update_booking_payment_status', {
        p_booking_id: existingInvoice.booking_id,
        p_new_status: 'paid'
      })

      if (bookingStatusError) {
        console.error('Failed to update booking status:', bookingStatusError)
        return new Response(
          JSON.stringify({ error: 'Failed to update booking status' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Credit provider wallet
      const { error: walletError } = await supabase.rpc('credit_provider_wallet', {
        p_booking_id: existingInvoice.booking_id,
        p_invoice_id: invoiceId || existingInvoice.id
      })

      if (walletError) {
        console.error('Failed to credit provider wallet:', walletError)
        // Log for manual reconciliation but don't fail the webhook
      }

      // Auto-transition to COMPLETED
      const { error: completeError } = await supabase.rpc('update_booking_payment_status', {
        p_booking_id: existingInvoice.booking_id,
        p_new_status: 'completed'
      })

      if (completeError) {
        console.error('Failed to complete booking:', completeError)
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Payment processed successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } else if (isExpired) {
      // Invoice/Session expired
      console.log(`Payment ${xenditId} has expired`)

      // First, verify the invoice exists
      const { data: existingInvoice } = await supabase
        .from('invoices')
        .select('id')
        .eq('xendit_invoice_id', xenditId)
        .maybeSingle()

      if (!existingInvoice) {
        console.warn(`Invoice not found for xendit_id: ${xenditId}. This may be a test webhook.`)
        return new Response(
          JSON.stringify({ success: true, message: 'Webhook acknowledged (invoice not found - possibly test data)' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Update invoice status
      const { error: invoiceError } = await supabase.rpc('update_invoice_expired', {
        p_xendit_invoice_id: xenditId
      })

      if (invoiceError) {
        console.error('Failed to update invoice status:', invoiceError)
      }

      // Note: We don't change booking status - it remains PAYMENT_PENDING
      // Customer can retry payment with a new invoice

      return new Response(
        JSON.stringify({ success: true, message: 'Invoice expiry processed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } else {
      // Unknown or unhandled status
      console.log(`Unhandled webhook status for ${xenditId}`)
      return new Response(
        JSON.stringify({ success: true, message: 'Webhook acknowledged' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('Webhook processing error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
