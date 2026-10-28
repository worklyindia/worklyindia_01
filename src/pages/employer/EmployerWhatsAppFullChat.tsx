import { leaveWorklyChat, useWidgetBackHandler } from "@/lib/worklyChatReturn";
import WorklyChatHeader from "@/components/chat/WorklyChatHeader";
import WhatsAppChatConnectState from "@/components/employer/whatsapp/WhatsAppChatConnectState";
import { ChatDateSeparator } from '@/components/chat/ChatDateSeparator';
import { startsChatDay } from '@/lib/chatTimestamp';
import { goBack } from "@/lib/goBack";
import { messageBelongsToChat } from "@/lib/whatsappChatScope";
import { employerScope } from "@/components/employer/whatsapp/selectedNumber";
import { CHAT_AUDIENCE, isWhatsAppTemplateForAudience, type WhatsAppAudience } from "@/lib/whatsappAudience";
import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
// Native scroll used for better mobile touch experience
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  ArrowLeft, Send, Search, MessageSquare, Clock, User, Building2,
  Phone, RefreshCw, AlertCircle, Plus, Briefcase, Paperclip, ArrowUp, Loader2, Mic,
  Check, CheckCheck, FileText, Camera, Video, LayoutTemplate,
  Trash2, Star, Reply, Forward, Copy, X, Languages, CircleUserRound
} from "lucide-react";
import { WhatsAppCallScreen } from "@/components/whatsapp/WhatsAppCallScreen";
import { useWhatsAppCall } from "@/hooks/useWhatsAppCall";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { formatDistanceToNow, format, isAfter, differenceInMinutes } from "date-fns";
import { ContactSidebar } from "@/components/whatsapp/ContactSidebar";
import { JobShareDialog } from "@/components/whatsapp/JobShareDialog";
import { EmployerNewChatDialog } from "@/components/employer/whatsapp/EmployerNewChatDialog";
import { MediaTypeIcon } from "@/components/whatsapp/MediaPreview";
import { WhatsAppMessageBubble } from "@/components/whatsapp/WhatsAppMessageBubble";
// TemplatePicker moved to dedicated page
import { WhatsAppEmojiPicker } from "@/components/whatsapp/WhatsAppEmojiPicker";
import { WhatsAppAttachmentMenu } from "@/components/whatsapp/WhatsAppAttachmentMenu";
import { MediaUploadPreview } from "@/components/whatsapp/MediaUploadPreview";
import { ComposerWaveform } from "@/components/ai-chat/ComposerWaveform";
import { useVoiceCallLogs, VoiceCallLog } from "@/hooks/useVoiceCallLogs";
import { CallMessage } from "@/components/chat/CallMessage";
import { WhatsAppAudioPlayer } from "@/components/whatsapp/WhatsAppAudioPlayer";
import { WhatsAppDocumentPreview } from "@/components/whatsapp/WhatsAppDocumentPreview";
import { MessageStatusIcon } from "@/components/whatsapp/MessageStatusIcon";
import { MessageSelectionToolbar } from "@/components/whatsapp/MessageSelectionToolbar";
import { ReactionPicker } from "@/components/whatsapp/MessageReactions";
import { DeleteMessagesDialog } from "@/components/whatsapp/dialogs/DeleteMessagesDialog";
import { ClearChatDialog } from "@/components/whatsapp/dialogs/ClearChatDialog";
import { ForwardMessageDialog } from "@/components/whatsapp/dialogs/ForwardMessageDialog";
import MessageContextMenu from "@/components/MessageContextMenu";
import TranslateDialog from "@/components/chat/TranslateDialog";
import { getOptimizedInterval, shouldEnableRealtime } from "@/hooks/useEgressProtection";
import { cleanupWhatsAppMedia, deleteFolder, STORAGE_BUCKETS } from "@/utils/storageCleanup";
import { cleanupConversationMedia } from '@/lib/whatsappMediaCleanup';
import { uploadToR2 } from "@/lib/r2Media";

