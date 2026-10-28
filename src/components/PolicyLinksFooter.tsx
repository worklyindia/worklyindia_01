import { Link } from "react-router-dom";
import { useBrandAssets } from "@/hooks/useBrandAssets";
import { BRAND_CONFIG } from "@/config/brandConfig";

interface PolicyLinksFooterProps {
  className?: string;
  align?: "center" | "start";
  showCopyright?: boolean;
}

/**
 * Shared policy / legal footer used on Auth pages, external job detail pages,
 * and anywhere users should easily see all site policies.
 */
const PolicyLinksFooter = ({
  className = "",
  align = "center",
  showCopyright = true,
}: PolicyLinksFooterProps) => {
  const brandAssets = useBrandAssets();
  const brandName = brandAssets.brand_name || BRAND_CONFIG.name;

  const links = [
    { to: "/privacy", label: "Privacy Policy" },
    { to: "/terms-conditions", label: "Terms & Conditions" },
    { to: "/cookie-policy", label: "Cookie Policy" },
    { to: "/disclaimer", label: "Disclaimer" },
    { to: "/dmca", label: "DMCA / Copyright Policy" },
    { to: "/refund-policy", label: "Refund & Cancellation" },
    { to: "/contact-us", label: "Contact Us" },
  ];

  return (
    <div
      className={`px-4 pt-5 pb-2 ${align === "center" ? "text-center" : "text-left"} ${className}`}
    >
      <div
        className={`flex flex-wrap ${
          align === "center" ? "justify-center" : "justify-start"
        } gap-x-3 gap-y-2 text-sm`}
      >
        {links.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="text-primary font-medium underline underline-offset-4 decoration-primary/30 hover:decoration-primary transition-all active:scale-95"
          >
            {link.label}
          </Link>
        ))}
      </div>
      {showCopyright && (
        <p className="mt-4 text-xs text-muted-foreground">
          © {new Date().getFullYear()} {brandName}. All Rights Reserved.
        </p>
      )}
    </div>
  );
};

export default PolicyLinksFooter;
