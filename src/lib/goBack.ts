import type { NavigateFunction } from "react-router-dom";

/** True when the user reached this page by navigating inside the app (so -1 stays in the app). */
export const hasInAppHistory = (): boolean => {
  try { return typeof window !== "undefined" && Number((window.history.state as any)?.idx) > 0; } catch { return false; }
};

/** Return to the page the user came from; use `fallback` only when opened directly (no in-app history). */
export function goBack(navigate: NavigateFunction, fallback: string = "/") {
  if (hasInAppHistory()) navigate(-1);
  else navigate(fallback, { replace: true });
}
