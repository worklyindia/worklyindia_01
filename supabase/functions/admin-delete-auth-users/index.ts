import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CANONICAL_DOMAIN } from '../_shared/domain.ts';
import { fanoutLifecycleChannels } from '../_shared/lifecycleFanout.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const OWNER_EMAIL = "gohilvishal7600@gmail.com";
const SUPPORT_EMAIL = `contact@${CANONICAL_DOMAIN}`;

/**
 * Fetch a user's display name + email.
 * Audience must follow the RECIPIENT's real side: every signup gets a profiles
 * row (including employers), so only a companies row proves "employer".
 */
async function getUserContact(adminClient: any, userId: string): Promise<{ name: string; email: string | null; audience: 'job_seeker' | 'employer' }> {
  const { data: c } = await adminClient.from('companies').select('company_name, email').eq('user_id', userId).maybeSingle();
  const { data: p } = await adminClient.from('profiles').select('full_name, email').eq('user_id', userId).maybeSingle();
  if (c) return { name: c.company_name || 'User', email: c.email || p?.email || null, audience: 'employer' };
  if (p) return { name: p.full_name || 'User', email: p.email || null, audience: 'job_seeker' };
  return { name: 'User', email: null, audience: 'job_seeker' };
}

/**
 * Ban / unban notification for an Auth user.
 * Uses the owner-editable Email + Telegram + Push templates.
 */
async function sendBanNotification(
  adminClient: any,
  userId: string,
  name: string,
  email: string | null,
  audience: 'job_seeker' | 'employer',
  banned: boolean,
) {
  const now = new Date();
  const date = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).format(now);
  const time = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }).format(now);
  const templateKey = audience === 'employer'
    ? (banned ? 'account_banned_employer' : 'account_unbanned_employer')
    : (banned ? 'account_banned_job_seeker' : 'account_unbanned_job_seeker');
  const fallbackTitle = banned
    ? 'Your Workly India account has been suspended'
    : 'Your Workly India account is active again';
  const fallbackMessage = banned
    ? `Hi ${name}, your Workly India account has been suspended by our team. If you believe this is an error, contact ${SUPPORT_EMAIL}.`
    : `Hi ${name}, the suspension on your Workly India account has been removed. You can sign in again.`;

  try {
    await fanoutLifecycleChannels(adminClient, {
      userId,
      templateKey,
      email,
      channels: ['email', 'telegram'],
      bypassPreferences: true,
      variables: { name, company: name, email: email || '', date, time, reason: 'Reviewed by the Workly India team' },
      fallbackTitle,
      fallbackMessage,
    });
  } catch (e: any) {
    console.error('Ban notification error:', e?.message || e);
  }

  // Push is only useful when the account is restored (banned users are signed out)
  if (!banned) {
    try {
      await adminClient.functions.invoke('email-api', {
        body: {
          action: 'send_push',
          user_id: userId,
          event_type: templateKey,
          title: fallbackTitle,
          message: fallbackMessage,
          action_url: audience === 'employer' ? '/employer/dashboard' : '/jobs',
          variables: { name, company: name, email: email || '', reason: 'Reviewed by the Workly India team' },
          skip_fanout: true,
        },
      });
    } catch (e: any) {
      console.error('Ban push error:', e?.message || e);
    }
  }
}

async function sendDeleteEmail(adminClient: any, userId: string, name: string, email: string, audience: 'job_seeker' | 'employer') {
  const now = new Date();
  const date = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).format(now);
  const time = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).format(now);
  await fanoutLifecycleChannels(adminClient, {
    userId,
    templateKey: audience === 'employer' ? 'employer_account_deleted' : 'job_seeker_account_deleted',
    email,
    channels: ['email'],
    bypassPreferences: true,
    variables: { name, company: name, email, date, time },
    fallbackTitle: 'Your Workly India account has been deleted',
    fallbackMessage: `Hi ${name}, your Workly India account has been permanently deleted. If this was unexpected, contact ${SUPPORT_EMAIL}.`,
  });
}

/** Best-effort delete from a child table; never throws. */
async function safeDelete(adminClient: any, table: string, column: string, uid: string) {
  try {
    const { error } = await adminClient.from(table).delete().eq(column, uid);
    if (error) console.warn(`[cleanup] ${table}.${column} -> ${error.message}`);
  } catch (e: any) {
    console.warn(`[cleanup] ${table}.${column} threw -> ${e?.message || e}`);
  }
}

