import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"

interface Conversation {
  id: string
  job_id: string
  employer_id: string
  applicant_id: string
  last_message_at: string
  unread_count?: number
  applicant?: {
    full_name: string
    profile_image_url?: string
    current_position?: string
  }
  job?: {
    title: string
  }
}

export function useConversations(employerId?: string) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  const fetchConversations = async () => {
    if (!employerId) return

    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('employer_id', employerId)
        .order('last_message_at', { ascending: false })

      if (error) throw error

      // Get unread message counts and additional data for each conversation
      const conversationsWithUnread = await Promise.all(
        (data || []).map(async (conv) => {
          const { count } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .eq('is_read', false)
            .neq('sender_id', employerId)

          // Get applicant profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, profile_image_url, current_position')
            .eq('user_id', conv.applicant_id)
            .single()

          // Get job details
          const { data: job } = await supabase
            .from('jobs')
            .select('title')
            .eq('id', conv.job_id)
            .single()

          return {
            ...conv,
            unread_count: count || 0,
            applicant: profile || { full_name: 'Unknown', profile_image_url: undefined, current_position: undefined },
            job: job || { title: 'Unknown Position' }
          }
        })
      )

      setConversations(conversationsWithUnread)
    } catch (error) {
      console.error('Error fetching conversations:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConversations()
  }, [employerId])

  // Set up real-time subscription for conversation updates
  useEffect(() => {
    if (!employerId) return

    const channel = supabase
      .channel('conversations-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `employer_id=eq.${employerId}`
        },
        () => {
          fetchConversations()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages'
        },
        () => {
          fetchConversations()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [employerId])

  return { conversations, loading, refetch: fetchConversations }
}