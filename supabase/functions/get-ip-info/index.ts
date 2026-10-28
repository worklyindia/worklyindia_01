import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { BRAND_CONFIG } from '../_shared/brandConfig.ts';
import { fanoutLifecycleChannels } from '../_shared/lifecycleFanout.ts';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version'
};
const SUPABASE_URL = 'https://jubwzelupbntbetpajqb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4';

/** Best-effort delete from a child table; never throws. */
async function safeDelete(adminClient: any, table: string, column: string, uid: string) {
  try {
    const {
      error
    } = await adminClient.from(table).delete().eq(column, uid);
    if (error) console.warn(`[cleanup] ${table}.${column} -> ${error.message}`);
  } catch (e: any) {
    console.warn(`[cleanup] ${table}.${column} threw -> ${e?.message || e}`);
  }
}

/** Full cascade cleanup before auth.admin.deleteUser (mirrors admin-delete-auth-users). */
async function cascadeDeleteUser(adminClient: any, uid: string): Promise<void> {
  try {
    for (const bucket of ['profile-photos', 'job-images']) {
      try {
        const {
          data: files
        } = await adminClient.storage.from(bucket).list(`${uid}/`);
        if (files && files.length > 0) {
          const paths = files.map((f: any) => `${uid}/${f.name}`);
          await adminClient.storage.from(bucket).remove(paths);
        }
      } catch (_e) {/* ignore */}
    }
    let companyId: string | null = null;
    try {
      const {
        data: c
      } = await adminClient.from('companies').select('id').eq('user_id', uid).maybeSingle();
      companyId = c?.id || null;
    } catch (_e) {/* ignore */}
    if (companyId) {
      try {
        const {
          data: jobs
        } = await adminClient.from('jobs').select('id').eq('company_id', companyId);
        const jobIds = (jobs || []).map((j: any) => j.id);
        if (jobIds.length) {
          for (const t of ['job_applicant_views', 'job_applications', 'job_favorites', 'saved_jobs', 'job_boosts', 'job_images', 'job_comments', 'job_interactions', 'job_indexing_status']) {
            try {
              await adminClient.from(t).delete().in('job_id', jobIds);
            } catch (_e) {}
          }
          await adminClient.from('jobs').delete().eq('company_id', companyId);
        }
      } catch (_e) {}
    }
    const userColumnTables: Array<[string, string]> = [['job_applications', 'applicant_id'], ['saved_jobs', 'user_id'], ['job_favorites', 'user_id'], ['job_interactions', 'user_id'], ['company_favorites', 'user_id'], ['company_interactions', 'user_id'], ['company_reviews', 'user_id'], ['notifications', 'user_id'], ['notifications', 'sender_id'], ['employer_notifications', 'user_id'], ['employer_settings', 'user_id'], ['user_settings', 'user_id'], ['user_roles', 'user_id'], ['user_preferences_tracking', 'user_id'], ['user_resumes', 'user_id'], ['user_shares', 'user_id'], ['user_certificates', 'user_id'], ['user_assessment_attempts', 'user_id'], ['user_notification_tokens', 'user_id'], ['user_scheduled_notifications', 'user_id'], ['user_engagement_state', 'user_id'], ['user_notification_intelligence', 'user_id'], ['user_push_quota', 'user_id'], ['conversations', 'employer_id'], ['conversations', 'applicant_id'], ['interviews', 'host_user_id'], ['interviews', 'applicant_id'], ['interview_participants', 'user_id'], ['chat_messages', 'sender_id'], ['referral_codes', 'user_id'], ['referral_commissions', 'user_id'], ['referral_wallets', 'user_id'], ['referral_withdrawal_requests', 'user_id'], ['referral_wallet_adjustments', 'user_id'], ['user_referrals', 'referrer_id'], ['user_referrals', 'referred_user_id'], ['transactions', 'user_id'], ['job_payments', 'user_id'], ['verification_purchases', 'user_id'], ['support_tickets', 'user_id'], ['education_entries', 'user_id'], ['certifications', 'user_id'], ['professional_experiences', 'user_id'], ['job_alert_preferences', 'user_id'], ['search_history', 'user_id'], ['behavioral_tracking', 'user_id'], ['account_deletion_requests', 'user_id'], ['profile_reminder_logs', 'user_id'], ['employer_profile_drafts', 'user_id'], ['job_seeker_profile_drafts', 'user_id'], ['employer_metrics', 'user_id'], ['device_info_logs', 'user_id'], ['fingerprint_change_logs', 'user_id'], ['onesignal_sessions', 'user_id'], ['push_notification_preferences', 'user_id'], ['push_notification_logs', 'user_id'], ['app_reviews', 'user_id'], ['app_review_replies', 'user_id'], ['app_review_helpful', 'user_id'], ['ai_chat_subscriptions', 'user_id'], ['ai_chat_usage', 'user_id'], ['ai_proactive_user_state', 'user_id'], ['proactive_engagement_schedule', 'user_id'], ['ai_image_usage', 'user_id'], ['voice_call_logs', 'user_id'], ['otp_codes', 'user_id'], ['password_reset_tokens', 'user_id'], ['api_keys', 'user_id'], ['api_subscriptions', 'user_id'], ['whatsapp_otp_verifications', 'user_id'], ['custom_roles', 'user_id']];
    for (const [t, col] of userColumnTables) {
      await safeDelete(adminClient, t, col, uid);
    }
    await safeDelete(adminClient, 'profiles', 'user_id', uid);
    await safeDelete(adminClient, 'profiles', 'id', uid);
    await safeDelete(adminClient, 'companies', 'user_id', uid);
    await safeDelete(adminClient, 'blocked_accounts', 'user_id', uid);
    await safeDelete(adminClient, 'blocked_accounts', 'original_user_id', uid);
    try {
      await adminClient.from('admin_activity_log').update({
        target_user_id: null
      }).eq('target_user_id', uid);
    } catch (_e) {}
    try {
      await adminClient.from('admin_audit_logs').update({
        target_user_id: null,
        admin_user_id: null
      }).or(`target_user_id.eq.${uid},admin_user_id.eq.${uid}`);
    } catch (_e) {}
    try {
      await adminClient.from('site_settings').update({
        updated_by: null
      }).eq('updated_by', uid);
    } catch (_e) {}
    try {
      await adminClient.from('referral_settings').update({
        created_by: null
      }).eq('created_by', uid);
    } catch (_e) {}
    try {
      await adminClient.from('app_settings').update({
        updated_by: null
      }).eq('updated_by', uid);
    } catch (_e) {}
    await safeDelete(adminClient, 'admin_users', 'user_id', uid);
    await safeDelete(adminClient, 'admin_permissions', 'user_id', uid);
  } catch (e) {
    console.warn('cascadeDeleteUser error (non-fatal):', e);
  }
}

