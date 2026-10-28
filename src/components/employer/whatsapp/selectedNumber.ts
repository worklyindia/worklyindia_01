import { useSyncExternalStore } from "react";

/** The employer's currently selected WhatsApp number (Meta phone_number_id), shared by chat, templates and profile. */
const KEY = "employer_wa_selected_number";
const listeners = new Set<() => void>();

export function getSelectedNumber(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function setSelectedNumber(id: string | null) {
  try { if (id) localStorage.setItem(KEY, id); else localStorage.removeItem(KEY); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

export function useSelectedNumber() {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    getSelectedNumber,
    () => null,
  );
}

/** Developer referral captured from ?ref=<developer user id> on any page. */
const REF_KEY = "wa_developer_ref";
const RETURN_KEY = "wa_developer_return";
try {
  const params = new URLSearchParams(window.location.search);
  const r = params.get("ref");
  if (r && /^[0-9a-f-]{36}$/i.test(r)) localStorage.setItem(REF_KEY, r);
  const ret = params.get("return");
  if (ret && /^https:\/\//i.test(ret)) localStorage.setItem(RETURN_KEY, ret);
} catch { /* ignore */ }
function devRef(): string | null {
  try { return localStorage.getItem(REF_KEY); } catch { return null; }
}

/** Developer website to send the user back to after a successful connect (read-once). */
export function consumeDevReturnUrl(): string | null {
  try {
    const url = localStorage.getItem(RETURN_KEY);
    if (url) localStorage.removeItem(RETURN_KEY);
    return url;
  } catch { return null; }
}

/** Body prefix for employer-scoped server calls; routes the action to the selected number. */
export function employerScope(): { scope: "employer"; phone_number_id?: string; dev_ref?: string } {
  const id = getSelectedNumber();
  const ref = devRef();
  return { scope: "employer", ...(id ? { phone_number_id: id } : {}), ...(ref ? { dev_ref: ref } : {}) };
}
