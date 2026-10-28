import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Cookie, Settings, Shield, Info } from "lucide-react";
import SEO from "@/components/SEO";
import { getUpdatedTimestamp } from "@/utils/timestampUtils";

const CookiePolicy = () => {
  const lastUpdated = getUpdatedTimestamp("cookie-policy");

  return (
    <>
      <SEO
        title="Cookie Policy - Workly India Jobs"
        description="Learn how Workly India uses cookies and similar technologies to provide, improve and personalize your experience on our job platform."
        keywords="cookie policy, cookies, tracking, privacy, Workly India"
      />

      <div className="min-h-screen bg-background">
        <PageHeader title="Cookie Policy" />

        <main className="container mx-auto px-4 py-6 pb-24 md:pb-8 max-w-4xl">
          <div className="text-center mb-10">
            <Badge variant="secondary" className="mb-4">Legal</Badge>
            <h1 className="text-4xl font-bold text-foreground mb-4">Cookie Policy</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              This Cookie Policy explains how Workly India uses cookies and similar tracking
              technologies when you visit our website or use our services.
            </p>
            <p className="text-sm text-muted-foreground mt-2">Last updated: {lastUpdated}</p>
          </div>

          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <Cookie className="w-5 h-5 text-primary" /> What Are Cookies?
              </h2>
              <p className="text-sm text-muted-foreground">
                Cookies are small text files stored on your device when you visit a website. They
                help the site remember your actions and preferences (such as login, language, and
                display settings) over a period of time.
              </p>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <Info className="w-5 h-5 text-primary" /> Types of Cookies We Use
              </h2>
              <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
                <li><strong>Essential cookies</strong> — required for authentication, security and core site functionality.</li>
                <li><strong>Preference cookies</strong> — remember your language, location, search filters and display preferences.</li>
                <li><strong>Analytics cookies</strong> — help us understand how visitors use the site (e.g. Google Analytics, Microsoft Clarity).</li>
                <li><strong>Advertising cookies</strong> — used by ad partners to show more relevant ads and measure campaign performance.</li>
              </ul>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" /> Managing Cookies
              </h2>
              <p className="text-sm text-muted-foreground">
                You can control and delete cookies through your browser settings. Blocking some
                types of cookies may impact your experience of our site — for example, you may need
                to sign in again on every visit, and personalized job recommendations may be less
                accurate.
              </p>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" /> Third-Party Cookies
              </h2>
              <p className="text-sm text-muted-foreground">
                Some cookies may be placed by third-party services that appear on our pages,
                including analytics providers, payment processors, and social media platforms. We
                do not control the setting of these cookies and recommend reviewing the relevant
                third-party privacy policies.
              </p>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-3">Changes to This Policy</h2>
              <p className="text-sm text-muted-foreground">
                We may update this Cookie Policy from time to time. The latest version will always
                be available on this page with an updated revision date.
              </p>
            </Card>
          </div>
        </main>

      </div>
    </>
  );
};

export default CookiePolicy;
