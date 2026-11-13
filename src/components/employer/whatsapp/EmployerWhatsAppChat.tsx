import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Check, CheckCheck, Loader2, Search, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { employerWhatsAppAction } from "./useEmployerWhatsApp";
import { useSelectedNumber } from "./selectedNumber";

interface Conversation {
  id: string; phone_number: string; contact_name: string | null; last_message_at: string | null;
  last_message_preview: string | null; unread_count: number | null; session_expires_at: string | null;
}
interface Message {
  id: string; direction: string; message_content: string | null; message_type: string | null;
  status: string | null; sent_at: string | null; created_at: string; metadata: any;
}

const fmtTime = (d?: string | null) => d ? new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

export default function EmployerWhatsAppChat({ companyId }: { companyId: string }) {
  const [params, setParams] = useSearchParams();
  const selectedNumberId = useSelectedNumber();
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [search, setSearch] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const selectedPhone = params.get("phone");
  const selected = useMemo(() => convs.find((c) => c.phone_number === selectedPhone) ?? null, [convs, selectedPhone]);

  const loadConvs = async () => {
    // Never mix conversations from two WhatsApp Business numbers owned by the same company.
    if (!selectedNumberId) { setConvs([]); return; }
    const { data, error } = await (supabase.from("whatsapp_conversations" as any) as any)
      .select("id, phone_number, contact_name, last_message_at, last_message_preview, unread_count, session_expires_at")
      .eq("company_id" as any, companyId)
      .eq("whatsapp_phone_number_id" as any, selectedNumberId)
      .order("last_message_at", { ascending: false, nullsFirst: false });
    if (error) { toast.error(error.message); return; }
    setConvs((data as any) ?? []);
  };
  const loadMessages = async (convId: string) => {
    const { data } = await supabase.from("whatsapp_messages")
      .select("id, direction, message_content, message_type, status, sent_at, created_at, metadata")
      .eq("conversation_id", convId).order("created_at", { ascending: true }).limit(500);
    setMessages((data as any) ?? []);
  };

  useEffect(() => {
    void loadConvs();
    const ch = supabase.channel(`employer-wa-${companyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_conversations", filter: `company_id=eq.${companyId}` }, () => void loadConvs())
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_messages", filter: `company_id=eq.${companyId}` }, (p: any) => {
        const convId = p.new?.conversation_id;
        if (convId && convId === selectedRef.current) void loadMessages(convId);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, selectedNumberId]);

  const selectedRef = useRef<string | null>(null);
  useEffect(() => {
    selectedRef.current = selected?.id ?? null;
    if (!selected) { setMessages([]); return; }
    void loadMessages(selected.id);
    if (selected.unread_count) {
      void supabase.from("whatsapp_conversations").update({ unread_count: 0 }).eq("id", selected.id);
    }
  }, [selected?.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages.length]);

  const send = async () => {
    if (!selected || !text.trim()) return;
    setSending(true);
    try {
      await employerWhatsAppAction({ action: "send", conversation_id: selected.id, message: text.trim() });
      setText("");
      void loadMessages(selected.id);
    } catch (e) { toast.error((e as Error).message); }
    finally { setSending(false); }
  };

  const filtered = convs.filter((c) => !search || `${c.contact_name ?? ""} ${c.phone_number}`.toLowerCase().includes(search.toLowerCase()));
  const sessionOpen = selected?.session_expires_at ? new Date(selected.session_expires_at) > new Date() : false;

  return (
    <div className="flex h-[calc(100dvh-8rem)] min-h-[420px] overflow-hidden rounded-lg border bg-card">
      <aside className={cn("w-full md:w-80 md:border-r flex flex-col", selected && "hidden md:flex")}>
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search chats" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No conversations yet. Messages sent to your WhatsApp number will appear here.</p>}
          {filtered.map((c) => (
            <button key={c.id} onClick={() => setParams({ phone: c.phone_number })}
              className={cn("w-full flex items-center gap-3 p-3 text-left border-b hover:bg-muted/50", selected?.id === c.id && "bg-muted")}>
              <Avatar className="w-10 h-10"><AvatarFallback>{(c.contact_name || c.phone_number).slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between gap-2">
                  <p className="font-medium truncate">{c.contact_name || `+${c.phone_number}`}</p>
                  <span className="text-xs text-muted-foreground">{fmtTime(c.last_message_at)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <p className="text-sm text-muted-foreground truncate">{c.last_message_preview}</p>
                  {!!c.unread_count && <span className="rounded-full bg-primary text-primary-foreground text-xs px-2">{c.unread_count}</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      <section className={cn("flex-1 flex flex-col", !selected && "hidden md:flex")}>
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Select a chat to start messaging</div>
        ) : (
          <>
            <header className="flex items-center gap-3 p-3 border-b">
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Back" onClick={() => setParams({})}><ArrowLeft className="w-5 h-5" /></Button>
              <Avatar className="w-9 h-9"><AvatarFallback>{(selected.contact_name || selected.phone_number).slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
              <div className="min-w-0">
                <p className="font-medium truncate">{selected.contact_name || `+${selected.phone_number}`}</p>
                <p className="text-xs text-muted-foreground">+{selected.phone_number}</p>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-muted/30">
              {messages.map((m) => {
                const out = m.direction === "outbound";
                const media = m.metadata?.media_url as string | undefined;
                return (
                  <div key={m.id} className={cn("flex", out ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm", out ? "bg-primary text-primary-foreground" : "bg-card")}>
                      {media && m.message_type === "image" && <img src={media} alt="" className="rounded mb-1 max-h-64" />}
                      {media && m.message_type !== "image" && <a href={media} target="_blank" rel="noreferrer" className="underline block mb-1">{m.metadata?.file_name || "Open attachment"}</a>}
                      {m.message_content && !/^\[.*\]$/.test(m.message_content) && <p className="whitespace-pre-wrap break-words">{m.message_content}</p>}
                      <div className="flex items-center justify-end gap-1 text-[10px] opacity-70 mt-1">
                        {fmtTime(m.sent_at || m.created_at)}
                        {out && (m.status === "read" ? <CheckCheck className="w-3 h-3" /> : m.status === "delivered" ? <CheckCheck className="w-3 h-3 opacity-60" /> : <Check className="w-3 h-3" />)}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
            {sessionOpen ? (
              <form className="flex gap-2 p-3 border-t" onSubmit={(e) => { e.preventDefault(); void send(); }}>
                <Input placeholder="Type a message" value={text} onChange={(e) => setText(e.target.value)} />
                <Button type="submit" size="icon" aria-label="Send" disabled={sending || !text.trim()}>
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </form>
            ) : (
              <p className="p-3 border-t text-xs text-center text-muted-foreground">You can reply within 24 hours of the customer's last message. Wait for them to message you again.</p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
