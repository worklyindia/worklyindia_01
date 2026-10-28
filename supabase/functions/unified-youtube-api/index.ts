import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GROWTH_ACTIONS, handleGrowthAction, type GrowthAction } from "../_shared/youtubeGrowth.ts";
import { AUTOREPLY_ACTIONS, handleAutoReplyAction, type AutoReplyAction } from "../_shared/youtubeAutoReply.ts";
import { SEO_ACTIONS, handleSeoAction, type SeoAction } from "../_shared/youtubeSeo.ts";
import { getOwnerSecretJson } from "../_shared/ownerSecrets.ts";


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface YouTubeRequest {
  action: 'search' | 'video' | 'channel' | 'embed' | 'test' | 'comments' | GrowthAction | AutoReplyAction | SeoAction;
  query?: string;
  videoId?: string;
  channelId?: string;
  maxResults?: number;
  pageToken?: string;
}



// Base64URL encode for JWT
function base64urlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Create JWT for Service Account authentication
async function createJWT(serviceAccount: any): Promise<string> {
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/youtube.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600 // 1 hour
  };

  const headerB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Parse private key and sign
  const privateKeyPem = serviceAccount.private_key;
  const pemContents = privateKeyPem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
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
    new TextEncoder().encode(unsignedToken)
  );

  const signatureB64 = base64urlEncode(new Uint8Array(signature));
  return `${unsignedToken}.${signatureB64}`;
}

