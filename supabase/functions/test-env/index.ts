// Test function to check environment variables (no auth required)
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  try {
    const xenditKey = Deno.env.get('XENDIT_SECRET_KEY')
    const callbackToken = Deno.env.get('XENDIT_CALLBACK_TOKEN')

    return new Response(
      JSON.stringify({
        XENDIT_SECRET_KEY: xenditKey ? 'SET (length: ' + xenditKey.length + ')' : 'NOT SET',
        XENDIT_CALLBACK_TOKEN: callbackToken ? 'SET (length: ' + callbackToken.length + ')' : 'NOT SET',
        xenditKeyPrefix: xenditKey ? xenditKey.substring(0, 20) + '...' : null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})