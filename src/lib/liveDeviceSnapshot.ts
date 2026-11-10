/**
 * Live Device Snapshot for the AI Chat
 * ------------------------------------
 * Collects the SAME data the "Device Information" sheet shows, but on demand,
 * at the exact moment the user asks the AI something device related.
 * That way battery / network / IP values are always fresh (captured "now"),
 * never a stale row from device_info_logs.
 */

import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_FUNCTIONS_URL } from '@/constants/supabase';
import {
  getDeviceInfo,
  getFingerprintComponents,
  getBatteryInfo,
  generateFingerprint,
  fetchRealAndroidVersion,
} from '@/utils/deviceInfo';
import {
  getAudioFingerprint,
  detectIncognitoMode,
  detectAdBlocker,
  getPermissionStatuses,
  getAdditionalSignals,
} from '@/utils/advancedDeviceDetection';
import { detectWebRTCLeak } from '@/utils/webrtcLeakDetect';
import { getNetworkType } from '@/utils/networkOptimizer';

const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4';

/** Keywords (EN + Hinglish) that mean "user is asking about their device". */
const DEVICE_KEYWORDS = [
  'device', 'devise', 'mobile', 'phone', 'browser', 'chrome', 'os ', 'android', 'ios',
  'screen', 'viewport', 'ram', 'memory', 'cpu', 'core', 'timezone', 'language',
  'battery', 'charging', 'charge', 'batri', 'batery',
  'network', 'internet', 'wifi', 'net speed', 'speed', 'download', 'latency', 'ping', 'rtt',
  'ip', 'isp', 'asn', 'vpn', 'tor', 'proxy', 'datacenter', 'location', 'city', 'state',
  'fingerprint', 'sha', 'canvas', 'webgl', 'gpu', 'graphics', 'audio fp',
  'incognito', 'ad blocker', 'adblock', 'cookie', 'do not track', 'pixel ratio', 'touch',
  'permission', 'geolocation', 'notification', 'camera', 'microphone', 'clipboard',
  'webrtc', 'leak', 'security signal', 'risk',
  'login', 'logins', 'last login', 'login frequency', 'ip history', 'unique ip',
  'font', 'plugin', 'device info', 'device information', 'system info',
  // common typos / Hinglish variants
  'better ki', 'better kit', 'batry', 'baytri', 'bettery', 'charge kitna',
  'sari details', 'saari details', 'full details', 'a se z', 'a to z',
  'meri jankari', 'system', 'hardware', 'sim', 'signal',

];

export function isDeviceRelatedMessage(message?: string): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return DEVICE_KEYWORDS.some((k) => m.includes(k));
}

const FONT_LIST = [
  'Arial', 'Verdana', 'Helvetica', 'Times New Roman', 'Georgia', 'Courier New',
  'Trebuchet MS', 'Impact', 'Comic Sans MS', 'Palatino', 'Garamond', 'Tahoma',
  'Lucida Console', 'Segoe UI', 'Roboto', 'Noto Sans', 'Open Sans', 'Lato',
  'Montserrat', 'Poppins', 'Ubuntu', 'Fira Sans', 'Calibri', 'Cambria',
  'Consolas', 'Mangal', 'Nirmala UI', 'Aparajita', 'Kokila', 'Utsaah',
  'Lohit Devanagari', 'Noto Sans Devanagari', 'Tiro Devanagari Hindi', 'Hind',
  'Mukta', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono',
  'IBM Plex Mono', 'Hack', 'Inconsolata', 'Source Code Pro', 'Menlo', 'Monaco',
  'Andale Mono', 'DejaVu Sans Mono',
];

const detectFonts = (): string[] => {
  try {
    return FONT_LIST.filter((f) => (document as any).fonts?.check?.(`12px "${f}"`));
  } catch {
    return [];
  }
};

const detectPlugins = (): string[] => {
  try {
    const nav = navigator as any;
    const out: string[] = [];
    if (nav.plugins) for (let i = 0; i < nav.plugins.length; i++) out.push(nav.plugins[i].name);
    return out;
  } catch {
    return [];
  }
};

