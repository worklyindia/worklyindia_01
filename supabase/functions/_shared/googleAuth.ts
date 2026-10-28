// Shared Google Authentication utilities for Sheets, Drive, and Analytics APIs

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  project_id?: string;
}

// Google API Scopes
export const GOOGLE_SCOPES = {
  SHEETS: 'https://www.googleapis.com/auth/spreadsheets',
  DRIVE: 'https://www.googleapis.com/auth/drive',
  DRIVE_FILE: 'https://www.googleapis.com/auth/drive.file',
  ANALYTICS: 'https://www.googleapis.com/auth/analytics.readonly',
  INDEXING: 'https://www.googleapis.com/auth/indexing'
};

/**
 * Parse and validate the service account key
 */
export function parseServiceAccountKey(): ServiceAccountCredentials {
  const serviceAccountKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
  
  if (!serviceAccountKey) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not configured');
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountKey);
    if (!serviceAccount.client_email || !serviceAccount.private_key) {
      throw new Error('Invalid service account structure - missing client_email or private_key');
    }
    return serviceAccount;
  } catch (parseError) {
    throw new Error(`Failed to parse service account key: ${parseError}`);
  }
}

/**
 * Get Google access token using service account JWT
 */
export async function getGoogleAccessToken(
  serviceAccount: ServiceAccountCredentials,
  scopes: string | string[]
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600;

  const scopeString = Array.isArray(scopes) ? scopes.join(' ') : scopes;

  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };

  const payload = {
    iss: serviceAccount.client_email,
    scope: scopeString,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: expiry
  };

  const jwt = await createSignedJWT(header, payload, serviceAccount.private_key);

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const tokenData: GoogleTokenResponse = await tokenResponse.json();
  return tokenData.access_token;
}

/**
 * Create signed JWT for Google OAuth
 */
async function createSignedJWT(header: any, payload: any, privateKey: string): Promise<string> {
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const pemContents = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '');
  
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signatureInput)
  );

  const encodedSignature = base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));

  return `${signatureInput}.${encodedSignature}`;
}

/**
 * Base64 URL encode
 */
function base64UrlEncode(str: string): string {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * CORS headers for edge functions
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
