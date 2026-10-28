export interface WhatsAppSetupStatus {
  is_pin_enabled?: boolean | null;
  status?: string | null;
  platform_type?: string | null;
  business_verification_status?: string | null;
  messaging_limit?: string | null;
}

export function needsWhatsAppRegistration(profile: WhatsAppSetupStatus): boolean {
  const status = profile.status?.toUpperCase();
  if (status === 'CONNECTED') return false;
  return status === 'PENDING' || status === 'UNREGISTERED';
}

export function needsWhatsAppSetup(profile: WhatsAppSetupStatus): boolean {
  return needsWhatsAppRegistration(profile) || profile.is_pin_enabled === false;
}

export function needsBusinessVerification(profile: WhatsAppSetupStatus): boolean {
  const status = profile.business_verification_status?.toUpperCase();
  return !!status && status !== 'VERIFIED';
}

export function validWhatsAppPin(pin: string, confirmation: string): boolean {
  return /^\d{6}$/.test(pin) && pin === confirmation;
}