import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { WEBSITE_DOMAIN } from '../_shared/domain.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LINKEDIN_API = 'https://api.linkedin.com';

const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// ------------------------------------------------------- LinkedIn helpers
async function linkedinUserInfo(token: string) {
  const res = await fetch(`${LINKEDIN_API}/v2/userinfo`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`LinkedIn userinfo failed [${res.status}]: ${text}`);
    return { ok: false, status: res.status, error: text };
  }
  return { ok: true, data: JSON.parse(text) };
}

async function linkedinShare(token: string, sub: string, text: string, url?: string) {
  return await linkedinShareImpl(token, sub, text, url);
}

async function linkedinVanityUrl(token: string, sub: string): Promise<string> {
  try {
    const res = await fetch(`${LINKEDIN_API}/v2/me?projection=(id,vanityName)`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const me = await res.json();
      if (me?.vanityName) return `https://www.linkedin.com/in/${me.vanityName}`;
    } else {
      await res.text();
    }
  } catch (_e) {
    // ignore — vanityName needs extra scopes
  }
  return `https://www.linkedin.com/in/${sub}`;
}

async function linkedinShareImpl(token: string, sub: string, text: string, url?: string) {
  const body: any = {
    author: `urn:li:person:${sub}`,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: url ? 'ARTICLE' : 'NONE',
        ...(url ? { media: [{ status: 'READY', originalUrl: url }] } : {}),
      },
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
  };
  const res = await fetch(`${LINKEDIN_API}/v2/ugcPosts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(body),
  });
  const respText = await res.text();
  if (!res.ok) {
    console.error(`LinkedIn share failed [${res.status}]: ${respText}`);
    return { ok: false, status: res.status, error: respText };
  }
  return { ok: true, id: res.headers.get('x-restli-id') || null };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with the user's token to get user info
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();

    if (userError || !user) {
      console.error('❌ Failed to get user:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: userError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client for privileged operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // ------------------------------------------------ LinkedIn actions
    const body = await req.json().catch(() => ({} as any));
    const action = typeof body?.action === 'string' ? body.action : '';

    if (action === 'linkedin-connect') {
      const token = typeof body?.provider_token === 'string' ? body.provider_token : '';
      if (!token) return jsonRes({ success: false, error: 'provider_token required' }, 400);

      const info = await linkedinUserInfo(token);
      if (!info.ok) {
        return jsonRes({ success: false, error: 'LinkedIn profile fetch failed', details: info.error }, info.status || 502);
      }
      const profile: any = info.data;
      const scopes = typeof body?.scopes === 'string' ? body.scopes : 'openid profile email w_member_social';
      const expiresIn = Number(body?.expires_in) > 0 ? Number(body.expires_in) : 60 * 24 * 60 * 60;

      const { error: upsertErr } = await adminClient
        .from('linkedin_connections')
        .upsert({
          user_id: user.id,
          linkedin_sub: profile?.sub || null,
          linkedin_name: profile?.name || null,
          linkedin_email: profile?.email || null,
          linkedin_picture: profile?.picture || null,
          access_token: token,
          expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
          scopes,
          can_post: scopes.includes('w_member_social'),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (upsertErr) {
        console.error('❌ linkedin_connections upsert error:', upsertErr);
        return jsonRes({ success: false, error: upsertErr.message }, 500);
      }

      // Save LinkedIn profile link on both job seeker profile and company profile
      const linkedinLink = await linkedinVanityUrl(token, profile?.sub || '');
      const { error: profLinkErr } = await adminClient
        .from('profiles')
        .update({ linkedin_link: linkedinLink })
        .eq('user_id', user.id);
      if (profLinkErr) console.error('profiles.linkedin_link update error:', profLinkErr.message);
      const { error: compLinkErr } = await adminClient
        .from('companies')
        .update({ linkedin_link: linkedinLink })
        .eq('user_id', user.id);
      if (compLinkErr) console.error('companies.linkedin_link update error:', compLinkErr.message);

      // Backfill company logo from LinkedIn picture if missing
      if (profile?.picture) {
        await adminClient
          .from('companies')
          .update({ logo_url: profile.picture })
          .eq('user_id', user.id)
          .is('logo_url', null);
      }

      return jsonRes({
        success: true,
        connected: true,
        can_post: scopes.includes('w_member_social'),
        linkedin_link: linkedinLink,
        profile: { name: profile?.name, email: profile?.email, picture: profile?.picture },
      });
    }

    if (action === 'linkedin-status') {
      const { data: conn } = await adminClient
        .from('linkedin_connections')
        .select('linkedin_name, linkedin_email, linkedin_picture, expires_at, can_post, auto_post_jobs, last_post_at')
        .eq('user_id', user.id)
        .maybeSingle();
      const expired = conn?.expires_at ? new Date(conn.expires_at).getTime() < Date.now() : true;
      return jsonRes({ success: true, connected: !!conn && !expired, expired, connection: conn || null });
    }

    if (action === 'linkedin-disconnect') {
      await adminClient.from('linkedin_connections').delete().eq('user_id', user.id);
      return jsonRes({ success: true, connected: false });
    }

    if (action === 'linkedin-toggle-auto-post') {
      const enabled = body?.enabled !== false;
      const { error } = await adminClient
        .from('linkedin_connections')
        .update({ auto_post_jobs: enabled })
        .eq('user_id', user.id);
      if (error) return jsonRes({ success: false, error: error.message }, 500);
      return jsonRes({ success: true, auto_post_jobs: enabled });
    }

    if (action === 'linkedin-share-job') {
      const jobId = typeof body?.job_id === 'string' ? body.job_id : '';
      if (!jobId) return jsonRes({ success: false, error: 'job_id required' }, 400);

      const { data: conn } = await adminClient
        .from('linkedin_connections')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!conn?.access_token || !conn?.linkedin_sub) {
        return jsonRes({ success: false, skipped: 'not_connected' });
      }
      if (!conn.can_post) return jsonRes({ success: false, skipped: 'no_post_permission' });
      if (body?.auto !== false && conn.auto_post_jobs === false) {
        return jsonRes({ success: false, skipped: 'auto_post_disabled' });
      }
      if (conn.expires_at && new Date(conn.expires_at).getTime() < Date.now()) {
        return jsonRes({ success: false, skipped: 'token_expired' });
      }

      const { data: job } = await adminClient
        .from('jobs')
        .select('id, title, location, city, job_type, salary_min, salary_max, description, company_id, companies:company_id(company_name, user_id)')
        .eq('id', jobId)
        .maybeSingle();

      if (!job) return jsonRes({ success: false, error: 'Job not found' }, 404);
      if ((job as any)?.companies?.user_id !== user.id) {
        return jsonRes({ success: false, error: 'Forbidden' }, 403);
      }

      const siteUrl = typeof body?.site_url === 'string' && body.site_url.startsWith('http')
        ? body.site_url.replace(/\/$/, '')
        : WEBSITE_DOMAIN;
      const jobUrl = `${siteUrl}/job/${job.id}`;
      const companyName = (job as any)?.companies?.company_name || '';
      const salary = job.salary_min && job.salary_max
        ? `\n💰 Salary: ₹${job.salary_min} - ₹${job.salary_max}`
        : '';
      const text = [
        `🚀 We're hiring: ${job.title}`,
        companyName ? `🏢 ${companyName}` : '',
        job.location || job.city ? `📍 ${job.location || job.city}` : '',
        job.job_type ? `🕒 ${job.job_type}` : '',
        salary.trim(),
        '',
        `Apply here: ${jobUrl}`,
        '',
        '#hiring #jobs #careers',
      ].filter(Boolean).join('\n');

      const shared = await linkedinShare(conn.access_token, conn.linkedin_sub, text, jobUrl);
      if (!shared.ok) {
        return jsonRes({ success: false, error: 'LinkedIn post failed', details: shared.error }, shared.status || 502);
      }

      await adminClient
        .from('linkedin_connections')
        .update({ last_post_at: new Date().toISOString() })
        .eq('user_id', user.id);

      return jsonRes({ success: true, posted: true, post_id: shared.id, url: jobUrl });
    }

    console.log('👤 Processing Google OAuth for employer:', {
      userId: user.id,
      email: user.email,
      provider: user.app_metadata?.provider,
      name: user.user_metadata?.full_name
    });

    // Check if user already has a company
    const { data: existingCompany, error: fetchError } = await adminClient
      .from('companies')
      .select('id, company_name, logo_url, is_profile_complete')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (fetchError) {
      console.error('❌ Error checking existing company:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Database error', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const company = Array.isArray(existingCompany) && existingCompany.length > 0 
      ? existingCompany[0] 
      : null;

    // Resolve avatar from OAuth metadata or linked identities (Google / LinkedIn)
    const meta: any = user.user_metadata || {};
    let avatarUrl: string | null =
      meta.avatar_url ||
      meta.picture ||
      meta.picture_url ||
      meta.avatar ||
      meta.profile_picture ||
      meta.profile_image_url ||
      null;

    if (!avatarUrl) {
      const identities: any[] = (user as any)?.identities || [];
      for (const ident of identities) {
        const id: any = ident?.identity_data || {};
        const url = id.avatar_url || id.picture || id.picture_url || id.avatar || null;
        if (url) { avatarUrl = url; break; }
      }
    }

    if (company) {
      if (!company.logo_url && avatarUrl) {
        await adminClient.from('companies').update({ logo_url: avatarUrl }).eq('id', company.id);
      }
      console.log('✅ Company already exists:', { companyId: company.id, name: company.company_name });
      return new Response(
        JSON.stringify({ 
          success: true, 
          action: 'existing',
          companyId: company.id,
          isProfileComplete: company.is_profile_complete 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create company for the Google OAuth employer
    const companyName = user.user_metadata?.full_name || user.user_metadata?.name || 'My Company';
    const companyEmail = user.email;

    // Default company logo kabhi save nahi karte — logo_url null rehta hai
    // jab tak social DP na mile ya employer khud upload na kare.

    console.log('🔄 Creating company for OAuth employer:', { companyName, companyEmail, hasAvatar: !!avatarUrl });

    const { data: newCompany, error: createError } = await adminClient
      .from('companies')
      .insert({
        user_id: user.id,
        company_name: companyName,
        email: companyEmail,
        logo_url: avatarUrl,
        is_profile_complete: false
      })
      .select('id, company_name, is_profile_complete')
      .single();

    if (createError) {
      console.error('❌ Error creating company:', createError);
      return new Response(
        JSON.stringify({ error: 'Failed to create company', details: createError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update user metadata to mark as employer
    const { error: metadataError } = await adminClient.auth.admin.updateUserById(user.id, {
      user_metadata: { ...user.user_metadata, user_type: 'employer' }
    });

    if (metadataError) {
      console.warn('⚠️ Failed to update user metadata (non-critical):', metadataError);
    }

    console.log('✅ Company created successfully:', { 
      companyId: newCompany.id, 
      companyName: newCompany.company_name 
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        action: 'created',
        companyId: newCompany.id,
        isProfileComplete: false 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
