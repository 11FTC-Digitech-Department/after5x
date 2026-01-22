// Supabase Edge Function: Payment Redirect
// Purpose: Redirect from HTTPS URL to app deeplink after Xendit payment
// Note: Xendit requires HTTPS URLs, so we need this intermediate function to redirect to custom scheme

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const bookingId = url.searchParams.get('booking')
  const status = url.searchParams.get('status') || 'unknown'

  if (!bookingId) {
    return new Response('Missing booking ID', { status: 400, headers: corsHeaders })
  }

  // Construct the deeplink URL
  const deeplinkUrl = `after5://c/payment/${bookingId}?status=${status}`

  // Use 302 redirect to deeplink - this works for custom URL schemes
  return Response.redirect(deeplinkUrl, 302)
})
