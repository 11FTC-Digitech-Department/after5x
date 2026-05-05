import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-debug',
}

interface DeleteAccountRequest {
  confirmation?: string
  reason?: string
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
      return jsonResponse({ error: 'Server configuration error' }, 500)
    }

    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header' }, 401)
    }

    const userScopedSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await adminSupabase.auth.getUser(token)

    if (authError || !user) {
      if (debugEnabled) {
        console.error('[delete-account] Auth error:', authError?.message)
      }
      return jsonResponse({ error: 'Invalid authorization token' }, 401)
    }

    const body: DeleteAccountRequest = await req.json().catch(() => ({}))
    if (body.confirmation !== 'DELETE') {
      return jsonResponse({ error: 'Type DELETE to confirm account deletion.' }, 400)
    }

    const { data: closeResult, error: closeError } = await userScopedSupabase.rpc('close_own_account', {
      p_reason: body.reason || 'self_service',
    })

    if (closeError) {
      if (debugEnabled) {
        console.error('[delete-account] RPC error:', closeError.message)
      }
      return jsonResponse({
        error: 'Unable to delete account',
        ...(debugEnabled ? { debug: closeError.message } : {}),
      }, 400)
    }

    if (!closeResult?.success) {
      return jsonResponse({
        success: false,
        code: closeResult?.code || 'blocked',
        message: closeResult?.message || 'Your account cannot be deleted yet.',
        blockers: closeResult?.blockers || [],
      }, 409)
    }

    await deleteAvatarObjects(adminSupabase, user.id, debugEnabled)

    const { error: deleteUserError } = await adminSupabase.auth.admin.deleteUser(user.id, false)

    if (deleteUserError) {
      if (debugEnabled) {
        console.error('[delete-account] Auth deletion error:', deleteUserError.message)
      }
      return jsonResponse({
        success: false,
        code: 'auth_delete_failed',
        message: 'Your account data was anonymized, but we could not finish removing your login. Please contact support.',
        ...(debugEnabled ? { debug: deleteUserError.message } : {}),
      }, 500)
    }

    return jsonResponse({
      success: true,
      code: closeResult.code || 'closed',
      message: closeResult.message || 'Your account has been deleted. You can create a new account in the future.',
      authDeleted: true,
    })
  } catch (error: any) {
    if (debugEnabled) {
      console.error('[delete-account] Unexpected error:', error?.message || error)
    }
    return jsonResponse({
      error: 'Unable to delete account',
      ...(debugEnabled ? { debug: error?.message || 'unexpected_error' } : {}),
    }, 400)
  }
})

async function deleteAvatarObjects(supabase: any, userId: string, debugEnabled: boolean): Promise<void> {
  const { data: files, error: listError } = await supabase.storage
    .from('avatars')
    .list(userId)

  if (listError) {
    if (debugEnabled) {
      console.error('[delete-account] Avatar list error:', listError.message)
    }
    return
  }

  if (!files?.length) {
    return
  }

  const filePaths = files.map((file: { name: string }) => `${userId}/${file.name}`)
  const { error: removeError } = await supabase.storage
    .from('avatars')
    .remove(filePaths)

  if (removeError && debugEnabled) {
    console.error('[delete-account] Avatar remove error:', removeError.message)
  }
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(
    JSON.stringify(body),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
}
