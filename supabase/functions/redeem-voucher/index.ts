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

function normalizeErrorCode(message: string | undefined): string {
  const value = (message || '').toUpperCase()
  if (value.includes('MULTIPLE_REDEMPTION_ATTEMPT')) return 'MULTIPLE_REDEMPTION_ATTEMPT'
  if (value.includes('VOUCHER_EXPIRED')) return 'VOUCHER_EXPIRED'
  if (value.includes('USAGE_LIMIT_REACHED')) return 'USAGE_LIMIT_REACHED'
  if (value.includes('ALREADY_REDEEMED')) return 'ALREADY_REDEEMED'
  return 'INVALID_VOUCHER'
}

function errorCodeFromReason(reason: string | undefined | null): string {
  const value = (reason || '').toLowerCase()
  if (value === 'expired') return 'VOUCHER_EXPIRED'
  if (value === 'max_redemptions_reached') return 'USAGE_LIMIT_REACHED'
  if (value === 'inactive') return 'USAGE_LIMIT_REACHED'
  if (value === 'per_user_limit') return 'MULTIPLE_REDEMPTION_ATTEMPT'
  if (value === 'already_redeemed') return 'ALREADY_REDEEMED'
  return 'INVALID_VOUCHER'
}

function getMessageForCode(code: string): string {
  switch (code) {
    case 'MULTIPLE_REDEMPTION_ATTEMPT':
      return 'This voucher can only be used once per account.'
    case 'VOUCHER_EXPIRED':
      return 'This voucher has expired and can no longer be used.'
    case 'USAGE_LIMIT_REACHED':
      return 'This voucher is no longer available.'
    case 'ALREADY_REDEEMED':
      return 'You have already used this voucher.'
    default:
      return 'Invalid voucher code.'
  }
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
        JSON.stringify({ error: 'Invalid voucher code.', errorCode: 'INVALID_VOUCHER', ...(debugEnabled ? { debug: 'missing_booking_or_code' } : {}) }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data, error } = await supabase.rpc('redeem_voucher', {
      p_booking_id: bookingId,
      p_code: code
    })

    if (error || !data || data.length === 0) {
      let errorCode = normalizeErrorCode(error?.message)
      if (errorCode === 'INVALID_VOUCHER') {
        const { data: latestFailure } = await supabase
          .from('voucher_redemption_logs')
          .select('reason_code')
          .eq('booking_id', bookingId)
          .eq('customer_id', user.id)
          .eq('status', 'failed')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        errorCode = errorCodeFromReason((latestFailure as any)?.reason_code) || errorCode
      }
      if (debugEnabled) {
        console.error('[redeem-voucher] RPC error:', error?.message)
      }
      return new Response(
        JSON.stringify({
          error: getMessageForCode(errorCode),
          errorCode,
          ...(debugEnabled ? { debug: error?.message || 'rpc_failed' } : {})
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const result = Array.isArray(data) ? data[0] : data

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    const errorCode = normalizeErrorCode(error?.message)
    if (debugEnabled) {
      console.error('[redeem-voucher] Unexpected error:', error?.message || error)
    }
    return new Response(
      JSON.stringify({
        error: getMessageForCode(errorCode),
        errorCode,
        ...(debugEnabled ? { debug: error?.message || 'unexpected_error' } : {})
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
