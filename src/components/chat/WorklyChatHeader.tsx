import { ArrowLeft, LayoutTemplate, Plus, RefreshCw } from "lucide-react";
import { useChatStatusBarTheme } from "@/hooks/useChatStatusBarTheme";
import { Button } from "@/components/ui/button";
import { ChatAccountAvatar, type ChatPlatform } from "@/components/social/ChatAccountProfile";

type Props = {
  channel: ChatPlatform; connected: boolean; picture?: string | null; name?: string | null; refreshing: boolean;
  onBack: () => void; onRefresh: () => void; onNewChat: () => void;
  onProfile: () => void; onTemplates: () => void; onChannel: (channel: ChatPlatform) => void;
};
export default function WorklyChatHeader(props: Props) {
  useChatStatusBarTheme();
  const label = props.channel === "whatsapp" ? "WhatsApp" : props.channel === "instagram" ? "Instagram" : "Facebook";
  return <>
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-whatsapp-border bg-whatsapp-panel px-3 py-3">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" aria-label="Back" title="Back" className="h-10 w-10 text-muted-foreground" onClick={props.onBack}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-xl font-semibold text-whatsapp-green">Workly Chat</h1>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="Refresh chats" title="Refresh chats" className="h-10 w-10 text-muted-foreground" onClick={props.onRefresh} disabled={props.refreshing}><RefreshCw className={`h-5 w-5 ${props.refreshing ? "animate-spin" : ""}`} /></Button>
        {props.channel === "whatsapp" && <Button variant="ghost" size="icon" aria-label="New WhatsApp chat" title="New WhatsApp chat" className="h-10 w-10 text-muted-foreground" onClick={props.onNewChat}><Plus className="h-5 w-5" /></Button>}
        {props.connected && <Button variant="ghost" size="icon" aria-label={`${label} profile`} title={`${label} profile`} className="h-10 w-10 text-muted-foreground" onClick={props.onProfile}><ChatAccountAvatar platform={props.channel} picture={props.picture} name={props.name} /></Button>}
        {props.channel === "whatsapp" && <Button variant="ghost" size="icon" aria-label="Templates" title="Templates" className="h-10 w-10 text-muted-foreground" onClick={props.onTemplates}><LayoutTemplate className="h-5 w-5" /></Button>}
      </div>
    </div>
    <div role="tablist" aria-label="Chat platform" className="grid grid-cols-3 border-b border-whatsapp-border bg-whatsapp-panel">
      {(["whatsapp", "instagram", "facebook"] as const).map((channel) => <Button key={channel} role="tab" variant="ghost" aria-selected={props.channel === channel} onClick={() => props.onChannel(channel)} className={`h-auto rounded-none border-b-2 py-3 text-sm font-medium ${props.channel === channel ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>{channel === "whatsapp" ? "WhatsApp" : channel === "instagram" ? "Instagram" : "Facebook"}</Button>)}
    </div>
  </>;
}
