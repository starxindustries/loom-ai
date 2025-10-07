import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface TaskExecutionRequest {
  task_id: string
  user_id: string
  provider_slug: string
  action_type: string
  action_config: Record<string, any>
  integration: {
    id: string
    encrypted_access_token: string
    encrypted_refresh_token: string
    encrypted_api_key: string
    additional_config: Record<string, any>
  }
}

interface ExecutionResult {
  success: boolean
  result?: any
  error?: string
}

serve(async (req: Request) => {
  try {
    // CORS headers
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      })
    }

    // Verify request method
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Log the request for debugging
    console.log('Edge function called with headers:', Object.fromEntries(req.headers.entries()))

    // Parse request body
    const body: TaskExecutionRequest = await req.json()
    const { task_id, user_id, provider_slug, action_type, action_config, integration } = body

    if (!task_id || !user_id || !provider_slug || !action_type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client with service role key to bypass RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    console.log(`Executing task ${task_id} for user ${user_id}: ${provider_slug}:${action_type}`)

    let result: ExecutionResult

    // Execute based on provider and action type
    switch (provider_slug) {
      case 'gmail':
        if (action_type === 'send_email') {
          result = await executeGmailSendEmail(action_config, integration)
        } else {
          result = { success: false, error: `Unsupported Gmail action: ${action_type}` }
        }
        break

      case 'slack':
        if (action_type === 'post_message') {
          result = await executeSlackMessage(action_config, integration)
        } else {
          result = { success: false, error: `Unsupported Slack action: ${action_type}` }
        }
        break

      case 'webhook':
        result = await executeWebhook(action_config)
        break

      default:
        result = {
          success: false,
          error: `Unsupported provider: ${provider_slug}`
        }
    }

    // Update task execution log
    await supabase
      .from('task_execution_logs')
      .update({
        status: result.success ? 'success' : 'failed',
        result_data: result.result || null,
        error_message: result.error || null,
        completed_at: new Date().toISOString()
      })
      .eq('task_id', task_id)
      .eq('status', 'running')

    console.log(`Task ${task_id} execution result:`, result)

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    )
  }
})

// Gmail send email implementation
async function executeGmailSendEmail(
  config: Record<string, any>, 
  integration: any
): Promise<ExecutionResult> {
  try {
    if (!config.to || !config.subject) {
      return { success: false, error: 'Missing required fields: to, subject' }
    }

    // Debug: Log the integration data (without showing full token for security)
    console.log('Integration data:', {
      id: integration.id,
      has_server_token: !!integration.server_access_token,
      token_length: integration.server_access_token?.length || 0,
      token_preview: integration.server_access_token?.substring(0, 20) + '...'
    })

    // Create RFC 2822 email format
    const emailLines = [
      `To: ${config.to}`,
      config.cc ? `Cc: ${config.cc}` : '',
      config.bcc ? `Bcc: ${config.bcc}` : '',
      `Subject: ${config.body}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'MIME-Version: 1.0',
      '',
      config.body || ''
    ].filter(line => line !== '')

    const email = emailLines.join('\r\n')
    const encodedEmail = btoa(email).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

    // Call Gmail API
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${integration.server_access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        raw: encodedEmail
      })
    })

    const responseData = await response.json()

    if (!response.ok) {
      return {
        success: false,
        error: `Gmail API error: ${responseData.error?.message || response.statusText}`
      }
    }

    return {
      success: true,
      result: {
        messageId: responseData.id,
        threadId: responseData.threadId,
        to: config.to,
        subject: config.subject,
        provider: 'gmail'
      }
    }

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown Gmail error'
    }
  }
}

// Slack message implementation
async function executeSlackMessage(
  config: Record<string, any>,
  integration: any
): Promise<ExecutionResult> {
  try {
    if (!config.channel || !config.text) {
      return { success: false, error: 'Missing required fields: channel, text' }
    }

    const payload = {
      channel: config.channel,
      text: config.text,
      username: config.username || 'Loom AI',
      icon_emoji: config.icon_emoji || ':robot_face:'
    }

    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${integration.server_access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    const responseData = await response.json()

    if (!responseData.ok) {
      return {
        success: false,
        error: `Slack API error: ${responseData.error || 'Unknown error'}`
      }
    }

    return {
      success: true,
      result: {
        messageId: responseData.ts,
        channel: responseData.channel,
        text: config.text,
        provider: 'slack'
      }
    }

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown Slack error'
    }
  }
}

// Webhook implementation
async function executeWebhook(config: Record<string, any>): Promise<ExecutionResult> {
  try {
    if (!config.url) {
      return { success: false, error: 'Missing required field: url' }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Loom-AI-Reminder-System/1.0'
    }

    // Add custom headers
    if (config.headers) {
      try {
        const customHeaders = typeof config.headers === 'string' 
          ? JSON.parse(config.headers) 
          : config.headers
        Object.assign(headers, customHeaders)
      } catch {
        // Invalid JSON headers, ignore
      }
    }

    // Add auth header
    if (config.auth_header) {
      headers['Authorization'] = config.auth_header
    }

    const method = (config.method || 'POST').toUpperCase()
    let body: string | undefined

    if (method !== 'GET' && config.body) {
      try {
        const bodyObj = typeof config.body === 'string' 
          ? JSON.parse(config.body) 
          : config.body
        body = JSON.stringify(bodyObj)
      } catch {
        body = String(config.body)
      }
    }

    const response = await fetch(config.url, {
      method,
      headers,
      body
    })

    let responseData
    const responseText = await response.text()
    try {
      responseData = JSON.parse(responseText)
    } catch {
      responseData = responseText
    }

    return {
      success: response.ok,
      result: {
        status: response.status,
        statusText: response.statusText,
        data: responseData,
        url: config.url,
        method
      },
      error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`
    }

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown webhook error'
    }
  }
}
