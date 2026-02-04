// Supabase Edge Function: Notify Chat Message
// Purpose: Send push notifications for new chat messages
// Respects user preferences and quiet hours

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ChatMessagePayload {
  message_id: string
  booking_id: string
  sender_id: string
  sender_name: string
  recipient_id: string
  message_type: 'TEXT' | 'IMAGE'
  content: string
}

interface NotificationPreference {
  push_enabled: boolean
  chat_messages: boolean
  chat_quiet_hours_start: string | null
  chat_quiet_hours_end: string | null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const payload: ChatMessagePayload = await req.json()

    console.log(`Processing chat notification for message: ${payload.message_id}`)

    // Validate payload
    if (!payload.recipient_id || !payload.booking_id || !payload.sender_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get recipient's notification preferences
    const { data: preferences } = await supabase
      .from('notification_preferences')
      .select('push_enabled, chat_messages, chat_quiet_hours_start, chat_quiet_hours_end')
      .eq('user_id', payload.recipient_id)
      .single()

    // Check if notifications are enabled
    if (preferences) {
      // Check master toggle
      if (preferences.push_enabled === false) {
        console.log('Push notifications disabled for user')
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: 'push_disabled' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check chat messages toggle
      if (preferences.chat_messages === false) {
        console.log('Chat notifications disabled for user')
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: 'chat_disabled' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check quiet hours
      if (preferences.chat_quiet_hours_start && preferences.chat_quiet_hours_end) {
        if (isWithinQuietHours(preferences.chat_quiet_hours_start, preferences.chat_quiet_hours_end)) {
          console.log('Within quiet hours, skipping notification')
          return new Response(
            JSON.stringify({ success: true, skipped: true, reason: 'quiet_hours' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
    }

    // Determine app type based on recipient's role
    const { data: recipientProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', payload.recipient_id)
      .single()

    const appType = recipientProfile?.role === 'provider' ? 'experts' : 'customer'

    // Format notification content
    const notificationTitle = payload.sender_name || 'New Message'
    const notificationBody = payload.message_type === 'IMAGE'
      ? `${payload.sender_name} sent an image`
      : truncateMessage(payload.content, 100)

    // Call the main send-push-notification function
    const pushNotificationUrl = `${supabaseUrl}/functions/v1/send-push-notification`

    const pushResponse = await fetch(pushNotificationUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userIds: [payload.recipient_id],
        notification: {
          type: 'chat_message',
          title: notificationTitle,
          body: notificationBody,
          data: {
            booking_id: payload.booking_id,
            message_id: payload.message_id,
            sender_id: payload.sender_id,
            type: 'chat_message',
          },
        },
        options: {
          appType: appType,
          priority: 'high',
        },
      }),
    })

    const pushResult = await pushResponse.json()

    // Log the notification
    await supabase.from('notification_logs').insert({
      booking_id: payload.booking_id,
      notification_type: 'chat_message',
      recipient_id: payload.recipient_id,
      channel: 'push',
      status: pushResult.sent > 0 ? 'sent' : 'failed',
      metadata: {
        message_id: payload.message_id,
        sender_id: payload.sender_id,
        message_type: payload.message_type,
      },
      delivery_status: pushResult.sent > 0 ? 'sent' : 'failed',
    })

    console.log(`Chat notification result: sent=${pushResult.sent}, failed=${pushResult.failed}`)

    return new Response(
      JSON.stringify({
        success: true,
        ...pushResult,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error sending chat notification:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Check if current time is within quiet hours
 */
function isWithinQuietHours(startTime: string, endTime: string): boolean {
  const now = new Date()
  const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes()

  const [startHour, startMin] = startTime.split(':').map(Number)
  const [endHour, endMin] = endTime.split(':').map(Number)

  const startMinutes = startHour * 60 + startMin
  const endMinutes = endHour * 60 + endMin

  // Handle overnight quiet hours (e.g., 22:00 - 06:00)
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes
  }

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes
}

/**
 * Truncate message for notification preview
 */
function truncateMessage(message: string, maxLength: number): string {
  if (!message) return ''
  if (message.length <= maxLength) return message
  return message.substring(0, maxLength - 3) + '...'
}
