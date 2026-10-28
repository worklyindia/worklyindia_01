import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accessibility, Eye, Keyboard, Mail } from "lucide-react";
import SEO from "@/components/SEO";
import { useContactInfo } from "@/hooks/useContactInfo";

const AccessibilityStatement = () => {
  const { data: generalContact } = useContactInfo('general');
  return (
    <>
      <SEO
        title="Accessibility Statement - Workly India"
        description="Workly India's commitment to making our platform accessible to everyone, including people with disabilities."
        keywords="accessibility, WCAG, inclusive design, a11y"
      />
      <div className="min-h-screen bg-background">
        <PageHeader title="Accessibility Statement" />
        <main className="container mx-auto px-4 py-6 pb-24 md:pb-8 max-w-4xl">
          <div className="text-center mb-10">
            <Badge variant="secondary" className="mb-4">Accessibility</Badge>
            <h1 className="text-4xl font-bold mb-4">Accessibility Statement</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Workly India is committed to making our platform usable by as many people as possible, regardless of ability.
            </p>
          </div>

          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-3 flex items-center"><Accessibility className="w-5 h-5 mr-2 text-primary" />Our Commitment</h2>
              <p className="text-sm text-muted-foreground">
                We aim to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA and continuously improve the experience for all users.
              </p>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-3 flex items-center"><Eye className="w-5 h-5 mr-2 text-primary" />Features We Support</h2>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Sufficient color contrast for readability</li>
                <li>• Scalable text and responsive layouts</li>
                <li>• Descriptive alt text on meaningful images</li>
                <li>• Semantic HTML and ARIA where appropriate</li>
              </ul>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-3 flex items-center"><Keyboard className="w-5 h-5 mr-2 text-primary" />Keyboard & Assistive Tech</h2>
              <p className="text-sm text-muted-foreground">
                All primary flows can be navigated by keyboard. We test with popular screen readers and continue to expand support.
              </p>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-3 flex items-center"><Mail className="w-5 h-5 mr-2 text-primary" />Feedback</h2>
              <p className="text-sm text-muted-foreground">
                If you experience any accessibility barriers, please contact us at{" "}
                <a href={`mailto:${generalContact?.email || 'worklyindia@outlook.com'}`} className="text-primary hover:underline">
                  {generalContact?.email || 'worklyindia@outlook.com'}
                </a>. We take your feedback seriously and will address issues as quickly as possible.
              </p>
            </Card>
          </div>
        </main>
      </div>
    </>
  );
};

export default AccessibilityStatement;
