import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'

export interface VoiceCallLog {
  id: string
  caller_id: string
  recipient_phone: string
  call_type: 'outbound' | 'inbound'
  status: 'initiated' | 'ringing' | 'connected' | 'completed' | 'missed' | 'failed' | 'busy' | 'no_answer'
  duration_seconds: number | null
  created_at: string
  updated_at: string
  msg91_call_id: string | null
  conversation_id: string | null
  applicant_id: string | null
}

interface UseVoiceCallLogsProps {
  conversationId?: string | null
  applicantId?: string | null
}

export function useVoiceCallLogs({ conversationId, applicantId }: UseVoiceCallLogsProps) {
  const [callLogs, setCallLogs] = useState<VoiceCallLog[]>([])
  const [loading, setLoading] = useState(true)

  const loadCallLogs = async () => {
    if (!conversationId && !applicantId) {
      setCallLogs([])
      setLoading(false)
      return
    }

    try {
      // Use type assertion since table may not be in types yet
      let query = (supabase as any)
        .from('voice_call_logs')
        .select('*')
        .order('created_at', { ascending: true })

      if (conversationId) {
        query = query.eq('conversation_id', conversationId)
      } else if (applicantId) {
        query = query.eq('applicant_id', applicantId)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error loading call logs:', error)
        return
      }

      setCallLogs((data || []) as VoiceCallLog[])
    } catch (error) {
      console.error('Error loading call logs:', error)
    } finally {
      setLoading(false)
    }
  }

  // Load call logs on mount
  useEffect(() => {
    loadCallLogs()
  }, [conversationId, applicantId])

  // Real-time subscription for call log updates
  useEffect(() => {
    if (!conversationId && !applicantId) return

    const filter = conversationId 
      ? `conversation_id=eq.${conversationId}`
      : `applicant_id=eq.${applicantId}`

    const channel = supabase
      .channel(`voice-calls-${conversationId || applicantId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'voice_call_logs',
          filter
        },
        (payload) => {
          console.log('Voice call update:', payload)
          
          if (payload.eventType === 'INSERT') {
            setCallLogs(prev => [...prev, payload.new as VoiceCallLog])
          } else if (payload.eventType === 'UPDATE') {
            setCallLogs(prev => 
              prev.map(log => 
                log.id === (payload.new as VoiceCallLog).id 
                  ? payload.new as VoiceCallLog 
                  : log
              )
            )
          } else if (payload.eventType === 'DELETE') {
            setCallLogs(prev => 
              prev.filter(log => log.id !== (payload.old as VoiceCallLog).id)
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, applicantId])

  return { callLogs, loading, refetch: loadCallLogs }
}
