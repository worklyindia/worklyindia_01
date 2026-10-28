import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Details = {
  authorization_id: string;
  redirect_uri: string;
  client: { client_name?: string; client_uri?: string; logo_uri?: string; [k: string]: unknown };
  user: { id: string; email: string };
  scope: string;
};

const scopeText: Record<string, string> = {
  openid: "Confirm your identity",
  email: "See your email address",
  profile: "See your basic profile (name, photo)",
};

const OAuthConsent = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const authorizationId = params.get("authorization_id");
  const [details, setDetails] = useState<Details | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!authorizationId) { setError("Missing authorization_id in the link."); return; }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const back = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
        navigate(`/auth?redirect=${encodeURIComponent(back)}`, { replace: true });
        return;
      }
      const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
      if (error) { setError(error.message); return; }
      if (data && "redirect_url" in data && !("client" in data)) {
        window.location.href = (data as { redirect_url: string }).redirect_url;
        return;
      }
      setDetails(data as unknown as Details);
    })();
  }, [authorizationId, navigate]);

  const decide = async (approve: boolean) => {
    if (!authorizationId) return;
    setBusy(true);
    const res = approve
      ? await supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
      : await supabase.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });
    if (res.error || !res.data?.redirect_url) {
      setBusy(false);
      setError(res.error?.message ?? "Could not finish the request.");
      return;
    }
    window.location.href = res.data.redirect_url;
  };

  const appName = details?.client?.client_name || "This app";
  let host = "";
  try { host = details ? new URL(details.redirect_uri).host : ""; } catch { host = details?.redirect_uri ?? ""; }

  const requestedScopes = (details?.scope || "openid").split(" ").filter(Boolean);
  const asksPhone = requestedScopes.includes("phone");

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8 text-foreground">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="text-lg font-semibold">Sign in with Workly India</h1>
        </div>

        {error ? (
          <p className="mt-4 text-sm text-destructive">{error}</p>
        ) : !details ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : (
          <>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              <strong className="text-foreground">{appName}</strong> wants to access your Workly India account
              <span className="block break-all">({details.user.email})</span>
            </p>
            <p className="mt-4 text-sm font-medium">It will be able to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {requestedScopes.filter((s) => s !== "phone").map((s) => <li key={s}>{scopeText[s] ?? s}</li>)}
            </ul>
            {asksPhone && (
              <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm leading-6 text-destructive">
                This app asked for your phone number. Workly India does not share phone numbers, so this request cannot be approved.
                Deny it and ask the app to use only <code>openid</code>, <code>email</code> and <code>profile</code>.
              </p>
            )}
            <p className="mt-4 break-all text-xs text-muted-foreground">You will be sent back to {host}</p>
            <div className="mt-6 flex gap-2">
              <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>Deny</Button>
              <Button className="flex-1" disabled={busy || asksPhone} onClick={() => decide(true)}>Allow</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default OAuthConsent;