/** Meta accepts only JPEG/PNG images (max 5 MB). Re-encode anything else (WebP, HEIC, large files) to JPEG. */
async function toWhatsAppImage(file: File): Promise<File> {
  const ok = (file.type === 'image/jpeg' || file.type === 'image/png') && file.size <= 4.5 * 1024 * 1024;
  if (ok) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[a-z0-9]+$/i, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
import { useStackedComposer } from "@/hooks/useStackedComposer";



import LottieSearchIcon from "@/components/LottieSearchIcon";
import MetaSocialChat from "@/components/social/MetaSocialChat";
import { ChatAccountAvatar, useChatAccountProfile } from "@/components/social/ChatAccountProfile";

interface LinkedProfile {
  profile_image_url: string | null;
  full_name: string | null;
}

interface Conversation {
  company_id?: string | null;
  whatsapp_phone_number_id?: string | null;
  id: string;
  phone_number: string;
  contact_name: string | null;
  contact_type: string;
  audience?: string | null;
  last_message_at: string;
  last_message_preview: string | null;
  unread_count: number;
  session_expires_at: string | null;
  is_active: boolean;
  linked_user_id: string | null;
  linked_profile?: LinkedProfile | null;
}

/** Which WhatsApp number (audience) a conversation belongs to. */
function conversationAudience(_conv?: { audience?: string | null; contact_type?: string | null } | null): WhatsAppAudience {
  return CHAT_AUDIENCE;
}

interface MessageReaction {
  id: string;
  message_id: string;
  emoji: string;
  user_id: string | null;
  user_phone: string | null;
  user_name: string | null;
  created_at: string;
}

interface Message {
  company_id?: string | null;
  audience?: string | null;
  whatsapp_phone_number_id?: string | null;
  id: string;
  conversation_id: string | null;
  recipient_phone: string | null;
  direction: string;
  message_content: string | null;
  message_type: string;
  template_name: string;
  template_variables: Record<string, any>;
  status: string;
  created_at: string;
  sent_at: string | null;
  metadata?: Record<string, any>;
  is_starred?: boolean;
  reply_to_message_id?: string | null;
  reactions?: MessageReaction[];
  msg91_message_id?: string | null;
}

// Format time to 12-hour with AM/PM
const formatTime12Hour = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

/** Employer-scoped replacement: every send goes out from the company's own number. */
async function waInvoke(_fn: string, { body }: { body: Record<string, unknown> }) {
  const { audience: _a, ...rest } = body as any;
  return supabase.functions.invoke('workly-india', { body: { ...employerScope(), ...rest } });
}

export default function EmployerWhatsAppFullChat({ companyId, phoneNumberId = null, isDefaultNumber = true, onConnected = () => {} }: { companyId: string; phoneNumberId?: string | null; isDefaultNumber?: boolean; onConnected?: () => void }) {
  const navigate = useNavigate();
  const { phoneNumber: routePhoneNumber } = useParams<{ phoneNumber?: string }>();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  useWidgetBackHandler(() => {
    if (!selectedConversation) return false;
    setSelectedConversation(null);
    return true;
  });
  const [newMessage, setNewMessage] = useState("");
  const { inputRef: waInputRef, mirrorRef: waMirrorRef, expanded: waExpanded } = useStackedComposer(newMessage, { inlineControlsWidth: 88 });
  const [searchQuery, setSearchQuery] = useState("");
  const [channel, setChannel] = useState<"whatsapp" | "instagram" | "facebook">(() => {
    const c = searchParams.get("channel");
    return c === "instagram" || c === "facebook" ? c : "whatsapp";
  });
  const chatProfile = useChatAccountProfile(channel, phoneNumberId);
  const profilePath = channel === "whatsapp" ? "/employer/workly-chat/business-profile" : `/employer/${channel}/profile${chatProfile.account ? `?account=${encodeURIComponent(chatProfile.account.id)}` : ""}`;
  const [showSidebar, setShowSidebar] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showJobShare, setShowJobShare] = useState(false);
  // Template picker now handled via navigation
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isUserScrolling = useRef(false);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // WhatsApp Call hook
  const { callState, initiateCall, endCall, closeCallScreen } = useWhatsAppCall();
  
  
  // Live timer state
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState<string | null>(null);
  
  // Media upload state
  const [selectedMedia, setSelectedMedia] = useState<{ file: File; type: 'image' | 'document' | 'audio' | 'video' } | null>(null);
  const [sendingMedia, setSendingMedia] = useState(false);

  // Voice recording state (like AI Career Chat)
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<'listening' | 'processing' | 'complete'>('listening');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceStream, setVoiceStream] = useState<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const discardRecordingRef = useRef(false);

  // Message selection state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showClearChatDialog, setShowClearChatDialog] = useState(false);
  const [showForwardDialog, setShowForwardDialog] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [reactionMessageId, setReactionMessageId] = useState<string | null>(null);
  const [showTranslateDialog, setShowTranslateDialog] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Double-click to star state
  const clickCount = useRef(0);
  const clickTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Reply state - WhatsApp style
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  // Conversation selection state (for bulk delete)
  const [isConversationSelectionMode, setIsConversationSelectionMode] = useState(false);
  const [selectedConversations, setSelectedConversations] = useState<Set<string>>(new Set());
  const conversationLongPressTimer = useRef<NodeJS.Timeout | null>(null);
  const conversationTouchStartPos = useRef<{ x: number; y: number } | null>(null);
  const [deletingConversations, setDeletingConversations] = useState(false);
  
  // Refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  
  // Free-plan mode: disable automatic polling; users can refresh manually.
  const handoffInterval = getOptimizedInterval(60000, 120000);
  const messageInterval = getOptimizedInterval(10000, 60000);
  
  // Fetch human handoffs for filtering
  const { data: humanHandoffs = [] } = useQuery({
    queryKey: ['whatsapp-human-handoffs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('whatsapp_human_handoff')
        .select('phone_number, expires_at')
        .gte('expires_at', new Date().toISOString());
      const audience = CHAT_AUDIENCE;
      return (data || []).filter((template: any) => template.is_active === true && String(template.status || "").toUpperCase() === "APPROVED" && isWhatsAppTemplateForAudience(template.name, audience));
    },
    refetchInterval: handoffInterval, // Was 30s, now adaptive (60s-120s)
    refetchOnWindowFocus: false,
  });

  // Fetch WhatsApp templates for rendering template messages (both WhatsApp numbers)
  const { data: templates = [] } = useQuery({
    queryKey: ['whatsapp-templates-for-chat'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .select('name, display_name, content_preview, header_type, header_content, footer, buttons, variables, status, is_active');
      if (error) throw error;
      return (data || []).filter((template: any) => template.is_active === true && String(template.status || "").toUpperCase() === "APPROVED" && isWhatsAppTemplateForAudience(template.name, CHAT_AUDIENCE));
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Create a map for quick template lookup
  const templatesMap = useMemo(() => {
    const map: Record<string, typeof templates[0]> = {};
    templates.forEach(t => { map[t.name] = t; });
    return map;
  }, [templates]);

  // Helper to extract string value from variable (handles both string and object formats)
  // Variables can be stored as: "123456" or { type: "text", value: "123456" }
  const extractVariableValue = (variable: any): string => {
    if (variable === null || variable === undefined) return '';
    if (typeof variable === 'string') return variable;
    if (typeof variable === 'number' || typeof variable === 'boolean') return String(variable);
    if (typeof variable === 'object') {
      // WhatsApp format: { type: "text", value: "123456" }
      if (variable.value !== undefined) return extractVariableValue(variable.value);
      if (variable.text !== undefined) return extractVariableValue(variable.text);
      if (variable.name !== undefined) return extractVariableValue(variable.name);
    }
    return '';
  };

  // Function to build enriched template metadata with variables replaced
  const buildTemplateMetadata = (msg: Message) => {
    if (!msg.template_name || msg.template_name === 'free_text_reply' || msg.template_name === 'media_message') {
      return msg.metadata;
    }
    
    const template = templatesMap[msg.template_name];
    if (!template) return msg.metadata;
    
    // Get variables from message - could be in template_variables or metadata
    const variables = msg.template_variables || msg.metadata || {};
    
    // Replace {{1}}, {{2}}, etc. with actual values
    const replaceVariables = (text: string | null) => {
      if (!text) return text;
      let result = text;
      // Replace numbered variables {{1}}, {{2}}, etc.
      result = result.replace(/\{\{(\d+)\}\}/g, (match, num) => {
        const key = `body_${num}`;
        const value = variables[key] || variables[`var_${num}`];
        return value ? extractVariableValue(value) : match;
      });
      // Also check for named variables like {{name}}, {{otp}}
      Object.entries(variables).forEach(([key, value]) => {
        const stringValue = extractVariableValue(value);
        if (stringValue) {
          result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'gi'), stringValue);
        }
      });
      return result;
    };
    
    // Build template_components array for WhatsAppMessageBubble
    const components: any[] = [];
    
    // Header component
    if (template.header_type && template.header_content) {
      components.push({
        type: 'HEADER',
        format: template.header_type.toUpperCase(),
        text: template.header_type === 'TEXT' ? replaceVariables(template.header_content) : undefined,
        example: template.header_type === 'IMAGE' ? { header_handle: [template.header_content] } : undefined
      });
    }
    
    // Body component
    if (template.content_preview) {
      components.push({
        type: 'BODY',
        text: replaceVariables(template.content_preview)
      });
    }
    
    // Footer component
    if (template.footer) {
      components.push({
        type: 'FOOTER',
        text: template.footer
      });
    }
    
    // Buttons component
    if (template.buttons && Array.isArray(template.buttons) && template.buttons.length > 0) {
      components.push({
        type: 'BUTTONS',
        buttons: template.buttons
      });
    }
    
    return {
      ...msg.metadata,
      is_template: true,
      template_name: msg.template_name,
      template_components: Array.isArray(msg.metadata?.template_components) && msg.metadata.template_components.length
        ? msg.metadata.template_components.map((c: any) => {
            const built = components.find((b) => b.type === c.type);
            if (c.type === 'BODY') return { ...c, text: msg.message_content || built?.text || replaceVariables(c.text) };
            if (c.type === 'HEADER' && c.format === 'TEXT') return { ...c, text: built?.text || replaceVariables(c.text) };
            return c;
          })
        : components
    };
  };

  // Fetch conversations with profile images
  const { data: conversations = [], isLoading: loadingConversations, refetch: refetchConversations } = useQuery({
    queryKey: ['whatsapp-conversations', companyId, phoneNumberId],
    queryFn: async () => {
      if (!phoneNumberId) return [];
      const convQuery = supabase
        .from('whatsapp_conversations')
        .select('*')
        .eq('company_id', companyId)
        .eq('whatsapp_phone_number_id', phoneNumberId);
      const { data: convData, error: convError } = await convQuery
        .order('last_message_at', { ascending: false });

      if (convError) throw convError;
      
      // Get linked user IDs that exist
      const linkedUserIds = convData
        .filter(c => c.linked_user_id)
        .map(c => c.linked_user_id) as string[];
      
      // Fetch profiles for linked users
      let profilesMap: Record<string, LinkedProfile> = {};
      if (linkedUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, profile_image_url, full_name')
          .in('user_id', linkedUserIds);
        
        if (profiles) {
          profilesMap = profiles.reduce((acc, p) => {
            acc[p.user_id] = { profile_image_url: p.profile_image_url, full_name: p.full_name };
            return acc;
          }, {} as Record<string, LinkedProfile>);
        }
      }
      
      // Merge conversations with profiles
      return convData.map(conv => ({
        ...conv,
        linked_profile: conv.linked_user_id ? profilesMap[conv.linked_user_id] || null : null
      })) as Conversation[];
    },
  });

  // Fetch messages for selected conversation with reactions
  const { data: messages = [], isLoading: loadingMessages } = useQuery({
    queryKey: ['whatsapp-messages', selectedConversation?.id, selectedConversation?.phone_number, companyId, phoneNumberId],
    queryFn: async () => {
      if (!selectedConversation) return [];
      
      // Fetch messages
      const { data: messagesData, error: messagesError } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('company_id', companyId)
        .eq('whatsapp_phone_number_id', phoneNumberId || '')
        .or(`conversation_id.eq.${selectedConversation.id},and(conversation_id.is.null,recipient_phone.eq.${selectedConversation.phone_number})`)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;
      
      // Fetch reactions for these messages
      const messageIds = messagesData?.map(m => m.id) || [];
      let reactionsMap: Record<string, MessageReaction[]> = {};
      
      if (messageIds.length > 0) {
        const { data: reactionsData } = await supabase
          .from('whatsapp_message_reactions')
          .select('*')
          .in('message_id', messageIds);
        
        if (reactionsData) {
          reactionsData.forEach(r => {
            if (!reactionsMap[r.message_id]) {
              reactionsMap[r.message_id] = [];
            }
            reactionsMap[r.message_id].push(r as MessageReaction);
          });
        }
      }
      
      // Merge reactions with messages
      return (messagesData || []).filter(msg => msg.message_type !== 'reaction').map(msg => ({
        ...msg,
        reactions: reactionsMap[msg.id] || []
      })) as Message[];
    },
    enabled: !!selectedConversation && !!phoneNumberId,
    refetchInterval: messageInterval, // Was 5s, now adaptive (10s-60s)
    refetchOnWindowFocus: false,
  });

  // Fetch voice call logs for selected conversation
  const { callLogs } = useVoiceCallLogs({
    conversationId: selectedConversation?.id,
  });

  // Merge messages and call logs into a unified timeline
  type TimelineItem = 
    | { type: 'message'; data: Message; timestamp: string }
    | { type: 'call'; data: VoiceCallLog; timestamp: string };

  const timeline = useMemo(() => {
    const items: TimelineItem[] = [];
    
    // Add messages
    messages.forEach(msg => {
      items.push({ type: 'message', data: msg, timestamp: msg.created_at });
    });
    
    // Add call logs
    callLogs.forEach(call => {
      items.push({ type: 'call', data: call, timestamp: call.created_at });
    });
    
    // Sort by timestamp
    items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    return items;
  }, [messages, callLogs]);

  const sendMessageMutation = useMutation({
    mutationFn: async ({ phone_number, message, conversation_id, reply_to_message_id, reply_to_wa_message_id }: { phone_number: string; message: string; conversation_id?: string; reply_to_message_id?: string | null; reply_to_wa_message_id?: string | null }) => {
      const response = await waInvoke('whatsapp-cloud-api', {
        body: { audience: conversationAudience(selectedConversation) ?? undefined, action: 'send_reply', phone_number, message, conversation_id, reply_to_message_id, reply_to_wa_message_id }
      });

      if (response.error) throw response.error;
      if (!response.data?.success) throw new Error(response.data?.error || 'Failed to send message');
      
      return response.data;
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', selectedConversation?.id] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
      toast.success("Message sent!");
    },
    onError: (error: any) => {
      if (error.message?.includes('session expired')) {
        toast.error("24-hour session expired. Use template message instead.");
      } else {
        toast.error(error.message || "Failed to send message");
      }
    },
  });

  // Mark conversation as read
  const markAsRead = async (conversationId: string) => {
    await supabase
      .from('whatsapp_conversations')
      .update({ unread_count: 0 })
      .eq('id', conversationId);
  };

  // Real-time subscription for messages, status updates, and reactions - instant updates
  useEffect(() => {
    // Owner chat always stays live (global low-bandwidth guard must not block it)

    const channel = supabase
      .channel(`employer-wa-chat-${companyId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' }, (payload) => {
        // Instantly add new message to cache without refetch
        const newMsg = payload.new as Message;
        if (selectedConversation && messageBelongsToChat(newMsg, selectedConversation)) {
          queryClient.setQueryData(
            ['whatsapp-messages', selectedConversation.id, selectedConversation.phone_number, companyId, phoneNumberId],
            (old: Message[] = []) => newMsg.message_type === 'reaction' || old.some(m => m.id === newMsg.id)
              ? old
              : [...old, { ...newMsg, reactions: [] }]
          );
        }
        // Update conversation list
        // Incoming customer message restarts the 24h window instantly
        if (['inbound', 'incoming'].includes(newMsg.direction) && newMsg.message_type !== 'reaction') {
          const expires = new Date(new Date(newMsg.created_at || Date.now()).getTime() + 24 * 60 * 60 * 1000).toISOString();
          setSelectedConversation(prev => prev && messageBelongsToChat(newMsg, prev)
            ? { ...prev, session_expires_at: expires } : prev);
        }
        queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'whatsapp_messages' }, (payload) => {
        // Update tick marks when status changes (sent → delivered → read)
        const updatedMsg = payload.new as Message;
        if (selectedConversation && messageBelongsToChat(updatedMsg, selectedConversation)) {
          queryClient.setQueryData(
            ['whatsapp-messages', selectedConversation.id, selectedConversation.phone_number, companyId, phoneNumberId],
            (old: Message[] = []) => old.map(msg => msg.id === updatedMsg.id ? { ...updatedMsg, reactions: msg.reactions || [] } : msg)
          );
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_conversations' }, (payload) => {
        const row = payload.new as Partial<Conversation> | undefined;
        // Keep the open chat (header 24h timer) in sync with the database
        if (row?.id) {
          setSelectedConversation(prev => prev && prev.id === row.id ? { ...prev, ...row } as Conversation : prev);
        }
        queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
      })
      // Real-time reactions - instant update when someone reacts
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_message_reactions' }, (payload) => {
        const newReaction = payload.new as MessageReaction;
        if (selectedConversation) {
          queryClient.setQueryData(
            ['whatsapp-messages', selectedConversation.id, selectedConversation.phone_number, companyId, phoneNumberId],
            (old: Message[] = []) => old.map(msg => {
              if (msg.id === newReaction.message_id) {
                const existingReactions = msg.reactions || [];
                // Remove old reaction from same user, add new one
                const filteredReactions = existingReactions.filter(r => r.user_id !== newReaction.user_id);
                return { ...msg, reactions: [...filteredReactions, newReaction] };
              }
              return msg;
            })
          );
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'whatsapp_message_reactions' }, (payload) => {
        const updatedReaction = payload.new as MessageReaction;
        if (selectedConversation) {
          queryClient.setQueryData(
            ['whatsapp-messages', selectedConversation.id, selectedConversation.phone_number, companyId, phoneNumberId],
            (old: Message[] = []) => old.map(msg => {
              if (msg.id === updatedReaction.message_id) {
                const existingReactions = msg.reactions || [];
                return { ...msg, reactions: existingReactions.map(r => r.id === updatedReaction.id ? updatedReaction : r) };
              }
              return msg;
            })
          );
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'whatsapp_message_reactions' }, (payload) => {
        const deletedReaction = payload.old as MessageReaction;
        if (selectedConversation) {
          queryClient.setQueryData(
            ['whatsapp-messages', selectedConversation.id, selectedConversation.phone_number, companyId, phoneNumberId],
            (old: Message[] = []) => old.map(msg => {
              if (msg.id === deletedReaction.message_id) {
                const existingReactions = msg.reactions || [];
                return { ...msg, reactions: existingReactions.filter(r => r.id !== deletedReaction.id) };
              }
              return msg;
            })
          );
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient, selectedConversation, companyId, phoneNumberId]);

  // Smart scroll to bottom - only when user is at bottom or new message sent
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior
      });
    }
  };

  // Check if user is near bottom (within 100px)
  const isNearBottom = () => {
    if (!messagesContainerRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    return scrollHeight - scrollTop - clientHeight < 100;
  };

  // Handle scroll events to detect user scrolling
  const handleScroll = () => {
    isUserScrolling.current = true;
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      isUserScrolling.current = false;
    }, 150);
  };

  // Auto-scroll when new messages arrive (only if user is at bottom)
  useEffect(() => {
    if (messages.length > 0 && !isUserScrolling.current && isNearBottom()) {
      scrollToBottom();
    }
  }, [messages]);

  // Initial scroll to bottom when conversation loads or messages first load
  useEffect(() => {
    if (selectedConversation && messages.length > 0) {
      // Use multiple attempts to ensure scroll happens after render
      scrollToBottom('instant');
      setTimeout(() => scrollToBottom('instant'), 50);
      setTimeout(() => scrollToBottom('instant'), 200);
      setTimeout(() => scrollToBottom('instant'), 500);
    }
  }, [selectedConversation?.id, messages.length > 0]);

  // Auto-select conversation from route parameter (for URL persistence on refresh)
  useEffect(() => {
    if (routePhoneNumber && conversations.length > 0 && !selectedConversation) {
      const decodedPhone = decodeURIComponent(routePhoneNumber);
      const routeAudience = searchParams.get('audience');
      const conv = conversations.find(c => c.phone_number === decodedPhone && (!routeAudience || conversationAudience(c) === routeAudience));
      if (conv) {
        setSelectedConversation(conv);
        if (conv.unread_count > 0) markAsRead(conv.id);
      } else {
        // Phone not in existing conversations - create new conversation view
        // For now, just redirect to chat list
        console.log('Phone number not found in conversations:', decodedPhone);
      }
    }
  }, [routePhoneNumber, conversations, selectedConversation, searchParams]);

  // Handle scrollTo from starred messages page - highlight message
  useEffect(() => {
    const scrollToId = searchParams.get('scrollTo');
    if (scrollToId && messages.length > 0) {
      // Wait for render then scroll
      setTimeout(() => {
        const element = document.getElementById(`message-${scrollToId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Add highlight animation
          element.classList.add('ring-2', 'ring-yellow-400', 'animate-pulse');
          setTimeout(() => {
            element.classList.remove('ring-2', 'ring-yellow-400', 'animate-pulse');
          }, 3000);
        }
      }, 100);
    }
  }, [searchParams, messages]);

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    if (conversation.unread_count > 0) markAsRead(conversation.id);
    // Update URL to persist state on refresh
    const audience = conversationAudience(conversation);
    void audience; navigate(`/employer/workly-chat/chat/${encodeURIComponent(conversation.phone_number)}`, { replace: true });
  };

  // Handle back to list - clear URL parameter
  const handleBackToList = () => {
    setSelectedConversation(null);
    navigate('/employer/workly-chat', { replace: true });
  };

  const handleSendMessage = async () => {
    if (sendingMedia || sendMessageMutation.isPending) return;
    if (selectedMedia) {
      await handleSendMedia(newMessage.trim() || undefined);
      return;
    }
    if (!newMessage.trim() || !selectedConversation) return;
    
    // Capture reply state BEFORE mutation (fix race condition)
    const currentReplyingTo = replyingTo;
    
    // Send the message with reply_to_text for visual reply formatting
    sendMessageMutation.mutate({
      phone_number: selectedConversation.phone_number,
      message: newMessage,
      conversation_id: selectedConversation.id,
      reply_to_message_id: currentReplyingTo?.id || null,
      reply_to_wa_message_id: currentReplyingTo?.msg91_message_id || null,
    }, {
      onSuccess: () => {
        setReplyingTo(null);
      }
    });
    
    // Clear input immediately but NOT replyingTo (that's cleared in onSuccess)
    setNewMessage("");
  };

  const handleQuickReply = (message: string) => {
    setNewMessage(message);
  };

  const handleJobShare = (message: string) => {
    if (!selectedConversation) return;
    sendMessageMutation.mutate({
      phone_number: selectedConversation.phone_number,
      message,
      conversation_id: selectedConversation.id
    });
  };

  const handleEmojiSelect = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
  };

  const handleVoiceTranscript = (text: string) => {
    setNewMessage(text);
  };

  // Start voice recording (like AI Career Chat)
  const startVoiceRecording = async () => {
    try {
      setIsVoiceRecording(true);
      setVoiceStatus('listening');
      setVoiceTranscript('');

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setVoiceStream(stream);
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        setVoiceStream(null);

        // Recording cancelled — throw the audio away instead of transcribing it
        if (discardRecordingRef.current) {
          discardRecordingRef.current = false;
          setIsVoiceRecording(false);
          setIsVoiceProcessing(false);
          setVoiceStatus('listening');
          setVoiceTranscript('');
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        
        reader.onloadend = async () => {
          try {
            setVoiceStatus('processing');
            setIsVoiceProcessing(true);
            const base64Audio = (reader.result as string).split(',')[1];
            
            console.log('📤 Sending audio to voice-to-text (FREE unlimited endpoint)...');
            
            const { data, error } = await supabase.functions.invoke('unified-voice', {
              body: { action: 'speech-to-text', audio: base64Audio }
            });

            console.log('📥 Voice-to-text response:', { data, error });

            if (error) {
              console.error('❌ Function invocation error:', error);
              throw new Error(error.message || 'Transcription failed');
            }

            // Check for error in response body (API can return 200 with error)
            if (data?.error) {
              console.error('❌ API returned error:', data.error);
              throw new Error(data.error);
            }

            if (data?.text) {
              console.log('✅ Transcription received:', data.text);
              setVoiceTranscript(data.text);
              setVoiceStatus('complete');
              
              // Show completion briefly, then put text in input
              setTimeout(() => {
                setNewMessage(data.text);
                setIsVoiceRecording(false);
                setIsVoiceProcessing(false);
              }, 800);
            } else {
              throw new Error('No transcription text received');
            }
          } catch (error: any) {
            console.error('❌ Transcription error:', error);
            toast.error(error?.message || 'Voice transcription failed');
            setIsVoiceRecording(false);
            setIsVoiceProcessing(false);
          }
        };

        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.start();

      // Auto-stop after 5 seconds (like AI Career Chat)
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, 5000);

    } catch (error) {
      console.error('Voice recording error:', error);
      setIsVoiceRecording(false);
      toast.error('Microphone access denied');
    }
  };

  // Stop voice recording manually
  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (voiceStream) {
      voiceStream.getTracks().forEach(track => track.stop());
      setVoiceStream(null);
    }
  };

  // Cancel recording like AI Career Chat — discard the audio, don't transcribe
  const cancelVoiceRecording = () => {
    discardRecordingRef.current = true;
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    } else {
      // Transcription already in flight — just drop the recording UI
      discardRecordingRef.current = false;
      setIsVoiceRecording(false);
      setIsVoiceProcessing(false);
      setVoiceStatus('listening');
      setVoiceTranscript('');
    }
    if (voiceStream) {
      voiceStream.getTracks().forEach(track => track.stop());
      setVoiceStream(null);
    }
  };

  // Media upload handler
  const handleMediaSelect = (file: File, type: 'image' | 'document' | 'audio' | 'video') => {
    setSelectedMedia({ file, type });
  };

  const handleSendMedia = async (caption?: string) => {
    if (!selectedMedia || !selectedConversation) return;
    
    setSendingMedia(true);
    try {
      // Upload via Cloudinary auto-resource (handles image/doc/audio/video) — saves Supabase egress
      const fileToSend = selectedMedia.type === 'image' ? await toWhatsAppImage(selectedMedia.file) : selectedMedia.file;
      const fileExt = fileToSend.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const { url: mediaUrl } = await uploadToR2(fileToSend, 'chat-whatsapp');
      const urlData = { publicUrl: mediaUrl };
      
      // Send via WhatsApp
      const response = await waInvoke('whatsapp-cloud-api', {
        body: {
          audience: conversationAudience(selectedConversation) ?? undefined,
          action: 'send_media',
          phone_number: selectedConversation.phone_number,
          media_url: urlData.publicUrl,
          media_type: selectedMedia.type,
          conversation_id: selectedConversation.id,
          caption: caption // Pass caption for images
        }
      });
      
      if (response.error) throw response.error;
      if (!response.data?.success) throw new Error(response.data?.error || 'Failed to send media');
      
      toast.success(`${selectedMedia.type.charAt(0).toUpperCase() + selectedMedia.type.slice(1)} sent!`);
      setSelectedMedia(null);
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', selectedConversation.id] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
    } catch (error: any) {
      console.error('Error sending media:', error);
      toast.error(error.message || 'Failed to send media');
    } finally {
      setSendingMedia(false);
    }
  };

  const handleStartNewChat = async (phone: string, name: string, type: string, userId?: string) => {
    if (!phoneNumberId) { toast.error("Connect a WhatsApp number first"); return; }
    const normalizedPhone = phone.replace(/^\+/, '').replace(/\D/g, '');
    
    const existing = conversations.find(c => c.phone_number === normalizedPhone);
    if (existing) {
      setSelectedConversation(existing);
      setShowNewChat(false);
      return;
    }

    const { data, error } = await supabase
      .from('whatsapp_conversations')
      .insert({
        phone_number: normalizedPhone,
        contact_name: name || null,
        contact_type: type,
        linked_user_id: userId || null,
        last_message_at: new Date().toISOString(),
        last_message_preview: null,
        unread_count: 0,
        company_id: companyId,
        whatsapp_phone_number_id: phoneNumberId,
        audience: null,
      } as any)
      .select()
      .single();

    if (error) {
      toast.error("Failed to create conversation");
      return;
    }

    await refetchConversations();
    setSelectedConversation(data as Conversation);
    toast.success("New chat started!");
  };

  const isSessionActive = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return isAfter(new Date(expiresAt), new Date());
  };

  const calculateTimeRemaining = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const expires = new Date(expiresAt);
    if (!isAfter(expires, new Date())) return null;
    const totalSeconds = Math.max(0, Math.floor((expires.getTime() - new Date().getTime()) / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Live timer effect - updates every second
  useEffect(() => {
    if (!selectedConversation?.session_expires_at) {
      setSessionTimeRemaining(null);
      return;
    }

    // Initial calculation
    setSessionTimeRemaining(calculateTimeRemaining(selectedConversation.session_expires_at));

    // Update every second
    const interval = setInterval(() => {
      const remaining = calculateTimeRemaining(selectedConversation.session_expires_at);
      setSessionTimeRemaining(remaining);
      
      // Stop interval if session expired
      if (!remaining) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [selectedConversation?.session_expires_at]);

  // Handle refresh with loading state
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetchConversations();
    queryClient.invalidateQueries({ queryKey: ['whatsapp-human-handoffs'] });
    setIsRefreshing(false);
    toast.success('Conversations refreshed');
  };

  // Filter conversations by search only
  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter(conv =>
      conv.phone_number.includes(query) ||
      conv.contact_name?.toLowerCase().includes(query)
    );
  }, [conversations, searchQuery]);

  const getContactIcon = (type: string) => {
    switch (type) {
      case 'jobseeker': return <User className="h-4 w-4" />;
      case 'employer': return <Building2 className="h-4 w-4" />;
      default: return <Phone className="h-4 w-4" />;
    }
  };

  const getMessageContent = (msg: Message, enrichedMetadata?: any) => {
    // Return actual content if exists
    if (msg.message_content) return msg.message_content;
    
    // For media messages (image/video/audio/document), return null - they don't need text content
    const mediaTypes = ['image', 'video', 'audio', 'document'];
    if (mediaTypes.includes(msg.message_type) || mediaTypes.includes(msg.metadata?.media_type)) {
      return null;
    }
    
    // For template messages with enriched metadata, get body text from template components
    if (enrichedMetadata?.is_template && enrichedMetadata?.template_components) {
      const bodyComponent = enrichedMetadata.template_components.find((c: any) => c.type === 'BODY');
      if (bodyComponent?.text) {
        return bodyComponent.text;
      }
    }
    
    // Only show template placeholder for actual template messages (not media) - fallback
    if (['outgoing','outbound'].includes(msg.direction) && msg.template_name && msg.template_name !== 'free_text_reply' && msg.template_name !== 'media_message') {
      return `[Template: ${msg.template_name}]`;
    }
    
    return null;
  };

  const getMediaUrl = (msg: Message) => {
    return msg.metadata?.media_url || msg.metadata?.url || msg.metadata?.raw?.[msg.message_type]?.url || null;
  };

  const getMediaType = (msg: Message): 'image' | 'video' | 'document' | 'audio' | null => {
    const storedType = msg.message_type === 'sticker' ? 'image' : msg.message_type;
    const type = ['image', 'video', 'document', 'audio'].includes(storedType) ? storedType : msg.metadata?.media_type;
    if (['image', 'video', 'document', 'audio'].includes(type)) return type as any;
    return null;
  };

  const getStatusIcon = (status: string) => {
    if (status === 'read') return <CheckCheck className="h-3 w-3 text-[#53bdeb]" />;
    if (status === 'delivered') return <CheckCheck className="h-3 w-3 text-[#8696a0]" />;
    if (status === 'sent') return <Check className="h-3 w-3 text-[#8696a0]" />;
    return <Clock className="h-3 w-3 text-[#8696a0]" />; // pending
  };

  // WhatsApp-style avatar colors based on name
  const getAvatarColor = (name: string) => {
    const colors = [
      '#00a884', '#02a698', '#53bdeb', '#7c69ef', '#e862b4',
      '#ef7f3f', '#d4a03c', '#4fad4d', '#5eb5f7', '#ff7b7b'
    ];
    const charCode = (name?.[0] || 'A').toUpperCase().charCodeAt(0);
    return colors[charCode % colors.length];
  };

  // === MESSAGE SELECTION HANDLERS ===
  
  // Double-click to star/unstar message
  const handleMessageDoubleClick = async (messageId: string) => {
    if (isSelectionMode) return;
    
    const message = messages.find(m => m.id === messageId);
    if (!message) return;
    
    const newStarredValue = !message.is_starred;
    
    try {
      await supabase
        .from('whatsapp_messages')
        .update({ is_starred: newStarredValue })
        .eq('id', messageId);
      
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] });
      toast.success(newStarredValue ? 'Message starred' : 'Message unstarred');
    } catch (error) {
      console.error('Error toggling star:', error);
      toast.error('Failed to update star');
    }
  };

  // Handle message click with double-click detection for star
  const handleMessageClick = (messageId: string) => {
    if (isSelectionMode) {
      toggleMessageSelection(messageId);
      return;
    }

    // Double-click detection
    clickCount.current += 1;
    if (clickCount.current === 1) {
      clickTimer.current = setTimeout(() => {
        clickCount.current = 0;
      }, 300);
    } else if (clickCount.current === 2) {
      if (clickTimer.current) clearTimeout(clickTimer.current);
      clickCount.current = 0;
      handleMessageDoubleClick(messageId);
    }
  };
  
  // Long press handler - start selection mode
  const handleMessageLongPress = (messageId: string) => {
    if (navigator.vibrate) navigator.vibrate(50);
    setIsSelectionMode(true);
    setSelectedMessages(new Set([messageId]));
  };

  // Toggle message selection
  const toggleMessageSelection = (messageId: string) => {
    setSelectedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      // Exit selection mode if no messages selected
      if (newSet.size === 0) {
        setIsSelectionMode(false);
      }
      return newSet;
    });
  };

  // Cancel selection
  const handleCancelSelection = () => {
    setIsSelectionMode(false);
    setSelectedMessages(new Set());
  };

  // Check if selected messages have text content
  const hasTextMessages = () => {
    return messages.some(m => selectedMessages.has(m.id) && m.message_content);
  };

  // Delete selected messages
  const handleDeleteMessages = async () => {
    // First, clean up media files from storage for messages with media
    const selectedMsgs = messages.filter(m => selectedMessages.has(m.id));
    for (const msg of selectedMsgs) {
      if (msg.metadata?.media_url) {
        await cleanupWhatsAppMedia(msg.metadata.media_url);
      }
    }
    
    const { error } = await supabase
      .from('whatsapp_messages')
      .delete()
      .in('id', Array.from(selectedMessages));
      
    if (error) {
      toast.error('Failed to delete messages');
      return;
    }
    
    toast.success(`${selectedMessages.size} message(s) deleted`);
    handleCancelSelection();
    queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] });
    setShowDeleteDialog(false);
  };

  // Copy selected messages
  const handleCopy = () => {
    const selectedMsgs = messages.filter(m => selectedMessages.has(m.id));
    const text = selectedMsgs
      .map(m => m.message_content)
      .filter(Boolean)
      .join('\n');
    
    if (text) {
      navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } else {
      toast.error('No text to copy');
    }
    handleCancelSelection();
  };

  // Star selected messages - Save to database
  const handleStar = async () => {
    const messageIds = Array.from(selectedMessages);
    
    try {
      const { error } = await supabase
        .from('whatsapp_messages')
        .update({ is_starred: true })
        .in('id', messageIds);
      
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] });
      toast.success(`${messageIds.length} message(s) starred`);
    } catch (error: any) {
      console.error('Error starring messages:', error);
      toast.error('Failed to star messages');
    }
    handleCancelSelection();
  };

  // Translate selected message
  const handleTranslate = () => {
    if (selectedMessages.size === 1) {
      setShowTranslateDialog(true);
    }
  };

  // Reply to selected message (single only) - WhatsApp style
  const handleReply = () => {
    const msgId = Array.from(selectedMessages)[0];
    const msg = messages.find(m => m.id === msgId);
    if (msg) {
      setReplyingTo(msg);
      handleCancelSelection();
    }
  };
  
  // Cancel reply
  const handleCancelReply = () => {
    setReplyingTo(null);
  };

  // Forward messages - open dialog
  const handleForward = () => {
    setShowForwardDialog(true);
  };

  // React to message
  const handleReact = () => {
    const msgId = Array.from(selectedMessages)[0];
    setReactionMessageId(msgId);
    setShowReactionPicker(true);
  };

  // === CONVERSATION SELECTION HANDLERS ===
  
  // Long press handler - start conversation selection mode
  const handleConversationLongPressStart = (convId: string, e: React.TouchEvent) => {
    // Store starting touch position
    if (e.touches.length > 0) {
      conversationTouchStartPos.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
    }
    
    conversationLongPressTimer.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(50);
      setIsConversationSelectionMode(true);
      setSelectedConversations(new Set([convId]));
    }, 500);
  };

  // Cancel long press if user moves finger (scrolling)
  const handleConversationTouchMove = (e: React.TouchEvent) => {
    if (conversationTouchStartPos.current && e.touches.length > 0) {
      const deltaX = Math.abs(e.touches[0].clientX - conversationTouchStartPos.current.x);
      const deltaY = Math.abs(e.touches[0].clientY - conversationTouchStartPos.current.y);
      
      // If moved more than 10px, user is scrolling - cancel long press
      if (deltaX > 10 || deltaY > 10) {
        if (conversationLongPressTimer.current) {
          clearTimeout(conversationLongPressTimer.current);
          conversationLongPressTimer.current = null;
        }
        conversationTouchStartPos.current = null;
      }
    }
  };

  const handleConversationLongPressEnd = () => {
    conversationTouchStartPos.current = null;
    if (conversationLongPressTimer.current) {
      clearTimeout(conversationLongPressTimer.current);
      conversationLongPressTimer.current = null;
    }
  };

  // Toggle conversation selection
  const toggleConversationSelection = (convId: string) => {
    setSelectedConversations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(convId)) {
        newSet.delete(convId);
      } else {
        newSet.add(convId);
      }
      if (newSet.size === 0) {
        setIsConversationSelectionMode(false);
      }
      return newSet;
    });
  };

  // Select all conversations
  const handleSelectAllConversations = () => {
    setSelectedConversations(new Set(filteredConversations.map(c => c.id)));
  };

  // Cancel conversation selection
  const handleCancelConversationSelection = () => {
    setIsConversationSelectionMode(false);
    setSelectedConversations(new Set());
  };

  // Delete selected conversations with human handoff cleanup
  const handleDeleteSelectedConversations = async () => {
    if (selectedConversations.size === 0) return;
    
    setDeletingConversations(true);
    try {
      // Get phone numbers for selected conversations (for handoff cleanup and media cleanup)
      const selectedPhones = conversations
        .filter(c => selectedConversations.has(c.id))
        .map(c => c.phone_number);
      
      const selectedIds = Array.from(selectedConversations);
      await cleanupConversationMedia(selectedIds, async (ids, from, to) => {
        const { data, error } = await supabase.from('whatsapp_messages').select('metadata').in('conversation_id', ids).order('id').range(from, to);
        if (error) throw error;
        return data || [];
      }, cleanupWhatsAppMedia);
      
      // Clean up media files from storage for each phone number folder
      for (const phone of selectedPhones) {
        await deleteFolder(STORAGE_BUCKETS.WHATSAPP_MEDIA, `${phone}/`);
      }
      
      // Delete messages first
      const { error: msgError } = await supabase
        .from('whatsapp_messages')
        .delete()
        .in('conversation_id', selectedIds);
      
      if (msgError) throw msgError;
      
      // Delete human handoffs for these phone numbers
      if (selectedPhones.length > 0) {
        await supabase
          .from('whatsapp_human_handoff')
          .delete()
          .in('phone_number', selectedPhones);
      }
      
      // Delete conversations
      const { error: convError } = await supabase
        .from('whatsapp_conversations')
        .delete()
        .in('id', selectedIds);
      
      if (convError) throw convError;
      
      toast.success(`${selectedConversations.size} chat(s) deleted`);
      handleCancelConversationSelection();
      
      // Clear selected conversation if it was deleted
      if (selectedConversation && selectedConversations.has(selectedConversation.id)) {
        setSelectedConversation(null);
      }
      
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
    } catch (error: any) {
      console.error('Error deleting conversations:', error);
      toast.error('Failed to delete conversations');
    } finally {
      setDeletingConversations(false);
    }
  };

  // Handle conversation click - either select or open
  const handleConversationClick = (conv: Conversation) => {
    if (isConversationSelectionMode) {
      toggleConversationSelection(conv.id);
    } else {
      handleSelectConversation(conv);
    }
  };

  if (!phoneNumberId) return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-background text-foreground">
      <WorklyChatHeader channel={channel} connected={channel !== "whatsapp" && !!chatProfile.account} picture={chatProfile.picture} name={chatProfile.name} refreshing={isRefreshing}
        onBack={() => leaveWorklyChat(navigate, "/employer-portal")} onRefresh={handleRefresh} onNewChat={() => setShowNewChat(true)}
        onProfile={() => navigate(profilePath)} onTemplates={() => navigate("/employer/workly-chat/templates")}
        onChannel={(nextChannel) => { setChannel(nextChannel); navigate(`/employer/workly-chat?channel=${nextChannel}`, { replace: true }); }} />
      {channel === "whatsapp" ? <WhatsAppChatConnectState onConnected={onConnected} /> : <MetaSocialChat platform={channel} />}
    </div>
  );

  return (
    <div className="fixed inset-0 flex bg-whatsapp-bg text-foreground overflow-hidden">
      {/* Conversation List View */}
      <div className={`min-w-0 min-h-0 flex-col bg-background ${selectedConversation ? 'hidden md:flex md:w-[340px] md:flex-none md:border-r md:border-whatsapp-border' : 'flex flex-1 md:w-[340px] md:flex-none'}`}>
        {/* List Header - WhatsApp Style White / Selection Mode Header */}
        {isConversationSelectionMode ? (
          <div className="bg-whatsapp-bg text-foreground border-b border-border px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-foreground hover:bg-muted h-10 w-10"
                onClick={handleCancelConversationSelection}
              >
                <X className="h-5 w-5" />
              </Button>
              <span className="text-lg font-medium text-foreground">{selectedConversations.size} selected</span>
            </div>
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="sm"
                className="text-foreground hover:bg-muted"
                onClick={handleSelectAllConversations}
              >
                Select All
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-foreground hover:bg-muted h-10 w-10"
                onClick={handleDeleteSelectedConversations}
                disabled={deletingConversations || selectedConversations.size === 0}
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            </div>
          </div>
        ) : (
          <WorklyChatHeader channel={channel} connected={channel === "whatsapp" ? !!phoneNumberId : !!chatProfile.account} picture={chatProfile.picture} name={chatProfile.name} refreshing={isRefreshing}
            onBack={() => leaveWorklyChat(navigate, "/employer-portal")} onRefresh={handleRefresh} onNewChat={() => setShowNewChat(true)}
            onProfile={() => navigate(profilePath)} onTemplates={() => navigate("/employer/workly-chat/templates")}
            onChannel={(nextChannel) => { setChannel(nextChannel); navigate(`/employer/workly-chat?channel=${nextChannel}`, { replace: true }); }} />
        )}

        {channel !== "whatsapp" && <MetaSocialChat platform={channel} />}
        {/* Search */}
        <div className={`px-3 py-2 bg-background ${channel !== "whatsapp" ? "hidden" : ""}`}>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"><LottieSearchIcon size={16} /></div>
            <Input
              placeholder="Search or start new chat"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-muted border-0 text-foreground placeholder:text-muted-foreground rounded-lg h-10"
            />
          </div>
        </div>
        {/* Conversations - Fixed height for reliable mobile scroll */}
        <div 
          className={`flex-1 min-h-0 overflow-y-auto overscroll-contain bg-background ${channel !== "whatsapp" ? "hidden" : ""}`}
          style={{ 
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            overscrollBehavior: 'contain',
            paddingBottom: 'max(16px, env(safe-area-inset-bottom))'
          }}
        >
          {loadingConversations ? (
            <div className="p-4 text-center text-muted-foreground">Loading...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No conversations</p>
              <Button 
                className="mt-3 bg-whatsapp-green hover:bg-whatsapp-green-dark text-white"
                onClick={() => setShowNewChat(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Start New Chat
              </Button>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => handleConversationClick(conv)}
                onTouchStart={(e) => handleConversationLongPressStart(conv.id, e)}
                onTouchMove={handleConversationTouchMove}
                onTouchEnd={handleConversationLongPressEnd}
                onTouchCancel={handleConversationLongPressEnd}
                onMouseDown={() => {
                  conversationLongPressTimer.current = setTimeout(() => {
                    if (navigator.vibrate) navigator.vibrate(50);
                    setIsConversationSelectionMode(true);
                    setSelectedConversations(new Set([conv.id]));
                  }, 500);
                }}
                onMouseUp={handleConversationLongPressEnd}
                onMouseLeave={handleConversationLongPressEnd}
                className={`flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-muted transition-colors ${
                  selectedConversation?.id === conv.id && !isConversationSelectionMode ? 'bg-muted' : ''
                } ${selectedConversations.has(conv.id) ? 'bg-foreground/10' : ''}`}
              >
                {/* Selection Checkbox */}
                {isConversationSelectionMode && (
                  <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    selectedConversations.has(conv.id) 
                      ? 'bg-foreground border-foreground' 
                      : 'border-muted-foreground'
                  }`}>
                    {selectedConversations.has(conv.id) && (
                      <Check className="h-3 w-3 text-background" />
                    )}
                  </div>
                )}
                <Avatar className="h-12 w-12 flex-shrink-0">
                  {conv.linked_profile?.profile_image_url && (
                    <AvatarImage 
                      src={conv.linked_profile.profile_image_url} 
                      alt={conv.contact_name || 'Contact'}
                      className="object-cover"
                    />
                  )}
                  <AvatarFallback className="bg-whatsapp-green text-white text-lg">
                    {(conv.contact_name?.[0] || conv.phone_number[0]).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 border-b border-border pb-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-foreground truncate">{conv.contact_name || conv.phone_number}</p>
                    <span className="text-xs text-muted-foreground">
                      {formatTime12Hour(conv.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-sm text-muted-foreground truncate pr-2">
                      {conv.last_message_preview || 'No messages'}
                    </p>
                    <div className="flex items-center gap-1">
                      {humanHandoffs.some(h => h.phone_number === conv.phone_number) && (
                        <Badge className="bg-orange-500 text-white text-[10px] h-5 px-1.5">
                          👨‍💼
                        </Badge>
                      )}
                      {conv.unread_count > 0 && (
                        <Badge className="bg-whatsapp-green text-white text-xs h-5 min-w-[20px] flex items-center justify-center">
                          {conv.unread_count}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat View */}
      <div className={`min-w-0 min-h-0 flex-1 flex-col ${!selectedConversation ? 'hidden md:flex' : 'flex'}`}>
        {/* Message Selection Toolbar - WhatsApp Style */}
        {isSelectionMode && selectedConversation && (
          <MessageSelectionToolbar
            selectedCount={selectedMessages.size}
            onDelete={() => setShowDeleteDialog(true)}
            onReply={handleReply}
            onCopy={handleCopy}
            onStar={handleStar}
            onReact={handleReact}
            onTranslate={handleTranslate}
            onCancel={handleCancelSelection}
            canReply={selectedMessages.size === 1}
            canCopy={hasTextMessages()}
            canTranslate={hasTextMessages() && selectedMessages.size === 1}
          />
        )}
        
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            {!isSelectionMode && <div className="shrink-0 bg-whatsapp-panel px-2 py-2 flex items-center gap-2 border-b border-whatsapp-border">
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-foreground hover:bg-whatsapp-hover h-10 w-10 md:hidden"
                onClick={handleBackToList}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <button
                type="button"
                onClick={() => navigate('/employer/workly-chat/business-profile')}
                aria-label="Open business profile"
                className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-0.5 text-left hover:bg-whatsapp-hover transition-colors"
              >
                <Avatar className="h-10 w-10 flex-shrink-0">
                  {selectedConversation.linked_profile?.profile_image_url && (
                    <AvatarImage 
                      src={selectedConversation.linked_profile.profile_image_url} 
                      alt={selectedConversation.contact_name || 'Contact'}
                      className="object-cover"
                    />
                  )}
                  <AvatarFallback 
                    className="text-primary-foreground font-medium"
                    style={{
                      background: `linear-gradient(135deg, ${getAvatarColor(selectedConversation.contact_name || selectedConversation.phone_number)} 0%, ${getAvatarColor(selectedConversation.contact_name || selectedConversation.phone_number)}dd 100%)`
                    }}
                  >
                    {(selectedConversation.contact_name?.[0] || selectedConversation.phone_number[0]).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {selectedConversation.contact_name || `+${selectedConversation.phone_number}`}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">+{selectedConversation.phone_number}</span>
                    {sessionTimeRemaining && (
                      <span className="text-xs font-medium tabular-nums text-primary flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5">
                        <Clock className="h-3 w-3" />
                        {sessionTimeRemaining}
                      </span>
                    )}
                  </div>
                </div>
              </button>
              <div className="flex items-center gap-1">
                {/* Voice Call Button - Opens native phone call */}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-foreground hover:bg-whatsapp-hover h-10 w-10"
                  asChild
                >
                  <a href={`tel:+${selectedConversation.phone_number.replace(/\D/g, '')}`}>
                    <Phone className="h-5 w-5" />
                  </a>
                </Button>
                {/* Template Button - Opens template send page */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-foreground hover:bg-whatsapp-hover h-10 w-10"
                  onClick={() => {
                    const query = searchParams.toString();
                    navigate(`/employer/workly-chat/chat/${encodeURIComponent(selectedConversation.phone_number)}/templates${query ? `?${query}` : ''}`);
                  }}
                  title="Send Template"
                >
                  <LayoutTemplate className="h-5 w-5" />
                </Button>
              </div>
            </div>}

            {/* Session Warning */}
            {!isSessionActive(selectedConversation.session_expires_at) && (
              <div className="bg-amber-100 px-4 py-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <span className="text-xs text-amber-800">
                  24-hour session expired. Use templates to send messages.
                </span>
              </div>
            )}

            {/* Messages Area - Native Touch Scroll */}
            <div 
              className="flex-1 min-h-0 relative bg-whatsapp-bg"
            >
              <div 
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className={`absolute inset-0 overflow-y-auto overscroll-contain px-3 py-3 ${selectedMedia ? "pb-64" : "pb-32"}`}
                style={{
                  WebkitOverflowScrolling: 'touch',
                  scrollBehavior: 'smooth',
                  willChange: 'scroll-position'
                }}
              >
                {loadingMessages ? (
                  <div className="text-center text-whatsapp-secondary py-8">Loading messages...</div>
                ) : timeline.length === 0 ? (
                  <div className="text-center text-whatsapp-secondary py-8">
                    <p>No messages yet</p>
                    <p className="text-xs mt-1">Send a message to start the conversation</p>
                  </div>
                ) : (
                  <div className="mx-auto max-w-4xl space-y-1 pb-2">
                    {timeline.map((item, index) => {
                      const dateSeparator = startsChatDay(item.timestamp, timeline[index - 1]?.timestamp)
                        ? <ChatDateSeparator timestamp={item.timestamp} /> : null;
                      // Render call message
                      if (item.type === 'call') {
                        const call = item.data;
                        return (
                          <div key={`call-${call.id}`}>
                          {dateSeparator}
                          <CallMessage
                            callType={call.call_type}
                            status={call.status}
                            durationSeconds={call.duration_seconds}
                            createdAt={call.created_at}
                            isOwn={call.call_type === 'outbound'}
                          />
                          </div>
                        );
                      }
                      
                      // Render regular message with WhatsAppMessageBubble
                      const msg = item.data;
                      const mediaUrl = getMediaUrl(msg);
                      const mediaType = getMediaType(msg);
                      const isOutgoing = ['outgoing','outbound'].includes(msg.direction);
                      
                      // Build enriched metadata for template messages
                      const enrichedMetadata = buildTemplateMetadata(msg);
                      
                      // Get reply message if exists
                      const replyMessage = msg.reply_to_message_id 
                        ? messages.find(m => m.id === msg.reply_to_message_id)
                        : null;
                      
                      // Transform reactions to match component interface
                      const transformedReactions = (msg.reactions || []).map(r => ({
                        emoji: r.emoji,
                        userId: r.user_id || r.user_phone || '',
                        userName: r.user_name || undefined
                      }));
                      
                      return (
                        <div key={msg.id} id={`message-${msg.id}`}>
                          {dateSeparator}
                          <WhatsAppMessageBubble
                            id={msg.id}
                            content={getMessageContent(msg, enrichedMetadata)}
                            messageType={enrichedMetadata?.is_template ? 'template' : msg.message_type}
                            status={msg.status}
                            createdAt={msg.created_at}
                            isOutgoing={isOutgoing}
                            mediaUrl={mediaUrl}
                            mediaType={mediaType}
                            fileName={msg.metadata?.file_name || msg.metadata?.raw?.document?.filename}
                            isSelected={selectedMessages.has(msg.id)}
                            isSelectionMode={isSelectionMode}
                            isStarred={msg.is_starred || false}
                            reactions={transformedReactions}
                            metadata={enrichedMetadata}
                            replyTo={replyMessage ? {
                              content: replyMessage.message_content || '[Media]',
                              senderName: ['outgoing','outbound'].includes(replyMessage.direction) ? 'You' : selectedConversation?.contact_name || 'Contact'
                            } : null}
                            onSelect={() => toggleMessageSelection(msg.id)}
                            onLongPress={() => handleMessageLongPress(msg.id)}
                            onClick={() => handleMessageClick(msg.id)}
                          onReact={async (emoji) => {
                            setReactionMessageId(msg.id);
                            // Get user session and profile
                            const { data: sessionData } = await supabase.auth.getSession();
                            const userId = sessionData?.session?.user?.id;
                            
                            if (!userId) return;
                            
                            // Fetch user's full name from profile
                            const { data: profile } = await supabase
                              .from('profiles')
                              .select('full_name')
                              .eq('user_id', userId)
                              .single();
                            
                            // First delete existing reaction from this user
                            await supabase
                              .from('whatsapp_message_reactions')
                              .delete()
                              .eq('message_id', msg.id)
                              .eq('user_id', userId);
                            
                            // Then insert new reaction
                            await supabase.from('whatsapp_message_reactions').insert({
                              message_id: msg.id,
                              emoji,
                              user_id: userId,
                              user_name: profile?.full_name || 'User'
                            });
                            
                            queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] });
                          }}
                        />
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>
              
              {/* Input Area - Floating over wallpaper with high z-index to cover reactions */}
              <div className="absolute bottom-0 left-0 right-0 z-20 bg-transparent px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4">
                <div className="mx-auto max-w-4xl">
                {selectedMedia && <MediaUploadPreview file={selectedMedia.file} type={selectedMedia.type}
                  onCancel={() => setSelectedMedia(null)} sending={sendingMedia} />}
                {/* Reply Preview Bar - WhatsApp Style */}
                {replyingTo && (
                  <div className="mb-2 bg-whatsapp-panel rounded-lg overflow-hidden shadow-lg">
                    <div className="flex items-stretch">
                      <div className="w-1 bg-[#00A884]" />
                      <div className="flex-1 px-3 py-2">
                        <p className="text-xs font-medium text-[#00A884]">
                          {['outgoing','outbound'].includes(replyingTo.direction) ? 'You' : selectedConversation?.contact_name || 'Contact'}
                        </p>
                        <p className="text-sm text-whatsapp-secondary truncate">
                          {replyingTo.message_content || '[Media]'}
                        </p>
                      </div>
                      <button
                        onClick={handleCancelReply}
                        className="px-3 flex items-center text-whatsapp-secondary hover:text-white transition-colors"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {!isSessionActive(selectedConversation.session_expires_at) ? (
                    <Button
                      onClick={() => navigate(`/employer/workly-chat/chat/${encodeURIComponent(selectedConversation.phone_number)}/templates`)}
                      className="flex-1 h-11 rounded-full border border-whatsapp-border bg-transparent text-whatsapp-icon hover:bg-whatsapp-hover"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Send Template Message
                    </Button>
                  ) : (
                    <div className={`relative flex min-w-0 flex-1 flex-wrap items-center gap-1 rounded-[28px] border border-border bg-card px-2 py-1.5 shadow-md transition-all duration-150 focus-within:ring-1 focus-within:ring-ring ${waExpanded && !isVoiceRecording ? 'rounded-[24px] px-3 py-2.5' : ''}`}>
                      <textarea ref={waMirrorRef} aria-hidden tabIndex={-1} readOnly rows={1} className="pointer-events-none absolute left-0 top-0 -z-10 block h-5 resize-none overflow-hidden border-0 bg-transparent px-1 py-0 text-sm leading-5 opacity-0" />
                      {isVoiceRecording ? (
                        <>
                          <button type="button" onClick={cancelVoiceRecording} aria-label="Cancel recording" className="order-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-muted transition-colors">
                            <X className="h-6 w-6" strokeWidth={2.2} />
                          </button>
                          <div className="order-2 flex min-w-0 flex-1 items-center">
                            <ComposerWaveform stream={voiceStream} active={voiceStatus === 'listening'} />
                          </div>
                        </>
                      ) : (
                        <>
                      <div className={`flex shrink-0 items-center ${waExpanded ? 'order-2' : 'order-1'}`}>
                      <WhatsAppAttachmentMenu
                        onMediaSelect={handleMediaSelect}
                        onTextMessage={(message) => {
                          if (selectedConversation) {
                            sendMessageMutation.mutate({
                              phone_number: selectedConversation.phone_number,
                              message,
                              conversation_id: selectedConversation.id
                            });
                          }
                        }}
                        disabled={sendMessageMutation.isPending || sendingMedia}
                        recipientPhone={selectedConversation?.phone_number}
                      />
                      </div>
                      <textarea
                        ref={waInputRef}
                        aria-label="Message"
                        placeholder="Message…"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        disabled={sendMessageMutation.isPending || sendingMedia}
                        rows={1}
                        className={`block max-h-32 resize-none overflow-hidden overscroll-contain border-0 bg-transparent px-1 py-0 text-sm leading-5 text-foreground placeholder:text-muted-foreground focus:outline-none ${waExpanded ? 'order-1 mb-1 w-full basis-full' : 'order-2 min-w-0 flex-1'}`}
                      />
                        </>
                      )}
                      <div className="order-3 ml-auto flex shrink-0 items-center gap-1">
                        {isVoiceRecording ? (
                          <>
                            <button type="button" onClick={stopVoiceRecording} aria-label="Stop recording" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 shadow-md transition-colors">
                              <span className="h-3.5 w-3.5 rounded-[3px] bg-white" />
                            </button>
                            <button type="button" onClick={stopVoiceRecording} aria-label="Send voice message" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-md bg-[#0A84FF] hover:bg-[#0a76e0] text-white transition-colors">
                              <ArrowUp className="h-[22px] w-[22px]" strokeWidth={2.5} />
                            </button>
                          </>
                        ) : (newMessage.trim() || selectedMedia) ? (
                          <Button type="button" size="icon" onClick={handleSendMessage} disabled={sendMessageMutation.isPending || sendingMedia} aria-label={selectedMedia ? "Send attachment" : "Send message"} className="h-9 w-9 shrink-0 rounded-full shadow-md bg-whatsapp-send hover:bg-whatsapp-send-hover text-whatsapp-send-foreground disabled:opacity-40">
                            {sendMessageMutation.isPending || sendingMedia ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-[22px] w-[22px]" strokeWidth={2.5} />}
                          </Button>
                        ) : (
                          <button type="button" onClick={startVoiceRecording} disabled={sendMessageMutation.isPending || sendingMedia} aria-label="Voice message" className="flex h-9 w-8 shrink-0 items-center justify-center rounded-full text-foreground disabled:opacity-50 hover:bg-muted transition-colors">
                            <Mic className="h-[22px] w-[22px]" strokeWidth={2} />
                          </button>
                        )}
                      </div>
                    </div>

                  )}
                </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-whatsapp-panel">
            <div className="text-center px-8">
              <div className="w-64 h-64 mx-auto mb-8 rounded-full bg-whatsapp-green/20 flex items-center justify-center">
                <MessageSquare className="h-32 w-32 text-whatsapp-green" />
              </div>
              <h3 className="text-3xl font-light text-foreground mb-2">WhatsApp Business</h3>
              <p className="text-whatsapp-secondary text-sm">
                Send and receive messages from your contacts
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Contact Sidebar */}
      {showSidebar && selectedConversation && (
        <ContactSidebar
          phoneNumber={selectedConversation.phone_number}
          contactType={selectedConversation.contact_type}
          linkedUserId={selectedConversation.linked_user_id}
          onClose={() => setShowSidebar(false)}
        />
      )}

      {/* Dialogs */}
      <EmployerNewChatDialog
        open={showNewChat}
        onOpenChange={setShowNewChat}
        onStartChat={handleStartNewChat}
      />

      <JobShareDialog
        open={showJobShare}
        onOpenChange={setShowJobShare}
        onShare={handleJobShare}
      />

      {/* Template picker now handled via navigation to dedicated page */}

      {/* Delete Messages Dialog */}
      <DeleteMessagesDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        messageCount={selectedMessages.size}
        onConfirm={handleDeleteMessages}
      />

      {/* Forward Message Dialog */}
      <ForwardMessageDialog
        open={showForwardDialog}
        onOpenChange={setShowForwardDialog}
        contacts={conversations.map(c => ({
          id: c.id,
          name: c.contact_name || c.phone_number,
          phoneNumber: c.phone_number,
          avatarUrl: c.linked_profile?.profile_image_url || undefined
        }))}
        messageCount={selectedMessages.size}
        onForward={async (contactIds) => {
          const selectedMsgs = messages.filter(m => selectedMessages.has(m.id));
          for (const convId of contactIds) {
            const conv = conversations.find(c => c.id === convId);
            if (!conv) continue;
            
            for (const msg of selectedMsgs) {
              await sendMessageMutation.mutateAsync({
                phone_number: conv.phone_number,
                message: msg.message_content || '[Forwarded message]',
                conversation_id: convId
              });
            }
          }
          toast.success(`Forwarded to ${contactIds.length} chat(s)`);
          handleCancelSelection();
          setShowForwardDialog(false);
        }}
      />

      {/* Reaction Picker Modal - WhatsApp Style with Full Emoji Categories */}
      {showReactionPicker && reactionMessageId && (() => {
        // Get current user's reaction on this message
        const selectedMsg = messages.find(m => m.id === reactionMessageId);
        const currentUserReaction = selectedMsg?.reactions?.find(r => {
          // We need to check against current user - will be checked in the handler
          return true; // Will filter properly in the component
        });
        
        return (
          <ReactionPicker
            currentReaction={currentUserReaction?.emoji}
            onSelect={async (emoji) => {
              // Get user session and profile
              const { data: sessionData } = await supabase.auth.getSession();
              const userId = sessionData?.session?.user?.id;
              
              if (!userId) {
                toast.error('Please login to react');
                return;
              }
              
              // Fetch user's full name from profile
              const { data: profile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('user_id', userId)
                .single();
              
              // First delete any existing reaction from this user on this message
              await supabase
                .from('whatsapp_message_reactions')
                .delete()
                .eq('message_id', reactionMessageId)
                .eq('user_id', userId);
              
              // Then insert new reaction
              const { error } = await supabase
                .from('whatsapp_message_reactions')
                .insert({
                  message_id: reactionMessageId,
                  emoji: emoji,
                  user_id: userId,
                  user_name: profile?.full_name || 'User'
                });
              
              if (error) {
                toast.error('Failed to add reaction');
              } else {
                queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] });
                toast.success(`Reacted with ${emoji}`);
                
                // Sync reaction to WhatsApp if message has msg91_message_id
                if (selectedMsg?.msg91_message_id && selectedConversation?.phone_number) {
                  try {
                    const response = await waInvoke('whatsapp-cloud-api', {
                      body: {
                        audience: conversationAudience(selectedConversation) ?? undefined,
                        action: 'advanced',
                        advanced_action: 'send_reaction',
                        phone_number: selectedConversation.phone_number,
                        wa_message_id: selectedMsg.msg91_message_id,
                        emoji: emoji
                      }
                    });
                    
                    if (response.data?.success) {
                      console.log('✅ Reaction synced to WhatsApp');
                    } else {
                      console.warn('⚠️ Failed to sync reaction to WhatsApp:', response.data?.error);
                    }
                  } catch (syncError) {
                    console.warn('⚠️ Error syncing reaction to WhatsApp:', syncError);
                  }
                }
              }
              
              setShowReactionPicker(false);
              setReactionMessageId(null);
              handleCancelSelection();
            }}
            onRemove={async () => {
              // Get user session
              const { data: sessionData } = await supabase.auth.getSession();
              const userId = sessionData?.session?.user?.id;
              
              if (!userId) {
                toast.error('Please login to remove reaction');
                return;
              }
              
              // Delete reaction
              const { error } = await supabase
                .from('whatsapp_message_reactions')
                .delete()
                .eq('message_id', reactionMessageId)
                .eq('user_id', userId);
              
              if (error) {
                toast.error('Failed to remove reaction');
              } else {
                queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] });
                toast.success('Reaction removed');
                
                // Sync reaction removal to WhatsApp if message has msg91_message_id
                if (selectedMsg?.msg91_message_id && selectedConversation?.phone_number) {
                  try {
                    const response = await waInvoke('whatsapp-cloud-api', {
                      body: {
                        audience: conversationAudience(selectedConversation) ?? undefined,
                        action: 'advanced',
                        advanced_action: 'send_reaction',
                        phone_number: selectedConversation.phone_number,
                        wa_message_id: selectedMsg.msg91_message_id,
                        emoji: '' // Empty emoji = remove reaction
                      }
                    });
                    
                    if (response.data?.success) {
                      console.log('✅ Reaction removal synced to WhatsApp');
                    } else {
                      console.warn('⚠️ Failed to sync reaction removal to WhatsApp:', response.data?.error);
                    }
                  } catch (syncError) {
                    console.warn('⚠️ Error syncing reaction removal to WhatsApp:', syncError);
                  }
                }
              }
              
              setShowReactionPicker(false);
              setReactionMessageId(null);
              handleCancelSelection();
            }}
            onClose={() => {
              setShowReactionPicker(false);
              setReactionMessageId(null);
            }}
          />
        );
      })()}

      {/* WhatsApp Call Screen */}
      {callState.isCallScreenOpen && selectedConversation && (
        <WhatsAppCallScreen
          contactName={selectedConversation.contact_name || selectedConversation.phone_number}
          phoneNumber={selectedConversation.phone_number}
          profileImageUrl={selectedConversation.linked_profile?.profile_image_url}
          conversationId={selectedConversation.id}
          applicantId={selectedConversation.linked_user_id || undefined}
          onClose={closeCallScreen}
          onCallEnd={endCall}
        />
      )}

      {/* Translate Dialog */}
      {showTranslateDialog && selectedMessages.size === 1 && (() => {
        const selectedMsgId = Array.from(selectedMessages)[0];
        const selectedMsg = messages.find(m => m.id === selectedMsgId);
        
        if (!selectedMsg?.message_content) return null;
        
        return (
          <TranslateDialog
            open={showTranslateDialog}
            onOpenChange={(open) => {
              setShowTranslateDialog(open);
              if (!open) handleCancelSelection();
            }}
            messages={[{ id: selectedMsg.id, role: "user", content: selectedMsg.message_content, timestamp: "" }]}
            selectedMessageIds={[selectedMsg.id]}
          />
        );
      })()}
    </div>
  );
}
