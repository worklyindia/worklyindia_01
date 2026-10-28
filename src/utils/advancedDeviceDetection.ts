/**
 * Advanced Device Detection Utilities
 * Audio fingerprint, incognito detection, ad blocker detection, permissions check
 */

/** Generate audio fingerprint using OfflineAudioContext (guaranteed silent) */
export const getAudioFingerprint = async (): Promise<string> => {
  try {
    const OfflineCtx = (window as any).OfflineAudioContext || (window as any).webkitOfflineAudioContext;
    
    // Fallback: if OfflineAudioContext unavailable, hash audio properties instead
    if (!OfflineCtx) {
      try {
        const ac = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
        const fallbackData = [
          ac.sampleRate,
          ac.destination.maxChannelCount,
          ac.destination.numberOfInputs,
          ac.destination.numberOfOutputs,
          ac.destination.channelCount,
        ].join('|');
        ac.close();
        let h = 0;
        for (let i = 0; i < fallbackData.length; i++) {
          h = ((h << 5) - h) + fallbackData.charCodeAt(i);
          h = h & h;
        }
        return Math.abs(h).toString(16).padStart(8, '0').toUpperCase();
      } catch {
        return 'N/A';
      }
    }

    // Use a very short buffer (5000 samples) to minimize any potential audio leak
    const ctx = new OfflineCtx(1, 5000, 44100);
    const oscillator = ctx.createOscillator();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(10000, ctx.currentTime);

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-50, ctx.currentTime);
    compressor.knee.setValueAtTime(40, ctx.currentTime);
    compressor.ratio.setValueAtTime(12, ctx.currentTime);
    compressor.attack.setValueAtTime(0, ctx.currentTime);
    compressor.release.setValueAtTime(0.25, ctx.currentTime);

    oscillator.connect(compressor);
    compressor.connect(ctx.destination);
    oscillator.start(0);
    ctx.startRendering();

    const buffer = await new Promise<AudioBuffer>((resolve, reject) => {
      ctx.oncomplete = (e: any) => resolve(e.renderedBuffer);
      setTimeout(() => reject(new Error('timeout')), 3000);
    });

    // Explicitly stop oscillator after rendering
    try { oscillator.stop(); } catch { /* already stopped */ }

    const data = buffer.getChannelData(0);
    let hash = 0;
    // Sample from the middle of the short buffer
    const start = Math.min(2000, data.length - 500);
    const end = Math.min(start + 500, data.length);
    for (let i = start; i < end; i++) {
      hash = ((hash << 5) - hash) + Math.floor(data[i] * 1000000);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0').toUpperCase();
  } catch {
    return 'N/A';
  }
};

/** Detect incognito/private browsing mode */
export const detectIncognitoMode = async (): Promise<boolean> => {
  try {
    let signals = 0;

    // Method 1: StorageManager quota check (Chrome incognito has ~120MB quota)
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const { quota } = await navigator.storage.estimate();
      // Chrome incognito typically has ~120MB, normal mode has several GB
      // Use 300MB threshold to avoid mobile false positives (some report ~500MB normally)
      if (quota && quota < 300 * 1024 * 1024) signals++;
    }

    // Method 2: FileSystem API (not available in incognito in Chrome)
    if ('webkitRequestFileSystem' in window) {
      const fsBlocked = await new Promise<boolean>((resolve) => {
        (window as any).webkitRequestFileSystem(
          0, 1,
          () => resolve(false),
          () => resolve(true)
        );
      });
      if (fsBlocked) signals++;
    }

    // Method 3: IndexedDB test for Firefox private mode
    try {
      const db = indexedDB.open('incognito_test');
      db.onerror = () => {};
      await new Promise<void>((resolve, reject) => {
        db.onsuccess = () => { resolve(); };
        db.onerror = () => { reject(); };
        setTimeout(resolve, 500);
      });
    } catch {
      signals++;
    }

    // Method 4: performance.memory check (Chrome-based only)
    const perf = performance as any;
    if (perf.memory) {
      // In incognito, jsHeapSizeLimit is typically much smaller
      if (perf.memory.jsHeapSizeLimit < 500 * 1024 * 1024) signals++;
    }

    // Require at least 1 strong signal to flag as incognito
    return signals >= 1;
  } catch {
    return false;
  }
};

