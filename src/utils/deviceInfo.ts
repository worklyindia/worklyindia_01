/**
 * Device Information Utility
 * Collects comprehensive device, browser, and fingerprint data
 */

export interface DeviceInfo {
  device_id: string;
  browser_name: string;
  browser_version: string;
  operating_system: string;
  device_type: 'mobile' | 'desktop' | 'tablet';
  screen_resolution: string;
  viewport_size: string;
  device_memory: string;
  hardware_concurrency: string;
  timezone: string;
  language: string;
  canvas_fingerprint: string;
  webgl_renderer: string;
  webgl_vendor: string;
  webgl_version: string;
  webgl_shading_language: string;
  webgl_max_texture_size: string;
  webgl_extensions_count: string;
}

const DEVICE_ID_KEY = 'wfh_device_id';

/** Get or create persistent device ID */
const createDeviceId = (): string => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // Use a non-cryptographic fallback only for a local display identifier.
  }
  return `wfh-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

const getDeviceId = (): string => {
  try {
    const existing = window.localStorage?.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const id = createDeviceId();
    try { window.localStorage?.setItem(DEVICE_ID_KEY, id); } catch { /* storage can be disabled */ }
    return id;
  } catch {
    return createDeviceId();
  }
};

/** Parse browser name and version from user agent */
const parseBrowser = (ua: string): { name: string; version: string } => {
  const browsers: [RegExp, string][] = [
    [/SamsungBrowser\/([\d.]+)/, 'Samsung Internet'],
    [/OPR\/([\d.]+)/, 'Opera'],
    [/Edg\/([\d.]+)/, 'Microsoft Edge'],
    [/Firefox\/([\d.]+)/, 'Firefox'],
    [/Chrome\/([\d.]+)/, 'Chrome'],
    [/Safari\/([\d.]+)/, 'Safari'],
  ];

  for (const [regex, name] of browsers) {
    const match = ua.match(regex);
    if (match) return { name, version: match[1] };
  }
  return { name: 'Unknown', version: 'Unknown' };
};

/** Detect operating system (uses User-Agent Client Hints for accurate Android version) */
const detectOS = (ua: string): string => {
  if (/Android/.test(ua)) {
    // Chrome 110+ freezes Android version to "10" in UA string
    // Use User-Agent Client Hints API for accurate version
    const nav = navigator as any;
    if (nav.userAgentData) {
      try {
        // getHighEntropyValues is async, so we cache it
        // For sync fallback, try platform version from UA
        const platform = nav.userAgentData.platform;
        if (platform === 'Android') {
          // Return placeholder; will be updated async
          const cached = (window as any).__real_android_version;
          if (cached) return `Android ${cached}`;
          return `Android ${ua.match(/Android ([\d.]+)/)?.[1] || ''}`;
        }
      } catch {
        // fallback below
      }
    }
    return `Android ${ua.match(/Android ([\d.]+)/)?.[1] || ''}`;
  }
  if (/iPhone OS ([\d_]+)/.test(ua)) return `iOS ${ua.match(/iPhone OS ([\d_]+)/)?.[1]?.replace(/_/g, '.')}`;
  if (/iPad.*OS ([\d_]+)/.test(ua)) return `iPadOS ${ua.match(/OS ([\d_]+)/)?.[1]?.replace(/_/g, '.')}`;
  if (/Windows NT 10/.test(ua)) return 'Windows 10/11';
  if (/Windows NT 6.3/.test(ua)) return 'Windows 8.1';
  if (/Windows NT 6.1/.test(ua)) return 'Windows 7';
  if (/Mac OS X ([\d_]+)/.test(ua)) return `macOS ${ua.match(/Mac OS X ([\d_]+)/)?.[1]?.replace(/_/g, '.')}`;
  if (/Linux/.test(ua)) return 'Linux';
  if (/CrOS/.test(ua)) return 'Chrome OS';
  return 'Unknown';
};

/** Fetch real Android version using Client Hints API (async) */
export const fetchRealAndroidVersion = async (): Promise<string | null> => {
  try {
    const nav = navigator as any;
    if (!nav.userAgentData) return null;
    const data = await nav.userAgentData.getHighEntropyValues(['platformVersion', 'platform']);
    if (data.platform === 'Android' && data.platformVersion) {
      const version = data.platformVersion;
      (window as any).__real_android_version = version;
      return version;
    }
  } catch {
    // Not supported
  }
  return null;
};

/** Detect device type */
const detectDeviceType = (ua: string): 'mobile' | 'desktop' | 'tablet' => {
  const isMobile = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) && /Mobile/i.test(ua);
  const isTablet = /iPad/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua));
  if (isTablet) return 'tablet';
  if (isMobile) return 'mobile';
  return 'desktop';
};

/** Generate canvas fingerprint */
export const getCanvasFingerprint = (): string => {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'N/A';
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('Fingerprint', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('Canvas', 4, 17);
    const dataUrl = canvas.toDataURL();
    let hash = 0;
    for (let i = 0; i < dataUrl.length; i++) {
      hash = ((hash << 5) - hash) + dataUrl.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0').toUpperCase();
  } catch {
    return 'N/A';
  }
};

/** Get detailed WebGL info */
const getWebGLInfo = () => {
  const info = {
    renderer: 'N/A',
    vendor: 'N/A',
    version: 'N/A',
    shadingLanguage: 'N/A',
    maxTextureSize: 'N/A',
    extensionsCount: 'N/A',
  };
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext | null;
    if (!gl) return info;
    const glCtx = gl as WebGLRenderingContext;
    const debugInfo = glCtx.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      info.renderer = glCtx.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'N/A';
      info.vendor = glCtx.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || 'N/A';
    }
    info.version = glCtx.getParameter(glCtx.VERSION) || 'N/A';
    info.shadingLanguage = glCtx.getParameter(glCtx.SHADING_LANGUAGE_VERSION) || 'N/A';
    info.maxTextureSize = `${glCtx.getParameter(glCtx.MAX_TEXTURE_SIZE)}`;
    info.extensionsCount = `${(glCtx.getSupportedExtensions() || []).length}`;
  } catch {
    // ignore
  }
  return info;
};

/**
 * Stable recognition signals that do NOT create or read a device_id.
 * Used when site data/localStorage was cleared and Quick Login must recover
 * the previous device_id from server-side device_info_logs.
 */
export const getRecognitionDeviceProfile = () => {
  const ua = navigator.userAgent;
  const browser = parseBrowser(ua);
  const nav = navigator as any;
  const webgl = getWebGLInfo();

  return {
    browser_name: browser.name,
    operating_system: detectOS(ua),
    screen_resolution: `${window.screen.width}x${window.screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    platform: navigator.platform,
    hardware_concurrency: nav.hardwareConcurrency ? `${nav.hardwareConcurrency} cores` : 'N/A',
    device_memory: nav.deviceMemory ? `${nav.deviceMemory} GB` : 'N/A',
    webgl_renderer: webgl.renderer,
    webgl_vendor: webgl.vendor,
  };
};

