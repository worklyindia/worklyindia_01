import { supabase } from "@/integrations/supabase/client";
import { CANONICAL_URL } from '@/config/domainConfig';

const SUPABASE_STORAGE_BASE = "https://jubwzelupbntbetpajqb.supabase.co/storage/v1";

// Default fallback logo URL
const DEFAULT_LOGO = '/icons/icon-512x512.png?v=20261022';

/**
 * Strip query params from a Supabase storage URL to get the raw object URL
 * Then use /render/image/ endpoint for resizing
 */
export const getSquareIconUrl = (logoUrl: string, size: number): string => {
  if (logoUrl === DEFAULT_LOGO) return `/icons/icon-${size}x${size}.png?v=20261022`;
  // If it's a Supabase storage URL, use the render/image endpoint for resizing
  if (logoUrl.includes('supabase.co/storage/v1/')) {
    // Extract the path after /object/public/ or /render/image/public/
    let storagePath = '';
    const objectMatch = logoUrl.match(/\/storage\/v1\/(?:object|render\/image)\/public\/(.+?)(\?|$)/);
    if (objectMatch) {
      storagePath = objectMatch[1];
    }
    if (storagePath) {
      return `${SUPABASE_STORAGE_BASE}/render/image/public/${storagePath}?width=${size}&height=${size}&resize=cover`;
    }
  }
  // For non-Supabase URLs, return as-is
  return logoUrl;
};

interface PwaSettings {
  pwa_app_name?: string;
  pwa_app_description?: string;
  pwa_app_icon?: string;
  pwa_screenshot_1?: string;
  pwa_screenshot_2?: string;
  pwa_feature_graphic?: string;
}

/**
 * Fetch PWA-specific settings from app_settings table
 */
const fetchPwaSettings = async (): Promise<PwaSettings> => {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('setting_key, setting_value')
      .in('setting_key', [
        'pwa_app_name', 'pwa_app_description', 'pwa_app_icon',
        'pwa_screenshot_1', 'pwa_screenshot_2', 'pwa_feature_graphic'
      ]);
    
    if (error) throw error;
    
    const settings: PwaSettings = {};
    data?.forEach(row => {
      if (row.setting_value) {
        (settings as any)[row.setting_key] = row.setting_value;
      }
    });
    return settings;
  } catch {
    return {};
  }
};

/**
 * Build the complete manifest JSON dynamically from brand assets
 */
