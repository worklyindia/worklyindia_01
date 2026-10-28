import { Link } from "react-router-dom";
import { BRAND_CONFIG } from "@/config/brandConfig";

/**
 * Home page "about this app" block.
 * Required by Google OAuth verification: the home page must clearly state the
 * application name (matching the OAuth consent screen) and explain what the app
 * does, including why Google/YouTube account access is requested.
 */
const AppPurposeSection = () => {
  return (
    <section id="about-app" className="px-4 py-6" aria-labelledby="about-app-heading">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 id="about-app-heading" className="text-lg font-bold text-foreground mb-2">
          About {BRAND_CONFIG.name}
        </h2>
        <p className="text-sm text-muted-foreground mb-3">
          <strong className="text-foreground">{BRAND_CONFIG.name}</strong> ({BRAND_CONFIG.tagline}) is
          an Indian remote-work and remote job platform. Job seekers can search and apply to
          verified remote jobs, internships and freelance work, build a resume, get AI career
          guidance, and track applications — completely free. Employers can post jobs, manage
          applicants and schedule interviews.
        </p>

        <h3 className="text-sm font-semibold text-foreground mb-1.5">
          Why we ask for Google / YouTube access
        </h3>
        <ul className="space-y-1.5 text-sm text-muted-foreground mb-3">
          <li>• <strong>Google Sign-In</strong> — to create your {BRAND_CONFIG.name} account using your name, email and profile photo.</li>
          <li>• <strong>YouTube (optional)</strong> — only if you connect it, so {BRAND_CONFIG.name} can publish and manage career-guidance videos and live sessions on your own channel from your dashboard.</li>
        </ul>
        <p className="text-sm text-muted-foreground">
          We never sell your data. You can disconnect at any time. Read our{" "}
          <Link to="/privacy" className="text-primary underline underline-offset-4">Privacy Policy</Link>{" "}
          and{" "}
          <Link to="/terms-conditions" className="text-primary underline underline-offset-4">Terms &amp; Conditions</Link>.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Operated by {BRAND_CONFIG.name}, {BRAND_CONFIG.location} · UDYAM {BRAND_CONFIG.udyamNumber} ·{" "}
          <a href={`mailto:${BRAND_CONFIG.supportEmail}`} className="text-primary underline underline-offset-4">
            {BRAND_CONFIG.supportEmail}
          </a>
        </p>
      </div>
    </section>
  );
};

export default AppPurposeSection;
