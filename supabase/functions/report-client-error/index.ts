import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ClientErrorReportPayload {
  message: string
  stack?: string
  route?: string
  platform?: string
  userId?: string
  timestamp: string
  source: 'global' | 'http'
}

interface SlackConfig {
  username: string
  iconEmoji: string
}

function isValidPayload(payload: unknown): payload is ClientErrorReportPayload {
  if (!payload || typeof payload !== 'object') {
    return false
  }

  const record = payload as Record<string, unknown>
  return (
    typeof record.message === 'string' &&
    typeof record.timestamp === 'string' &&
    (record.source === 'global' || record.source === 'http')
  )
}

function loadSlackConfig(): SlackConfig {
  return {
    username: Deno.env.get('SLACK_ERROR_USERNAME') || 'After5 Alerts',
    iconEmoji: Deno.env.get('SLACK_ERROR_ICON_EMOJI') || ':rotating_light:',
  }
}

function formatSlackText(payload: ClientErrorReportPayload, config: SlackConfig): string {
  const lines = [
    `After5 client error (${payload.source})`,
    `Time: ${payload.timestamp}`,
    `Route: ${payload.route || 'unknown'}`,
    `Platform: ${payload.platform || 'unknown'}`,
    `User: ${payload.userId || 'anonymous'}`,
    `Message: ${payload.message}`,
  ]

  const stackPreview = payload.stack
    ?.split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 5)
    .join('\n')

  if (stackPreview) {
    lines.push(`Stack:\n${stackPreview}`)
  }

  return lines.join('\n')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const webhookUrl = Deno.env.get('SLACK_ERROR_WEBHOOK_URL')
    const slackConfig = loadSlackConfig()

    if (!webhookUrl) {
      console.error('Missing SLACK_ERROR_WEBHOOK_URL secret')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const payload = await req.json()

    if (!isValidPayload(payload)) {
      return new Response(
        JSON.stringify({ error: 'Invalid payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const slackResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: formatSlackText(payload, slackConfig),
        username: slackConfig.username,
        icon_emoji: slackConfig.iconEmoji,
      }),
    })

    if (!slackResponse.ok) {
      const details = await slackResponse.text()
      console.error('Slack webhook failed:', slackResponse.status, details)
      return new Response(
        JSON.stringify({ error: 'Slack delivery failed' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('report-client-error failed:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