/** Detect ad blocker using DOM-only approach (no network fetch to avoid VPN false positives) */
export const detectAdBlocker = async (): Promise<boolean> => {
  try {
    let signals = 0;

    // Method 1: Bait div with ad-related class names
    const testAd = document.createElement('div');
    testAd.innerHTML = '&nbsp;';
    testAd.className = 'adsbox ad-placement adsbygoogle';
    testAd.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;';
    document.body.appendChild(testAd);

    await new Promise(r => setTimeout(r, 150));

    const blocked1 = testAd.offsetHeight === 0 || testAd.clientHeight === 0 ||
      window.getComputedStyle(testAd).display === 'none';
    document.body.removeChild(testAd);
    if (blocked1) signals++;

    // Method 2: Another bait div with different ad class names
    const testAd2 = document.createElement('div');
    testAd2.innerHTML = '&nbsp;';
    testAd2.className = 'ad-banner banner-ads ad-container';
    testAd2.id = 'ad-wrapper';
    testAd2.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:300px;height:250px;';
    document.body.appendChild(testAd2);

    await new Promise(r => setTimeout(r, 150));

    const blocked2 = testAd2.offsetHeight === 0 || testAd2.clientHeight === 0 ||
      window.getComputedStyle(testAd2).display === 'none';
    document.body.removeChild(testAd2);
    if (blocked2) signals++;

    // Only flag as ad blocker if at least 1 DOM-based signal triggers
    // (avoids false positives from VPN blocking network requests)
    return signals >= 1;
  } catch {
    return false;
  }
};

/** Get browser permission statuses */
export interface PermissionStatus {
  name: string;
  state: 'granted' | 'denied' | 'prompt' | 'unsupported';
}

export const getPermissionStatuses = async (): Promise<PermissionStatus[]> => {
  const permissions = ['geolocation', 'notifications', 'camera', 'microphone', 'clipboard-read'];
  const results: PermissionStatus[] = [];

  for (const name of permissions) {
    try {
      if ('permissions' in navigator) {
        const status = await navigator.permissions.query({ name: name as PermissionName });
        results.push({ name, state: status.state as any });
      } else {
        results.push({ name, state: 'unsupported' });
      }
    } catch {
      results.push({ name, state: 'unsupported' });
    }
  }

  return results;
};

/** Get additional device signals */
export interface AdditionalDeviceSignals {
  color_depth: number;
  pixel_ratio: number;
  max_touch_points: number;
  do_not_track: string;
  platform: string;
  pdf_viewer_enabled: string;
  cookies_enabled: boolean;
}

export const getAdditionalSignals = (): AdditionalDeviceSignals => {
  const nav = navigator as any;
  return {
    color_depth: screen.colorDepth,
    pixel_ratio: Math.round(window.devicePixelRatio * 100) / 100,
    max_touch_points: navigator.maxTouchPoints || 0,
    do_not_track: navigator.doNotTrack || 'unspecified',
    platform: nav.platform || 'Unknown',
    pdf_viewer_enabled: nav.pdfViewerEnabled !== undefined ? (nav.pdfViewerEnabled ? 'Yes' : 'No') : 'Unknown',
    cookies_enabled: navigator.cookieEnabled,
  };
};

/** Font fingerprint: detect installed fonts via DOM width measurement */
export const getFontFingerprint = (): string => {
  try {
    const testFonts = [
      'Arial', 'Arial Black', 'Calibri', 'Cambria', 'Century Gothic',
      'Comic Sans MS', 'Consolas', 'Courier New', 'Georgia', 'Helvetica',
      'Impact', 'Lucida Console', 'Lucida Sans', 'Palatino Linotype',
      'Segoe UI', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana',
      'Roboto', 'Noto Sans', 'Ubuntu', 'Open Sans', 'Lato',
      'Source Sans Pro', 'Fira Sans', 'Droid Sans', 'PT Sans',
      'Mangal', 'Nirmala UI', 'Kokila',
    ];

    const testString = 'mmmmmmmmmmlli';
    const testSize = '72px';

    const span = document.createElement('span');
    span.style.cssText = 'position:absolute;left:-9999px;top:-9999px;visibility:hidden;';
    span.style.fontSize = testSize;
    span.textContent = testString;
    document.body.appendChild(span);

    // Baseline widths
    span.style.fontFamily = 'monospace';
    const monoWidth = span.offsetWidth;
    span.style.fontFamily = 'sans-serif';
    const sansWidth = span.offsetWidth;
    span.style.fontFamily = 'serif';
    const serifWidth = span.offsetWidth;

    let bits = '';
    for (const font of testFonts) {
      span.style.fontFamily = `'${font}', monospace`;
      const w1 = span.offsetWidth;
      span.style.fontFamily = `'${font}', sans-serif`;
      const w2 = span.offsetWidth;
      bits += (w1 !== monoWidth || w2 !== sansWidth) ? '1' : '0';
    }

    document.body.removeChild(span);

    // Hash the bit pattern
    let hash = 0;
    for (let i = 0; i < bits.length; i++) {
      hash = ((hash << 5) - hash) + bits.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0').toUpperCase();
  } catch {
    return 'N/A';
  }
};

/** Math precision fingerprint: hash of engine-specific math results */
export const getMathFingerprint = (): string => {
  try {
    const values = [
      Math.tan(-1e300),
      Math.acos(0.123456789),
      Math.sinh(1),
      Math.cbrt(2),
      Math.log(1000),
      Math.exp(1),
      Math.atan2(1, 2),
      Math.pow(Math.PI, -100),
    ];
    const data = values.map(v => v.toString()).join('|');
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash) + data.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0').toUpperCase();
  } catch {
    return 'N/A';
  }
};