/** Generate SHA-256 hash, return first 32 hex chars uppercase */
async function generateSHA256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex.substring(0, 32).toUpperCase();
}

/**
 * Score-based duplicate account detection
 * Returns confidence score and matched signals
 */
async function calculateDuplicateScore(adminClient: any, userId: string, deviceId: string, fingerprintHash: string | null, canvasFingerprint: string | null, audioFingerprint: string | null, publicIp: string): Promise<{
  score: number;
  matchedUsers: any[];
  signals: Record<string, boolean>;
}> {
  const signals: Record<string, boolean> = {
    matched_device_id: false,
    matched_fingerprint: false,
    matched_canvas: false,
    matched_ip: false,
    matched_audio: false
  };
  let score = 0;
  const matchedUsersMap = new Map<string, any>();

  // Check device_id match (+40 points)
  if (deviceId && deviceId !== 'unknown') {
    const {
      data
    } = await adminClient.from('device_info_logs').select('user_id, device_id, fingerprint_hash, canvas_fingerprint').neq('user_id', userId).eq('device_id', deviceId).limit(10);
    if (data && data.length > 0) {
      score += 40;
      signals.matched_device_id = true;
      for (const d of data) {
        if (!matchedUsersMap.has(d.user_id)) matchedUsersMap.set(d.user_id, d);
      }
    }
  }

  // Check fingerprint_hash match (+35 points)
  if (fingerprintHash) {
    const {
      data
    } = await adminClient.from('device_info_logs').select('user_id, device_id, fingerprint_hash, canvas_fingerprint').neq('user_id', userId).eq('fingerprint_hash', fingerprintHash).limit(10);
    if (data && data.length > 0) {
      score += 35;
      signals.matched_fingerprint = true;
      for (const d of data) {
        if (!matchedUsersMap.has(d.user_id)) matchedUsersMap.set(d.user_id, d);
      }
    }
  }

  // Check canvas_fingerprint match (+30 points)
  if (canvasFingerprint && canvasFingerprint !== 'not_supported' && canvasFingerprint !== 'N/A') {
    const {
      data
    } = await adminClient.from('device_info_logs').select('user_id, device_id, fingerprint_hash, canvas_fingerprint').neq('user_id', userId).eq('canvas_fingerprint', canvasFingerprint).limit(10);
    if (data && data.length > 0) {
      score += 30;
      signals.matched_canvas = true;
      for (const d of data) {
        if (!matchedUsersMap.has(d.user_id)) matchedUsersMap.set(d.user_id, d);
      }
    }
  }

  // Check audio_fingerprint match (+25 points)
  if (audioFingerprint && audioFingerprint !== 'N/A') {
    const {
      data
    } = await adminClient.from('device_info_logs').select('user_id, device_id, fingerprint_hash, canvas_fingerprint').neq('user_id', userId).eq('audio_fingerprint', audioFingerprint).limit(10);
    if (data && data.length > 0) {
      score += 25;
      signals.matched_audio = true;
      for (const d of data) {
        if (!matchedUsersMap.has(d.user_id)) matchedUsersMap.set(d.user_id, d);
      }
    }
  }

  // Check IP match (+15 points)
  if (publicIp && publicIp !== 'unknown') {
    const {
      data
    } = await adminClient.from('device_info_logs').select('user_id, device_id, fingerprint_hash, canvas_fingerprint').neq('user_id', userId).eq('public_ip', publicIp).limit(10);
    if (data && data.length > 0) {
      score += 15;
      signals.matched_ip = true;
      for (const d of data) {
        if (!matchedUsersMap.has(d.user_id)) matchedUsersMap.set(d.user_id, d);
      }
    }
  }
  return {
    score,
    matchedUsers: Array.from(matchedUsersMap.values()),
    signals
  };
}

