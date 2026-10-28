import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, CheckCircle, XCircle, ShieldAlert } from "lucide-react";
import SEO from "@/components/SEO";

const JobSeekerGuidelines = () => (
  <>
    <SEO
      title="Job Seeker Guidelines - Workly India"
      description="Guidelines for job seekers on Workly India. Learn how to apply safely and present yourself professionally."
      keywords="job seeker guidelines, application tips, safe job search"
    />
    <div className="min-h-screen bg-background">
      <PageHeader title="Job Seeker Guidelines" />
      <main className="container mx-auto px-4 py-6 pb-24 md:pb-8 max-w-4xl">
        <div className="text-center mb-10">
          <Badge variant="secondary" className="mb-4">For Job Seekers</Badge>
          <h1 className="text-4xl font-bold mb-4">Job Seeker Guidelines</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Get the most from Workly India with these best practices for a safe and successful job search.
          </p>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-3 flex items-center"><User className="w-5 h-5 mr-2 text-primary" />Build a Strong Profile</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Use a real, professional photo</li>
              <li>• Fill in accurate work experience, skills, and education</li>
              <li>• Keep your resume updated</li>
              <li>• Add a clear headline that describes your role</li>
            </ul>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-3 flex items-center"><CheckCircle className="w-5 h-5 mr-2 text-primary" />Best Practices</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Tailor applications to each role</li>
              <li>• Respond to employer messages promptly</li>
              <li>• Be honest about your skills and experience</li>
              <li>• Communicate respectfully at all times</li>
            </ul>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-3 flex items-center"><ShieldAlert className="w-5 h-5 mr-2 text-destructive" />Stay Safe</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Never pay any fee to get a job</li>
              <li>• Do not share OTPs, bank details, or Aadhaar PIN</li>
              <li>• Verify company details independently</li>
              <li>• Report suspicious jobs immediately via Contact Us</li>
            </ul>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-3 flex items-center"><XCircle className="w-5 h-5 mr-2 text-destructive" />What to Avoid</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Creating fake profiles or duplicate accounts</li>
              <li>• Sharing false information or credentials</li>
              <li>• Spamming employers with irrelevant applications</li>
              <li>• Harassing or abusive language</li>
            </ul>
          </Card>
        </div>
      </main>
    </div>
  </>
);

export default JobSeekerGuidelines;