export const buildDynamicManifest = async (): Promise<object | null> => {
  try {
    // Fetch brand assets and PWA settings in parallel
    const [brandResult, pwaSettings] = await Promise.all([
      supabase.rpc('get_brand_assets'),
      fetchPwaSettings()
    ]);

    if (brandResult.error) throw brandResult.error;
    
    const assets = brandResult.data as any;
    if (!assets) return null;

    const logoUrl = assets.logo_url || DEFAULT_LOGO;
    const iconUrl = pwaSettings.pwa_app_icon || DEFAULT_LOGO;
    const appName = pwaSettings.pwa_app_name || assets.brand_name || 'Workly India';
    const appDescription = pwaSettings.pwa_app_description || 
      'Find the best remote jobs, online earning opportunities, and Workly India positions across India';

    // Build screenshot entries
    const screenshots: any[] = [];
    if (pwaSettings.pwa_screenshot_1) {
      screenshots.push({
        src: pwaSettings.pwa_screenshot_1,
        sizes: "540x960",
        type: "image/png",
        form_factor: "narrow",
        label: `${appName} - Browse Jobs`
      });
    } else {
      screenshots.push({
        src: "/screenshots/screenshot-1.jpg",
        sizes: "540x960",
        type: "image/jpeg",
        form_factor: "narrow",
        label: `${appName} - Browse Jobs`
      });
    }
    if (pwaSettings.pwa_screenshot_2) {
      screenshots.push({
        src: pwaSettings.pwa_screenshot_2,
        sizes: "540x960",
        type: "image/png",
        form_factor: "narrow",
        label: `${appName} - Career Paths`
      });
    } else {
      screenshots.push({
        src: "/screenshots/screenshot-2.jpg",
        sizes: "540x960",
        type: "image/jpeg",
        form_factor: "narrow",
        label: `${appName} - Career Paths`
      });
    }
    if (pwaSettings.pwa_feature_graphic) {
      screenshots.push({
        src: pwaSettings.pwa_feature_graphic,
        sizes: "1024x576",
        type: "image/png",
        form_factor: "wide",
        label: `${appName} - Find Your Dream Remote Job`
      });
    } else {
      screenshots.push({
        src: "/screenshots/feature-graphic.jpg",
        sizes: "1024x576",
        type: "image/jpeg",
        form_factor: "wide",
        label: `${appName} - Find Your Dream Remote Job`
      });
    }

    const isDark = (() => {
      try {
        const stored = window.localStorage.getItem('workly-theme');
        if (stored === 'dark' || stored === 'light') return stored === 'dark';
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
      } catch {
        return false;
      }
    })();
    const manifest: any = {
      gcm_sender_id: "215114168483",
      name: appName,
      short_name: appName,
      description: appDescription,
      id: "/",
      start_url: "/",
      scope: "/",
      display: "standalone",
      display_override: ["tabbed", "window-controls-overlay", "standalone", "minimal-ui"],
      background_color: isDark ? "#010816" : "#f7f9fb",
      theme_color: isDark ? "#010816" : "#f7f9fb",
      orientation: "portrait-primary",
      categories: ["business", "productivity", "education"],
      lang: "en-IN",
      dir: "ltr",
      iarc_rating_id: "e84b072d-71b3-4d3e-86ae-31a8ce4e53b7",
      prefer_related_applications: false,
      related_applications: [
        {
          platform: "play",
          url: "https://play.google.com/store/apps/details?id=online.workfromhomeindia.twa",
          id: "online.workfromhomeindia.twa"
        }
      ],
      icons: [
        { src: getSquareIconUrl(iconUrl, 512), sizes: "512x512", type: "image/png", purpose: "any" },
        { src: iconUrl === DEFAULT_LOGO ? '/icons/maskable-512x512.png?v=20261022' : getSquareIconUrl(iconUrl, 512), sizes: "512x512", type: "image/png", purpose: "maskable" },
        { src: getSquareIconUrl(iconUrl, 192), sizes: "192x192", type: "image/png", purpose: "any" },
        { src: getSquareIconUrl(iconUrl, 144), sizes: "144x144", type: "image/png", purpose: "any" },
        { src: getSquareIconUrl(iconUrl, 96), sizes: "96x96", type: "image/png", purpose: "any" },
        { src: getSquareIconUrl(iconUrl, 72), sizes: "72x72", type: "image/png", purpose: "any" },
        { src: getSquareIconUrl(iconUrl, 48), sizes: "48x48", type: "image/png", purpose: "any" }
      ],
      screenshots,
      shortcuts: [
        {
          name: "Browse Jobs",
          short_name: "Jobs",
          description: "Browse all remote jobs",
          url: "/jobs",
          icons: [{ src: "/icons/icon-96x96.png", sizes: "96x96", type: "image/png" }]
        },
        {
          name: "Hot Leads",
          short_name: "Leads",
          description: "Check hot job leads",
          url: "/hot-leads",
          icons: [{ src: "/icons/icon-96x96.png", sizes: "96x96", type: "image/png" }]
        },
        {
          name: "Career Path",
          short_name: "Career",
          description: "Explore career paths",
          url: "/career-path",
          icons: [{ src: "/icons/icon-96x96.png", sizes: "96x96", type: "image/png" }]
        }
      ],
      share_target: {
        action: "/",
        method: "GET",
        enctype: "application/x-www-form-urlencoded",
        params: { title: "title", text: "text", url: "url" }
      },
      file_handlers: [
        { action: "/", accept: { "application/pdf": [".pdf"], "image/*": [".png", ".jpg", ".jpeg", ".webp"] } }
      ],
      protocol_handlers: [
        { protocol: "web+worklyindia", url: "/%s" }
      ],
      edge_side_panel: { preferred_width: 400 },
      handle_links: "preferred",
      launch_handler: { client_mode: "navigate-existing" },
      note_taking: { new_note_url: "/" },
      tab_strip: {
        home_tab: {
          scope_patterns: [
            { pathname: "/" },
            { pathname: "/jobs" },
            { pathname: "/jobs/*" }
          ]
        },
        new_tab_button: { url: "/jobs" }
      },
      scope_extensions: [
        { type: "origin", origin: CANONICAL_URL },
        { type: "origin", origin: CANONICAL_URL }
      ],
      widgets: [
        {
          name: "Latest Jobs",
          short_name: "Jobs",
          description: "View latest remote job listings on Workly India",
          tag: "latest-jobs",
          type: "application/json",
          template: "latest-jobs-template",
          ms_ac_template: `${CANONICAL_URL}/widget/latest-jobs.json`,
          data: `${CANONICAL_URL}/widget/latest-jobs-data.json`,
          update: 86400,
          screenshots: [
            { src: `${CANONICAL_URL}/screenshots/widget-jobs.jpg`, sizes: "600x400", label: "Latest Jobs Widget" }
          ],
          icons: [
            { src: `${CANONICAL_URL}/icons/icon-96x96.png`, sizes: "96x96", type: "image/png" }
          ]
        }
      ]
    };

    // The dynamic manifest is served from a data: URI, which has no base URL.
    // Any relative path inside it (start_url, scope, icon src, screenshots …)
    // would fail to resolve and Chrome would silently reject the install
    // prompt / fall back to a generic icon. Absolutise everything first.
    const origin = typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : CANONICAL_URL;
    const URL_KEYS = new Set([
      'src', 'url', 'id', 'start_url', 'scope', 'action',
      'ms_ac_template', 'data', 'new_note_url',
    ]);
    const toAbsolute = (value: string): string => {
      if (!value) return value;
      if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return value; // already http(s)/data/web+…
      return `${origin}${value.startsWith('/') ? '' : '/'}${value}`;
    };
    const absolutise = (node: any): any => {
      if (Array.isArray(node)) return node.map(absolutise);
      if (node && typeof node === 'object') {
        const out: any = {};
        for (const [key, value] of Object.entries(node)) {
          out[key] = typeof value === 'string' && URL_KEYS.has(key)
            ? toAbsolute(value)
            : absolutise(value);
        }
        return out;
      }
      return node;
    };

    return absolutise(manifest);
  } catch (err) {
    console.error('Failed to build dynamic manifest:', err);
    return null;
  }
};

/**
 * Inject dynamic manifest into the page by replacing the static manifest link
 */
export const injectDynamicManifest = async (): Promise<void> => {
  try {
    const manifest = await buildDynamicManifest();
    if (!manifest) return;

    // Write the dynamic manifest to a data URI instead of blob URL
    // so PWABuilder and crawlers can still detect the static /manifest.json
    const manifestJson = JSON.stringify(manifest);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(manifestJson)}`;

    // Find the manifest link - keep static /manifest.json as fallback
    let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
    if (link) {
      // Only update if brand assets differ from defaults (preserve static manifest for crawlers)
      link.href = dataUri;
    } else {
      link = document.createElement('link');
      link.rel = 'manifest';
      link.href = dataUri;
      document.head.appendChild(link);
    }
  } catch (err) {
    console.error('Failed to inject dynamic manifest:', err);
    // Static manifest.json remains as fallback
  }
};
