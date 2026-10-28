import { metaChatRequest, metaChatScope } from "@/lib/metaChatScope";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { waInvoke, CHAT_AUDIENCE } from "@/lib/whatsappAudience";
import { UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { employerWhatsAppAction } from "@/components/employer/whatsapp/useEmployerWhatsApp";
import { metaSocialAction, type MetaAccount, type MetaPlatform } from "./MetaSocialAIConnectCard";
export type ChatPlatform = "whatsapp" | MetaPlatform;
export function useChatAccountProfile(platform: ChatPlatform, phoneNumberId?: string | null, accountId?: string | null, audience?: "support") {
  const client = useQueryClient();
  const scope = metaChatScope(audience);
  const action = (body: Record<string, unknown>) => metaSocialAction(metaChatRequest(body, audience));
  const meta = useQuery({ queryKey: ["chat-meta-accounts", scope], enabled: platform !== "whatsapp", staleTime: 60_000,
    queryFn: async () => (await action({ action: "status" })).accounts as MetaAccount[] });
  const whatsapp = useQuery({ queryKey: ["chat-whatsapp-profile", scope, phoneNumberId], enabled: platform === "whatsapp" && !!phoneNumberId, staleTime: 60_000,
    queryFn: async () => {
      if (!audience) return (await employerWhatsAppAction({ action: "get_profile", phone_number_id: phoneNumberId })).profile as { profile_picture_url?: string; verified_name?: string };
      const { data, error } = await waInvoke("whatsapp-cloud-api", { body: { action: "get_profile", audience: CHAT_AUDIENCE } });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Could not load WhatsApp profile");
      return data.profile as { profile_picture_url?: string; verified_name?: string };
    } });
  const accounts = (meta.data ?? []).filter((a) => a.platform === platform);
  const account = accounts.find((a) => a.id === accountId) ?? accounts.find((a) => (a as MetaAccount & { is_default?: boolean }).is_default) ?? accounts[0] ?? null;
  const details = useQuery({ queryKey: ["chat-meta-profile", scope, platform, account?.id], enabled: platform !== "whatsapp" && !!account,
    staleTime: 60_000, retry: false, queryFn: async () => {
      if (!account) throw new Error("No connected account");
      const data = await action({ action: "get_profile", platform, account_id: account.id });
      const profile = data.profile as Record<string, unknown>;
      client.setQueryData<MetaAccount[]>(["chat-meta-accounts", scope], (old) => old?.map((a) => a.id === account.id ? { ...a,
        name: typeof profile.name === "string" ? profile.name : a.name,
        username: typeof profile.username === "string" ? profile.username : a.username,
        picture_url: typeof profile.picture_url === "string" ? profile.picture_url : a.picture_url } : a));
      return { profile, partial: !!data.partial };
    } });
  const profile = details.data?.profile;
  const metaName = typeof profile?.name === "string" ? profile.name : account?.name?.startsWith("@") ? null : account?.name;
  return { account, accounts, profile, partial: details.data?.partial, profileError: details.error, refreshing: details.isFetching, picture: platform === "whatsapp" ? whatsapp.data?.profile_picture_url : typeof profile?.picture_url === "string" ? profile.picture_url : account?.picture_url,
    name: platform === "whatsapp" ? whatsapp.data?.verified_name : metaName,
    loading: platform === "whatsapp" ? whatsapp.isLoading : meta.isLoading,
    error: platform === "whatsapp" ? whatsapp.error : meta.error,
    reload: platform === "whatsapp" ? whatsapp.refetch : async () => { await meta.refetch(); await details.refetch(); } };
}
export function ChatAccountAvatar({ platform, picture, name, large = false, className = "" }: { platform: ChatPlatform; picture?: string | null; name?: string | null; large?: boolean; className?: string }) {
  return <Avatar className={`${large ? "h-24 w-24 shrink-0" : "h-7 w-7 shrink-0"} ${className}`}>
    <AvatarImage src={picture || undefined} referrerPolicy="no-referrer" alt={`${name || platform} profile picture`} className="object-cover" />
    <AvatarFallback className="bg-muted text-muted-foreground">{platform === "whatsapp" ? <UserRound className={large ? "h-10 w-10" : "h-5 w-5"} /> : null}</AvatarFallback>
  </Avatar>;
}
