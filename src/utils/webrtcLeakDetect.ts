/**
 * WebRTC IP Leak Detection
 * Discovers local and public IPs via RTCPeerConnection STUN requests.
 * Can reveal real IP even when a VPN is active.
 */

export interface WebRTCLeakResult {
  localIPs: string[];
  publicIPs: string[];
  leakDetected: boolean; // true if WebRTC IP differs from reported IP AND VPN is active
}

const STUN_SERVERS = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
];

/**
 * Detect WebRTC IP leaks by creating a peer connection and gathering ICE candidates.
 * @param reportedIP - The IP reported by the server (from get-ip-info edge function)
 * @param timeoutMs - Max time to wait for candidates (default 5000ms)
 * @param vpnDetected - Whether a VPN/proxy is active (only flag leak if VPN is on)
 */
export const detectWebRTCLeak = (
  reportedIP: string = '',
  timeoutMs: number = 5000,
  vpnDetected: boolean = false
): Promise<WebRTCLeakResult> => {
  return new Promise((resolve) => {
    const result: WebRTCLeakResult = {
      localIPs: [],
      publicIPs: [],
      leakDetected: false,
    };

    try {
      const RTCPeerConnection =
        window.RTCPeerConnection ||
        (window as any).webkitRTCPeerConnection ||
        (window as any).mozRTCPeerConnection;

      if (!RTCPeerConnection) {
        resolve(result);
        return;
      }

      const pc = new RTCPeerConnection({
        iceServers: STUN_SERVERS.map((url) => ({ urls: url })),
      });

      const seenIPs = new Set<string>();
      let resolved = false;

      const finalize = () => {
        if (resolved) return;
        resolved = true;
        pc.close();

        // When VPN is active and WebRTC discovers ANY public IP, it's a leak
        // A properly secured VPN should block WebRTC IP discovery entirely
        if (vpnDetected && result.publicIPs.length > 0) {
          result.leakDetected = true;
        }
        // When NO VPN, WebRTC revealing public IPs is normal browser behavior — NOT a leak

        resolve(result);
      };

      // Timeout
      const timer = setTimeout(finalize, timeoutMs);

      pc.onicecandidate = (event) => {
        if (!event.candidate) {
          clearTimeout(timer);
          finalize();
          return;
        }

        const candidate = event.candidate.candidate;

        // Skip mDNS candidates (e.g., "abcd-1234.local")
        if (/\.local/i.test(candidate)) return;

        // Extract IP from candidate string
        const ipRegex = /(?:\d{1,3}\.){3}\d{1,3}|[a-f0-9]{1,4}(?::[a-f0-9]{1,4}){7}/gi;
        const matches = candidate.match(ipRegex);

        if (matches) {
          for (const ip of matches) {
            if (seenIPs.has(ip) || ip === '0.0.0.0') continue;
            seenIPs.add(ip);

            // Classify: private vs public
            if (isPrivateIP(ip)) {
              result.localIPs.push(ip);
            } else {
              result.publicIPs.push(ip);
            }
          }
        }
      };

      // Create data channel and offer to trigger ICE gathering
      pc.createDataChannel('leak_test');
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .catch(() => {
          clearTimeout(timer);
          finalize();
        });
    } catch {
      resolve(result);
    }
  });
};

/** Check if an IP address is private/local/reserved (including CGNAT) */
function isPrivateIP(ip: string): boolean {
  // IPv4 private ranges
  if (/^10\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  if (/^127\./.test(ip)) return true;
  if (/^169\.254\./.test(ip)) return true;
  // CGNAT range (100.64.0.0/10 = 100.64.0.0 – 100.127.255.255)
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip)) return true;
  // IETF Protocol Assignments (192.0.0.0/24)
  if (/^192\.0\.0\./.test(ip)) return true;
  // Documentation ranges
  if (/^192\.0\.2\./.test(ip)) return true;
  if (/^198\.51\.100\./.test(ip)) return true;
  if (/^203\.0\.113\./.test(ip)) return true;
  // IPv6 link-local
  if (/^fe80:/i.test(ip)) return true;
  if (/^::1$/.test(ip)) return true;
  if (/^fc00:/i.test(ip)) return true;
  if (/^fd/i.test(ip)) return true;
  return false;
}

/** Check if two IPv4 addresses are in the same /24 subnet */
function isSameSubnet(ip1: string, ip2: string): boolean {
  const parts1 = ip1.split('.');
  const parts2 = ip2.split('.');
  if (parts1.length !== 4 || parts2.length !== 4) return false;
  return parts1[0] === parts2[0] && parts1[1] === parts2[1] && parts1[2] === parts2[2];
}