/** Collect all device information */
export const getDeviceInfo = (): DeviceInfo => {
  const ua = navigator.userAgent;
  const browser = parseBrowser(ua);
  const nav = navigator as any;
  const webgl = getWebGLInfo();

  return {
    device_id: getDeviceId(),
    browser_name: browser.name,
    browser_version: browser.version,
    operating_system: detectOS(ua),
    device_type: detectDeviceType(ua),
    screen_resolution: `${window.screen.width}x${window.screen.height}`,
    viewport_size: `${window.innerWidth}x${window.innerHeight}`,
    device_memory: nav.deviceMemory ? `${nav.deviceMemory} GB` : 'N/A',
    hardware_concurrency: nav.hardwareConcurrency ? `${nav.hardwareConcurrency} cores` : 'N/A',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    canvas_fingerprint: getCanvasFingerprint(),
    webgl_renderer: webgl.renderer,
    webgl_vendor: webgl.vendor,
    webgl_version: webgl.version,
    webgl_shading_language: webgl.shadingLanguage,
    webgl_max_texture_size: webgl.maxTextureSize,
    webgl_extensions_count: webgl.extensionsCount,
  };
};

/** Get fingerprint components for server-side SHA-256 hashing */
export const getFingerprintComponents = (): string[] => {
  const nav = navigator as any;
  const components = [
    navigator.userAgent,
    `${screen.width}x${screen.height}`,
    `${screen.colorDepth}`,
    `${new Date().getTimezoneOffset()}`,
    navigator.language,
    navigator.platform,
    nav.hardwareConcurrency ? `${nav.hardwareConcurrency}` : '',
    nav.deviceMemory ? `${nav.deviceMemory}` : '',
    'ontouchstart' in window ? 'touch' : 'no-touch',
    navigator.cookieEnabled ? 'cookies' : 'no-cookies',
  ];

  // Screen available dimensions (differs from resolution due to taskbars)
  components.push(`avail:${screen.availWidth}x${screen.availHeight}`);

  // Navigator plugins count
  components.push(`plugins:${nav.plugins?.length ?? 0}`);

  // Navigator MIME types count
  components.push(`mimeTypes:${nav.mimeTypes?.length ?? 0}`);

  // Date locale format differences
  try {
    const d = new Date(2000, 0, 1, 12, 0, 0);
    components.push(`locale:${d.toLocaleString()}`);
  } catch { /* ignore */ }

  // Speech synthesis voices (device-specific list)
  try {
    if ('speechSynthesis' in window) {
      const voices = speechSynthesis.getVoices();
      if (voices.length > 0) {
        components.push(`voices:${voices.length}:${voices.map(v => v.name).sort().join(',').substring(0, 200)}`);
      } else {
        components.push('voices:0');
      }
    }
  } catch { /* ignore */ }

  // Try to get WebGL renderer
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const glCtx = gl as WebGLRenderingContext;
      const debugInfo = glCtx.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        components.push(glCtx.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
      }

      // WebGL2 GPU-specific parameters
      const gl2 = canvas.getContext('webgl2') as WebGL2RenderingContext | null;
      if (gl2) {
        components.push(`gl2:vu${gl2.getParameter(gl2.MAX_VERTEX_UNIFORM_COMPONENTS)}`);
        components.push(`gl2:fu${gl2.getParameter(gl2.MAX_FRAGMENT_UNIFORM_COMPONENTS)}`);
        components.push(`gl2:vv${gl2.getParameter(gl2.MAX_VARYING_COMPONENTS)}`);
        components.push(`gl2:tex3d${gl2.getParameter(gl2.MAX_3D_TEXTURE_SIZE)}`);
      }
    }
  } catch {
    // ignore
  }

  // Add canvas fingerprint
  components.push(getCanvasFingerprint());

  return components;
};

/** Generate a browser fingerprint hash (client-side fallback, async SHA-256) */
export const generateFingerprint = async (): Promise<string> => {
  const components = getFingerprintComponents();
  const data = components.join('|');
  
  try {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex.substring(0, 32).toUpperCase();
  } catch {
    // Fallback for environments without crypto.subtle
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0').toUpperCase();
  }
};

/** Get battery information */
export const getBatteryInfo = async (): Promise<{ level: number; charging: boolean } | null> => {
  try {
    const nav = navigator as any;
    if (!nav.getBattery) return null;
    const battery = await nav.getBattery();
    return {
      level: Math.round(battery.level * 100),
      charging: battery.charging,
    };
  } catch {
    return null;
  }
};
