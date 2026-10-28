/**
 * Lightweight onboarding status (new-account quick setup).
 *
 * Har side (job seeker / employer) ka apna status browser me rakha jata hai:
 *  - 'pending'  -> quick setup abhi baaki hai
 *  - 'complete' -> setup ho chuka, screen dobara nahi dikhani
 *
 * Draft values bhi yahin save hote hain, taki aadha bhara form wapas mil jaye.
 */

export type OnboardingSide = 'jobseeker' | 'employer' | 'referral';
export type OnboardingStatus = 'pending' | 'complete';

const statusKey = (side: OnboardingSide) => `onboarding_status_${side}`;
const draftKey = (side: OnboardingSide) => `onboarding_draft_${side}`;

export const getOnboardingStatus = (side: OnboardingSide): OnboardingStatus => {
  try {
    return localStorage.getItem(statusKey(side)) === 'complete' ? 'complete' : 'pending';
  } catch {
    return 'pending';
  }
};

export const isOnboardingComplete = (side: OnboardingSide): boolean =>
  getOnboardingStatus(side) === 'complete';

export const markOnboardingComplete = (side: OnboardingSide) => {
  try {
    localStorage.setItem(statusKey(side), 'complete');
    localStorage.removeItem(draftKey(side));
  } catch {
    /* ignore */
  }
};

export const markOnboardingPending = (side: OnboardingSide) => {
  try {
    localStorage.setItem(statusKey(side), 'pending');
  } catch {
    /* ignore */
  }
};

export const saveOnboardingDraft = (side: OnboardingSide, data: Record<string, unknown>) => {
  try {
    localStorage.setItem(draftKey(side), JSON.stringify(data));
  } catch {
    /* ignore */
  }
};

export const loadOnboardingDraft = <T,>(
  side: OnboardingSide,
): Partial<T> => {
  try {
    const raw = localStorage.getItem(draftKey(side));
    return raw ? (JSON.parse(raw) as Partial<T>) : {};
  } catch {
    return {};
  }
};

export const clearOnboardingDraft = (side: OnboardingSide) => {
  try {
    localStorage.removeItem(draftKey(side));
  } catch {
    /* ignore */
  }
};

/** Setup route for each side — single source of truth for redirects. */
export const onboardingPath = (side: OnboardingSide, redirect?: string | null) => {
  const base = side === 'referral' ? '/referral-onboarding' : side === 'jobseeker' ? '/JobSeeker/Setup' : '/Employer/Setup';
  return redirect ? `${base}?redirect=${encodeURIComponent(redirect)}` : base;
};
