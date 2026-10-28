import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, AlertTriangle, Lock, CheckCircle, Flag } from "lucide-react";
import SEO from "@/components/SEO";

const TrustSafety = () => (
  <>
    <SEO
      title="Trust & Safety - Workly India"
      description="Learn how Workly India keeps job seekers and employers safe with verification, fraud prevention, and secure interactions."
      keywords="trust, safety, fraud prevention, job scam, secure hiring"
    />
    <div className="min-h-screen bg-background">
      <PageHeader title="Trust & Safety" />
      <main className="container mx-auto px-4 py-6 pb-24 md:pb-8 max-w-4xl">
        <div className="text-center mb-10">
          <Badge variant="secondary" className="mb-4">Trust & Safety</Badge>
          <h1 className="text-4xl font-bold mb-4">Trust & Safety at Workly India</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Your safety is our top priority. Learn how we work to keep our community secure.
          </p>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-3 flex items-center"><Shield className="w-5 h-5 mr-2 text-primary" />Our Commitment</h2>
            <p className="text-muted-foreground text-sm">
              We take multiple steps to verify employers, monitor listings, and remove suspicious activity from the platform.
            </p>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-3 flex items-center"><CheckCircle className="w-5 h-5 mr-2 text-primary" />Employer Verification</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Company registration and identity checks</li>
              <li>• Mobile and email verification for every account</li>
              <li>• Verification badges for trusted employers</li>
            </ul>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-3 flex items-center"><AlertTriangle className="w-5 h-5 mr-2 text-destructive" />Avoid Job Scams</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Never pay any employer for a job offer</li>
              <li>• Do not share bank OTPs, passwords, or Aadhaar PIN</li>
              <li>• Be cautious of "too good to be true" salary offers</li>
              <li>• Verify company details independently before interviews</li>
            </ul>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-3 flex items-center"><Lock className="w-5 h-5 mr-2 text-primary" />Data Security</h2>
            <p className="text-sm text-muted-foreground">
              Your personal data is encrypted in transit and stored securely. We never sell your data to third parties.
            </p>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-3 flex items-center"><Flag className="w-5 h-5 mr-2 text-primary" />Report Suspicious Activity</h2>
            <p className="text-sm text-muted-foreground">
              If you notice a suspicious job posting or user, please report it immediately via the Contact Us page. Our team investigates every report.
            </p>
          </Card>
        </div>
      </main>
    </div>
  </>
);

export default TrustSafety;
