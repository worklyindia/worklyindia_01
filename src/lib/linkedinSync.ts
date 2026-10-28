import { supabase } from "@/integrations/supabase/client";

/**
 * Saves the LinkedIn connection (token + profile link) whenever the user
 * signs in with LinkedIn — works for both job seekers and employers.
 * Safe to call on every auth event: it de-dupes per provider token.
 */
export async function syncLinkedInFromSession(session: any): Promise<void> {
  try {
    if (!session?.user || !session?.access_token) return;

    const providerToken: string | null = session.provider_token || null;
    if (!providerToken) return;

    const providers: string[] = session.user?.app_metadata?.providers || [];
    const isLinkedIn =
      session.user?.app_metadata?.provider === "linkedin_oidc" ||
      providers.includes("linkedin_oidc");
    if (!isLinkedIn) return;

    // De-dupe: only sync once per provider token per tab session
    const key = `li_sync_${providerToken.slice(-24)}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* ignore storage errors */
    }

    const { data, error } = await supabase.functions.invoke("employer-google-auth", {
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: {
        action: "linkedin-connect",
        provider_token: providerToken,
        expires_in: session.expires_in,
        scopes: "openid profile email w_member_social",
      },
    });
    console.log("🔗 LinkedIn sync:", { data, error });
  } catch (e) {
    console.warn("LinkedIn sync failed (non-critical):", e);
  }
}
