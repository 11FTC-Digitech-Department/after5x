// Supabase Edge Function: Send Push Notification
// Purpose: Send FCM push notifications to users based on their device tokens and preferences

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { encode as base64Encode } from 'https://deno.land/std@0.177.0/encoding/base64.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PushNotificationRequest {
  userIds: string[]
  notification: {
    type: string
    title: string
    body: string
    data?: Record<string, string>
    imageUrl?: string
  }
  options?: {
    appType?: 'customer' | 'experts' | 'both'
    priority?: 'high' | 'normal'
  }
}

// Database webhook payload format
interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  schema: string
  record: {
    id: string
    user_ids: string[]
    type: string
    title: string
    body: string
    booking_id?: string
    app_type: string
    status: string
  }
  old_record: any
}

interface DeviceToken {
  user_id: string
  token: string
  platform: string
  app_type: string
}

interface NotificationPreference {
  user_id: string
  push_enabled: boolean
  [key: string]: boolean | string
}

// Map notification types to preference column names
const notificationTypeToPreference: Record<string, string> = {
  // Customer preferences
  'booking_confirmed': 'booking_confirmed',
  'booking_started': 'booking_started',
  'booking_completed': 'booking_completed',
  'booking_cancelled': 'booking_cancelled',
  'provider_on_way': 'provider_on_way',
  'provider_arrived': 'provider_arrived',
  // Provider preferences
  'new_job': 'new_job',
  'job_confirmed': 'job_confirmed',
  'job_cancelled': 'job_cancelled',
  'job_reminder': 'job_reminder',
  'payment_received': 'payment_received',
  'payout_processed': 'payout_processed',
  'verification_status': 'verification_status',
  'reviews': 'reviews',
  // Common
  'promotions': 'promotions',
  'news_updates': 'news_updates',
  // Chat
  'chat_message': 'chat_messages',
}

