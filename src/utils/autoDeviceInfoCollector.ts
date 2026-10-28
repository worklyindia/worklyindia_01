/**
 * Auto Device Info Collector
 * Automatically collects and saves device info when a user logs in.
 * This ensures device_info_logs are created for ALL login methods
 * (Google, LinkedIn, Email/Password, etc.)
 */

import { getDeviceInfo, getFingerprintComponents } from '@/utils/deviceInfo';
import { getAudioFingerprint, detectIncognitoMode, detectAdBlocker, getAdditionalSignals, getFontFingerprint, getMathFingerprint } from '@/utils/advancedDeviceDetection';
import { getBatteryInfo } from '@/utils/deviceInfo';
import { SUPABASE_FUNCTIONS_URL } from '@/constants/supabase';

const AUTO_DEVICE_COLLECT_KEY = 'last_auto_device_collect';

export const autoCollectDeviceInfo = async (
  accessToken: string,
  userType: 'job_seeker' | 'employer' = 'job_seeker',
): Promise<void> => {
  // Always run on every login/signup - no cooldown
  // This ensures duplicate account detection fires for every session

  try {
    const info = getDeviceInfo();
    const components = getFingerprintComponents();

    // Gather advanced data in parallel
    const [audioFingerprint, incognitoDetected, adBlockerDetected, batteryData] = await Promise.all([
      getAudioFingerprint(),
      detectIncognitoMode(),
      detectAdBlocker(),
      getBatteryInfo(),
    ]);

    const signals = getAdditionalSignals();
    const fontFingerprint = getFontFingerprint();
    const mathFingerprint = getMathFingerprint();

    // Get network type
    const nav = navigator as any;
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
    const networkType = connection?.effectiveType || 'unknown';
    const downlink = connection?.downlink ? `${connection.downlink} Mbps` : 'unknown';
    const rtt = connection?.rtt ? `${connection.rtt} ms` : 'unknown';

    const res = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/get-ip-info`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4',
        },
        body: JSON.stringify({
          user_type: userType,
          device_info: info,
          fingerprint_components: components,
          network_type: networkType,
          downlink_speed: downlink,
          latency_ms: rtt,
          audio_fingerprint: audioFingerprint,
          incognito_detected: incognitoDetected,
          ad_blocker_detected: adBlockerDetected,
          color_depth: signals.color_depth,
          pixel_ratio: signals.pixel_ratio,
          max_touch_points: signals.max_touch_points,
          do_not_track: signals.do_not_track,
          platform: signals.platform,
          cookies_enabled: signals.cookies_enabled,
          webrtc_leak_detected: false,
          webrtc_public_ips: null,
          webrtc_local_ips: null,
          battery_level: batteryData?.level ?? null,
          battery_charging: batteryData?.charging ?? null,
          gps_latitude: null,
          gps_longitude: null,
          gps_accuracy: null,
          webgl_vendor: info.webgl_vendor ?? null,
          webgl_version: info.webgl_version ?? null,
          session_duration: null,
          total_clicks: null,
          rage_clicks: null,
          mouse_distance: null,
          mouse_speed: null,
          scroll_depth: null,
          typing_speed: null,
          is_bot: false,
          bot_reasons: [],
          orientation_changes: 0,
          focus_blur_count: 0,
          font_fingerprint: fontFingerprint,
          math_fingerprint: mathFingerprint,
        }),
      }
    );

    if (res.ok) {
      localStorage.setItem(AUTO_DEVICE_COLLECT_KEY, Date.now().toString());
      console.log('✅ Auto device info collected successfully');
      
      // Parse response and dispatch block event if user is blocked
      try {
        const responseData = await res.json();
        if (responseData.is_blocked) {
          console.log('🚫 Duplicate account detected - dispatching block event');
          window.dispatchEvent(new CustomEvent('device-block-detected', { detail: { blocked: true } }));
        } else {
          window.dispatchEvent(new CustomEvent('device-block-detected', { detail: { blocked: false } }));
        }
      } catch (_) {
        // Response already consumed or parse error - dispatch check event anyway
        window.dispatchEvent(new CustomEvent('device-block-detected', { detail: { blocked: null } }));
      }
    } else {
      console.error('❌ Auto device info collection failed:', res.status);
      // Still dispatch event so block check can proceed
      window.dispatchEvent(new CustomEvent('device-block-detected', { detail: { blocked: null } }));
    }
  } catch (error) {
    console.error('❌ Auto device info collection error:', error);
  }
};