/**
 * Check if original user's account still exists (not deleted)
 */
async function isOriginalAccountActive(adminClient: any, originalUserId: string): Promise<boolean> {
  try {
    const {
      data,
      error
    } = await adminClient.from('profiles').select('user_id').eq('user_id', originalUserId).maybeSingle();
    if (error || !data) return false;
    return true;
  } catch {
    return true;
  }
}

/**
 * Auto-unblock a user if their original (blocking) account has been deleted.
 * Returns true if the user was unblocked.
 */
async function autoUnblockIfOriginalDeleted(adminClient: any, userId: string): Promise<boolean> {
  try {
    const {
      data: blockRecord
    } = await adminClient.from('blocked_accounts').select('id, original_user_id').eq('user_id', userId).eq('is_active', true).limit(1).maybeSingle();
    if (!blockRecord) return false;
    const originalExists = await isOriginalAccountActive(adminClient, blockRecord.original_user_id);
    if (originalExists) return false;

    // Original account is deleted — unblock this user
    const {
      error: updateError
    } = await adminClient.from('blocked_accounts').update({
      is_active: false,
      updated_at: new Date().toISOString(),
      reason: `Auto-unblocked: original account ${blockRecord.original_user_id} was deleted`
    }).eq('id', blockRecord.id);
    if (updateError) {
      console.error('Auto-unblock update error:', updateError);
      return false;
    }
    return true;
  } catch (err) {
    console.error('autoUnblockIfOriginalDeleted error:', err);
    return false;
  }
}
Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    // Verify auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });
    const {
      data: {
        user
      },
      error: authError
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const adminClient = serviceKey ? createClient(SUPABASE_URL, serviceKey) : null;

    // Get client IP from headers
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || 'unknown';

    // Fetch geolocation from ip-api.com
    let networkInfo: Record<string, any> = {
      public_ip: ip,
      country: 'Unknown',
      state: 'Unknown',
      city: 'Unknown',
      isp: 'Unknown',
      asn: 'Unknown',
      vpn_detected: false,
      is_tor: false,
      is_datacenter: false,
      proxy_type: 'None'
    };
    if (ip !== 'unknown' && ip !== '127.0.0.1') {
      try {
        // Fetch geo data and TOR exit node list in parallel
        const [geoRes, torCheckRes] = await Promise.all([fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city,isp,as,proxy,hosting,query`), fetch('https://check.torproject.org/torbulkexitlist').catch(() => null)]);
        const geoData = await geoRes.json();

        // Check if IP is in TOR exit node list
        let isTorExitNode = false;
        if (torCheckRes && torCheckRes.ok) {
          try {
            const torList = await torCheckRes.text();
            const torIPs = new Set(torList.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')));
            isTorExitNode = torIPs.has(ip);
          } catch {/* ignore TOR list parse errors */}
        }
        if (geoData.status === 'success') {
          const ispLower = (geoData.isp || '').toLowerCase();
          const asLower = (geoData.as || '').toLowerCase();
          const torIndicators = ['tor exit', 'tor relay', 'tor project', 'torservers'];
          const isTor = isTorExitNode || torIndicators.some(t => ispLower.includes(t) || asLower.includes(t));
          const dcIndicators = ['digital ocean', 'amazon', 'aws', 'google cloud', 'microsoft azure', 'linode', 'vultr', 'ovh', 'hetzner', 'cloudflare', 'akamai', 'fastly', 'oracle cloud', 'alibaba cloud', 'tencent cloud', 'data center', 'datacenter', 'colocation', 'hosting', 'm247', 'mullvad', 'nordvpn', 'expressvpn', 'surfshark', 'cyberghost', 'private internet', 'leaseweb', 'serverius', 'quadranet', 'psychz', 'buyvm', 'frantech', 'datacamp', 'zscaler', 'f5 network', 'purevpn', 'ipvanish', 'protonvpn', 'windscribe', 'hotspot shield', 'worldstream'];
          const isDatacenter = geoData.hosting === true || dcIndicators.some(d => ispLower.includes(d) || asLower.includes(d));
          networkInfo = {
            public_ip: ip,
            country: geoData.country || 'Unknown',
            state: geoData.regionName || 'Unknown',
            city: geoData.city || 'Unknown',
            isp: geoData.isp || 'Unknown',
            asn: geoData.as || 'Unknown',
            vpn_detected: geoData.proxy === true || geoData.hosting === true,
            is_tor: isTor,
            is_datacenter: isDatacenter,
            proxy_type: isTor ? 'TOR' : geoData.proxy ? 'Proxy' : geoData.hosting ? 'Hosting/DC' : 'None'
          };
        }
      } catch (e) {
        console.error('IP geolocation failed:', e);
      }
    }

    // Handle POST - save device info + score-based duplicate detection
    let fingerprintHash = '';
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        const {
          device_info,
          fingerprint_components,
          network_type,
          downlink_speed,
          latency_ms
        } = body;

        // Generate server-side SHA-256 fingerprint from components
        if (fingerprint_components && Array.isArray(fingerprint_components)) {
          const combinedData = fingerprint_components.join('|');
          fingerprintHash = await generateSHA256(combinedData);
        }

        // Save/update device info using service role
        if (device_info) {
          if (adminClient) {
            const deviceData = {
              user_id: user.id,
              user_type: body.user_type === 'employer' ? 'employer' : body.user_type === 'job_seeker' ? 'job_seeker' : null,
              device_id: device_info.device_id || 'unknown',
              fingerprint_hash: fingerprintHash || null,
              browser_name: device_info.browser_name || null,
              browser_version: device_info.browser_version || null,
              operating_system: device_info.operating_system || null,
              device_type: device_info.device_type || null,
              screen_resolution: device_info.screen_resolution || null,
              viewport_size: device_info.viewport_size || null,
              device_memory: device_info.device_memory || null,
              hardware_concurrency: device_info.hardware_concurrency || null,
              timezone: device_info.timezone || null,
              language: device_info.language || null,
              canvas_fingerprint: device_info.canvas_fingerprint || null,
              webgl_renderer: device_info.webgl_renderer || null,
              public_ip: networkInfo.public_ip,
              country: networkInfo.country,
              state: networkInfo.state,
              city: networkInfo.city,
              isp: networkInfo.isp,
              vpn_detected: networkInfo.vpn_detected,
              network_type: network_type || null,
              downlink_speed: downlink_speed || null,
              latency_ms: latency_ms || null,
              audio_fingerprint: body.audio_fingerprint || null,
              incognito_detected: body.incognito_detected || false,
              ad_blocker_detected: body.ad_blocker_detected || false,
              color_depth: body.color_depth || null,
              pixel_ratio: body.pixel_ratio || null,
              max_touch_points: body.max_touch_points || null,
              do_not_track: body.do_not_track || null,
              platform: body.platform || null,
              cookies_enabled: body.cookies_enabled ?? true,
              webrtc_leak_detected: body.webrtc_leak_detected || false,
              webrtc_public_ips: body.webrtc_public_ips || null,
              webrtc_local_ips: body.webrtc_local_ips || null,
              battery_level: body.battery_level ?? null,
              battery_charging: body.battery_charging ?? null,
              gps_latitude: body.gps_latitude ?? null,
              gps_longitude: body.gps_longitude ?? null,
              gps_accuracy: body.gps_accuracy ?? null,
              webgl_vendor: body.webgl_vendor || null,
              webgl_version: body.webgl_version || null,
              session_duration: body.session_duration ?? null,
              total_clicks: body.total_clicks ?? null,
              rage_clicks: body.rage_clicks ?? null,
              mouse_distance: body.mouse_distance ?? null,
              mouse_speed: body.mouse_speed ?? null,
              scroll_depth: body.scroll_depth ?? null,
              typing_speed: body.typing_speed ?? null,
              is_bot: body.is_bot ?? false,
              bot_reasons: body.bot_reasons || null,
              orientation_changes: body.orientation_changes ?? null,
              focus_blur_count: body.focus_blur_count ?? null,
              updated_at: new Date().toISOString()
            };
            const {
              error: upsertError
            } = await adminClient.from('device_info_logs').upsert(deviceData, {
              onConflict: 'user_id,device_id'
            });
            if (upsertError) {
              console.error('Device info upsert error:', upsertError);
            }

            // === AUTO-UNBLOCK IF ORIGINAL ACCOUNT DELETED ===
            const wasUnblocked = await autoUnblockIfOriginalDeleted(adminClient, user.id);
            if (wasUnblocked) {}

            // === SCORE-BASED DUPLICATE ACCOUNT DETECTION ===
            let currentUserBlocked = false;
            try {
              const currentDeviceId = device_info.device_id || 'unknown';
              const currentCanvas = device_info.canvas_fingerprint || null;
              const currentFingerprint = fingerprintHash || null;
              const currentAudio = body.audio_fingerprint || null;

              // Calculate duplicate confidence score
              const {
                score,
                matchedUsers,
                signals
              } = await calculateDuplicateScore(adminClient, user.id, currentDeviceId, currentFingerprint, currentCanvas, currentAudio, networkInfo.public_ip);
              // STRICT RULE: device_id match is MANDATORY to block.
              // Browser/canvas/audio fingerprints regularly COLLIDE between two different
              // people who happen to use the same phone model + Android version + Chrome
              // version on the same mobile carrier (shared NAT IP). Those signals alone
              // are NOT proof of the same person — they only raise suspicion.
              // device_id is a stable per-install UUID stored on the device, so a match
              // there is the only signal strong enough to justify an automatic block.
              // Without device_id match → never block (prevents false positives like
              // two unrelated users on identical phones getting flagged as duplicates).
              // STRICT 100%-accuracy rule (updated):
              // Block ONLY if a SINGLE existing device_info_logs row for ANOTHER
              // user matches the current request on ALL THREE of:
              //   1) device_id      (per-install UUID — locally generated)
              //   2) fingerprint_hash (browser/device fingerprint)
              //   3) canvas_fingerprint (GPU/canvas fingerprint)
              // Requiring all three on the SAME row eliminates cross-user
              // contamination (e.g. two people sharing a phone, or a stale
              // device_id written by a previous client bug) and false matches
              // from fingerprint collisions on identical phone models.
              let confirmedMatchUserId: string | null = null;
              if (signals.matched_device_id && currentDeviceId && currentFingerprint && currentCanvas) {
                const {
                  data: deviceMatchLogs
                } = await adminClient.from('device_info_logs').select('user_id, fingerprint_hash, canvas_fingerprint').eq('device_id', currentDeviceId).eq('fingerprint_hash', currentFingerprint).eq('canvas_fingerprint', currentCanvas).neq('user_id', user.id).limit(1);
                if (deviceMatchLogs && deviceMatchLogs.length > 0) {
                  confirmedMatchUserId = deviceMatchLogs[0].user_id;
                }
              }
              if (confirmedMatchUserId && score >= 65 && matchedUsers.length > 0) {
                // Find the first ACTIVE matched user (skip deleted accounts)
                let activeMatchedUser: any = null;
                // Prefer the confirmed user (device_id + fp/canvas on same log)
                const orderedMatches = [...matchedUsers.filter((m: any) => m.user_id === confirmedMatchUserId), ...matchedUsers.filter((m: any) => m.user_id !== confirmedMatchUserId)];
                for (const mu of orderedMatches) {
                  const isActive = await isOriginalAccountActive(adminClient, mu.user_id);
                  if (isActive) {
                    activeMatchedUser = mu;
                    break;
                  } else {}
                }
                if (!activeMatchedUser) {} else {
                  // === COMPARE CREATION DATES: always block the NEWER account ===
                  const {
                    data: currentProfile
                  } = await adminClient.from('profiles').select('user_id, email, created_at').eq('user_id', user.id).maybeSingle();
                  const {
                    data: matchedProfile
                  } = await adminClient.from('profiles').select('user_id, email, created_at').eq('user_id', activeMatchedUser.user_id).maybeSingle();
                  const currentCreatedAt = currentProfile?.created_at ? new Date(currentProfile.created_at) : new Date();
                  const matchedCreatedAt = matchedProfile?.created_at ? new Date(matchedProfile.created_at) : new Date(0);
                  let userToBlock: string;
                  let originalUser: string;
                  let originalEmail: string | null = null;
                  if (currentCreatedAt >= matchedCreatedAt) {
                    userToBlock = user.id;
                    originalUser = activeMatchedUser.user_id;
                    originalEmail = matchedProfile?.email || null;
                    currentUserBlocked = true;
                  } else {
                    userToBlock = activeMatchedUser.user_id;
                    originalUser = user.id;
                    originalEmail = currentProfile?.email || null;
                  }

                  // Check if already blocked
                  const {
                    data: existingBlock
                  } = await adminClient.from('blocked_accounts').select('id').eq('user_id', userToBlock).eq('is_active', true).limit(1).maybeSingle();
                  if (!existingBlock) {
                    const emailHint = originalEmail || null;
                    const blockSignals = {
                      ...signals,
                      confidence_score: score,
                      original_email_hint: emailHint,
                      detected_at: new Date().toISOString(),
                      current_device_id: currentDeviceId,
                      current_fingerprint: currentFingerprint,
                      current_canvas: currentCanvas,
                      current_ip: networkInfo.public_ip
                    };

                    // === Fetch all three duplicate-handling settings in parallel ===
                    const [autoDeleteSettingRes, screenBlockSettingRes, autoBanSettingRes] = await Promise.all([adminClient.from('app_settings').select('setting_value').eq('setting_key', 'duplicate_auto_delete').maybeSingle(), adminClient.from('app_settings').select('setting_value').eq('setting_key', 'duplicate_screen_block').maybeSingle(), adminClient.from('app_settings').select('setting_value').eq('setting_key', 'duplicate_auto_ban').maybeSingle()]);
                    const autoDeleteEnabled = autoDeleteSettingRes.data?.setting_value === 'true';
                    const screenBlockEnabled = screenBlockSettingRes.data?.setting_value === 'true';
                    const autoBanEnabled = autoBanSettingRes.data?.setting_value === 'true';

                    // ============================================================
                    // PRIORITY 1: AUTO DELETE — silently remove duplicate (no email)
                    // ============================================================
                    if (autoDeleteEnabled) {
                      try {
                        // Safety: never auto-delete the owner account
                        const {
                          data: {
                            user: targetUser
                          }
                        } = await adminClient.auth.admin.getUserById(userToBlock);
                        const OWNER_EMAIL = 'gohilvishal7600@gmail.com';
                        if (targetUser?.email === OWNER_EMAIL) {} else {
                          // Capture contact for email BEFORE deletion
                          const {
                            data: delProfile
                          } = await adminClient.from('profiles').select('full_name, email').eq('user_id', userToBlock).maybeSingle();
                          const {
                            data: delCompany
                          } = await adminClient.from('companies').select('company_name, email').eq('user_id', userToBlock).maybeSingle();
                          const delName = delProfile?.full_name || delCompany?.company_name || 'User';
                          const delEmail = delProfile?.email || delCompany?.email || targetUser?.email || null;

                          // Broadcast deletion to force-logout the active client
                          try {
                            const ch = adminClient.channel(`account-${userToBlock}`);
                            await ch.send({
                              type: 'broadcast',
                              event: 'account_deleted',
                              payload: {
                                user_id: userToBlock,
                                at: new Date().toISOString()
                              }
                            });
                            await adminClient.removeChannel(ch);
                          } catch (bcErr) {
                            console.warn('Auto-delete broadcast failed:', bcErr);
                          }

                          // Full cascade cleanup so auth user can actually be deleted
                          await cascadeDeleteUser(adminClient, userToBlock);
                          const {
                            error: delErr
                          } = await adminClient.auth.admin.deleteUser(userToBlock);
                          if (delErr) {
                            console.error(`AUTO-DELETE auth deletion failed for ${userToBlock}:`, delErr);
                          } else {
                            // Send the audience-specific owner-managed deletion email.
                            if (delEmail) {
                              try {
                                const now = new Date();
                                const date = new Intl.DateTimeFormat('en-GB', {
                                  timeZone: 'Asia/Kolkata',
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric'
                                }).format(now);
                                const time = new Intl.DateTimeFormat('en-US', {
                                  timeZone: 'Asia/Kolkata',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                  hour12: true
                                }).format(now);
                                const audience = delCompany?.company_name ? 'employer' : 'job_seeker';
                                await fanoutLifecycleChannels(adminClient, {
                                  userId: userToBlock,
                                  templateKey: audience === 'employer' ? 'employer_account_deleted' : 'job_seeker_account_deleted',
                                  email: delEmail,
                                  channels: ['email'],
                                  bypassPreferences: true,
                                  variables: {
                                    name: delName,
                                    company: delName,
                                    email: delEmail,
                                    date,
                                    time
                                  },
                                  fallbackTitle: 'Your Workly India account has been deleted',
                                  fallbackMessage: `Hi ${delName}, your duplicate Workly India account has been permanently deleted. If you believe this is an error, contact ${BRAND_CONFIG.supportEmail}.`
                                });
                              } catch (mailErr) {
                                console.error('Auto-delete email failed:', mailErr);
                              }
                            }
                          }
                        }
                      } catch (autoDelErr) {
                        console.error('Auto-delete error:', autoDelErr);
                      }
                      // Skip block + ban paths entirely
                    } else {
                      // ============================================================
                      // PRIORITY 2: SCREEN BLOCK — insert blocked_accounts + email
                      // ============================================================
                      if (screenBlockEnabled) {
                        const {
                          error: blockError
                        } = await adminClient.from('blocked_accounts').insert({
                          user_id: userToBlock,
                          original_user_id: originalUser,
                          reason: `Duplicate account detected (confidence: ${score}%). Another account already exists with matching device signals. Only one account per person is allowed.`,
                          block_signals: blockSignals,
                          device_id: currentDeviceId,
                          fingerprint_hash: currentFingerprint,
                          canvas_fingerprint: currentCanvas,
                          is_active: true
                        });
                        if (blockError) {
                          console.error('Failed to block duplicate account:', blockError);
                        } else {
                          // === SEND "RESTRICTED" EMAIL (only when screen block ON) ===
                          try {
                            const {
                              data: blockedProfile
                            } = await adminClient.from('profiles').select('full_name, email, telegram_chat_id, onesignal_player_id').eq('user_id', userToBlock).maybeSingle();
                            const {
                              data: blockedCompany
                            } = await adminClient.from('companies').select('company_name, email, telegram_chat_id, onesignal_player_id').eq('user_id', userToBlock).maybeSingle();
                            const bName = blockedProfile?.full_name || blockedCompany?.company_name || 'User';
                            const bEmail = blockedProfile?.email || blockedCompany?.email;
                            const bTelegram = blockedProfile?.telegram_chat_id || blockedCompany?.telegram_chat_id;
                            const bPush = blockedProfile?.onesignal_player_id || blockedCompany?.onesignal_player_id;
                            const origHint = blockSignals.original_email_hint || 'your original account';
                            const matchedSignalsList: string[] = [];
                            if (signals.matched_device_id) matchedSignalsList.push('Device ID');
                            if (signals.matched_fingerprint) matchedSignalsList.push('Browser Fingerprint');
                            if (signals.matched_canvas) matchedSignalsList.push('Canvas Fingerprint');
                            if (signals.matched_audio) matchedSignalsList.push('Audio Fingerprint');
                            if (signals.matched_ip) matchedSignalsList.push('IP Address');
                            const signalsText = matchedSignalsList.length > 0 ? matchedSignalsList.join(', ') : 'Multiple device signals';
                            const blockSubject = 'Important: Your Workly India Account Has Been Restricted';
                            const blockTextMessage = `Dear ${bName},\n\nYour account (${bEmail || 'this account'}) has been restricted because our security system detected it as a duplicate of an existing account.\n\nWhy this happened:\nOur automated security system identified that another account already exists with matching device signatures (${signalsText}). Each person is only allowed one account on Workly India. Confidence: ${score}%.\n\nWhat you can do:\n1. Sign in with your original account: ${origHint}\n2. If you deleted your old account, create a new one — the restriction will be removed automatically\n3. Contact our support team if you believe this is an error\n\nNeed help? Email us at ${BRAND_CONFIG.supportEmail}\n\nBest regards,\nWorkly India Security Team`;
                            const blockHtml = `
                              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                                <div style="background: #FFF3CD; border: 1px solid #FFC107; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                                  <h2 style="color: #856404; margin: 0 0 8px;">⚠️ Account Restricted</h2>
                                  <p style="color: #856404; margin: 0;">Your account has been restricted due to duplicate detection.</p>
                                </div>
                                <p>Dear <strong>${bName}</strong>,</p>
                                <p>Your account (<strong>${bEmail || 'this account'}</strong>) has been restricted because our security system detected it as a duplicate of an existing account.</p>
                                <h3 style="color: #333;">Why this happened</h3>
                                <p>Our automated security system identified that another account already exists with matching device signatures (<strong>${signalsText}</strong>). Each person is only allowed one account on Workly India.</p>
                                <p>Detection confidence: <strong>${score}%</strong></p>
                                <h3 style="color: #333;">What you can do</h3>
                                <ol>
                                  <li><strong>Sign in with your original account:</strong> ${origHint}</li>
                                  <li>If you deleted your old account, create a new one — the restriction will be removed automatically</li>
                                  <li>Contact our support team if you believe this is an error</li>
                                </ol>
                                <p style="margin-top: 24px;">Need help? Email us at <a href="mailto:${BRAND_CONFIG.supportEmail}">${BRAND_CONFIG.supportEmail}</a></p>
                                <p style="color: #999; font-size: 12px; margin-top: 24px;">Best regards,<br/>Workly India Security Team</p>
                              </div>
                            `;
                            const notifPromises: Promise<any>[] = [];
                            if (bEmail) {
                              notifPromises.push(adminClient.functions.invoke('email-api/send-email', {
                                body: {
                                  to: bEmail,
                                  toName: bName,
                                  subject: blockSubject,
                                  htmlContent: blockHtml,
                                  textContent: blockTextMessage,
                                  audience: blockedCompany ? 'employer' : 'jobseeker'
                                }
                              }).catch((e: any) => console.error('Block email error:', e)));
                            }
                            if (bTelegram) {
                              notifPromises.push(adminClient.functions.invoke('email-api/telegram', {
                                body: {
                                  action: 'send',
                                  audience: blockedCompany ? 'employer' : 'job_seeker',
                                  chat_id: bTelegram,
                                  text: `⚠️ *Account Restricted*\n\n${blockTextMessage}`,
                                  parse_mode: 'Markdown'
                                }
                              }).catch((e: any) => console.error('Block telegram error:', e)));
                            }
                            if (bPush) {
                              notifPromises.push(adminClient.functions.invoke('email-api', {
                                body: {
                                  action: 'send_push',
                                  user_id: userToBlock,
                                  audience: blockedCompany ? 'employer' : 'job_seeker',
                                  title: '⚠️ Account Restricted',
                                  message: `Your account has been restricted. ${origHint !== 'your original account' ? `Please sign in with: ${origHint}` : 'Please contact support.'}`,
                                  action_url: '/contact'
                                }
                              }).catch((e: any) => console.error('Block push error:', e)));
                            }
                            await Promise.allSettled(notifPromises);
                          } catch (notifErr) {
                            console.error('Error sending block notifications:', notifErr);
                          }
                        }
                      } else {}

                      // ============================================================
                      // PRIORITY 3: AUTO BAN — auth ban + "banned" email (only when ON)
                      // ============================================================
                      try {
                        if (autoBanEnabled) {
                          const {
                            error: banError
                          } = await adminClient.auth.admin.updateUserById(userToBlock, {
                            ban_duration: '876000h'
                          });
                          if (banError) {
                            console.error(`Failed to auto-ban user ${userToBlock}:`, banError);
                          } else {
                            // Send "Banned" email
                            try {
                              const {
                                data: bProfile
                              } = await adminClient.from('profiles').select('full_name, email').eq('user_id', userToBlock).maybeSingle();
                              const {
                                data: bCompany
                              } = await adminClient.from('companies').select('company_name, email').eq('user_id', userToBlock).maybeSingle();
                              const banName = bProfile?.full_name || bCompany?.company_name || 'User';
                              const banEmail = bProfile?.email || bCompany?.email;
                              if (banEmail) {
                                const banSubject = 'Your Workly India Account Has Been Banned';
                                const banText = `Dear ${banName},\n\nYour Workly India account (${banEmail}) has been banned due to duplicate account detection.\n\nYou will not be able to sign in. If you believe this is an error, please contact support at ${BRAND_CONFIG.supportEmail}.\n\nBest regards,\nWorkly India Security Team`;
                                const banHtmlEmail = `
                                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                                    <div style="background: #F8D7DA; border: 1px solid #DC3545; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                                      <h2 style="color: #721C24; margin: 0 0 8px;">🚫 Account Banned</h2>
                                      <p style="color: #721C24; margin: 0;">Your Workly India account has been banned.</p>
                                    </div>
                                    <p>Dear <strong>${banName}</strong>,</p>
                                    <p>Your account (<strong>${banEmail}</strong>) has been banned due to duplicate account detection. You will no longer be able to sign in.</p>
                                    <p>If you believe this is an error, please contact our support team at <a href="mailto:${BRAND_CONFIG.supportEmail}">${BRAND_CONFIG.supportEmail}</a>.</p>
                                    <p style="color: #999; font-size: 12px; margin-top: 24px;">Best regards,<br/>Workly India Security Team</p>
                                  </div>
                                `;
                                await adminClient.functions.invoke('email-api/send-email', {
                                  body: {
                                    to: banEmail,
                                    toName: banName,
                                    subject: banSubject,
                                    htmlContent: banHtmlEmail,
                                    textContent: banText
                                  }
                                }).catch((e: any) => console.error('Auto-ban email error:', e));
                              }
                            } catch (banEmailErr) {
                              console.error('Failed to send auto-ban email:', banEmailErr);
                            }
                          }
                        } else {
                          // Fail-safe: ensure newly detected duplicates are NOT Auth-banned when toggle is OFF
                          const {
                            error: unbanError
                          } = await adminClient.auth.admin.updateUserById(userToBlock, {
                            ban_duration: 'none'
                          });
                          if (unbanError) {
                            console.error(`Failed to ensure unbanned status for ${userToBlock} while auto-ban OFF:`, unbanError);
                          } else {}
                        }
                      } catch (banSettingErr) {
                        console.error('Error in auto-ban path:', banSettingErr);
                      }
                    }
                  }
                }
              }
            } catch (dupError) {
              console.error('Duplicate detection error:', dupError);
            }
          }
        }
      } catch (e) {
        console.error('Error processing POST body:', e);
      }
    }

    // Also check if user is already blocked (for existing blocks on login)
    let isBlocked = false;
    if (user) {
      try {
        const {
          data: existingBlock
        } = await adminClient!.from('blocked_accounts').select('id').eq('user_id', user.id).eq('is_active', true).limit(1).maybeSingle();
        isBlocked = !!existingBlock;
      } catch (_) {/* ignore */}
    }
    return new Response(JSON.stringify({
      ...networkInfo,
      fingerprint_hash: fingerprintHash || undefined,
      is_blocked: isBlocked
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});