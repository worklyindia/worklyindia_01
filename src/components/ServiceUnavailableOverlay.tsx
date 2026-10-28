import { useEffect, useState, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import Lottie from "lottie-react";
import liveChatbotAnimation from "@/assets/live-chatbot.json";
import { subscribeOn404 } from "@/utils/notFoundSignal";
import { format, addMonths, setDate } from "date-fns";

const SUPABASE_URL = "https://jubwzelupbntbetpajqb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4";

type ServiceHealth = "checking" | "healthy" | "degraded" | "restricted" | "down";

interface ServiceStatus {
  name: string;
  health: ServiceHealth;
  detail?: string;
}

const INITIAL_SERVICES: ServiceStatus[] = [
  { name: "Database", health: "checking" },
  { name: "PostgREST", health: "checking" },
  { name: "Auth", health: "checking" },
  { name: "Realtime", health: "checking" },
  { name: "Storage", health: "checking" },
  { name: "Edge Functions", health: "checking" },
];

const HEALTH_LABEL: Record<ServiceHealth, string> = {
  checking: "Checking…",
  healthy: "Healthy",
  // Anything that is not healthy is shown as reassuring in-progress state
  // instead of a scary technical failure state.
  degraded: "In Progress",
  restricted: "In Progress",
  down: "In Progress",
};

/** Friendly sub-text shown instead of raw technical reasons. */
const WORKING_DETAIL = "Our team is working on it";

const HEALTH_COLOR: Record<ServiceHealth, string> = {
  checking: "#57534e",
  healthy: "#15803d",
  degraded: "#15803d",
  restricted: "#15803d",
  down: "#15803d",
};


/**
 * Supabase-dashboard style status glyph: a soft tinted disc with a crisp
 * stroked icon, replacing the old ✅ / ⚠️ emoji (which rendered
 * inconsistently across Android, iOS and desktop).
 */
const StatusIcon = ({ health }: { health: ServiceHealth }) => {
  if (health === "checking") {
    return (
      <span
        style={{
          width: 18,
          height: 18,
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span className="wi-status-spinner" aria-label="Checking" />
      </span>
    );
  }

  const color = HEALTH_COLOR[health];

  // Non-healthy states: live animated spinner (in-progress) instead of an
  // error glyph, so the status reads as active work, not a failure.
  if (health !== "healthy") {
    return (
      <span
        role="img"
        aria-label={HEALTH_LABEL[health]}
        style={{
          width: 18,
          height: 18,
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          className="wi-status-spinner-green"
          style={{ borderColor: `${color}33`, borderTopColor: color }}
          aria-hidden="true"
        />
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label={HEALTH_LABEL[health]}
      style={{
        width: 18,
        height: 18,
        flexShrink: 0,
        borderRadius: "50%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: `${color}1f`,
        border: `1px solid ${color}59`,
      }}
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
};



/** Pull the human-readable reason out of a Supabase restriction payload. */
const extractReason = (bodyText: string): string | undefined => {
  try {
    const parsed = JSON.parse(bodyText);
    const msg: unknown = parsed?.message ?? parsed?.error ?? parsed?.msg;
    if (typeof msg !== "string" || !msg) return undefined;
    if (/exceed_cached_egress_quota|egress/i.test(msg)) return "Egress quota exceeded";
    if (/paus/i.test(msg)) return "Project paused";
    if (/restricted/i.test(msg)) return "Project restricted";
    return msg.length > 80 ? msg.slice(0, 77) + "…" : msg;
  } catch {
    return undefined;
  }
};

/**
 * Probe a single Supabase sub-service and classify the result honestly.
 *
 * 402 / 540 / 541  -> restricted (quota wall, plan restriction, paused project)
 * 5xx              -> degraded  (service reachable but erroring)
 * network / abort  -> down      (unreachable from this browser)
 * everything else  -> healthy   (401 / 404 / 405 still prove the service answers)
 */
const probeService = async (
  url: string,
  headers: Record<string, string> = {},
  init: RequestInit = {}
): Promise<{ health: ServiceHealth; detail?: string }> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { ...init, headers, signal: controller.signal });
    const text = await res.text().catch(() => "");

    if (res.status === 402 || res.status === 540 || res.status === 541) {
      return { health: "restricted", detail: extractReason(text) ?? "Service restricted" };
    }
    if (res.status >= 500) {
      return { health: "degraded", detail: extractReason(text) ?? `HTTP ${res.status}` };
    }
    // Some services report failure inside a 2xx JSON body ({ healthy: false }).
    if (res.ok && text) {
      try {
        const body = JSON.parse(text);
        if (body?.healthy === false) return { health: "degraded", detail: "Reported unhealthy" };
      } catch {
        /* plain-text body such as storage's "OK" is fine */
      }
    }
    return { health: "healthy" };
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === "AbortError";
    return { health: "down", detail: aborted ? "Timed out" : "No response" };
  } finally {
    clearTimeout(timer);
  }
};

const checkSupabaseServices = async (): Promise<ServiceStatus[]> => {
  const authHeaders = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };

  // NOTE: `/rest/v1/` (the bare root) always answers 401 "only service_role can
  // use this endpoint", so it can never tell us whether the data API works.
  // Probing a real table route is what actually exercises PostgREST + Postgres.
  const [rest, auth, realtime, storage, edgeFn] = await Promise.all([
    probeService(`${SUPABASE_URL}/rest/v1/profiles?select=id&limit=1`, authHeaders),
    probeService(`${SUPABASE_URL}/auth/v1/health`, authHeaders),
    probeService(`${SUPABASE_URL}/realtime/v1/`, authHeaders),
    probeService(`${SUPABASE_URL}/storage/v1/status`, authHeaders),
    // No custom headers here on purpose: adding `Content-Type` turns this into
    // a preflighted CORS request, and a restricted gateway never answers the
    // OPTIONS, which made Edge Functions look "unreachable" instead of
    // "restricted". A header-free GET is a simple request and reports truthfully.
    probeService(`${SUPABASE_URL}/functions/v1/check-api-health`),

  ]);

  // Database sits behind PostgREST: a successful table read proves both are up,
  // and a quota/restriction wall takes both down together.
  return [
    { name: "Database", ...rest },
    { name: "PostgREST", ...rest },
    { name: "Auth", ...auth },
    { name: "Realtime", ...realtime },
    { name: "Storage", ...storage },
    { name: "Edge Functions", ...edgeFn },
  ];
};


interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}


// Public/info pages users can still browse even when Supabase is down
const ALLOWED_PATHS = [
  "/about-us",
  "/mission",
  "/vision",
  "/why-choose-us",
  "/blog",
  "/privacy",
  "/refund-policy",
  "/terms-conditions",
  "/faq",
  "/points-policy",
  "/disclaimer",
  "/contact-us",
];

const FOOTER_LINKS = [
  { to: "/about-us", label: "About Us" },
  { to: "/mission", label: "Mission" },
  { to: "/vision", label: "Vision" },
  { to: "/why-choose-us", label: "Why Choose Workly India" },
  { to: "/blog", label: "Blog" },
  { to: "/privacy", label: "Privacy Policy" },
  { to: "/refund-policy", label: "Refund & Cancellation" },
  { to: "/terms-conditions", label: "Terms & Conditions" },
  { to: "/faq", label: "FAQ" },
  { to: "/disclaimer", label: "Disclaimer" },
  { to: "/contact-us", label: "Contact Us" },
];

/**
 * Compute the next service-resume target date based on the current day.
 * - Before the 7th of the month -> target is the 7th of the same month.
 * - On or after the 7th -> target is the 7th of the next month.
 */
const getTargetDate = (): Date => {
  const now = new Date();
  const day = now.getDate();
  let target = setDate(now, 7);
  if (day >= 7) {
    target = addMonths(target, 1);
  }
  target.setHours(0, 0, 0, 0);
  return target;
};

const calculateTimeLeft = (target: Date): TimeLeft => {
  const now = new Date().getTime();
  const distance = target.getTime() - now;
  if (distance <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  }
  return {
    days: Math.floor(distance / (1000 * 60 * 60 * 24)),
    hours: Math.floor((distance / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((distance / (1000 * 60)) % 60),
    seconds: Math.floor((distance / 1000) % 60),
  };
};

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Shows a friendly full-screen "platform paused for update" overlay
 * ONLY when Supabase is fully stopped / quota exhausted (project paused,
 * egress/db quota exceeded, plan restricted). Normal network errors,
 * 4xx, 5xx, timeouts, offline, CORS — do NOT trigger this screen.
 */
const ServiceUnavailableOverlay = () => {
  const [blocked, setBlocked] = useState(false);
  const [on404, setOn404State] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [services, setServices] = useState<ServiceStatus[]>(INITIAL_SERVICES);

  const runStatusCheck = async () => {
    setShowStatus(true);
    setServices(INITIAL_SERVICES.map((s) => ({ ...s, health: "checking" })));
    const results = await checkSupabaseServices();
    setServices(results);
  };
  const location = useLocation();
  const isAllowedPath = ALLOWED_PATHS.some(
    (p) => location.pathname === p || location.pathname.startsWith(p + "/")
  );

  const targetDate = useMemo(() => getTargetDate(), []);
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => calculateTimeLeft(targetDate));

  const isFinished =
    timeLeft.days === 0 &&
    timeLeft.hours === 0 &&
    timeLeft.minutes === 0 &&
    timeLeft.seconds === 0;

  useEffect(() => {
    setTimeLeft(calculateTimeLeft(targetDate));
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(targetDate));
    }, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  useEffect(() => {
    const unsub = subscribeOn404(setOn404State);
    return () => { unsub(); };
  }, []);

  // Reset the blocked state whenever the user navigates — the new route will
  // re-trigger the overlay only if its own Supabase calls still hard-stop.
  // This prevents a stale "update coming" screen from covering the 404 page.
  useEffect(() => {
    setBlocked(false);
  }, [location.pathname]);




  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    const isSupabaseUrl = (url: string) =>
      url.includes(".supabase.co/") || url.includes(".supabase.in/");

    // VERY strict — only true Supabase-level shutdowns / quota walls
    const HARD_STOP_PATTERNS = [
      /project is paused/i,
      /project has been paused/i,
      /paused due to inactivity/i,
      /restricted due to the following violations/i,
      /exceed(ed)?_?(cached_)?egress_quota/i,
      /egress.*(quota|limit).*(exceed|exhaust)/i,
      /database.*(quota|size).*(exceed|exhaust)/i,
      /quota.*exceeded/i,
      /plan.*limit.*exceeded/i,
      /service.*restricted/i,
      /over.*your.*plan/i,
    ];

    const isHardStop = (status: number, bodyText: string) => {
      // 402 Payment Required is Supabase's quota/billing wall — always a hard stop
      if (status === 402) return true;

      // 503 only if body explicitly says quota/restriction (not generic outages)
      if (status === 503 && HARD_STOP_PATTERNS.some((re) => re.test(bodyText))) {
        return true;
      }

      // 540/541 etc. custom Supabase project-paused codes
      if ((status === 540 || status === 541) && /paus/i.test(bodyText)) {
        return true;
      }

      return false;
    };

    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      try {
        const url =
          typeof args[0] === "string"
            ? args[0]
            : args[0] instanceof Request
            ? args[0].url
            : String(args[0]);

        if (
          isSupabaseUrl(url) &&
          (response.status === 402 ||
            response.status === 503 ||
            response.status === 540 ||
            response.status === 541)
        ) {
          let text = "";
          try {
            text = await response.clone().text();
          } catch {
            /* ignore */
          }
          if (isHardStop(response.status, text)) {
            setBlocked(true);
          }
        }
      } catch {
        /* never let the interceptor break the app */
      }
      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);


  if (!blocked || isAllowedPath || on404) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background:
          "radial-gradient(circle at 30% 20%, #ffd9b8 0%, #fce5cf 45%, #f5d2b0 100%)",
        color: "#1a1a1a",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        animation: "wi-fade-in 0.5s ease-out",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          minHeight: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
        }}
      >
      <style>{`
        @keyframes wi-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes wi-pop {
          0% { opacity: 0; transform: translateY(20px) scale(0.96); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes wi-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes wi-wrench {
          0%, 100% { transform: rotate(-12deg); }
          50% { transform: rotate(12deg); }
        }
        @keyframes wi-pulse-ring {
          0% { transform: scale(0.8); opacity: 0.6; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes wi-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes wi-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        .wi-card {
          animation: wi-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .wi-icon-wrap {
          position: relative;
          width: 96px;
          height: 96px;
          margin: 0 auto 20px;
          animation: wi-float 3s ease-in-out infinite;
        }
        .wi-icon-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: #000;
          opacity: 0.08;
          animation: wi-pulse-ring 2s ease-out infinite;
        }
        .wi-icon-circle {
          position: relative;
          width: 96px;
          height: 96px;
          border-radius: 50%;
          background: #000;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 12px 32px rgba(0,0,0,0.18);
        }
        .wi-wrench {
          font-size: 44px;
          display: inline-block;
          animation: wi-wrench 1.8s ease-in-out infinite;
          transform-origin: center;
        }
        .wi-title {
          background: linear-gradient(90deg, #1a1a1a, #555, #1a1a1a);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: wi-shimmer 3s linear infinite;
        }
        .wi-btn {
          position: relative;
          overflow: hidden;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .wi-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 24px rgba(0,0,0,0.25);
        }
        .wi-btn:active { transform: translateY(0); }
        .wi-dots span {
          display: inline-block;
          width: 6px; height: 6px;
          margin: 0 3px;
          border-radius: 50%;
          background: #1a1a1a;
          opacity: 0.5;
          animation: wi-float 1.2s ease-in-out infinite;
        }
        .wi-dots span:nth-child(2) { animation-delay: 0.15s; }
        .wi-dots span:nth-child(3) { animation-delay: 0.3s; }
        .wi-status-spinner {
          display: inline-block;
          width: 12px;
          height: 12px;
          border: 2px solid rgba(0,0,0,0.2);
          border-top-color: #1a1a1a;
          border-radius: 50%;
          animation: wi-spin 0.8s linear infinite;
        }
        .wi-status-spinner-green {
          display: inline-block;
          width: 14px;
          height: 14px;
          border: 2px solid #15803d33;
          border-top-color: #15803d;
          border-radius: 50%;
          animation: wi-spin 0.8s linear infinite;
        }
      `}</style>

      <div className="wi-card" style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
        <div style={{ width: 180, height: 180, margin: "0 auto 8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Lottie animationData={liveChatbotAnimation} loop autoplay style={{ width: "100%", height: "100%" }} />
        </div>



        <h1
          className="wi-title"
          style={{
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: "0.02em",
            marginBottom: 6,
          }}
        >
          We'll Be Back Soon
        </h1>

        <h2
          style={{
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            opacity: 0.75,
            marginBottom: 10,
          }}
        >
          We're Upgrading Workly India
        </h2>

        <p style={{ fontSize: 13, lineHeight: 1.55, marginBottom: 14 }}>
          We're working to improve your experience. Our platform is temporarily
          unavailable while we complete important updates. Thank you for your
          patience—we'll be back soon.
        </p>

        <div
          style={{
            background: "rgba(0,0,0,0.06)",
            borderRadius: 12,
            padding: "12px 14px",
            marginBottom: 12,
          }}
        >
          {!isFinished ? (
            <>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  opacity: 0.6,
                  marginBottom: 4,
                }}
              >
                Expected Service Resume Date
              </p>
              <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>
                {format(targetDate, "d MMMM yyyy")}
              </p>

              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  opacity: 0.6,
                  marginBottom: 4,
                }}
              >
                Time Remaining
              </p>
              <p style={{ fontSize: 18, fontWeight: 800, letterSpacing: "0.02em" }}>
                {pad(timeLeft.days)} D : {pad(timeLeft.hours)} H : {pad(timeLeft.minutes)} M : {pad(timeLeft.seconds)} S
              </p>
            </>
          ) : (
            <>
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  lineHeight: 1.5,
                  marginBottom: 8,
                }}
              >
                Almost Ready! Your patience means a lot to us. Our team is
                performing the final system checks.
              </p>
              <p style={{ fontSize: 11, opacity: 0.65 }}>
                Workly India is expected to be live within the next 24 hours.
                Please check back soon.
              </p>
            </>
          )}
        </div>

        <div className="wi-dots" style={{ marginBottom: 12 }}>
          <span /><span /><span />
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => window.location.reload()}
            className="wi-btn"
            style={{
              padding: "10px 24px",
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "#fce5cf",
              background: "#000",
              border: "none",
              borderRadius: 999,
              cursor: "pointer",
              boxShadow: "0 6px 18px rgba(0,0,0,0.2)",
            }}
          >
            Try Again →
          </button>

          <button
            onClick={runStatusCheck}
            className="wi-btn"
            style={{
              padding: "10px 24px",
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "#1a1a1a",
              background: "transparent",
              border: "2px solid #1a1a1a",
              borderRadius: 999,
              cursor: "pointer",
            }}
          >
            {showStatus && services.some((s) => s.health === "checking")
              ? "Checking…"
              : "Status"}
          </button>
        </div>

        {showStatus && (
          <div
            style={{
              marginTop: 14,
              background: "rgba(0,0,0,0.06)",
              borderRadius: 12,
              padding: "12px 14px",
              textAlign: "left",
              animation: "wi-pop 0.4s ease-out both",
            }}
          >
            {services.map((s, i) => (
              <div
                key={s.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "8px 0",
                  borderBottom:
                    i < services.length - 1
                      ? "1px solid rgba(0,0,0,0.08)"
                      : "none",
                }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    fontSize: 13,
                    fontWeight: 600,
                    minWidth: 0,
                  }}
                >
                  <StatusIcon health={s.health} />
                  <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                    <span>{s.name}</span>
                    {s.health !== "healthy" && s.health !== "checking" && (
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 500,
                          opacity: 0.6,
                          lineHeight: 1.35,
                        }}
                      >
                        {WORKING_DETAIL}
                      </span>
                    )}

                  </span>
                </span>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    color: HEALTH_COLOR[s.health],
                  }}
                >
                  {HEALTH_LABEL[s.health]}
                </span>
              </div>
            ))}

          </div>
        )}

        <div
          style={{
            marginTop: 18,
            paddingTop: 14,
            borderTop: "1px solid rgba(0,0,0,0.12)",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "6px 10px",
          }}
        >
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setBlocked(false)}
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                color: "#1a1a1a",
                textDecoration: "underline",
                textUnderlineOffset: 3,
                textDecorationColor: "rgba(0,0,0,0.3)",
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <p
          style={{
            marginTop: 12,
            fontSize: 11.5,
            opacity: 0.6,
            fontWeight: 500,
          }}
        >
          © {new Date().getFullYear()} Workly India. All Rights Reserved.
        </p>
      </div>
    </div>
  </div>
  );
};

export default ServiceUnavailableOverlay;
