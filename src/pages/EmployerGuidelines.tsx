import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Briefcase, CheckCircle, XCircle, FileText } from "lucide-react";
import SEO from "@/components/SEO";

const EmployerGuidelines = () => (
  <>
    <SEO
      title="Employer Guidelines - Workly India"
      description="Guidelines for employers posting jobs on Workly India. Learn how to create quality listings and hire responsibly."
      keywords="employer guidelines, job posting rules, hiring policy"
    />
    <div className="min-h-screen bg-background">
      <PageHeader title="Employer Guidelines" />
      <main className="container mx-auto px-4 py-6 pb-24 md:pb-8 max-w-4xl">
        <div className="text-center mb-10">
          <Badge variant="secondary" className="mb-4">For Employers</Badge>
          <h1 className="text-4xl font-bold mb-4">Employer Guidelines</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Standards every employer must follow when posting jobs on Workly India.
          </p>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-3 flex items-center"><Briefcase className="w-5 h-5 mr-2 text-primary" />Posting Quality Jobs</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Provide accurate, complete job descriptions</li>
              <li>• Include clear salary range, location, and role responsibilities</li>
              <li>• Specify required skills and experience honestly</li>
              <li>• Use your registered company name and verified contact info</li>
            </ul>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-3 flex items-center"><CheckCircle className="w-5 h-5 mr-2 text-primary" />Do's</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Respond promptly to applicants</li>
              <li>• Respect candidate privacy and data</li>
              <li>• Maintain a professional and respectful tone</li>
              <li>• Keep listings current — close filled positions</li>
            </ul>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-3 flex items-center"><XCircle className="w-5 h-5 mr-2 text-destructive" />Prohibited Practices</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Charging candidates any registration or training fee</li>
              <li>• Discrimination based on gender, religion, caste, or age</li>
              <li>• Misleading job titles or fake company details</li>
              <li>• Requesting Aadhaar, bank details, or OTPs during hiring</li>
              <li>• MLM, gambling, adult, or illegal work postings</li>
            </ul>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-3 flex items-center"><FileText className="w-5 h-5 mr-2 text-primary" />Compliance</h2>
            <p className="text-sm text-muted-foreground">
              Employers must comply with Indian labor laws and our Terms & Conditions. Violations may result in job removal or account suspension.
            </p>
          </Card>
        </div>
      </main>
    </div>
  </>
);

export default EmployerGuidelines;
