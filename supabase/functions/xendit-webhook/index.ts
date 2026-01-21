// Supabase Edge Function: Xendit Webhook Handler
// Purpose: Handle Xendit webhook callbacks for invoice status updates

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-callback-token',
}

// Xendit webhook event types
type WebhookEvent = 'invoices' | 'invoice.paid' | 'invoice.expired'

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

    // Parse webhook payload
    const webhook: XenditInvoiceWebhook = await req.json()
    console.log('Received webhook:', JSON.stringify(webhook, null, 2))

    const xenditInvoiceId = webhook.id
    const status = webhook.status

    // 2. Handle different webhook events
    if (status === 'PAID') {
      // Payment successful
      console.log(`Invoice ${xenditInvoiceId} has been paid`)

      // Get booking ID from metadata or external_id
      let bookingId = webhook.metadata?.booking_id

      if (!bookingId && webhook.external_id) {
        // Parse from external_id format: "booking-{uuid}-{timestamp}"
        const match = webhook.external_id.match(/^booking-([a-f0-9-]+)-/)
        if (match) {
          bookingId = match[1]
        }
      }

      if (!bookingId) {
        console.error('Could not determine booking ID from webhook')
        return new Response(
          JSON.stringify({ error: 'Missing booking ID' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Update invoice status
      const paymentMethodType = mapPaymentMethodType(webhook.payment_method || '')
      const { data: invoiceId, error: invoiceError } = await supabase.rpc('update_invoice_paid', {
        p_xendit_invoice_id: xenditInvoiceId,
        p_payment_method: webhook.payment_method || null,
        p_payment_method_type: paymentMethodType,
        p_payment_channel: webhook.payment_channel || webhook.payment_destination || null,
        p_fees_paid: webhook.fees_paid_amount || 0
      })

      if (invoiceError) {
        console.error('Failed to update invoice:', invoiceError)
        // Continue processing - we still need to update booking
      }

      // Update booking status to PAID
      const { error: bookingStatusError } = await supabase.rpc('update_booking_payment_status', {
        p_booking_id: bookingId,
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
        p_booking_id: bookingId,
        p_invoice_id: invoiceId
      })

      if (walletError) {
        console.error('Failed to credit provider wallet:', walletError)
        // Log for manual reconciliation but don't fail the webhook
      }

      // Auto-transition to COMPLETED
      const { error: completeError } = await supabase.rpc('update_booking_payment_status', {
        p_booking_id: bookingId,
        p_new_status: 'completed'
      })

      if (completeError) {
        console.error('Failed to complete booking:', completeError)
      }

      // Send notifications (optional - could be done via database triggers)
      // await sendPaymentNotifications(supabase, bookingId)

      return new Response(
        JSON.stringify({ success: true, message: 'Payment processed successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } else if (status === 'EXPIRED') {
      // Invoice expired
      console.log(`Invoice ${xenditInvoiceId} has expired`)

      // Update invoice status
      const { error: invoiceError } = await supabase.rpc('update_invoice_expired', {
        p_xendit_invoice_id: xenditInvoiceId
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
      console.log(`Unhandled webhook status: ${status}`)
      return new Response(
        JSON.stringify({ success: true, message: `Status ${status} acknowledged` }),
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
