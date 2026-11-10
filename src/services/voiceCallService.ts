import { supabase } from '@/integrations/supabase/client'
import { SUPABASE_FUNCTIONS_URL } from '@/constants/supabase'

interface InitiateCallParams {
  recipientPhone: string
  callerId: string
  conversationId?: string
  applicantId?: string
  flowId?: string
  variables?: Record<string, string>
}

interface InitiateCallResult {
  success: boolean
  callLogId?: string
  msg91CallId?: string
  error?: string
}

export async function initiateVoiceCall({
  recipientPhone,
  callerId,
  conversationId,
  applicantId,
  flowId,
  variables
}: InitiateCallParams): Promise<InitiateCallResult> {
  try {
    // 1. Create call log entry in database (use type assertion since table may not be in types yet)
    const { data: callLog, error: insertError } = await (supabase as any)
      .from('voice_call_logs')
      .insert({
        caller_id: callerId,
        recipient_phone: recipientPhone,
        call_type: 'outbound',
        status: 'initiated',
        conversation_id: conversationId || null,
        applicant_id: applicantId || null
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Error creating call log:', insertError)
      return { success: false, error: 'Failed to create call log' }
    }

    const callLogId = callLog.id

    // 2. Call WhatsApp Cloud API function
    const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/msg91-voice-call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: recipientPhone,
        flow_id: flowId,
        variables,
        call_log_id: callLogId
      })
    })

    const result = await response.json()

    if (!result.success) {
      // Update call log status to failed
      await (supabase as any)
        .from('voice_call_logs')
        .update({ status: 'failed' })
        .eq('id', callLogId)

      return { 
        success: false, 
        callLogId, 
        error: result.error || 'Failed to initiate call' 
      }
    }

    // 3. Update call log with call ID
    if (result.data?.request_id || result.data?.call_id) {
      await (supabase as any)
        .from('voice_call_logs')
        .update({ 
          msg91_call_id: result.data.request_id || result.data.call_id,
          status: 'ringing'
        })
        .eq('id', callLogId)
    }

    return { 
      success: true, 
      callLogId,
      msg91CallId: result.data?.request_id || result.data?.call_id
    }
  } catch (error) {
    console.error('Error initiating voice call:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

export async function updateCallStatus(
  callLogId: string, 
  status: string, 
  durationSeconds?: number
): Promise<boolean> {
  try {
    const updateData: Record<string, unknown> = { status }
    if (durationSeconds !== undefined) {
      updateData.duration_seconds = durationSeconds
    }

    const { error } = await (supabase as any)
      .from('voice_call_logs')
      .update(updateData)
      .eq('id', callLogId)

    if (error) {
      console.error('Error updating call status:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error updating call status:', error)
    return false
  }
}
