import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-debug',
}

interface RedeemVoucherRequest {
  bookingId: string
  code: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const debugEnabled = req.headers.get('x-debug') === '1' || Deno.env.get('APP_ENV') === 'local'

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    })
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      if (debugEnabled) {
        console.error('[redeem-voucher] Auth error:', authError?.message)
      }
      return new Response(
        JSON.stringify({ error: 'Invalid authorization token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { bookingId, code }: RedeemVoucherRequest = await req.json()

    if (!bookingId || !code) {
      return new Response(
        JSON.stringify({ error: 'Invalid voucher code', ...(debugEnabled ? { debug: 'missing_booking_or_code' } : {}) }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data, error } = await supabase.rpc('redeem_voucher', {
      p_booking_id: bookingId,
      p_code: code
    })

    if (error || !data || data.length === 0) {
      if (debugEnabled) {
        console.error('[redeem-voucher] RPC error:', error?.message)
      }
      return new Response(
        JSON.stringify({ error: 'Invalid voucher code', ...(debugEnabled ? { debug: error?.message || 'rpc_failed' } : {}) }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const result = Array.isArray(data) ? data[0] : data

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    if (debugEnabled) {
      console.error('[redeem-voucher] Unexpected error:', error?.message || error)
    }
    return new Response(
      JSON.stringify({ error: 'Invalid voucher code', ...(debugEnabled ? { debug: error?.message || 'unexpected_error' } : {}) }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
