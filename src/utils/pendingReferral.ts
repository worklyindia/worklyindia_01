const KEY = 'pending_referral_code';

export const savePendingReferralCode = (code?: string | null) => {
  if (!code || !code.trim()) return;
  try {
    localStorage.setItem(KEY, code.trim().toUpperCase());
  } catch {
    /* ignore */
  }
};

export const getPendingReferralCode = (): string | null => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

export const clearPendingReferralCode = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
};
