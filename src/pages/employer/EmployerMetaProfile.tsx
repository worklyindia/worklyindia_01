import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhatsAppSubHeader } from "@/components/whatsapp/WhatsAppProfileSections";
import { ChatAccountAvatar, useChatAccountProfile } from "@/components/social/ChatAccountProfile";
import SocialAccountSwitcher from "@/components/social/SocialAccountSwitcher";
import { metaSocialAction, type MetaAccount, type MetaPlatform } from "@/components/social/MetaSocialAIConnectCard";
import type { SocialConnectionInfo, SocialPlatform } from "@/hooks/useSocialConnect";

const FIELD_LABELS: Record<string, string> = {
  description: "Description", category: "Category",
  website: "Website", phone: "Phone", emails: "Email", single_line_address: "Address", location: "Location", hours: "Opening hours",
  followers_count: "Followers", follows_count: "Following", media_count: "Posts", fan_count: "Page likes",
  account_type: "Account type", verification_status: "Verification status", is_verified: "Verified",
  is_published: "Published", can_post: "Can post", rating_count: "Ratings", overall_star_rating: "Overall rating",
};
function formatValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(formatValue).filter(Boolean).join("\n");
  if (value && typeof value === "object") return Object.entries(value).map(([key, v]) => `${key.replace(/_/g, " ")}: ${formatValue(v)}`).join("\n");
  return "";
}
export default function EmployerMetaProfile({ platform, audience }: { platform: MetaPlatform; audience?: "support" }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { account, accounts, profile, picture, name, loading, error, profileError, partial, refreshing, reload } = useChatAccountProfile(platform, null, params.get("account"), audience);
  const label = platform === "instagram" ? "Instagram" : "Facebook";
  const toAccount = (a: MetaAccount): SocialConnectionInfo => ({ platform: platform as SocialPlatform, accountId: a.id,
    accountName: a.name?.startsWith("@") ? label : a.name, accountHandle: a.username, accountPicture: a.picture_url,
    accountEmail: null, followers: 0, following: 0, posts: 0, canPost: false, scopes: null, isDefault: !!a.is_default });
  const select = (id: string) => { const next = new URLSearchParams(params); next.set("account", id); setParams(next, { replace: true }); };
  const returnTo = `/employer/${platform}/profile${account ? `?account=${encodeURIComponent(account.id)}` : ""}`;
  const addPath = audience ? "/owner-portal/customer-service?tab=social" : `/ai-assistant/connect?add=${platform}&return=${encodeURIComponent(returnTo)}`;
  const username = typeof profile?.username === "string" ? profile.username : account?.username;
  const remoteId = profile?.user_id || profile?.id || (platform === "instagram" ? account?.ig_user_id : account?.page_id);
  const bio = platform === "instagram" ? profile?.biography : profile?.about;
  const cover = profile?.cover;
  const coverSource = platform === "facebook" && cover && typeof cover === "object" && "source" in cover && typeof cover.source === "string" && /^https?:\/\//i.test(cover.source) ? cover.source : null;
  const fields: Array<[string, unknown]> = [["Name", name || "Not provided by Meta"], ["Username", username ? `@${username.replace(/^@/, "")}` : null],
    [platform === "instagram" ? "Instagram account ID" : "Facebook Page ID", remoteId]];
  for (const [key, title] of Object.entries(FIELD_LABELS)) if (profile?.[key] !== null && profile?.[key] !== undefined) fields.push([title, profile[key]]);
  if (platform === "facebook" && profile?.business && typeof profile.business === "object") {
    const business = profile.business as Record<string, unknown>;
    fields.push(["Business Name", business.name], ["Business ID", business.id]);
  }
  return <div className="min-h-screen w-full bg-background">
    <WhatsAppSubHeader title={`${label} profile`} fallback={audience ? `/owner-portal/whatsapp/chat?channel=${platform}` : `/employer/workly-chat?channel=${platform}`} />
    <main className="w-full pb-28">
      {account && <SocialAccountSwitcher platform={platform as SocialPlatform} label={label} accounts={accounts.map(toAccount)} current={toAccount(account)}
        onSelect={select} reload={async () => { await reload(); }} addPath={addPath} switchOnly
        onMakeDefault={(id) => metaSocialAction({ ...(audience ? { audience } : {}), action: "set_default", platform, account_id: id })}
        onRemove={async (id) => { await metaSocialAction({ ...(audience ? { audience } : {}), action: "disconnect", platform, account_id: id }); const next = new URLSearchParams(params); next.delete("account"); setParams(next, { replace: true }); }} />}
      <section className="w-full border-b border-border py-4">
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6"><h2 className="text-base font-semibold">{label} account</h2>
          <div className="flex shrink-0 items-center">
          <Button variant="ghost" size="icon" aria-label={`Refresh ${label} profile`} title="Refresh profile" disabled={loading || refreshing} onClick={() => void reload()}><RefreshCw className={`h-5 w-5 ${loading || refreshing ? "animate-spin" : ""}`} /></Button></div></div>
        {account && coverSource && <div className="mt-4 w-full"><img src={coverSource} alt={`${name || label} cover photo`} referrerPolicy="no-referrer" className="block aspect-[820/312] max-h-80 w-full object-cover" /></div>}
        {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : error ? <p role="alert" className="px-4 py-4 text-sm text-destructive sm:px-6">Could not load the {label} profile. Please try again.</p> : !account ? <div className="px-4 py-4 sm:px-6"><p className="mb-3 text-sm text-muted-foreground">No connected {label} account.</p><Button onClick={() => navigate(addPath)}><Plus className="mr-2 h-4 w-4" />Add account</Button></div> : <div className={`flex flex-col items-center gap-3 px-4 pb-6 sm:px-6 ${coverSource ? "relative -mt-12 pt-0" : "pt-6"}`}>
          <ChatAccountAvatar key={account.id} platform={platform} picture={picture} name={name} large className={coverSource ? "border-4 border-background" : ""} /><h2 className="max-w-full break-words text-center text-xl font-semibold [overflow-wrap:anywhere]">{name || label}</h2>
          {username && <span className="max-w-full text-sm text-muted-foreground [overflow-wrap:anywhere]">@{username.replace(/^@/, "")}</span>}
          {typeof bio === "string" && bio.trim() && <p className="w-full max-w-md whitespace-pre-wrap break-words text-center text-sm leading-relaxed [overflow-wrap:anywhere]">{bio}</p>}
          <span className="text-sm text-muted-foreground">{account.status === "disconnected" ? "Disconnected" : "Connected"}</span></div>}
        {profileError && <p role="alert" className="px-4 text-sm text-destructive sm:px-6">{profileError instanceof Error && profileError.message !== "Unknown action" ? profileError.message : "Could not load the latest photo and details from Meta. Please tap refresh."}</p>}
        {partial && <p className="px-4 text-sm text-muted-foreground sm:px-6">Some details are not available for this account from Meta.</p>}
      </section>
      {account && <><section className="w-full"><h2 className="border-b border-border px-4 py-3 text-sm font-semibold sm:px-6">Profile details</h2>
        <dl>{fields.filter(([, v]) => v !== null && v !== undefined && v !== "").map(([title, value]) => <div key={title} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 border-b border-border px-4 py-4 text-sm sm:px-6"><dt className="text-muted-foreground">{title}</dt><dd className="whitespace-pre-wrap text-right font-medium [overflow-wrap:anywhere]">{formatValue(value)}</dd></div>)}</dl></section>
      </>}
    </main>
  </div>;
}
