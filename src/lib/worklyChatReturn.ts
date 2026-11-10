import { useEffect, useRef } from "react";
import { useLocation, useNavigate, type NavigateFunction } from "react-router-dom";

const KEY = "workly-chat-return";
const isChat = (p: string) => p.startsWith("/employer/workly-chat") || p.startsWith("/employer/workly-email") || p.startsWith("/widget-chat/");
const inWidget = () => typeof window !== "undefined" && window.parent !== window;

/** Remembers the page the user was on right before entering Workly Chat. */
export function useTrackWorklyChatReturn() {
  const location = useLocation();
  const navigate = useNavigate();
  const prev = useRef<string | null>(null);
  useEffect(() => {
    const path = location.pathname;
    if (isChat(path) && prev.current && !isChat(prev.current)) {
      try { sessionStorage.setItem(KEY, prev.current); } catch { /* ignore */ }
    }
    prev.current = path + location.search;
  }, [location.pathname, location.search]);

  // Phone back inside the website widget: step back inside Workly Chat first;
  // only close the widget when already on the main Workly Chat page.
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;
  useEffect(() => {
    if (!inWidget()) return;
    const onMsg = (e: MessageEvent) => {
      if (e.source !== window.parent || e.data?.type !== "workly-chat:back") return;
      let handled = false;
      for (let i = backHandlers.length - 1; i >= 0 && !handled; i--) handled = backHandlers[i]();
      if (!handled && !isChat(pathRef.current)) { navigate(-1); handled = true; }
      window.parent.postMessage({ type: "workly-chat:back-result", handled }, "*");
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [navigate]);
}

const backHandlers: Array<() => boolean> = [];

/** Lets a Workly Chat screen close its open sub-view (e.g. a chat) on phone back. */
export function useWidgetBackHandler(handler: () => boolean) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const fn = () => ref.current();
    backHandlers.push(fn);
    return () => { const i = backHandlers.indexOf(fn); if (i >= 0) backHandlers.splice(i, 1); };
  }, []);
}

/** Leave Workly Chat back to the page that opened it. */
export function leaveWorklyChat(navigate: NavigateFunction, fallback: string) {
  // Inside the website widget: close the widget instead of navigating.
  if (inWidget()) {
    window.parent.postMessage({ type: "workly-chat:close" }, "*");
    return;
  }
  let target: string | null = null;
  try { target = sessionStorage.getItem(KEY); } catch { /* ignore */ }
  navigate(target || fallback, { replace: true });
}