/** Broadcast a deletion event so the client can auto-logout. */
async function broadcastDeletion(adminClient: any, uid: string) {
  try {
    const channel = adminClient.channel(`account-${uid}`);
    await channel.send({ type: 'broadcast', event: 'account_deleted', payload: { user_id: uid, at: new Date().toISOString() } });
    await adminClient.removeChannel(channel);
  } catch (e) {
    console.warn('Broadcast deletion failed (non-critical):', e);
  }
}

/** Full cleanup + auth deletion for one user. Returns true on success. */
async function deleteUserComplete(adminClient: any, uid: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Broadcast first so the active client logs out immediately
    await broadcastDeletion(adminClient, uid);

    // Storage cleanup
    for (const bucket of ['profile-photos', 'job-images']) {
      try {
        const { data: files } = await adminClient.storage.from(bucket).list(`${uid}/`);
        if (files && files.length > 0) {
          const filePaths = files.map((f: any) => `${uid}/${f.name}`);
          await adminClient.storage.from(bucket).remove(filePaths);
        }
      } catch (storageErr) {
        console.warn(`Storage cleanup warning for ${bucket}/${uid}/:`, storageErr);
      }
    }

    // Look up company id (jobs FK by company_id)
    let companyId: string | null = null;
    try {
      const { data: c } = await adminClient.from('companies').select('id').eq('user_id', uid).maybeSingle();
      companyId = c?.id || null;
    } catch (_e) { /* ignore */ }

    // Cascade jobs owned by this user's company
    if (companyId) {
      try {
        const { data: jobs } = await adminClient.from('jobs').select('id').eq('company_id', companyId);
        const jobIds = (jobs || []).map((j: any) => j.id);
        if (jobIds.length) {
          for (const t of ['job_applicant_views', 'job_applications', 'job_favorites', 'saved_jobs', 'job_boosts', 'job_images', 'job_comments', 'job_interactions', 'job_indexing_status']) {
            try { await adminClient.from(t).delete().in('job_id', jobIds); } catch (_e) {}
          }
          await adminClient.from('jobs').delete().eq('company_id', companyId);
        }
      } catch (e) { console.warn('Job cascade warn:', e); }
    }

    // Per-user dependent rows (best-effort)
    const userColumnTables: Array<[string, string]> = [
      ['job_applications', 'applicant_id'],
      ['saved_jobs', 'user_id'],
      ['job_favorites', 'user_id'],
      ['job_interactions', 'user_id'],
      ['company_favorites', 'user_id'],
      ['company_interactions', 'user_id'],
      ['company_reviews', 'user_id'],
      ['notifications', 'user_id'],
      ['notifications', 'sender_id'],
      ['employer_notifications', 'user_id'],
      ['employer_settings', 'user_id'],
      ['user_settings', 'user_id'],
      ['user_roles', 'user_id'],
      ['user_preferences_tracking', 'user_id'],
      ['user_resumes', 'user_id'],
      ['user_shares', 'user_id'],
      ['user_certificates', 'user_id'],
      ['user_assessment_attempts', 'user_id'],
      ['user_notification_tokens', 'user_id'],
      ['user_scheduled_notifications', 'user_id'],
      ['user_engagement_state', 'user_id'],
      ['user_notification_intelligence', 'user_id'],
      ['user_push_quota', 'user_id'],
      ['conversations', 'employer_id'],
      ['conversations', 'applicant_id'],
      ['interviews', 'host_user_id'],
      ['interviews', 'applicant_id'],
      ['interview_participants', 'user_id'],
      ['chat_messages', 'sender_id'],
      ['referral_codes', 'user_id'],
      ['referral_commissions', 'user_id'],
      ['referral_wallets', 'user_id'],
      ['referral_withdrawal_requests', 'user_id'],
      ['referral_wallet_adjustments', 'user_id'],
      ['user_referrals', 'referrer_id'],
      ['user_referrals', 'referred_user_id'],
      ['transactions', 'user_id'],
      ['job_payments', 'user_id'],
      ['verification_purchases', 'user_id'],
      ['support_tickets', 'user_id'],
      ['education_entries', 'user_id'],
      ['certifications', 'user_id'],
      ['professional_experiences', 'user_id'],
      ['job_alert_preferences', 'user_id'],
      ['search_history', 'user_id'],
      ['behavioral_tracking', 'user_id'],
      ['account_deletion_requests', 'user_id'],
      ['profile_reminder_logs', 'user_id'],
      ['employer_profile_drafts', 'user_id'],
      ['job_seeker_profile_drafts', 'user_id'],
      ['employer_metrics', 'user_id'],
      ['device_info_logs', 'user_id'],
      ['fingerprint_change_logs', 'user_id'],
      ['onesignal_sessions', 'user_id'],
      ['push_notification_preferences', 'user_id'],
      ['push_notification_logs', 'user_id'],
      ['app_reviews', 'user_id'],
      ['app_review_replies', 'user_id'],
      ['app_review_helpful', 'user_id'],
      ['ai_chat_subscriptions', 'user_id'],
      ['ai_chat_usage', 'user_id'],
      ['ai_proactive_user_state', 'user_id'],
      ['proactive_engagement_schedule', 'user_id'],
      ['ai_image_usage', 'user_id'],
      ['voice_call_logs', 'user_id'],
      ['otp_codes', 'user_id'],
      ['password_reset_tokens', 'user_id'],
      ['api_keys', 'user_id'],
      ['api_subscriptions', 'user_id'],
      ['whatsapp_otp_verifications', 'user_id'],
      ['custom_roles', 'user_id'],
    ];
    for (const [t, col] of userColumnTables) {
      await safeDelete(adminClient, t, col, uid);
    }

    // Profile / company / blocked rows
    await safeDelete(adminClient, 'profiles', 'user_id', uid);
    await safeDelete(adminClient, 'profiles', 'id', uid);
    await safeDelete(adminClient, 'companies', 'user_id', uid);
    await safeDelete(adminClient, 'blocked_accounts', 'user_id', uid);
    await safeDelete(adminClient, 'blocked_accounts', 'original_user_id', uid);

    // FK nullify cleanups
    try { await adminClient.from('admin_activity_log').update({ target_user_id: null }).eq('target_user_id', uid); } catch (_e) {}
    try { await adminClient.from('admin_audit_logs').update({ target_user_id: null, admin_user_id: null }).or(`target_user_id.eq.${uid},admin_user_id.eq.${uid}`); } catch (_e) {}
    try { await adminClient.from('site_settings').update({ updated_by: null }).eq('updated_by', uid); } catch (_e) {}
    try { await adminClient.from('referral_settings').update({ created_by: null }).eq('created_by', uid); } catch (_e) {}
    try { await adminClient.from('app_settings').update({ updated_by: null }).eq('updated_by', uid); } catch (_e) {}
    await safeDelete(adminClient, 'admin_users', 'user_id', uid);
    await safeDelete(adminClient, 'admin_permissions', 'user_id', uid);

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(uid);
    if (deleteError) return { success: false, error: deleteError.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized: Invalid user');

    if (user.email !== OWNER_EMAIL) {
      const { data: adminData, error: adminError } = await supabaseAdmin
        .from('admin_users')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (adminError || !adminData || adminData.role !== 'owner') {
        throw new Error('Unauthorized: Only owner can manage auth users');
      }
    }

    const body = await req.json();
    const { action, userIds, userId } = body;
    console.log('Action:', action, 'UserIds:', userIds, 'UserId:', userId);

    // === LIST === (paginate through ALL users — listUsers defaults to 50 per page)
    if (action === 'list') {
      const perPage = 1000;
      let page = 1;
      const users: any[] = [];
      while (page <= 100) {
        const { data, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
        if (listError) throw listError;
        const batch = data?.users || [];
        users.push(...batch);
        if (batch.length < perPage) break;
        page++;
      }
      console.log(`[list] Fetched ${users.length} total auth users across ${page} page(s)`);

      const formattedUsers = users.map(u => {
        const identityAvatar = (u.identities || [])
          .map((i: any) => i?.identity_data || {})
          .map((d: any) =>
            d.avatar_url || d.picture || d.picture_url || d.avatar || null,
          )
          .find(Boolean) || null;
        const resolvedAvatar =
          u.user_metadata?.avatar_url ||
          u.user_metadata?.picture ||
          u.user_metadata?.picture_url ||
          u.user_metadata?.avatar ||
          u.user_metadata?.profile_picture ||
          u.user_metadata?.profile_image_url ||
          identityAvatar ||
          null;
        return {
        id: u.id,
        email: u.email,
        phone: u.phone,
        created_at: u.created_at,
        updated_at: u.updated_at,
        last_sign_in_at: u.last_sign_in_at,
        email_confirmed_at: u.email_confirmed_at,
        phone_confirmed_at: u.phone_confirmed_at,
        banned_until: (u as any).banned_until || null,
        role: u.role,
        aud: u.aud,
        avatar_url: resolvedAvatar,
        full_name: u.user_metadata?.full_name || u.user_metadata?.name || null,
        user_metadata: u.user_metadata || {},
        app_metadata: u.app_metadata || {},
        providers: u.identities?.map((i: any) => i.provider) || [],
        identities: u.identities?.map((i: any) => ({
          provider: i.provider,
          identity_id: i.identity_id,
          created_at: i.created_at,
          last_sign_in_at: i.last_sign_in_at,
          identity_data: i.identity_data || {},
        })) || [],
        factors: u.factors || [],
        confirmed_at: u.confirmed_at,
        invited_at: u.invited_at,
        recovery_sent_at: u.recovery_sent_at,
        is_anonymous: u.is_anonymous || false,
        };
      });

      return new Response(
        JSON.stringify({ users: formattedUsers }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === BAN (manual) — always send email + force-logout ===
    if (action === 'ban') {
      if (!userId) throw new Error('No user ID provided for ban');
      const { data: { user: targetUser } } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (targetUser?.email === OWNER_EMAIL) throw new Error('Cannot ban owner account');

      const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        ban_duration: '876000h'
      });
      if (banError) throw banError;

      console.log(`Successfully banned user ${userId}`);

      // Broadcast so the active client signs out immediately
      await broadcastDeletion(supabaseAdmin, userId);

      // Send "banned" email (manual ban = always email)
      try {
        const contact = await getUserContact(supabaseAdmin, userId);
        const email = contact.email || targetUser?.email || null;
        await sendBanNotification(supabaseAdmin, userId, contact.name, email, contact.audience, true);
      } catch (e) {
        console.error('Failed to send manual-ban notification:', e);
      }


      return new Response(
        JSON.stringify({ success: true, message: 'User banned successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === UNBAN ===
    if (action === 'unban') {
      if (!userId) throw new Error('No user ID provided for unban');
      const { error: unbanError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        ban_duration: 'none'
      });
      if (unbanError) throw unbanError;

      console.log(`Successfully unbanned user ${userId}`);

      // Tell the user their account works again (email + telegram + push)
      try {
        const { data: { user: unbannedUser } } = await supabaseAdmin.auth.admin.getUserById(userId);
        const contact = await getUserContact(supabaseAdmin, userId);
        const email = contact.email || unbannedUser?.email || null;
        await sendBanNotification(supabaseAdmin, userId, contact.name, email, contact.audience, false);
      } catch (e) {
        console.error('Failed to send unban notification:', e);
      }

      return new Response(
        JSON.stringify({ success: true, message: 'User unbanned successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === REMOVE DUPLICATE ===
    if (action === 'remove-duplicate') {
      if (!userId) throw new Error('No user ID provided');

      const { error: blockError } = await supabaseAdmin
        .from('blocked_accounts')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('is_active', true);

      if (blockError) {
        console.error('Error removing blocked_accounts entry:', blockError);
        throw blockError;
      }

      const { data: settingData } = await supabaseAdmin
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'duplicate_auto_ban')
        .maybeSingle();

      const autoBanEnabled = settingData?.setting_value === 'true';

      if (autoBanEnabled) {
        const { error: unbanError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          ban_duration: 'none'
        });
        if (unbanError) {
          console.error(`Error unbanning user ${userId}:`, unbanError);
        } else {
          console.log(`Unbanned user ${userId} (auto-ban was ON)`);
        }
      }

      console.log(`Removed duplicate flag for user ${userId}, autoBan=${autoBanEnabled}`);
      return new Response(
        JSON.stringify({ success: true, message: 'Duplicate removed successfully', unbanned: autoBanEnabled }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === DELETE (manual) — always send email before deletion ===
    if (action === 'delete') {
      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        throw new Error('No user IDs provided for deletion');
      }

      const results: { id: string; success: boolean; error?: string }[] = [];

      for (const uid of userIds) {
        try {
          const { data: { user: targetUser } } = await supabaseAdmin.auth.admin.getUserById(uid);
          if (targetUser?.email === OWNER_EMAIL) {
            results.push({ id: uid, success: false, error: 'Cannot delete owner account' });
            continue;
          }

          // Capture contact before deletion
          const contact = await getUserContact(supabaseAdmin, uid);
          const emailForNotice = contact.email || targetUser?.email || null;

          const res = await deleteUserComplete(supabaseAdmin, uid);
          if (res.success) {
            console.log(`Successfully deleted user ${uid}`);
            results.push({ id: uid, success: true });
            // Send delete email AFTER successful deletion (manual = always)
            if (emailForNotice) {
              await sendDeleteEmail(supabaseAdmin, uid, contact.name, emailForNotice, contact.audience);
            }
          } else {
            results.push({ id: uid, success: false, error: res.error });
          }
        } catch (err: any) {
          results.push({ id: uid, success: false, error: err.message });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      return new Response(
        JSON.stringify({ success: failCount === 0, message: `Deleted ${successCount} users, ${failCount} failed`, results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === TOGGLE AUTO BAN ===
    if (action === 'toggle-auto-ban') {
      const { enabled } = body;
      if (typeof enabled !== 'boolean') throw new Error('enabled must be a boolean');

      const { data: { user: currentUser } } = await supabaseClient.auth.getUser();
      await supabaseAdmin
        .from('app_settings')
        .update({
          setting_value: enabled ? 'true' : 'false',
          updated_by: currentUser?.id || null,
          updated_at: new Date().toISOString()
        })
        .eq('setting_key', 'duplicate_auto_ban');

      console.log(`Toggle auto-ban: enabled=${enabled}`);
      return new Response(
        JSON.stringify({ success: true, enabled, message: `Auto ban ${enabled ? 'enabled' : 'disabled'}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === TOGGLE SCREEN BLOCK ===
    if (action === 'toggle-screen-block') {
      const { enabled } = body;
      if (typeof enabled !== 'boolean') throw new Error('enabled must be a boolean');

      const { data: { user: currentUser } } = await supabaseClient.auth.getUser();
      await supabaseAdmin
        .from('app_settings')
        .update({
          setting_value: enabled ? 'true' : 'false',
          updated_by: currentUser?.id || null,
          updated_at: new Date().toISOString()
        })
        .eq('setting_key', 'duplicate_screen_block');

      console.log(`Toggle screen-block: enabled=${enabled}`);
      return new Response(
        JSON.stringify({ success: true, enabled, message: `Screen block ${enabled ? 'enabled' : 'disabled'}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === TOGGLE AUTO DELETE — flip setting, and when enabling sweep existing duplicates ===
    if (action === 'toggle-auto-delete') {
      const { enabled } = body;
      if (typeof enabled !== 'boolean') throw new Error('enabled must be a boolean');

      const { data: { user: currentUser } } = await supabaseClient.auth.getUser();
      await supabaseAdmin
        .from('app_settings')
        .update({
          setting_value: enabled ? 'true' : 'false',
          updated_by: currentUser?.id || null,
          updated_at: new Date().toISOString()
        })
        .eq('setting_key', 'duplicate_auto_delete');

      let swept = 0;
      let failed = 0;
      if (enabled) {
        // Sweep existing active duplicates — notify the affected user by email
        const { data: dupes } = await supabaseAdmin
          .from('blocked_accounts')
          .select('user_id')
          .eq('is_active', true);

        const ids = Array.from(new Set((dupes || []).map((d: any) => d.user_id).filter(Boolean)));
        for (const uid of ids) {
          try {
            const { data: { user: tu } } = await supabaseAdmin.auth.admin.getUserById(uid);
            if (tu?.email === OWNER_EMAIL) continue;
            const contact = await getUserContact(supabaseAdmin, uid);
            const emailForNotice = contact.email || tu?.email || null;
            const r = await deleteUserComplete(supabaseAdmin, uid);
            if (r.success) {
              swept++;
              if (emailForNotice) {
                await sendDeleteEmail(supabaseAdmin, uid, contact.name, emailForNotice, contact.audience);
              }
            } else {
              failed++;
            }
          } catch (e) {
            failed++;
            console.error(`Sweep delete failed for ${uid}:`, e);
          }
        }
        console.log(`Auto-delete sweep: deleted=${swept}, failed=${failed}`);
      }

      return new Response(
        JSON.stringify({
          success: true,
          enabled,
          swept,
          failed,
          message: enabled
            ? `Auto Delete enabled. Removed ${swept} existing duplicates${failed ? `, ${failed} failed` : ''}.`
            : 'Auto Delete disabled'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error: any) {
    console.error('Error in admin-delete-auth-users:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
