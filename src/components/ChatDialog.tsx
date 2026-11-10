import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, Phone, User, Loader2 } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { SafeImg } from "@/components/ui/safe-image"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { CallMessage } from "./chat/CallMessage"
import { useVoiceCallLogs, VoiceCallLog } from "@/hooks/useVoiceCallLogs"
import { initiateVoiceCall } from "@/services/voiceCallService"

interface ChatMessage {
  id: string
  message: string
  sender_id: string
  sender_type: 'employer' | 'applicant'
  created_at: string
  is_read: boolean
}

interface Conversation {
  id: string
  job_id: string
  employer_id: string
  applicant_id: string
  last_message_at: string
}

interface ApplicantData {
  id: string
  full_name: string
  phone?: string
  profile_image_url?: string
  current_position?: string
}

interface ChatDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  applicant: ApplicantData
  jobId: string
  employerId: string
}

export function ChatDialog({ open, onOpenChange, applicant, jobId, employerId }: ChatDialogProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [calling, setCalling] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  // Voice call logs hook
  const { callLogs } = useVoiceCallLogs({ 
    conversationId: conversation?.id,
    applicantId: applicant.id 
  })

  // Create or get conversation
  const initializeConversation = async () => {
    try {
      setLoading(true)
      
      // First try to get existing conversation
      const { data: existingConv, error: fetchError } = await supabase
        .from('conversations')
        .select('*')
        .eq('job_id', jobId)
        .eq('employer_id', employerId)
        .eq('applicant_id', applicant.id)
        .single()

      if (existingConv) {
        setConversation(existingConv)
        return existingConv.id
      }

      // Create new conversation if none exists
      const { data: newConv, error: createError } = await supabase
        .from('conversations')
        .insert({
          job_id: jobId,
          employer_id: employerId,
          applicant_id: applicant.id
        })
        .select('*')
        .single()

      if (createError) throw createError
      
      setConversation(newConv)
      return newConv.id
    } catch (error) {
      console.error('Error initializing conversation:', error)
      toast({
        title: "Error",
        description: "Failed to initialize chat. Please try again.",
        variant: "destructive"
      })
      return null
    } finally {
      setLoading(false)
    }
  }

  // Load messages
  const loadMessages = async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (error) throw error
      setMessages((data || []) as ChatMessage[])
      
      // Mark messages as read
      await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', employerId)
    } catch (error) {
      console.error('Error loading messages:', error)
    }
  }

  // Send message
  const sendMessage = async () => {
    if (!newMessage.trim() || !conversation || sending) return

    try {
      setSending(true)
      
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversation.id,
          sender_id: employerId,
          sender_type: 'employer',
          message: newMessage.trim()
        })

      if (error) throw error

      // The Edge Function derives the other participant from this conversation
      // and validates the authenticated sender before sending a push payload.
      try {
        const { error: notificationError } = await supabase.functions.invoke('email-api', {
          body: {
            action: 'send_chat_message_push',
            conversation_id: conversation.id,
            message: newMessage.trim()
          }
        })
        if (notificationError) {
          console.warn('Chat message push notification failed:', notificationError.message)
        }
      } catch (notificationError) {
        console.warn('Chat message push notification failed:', notificationError)
      }

      setNewMessage("")
    } catch (error) {
      console.error('Error sending message:', error)
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive"
      })
    } finally {
      setSending(false)
    }
  }

  // Initialize conversation and messages when dialog opens
  useEffect(() => {
    if (open && applicant.id && jobId && employerId) {
      initializeConversation().then(conversationId => {
        if (conversationId) {
          loadMessages(conversationId)
        }
      })
    }
  }, [open, applicant.id, jobId, employerId])

  // Set up real-time subscription for new messages
  useEffect(() => {
    if (!conversation?.id) return

    const channel = supabase
      .channel(`chat-${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversation.id}`
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage
          setMessages(prev => [...prev, newMsg])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversation?.id])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth'
      })
    }
  }, [messages])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Handle voice call initiation
  const handleVoiceCall = async () => {
    if (!applicant.phone || calling) return

    setCalling(true)
    try {
      const result = await initiateVoiceCall({
        recipientPhone: applicant.phone,
        callerId: employerId,
        conversationId: conversation?.id,
        applicantId: applicant.id
      })

      if (result.success) {
        toast({
          title: "📞 Call Initiated",
          description: `Calling ${applicant.full_name}...`
        })
      } else {
        toast({
          title: "Call Failed",
          description: result.error || "Failed to initiate call",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error initiating call:', error)
      toast({
        title: "Error",
        description: "Failed to initiate call. Please try again.",
        variant: "destructive"
      })
    } finally {
      setCalling(false)
    }
  }

  // Merge messages and call logs for timeline display
  type TimelineItem = 
    | { type: 'message'; data: ChatMessage }
    | { type: 'call'; data: VoiceCallLog }

  const timeline: TimelineItem[] = [
    ...messages.map(m => ({ type: 'message' as const, data: m })),
    ...callLogs.map(c => ({ type: 'call' as const, data: c }))
  ].sort((a, b) => 
    new Date(a.data.created_at).getTime() - new Date(b.data.created_at).getTime()
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md mx-auto h-[600px] flex flex-col">
        <DialogHeader className="flex-shrink-0 pb-4 border-b">
          <DialogTitle className="flex items-center gap-3">
            {applicant.profile_image_url ? (
              <SafeImg
                loading="lazy"
                decoding="async"
                src={applicant.profile_image_url}
                alt={applicant.full_name}
                fallbackSrc=""
                className="w-10 h-10 rounded-full object-cover bg-muted"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <User className="w-5 h-5" />
              </div>
            )}
            <div className="flex-1 text-left">
              <div className="font-semibold">{applicant.full_name}</div>
              {applicant.current_position && (
                <div className="text-sm text-muted-foreground">{applicant.current_position}</div>
              )}
            </div>
            {applicant.phone && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleVoiceCall}
                disabled={calling}
                className="flex-shrink-0"
                title="Voice Call"
              >
                {calling ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Phone className="w-4 h-4" />
                )}
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea 
          ref={scrollAreaRef}
          className="flex-1 px-4 py-2"
        >
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-muted-foreground">Loading messages...</div>
            </div>
          ) : timeline.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-center text-muted-foreground">
                <div>No messages yet</div>
                <div className="text-sm">Start the conversation!</div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {timeline.map((item) => {
                if (item.type === 'call') {
                  const call = item.data
                  return (
                    <CallMessage
                      key={`call-${call.id}`}
                      callType={call.call_type}
                      status={call.status}
                      durationSeconds={call.duration_seconds}
                      createdAt={call.created_at}
                      isOwn={call.caller_id === employerId}
                    />
                  )
                }
                
                const message = item.data
                return (
                  <div
                    key={`msg-${message.id}`}
                    className={`flex ${message.sender_type === 'employer' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] px-3 py-2 rounded-lg ${
                        message.sender_type === 'employer'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <div className="text-sm">{message.message}</div>
                      <div className={`text-xs mt-1 ${
                        message.sender_type === 'employer' 
                          ? 'text-primary-foreground/70' 
                          : 'text-muted-foreground'
                      }`}>
                        {format(new Date(message.created_at), 'HH:mm')}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>

        <div className="flex-shrink-0 border-t pt-4">
          <div className="flex gap-2">
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading || sending}
              className="flex-1"
            />
            <Button 
              onClick={sendMessage}
              disabled={!newMessage.trim() || loading || sending}
              size="icon"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}