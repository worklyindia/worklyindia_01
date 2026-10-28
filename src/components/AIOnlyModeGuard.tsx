import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAIOnlyMode } from "@/hooks/useAIOnlyMode";
import AILoadingScreen from "@/components/AILoadingScreen";

// Minimum time the AI loading screen stays visible so users can see it.
const MIN_LOADING_MS = 3000;

// Paths that stay reachable while "AI only" mode is on.
const ALLOWED_PREFIXES = [
  "/ai-assistant",
  "/owner-portal",
  "/admin",
  "/auth",
  "/employer-auth",
  "/signup",
  "/employer-signup",
  "/forgot-password",
  "/employer-forgot-password",
  "/oauth",
  "/banned",
];

const ALLOWED_EXACT = [
  "/pricing",
  "/privacy",
  "/privacy-policy",
  "/terms",
  "/terms-and-conditions",
  "/terms-conditions",
  "/refund-policy",
  "/cookie-policy",
  "/cookies",
  "/dmca",
  "/copyright-policy",
  "/job-policy",
  "/points-policy",
  "/accessibility",
  "/accessibility-statement",
  "/community-guidelines",
  "/employer-guidelines",
  "/job-seeker-guidelines",
  "/trust-safety",
  "/disclaimer",
  "/contact",
  "/contact-us",
  "/about",
  "/about-us",
];

export const isAIOnlyAllowedPath = (pathname: string) => {
  const path = pathname.toLowerCase().replace(/\/+$/, "") || "/";
  if (ALLOWED_EXACT.includes(path)) return true;
  if (path.includes("policy") || path.includes("guidelines") || path.includes("terms")) return true;
  return ALLOWED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
};

export const AIOnlyModeGuard = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const { enabled, isFetching } = useAIOnlyMode();
  const [minDelayComplete, setMinDelayComplete] = useState(false);
  // True once the fresh setting has been fetched after this page load.
  const [freshCheckComplete, setFreshCheckComplete] = useState(false);

  // Wait for the fresh setting before showing ANY page, so the normal
  // website never flashes for a second when AI-only mode is ON.
  useEffect(() => {
    if (!isFetching) setFreshCheckComplete(true);
  }, [isFetching]);

  // The branded AI loading screen is only used while AI-only mode is ON.
  // The countdown starts once we know the mode is enabled.
  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => setMinDelayComplete(true), MIN_LOADING_MS);
    return () => clearTimeout(timer);
  }, [enabled]);

  // Public pricing must not wait for a visitor's mode/settings request.
  if (location.pathname.toLowerCase().replace(/\/+$/, '') === '/pricing') return <>{children}</>;

  // Render the website immediately using the cached mode; a blank interim
  // screen caused a visible second loading phase on every open.
  void freshCheckComplete;

  // AI-only mode OFF: show the normal website, no loading screen.
  if (!enabled) return <>{children}</>;
  if (!minDelayComplete) return <AILoadingScreen />;
  if (isAIOnlyAllowedPath(location.pathname)) return <>{children}</>;

  return <Navigate to="/ai-assistant" replace />;
};

export default AIOnlyModeGuard;
