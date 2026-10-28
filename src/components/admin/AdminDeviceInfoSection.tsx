import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Monitor, Wifi, Fingerprint, Clock, 
  Smartphone, Tablet, Globe, 
  MapPin, Shield, ShieldAlert, ChevronDown,
  MousePointer, Activity, Timer, Zap, Eye, RotateCw, Bot,
  Radio, EyeOff, ShieldBan, Volume2
} from "lucide-react";

interface DeviceInfoLog {
  id: string;
  user_id: string;
  device_id: string | null;
  browser_name: string | null;
  browser_version: string | null;
  operating_system: string | null;
  device_type: string | null;
  screen_resolution: string | null;
  viewport_size: string | null;
  device_memory: string | null;
  hardware_concurrency: string | null;
  timezone: string | null;
  language: string | null;
  canvas_fingerprint: string | null;
  webgl_renderer: string | null;
  fingerprint_hash: string | null;
  public_ip: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  isp: string | null;
  vpn_detected: boolean | null;
  network_type: string | null;
  downlink_speed: string | null;
  latency_ms: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface BehavioralRecord {
  session_duration: number | null;
  mouse_distance: number | null;
  mouse_speed: number | null;
  avg_typing_speed: number | null;
  scroll_depth: number | null;
  scroll_speed: number | null;
  avg_click_interval: number | null;
  total_clicks: number | null;
  rage_clicks: number | null;
  total_keystrokes: number | null;
  is_bot: boolean | null;
  bot_reasons: string[] | null;
  updated_at: string;
}

interface AdminDeviceInfoSectionProps {
  userId: string;
}

const InfoRow = ({ label, value }: { label: string; value: string | null | undefined }) => (
  <div className="flex justify-between items-start py-1.5 border-b border-border/50 last:border-0">
    <span className="text-sm text-muted-foreground shrink-0 mr-2">{label}</span>
    <span className="text-sm font-medium text-right break-all">{value || 'N/A'}</span>
  </div>
);

const DeviceTypeIcon = ({ type }: { type: string | null | undefined }) => {
  if (type === 'mobile') return <Smartphone className="w-4 h-4" />;
  if (type === 'tablet') return <Tablet className="w-4 h-4" />;
  return <Monitor className="w-4 h-4" />;
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Invalid';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) + 
    ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const formatDuration = (s: number | null) => {
  if (!s) return 'N/A';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
};

const DeviceCard = ({ device, defaultOpen }: { device: DeviceInfoLog; defaultOpen: boolean }) => (
  <Collapsible defaultOpen={defaultOpen}>
    <CollapsibleTrigger className="w-full flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-2">
        <DeviceTypeIcon type={device.device_type} />
        <div className="text-left">
          <span className="text-sm font-medium">{device.browser_name || 'Unknown'} • {device.operating_system || 'Unknown'}</span>
          <p className="text-xs text-muted-foreground">{formatDate(device.updated_at)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {device.vpn_detected && (
          <Badge variant="destructive" className="text-[10px] h-5 gap-0.5">
            <ShieldAlert className="w-3 h-3" /> VPN
          </Badge>
        )}
        {(device as any).webrtc_leak_detected && (
          <Badge variant="destructive" className="text-[10px] h-5 gap-0.5">
            <Radio className="w-3 h-3" /> Leak
          </Badge>
        )}
        {(device as any).incognito_detected && (
          <Badge className="text-[10px] h-5 gap-0.5 bg-amber-500/10 text-amber-600 border-0">
            <EyeOff className="w-3 h-3" /> Incognito
          </Badge>
        )}
        {device.network_type && (
          <Badge className="text-[10px] h-5 bg-primary/10 text-primary border-0">{device.network_type}</Badge>
        )}
        <ChevronDown className="w-4 h-4 text-muted-foreground" />
      </div>
    </CollapsibleTrigger>
    <CollapsibleContent>
      <div className="mt-2 space-y-3 pl-2">
        {/* Device & Browser */}
        <div className="bg-muted/20 rounded-lg p-3 space-y-0.5">
          <h5 className="text-xs font-semibold flex items-center gap-1.5 mb-1.5">
            <DeviceTypeIcon type={device.device_type} /> Device & Browser
          </h5>
          <InfoRow label="Browser" value={`${device.browser_name || 'Unknown'} ${device.browser_version || ''}`} />
          <InfoRow label="OS" value={device.operating_system} />
          <InfoRow label="Type" value={device.device_type} />
          <InfoRow label="Screen" value={device.screen_resolution} />
          <InfoRow label="Viewport" value={device.viewport_size} />
          <InfoRow label="Memory" value={device.device_memory} />
          <InfoRow label="CPU" value={device.hardware_concurrency} />
          <InfoRow label="Timezone" value={device.timezone} />
          <InfoRow label="Language" value={device.language} />
          <InfoRow label="GPU" value={device.webgl_renderer} />
          <InfoRow label="Platform" value={(device as any).platform} />
          <InfoRow label="Color Depth" value={(device as any).color_depth ? `${(device as any).color_depth}-bit` : null} />
          <InfoRow label="Pixel Ratio" value={(device as any).pixel_ratio ? `${(device as any).pixel_ratio}x` : null} />
          <InfoRow label="Touch Points" value={(device as any).max_touch_points?.toString()} />
          <InfoRow label="DNT" value={(device as any).do_not_track} />
        </div>

        {/* Security Flags */}
        <div className="bg-muted/20 rounded-lg p-3 space-y-0.5">
          <h5 className="text-xs font-semibold flex items-center gap-1.5 mb-1.5">
            <Shield className="w-3.5 h-3.5" /> Security Flags
          </h5>
          <div className="flex justify-between items-center py-1.5 border-b border-border/30">
            <span className="text-sm text-muted-foreground flex items-center gap-1"><EyeOff className="w-3 h-3" /> Incognito</span>
            {(device as any).incognito_detected ? (
              <Badge variant="destructive" className="text-xs">🕵️ Detected</Badge>
            ) : (
              <Badge variant="outline" className="text-xs">Normal</Badge>
            )}
          </div>
          <div className="flex justify-between items-center py-1.5 border-b border-border/30">
            <span className="text-sm text-muted-foreground flex items-center gap-1"><ShieldBan className="w-3 h-3" /> Ad Blocker</span>
            {(device as any).ad_blocker_detected ? (
              <Badge className="text-xs bg-amber-500/10 text-amber-600 border-0">⚠️ Active</Badge>
            ) : (
              <Badge variant="outline" className="text-xs">None</Badge>
            )}
          </div>
          <div className="flex justify-between items-center py-1.5 border-b border-border/30">
            <span className="text-sm text-muted-foreground flex items-center gap-1"><Radio className="w-3 h-3" /> WebRTC Leak</span>
            {(device as any).webrtc_leak_detected ? (
              <Badge variant="destructive" className="text-xs">🚨 Leak Detected</Badge>
            ) : (
              <Badge variant="outline" className="text-xs gap-1"><Shield className="w-3 h-3" /> No Leak</Badge>
            )}
          </div>
          {(device as any).webrtc_public_ips && (
            <InfoRow label="WebRTC IPs" value={(device as any).webrtc_public_ips} />
          )}
          <InfoRow label="Cookies" value={(device as any).cookies_enabled === false ? 'Disabled' : 'Enabled'} />
        </div>

        {/* Network */}
        <div className="bg-muted/20 rounded-lg p-3 space-y-0.5">
          <h5 className="text-xs font-semibold flex items-center gap-1.5 mb-1.5">
            <Wifi className="w-3.5 h-3.5" /> Network
          </h5>
          <InfoRow label="IP" value={device.public_ip} />
          <InfoRow label="Location" value={[device.city, device.state, device.country].filter(Boolean).join(', ') || 'N/A'} />
          <InfoRow label="ISP" value={device.isp} />
          <InfoRow label="Network" value={device.network_type} />
          <InfoRow label="Speed" value={device.downlink_speed} />
          <InfoRow label="Latency" value={device.latency_ms} />
          <div className="flex justify-between items-center py-1.5">
            <span className="text-sm text-muted-foreground">VPN</span>
            {device.vpn_detected ? (
              <Badge variant="destructive" className="text-xs gap-1">
                <ShieldAlert className="w-3 h-3" /> Detected
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs gap-1">
                <Shield className="w-3 h-3" /> No VPN
              </Badge>
            )}
          </div>
        </div>

        {/* Fingerprint */}
        <div className="bg-muted/20 rounded-lg p-3 space-y-0.5">
          <h5 className="text-xs font-semibold flex items-center gap-1.5 mb-1.5">
            <Fingerprint className="w-3.5 h-3.5" /> Fingerprint
          </h5>
          <InfoRow label="Device ID" value={device.device_id} />
          <InfoRow label="Hash" value={device.fingerprint_hash} />
          <InfoRow label="Canvas" value={device.canvas_fingerprint} />
          <InfoRow label="Audio FP" value={(device as any).audio_fingerprint} />
        </div>

        {/* Timestamps */}
        <div className="bg-muted/20 rounded-lg p-3 space-y-0.5">
          <h5 className="text-xs font-semibold flex items-center gap-1.5 mb-1.5">
            <Clock className="w-3.5 h-3.5" /> Timestamps
          </h5>
          <InfoRow label="First Seen" value={formatDate(device.created_at)} />
          <InfoRow label="Last Active" value={formatDate(device.updated_at)} />
        </div>
      </div>
    </CollapsibleContent>
  </Collapsible>
);

const BehavioralSection = ({ data }: { data: BehavioralRecord | null }) => {
  if (!data) return (
    <div className="p-3 bg-muted/20 rounded-lg text-center">
      <Activity className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
      <p className="text-xs text-muted-foreground">No behavioral data available</p>
    </div>
  );

  const items = [
    { icon: Timer, label: 'Session Duration', value: formatDuration(data.session_duration), warn: false },
    { icon: MousePointer, label: 'Mouse Distance', value: data.mouse_distance ? `${data.mouse_distance.toLocaleString()} px` : 'N/A', warn: false },
    { icon: MousePointer, label: 'Mouse Speed', value: data.mouse_speed ? `${data.mouse_speed} px/s` : 'N/A', warn: data.mouse_speed === 0 && (data.total_clicks ?? 0) > 5 },
    { icon: Zap, label: 'Typing Speed', value: data.avg_typing_speed ? `${data.avg_typing_speed} ms/key` : 'N/A', warn: (data.avg_typing_speed ?? 0) > 0 && (data.avg_typing_speed ?? 999) < 30 },
    { icon: Activity, label: 'Keystrokes', value: `${data.total_keystrokes ?? 0}`, warn: false },
    { icon: Activity, label: 'Scroll Depth', value: data.scroll_depth ? `${data.scroll_depth}%` : 'N/A', warn: false },
    { icon: MousePointer, label: 'Total Clicks', value: `${data.total_clicks ?? 0}`, warn: false },
    { icon: Timer, label: 'Avg Click Interval', value: data.avg_click_interval ? `${data.avg_click_interval} ms` : 'N/A', warn: (data.avg_click_interval ?? 999) < 100 },
    { icon: Zap, label: 'Rage Clicks', value: `${data.rage_clicks ?? 0}`, warn: (data.rage_clicks ?? 0) > 0 },
  ];

  return (
    <div className="space-y-2">
      <div className="bg-muted/20 rounded-lg p-3 space-y-0.5">
        {items.map((item, i) => (
          <div key={i} className="flex justify-between items-center py-1.5 border-b border-border/30 last:border-0">
            <div className="flex items-center gap-1.5">
              <item.icon className={`w-3.5 h-3.5 ${item.warn ? 'text-amber-500' : 'text-muted-foreground'}`} />
              <span className="text-sm text-muted-foreground">{item.label}</span>
            </div>
            <span className={`text-sm font-medium ${item.warn ? 'text-amber-600 font-semibold' : ''}`}>{item.value}</span>
          </div>
        ))}
      </div>

      {/* Bot Detection */}
      {data.is_bot && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <div className="flex items-center gap-1.5 mb-1">
            <Bot className="w-4 h-4 text-red-500" />
            <span className="text-sm font-semibold text-red-600">⚠️ Bot Behavior Detected</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {(data.bot_reasons || []).map((r, i) => (
              <Badge key={i} variant="destructive" className="text-[10px]">{r}</Badge>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">Last updated: {formatDate(data.updated_at)}</p>
    </div>
  );
};

const AdminDeviceInfoSection: React.FC<AdminDeviceInfoSectionProps> = ({ userId }) => {
  const [devices, setDevices] = useState<DeviceInfoLog[]>([]);
  const [behavioral, setBehavioral] = useState<BehavioralRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!userId) { setLoading(false); return; }
      
      try {
        const [deviceRes, behaviorRes] = await Promise.all([
          supabase
            .from('device_info_logs')
            .select('*')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false }),
          supabase
            .from('behavioral_tracking' as any)
            .select('*')
            .eq('user_id', userId)
            .maybeSingle(),
        ]);

        if (deviceRes.data) setDevices(deviceRes.data as DeviceInfoLog[]);
        if (behaviorRes.data) setBehavioral(behaviorRes.data as any);
      } catch (err) {
        console.error('Error fetching device/behavioral info:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId]);

  if (loading) {
    return (
      <div className="space-y-2 p-4 bg-muted/30 rounded-lg animate-pulse">
        <div className="h-5 bg-muted rounded w-1/3" />
        <div className="h-4 bg-muted rounded w-full" />
        <div className="h-4 bg-muted rounded w-2/3" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Behavioral Tracking */}
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2 border-b pb-2 mb-3">
          <Activity className="w-5 h-5 text-primary" />
          Behavioral Tracking
          {behavioral?.is_bot && (
            <Badge variant="destructive" className="text-xs gap-1">
              <Bot className="w-3 h-3" /> Bot
            </Badge>
          )}
        </h3>
        <BehavioralSection data={behavioral} />
      </div>

      {/* Device History */}
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2 border-b pb-2 mb-3">
          <Monitor className="w-5 h-5 text-primary" />
          Device History
          <Badge variant="outline" className="text-xs">{devices.length} device{devices.length !== 1 ? 's' : ''}</Badge>
        </h3>
        
        {devices.length === 0 ? (
          <div className="p-4 bg-muted/30 rounded-lg text-center">
            <Monitor className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No device information available</p>
          </div>
        ) : (
          <div className="space-y-2">
            {devices.map((device, idx) => (
              <DeviceCard key={device.id} device={device} defaultOpen={idx === 0} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDeviceInfoSection;
