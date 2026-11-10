import { metaChatRequest, metaChatScope } from "@/lib/metaChatScope";
import { ChatDateSeparator } from '@/components/chat/ChatDateSeparator';
import { formatChatTime, startsChatDay } from '@/lib/chatTimestamp';
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useStackedComposer } from "@/hooks/useStackedComposer";
import { useChatDictation } from "@/hooks/useChatDictation";
import { WhatsAppAttachmentMenu } from "@/components/whatsapp/WhatsAppAttachmentMenu";
import { MediaUploadPreview } from "@/components/whatsapp/MediaUploadPreview";
import { ComposerWaveform } from "@/components/ai-chat/ComposerWaveform";
import { uploadToR2 } from "@/lib/r2Media";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isToday } from "date-fns";
import { AlertCircle, ArrowLeft, ArrowUp, Check, Clock, Loader2, MessageSquare, Mic, Trash2, X } from "lucide-react";
import { MediaPreview } from "@/components/whatsapp/MediaPreview";
import { WhatsAppAudioPlayer } from "@/components/whatsapp/WhatsAppAudioPlayer";
import { WhatsAppDocumentPreview } from "@/components/whatsapp/WhatsAppDocumentPreview";
import { ReactionPicker } from "@/components/whatsapp/MessageReactions";
import { metaMessageMedia, metaReactionEmoji } from "@/lib/metaChatPresentation";
import { MessageSelectionToolbar } from "@/components/whatsapp/MessageSelectionToolbar";
import TranslateDialog from "@/components/chat/TranslateDialog";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import LottieSearchIcon from "@/components/LottieSearchIcon";
import {
  META_INFO, META_STATE_KEY, metaRedirectUri, metaSocialAction as rawMetaSocialAction, useMetaSocialAccount, type MetaPlatform,
} from "@/components/social/MetaSocialAIConnectCard";

type ChatAudience = "support" | undefined;
const scopedAction = (audience: ChatAudience) => (body: Record<string, unknown>) => rawMetaSocialAction(metaChatRequest(body, audience));

interface Conv { id: string; updated_time: string | null; unread_count: number; contact_id: string | null; contact_name: string; contact_username?: string | null; last_message: string; last_from_me: boolean }
interface MetaContact { name: string | null; username: string | null; picture_url: string | null }

// History and the open chat share one account-scoped contact request/cache.
function useMetaChatContact(platform: MetaPlatform, accountId: string, contactId: string | null, audience?: "support") {
  const metaSocialAction = scopedAction(audience);
  return useQuery({
    queryKey: ["meta-chat-contact", platform, accountId, contactId, metaChatScope(audience)],
    enabled: !!contactId,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    retry: false,
    queryFn: async (): Promise<MetaContact | null> => {
      if (!contactId) return null;
      return (await metaSocialAction({ action: "chat_contact", platform, account_id: accountId, contact_id: contactId })).contact ?? null;
    },
  });
}

