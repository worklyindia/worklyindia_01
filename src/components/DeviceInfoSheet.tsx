import React, { useEffect, useState, useMemo } from 'react';
import { NativeBottomSheet } from '@/components/NativeBottomSheet';
import { Smartphone, Globe, Fingerprint, Shield, ShieldAlert, Copy, Check, Monitor, Activity, MapPin, AlertTriangle, ChevronRight, Wifi, Battery, BatteryCharging, Eye, Radio, Skull, Lock, EyeOff, ShieldBan, Volume2, Key, Type, Puzzle } from 'lucide-react';
import { detectWebRTCLeak, type WebRTCLeakResult } from '@/utils/webrtcLeakDetect';
import { getDeviceInfo, getFingerprintComponents, getBatteryInfo, fetchRealAndroidVersion, type DeviceInfo } from '@/utils/deviceInfo';
import { getAudioFingerprint, detectIncognitoMode, detectAdBlocker, getPermissionStatuses, getAdditionalSignals, type PermissionStatus, type AdditionalDeviceSignals } from '@/utils/advancedDeviceDetection';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { SUPABASE_FUNCTIONS_URL } from '@/constants/supabase';
import { formatDateWithSeconds } from '@/utils/dateFormatUtils';
import { calculateRiskScore, type RiskScoreResult } from '@/utils/calculateRiskScore';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { getNetworkType } from '@/utils/networkOptimizer';
import { useUserLocation } from '@/contexts/UserLocationContext';
import { getNativeDeviceInfo, isWorklyAndroidApp, type NativeDeviceInfo } from '@/lib/nativeAppBridge';

interface DeviceInfoSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NetworkInfo {
  public_ip: string;
  country: string;
  state: string;
  city: string;
  isp: string;
  asn: string;
  vpn_detected: boolean;
  is_tor?: boolean;
  is_datacenter?: boolean;
  proxy_type?: string;
  fingerprint_hash?: string;
}

interface IpHistoryEntry {
  ip: string;
  first_seen: string;
}