// Get access token using Service Account
async function getAccessToken(serviceAccount: any): Promise<string> {
  const jwt = await createJWT(serviceAccount);
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[YouTube API] Token exchange failed:', error);
    throw new Error(`Token exchange failed: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, query, videoId, channelId, maxResults = 10, pageToken } = body as YouTubeRequest;
    console.log(`[YouTube API] Action: ${action}`);

    // ---- YouTube AI SEO Master (per-user OAuth, read + suggest, never deletes) ----
    if (SEO_ACTIONS.includes(action as SeoAction)) {
      try {
        const payload = await handleSeoAction(action as SeoAction, body, req);
        return new Response(JSON.stringify(payload), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[YouTube SEO] Error:', msg);
        return new Response(JSON.stringify({
          success: false,
          code: msg.startsWith('AUTH_REQUIRED')
            ? 'AUTH_REQUIRED'
            : msg.includes('setup pending') ? 'YT_SETUP_REQUIRED' : 'YT_ERROR',
          error: msg,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // ---- YouTube AI Auto-Reply (per-user OAuth, comments.insert) ----

    if (AUTOREPLY_ACTIONS.includes(action as AutoReplyAction)) {

      try {
        const payload = await handleAutoReplyAction(action as AutoReplyAction, body, req);
        return new Response(JSON.stringify(payload), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[YouTube AutoReply] Error:', msg);
        return new Response(JSON.stringify({
          success: false,
          code: msg.startsWith('AUTH_REQUIRED') ? 'AUTH_REQUIRED' : 'YT_ERROR',
          error: msg,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // ---- YouTube Growth Coach (per-user OAuth, read-only analytics) ----
    if (GROWTH_ACTIONS.includes(action as GrowthAction)) {
      try {
        const payload = await handleGrowthAction(action as GrowthAction, body, req);
        return new Response(JSON.stringify(payload), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[YouTube Growth] Error:', msg);
        // Always return 200 so the browser SDK surfaces this readable message
        // instead of a generic "Edge Function returned a non-2xx status code".
        return new Response(JSON.stringify({
          success: false,
          code: msg.startsWith('AUTH_REQUIRED')
            ? 'AUTH_REQUIRED'
            : msg.includes('setup pending') ? 'YT_SETUP_REQUIRED' : 'YT_ERROR',
          error: msg,
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

    }

    // Prefer the JSON saved on the Owner Secrets page, fall back to env secret
    const ownerSa = await getOwnerSecretJson('YOUTUBE_DATA_API_JSON');
    const serviceAccount = ownerSa ?? (() => {
      const envJson = Deno.env.get('YOUTUBE_SERVICE_ACCOUNT');
      if (!envJson) {
        throw new Error('YouTube Data API v3 JSON not configured — save it on the Owner Secrets page (YouTube Data API v3 JSON).');
      }
      return JSON.parse(envJson);
    })();
    console.log(`[YouTube API] Using service account: ${serviceAccount.client_email}`);


    // Test action - verify service account works
    if (action === 'test') {
      try {
        const accessToken = await getAccessToken(serviceAccount);
        console.log('[YouTube API] Access token obtained successfully');
        
        // Test with a simple API call - get most popular videos
        const testResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=snippet&chart=mostPopular&maxResults=1&regionCode=IN`,
          {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          }
        );
        
        if (!testResponse.ok) {
          const error = await testResponse.text();
          throw new Error(`API test failed: ${error}`);
        }
        
        const testData = await testResponse.json();
        
        return new Response(JSON.stringify({
          success: true,
          message: 'YouTube Data API v3 working with Service Account!',
          serviceAccount: serviceAccount.client_email,
          testVideo: testData.items?.[0]?.snippet?.title || 'Test successful',
          quota_used: 1
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[YouTube API] Test failed:', error);
        return new Response(JSON.stringify({
          success: false,
          error: errMsg,
          serviceAccount: serviceAccount.client_email
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Get access token for API calls
    const accessToken = await getAccessToken(serviceAccount);
    const baseUrl = 'https://www.googleapis.com/youtube/v3';
    const authHeaders = { 'Authorization': `Bearer ${accessToken}` };

    let result: any;

    switch (action) {
      case 'search':
        if (!query) throw new Error('Query is required for search');
        
        let searchUrl = `${baseUrl}/search?part=snippet&type=video&q=${encodeURIComponent(query)}&maxResults=${maxResults}&regionCode=IN&relevanceLanguage=hi`;
        if (pageToken) searchUrl += `&pageToken=${pageToken}`;
        
        const searchRes = await fetch(searchUrl, { headers: authHeaders });
        const searchData = await searchRes.json();
        
        if (searchData.error) {
          throw new Error(searchData.error.message);
        }
        
        result = {
          success: true,
          totalResults: searchData.pageInfo?.totalResults,
          resultsPerPage: searchData.pageInfo?.resultsPerPage,
          nextPageToken: searchData.nextPageToken,
          prevPageToken: searchData.prevPageToken,
          items: searchData.items?.map((item: any) => ({
            videoId: item.id.videoId,
            title: item.snippet.title,
            description: item.snippet.description,
            thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
            channelTitle: item.snippet.channelTitle,
            channelId: item.snippet.channelId,
            publishedAt: item.snippet.publishedAt
          }))
        };
        break;

      case 'video':
        if (!videoId) throw new Error('videoId is required');
        
        const videoUrl = `${baseUrl}/videos?part=snippet,statistics,contentDetails,player&id=${videoId}`;
        const videoRes = await fetch(videoUrl, { headers: authHeaders });
        const videoData = await videoRes.json();
        
        if (videoData.error) {
          throw new Error(videoData.error.message);
        }
        
        const video = videoData.items?.[0];
        if (!video) {
          throw new Error('Video not found');
        }
        
        result = {
          success: true,
          video: {
            id: video.id,
            title: video.snippet.title,
            description: video.snippet.description,
            thumbnail: video.snippet.thumbnails.high?.url || video.snippet.thumbnails.medium?.url,
            channelTitle: video.snippet.channelTitle,
            channelId: video.snippet.channelId,
            publishedAt: video.snippet.publishedAt,
            tags: video.snippet.tags || [],
            duration: video.contentDetails.duration,
            definition: video.contentDetails.definition,
            statistics: {
              viewCount: parseInt(video.statistics.viewCount || '0'),
              likeCount: parseInt(video.statistics.likeCount || '0'),
              commentCount: parseInt(video.statistics.commentCount || '0')
            },
            embedHtml: video.player?.embedHtml
          }
        };
        break;

      case 'comments': {
        if (!videoId) throw new Error('videoId is required');

        const commentsUrl = `${baseUrl}/commentThreads?part=snippet&videoId=${videoId}&maxResults=${Math.min(Math.max(maxResults, 1), 50)}&order=relevance&textFormat=plainText`;
        const commentsRes = await fetch(commentsUrl, { headers: authHeaders });
        const commentsData = await commentsRes.json();

        if (commentsData.error) {
          // Comments disabled ya quota — soft fail, empty list
          result = { success: true, comments: [], note: commentsData.error.message };
          break;
        }

        result = {
          success: true,
          comments: (commentsData.items || []).map((item: any) => {
            const c = item.snippet?.topLevelComment?.snippet || {};
            return {
              author: c.authorDisplayName,
              text: c.textDisplay || c.textOriginal || '',
              likeCount: c.likeCount || 0,
              publishedAt: c.publishedAt,
              replyCount: item.snippet?.totalReplyCount || 0,
            };
          }),
        };
        break;
      }

      case 'channel':
        if (!channelId) throw new Error('channelId is required');
        
        const channelUrl = `${baseUrl}/channels?part=snippet,statistics,brandingSettings&id=${channelId}`;
        const channelRes = await fetch(channelUrl, { headers: authHeaders });
        const channelData = await channelRes.json();
        
        if (channelData.error) {
          throw new Error(channelData.error.message);
        }
        
        const channel = channelData.items?.[0];
        if (!channel) {
          throw new Error('Channel not found');
        }
        
        result = {
          success: true,
          channel: {
            id: channel.id,
            title: channel.snippet.title,
            description: channel.snippet.description,
            customUrl: channel.snippet.customUrl,
            thumbnail: channel.snippet.thumbnails.high?.url || channel.snippet.thumbnails.medium?.url,
            country: channel.snippet.country,
            publishedAt: channel.snippet.publishedAt,
            statistics: {
              subscriberCount: parseInt(channel.statistics.subscriberCount || '0'),
              videoCount: parseInt(channel.statistics.videoCount || '0'),
              viewCount: parseInt(channel.statistics.viewCount || '0')
            },
            bannerUrl: channel.brandingSettings?.image?.bannerExternalUrl
          }
        };
        break;

      case 'embed':
        if (!videoId) throw new Error('videoId is required for embed');
        
        result = {
          success: true,
          embed: {
            videoId: videoId,
            embedUrl: `https://www.youtube.com/embed/${videoId}`,
            watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
            thumbnails: {
              default: `https://img.youtube.com/vi/${videoId}/default.jpg`,
              medium: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
              high: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
              maxres: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
            },
            iframeHtml: `<iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
          }
        };
        break;

      default:
        throw new Error(`Unknown action: ${action}. Valid actions: test, search, video, channel, embed, comments`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[YouTube API] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