function MetaConversationRow({ platform, accountId, conv, onOpen, audience }: {
  platform: MetaPlatform; accountId: string; conv: Conv; onOpen: () => void; audience?: "support";
}) {
  const contactQ = useMetaChatContact(platform, accountId, conv.contact_id, audience);
  const name = contactQ.data?.name || conv.contact_name;
  return (
    <Button type="button" variant="ghost" onClick={onOpen}
      className="flex h-auto w-full items-center justify-start gap-3 rounded-none px-3 py-3 text-left hover:bg-muted">
      <Avatar className="h-12 w-12 shrink-0">
        {contactQ.data?.picture_url && <AvatarImage src={contactQ.data.picture_url} alt={name} referrerPolicy="no-referrer" className="object-cover" />}
        <AvatarFallback className="bg-primary text-primary-foreground">{name.replace("@", "").charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 border-b border-border pb-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-medium text-foreground">{name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{when(conv.updated_time)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm text-muted-foreground">{conv.last_from_me ? "You: " : ""}{conv.last_message}</span>
          {conv.unread_count > 0 && <span className="rounded-full bg-primary px-2 text-xs text-primary-foreground">{conv.unread_count}</span>}
        </div>
      </div>
    </Button>
  );
}
interface Msg {
  id: string; text: string; from_me: boolean; created_time: string; attachment: string | null;
  attachments?: { type: string; url: string; name?: string }[];
  reply_to?: string | null; reactions?: { emoji: string; from_me: boolean }[];
}

const when = (t?: string | null) => {
  if (!t) return "";
  const d = new Date(t);
  return isToday(d) ? format(d, "h:mm a") : format(d, "dd/MM/yy");
};

/** Instagram / Facebook inbox for the Chat page, using the account linked in AI Connect. */
export default function MetaSocialChat({ platform, audience, accountId }: { platform: MetaPlatform; audience?: "support"; accountId?: string | null }) {
  const metaSocialAction = scopedAction(audience);
  const label = platform === "instagram" ? "Instagram" : "Facebook";
  const { account, loading } = useMetaSocialAccount(platform, true, accountId, audience);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Conv | null>(null);
  const [connecting, setConnecting] = useState(false);
  useEffect(() => { setOpen(null); setSearch(""); }, [platform, audience, account?.id]);

  const convQ = useQuery({
    queryKey: ["meta-chat-convs", platform, account?.id, metaChatScope(audience)],
    enabled: !!account,
    refetchInterval: 20000,
    queryFn: async () => {
      if (!account) return [];
      return (await metaSocialAction({ action: "chat_conversations", platform, account_id: account.id })).conversations as Conv[];
    },
  });

  const connect = async () => {
    setConnecting(true);
    try {
      const state = crypto.randomUUID();
      const returnTo = `${window.location.pathname}?channel=${platform}`;
      sessionStorage.setItem(META_STATE_KEY, JSON.stringify({ state, platform, audience, returnTo }));
      const data = await metaSocialAction({ action: "connect_url", platform, redirect_uri: metaRedirectUri(), state });
      window.location.href = data.url;
    } catch (e) { toast.error((e as Error).message); setConnecting(false); }
  };

  if (loading) return <div className="flex flex-1 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  if (!account) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <div>{META_INFO[platform].logo}</div>
        <p className="font-medium">Connect your {label} account</p>
        <Button onClick={connect} disabled={connecting}>
          {connecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Connect {label}
        </Button>
      </div>
    );
  }

  if (open) return <MetaThread key={`${audience}:${account.id}:${open.id}`} audience={audience} platform={platform} accountId={account.id} conv={open} onBack={() => setOpen(null)} />;

  const list = (convQ.data || []).filter((c) => !search || c.contact_name.toLowerCase().includes(search.toLowerCase()) || c.last_message.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="bg-background px-3 py-2">
        <div className="relative">
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"><LottieSearchIcon size={16} /></div>
          <Input placeholder={`Search ${label} chats`} value={search} onChange={(e) => setSearch(e.target.value)}
            className="h-10 rounded-lg border-0 bg-muted pl-10 text-foreground placeholder:text-muted-foreground" />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {convQ.isLoading && <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
        {convQ.error && <p className="p-6 text-center text-sm text-destructive">{(convQ.error as Error).message}</p>}
        {!convQ.isLoading && !convQ.error && list.length === 0 && (
          <div className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
            <MessageSquare className="h-10 w-10" />
            <p className="text-sm">No {label} chats yet. New messages to {account.name || "your account"} will appear here.</p>
          </div>
        )}
        {list.map((c) => (
          <MetaConversationRow audience={audience} key={c.id} platform={platform} accountId={account.id} conv={c} onOpen={() => setOpen(c)} />
        ))}
      </div>
    </div>
  );
}

const DAY = 24 * 60 * 60 * 1000;
const fmtLeft = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
};

/** Parse a WhatsApp-style quoted reply embedded in the text: "↩ Name: quote\n\nbody". */
const parseReply = (text: string): { name: string; quote: string; body: string } | null => {
  const m = /^↩ ([^\n:]+): ([^\n]+)\n\n([\s\S]+)$/.exec(text);
  return m ? { name: m[1], quote: m[2], body: m[3] } : null;
};