const InfoRow = ({ label, value }: { label: string; value: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0 gap-2">
      <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">{label}</span>
      <div className="flex items-center gap-1 min-w-0">
        <span className="text-xs font-mono text-foreground text-right truncate">{value}</span>
        <button onClick={handleCopy} className="p-1 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
          {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>
    </div>
  );
};

/* ─── Compact Risk Score Card ─── */
const RiskScoreGauge = ({ result }: { result: RiskScoreResult }) => {
  const radius = 38;
  const stroke = 6;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (result.score / 100) * circumference;
  const color = result.level === 'low' ? '#22c55e' : result.level === 'medium' ? '#f59e0b' : '#ef4444';
  const bgColor = result.level === 'low' ? 'bg-green-500/10' : result.level === 'medium' ? 'bg-amber-500/10' : 'bg-red-500/10';
  const textColor = result.level === 'low' ? 'text-green-600' : result.level === 'medium' ? 'text-amber-600' : 'text-red-600';
  const label = result.level === 'low' ? 'Low Risk' : result.level === 'medium' ? 'Medium Risk' : 'High Risk';
  const emoji = result.level === 'low' ? '✅' : result.level === 'medium' ? '⚠️' : '🚨';

  return (
    <div className="bg-muted/30 rounded-xl p-3">
      <div className="flex items-center gap-3">
        <div className="relative w-[88px] h-[88px] flex-shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 88 88">
            <circle cx="44" cy="44" r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-muted/40" />
            <circle cx="44" cy="44" r={radius} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-xl font-bold ${textColor}`}>{result.score}</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-sm">{emoji}</span>
            <Badge className={`${bgColor} ${textColor} border-0 text-xs font-semibold`}>{label}</Badge>
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            {result.level === 'low' && 'No suspicious activity detected. Your account looks safe.'}
            {result.level === 'medium' && 'Some unusual patterns detected. Please review the factors below.'}
            {result.level === 'high' && 'Multiple risk indicators found! Immediate review recommended.'}
          </p>
          {result.factors.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {result.factors.slice(0, 3).map((f, i) => (
                <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{f}</span>
              ))}
              {result.factors.length > 3 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">+{result.factors.length - 3} more</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ─── Section Header ─── */
const SectionHeader = ({ icon: Icon, title }: { icon: React.ElementType; title: string }) => (
  <div className="flex items-center gap-2 mb-2">
    <Icon className="h-3.5 w-3.5 text-primary" />
    <h4 className="text-xs font-semibold">{title}</h4>
  </div>
);

export const DeviceInfoSheet: React.FC<DeviceInfoSheetProps> = ({ isOpen, onClose }) => {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [nativeDeviceInfo, setNativeDeviceInfo] = useState<NativeDeviceInfo | null>(null);
  const [fingerprint, setFingerprint] = useState<string>('');
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [networkLoading, setNetworkLoading] = useState(false);
  const [loginCount, setLoginCount] = useState<number | null>(null);
  const [lastLoginAt, setLastLoginAt] = useState<string | null>(null);
  const [accountCreatedAt, setAccountCreatedAt] = useState<string | null>(null);
  const [firstIp, setFirstIp] = useState<string | null>(null);
  const [lastIp, setLastIp] = useState<string | null>(null);
  const [totalUniqueIps, setTotalUniqueIps] = useState<number | null>(null);
  const [ipHistory, setIpHistory] = useState<IpHistoryEntry[]>([]);
  const [showAllIps, setShowAllIps] = useState(false);
  const [batteryInfo, setBatteryInfo] = useState<{ level: number; charging: boolean } | null>(null);
  const [webrtcLeak, setWebrtcLeak] = useState<WebRTCLeakResult | null>(null);
  const [webrtcLoading, setWebrtcLoading] = useState(false);

  // New advanced states
  const [audioFP, setAudioFP] = useState<string>('');
  const [isIncognito, setIsIncognito] = useState<boolean>(false);
  const [hasAdBlocker, setHasAdBlocker] = useState<boolean>(false);
  const [permissions, setPermissions] = useState<PermissionStatus[]>([]);
  const [additionalSignals, setAdditionalSignals] = useState<AdditionalDeviceSignals | null>(null);
  const [detectedFonts, setDetectedFonts] = useState<string[]>([]);
  const [pluginsList, setPluginsList] = useState<string[]>([]);

  const networkStatus = useNetworkStatus();
  const networkType = useMemo(() => getNetworkType(), []);
  
  const { location: userLocation } = useUserLocation();

  useEffect(() => {
    if (isOpen) {
      const info = getDeviceInfo();
      setDeviceInfo(info);

      // The WebView JavaScript bridge can become available just after the
      // React sheet opens. Refresh on the native ready event and briefly retry
      // instead of permanently rendering an empty native-device section.
      const refreshNativeDeviceInfo = () => {
        const nativeInfo = getNativeDeviceInfo();
        if (nativeInfo) {
          setNativeDeviceInfo(nativeInfo);
          return true;
        }
        return false;
      };
      setNativeDeviceInfo(refreshNativeDeviceInfo() ? getNativeDeviceInfo() : null);
      const handleNativeBridgeReady = () => refreshNativeDeviceInfo();
      window.addEventListener('workly-native-bridge-ready', handleNativeBridgeReady);
      let nativeInfoAttempts = 0;
      const nativeInfoRetry = window.setInterval(() => {
        nativeInfoAttempts += 1;
        if (refreshNativeDeviceInfo() || nativeInfoAttempts >= 20) {
          window.clearInterval(nativeInfoRetry);
        }
      }, 250);

      setAdditionalSignals(getAdditionalSignals());
      fetchNetworkAndSaveDeviceInfo(info);
      fetchLoginFrequency();
      getBatteryInfo().then(b => setBatteryInfo(b));
      setWebrtcLoading(true);
      // Advanced detections
      getAudioFingerprint().then(fp => setAudioFP(fp));
      detectIncognitoMode().then(v => setIsIncognito(v));
      detectAdBlocker().then(v => setHasAdBlocker(v));
      getPermissionStatuses().then(p => setPermissions(p));
      // Fetch real Android version (Chrome freezes UA to Android 10)
      fetchRealAndroidVersion().then(version => {
        if (version) {
          setDeviceInfo(prev => prev ? { ...prev, operating_system: `Android ${version}` } : prev);
        }
      });

      // Detect fonts
      const testFonts = [
        // Common fonts
        'Arial', 'Verdana', 'Helvetica', 'Times New Roman', 'Georgia', 'Courier New',
        'Trebuchet MS', 'Impact', 'Comic Sans MS', 'Palatino', 'Garamond', 'Bookman',
        'Tahoma', 'Lucida Console', 'Lucida Sans', 'Century Gothic', 'Segoe UI',
        'Roboto', 'Noto Sans', 'Open Sans', 'Lato', 'Montserrat', 'Poppins',
        'Ubuntu', 'Fira Sans', 'Source Sans Pro', 'PT Sans', 'Droid Sans',
        'Calibri', 'Cambria', 'Consolas', 'Candara', 'Franklin Gothic',
        // Rare / Uncommon fonts
        'Papyrus', 'Brush Script MT', 'Copperplate', 'Didot', 'Futura',
        'Optima', 'Perpetua', 'Rockwell', 'Baskerville', 'Big Caslon',
        'Bodoni MT', 'Calisto MT', 'Chaparral Pro', 'Charlemagne Std',
        'Cooper Black', 'Cormorant Garamond', 'DIN Alternate', 'Eczar',
        'Engravers MT', 'Eurostile', 'Folio', 'Gill Sans', 'Goudy Old Style',
        'Haettenschweiler', 'Harrington', 'Herculanum', 'Hoefler Text',
        'Imprint MT Shadow', 'Joanna MT', 'Kabel', 'Krungthep', 'Kunstler Script',
        'Lucida Bright', 'Lucida Handwriting', 'Luminari', 'Magneto',
        'Maiandra GD', 'Marker Felt', 'Matura MT Script Capitals',
        'Mistral', 'Modern No. 20', 'Monotype Corsiva', 'Niagara Engraved',
        'Old English Text MT', 'Onyx', 'Palace Script MT', 'Phosphate',
        'Playbill', 'Princetown LET', 'Rage Italic', 'Ravie',
        'Savoye LET', 'Silom', 'Skia', 'Snell Roundhand', 'Stencil',
        'Sylfaen', 'Tw Cen MT', 'Viner Hand ITC', 'Vivaldi',
        'Vladimir Script', 'Wide Latin', 'Windsor', 'Zapfino',
        // Indian / Indic script fonts
        'Mangal', 'Nirmala UI', 'Aparajita', 'Kokila', 'Utsaah',
        'Lohit Devanagari', 'Noto Sans Devanagari', 'Tiro Devanagari Hindi',
        'Poppins Devanagari', 'Hind', 'Mukta', 'Baloo 2',
        // Monospace / Dev fonts
        'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono',
        'IBM Plex Mono', 'Hack', 'Inconsolata', 'Source Code Pro',
        'Menlo', 'Monaco', 'Andale Mono', 'DejaVu Sans Mono',
      ];
      try {
        const detected: string[] = [];
        for (const font of testFonts) {
          if ((document as any).fonts?.check?.(`12px "${font}"`)) {
            detected.push(font);
          }
        }
        setDetectedFonts(detected);
      } catch { setDetectedFonts([]); }

      // Get plugins
      try {
        const nav = navigator as any;
        const plugins: string[] = [];
        if (nav.plugins) {
          for (let i = 0; i < nav.plugins.length; i++) {
            plugins.push(nav.plugins[i].name);
          }
        }
        setPluginsList(plugins);
      } catch { setPluginsList([]); }
      return () => {
        window.removeEventListener('workly-native-bridge-ready', handleNativeBridgeReady);
        window.clearInterval(nativeInfoRetry);
      };
    }
  }, [isOpen]);

  const fetchLoginFrequency = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase.from('profiles').select('login_count, last_login_at, created_at').eq('user_id', session.user.id).maybeSingle();
      const { data: ipData } = await supabase.from('profiles').select('*').eq('user_id', session.user.id).maybeSingle();
      if (data) {
        setLoginCount(data.login_count ?? 0);
        setLastLoginAt(data.last_login_at);
        setAccountCreatedAt(data.created_at);
      }
      if (ipData) {
        setFirstIp((ipData as any).first_ip ?? null);
        setLastIp((ipData as any).last_ip ?? null);
        setTotalUniqueIps((ipData as any).total_unique_ips ?? 0);
        setIpHistory(((ipData as any).user_ip_history as IpHistoryEntry[]) ?? []);
      }
    } catch (e) {
      console.error('Failed to fetch login frequency:', e);
    }
  };

  const fetchNetworkAndSaveDeviceInfo = async (info: DeviceInfo) => {
    setNetworkLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const components = getFingerprintComponents();

      // Gather advanced data in parallel
      const [audioFingerprint, incognitoDetected, adBlockerDetected, batteryData] = await Promise.all([
        getAudioFingerprint(),
        detectIncognitoMode(),
        detectAdBlocker(),
        getBatteryInfo(),
      ]);

      setAudioFP(audioFingerprint);
      setIsIncognito(incognitoDetected);
      setHasAdBlocker(adBlockerDetected);
      if (batteryData) setBatteryInfo(batteryData);

      const signals = getAdditionalSignals();


      const res = await fetch(
        `${SUPABASE_FUNCTIONS_URL}/get-ip-info`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4',
          },
          body: JSON.stringify({
            device_info: info,
            fingerprint_components: components,
            network_type: getNetworkType(),
            downlink_speed: `${networkStatus.downlink} Mbps`,
            latency_ms: `${networkStatus.rtt} ms`,
            audio_fingerprint: audioFingerprint,
            incognito_detected: incognitoDetected,
            ad_blocker_detected: adBlockerDetected,
            color_depth: signals.color_depth,
            pixel_ratio: signals.pixel_ratio,
            max_touch_points: signals.max_touch_points,
            do_not_track: signals.do_not_track,
            platform: signals.platform,
            cookies_enabled: signals.cookies_enabled,
            webrtc_leak_detected: false, // Will be updated after re-check with actual VPN status
            webrtc_public_ips: null,
            webrtc_local_ips: null,
            // Battery info
            battery_level: batteryData?.level ?? null,
            battery_charging: batteryData?.charging ?? null,
            // GPS coordinates from UserLocationContext
            gps_latitude: userLocation.latitude ?? null,
            gps_longitude: userLocation.longitude ?? null,
            gps_accuracy: userLocation.accuracy ?? null,
            // WebGL details
            webgl_vendor: info.webgl_vendor ?? null,
            webgl_version: info.webgl_version ?? null,
            // Behavioral data defaults
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
          }),
        }
      );
      const data = await res.json();
      if (!data.error) {
        setNetworkInfo(data);
        if (data.fingerprint_hash) setFingerprint(data.fingerprint_hash);
        // Re-run WebRTC with actual IP and VPN status
        const vpnActive = data.vpn_detected === true;
        detectWebRTCLeak(data.public_ip, 5000, vpnActive).then(r => {
          setWebrtcLeak(r);
          setWebrtcLoading(false);
        });
      }
    } catch (e) {
      console.error('Failed to fetch network info:', e);
    } finally {
      setNetworkLoading(false);
    }
  };

  const riskScore = useMemo<RiskScoreResult>(() => {
    return calculateRiskScore({
      vpnDetected: networkInfo?.vpn_detected,
      totalUniqueIps: totalUniqueIps ?? undefined,
      firstIp,
      lastIp,
      loginCount,
      accountCreatedAt,
      timezone: deviceInfo?.timezone,
      country: networkInfo?.country,
      browserName: deviceInfo?.browser_name,
      deviceMemory: deviceInfo?.device_memory,
      fingerprintHash: fingerprint || networkInfo?.fingerprint_hash,
      isTor: networkInfo?.is_tor,
      isDatacenter: networkInfo?.is_datacenter,
      webrtcLeakDetected: (networkInfo?.vpn_detected === true && (webrtcLeak?.publicIPs?.length ?? 0) > 0) || webrtcLeak?.leakDetected,
      incognitoDetected: isIncognito,
      adBlockerDetected: hasAdBlocker,
    });
  }, [networkInfo, totalUniqueIps, firstIp, lastIp, loginCount, accountCreatedAt, deviceInfo, fingerprint, webrtcLeak, isIncognito, hasAdBlocker]);

  const getLoginFrequencyLabel = () => {
    if (loginCount === null || !accountCreatedAt) return 'N/A';
    const days = Math.max(1, Math.floor((Date.now() - new Date(accountCreatedAt).getTime()) / (1000 * 60 * 60 * 24)));
    if (days < 7) return `${loginCount} logins in ${days} day${days > 1 ? 's' : ''}`;
    const perWeek = (loginCount / (days / 7)).toFixed(1);
    return `~${perWeek} logins/week`;
  };

  const getPermissionBadge = (state: string) => {
    if (state === 'granted') return <Badge className="text-[10px] h-5 bg-green-500/10 text-green-600 border-0">✅ Granted</Badge>;
    if (state === 'denied') return <Badge className="text-[10px] h-5 bg-red-500/10 text-red-600 border-0">❌ Denied</Badge>;
    if (state === 'prompt') return <Badge className="text-[10px] h-5 bg-amber-500/10 text-amber-600 border-0">⏳ Prompt</Badge>;
    return <Badge className="text-[10px] h-5 bg-muted text-muted-foreground border-0">N/A</Badge>;
  };

  return (
    <NativeBottomSheet isOpen={isOpen} onClose={onClose} title="Device Information" height="auto">
      <div className="space-y-4">
        {/* Risk Score */}
        <div>
          <SectionHeader icon={AlertTriangle} title="Risk Score" />
          <RiskScoreGauge result={riskScore} />
        </div>


        {deviceInfo && (
          <div>
            <SectionHeader icon={Smartphone} title="Device Info" />
            <div className="bg-muted/30 rounded-xl p-3">
              <InfoRow label="Device ID" value={deviceInfo.device_id} />
              <InfoRow label="Browser" value={`${deviceInfo.browser_name} ${deviceInfo.browser_version}`} />
              <InfoRow label="OS" value={deviceInfo.operating_system} />
              <InfoRow label="Type" value={deviceInfo.device_type} />
              <InfoRow label="Screen" value={deviceInfo.screen_resolution} />
              <InfoRow label="Viewport" value={deviceInfo.viewport_size} />
              <InfoRow label="Memory" value={deviceInfo.device_memory} />
              <InfoRow label="CPU Cores" value={deviceInfo.hardware_concurrency} />
              <InfoRow label="Timezone" value={deviceInfo.timezone} />
              <InfoRow label="Language" value={deviceInfo.language} />
              {batteryInfo && (
                <div className="flex items-center justify-between py-2 border-b border-border/50">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    {batteryInfo.charging ? <BatteryCharging className="h-3 w-3" /> : <Battery className="h-3 w-3" />}
                    Battery
                  </span>
                  <span className={`text-xs font-mono ${batteryInfo.level > 50 ? 'text-green-600' : batteryInfo.level > 20 ? 'text-amber-600' : 'text-red-600'}`}>
                    {batteryInfo.level}% {batteryInfo.charging ? '⚡ Charging' : ''}
                  </span>
                </div>
              )}
              {/* Incognito & Ad Blocker */}
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <EyeOff className="h-3 w-3" /> Incognito
                </span>
                {isIncognito ? (
                  <Badge variant="destructive" className="text-[10px] h-5 gap-1">🕵️ Detected</Badge>
                ) : (
                  <Badge className="text-[10px] h-5 bg-green-500/10 text-green-600 border-0">✅ Normal</Badge>
                )}
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <ShieldBan className="h-3 w-3" /> Ad Blocker
                </span>
                {hasAdBlocker ? (
                  <Badge className="text-[10px] h-5 bg-amber-500/10 text-amber-600 border-0">⚠️ Active</Badge>
                ) : (
                  <Badge className="text-[10px] h-5 bg-green-500/10 text-green-600 border-0">✅ None</Badge>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Native Android hardware details are provided by Android APIs, not limited WebView APIs. */}
        {isWorklyAndroidApp() && !nativeDeviceInfo && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Native device details are still loading
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Reopen this panel after the app finishes loading. If details remain unavailable, update the Workly India app.
            </p>
          </div>
        )}
        {nativeDeviceInfo && (
          <div>
            <SectionHeader icon={Smartphone} title="Native Android Device Details" />
            <div className="bg-muted/30 rounded-xl p-3">
              <InfoRow label="Manufacturer" value={nativeDeviceInfo.manufacturer} />
              <InfoRow label="Brand" value={nativeDeviceInfo.brand} />
              <InfoRow label="Model" value={nativeDeviceInfo.model} />
              <InfoRow label="Device" value={nativeDeviceInfo.device} />
              <InfoRow label="Product" value={nativeDeviceInfo.product} />
              <InfoRow label="Hardware" value={nativeDeviceInfo.hardware} />
              <InfoRow label="Android Version" value={nativeDeviceInfo.androidVersion} />
              <InfoRow label="Android API" value={String(nativeDeviceInfo.apiLevel)} />
              <InfoRow label="Security Patch" value={nativeDeviceInfo.securityPatch} />
              <InfoRow label="Supported CPU ABIs" value={nativeDeviceInfo.supportedAbis} />
              <InfoRow label="Total RAM" value={nativeDeviceInfo.totalRamGb} />
              <InfoRow label="Native Screen" value={nativeDeviceInfo.screenPixels} />
              <InfoRow label="Screen Density" value={`${nativeDeviceInfo.screenDensityDpi} DPI`} />
              {nativeDeviceInfo.batteryPercent !== null && (
                <InfoRow label="Native Battery" value={`${nativeDeviceInfo.batteryPercent}%`} />
              )}
              <InfoRow label="App Version" value={nativeDeviceInfo.appVersion} />
              <InfoRow label="App Build" value={String(nativeDeviceInfo.appVersionCode)} />
              <InfoRow label="Device Locale" value={nativeDeviceInfo.locale} />
            </div>
          </div>
        )}

        {/* Security Signals */}
        {additionalSignals && (
          <div>
            <SectionHeader icon={Lock} title="Security Signals" />
            <div className="bg-muted/30 rounded-xl p-3">
              <InfoRow label="Color Depth" value={`${additionalSignals.color_depth}-bit`} />
              <InfoRow label="Pixel Ratio" value={`${additionalSignals.pixel_ratio}x`} />
              <InfoRow label="Touch Points" value={`${additionalSignals.max_touch_points}`} />
              <InfoRow label="Do Not Track" value={additionalSignals.do_not_track} />
              <InfoRow label="Platform" value={additionalSignals.platform} />
              <InfoRow label="PDF Viewer" value={additionalSignals.pdf_viewer_enabled} />
              <InfoRow label="Cookies" value={additionalSignals.cookies_enabled ? 'Enabled' : 'Disabled'} />
            </div>
          </div>
        )}

        {/* WebGL & Canvas */}
        {deviceInfo && (
          <div>
            <SectionHeader icon={Monitor} title="Graphics & Canvas" />
            <div className="bg-muted/30 rounded-xl p-3">
              <InfoRow label="Canvas FP" value={deviceInfo.canvas_fingerprint} />
              <InfoRow label="GPU" value={deviceInfo.webgl_renderer} />
              <InfoRow label="Vendor" value={deviceInfo.webgl_vendor} />
              <InfoRow label="WebGL" value={deviceInfo.webgl_version} />
              <InfoRow label="GLSL" value={deviceInfo.webgl_shading_language} />
              <InfoRow label="Max Texture" value={deviceInfo.webgl_max_texture_size} />
              <InfoRow label="Extensions" value={deviceInfo.webgl_extensions_count} />
            </div>
          </div>
        )}

        {/* Network */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Globe className="h-3.5 w-3.5 text-primary" />
              <h4 className="text-xs font-semibold">Network Info</h4>
            </div>
            {(() => {
              const dl = networkStatus.downlink;
              const rtt = networkStatus.rtt;
              let quality = 'Unknown';
              let qColor = 'bg-muted text-muted-foreground';
              if (dl > 5 && rtt < 100) { quality = 'Excellent'; qColor = 'bg-green-500/10 text-green-600'; }
              else if (dl > 2 && rtt < 200) { quality = 'Good'; qColor = 'bg-emerald-500/10 text-emerald-600'; }
              else if (dl > 0.5 && rtt < 400) { quality = 'Fair'; qColor = 'bg-amber-500/10 text-amber-600'; }
              else if (dl > 0) { quality = 'Poor'; qColor = 'bg-red-500/10 text-red-600'; }
              return <Badge className={`text-[9px] h-4 border-0 ${qColor}`}>{quality}</Badge>;
            })()}
          </div>
          <div className="bg-muted/30 rounded-xl p-3">
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Wifi className="h-3 w-3" /> Network Type
              </span>
              <Badge className="text-[10px] h-5 bg-primary/10 text-primary border-0 font-bold">{networkType}</Badge>
            </div>
            <InfoRow label="Download Speed" value={`${networkStatus.downlink} Mbps`} />
            <InfoRow label="Latency (RTT)" value={`${networkStatus.rtt} ms`} />
            
            {networkLoading ? (
              <div className="flex items-center justify-center py-3 gap-2">
                <Globe className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Fetching network info...</span>
              </div>
            ) : networkInfo ? (
              <>
                <InfoRow label="Public IP" value={networkInfo.public_ip} />
                <InfoRow label="Country" value={networkInfo.country} />
                <InfoRow label="State" value={networkInfo.state} />
                <InfoRow label="City" value={networkInfo.city} />
                <InfoRow label="ISP" value={networkInfo.isp} />
                <InfoRow label="ASN" value={networkInfo.asn} />
                <div className="flex items-center justify-between py-2 border-b border-border/50">
                  <span className="text-xs text-muted-foreground">VPN</span>
                  {networkInfo.vpn_detected ? (
                    <Badge variant="destructive" className="text-[10px] h-5 gap-1">
                      <ShieldAlert className="h-3 w-3" /> VPN Detected
                    </Badge>
                  ) : (
                    <Badge className="text-[10px] h-5 gap-1 bg-green-500/10 text-green-600 border-green-500/20">
                      <Shield className="h-3 w-3" /> No VPN
                    </Badge>
                  )}
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border/50">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Skull className="h-3 w-3" /> TOR
                  </span>
                  {networkInfo.is_tor ? (
                    <Badge variant="destructive" className="text-[10px] h-5 gap-1">🧅 TOR Detected</Badge>
                  ) : (
                    <Badge className="text-[10px] h-5 gap-1 bg-green-500/10 text-green-600 border-green-500/20">✅ No TOR</Badge>
                  )}
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border/50">
                  <span className="text-xs text-muted-foreground">Proxy Type</span>
                  <span className={`text-xs font-mono ${networkInfo.proxy_type !== 'None' ? 'text-amber-600 font-semibold' : 'text-foreground'}`}>
                    {networkInfo.proxy_type || 'None'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-muted-foreground">Datacenter IP</span>
                  {networkInfo.is_datacenter ? (
                    <Badge className="text-[10px] h-5 gap-1 bg-amber-500/10 text-amber-600 border-amber-500/20">⚠️ Datacenter</Badge>
                  ) : (
                    <Badge className="text-[10px] h-5 gap-1 bg-green-500/10 text-green-600 border-green-500/20">✅ Residential</Badge>
                  )}
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-3">Failed to load</p>
            )}
          </div>
        </div>

        {/* WebRTC IP Leak Detection */}
        <div>
          <SectionHeader icon={Radio} title="WebRTC IP Leak Detection" />
          <div className="bg-muted/30 rounded-xl p-3">
            {webrtcLoading ? (
              <div className="flex items-center justify-center py-3 gap-2">
                <Radio className="h-3.5 w-3.5 animate-pulse text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Scanning WebRTC...</span>
              </div>
            ) : webrtcLeak ? (
              <>
                <div className="flex items-center justify-between py-2 border-b border-border/50">
                  <span className="text-xs text-muted-foreground">Leak Status</span>
                {(() => {
                    // Compute leak at component level: VPN active + any public IP via WebRTC = leak
                    const isVpnActive = networkInfo?.vpn_detected === true;
                    const hasPublicIPs = webrtcLeak.publicIPs.length > 0;
                    const effectiveLeak = isVpnActive && hasPublicIPs;
                    return effectiveLeak ? (
                      <Badge variant="destructive" className="text-[10px] h-5 gap-1">🚨 IP Leak Detected</Badge>
                    ) : (
                      <Badge className="text-[10px] h-5 gap-1 bg-green-500/10 text-green-600 border-green-500/20">✅ No Leak</Badge>
                    );
                  })()}
                </div>
                {webrtcLeak.localIPs.length > 0 && <InfoRow label="Local IPs" value={webrtcLeak.localIPs.join(', ')} />}
                {webrtcLeak.publicIPs.length > 0 && <InfoRow label="WebRTC Public IPs" value={webrtcLeak.publicIPs.join(', ')} />}
                {networkInfo && webrtcLeak.publicIPs.length > 0 && <InfoRow label="Server IP" value={networkInfo.public_ip} />}
                {networkInfo?.vpn_detected && webrtcLeak.publicIPs.length > 0 && (
                  <div className="mt-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                    <p className="text-[10px] text-red-600">⚠️ WebRTC is exposing your IP even with VPN active. Your browser is not blocking WebRTC IP discovery.</p>
                  </div>
                )}
                {webrtcLeak.localIPs.length === 0 && webrtcLeak.publicIPs.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">WebRTC blocked or unavailable</p>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-3">WebRTC not available</p>
            )}
          </div>
        </div>

        {/* Permissions */}
        {permissions.length > 0 && (
          <div>
            <SectionHeader icon={Key} title="Browser Permissions" />
            <div className="bg-muted/30 rounded-xl p-3">
              {permissions.map((p, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <span className="text-xs text-muted-foreground capitalize">{p.name.replace('-', ' ')}</span>
                  {getPermissionBadge(p.state)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* IP History */}
        <div>
          <SectionHeader icon={MapPin} title="IP History" />
          <div className="bg-muted/30 rounded-xl p-3">
            <InfoRow label="First IP" value={firstIp || 'N/A'} />
            <InfoRow label="Last IP" value={lastIp || 'N/A'} />
            <InfoRow label="Unique IPs" value={`${totalUniqueIps ?? 0}`} />
            {ipHistory.length > 0 && (() => {
              const sortedIps = [...ipHistory].reverse();
              const visibleIps = sortedIps.slice(0, 5);
              return (
                <div className="mt-2 pt-2 border-t border-border/50">
                  <span className="text-[10px] text-muted-foreground font-medium">All IPs</span>
                  {visibleIps.map((entry, idx) => (
                    <InfoRow key={idx} label={formatDateWithSeconds(entry.first_seen)} value={entry.ip} />
                  ))}
                  {ipHistory.length > 5 && (
                    <button
                      onClick={() => setShowAllIps(true)}
                      className="w-full mt-2 py-2 flex items-center justify-center gap-1.5 text-xs text-primary font-medium rounded-lg bg-primary/5 hover:bg-primary/10 active:scale-[0.98] transition-all"
                    >
                      View More ({ipHistory.length} IPs)
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Login Frequency */}
        <div>
          <SectionHeader icon={Activity} title="Login Frequency" />
          <div className="bg-muted/30 rounded-xl p-3">
            <InfoRow label="Total Logins" value={loginCount !== null ? `${loginCount}` : 'N/A'} />
            <InfoRow label="Frequency" value={getLoginFrequencyLabel()} />
            <InfoRow label="Last Login" value={lastLoginAt ? formatDateWithSeconds(lastLoginAt) : 'N/A'} />
            <InfoRow label="Created" value={accountCreatedAt ? formatDateWithSeconds(accountCreatedAt) : 'N/A'} />
          </div>
        </div>

        {/* Fonts & Plugins */}
        <div>
          <SectionHeader icon={Type} title="Fonts & Plugins" />
          <div className="bg-muted/30 rounded-xl p-3">
            <InfoRow label="Detected Fonts" value={`${detectedFonts.length} fonts`} />
            {detectedFonts.length > 0 && (
              <div className="py-2 border-b border-border/50">
                <div className="flex flex-wrap gap-1 mt-1">
                  {detectedFonts.map((font, i) => (
                    <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{font}</span>
                  ))}
                </div>
              </div>
            )}
            <InfoRow label="Plugins" value={pluginsList.length > 0 ? `${pluginsList.length} plugins` : 'None / Hidden'} />
            {pluginsList.length > 0 && (
              <div className="py-2">
                <div className="flex flex-wrap gap-1 mt-1">
                  {pluginsList.map((plugin, i) => (
                    <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{plugin}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Fingerprint */}
        <div>
          <SectionHeader icon={Fingerprint} title="Fingerprint (SHA-256)" />
          <div className="bg-muted/30 rounded-xl p-3">
            {fingerprint && <InfoRow label="Hash" value={fingerprint} />}
            {deviceInfo && <InfoRow label="Canvas" value={deviceInfo.canvas_fingerprint} />}
            {audioFP && audioFP !== 'N/A' && <InfoRow label="Audio FP" value={audioFP} />}
          </div>
        </div>
      </div>

      {/* All IPs Bottom Sheet */}
      <NativeBottomSheet
        isOpen={showAllIps}
        onClose={() => setShowAllIps(false)}
        title={`All IPs (${ipHistory.length})`}
        height="full"
      >
        <div className="space-y-0">
          {[...ipHistory].reverse().map((entry, idx) => (
            <InfoRow key={idx} label={formatDateWithSeconds(entry.first_seen)} value={entry.ip} />
          ))}
        </div>
      </NativeBottomSheet>
    </NativeBottomSheet>
  );
};