// FCM credentials cache for each app type
interface FCMCredentials {
  serviceAccount: { project_id: string; client_email: string; private_key: string }
  accessToken: string
  projectId: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Read FCM credentials for both app types
    const fcmCustomerKey = Deno.env.get('FCM_SERVICE_ACCOUNT_KEY')
    const fcmExpertsKey = Deno.env.get('FCM_SERVICE_ACCOUNT_KEY_EXPERTS')

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // At least one FCM key must be configured
    if (!fcmCustomerKey && !fcmExpertsKey) {
      console.error('No FCM service account keys configured')
      return new Response(
        JSON.stringify({ error: 'FCM not configured', sent: 0 }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request - handle both direct API calls and database webhook payloads
    const rawPayload = await req.json()
    let userIds: string[]
    let notification: PushNotificationRequest['notification']
    let options: PushNotificationRequest['options'] = {}
    let queueRecordId: string | null = null

    // Check if this is a database webhook payload
    if (rawPayload.type && rawPayload.table === 'push_notification_queue' && rawPayload.record) {
      const webhook = rawPayload as WebhookPayload
      const record = webhook.record

      // Only process INSERT events with pending status
      if (webhook.type !== 'INSERT' || record.status !== 'pending') {
        console.log(`Skipping webhook: type=${webhook.type}, status=${record.status}`)
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: 'Not a pending INSERT' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      queueRecordId = record.id
      userIds = record.user_ids
      notification = {
        type: record.type,
        title: record.title,
        body: record.body,
        data: record.booking_id ? { booking_id: record.booking_id } : undefined,
      }
      options = {
        appType: record.app_type as 'customer' | 'experts' | 'both',
      }

      console.log(`Processing webhook for queue record: ${queueRecordId}`)
    } else {
      // Direct API call format
      const request = rawPayload as PushNotificationRequest
      userIds = request.userIds
      notification = request.notification
      options = request.options || {}
    }

    if (!userIds?.length || !notification) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userIds, notification' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processing push notification for ${userIds.length} users, type: ${notification.type}`)

    // Parse and cache FCM credentials for each app type
    const fcmCredentialsMap = new Map<string, FCMCredentials>()

    // Helper to get or create FCM credentials for an app type
    async function getFCMCredentials(appType: string): Promise<FCMCredentials | null> {
      if (fcmCredentialsMap.has(appType)) {
        return fcmCredentialsMap.get(appType)!
      }

      // Select the appropriate key based on app type
      // Experts app uses FCM_SERVICE_ACCOUNT_KEY_EXPERTS, with fallback to customer key
      // Customer app uses FCM_SERVICE_ACCOUNT_KEY
      let fcmKey: string | undefined
      if (appType === 'experts') {
        fcmKey = fcmExpertsKey || fcmCustomerKey
        if (!fcmExpertsKey) {
          console.warn(`FCM_SERVICE_ACCOUNT_KEY_EXPERTS not configured, falling back to customer key for experts app`)
        }
      } else {
        fcmKey = fcmCustomerKey
      }

      if (!fcmKey) {
        console.error(`No FCM key available for app type: ${appType}`)
        return null
      }

      try {
        const serviceAccount = JSON.parse(fcmKey)
        const accessToken = await getAccessToken(serviceAccount)
        const credentials: FCMCredentials = {
          serviceAccount,
          accessToken,
          projectId: serviceAccount.project_id,
        }
        fcmCredentialsMap.set(appType, credentials)
        console.log(`FCM credentials loaded for ${appType} app (project: ${serviceAccount.project_id})`)
        return credentials
      } catch (e) {
        console.error(`Failed to parse FCM service account key for ${appType}:`, e)
        return null
      }
    }

    // Get device tokens for users
    let tokenQuery = supabase
      .from('device_tokens')
      .select('user_id, token, platform, app_type')
      .in('user_id', userIds)
      .eq('is_active', true)

    // Filter by app type if specified
    if (options.appType && options.appType !== 'both') {
      tokenQuery = tokenQuery.eq('app_type', options.appType)
    }

    const { data: tokens, error: tokensError } = await tokenQuery

    if (tokensError) {
      console.error('Error fetching device tokens:', tokensError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch device tokens' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!tokens?.length) {
      console.log('No active tokens found for users:', userIds)
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No active tokens' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found ${tokens.length} active device tokens`)

    // Get user preferences
    const { data: preferences } = await supabase
      .from('notification_preferences')
      .select('*')
      .in('user_id', userIds)

    const preferencesMap = new Map<string, NotificationPreference>(
      (preferences || []).map((p: NotificationPreference) => [p.user_id, p])
    )

    // Filter tokens based on preferences
    const preferenceColumn = notificationTypeToPreference[notification.type]
    const eligibleTokens = tokens.filter((token: DeviceToken) => {
      const userPrefs = preferencesMap.get(token.user_id)

      // If no preferences exist, send (default enabled)
      if (!userPrefs) return true

      // Check master toggle
      if (!userPrefs.push_enabled) return false

      // Check specific notification type preference
      if (preferenceColumn && userPrefs[preferenceColumn] === false) {
        return false
      }

      return true
    })

    if (!eligibleTokens.length) {
      console.log('All tokens filtered out by preferences')
      return new Response(
        JSON.stringify({ success: true, sent: 0, filtered: tokens.length, message: 'Filtered by preferences' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`${eligibleTokens.length} tokens eligible after preference filtering`)

    // Group tokens by app_type for sending with correct FCM credentials
    const tokensByAppType = new Map<string, DeviceToken[]>()
    for (const token of eligibleTokens) {
      const appType = token.app_type || 'customer'
      if (!tokensByAppType.has(appType)) {
        tokensByAppType.set(appType, [])
      }
      tokensByAppType.get(appType)!.push(token)
    }

    console.log(`Tokens grouped by app type: ${[...tokensByAppType.entries()].map(([k, v]) => `${k}=${v.length}`).join(', ')}`)

    // Send to FCM for each app type with appropriate credentials
    const allResults: { result: PromiseSettledResult<{ messageId: string }>; tokenData: DeviceToken }[] = []

    for (const [appType, tokens] of tokensByAppType) {
      const credentials = await getFCMCredentials(appType)

      if (!credentials) {
        // No credentials available for this app type, mark all as failed
        console.error(`Skipping ${tokens.length} tokens for ${appType} - no FCM credentials`)
        for (const tokenData of tokens) {
          allResults.push({
            result: {
              status: 'rejected',
              reason: {
                code: 'MISSING_CREDENTIALS',
                message: `FCM credentials not configured for app type: ${appType}`,
              },
            },
            tokenData,
          })
        }
        continue
      }

      // Send notifications for this app type
      const results = await Promise.allSettled(
        tokens.map((tokenData: DeviceToken) =>
          sendToFCM(
            credentials.accessToken,
            credentials.projectId,
            tokenData,
            notification,
            options.priority || 'high'
          )
        )
      )

      // Collect results with token data
      for (let i = 0; i < results.length; i++) {
        allResults.push({ result: results[i], tokenData: tokens[i] })
      }
    }

    // Process results
    let successCount = 0
    let failCount = 0
    const logEntries: any[] = []
    const tokensToDeactivate: string[] = []

    for (const { result, tokenData } of allResults) {
      if (result.status === 'fulfilled') {
        successCount++
        logEntries.push({
          recipient_id: tokenData.user_id,
          notification_type: notification.type,
          channel: 'push',
          status: 'sent',
          fcm_message_id: result.value.messageId,
          fcm_response: result.value,
          delivery_status: 'sent',
        })
      } else {
        failCount++
        const errorCode = result.reason?.code

        // Check for invalid token and mark for deactivation
        // Don't deactivate for missing credentials - that's a server config issue
        if (
          errorCode === 'UNREGISTERED' ||
          errorCode === 'INVALID_ARGUMENT' ||
          errorCode === 'messaging/registration-token-not-registered'
        ) {
          tokensToDeactivate.push(tokenData.token)
        }

        logEntries.push({
          recipient_id: tokenData.user_id,
          notification_type: notification.type,
          channel: 'push',
          status: 'failed',
          error_message: result.reason?.message || 'Unknown error',
          fcm_response: result.reason,
          delivery_status: 'failed',
        })
      }
    }

    // Deactivate invalid tokens
    if (tokensToDeactivate.length > 0) {
      console.log(`Deactivating ${tokensToDeactivate.length} invalid tokens`)
      await supabase
        .from('device_tokens')
        .update({ is_active: false })
        .in('token', tokensToDeactivate)
    }

    // Batch insert logs
    if (logEntries.length > 0) {
      const { error: logError } = await supabase.from('notification_logs').insert(logEntries)
      if (logError) {
        console.error('Failed to insert notification logs:', logError)
      }
    }

    console.log(`Push notification complete: ${successCount} sent, ${failCount} failed`)

    // Mark queue record as processed if this came from a webhook
    if (queueRecordId) {
      const { error: updateError } = await supabase
        .from('push_notification_queue')
        .update({
          status: failCount > 0 && successCount === 0 ? 'failed' : 'processed',
          processed_at: new Date().toISOString(),
        })
        .eq('id', queueRecordId)

      if (updateError) {
        console.error('Failed to update queue record:', updateError)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        failed: failCount,
        filtered: tokens.length - eligibleTokens.length,
        total: tokens.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error sending push notification:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Get OAuth2 access token for FCM HTTP v1 API using service account
 */
async function getAccessToken(serviceAccount: {
  client_email: string
  private_key: string
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  // Create JWT header
  const header = { alg: 'RS256', typ: 'JWT' }

  // Create JWT payload
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600, // 1 hour
  }

  // Encode header and payload
  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const toSign = `${encodedHeader}.${encodedPayload}`

  // Sign the JWT
  const signature = await signJWT(toSign, serviceAccount.private_key)
  const jwt = `${toSign}.${signature}`

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text()
    console.error('Failed to get FCM access token:', errorText)
    throw new Error('Failed to get FCM access token')
  }

  const tokenData = await tokenResponse.json()
  return tokenData.access_token
}

/**
 * Sign JWT using RSA-SHA256
 */
async function signJWT(data: string, privateKeyPem: string): Promise<string> {
  // Parse PEM key
  const pemContents = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '')

  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0))

  // Import the key
  const key = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  // Sign the data
  const encoder = new TextEncoder()
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    encoder.encode(data)
  )

  return base64UrlEncode(new Uint8Array(signature))
}

/**
 * Base64 URL encode (RFC 4648)
 */
function base64UrlEncode(data: string | Uint8Array): string {
  let base64: string
  if (typeof data === 'string') {
    base64 = btoa(data)
  } else {
    base64 = base64Encode(data)
  }
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Send notification to FCM HTTP v1 API
 */
async function sendToFCM(
  accessToken: string,
  projectId: string,
  tokenData: DeviceToken,
  notification: PushNotificationRequest['notification'],
  priority: 'high' | 'normal'
): Promise<{ messageId: string }> {
  const message: any = {
    message: {
      token: tokenData.token,
      notification: {
        title: notification.title,
        body: notification.body,
        ...(notification.imageUrl && { image: notification.imageUrl }),
      },
      data: {
        ...notification.data,
        type: notification.type,
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      android: {
        priority: priority,
        notification: {
          channel_id: 'after5_notifications',
          icon: 'ic_notification',
          color: '#4A90A4',
        },
      },
      apns: {
        headers: {
          'apns-priority': priority === 'high' ? '10' : '5',
        },
        payload: {
          aps: {
            sound: 'default',
          },
        },
      },
    },
  }

  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    }
  )

  if (!response.ok) {
    const errorData = await response.json()
    const errorCode =
      errorData.error?.details?.[0]?.errorCode || errorData.error?.status || 'UNKNOWN'
    throw {
      code: errorCode,
      message: errorData.error?.message || 'FCM request failed',
      details: errorData,
    }
  }

  const result = await response.json()
  return { messageId: result.name }
}