export interface LiveDeviceSnapshot {
  captured_at: string;
  device: Record<string, any>;
  battery: { level: number | null; charging: boolean | null };
  network: Record<string, any>;
  graphics: Record<string, any>;
  security_signals: Record<string, any>;
  permissions: Array<{ name: string; state: string }>;
  webrtc: { leak_detected: boolean; local_ips: string[]; public_ips: string[] };
  fingerprint: { sha256: string; canvas: string; audio: string; components_count: number };
  fonts: { count: number; sample: string[] };
  plugins: { count: number; list: string[] };
  login: {
    total_logins: number | null;
    last_login_at: string | null;
    account_created_at: string | null;
    logins_per_week: string | null;
  };
  ip_history: {
    first_ip: string | null;
    last_ip: string | null;
    total_unique_ips: number | null;
    recent: Array<{ ip: string; first_seen: string }>;
  };
}

const withTimeout = <T,>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
  Promise.race([p.catch(() => fallback), new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);

/**
 * Collect a complete, LIVE device snapshot. Every value is measured at call
 * time, so asking at 3:06 gives 3:06 data and asking at 5:00 gives 5:00 data.
 */
export async function collectLiveDeviceSnapshot(): Promise<LiveDeviceSnapshot | null> {
  if (typeof window === 'undefined') return null;

  try {
    const info = getDeviceInfo();
    const signals = getAdditionalSignals();

    const [
      battery,
      audioFP,
      incognito,
      adBlocker,
      permissions,
      fpHash,
      androidVersion,
    ] = await Promise.all([
      withTimeout(getBatteryInfo(), 3000, null),
      withTimeout(getAudioFingerprint(), 3000, 'N/A'),
      withTimeout(detectIncognitoMode(), 3000, false),
      withTimeout(detectAdBlocker(), 3000, false),
      withTimeout(getPermissionStatuses(), 3000, []),
      withTimeout(generateFingerprint(), 3000, ''),
      withTimeout(fetchRealAndroidVersion(), 2000, null),
    ]);

    if (androidVersion) info.operating_system = `Android ${androidVersion}`;

    const nav = navigator as any;
    // Read the live Network Information API values the SAME way the
    // "Device Information" sheet does, so AI and sheet never disagree.
    const readNetwork = () => {
      const c = nav.connection || nav.mozConnection || nav.webkitConnection;
      return {
        type: getNetworkType(), // "5G" / "4G" / "3G" / "2G" — same label as the sheet
        downlink: typeof c?.downlink === 'number' ? c.downlink : 0,
        rtt: typeof c?.rtt === 'number' ? c.rtt : 0,
      };
    };

    // Fresh IP / ISP / VPN lookup + persists a new device_info_logs row
    let netInfo: any = {};
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/get-ip-info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: ANON_KEY,
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          device_info: info,
          fingerprint_components: getFingerprintComponents(),
          network_type: readNetwork().type,
          downlink_speed: `${readNetwork().downlink} Mbps`,
          latency_ms: `${readNetwork().rtt} ms`,
          audio_fingerprint: audioFP,
          incognito_detected: incognito,
          ad_blocker_detected: adBlocker,
          color_depth: signals.color_depth,
          pixel_ratio: signals.pixel_ratio,
          max_touch_points: signals.max_touch_points,
          do_not_track: signals.do_not_track,
          platform: signals.platform,
          cookies_enabled: signals.cookies_enabled,
          battery_level: battery?.level ?? null,
          battery_charging: battery?.charging ?? null,
          webgl_vendor: info.webgl_vendor ?? null,
          webgl_version: info.webgl_version ?? null,
        }),
      });
      netInfo = await res.json().catch(() => ({}));
    } catch {
      netInfo = {};
    }

    const webrtc = await withTimeout(
      detectWebRTCLeak(netInfo?.public_ip || '', 4000, !!netInfo?.vpn_detected),
      4500,
      { localIPs: [], publicIPs: [], leakDetected: false },
    );

    // Login frequency + IP history from the user's own profile row
    const login: LiveDeviceSnapshot['login'] = {
      total_logins: null, last_login_at: null, account_created_at: null, logins_per_week: null,
    };
    const ipHistory: LiveDeviceSnapshot['ip_history'] = {
      first_ip: null, last_ip: null, total_unique_ips: null, recent: [],
    };
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        const { data: p } = await supabase
          .from('profiles')
          .select('login_count, last_login_at, created_at, first_ip, last_ip, total_unique_ips, user_ip_history')
          .eq('user_id', session.user.id)
          .maybeSingle();
        if (p) {
          const anyP = p as any;
          login.total_logins = anyP.login_count ?? null;
          login.last_login_at = anyP.last_login_at ?? null;
          login.account_created_at = anyP.created_at ?? null;
          if (anyP.created_at && anyP.login_count) {
            const weeks = Math.max(1, (Date.now() - new Date(anyP.created_at).getTime()) / (7 * 864e5));
            login.logins_per_week = `~${(Number(anyP.login_count) / weeks).toFixed(1)} logins/week`;
          }
          ipHistory.first_ip = anyP.first_ip ?? null;
          ipHistory.last_ip = anyP.last_ip ?? null;
          ipHistory.total_unique_ips = anyP.total_unique_ips ?? null;
          ipHistory.recent = Array.isArray(anyP.user_ip_history)
            ? anyP.user_ip_history.slice(-8).reverse()
            : [];
        }
      }
    } catch {
      /* non-critical */
    }

    const fonts = detectFonts();
    const plugins = detectPlugins();

    return {
      captured_at: new Date().toISOString(),
      device: {
        device_id: info.device_id,
        browser: `${info.browser_name} ${info.browser_version}`,
        operating_system: info.operating_system,
        device_type: info.device_type,
        screen_resolution: info.screen_resolution,
        viewport_size: info.viewport_size,
        device_memory: info.device_memory,
        cpu_cores: info.hardware_concurrency,
        timezone: info.timezone,
        language: info.language,
        incognito,
        ad_blocker: adBlocker,
      },
      battery: { level: battery?.level ?? null, charging: battery?.charging ?? null },
      network: {
        network_type: readNetwork().type,
        download_speed: `${readNetwork().downlink} Mbps`,
        latency: `${readNetwork().rtt} ms`,
        online: navigator.onLine,
        public_ip: netInfo?.public_ip ?? null,
        country: netInfo?.country ?? null,
        state: netInfo?.state ?? null,
        city: netInfo?.city ?? null,
        isp: netInfo?.isp ?? null,
        asn: netInfo?.asn ?? null,
        vpn_detected: netInfo?.vpn_detected ?? null,
        is_tor: netInfo?.is_tor ?? null,
        is_datacenter: netInfo?.is_datacenter ?? null,
        proxy_type: netInfo?.proxy_type ?? 'None',
      },
      graphics: {
        canvas_fingerprint: info.canvas_fingerprint,
        gpu_renderer: info.webgl_renderer,
        gpu_vendor: info.webgl_vendor,
        webgl_version: info.webgl_version,
        glsl_version: info.webgl_shading_language,
        max_texture_size: info.webgl_max_texture_size,
        extensions_count: info.webgl_extensions_count,
      },
      security_signals: {
        color_depth: `${signals.color_depth}-bit`,
        pixel_ratio: `${signals.pixel_ratio}x`,
        max_touch_points: signals.max_touch_points,
        do_not_track: signals.do_not_track,
        platform: signals.platform,
        pdf_viewer: signals.pdf_viewer_enabled,
        cookies_enabled: signals.cookies_enabled,
      },
      permissions: permissions.map((p) => ({ name: p.name, state: p.state })),
      webrtc: {
        leak_detected: webrtc.leakDetected,
        local_ips: webrtc.localIPs,
        public_ips: webrtc.publicIPs,
      },
      fingerprint: {
        sha256: fpHash,
        canvas: info.canvas_fingerprint,
        audio: audioFP,
        components_count: getFingerprintComponents().length,
      },
      fonts: { count: fonts.length, sample: fonts.slice(0, 25) },
      plugins: { count: plugins.length, list: plugins.slice(0, 10) },
      login,
      ip_history: ipHistory,
    };
  } catch (e) {
    console.warn('[live-device] snapshot failed', e);
    return null;
  }
}
