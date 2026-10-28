/** Instagram Login uses its own Graph API, not Facebook's Graph host. */
export const INSTAGRAM_GRAPH_VERSION = 'v25.0';
export const INSTAGRAM_GRAPH_URL = `https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}`;

type Token = { access_token: string; user_id?: string | number };
export function instagramTokenResponse(raw: unknown): Token {
  const body = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const first = Array.isArray(body.data) ? body.data[0] : undefined;
  const entry = first && typeof first === 'object' ? first as Record<string, unknown> : body;
  if (typeof entry.access_token !== 'string' || !entry.access_token.trim()) {
    throw new Error('Instagram returned no access token');
  }
  return {
    access_token: entry.access_token,
    user_id: typeof entry.user_id === 'string' || typeof entry.user_id === 'number' ? entry.user_id : undefined,
  };
}

/** Meta returns this generic code-100 error when the Instagram account has no access to the app
 *  (app in Development mode / account not an accepted Instagram Tester / permissions not approved). */
export const INSTAGRAM_ACCESS_HELP = 'This Instagram account is not allowed to use the Meta app yet. In Meta Developers → App roles → Roles, add this Instagram account as an Instagram Tester and accept the invite in Instagram (Settings → Website permissions → Apps and websites → Tester invites), or switch the app to Live with Advanced Access for instagram_business_basic, instagram_business_manage_messages and instagram_business_manage_comments. Then connect again.';

async function instagramRequest(stage: string, url: string | URL, init?: RequestInit) {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error || data?.error_message) {
    const message = String(data?.error?.message || data?.error_message || 'Request failed');
    if (/unsupported request - method type/i.test(message)) {
      throw new Error(`Instagram ${stage} [${response.status}]: ${INSTAGRAM_ACCESS_HELP}`);
    }
    throw new Error(`Instagram ${stage} [${response.status}]: ${message}`);
  }
  return data;
}

export async function exchangeInstagramLogin(appId: string, secret: string, code: string, redirectUri: string) {
  const raw = await instagramRequest('code exchange', 'https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: appId, client_secret: secret, grant_type: 'authorization_code', redirect_uri: redirectUri, code: code.replace(/#_$/, '') }),
  });
  const short = instagramTokenResponse(raw);
  const url = new URL('https://graph.instagram.com/access_token');
  url.searchParams.set('grant_type', 'ig_exchange_token');
  url.searchParams.set('client_secret', secret);
  url.searchParams.set('access_token', short.access_token);
  const long = instagramTokenResponse(await instagramRequest('long-lived token exchange', url, { method: 'GET' }));
  const profileUrl = new URL(`${INSTAGRAM_GRAPH_URL}/me`);
  profileUrl.searchParams.set('fields', 'user_id,username,name,profile_picture_url');
  profileUrl.searchParams.set('access_token', long.access_token);
  const profile = await instagramRequest('profile read', profileUrl);
  const userId = profile.user_id || profile.id || short.user_id;
  if (!userId) throw new Error('Instagram returned no account ID');
  return { token: long.access_token, profile, userId: String(userId) };
}