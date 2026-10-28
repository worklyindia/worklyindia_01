import { useNavigate } from "react-router-dom";
import { Building2, Briefcase, Phone, Mail, MapPin } from "lucide-react";
import { useBrandAssets } from "@/hooks/useBrandAssets";
import { BRAND_CONFIG } from "@/config/brandConfig";
import { useContactInfo } from "@/hooks/useSiteSettings";
import BrandSocialBar from "@/components/BrandSocialBar";

const Footer = () => {
  const navigate = useNavigate();
  const brandAssets = useBrandAssets();
  const brandName = brandAssets.brand_name || BRAND_CONFIG.name;
  const { data: contactInfo } = useContactInfo();
  const supportEmail = contactInfo?.email?.trim() || "worklyindia@outlook.com";
  const supportPhone = contactInfo?.phone?.trim() || "+91-9904923067";

  const footerLinks = {
    jobSeekers: [
      { label: "Browse Jobs", path: "/jobs" },
      { label: "How It Works", path: "/how-it-works" },
      { label: "Career Advice", path: "/career-guidance" },
      { label: "Success Stories", path: "/case-studies" },
    ],
    employers: [
      { label: "Post a Job", path: "/post-job" },
      { label: "Employer Portal", path: "/employer-portal" },
      { label: "Pricing Plans", path: "/developers" },
      { label: "Hire Remote Talent", path: "/recruitment-solutions" },
    ],
    company: [
      { label: "About Us", path: "/about-us" },
      { label: "Mission", path: "/mission" },
      { label: "Vision", path: "/vision" },
      { label: `Why Choose ${brandName}`, path: "/why-choose-us" },
      { label: "Blog", path: "/blog" },
      { label: "FAQ", path: "/faq" },
      { label: "Contact Us", path: "/contact-us" },
    ],
    legal: [
      { label: "Privacy Policy", path: "/privacy" },
      { label: "Terms & Conditions", path: "/terms-conditions" },
      { label: "Cookie Policy", path: "/cookie-policy" },
      { label: "Disclaimer", path: "/disclaimer" },
      { label: "DMCA / Copyright Policy", path: "/dmca" },
      { label: "Refund & Cancellation", path: "/refund-policy" },
      { label: "Contact Us", path: "/contact-us" },
    ],
  };


  return (
    <footer className="bg-gradient-to-b from-background to-primary/5 border-t border-border/50 mt-auto shine-effect">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16 max-w-7xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12 mb-8 lg:mb-12 animate-slide-up-fade" style={{ animationFillMode: 'both' }}>
          {/* For Job Seekers */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-primary" />
              For Job Seekers
            </h3>
            <ul className="space-y-2">
              {footerLinks.jobSeekers.map((link) => (
                <li key={link.path}>
                  <button
                    onClick={() => navigate(link.path)}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* For Employers */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              For Employers
            </h3>
            <ul className="space-y-2">
              {footerLinks.employers.map((link) => (
                <li key={link.path}>
                  <button
                    onClick={() => navigate(link.path)}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-4">Company</h3>
            <ul className="space-y-2">
              {footerLinks.company.map((link) => (
                <li key={link.path}>
                  <button
                    onClick={() => navigate(link.path)}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact & Legal */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-4">Legal</h3>
            <ul className="space-y-2 mb-6">
              {footerLinks.legal.map((link) => (
                <li key={link.path}>
                  <button
                    onClick={() => navigate(link.path)}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
            
            {/* Social Links */}
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">Follow Us</h4>
              <BrandSocialBar align="start" size="md" />
            </div>
          </div>
        </div>

        {/* Contact Information Bar */}
        <div className="pt-6 pb-4 border-t border-border/50">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center sm:text-left mb-4">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <Mail className="w-4 h-4 text-primary" />
              <a href={`mailto:${supportEmail}`} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                {supportEmail}
              </a>
            </div>
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <Phone className="w-4 h-4 text-primary" />
              <a href={`tel:${supportPhone.replace(/[^+\d]/g, "")}`} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                {supportPhone}
              </a>
            </div>
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">
                Ahmedabad, Gujarat, India
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-4 border-t border-border/50">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground text-center sm:text-left">
              © {new Date().getFullYear()} {brandName}. All rights reserved. | UDYAM Registration: UDYAM-GJ-18-0022888
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              Made in India 🇮🇳
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
