import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Loader2, MessageCircle, Smartphone } from "lucide-react";

type ExternalConversation = {
  id: string; user_id: string; platform: string; display_name: string;
  last_message: string | null; last_message_at: string | null; updated_at: string;
};
type ExternalMessage = {
  id: string; direction: "incoming" | "outgoing"; body: string;
  delivery_status: string; created_at: string;
};

const platformName = (platform: string) => ({
  whatsapp: "WhatsApp",
  whatsapp_business: "WhatsApp Business",
  instagram: "Instagram",
  facebook: "Facebook",
  messenger: "Messenger",
}[platform] || "External message");

export default function ExternalMessageInboxPanel() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<ExternalConversation | null>(null);
  const conversations = useQuery({
    queryKey: ["external-message-conversations"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Please sign in to view synced messages.");
      const { data, error } = await (supabase as any).from("external_message_conversations")
        .select("id,user_id,platform,display_name,last_message,last_message_at,updated_at")
        .eq("user_id", auth.user.id).order("updated_at", { ascending: false }).limit(100);
      if (error) throw error;
      return (data || []) as ExternalConversation[];
    },
    staleTime: 5000,
  });
  const messages = useQuery({
    queryKey: ["external-message-thread", selected?.id],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("external_message_messages")
        .select("id,direction,body,delivery_status,created_at")
        .eq("conversation_id", selected!.id).order("created_at", { ascending: true }).limit(500);
      if (error) throw error;
      return (data || []) as ExternalMessage[];
    },
  });

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (!active || !data.user) return;
      channel = supabase.channel("external-message-inbox-" + data.user.id)
        .on("postgres_changes", { event: "*", schema: "public", table: "external_message_conversations", filter: "user_id=eq." + data.user.id }, () => {
          queryClient.invalidateQueries({ queryKey: ["external-message-conversations"] });
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "external_message_messages", filter: "user_id=eq." + data.user.id }, () => {
          queryClient.invalidateQueries({ queryKey: ["external-message-thread"] });
          queryClient.invalidateQueries({ queryKey: ["external-message-conversations"] });
        }).subscribe();
    });
    return () => { active = false; if (channel) void supabase.removeChannel(channel); };
  }, [queryClient]);

  if (selected) return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button type="button" onClick={() => setSelected(null)} className="rounded-full p-2 hover:bg-muted" aria-label="Back to external inbox">←</button>
        <div className="min-w-0">
          <p className="truncate font-semibold">{selected.display_name}</p>
          <p className="text-xs text-muted-foreground">{platformName(selected.platform)} · Device notification sync</p>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.isLoading && <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>}
        {messages.error && <p className="text-sm text-destructive">{(messages.error as Error).message}</p>}
        {(messages.data || []).map((message) => (
          <div key={message.id} className={message.direction === "outgoing" ? "flex justify-end" : "flex justify-start"}>
            <div className={message.direction === "outgoing" ? "max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-primary-foreground" : "max-w-[85%] rounded-2xl rounded-bl-sm bg-muted px-3 py-2"}>
              <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>
              <p className="mt-1 text-right text-[10px] opacity-70">
                {format(new Date(message.created_at), "dd MMM, hh:mm a")}
                {message.direction === "outgoing" && message.delivery_status === "submitted_unconfirmed" ? " · Sent to source app (delivery not verified)" : ""}
              </p>
            </div>
          </div>
        ))}
        {!messages.isLoading && !messages.error && (messages.data || []).length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No synced messages in this conversation yet.</p>}
      </div>
      <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
        Replies are sent through supported Android notification actions. The source app controls whether it accepts and delivers each reply.
      </div>
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 font-semibold"><Smartphone className="h-4 w-4" /> Phone message inbox</div>
        <p className="mt-1 text-xs text-muted-foreground">Messages synced from your Android notification panel. This is part of Workly Chat; job chats stay separate.</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {conversations.isLoading && <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>}
        {conversations.error && <p className="p-5 text-sm text-destructive">{(conversations.error as Error).message}</p>}
        {(conversations.data || []).map((conversation) => (
          <button key={conversation.id} type="button" onClick={() => setSelected(conversation)} className="flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left hover:bg-muted/50">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted"><MessageCircle className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{conversation.display_name}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">{conversation.last_message_at ? format(new Date(conversation.last_message_at), "dd MMM, hh:mm a") : ""}</span>
              </div>
              <p className="text-xs text-muted-foreground">{platformName(conversation.platform)}</p>
              <p className="truncate text-sm text-muted-foreground">{conversation.last_message || "No message preview"}</p>
            </div>
          </button>
        ))}
        {!conversations.isLoading && !conversations.error && (conversations.data || []).length === 0 && (
          <div className="p-10 text-center text-muted-foreground">
            <MessageCircle className="mx-auto mb-3 h-9 w-9 opacity-50" />
            <p className="text-sm font-medium">No phone messages synced yet</p>
            <p className="mt-1 text-xs">Enable notification access and cloud sync in Workly Notifications on your Android phone.</p>
          </div>
        )}
      </div>
    </div>
  );
}
