/**
 * Risk Score Calculator
 * Calculates a security risk score (0-100) from device/network/login data
 */

export interface RiskScoreInput {
  vpnDetected?: boolean;
  totalUniqueIps?: number;
  firstIp?: string | null;
  lastIp?: string | null;
  loginCount?: number | null;
  accountCreatedAt?: string | null;
  timezone?: string;
  country?: string;
  browserName?: string;
  deviceMemory?: string;
  fingerprintHash?: string;
  isTor?: boolean;
  isDatacenter?: boolean;
  webrtcLeakDetected?: boolean;
  incognitoDetected?: boolean;
  adBlockerDetected?: boolean;
}

export interface RiskScoreResult {
  score: number;
  level: 'low' | 'medium' | 'high';
  factors: string[];
}

export const calculateRiskScore = (input: RiskScoreInput): RiskScoreResult => {
  let score = 0;
  const factors: string[] = [];

  // VPN Detected (+25)
  if (input.vpnDetected) {
    score += 25;
    factors.push('VPN/Proxy detected');
  }

  // TOR Network (+30)
  if (input.isTor) {
    score += 30;
    factors.push('TOR network detected');
  }

  // Datacenter IP (+15)
  if (input.isDatacenter && !input.vpnDetected) {
    score += 15;
    factors.push('Datacenter/hosting IP');
  }

  // WebRTC IP Leak (+20)
  if (input.webrtcLeakDetected) {
    score += 20;
    factors.push('WebRTC IP leak (real IP exposed)');
  }

  // Multiple Unique IPs (+15)
  if ((input.totalUniqueIps ?? 0) > 5) {
    score += 15;
    factors.push(`${input.totalUniqueIps} unique IPs`);
  }

  // IP Changed Recently (+10)
  if (input.firstIp && input.lastIp && input.firstIp !== input.lastIp) {
    score += 10;
    factors.push('IP changed since first login');
  }

  // Unusual Login Frequency (+10)
  if (input.loginCount !== null && input.loginCount !== undefined && input.accountCreatedAt) {
    const days = Math.max(1, Math.floor((Date.now() - new Date(input.accountCreatedAt).getTime()) / (1000 * 60 * 60 * 24)));
    const perDay = input.loginCount / days;
    if (perDay > 10 || (days > 7 && input.loginCount < 2)) {
      score += 10;
      factors.push(perDay > 10 ? 'Very high login frequency' : 'Very low login frequency');
    }
  }

  // New Account + High Activity (+10)
  if (input.accountCreatedAt && input.loginCount !== null && input.loginCount !== undefined) {
    const days = Math.floor((Date.now() - new Date(input.accountCreatedAt).getTime()) / (1000 * 60 * 60 * 24));
    if (days < 7 && input.loginCount > 20) {
      score += 10;
      factors.push('New account with high activity');
    }
  }

  // Timezone mismatch (+10)
  if (input.timezone && input.country) {
    const indiaTimezones = ['Asia/Kolkata', 'Asia/Calcutta'];
    const isIndianCountry = input.country.toLowerCase().includes('india');
    const isIndianTz = indiaTimezones.includes(input.timezone);
    if ((isIndianCountry && !isIndianTz) || (!isIndianCountry && isIndianTz)) {
      score += 10;
      factors.push('Timezone doesn\'t match country');
    }
  }

  // Suspicious Browser (+10)
  if (input.browserName) {
    const suspicious = ['headless', 'phantom', 'selenium', 'puppeteer', 'unknown'];
    if (suspicious.some(s => input.browserName!.toLowerCase().includes(s))) {
      score += 10;
      factors.push('Suspicious browser detected');
    }
  }

  // Low Device Memory (+5)
  if (input.deviceMemory) {
    const mem = parseFloat(input.deviceMemory);
    if (!isNaN(mem) && mem < 2) {
      score += 5;
      factors.push('Low device memory (possible emulator)');
    }
  }

  // Missing Fingerprint (+5)
  if (!input.fingerprintHash) {
    score += 5;
    factors.push('No fingerprint hash');
  }

  // Incognito Mode (+15)
  if (input.incognitoDetected) {
    score += 15;
    factors.push('Incognito/private browsing');
  }

  // Ad Blocker + VPN combo (+5)
  if (input.adBlockerDetected && input.vpnDetected) {
    score += 5;
    factors.push('Stacking privacy tools (VPN + AdBlock)');
  }

  const capped = Math.min(100, score);
  const level: RiskScoreResult['level'] = capped <= 30 ? 'low' : capped <= 60 ? 'medium' : 'high';

  return { score: capped, level, factors };
};
