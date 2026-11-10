type TokenOwner = {
  id: string;
  name?: string;
  handle?: string;
  picture?: string;
  email?: string;
};

// Identity requests must use only the supplied user's token, never app credentials.
export async function identifyTokenOwner(
  platform: string,
  accessToken: string,
  request: typeof fetch = fetch,
): Promise<TokenOwner | null> {
  const endpoints: Record<string, string> = {
    x: 'https://api.x.com/2/users/me?user.fields=profile_image_url',
    linkedin: 'https://api.linkedin.com/v2/userinfo',
    github: 'https://api.github.com/user',
    gitlab: 'https://gitlab.com/api/v4/user',
  };
  const endpoint = endpoints[platform];
  // Other platforms retain their existing provider-specific linking metadata.
  if (!endpoint) return null;
  const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` };
  if (platform === 'github') {
    headers.Accept = 'application/vnd.github+json';
    headers['X-GitHub-Api-Version'] = '2022-11-28';
    headers['User-Agent'] = 'WorklyIndia-AI';
  }
  const response = await request(endpoint, { headers });
  if (!response.ok) throw new Error(`RECONNECT_REQUIRED: ${platform} account identity unavailable (${response.status})`);
  const json = await response.json();
  const profile = platform === 'x' ? json.data : json;
  const id = platform === 'linkedin' ? profile?.sub : profile?.id;
  if (id === undefined || id === null || String(id).trim() === '') {
    throw new Error(`RECONNECT_REQUIRED: ${platform} account identity missing`);
  }
  return {
    id: String(id),
    name: profile.name,
    handle: profile.username || profile.login || profile.email,
    picture: profile.profile_image_url || profile.picture || profile.avatar_url,
    email: profile.email,
  };
}