function MetaThread({ platform, accountId, conv, onBack, audience }: { platform: MetaPlatform; accountId: string; conv: Conv; onBack: () => void; audience?: "support" }) {
  const metaSocialAction = scopedAction(audience);
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{ file: File; type: "image" | "document" | "audio" | "video" } | null>(null);
  const [sendingMedia, setSendingMedia] = useState(false);
  const voice = useChatDictation(setText);
  const [now, setNow] = useState(Date.now());
  const endRef = useRef<HTMLDivElement>(null);
  const { inputRef, mirrorRef, expanded } = useStackedComposer(text, { inlineControlsWidth: 88 });
  const key = useMemo(() => ["meta-chat-msgs", platform, accountId, conv.id, metaChatScope(audience)], [platform, accountId, conv.id, audience]);
  // WhatsApp-style message multi-select (long press). Meta messages cannot be deleted, so "delete" hides them locally.
  const [msgSelectionMode, setMsgSelectionMode] = useState(false);
  const [selectedMsgs, setSelectedMsgs] = useState<Set<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<Msg | null>(null);
  const [showTranslate, setShowTranslate] = useState(false);
  // ❤️ reactions are sent to Meta (sender_action react/unreact). Local overrides keep the
  // icon in sync until the next fetch confirms it.
  const [heartOverride, setHeartOverride] = useState<Record<string, boolean>>({});
  // Replies we sent natively, keyed by our new message id → quoted message id.
  const repliesKey = `meta-msgs-replies:${metaChatScope(audience)}:${platform}:${accountId}:${conv.id}`;
  const [localReplies, setLocalReplies] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem(repliesKey) || "{}") as Record<string, string>; } catch { return {}; }
  });
  const hasMyHeart = (m: Msg) => heartOverride[m.id] ?? (m.reactions || []).some((r) => r.from_me);
  const toggleHeart = async (m: Msg) => {
    if (!conv.contact_id) return;
    const next = !hasMyHeart(m);
    setHeartOverride((p) => ({ ...p, [m.id]: next }));
    if (navigator.vibrate) navigator.vibrate(15);
    try {
      await metaSocialAction({ action: "chat_react", platform, account_id: accountId, recipient_id: conv.contact_id, message_id: m.id, remove: !next });
    } catch (e) {
      setHeartOverride((p) => ({ ...p, [m.id]: !next }));
      toast.error((e as Error).message || "Could not send reaction");
    }
  };
  // Facebook: any emoji like WhatsApp. Instagram: only ❤️ (Meta limit).
  const [myEmoji, setMyEmoji] = useState<Record<string, string | null>>({});
  const [pickerFor, setPickerFor] = useState<Msg | null>(null);
  const myReaction = (m: Msg) => (m.id in myEmoji ? myEmoji[m.id] : (m.reactions || []).find((r) => r.from_me)?.emoji || null);
  const sendEmoji = async (m: Msg, emoji: string | null) => {
    if (!conv.contact_id) return;
    const prev = myReaction(m);
    setMyEmoji((p) => ({ ...p, [m.id]: emoji }));
    try {
      await metaSocialAction({ action: "chat_react", platform, account_id: accountId, recipient_id: conv.contact_id, message_id: m.id,
        ...(emoji ? { emoji } : { remove: true }) });
    } catch (e) {
      setMyEmoji((p) => ({ ...p, [m.id]: prev }));
      toast.error((e as Error).message || "Could not send reaction");
    }
  };
  const handleReactMsg = () => {
    const m = selectedMsgList()[0];
    if (m && platform === "facebook") setPickerFor(m);
    else if (m) void toggleHeart(m);
    cancelMsgSelection();
  };
  const longPressFired = useRef(false);
  const msgLongPressTimer = useRef<number | null>(null);
  const msgTouchStartPos = useRef<{ x: number; y: number } | null>(null);
  const lastMsgTouchAt = useRef(0);
  useEffect(() => {
    const onScroll = () => { if (msgLongPressTimer.current) { clearTimeout(msgLongPressTimer.current); msgLongPressTimer.current = null; } };
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, []);
  const msgLongPressStart = (msgId: string, e: React.TouchEvent | React.MouseEvent) => {
    longPressFired.current = false;
    if (msgLongPressTimer.current) { clearTimeout(msgLongPressTimer.current); msgLongPressTimer.current = null; }
    if ("touches" in e) {
      lastMsgTouchAt.current = Date.now();
      if (e.touches.length > 1) return; // multi-finger gestures never select
    } else if (Date.now() - lastMsgTouchAt.current < 1000) return; // emulated mouse after touch
    if ("touches" in e && e.touches.length > 0) msgTouchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    msgLongPressTimer.current = window.setTimeout(() => {
      longPressFired.current = true;
      if (navigator.vibrate) navigator.vibrate(50);
      setMsgSelectionMode(true);
      setSelectedMsgs(new Set([msgId]));
    }, 500);
  };
  const msgLongPressMove = (e: React.TouchEvent) => {
    if (e.touches.length > 1) { msgLongPressEnd(); return; }
    if (msgTouchStartPos.current && e.touches.length > 0) {
      const dx = Math.abs(e.touches[0].clientX - msgTouchStartPos.current.x);
      const dy = Math.abs(e.touches[0].clientY - msgTouchStartPos.current.y);
      if (dx > 10 || dy > 10) {
        if (msgLongPressTimer.current) { clearTimeout(msgLongPressTimer.current); msgLongPressTimer.current = null; }
        msgTouchStartPos.current = null;
      }
    }
  };
  const msgLongPressEnd = () => {
    msgTouchStartPos.current = null;
    if (msgLongPressTimer.current) { clearTimeout(msgLongPressTimer.current); msgLongPressTimer.current = null; }
  };
  const toggleMsgSelection = (id: string) => {
    setSelectedMsgs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      if (next.size === 0) setMsgSelectionMode(false);
      return next;
    });
  };
  const cancelMsgSelection = () => { setMsgSelectionMode(false); setSelectedMsgs(new Set()); };
  const handleDeleteMsgs = async () => {
    if (!window.confirm('Delete selected messages and their stored files? This cannot be undone.')) return;
    try {
      await metaSocialAction({ action: 'chat_delete', platform, account_id: accountId, message_ids: [...selectedMsgs] });
      cancelMsgSelection();
      await qc.invalidateQueries({ queryKey: key });
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not delete messages'); }
  };
  const selectedMsgList = () => (q.data || []).filter((m) => selectedMsgs.has(m.id));
  const handleCopyMsgs = () => {
    const text = selectedMsgList().map((m) => m.text).filter(Boolean).join("\n");
    if (text) { navigator.clipboard.writeText(text); toast.success("Copied to clipboard"); }
    else toast.error("No text to copy");
    cancelMsgSelection();
  };
  const handleReplyMsg = () => {
    const msg = selectedMsgList()[0];
    if (msg) setReplyingTo(msg);
    cancelMsgSelection();
  };
  const handleTranslateMsg = () => {
    if (selectedMsgs.size === 1) setShowTranslate(true);
  };
  const q = useQuery({
    queryKey: key,
    refetchInterval: 15000,
    queryFn: async () => {
      const messages = (await metaSocialAction({ action: "chat_messages", platform, account_id: accountId, conversation_id: conv.id })).messages as Msg[];
      return messages.map((m) => ({ ...m, ...metaMessageMedia(m), reactions: m.reactions?.map((r) => ({ ...r, emoji: metaReactionEmoji(r.emoji) })) }));
    },
  });
  // Real name / username / profile photo for the open chat, as much as Meta exposes. If it
  // cannot be read, the header keeps showing the conversation's contact name with its initial.
  const contactQ = useMetaChatContact(platform, accountId, conv.contact_id, audience);
  const headerName = contactQ.data?.name || conv.contact_name;
  const headerUsername = contactQ.data?.username || conv.contact_username
    || (conv.contact_name.startsWith("@") ? conv.contact_name.slice(1) : null)
    || (headerName.startsWith("@") ? headerName.slice(1) : null);
  const userLine = headerUsername && headerName !== `@${headerUsername}` ? `@${headerUsername}` : null;
  const initial = conv.contact_name.replace("@", "").charAt(0).toUpperCase();
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [q.data?.length]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  // Meta allows replies only within 24h of the customer's last message.
  const lastIncoming = useMemo(() => {
    const m = [...(q.data || [])].reverse().find((x) => !x.from_me);
    return m ? new Date(m.created_time).getTime() : null;
  }, [q.data]);
  const left = lastIncoming ? lastIncoming + DAY - now : 0;
  const active = left > 0;

  const send = async (draft = text) => {
    if (sending || sendingMedia) return;
    if (selectedMedia) { await sendMedia(draft.trim() || undefined); return; }
    const body = draft.trim();
    if (!body || !conv.contact_id || !active || sending) return;
    // Send as a native Meta reply (reply_to mid); the server falls back to a quoted text if Meta rejects it.
    let fallback: string | undefined;
    if (replyingTo) {
      const who = replyingTo.from_me ? "You" : conv.contact_name;
      const quote = (replyingTo.text || "Attachment").replace(/\s+/g, " ").slice(0, 120);
      fallback = `↩ ${who}: ${quote}\n\n${body}`;
    }
    const replyMid = replyingTo?.id;
    setSending(true);
    try {
      const res = await metaSocialAction({ action: "chat_send", platform, account_id: accountId, recipient_id: conv.contact_id, text: body,
        ...(replyMid ? { reply_to_mid: replyMid, fallback_text: fallback } : {}) });
      if (replyMid && res?.native_reply && res?.message_id) {
        setLocalReplies((prev) => {
          const next = { ...prev, [res.message_id as string]: replyMid };
          localStorage.setItem(repliesKey, JSON.stringify(next));
          return next;
        });
      }
      setText("");
      setReplyingTo(null);
      void qc.invalidateQueries({ queryKey: key });
      void qc.invalidateQueries({ queryKey: ["meta-chat-convs", platform] });
      toast.success("Message sent");
    } catch (e) { toast.error((e as Error).message); }
    finally { setSending(false); }
  };

  const sendMedia = async (caption?: string) => {
    if (!selectedMedia || !conv.contact_id || !active || sendingMedia) return;
    setSendingMedia(true);
    try {
      const { url } = await uploadToR2(selectedMedia.file, platform === 'instagram' ? 'chat-instagram' : platform === 'facebook' ? 'chat-facebook' : 'chat-whatsapp');
      // Sent as a native Meta attachment (image/video/audio/file), not a link.
      await metaSocialAction({ action: "chat_send", platform, account_id: accountId, recipient_id: conv.contact_id,
        media_url: url, media_type: selectedMedia.type === "document" ? "file" : selectedMedia.type, text: caption?.trim() || "" });
      setSelectedMedia(null);
      setText("");
      void qc.invalidateQueries({ queryKey: key });
      void qc.invalidateQueries({ queryKey: ["meta-chat-convs", platform] });
      toast.success("Attachment sent");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not send attachment."); }
    finally { setSendingMedia(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-whatsapp-bg text-foreground">
      {msgSelectionMode ? (
        <MessageSelectionToolbar
          selectedCount={selectedMsgs.size}
          onReply={handleReplyMsg}
          onDelete={() => void handleDeleteMsgs()}
          onCopy={handleCopyMsgs}
          onTranslate={handleTranslateMsg}
          onReact={handleReactMsg}
          onCancel={cancelMsgSelection}
          canReply={selectedMsgs.size === 1}
          canCopy={selectedMsgList().some((m) => m.text)}
          canTranslate={selectedMsgs.size === 1 && selectedMsgList().some((m) => m.text)}
          reactIcon={platform === "facebook" ? "smile" : "heart"}
          reactActive={platform === "instagram" && selectedMsgList().length === 1 && hasMyHeart(selectedMsgList()[0])}
        />
      ) : (
      <></>
      )}
      {msgSelectionMode ? null : (
      <div className="shrink-0 bg-whatsapp-panel px-2 py-2 flex items-center gap-2 border-b border-whatsapp-border">
        <Button variant="ghost" size="icon" aria-label="Back" className="text-foreground hover:bg-whatsapp-hover h-10 w-10" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Avatar className="h-10 w-10 flex-shrink-0">
          {contactQ.data?.picture_url && (
            <AvatarImage src={contactQ.data.picture_url} alt={headerName} referrerPolicy="no-referrer" className="object-cover" />
          )}
          <AvatarFallback className="bg-primary text-primary-foreground font-medium">{initial}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground truncate">{headerName}</p>
          <div className="flex items-center gap-2 min-w-0">
            {userLine && <span className="text-xs text-muted-foreground truncate">{userLine}</span>}
            {active && (
              <span className="text-xs font-medium tabular-nums text-primary flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 flex-shrink-0">
                <Clock className="h-3 w-3" />{fmtLeft(left)}
              </span>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" aria-label="Delete chat" className="h-10 w-10 shrink-0" onClick={async () => {
          if (!window.confirm('Delete this chat and its stored files? Messages on Instagram/Facebook remain there.')) return;
          try {
            await metaSocialAction({ action: 'chat_delete', platform, account_id: accountId, conversation_id: conv.id });
            await qc.invalidateQueries({ queryKey: ['meta-chat-convs', platform] });
            onBack();
          } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not delete chat'); }
        }}><Trash2 className="h-5 w-5" /></Button>
      </div>
      )}

      {!q.isLoading && !q.error && !active && (
        <div className="bg-warning/10 px-4 py-2 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-warning flex-shrink-0" />
          <span className="text-xs text-foreground">24-hour session expired. You can reply after the customer messages again.</span>
        </div>
      )}

      <div className={`min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-3 ${selectedMedia ? "pb-64" : "pb-24"}`}>
        {q.isLoading && <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
        {q.error && <p className="text-center text-sm text-destructive">{(q.error as Error).message}</p>}
        {(q.data || []).map((m, index) => (
          <Fragment key={m.id}>
          {startsChatDay(m.created_time, q.data?.[index - 1]?.created_time) && <ChatDateSeparator timestamp={m.created_time} />}
          <div
            onClick={() => { if (msgSelectionMode) toggleMsgSelection(m.id); }}
            onTouchStart={(e) => msgLongPressStart(m.id, e)}
            onTouchMove={msgLongPressMove}
            onTouchEnd={msgLongPressEnd}
            onTouchCancel={msgLongPressEnd}
            onMouseDown={(e) => msgLongPressStart(m.id, e)}
            onMouseUp={msgLongPressEnd}
            onMouseLeave={msgLongPressEnd}
            className={`-mx-3 flex items-center gap-2 px-3 py-0.5 select-none ${msgSelectionMode ? "cursor-pointer" : ""}`}>
            {msgSelectionMode && !m.from_me && (
              <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                selectedMsgs.has(m.id) ? "bg-foreground border-foreground" : "border-muted-foreground"
              }`}>
                {selectedMsgs.has(m.id) && <Check className="h-3 w-3 text-background" />}
              </div>
            )}
            <div className={`flex flex-1 ${(m.reactions?.length || myReaction(m) || (platform === "instagram" && hasMyHeart(m))) ? "pb-4" : ""} ${m.from_me ? "justify-end" : "justify-start"}`}>
              <div className={`relative min-w-0 max-w-[85%] rounded-lg px-3 py-2 text-sm ${(m.attachments?.length || m.attachment) ? "bg-transparent text-foreground" : m.from_me ? "bg-primary text-primary-foreground" : "bg-card text-foreground"}`}>
                {(() => {
                  const rid = m.reply_to || localReplies[m.id];
                  if (!rid) return null;
                  const qm = (q.data || []).find((x) => x.id === rid);
                  return (
                    <div className={`mb-1 rounded border-l-4 border-whatsapp-green px-2 py-1 text-xs ${m.from_me ? "bg-black/20" : "bg-muted"}`}>
                      <p className="font-medium text-whatsapp-green">{qm ? (qm.from_me ? "You" : conv.contact_name) : "Reply"}</p>
                      <p className="truncate opacity-80">{qm ? (qm.text || "Attachment") : "Replied to a message"}</p>
                    </div>
                  );
                })()}
                {(m.attachments?.length ? m.attachments : m.attachment ? [{ type: "image", url: m.attachment }] : []).map((a, i) => (
                  <div key={i} className="mb-1" onClick={(e) => msgSelectionMode && e.preventDefault()}>
                    {a.type === "image" || a.type === "video" ? <MediaPreview url={a.url} type={a.type} />
                      : a.type === "audio" ? <WhatsAppAudioPlayer url={a.url} isOutgoing={m.from_me} />
                      : <WhatsAppDocumentPreview url={a.url} fileName={a.name || "Document"} isOutgoing={m.from_me} />}
                  </div>
                ))}
                {m.text && (() => {
                  const r = parseReply(m.text);
                  if (!r) return <p className="whitespace-pre-wrap break-words">{m.text}</p>;
                  return (
                    <>
                      <div className={`mb-1 rounded border-l-4 border-whatsapp-green px-2 py-1 text-xs ${m.from_me ? "bg-black/20" : "bg-muted"}`}>
                        <p className="font-medium text-whatsapp-green">{r.name}</p>
                        <p className="truncate opacity-80">{r.quote}</p>
                      </div>
                      <p className="whitespace-pre-wrap break-words">{r.body}</p>
                    </>
                  );
                })()}
                <p className="mt-1 whitespace-nowrap text-right text-[10px] opacity-70">{formatChatTime(m.created_time)}</p>
                {(() => {
                  const theirs = (m.reactions || []).filter((r) => !r.from_me).map((r) => r.emoji);
                  const mine = platform === "facebook" ? myReaction(m) : (hasMyHeart(m) ? "❤️" : null);
                  const all = [...new Set([...theirs, ...(mine ? [mine] : [])])];
                  if (!all.length) return null;
                  return (
                    <span className={`absolute -bottom-3 z-[5] flex items-center gap-0.5 rounded-full border border-border bg-card px-1.5 py-0.5 text-card-foreground shadow-md ${m.from_me ? "right-2" : "left-2"}`}
                      aria-label="Reactions">{all.slice(0, 3).map((emoji) => <span key={emoji} className="text-sm leading-none">{metaReactionEmoji(emoji)}</span>)}
                      {theirs.length + (mine ? 1 : 0) > 1 && <span className="ml-0.5 text-[10px] font-medium text-muted-foreground">{theirs.length + (mine ? 1 : 0)}</span>}</span>
                  );
                })()}
              </div>
            </div>
            {msgSelectionMode && m.from_me && (
              <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                selectedMsgs.has(m.id) ? "bg-foreground border-foreground" : "border-muted-foreground"
              }`}>
                {selectedMsgs.has(m.id) && <Check className="h-3 w-3 text-background" />}
              </div>
            )}
          </div>
          </Fragment>
        ))}
        <div ref={endRef} />
      </div>

      {(
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-transparent px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4 [&>*]:pointer-events-auto">
        <div className="mx-auto max-w-4xl">
      {selectedMedia && <MediaUploadPreview file={selectedMedia.file} type={selectedMedia.type} sending={sendingMedia}
        onCancel={() => setSelectedMedia(null)} />}
        {replyingTo && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border-l-4 border-whatsapp-green bg-card px-3 py-2 shadow-md">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-whatsapp-green">{replyingTo.from_me ? "You" : conv.contact_name}</p>
              <p className="truncate text-sm text-muted-foreground">{replyingTo.text || "Attachment"}</p>
            </div>
            <Button variant="ghost" size="icon" aria-label="Cancel reply" className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-muted"
              onClick={() => setReplyingTo(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="flex items-center gap-2">
          {!active ? (
            <div className="flex-1 h-11 rounded-full border border-border bg-card shadow-md flex items-center justify-center text-sm text-muted-foreground">
              Waiting for customer message
            </div>
          ) : (
            <div className={`relative flex min-w-0 flex-1 flex-wrap items-center gap-1 rounded-[28px] border border-border bg-card px-2 py-1.5 shadow-md transition-all duration-150 focus-within:ring-1 focus-within:ring-ring ${expanded && !voice.recording ? 'rounded-[24px] px-3 py-2.5' : ''}`}>
              <textarea ref={mirrorRef} aria-hidden tabIndex={-1} readOnly rows={1} className="pointer-events-none absolute left-0 top-0 -z-10 block h-5 resize-none overflow-hidden border-0 bg-transparent px-1 py-0 text-sm leading-5 opacity-0" />
              {voice.recording ? <>
                <Button variant="ghost" size="icon" onClick={voice.cancel} aria-label="Cancel recording" title="Cancel recording"
                  className="order-1 h-9 w-9 shrink-0 rounded-full text-foreground hover:bg-muted [&_svg]:size-6"><X strokeWidth={2.2} /></Button>
                <div className="order-2 flex min-w-0 flex-1 items-center"><ComposerWaveform stream={voice.stream} active={!voice.processing} /></div>
              </> : <>
              <div className={`flex shrink-0 items-center ${expanded ? 'order-2' : 'order-1'}`}>
                <WhatsAppAttachmentMenu hideJob disabled={sending || sendingMedia}
                  onMediaSelect={(file, type) => setSelectedMedia({ file, type })}
                  onTextMessage={(message) => void send(message)} />
              </div>
              <textarea
                ref={inputRef}
                aria-label="Message"
                placeholder="Message…"
                value={text}
                maxLength={2000}
                rows={1}
                onChange={(e) => setText(e.target.value)}
                enterKeyHint="enter"
                disabled={sending || sendingMedia}
                className={`block max-h-32 resize-none overflow-hidden overscroll-contain border-0 bg-transparent px-1 py-0 text-sm leading-5 text-foreground placeholder:text-muted-foreground focus:outline-none ${expanded ? 'order-1 mb-1 w-full basis-full' : 'order-2 min-w-0 flex-1'}`}
              />
              </>}
              <div className="order-3 ml-auto flex shrink-0 items-center gap-1">
                {voice.recording ? <>
                  <Button variant="ghost" size="icon" onClick={voice.stop} disabled={voice.processing} aria-label="Stop recording" title="Stop recording"
                    className="h-9 w-9 rounded-full bg-destructive text-whatsapp-send-foreground hover:bg-destructive/90 shadow-md">
                    {voice.processing ? <Loader2 className="animate-spin" /> : <span className="h-3.5 w-3.5 rounded-[3px] bg-whatsapp-send-foreground" />}
                  </Button>
                  <Button size="icon" onClick={voice.stop} disabled={voice.processing} aria-label="Send voice message" title="Finish dictation"
                    className="h-9 w-9 rounded-full bg-whatsapp-send text-whatsapp-send-foreground hover:bg-whatsapp-send-hover shadow-md [&_svg]:size-[22px]"><ArrowUp strokeWidth={2.5} /></Button>
                </> : (text.trim() || selectedMedia) ? (
                  <Button size="icon" onClick={() => void send()} disabled={sending || sendingMedia || !conv.contact_id} aria-label={selectedMedia ? "Send attachment" : "Send message"} title={selectedMedia ? "Send attachment" : "Send message"}
                    className="h-9 w-9 shrink-0 rounded-full shadow-md bg-whatsapp-send hover:bg-whatsapp-send-hover text-whatsapp-send-foreground disabled:opacity-40 [&_svg]:size-[22px]">
                    {sending || sendingMedia ? <Loader2 className="animate-spin" /> : <ArrowUp strokeWidth={2.5} />}
                  </Button>
                ) : <Button variant="ghost" size="icon" onClick={() => void voice.start()} disabled={sending || sendingMedia} aria-label="Voice message" title="Voice message"
                  className="h-9 w-8 shrink-0 rounded-full text-foreground hover:bg-muted [&_svg]:size-[22px]"><Mic strokeWidth={2} /></Button>}
              </div>
            </div>
          )}
         </div>
        </div>
      </div>
      )}

      {pickerFor && (
        <ReactionPicker
          currentReaction={myReaction(pickerFor) || undefined}
          onSelect={(emoji) => { void sendEmoji(pickerFor, emoji); setPickerFor(null); }}
          onRemove={() => { void sendEmoji(pickerFor, null); setPickerFor(null); }}
          onClose={() => setPickerFor(null)}
        />
      )}
      {showTranslate && selectedMsgs.size === 1 && (() => {
        const msg = selectedMsgList()[0];
        if (!msg?.text) return null;
        return (
          <TranslateDialog
            open={showTranslate}
            onOpenChange={(open) => {
              setShowTranslate(open);
              if (!open) cancelMsgSelection();
            }}
            messages={[{ id: msg.id, role: "user", content: msg.text, timestamp: "" }]}
            selectedMessageIds={[msg.id]}
          />
        );
      })()}
    </div>
  );
}
