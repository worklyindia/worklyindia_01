import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Briefcase, CheckCircle, XCircle, AlertTriangle, Users, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import SEO from "@/components/SEO";

const JobPolicy = () => {
  const navigate = useNavigate();

  return (
    <>
      <SEO 
        title="Job Policy - Workly India Jobs"
        description="Comprehensive job posting policy, guidelines for employers and job seekers, quality standards, and platform rules for Workly India Jobs."
        keywords="job policy, posting guidelines, employer policy, job seeker policy, platform rules, Workly India jobs"
      />
      
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="bg-card border-b sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(-1)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Briefcase className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-foreground">Job Policy</h1>
                    <p className="text-xs text-muted-foreground">Platform guidelines & rules</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-8">
            
            {/* Introduction */}
            <Card className="p-6">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Briefcase className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-4">Job Posting & Platform Policy</h2>
                  <p className="text-muted-foreground text-lg leading-relaxed">
                    This policy outlines the guidelines, standards, and rules governing job postings, 
                    employer conduct, and job seeker interactions on the Workly India Jobs platform. 
                    All users must comply with these policies to maintain a safe and professional environment.
                  </p>
                  <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <p className="text-sm text-foreground font-medium">
                      <CheckCircle className="w-4 h-4 inline mr-2" />
                      Effective Date: January 1, 2024
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Job Posting Guidelines */}
            <Card className="p-6">
              <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center">
                <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
                Job Posting Guidelines
              </h3>
              <div className="space-y-6">
                <div className="pl-4 border-l-2 border-green-500/20">
                  <h4 className="font-medium text-foreground mb-2">Required Information</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Clear and accurate job title</li>
                    <li>• Detailed job description and responsibilities</li>
                    <li>• Required qualifications and skills</li>
                    <li>• Salary range or compensation details</li>
                    <li>• Company information and verification</li>
                    <li>• Work location or Workly India details</li>
                    <li>• Employment type (full-time, part-time, contract)</li>
                  </ul>
                </div>
                
                <div className="pl-4 border-l-2 border-green-500/20">
                  <h4 className="font-medium text-foreground mb-2">Quality Standards</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Professional language and tone</li>
                    <li>• No discriminatory content</li>
                    <li>• Realistic job requirements</li>
                    <li>• Accurate representation of the role</li>
                    <li>• Clear application process</li>
                    <li>• Valid contact information</li>
                  </ul>
                </div>

                <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <h4 className="font-medium text-foreground mb-2 text-green-800 dark:text-green-200">Verification Process</h4>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    All job postings undergo automated and manual review to ensure compliance with our quality standards. 
                    Employers with verified accounts receive priority placement and trust badges.
                  </p>
                </div>
              </div>
            </Card>

            {/* Prohibited Content */}
            <Card className="p-6">
              <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center">
                <XCircle className="w-5 h-5 mr-2 text-destructive" />
                Prohibited Job Postings
              </h3>
              <div className="space-y-6">
                <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4">
                  <h4 className="font-medium text-foreground mb-2 text-destructive">Strictly Prohibited</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• Jobs requiring upfront payments</li>
                      <li>• Pyramid or MLM schemes</li>
                      <li>• Adult content or services</li>
                      <li>• Illegal activities</li>
                      <li>• Discriminatory requirements</li>
                    </ul>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• Fake or non-existent positions</li>
                      <li>• Data harvesting schemes</li>
                      <li>• Remote-work scams</li>
                      <li>• Unrealistic salary promises</li>
                      <li>• Vague or misleading descriptions</li>
                    </ul>
                  </div>
                </div>
                
                <div className="pl-4 border-l-2 border-destructive/20">
                  <h4 className="font-medium text-foreground mb-2">Discriminatory Content</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Job postings must not discriminate based on:
                  </p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• Gender, age, or marital status</li>
                    <li>• Religion, caste, or ethnicity</li>
                    <li>• Physical appearance or disability</li>
                    <li>• Sexual orientation or gender identity</li>
                    <li>• Geographic origin or location preferences (unless job-relevant)</li>
                  </ul>
                </div>
              </div>
            </Card>

            {/* Employer Responsibilities */}
            <Card className="p-6">
              <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center">
                <Users className="w-5 h-5 mr-2 text-primary" />
                Employer Responsibilities
              </h3>
              <div className="space-y-4 text-muted-foreground">
                <div className="pl-4 border-l-2 border-primary/20">
                  <h4 className="font-medium text-foreground mb-2">Account Management</h4>
                  <ul className="space-y-2 text-sm">
                    <li>• Maintain accurate company profile and verification documents</li>
                    <li>• Update job postings regularly and remove filled positions</li>
                    <li>• Respond to candidate applications within reasonable time</li>
                    <li>• Provide professional communication throughout hiring process</li>
                  </ul>
                </div>
                
                <div className="pl-4 border-l-2 border-primary/20">
                  <h4 className="font-medium text-foreground mb-2">Candidate Interaction</h4>
                  <ul className="space-y-2 text-sm">
                    <li>• Treat all candidates with respect and professionalism</li>
                    <li>• Provide clear feedback and communication</li>
                    <li>• Honor salary and benefit commitments made during hiring</li>
                    <li>• Never request inappropriate personal information</li>
                  </ul>
                </div>

                <div className="pl-4 border-l-2 border-primary/20">
                  <h4 className="font-medium text-foreground mb-2">Legal Compliance</h4>
                  <ul className="space-y-2 text-sm">
                    <li>• Comply with all applicable labor laws</li>
                    <li>• Ensure proper employment documentation</li>
                    <li>• Maintain data privacy and protection standards</li>
                    <li>• Report any suspicious activities on the platform</li>
                  </ul>
                </div>
              </div>
            </Card>

            {/* Job Seeker Guidelines */}
            <Card className="p-6">
              <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center">
                <Shield className="w-5 h-5 mr-2 text-primary" />
                Job Seeker Guidelines
              </h3>
              <div className="space-y-4 text-muted-foreground">
                <div className="pl-4 border-l-2 border-primary/20">
                  <h4 className="font-medium text-foreground mb-2">Profile Management</h4>
                  <ul className="space-y-2 text-sm">
                    <li>• Maintain accurate and up-to-date profile information</li>
                    <li>• Upload genuine resume and portfolio documents</li>
                    <li>• Use professional profile pictures and descriptions</li>
                    <li>• Keep contact information current</li>
                  </ul>
                </div>
                
                <div className="pl-4 border-l-2 border-primary/20">
                  <h4 className="font-medium text-foreground mb-2">Application Process</h4>
                  <ul className="space-y-2 text-sm">
                    <li>• Apply only for relevant positions matching your skills</li>
                    <li>• Customize applications for each job</li>
                    <li>• Be honest about qualifications and experience</li>
                    <li>• Follow up professionally on applications</li>
                  </ul>
                </div>

                <div className="pl-4 border-l-2 border-primary/20">
                  <h4 className="font-medium text-foreground mb-2">Safety Guidelines</h4>
                  <ul className="space-y-2 text-sm">
                    <li>• Never pay money for job opportunities</li>
                    <li>• Verify employer credentials before interviews</li>
                    <li>• Report suspicious job postings or requests</li>
                    <li>• Protect personal and financial information</li>
                  </ul>
                </div>
              </div>
            </Card>

            {/* Violation and Enforcement */}
            <Card className="p-6">
              <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2 text-destructive" />
                Policy Violations & Enforcement
              </h3>
              <div className="space-y-4 text-muted-foreground">
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <h4 className="font-medium text-foreground mb-2 text-amber-800 dark:text-amber-200">Warning System</h4>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Minor violations may result in warnings and temporary restrictions. 
                    Repeated violations or serious breaches may lead to permanent account suspension.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-card border rounded-lg">
                    <h4 className="font-medium text-foreground mb-2">Minor Violations</h4>
                    <ul className="space-y-1 text-sm">
                      <li>• Incomplete job descriptions</li>
                      <li>• Minor formatting issues</li>
                      <li>• Delayed response to applications</li>
                      <li>• Outdated job postings</li>
                    </ul>
                    <p className="text-xs text-muted-foreground mt-2">
                      <strong>Action:</strong> Warning and request to correct
                    </p>
                  </div>
                  
                  <div className="p-4 bg-card border rounded-lg">
                    <h4 className="font-medium text-foreground mb-2">Serious Violations</h4>
                    <ul className="space-y-1 text-sm">
                      <li>• Fraudulent job postings</li>
                      <li>• Discriminatory content</li>
                      <li>• Requesting payments from candidates</li>
                      <li>• Harassment or inappropriate conduct</li>
                    </ul>
                    <p className="text-xs text-muted-foreground mt-2">
                      <strong>Action:</strong> Immediate suspension and investigation
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Appeal Process */}
            <Card className="p-6">
              <h3 className="text-xl font-semibold text-foreground mb-4">Appeal & Review Process</h3>
              <div className="space-y-4 text-muted-foreground">
                <div className="pl-4 border-l-2 border-primary/20">
                  <h4 className="font-medium text-foreground mb-2">Right to Appeal</h4>
                  <p className="text-sm mb-2">
                    Users have the right to appeal any policy enforcement action within 30 days of notification.
                  </p>
                  <ul className="space-y-1 text-sm">
                    <li>• Submit appeal through designated portal</li>
                    <li>• Provide supporting evidence and explanation</li>
                    <li>• Review completed within 5-7 business days</li>
                    <li>• Decision communicated via email</li>
                  </ul>
                </div>
                
                <div className="p-4 bg-primary/5 rounded-lg">
                  <h4 className="font-medium text-foreground mb-2">Appeal Contact</h4>
                  <p className="text-sm text-muted-foreground">Email: worklyindia@outlook.com</p>
                  <p className="text-sm text-muted-foreground">Subject: Policy Appeal - [Account ID]</p>
                </div>
              </div>
            </Card>

            {/* Policy Updates */}
            <Card className="p-6">
              <h3 className="text-xl font-semibold text-foreground mb-4">Policy Updates & Changes</h3>
              <div className="space-y-4 text-muted-foreground">
                <p className="text-sm leading-relaxed">
                  This job policy may be updated periodically to reflect changes in our platform, 
                  legal requirements, or industry best practices. Users will be notified of significant 
                  changes through email and platform notifications.
                </p>
                
                <div className="p-4 bg-primary/5 rounded-lg">
                  <h4 className="font-medium text-foreground mb-2">Stay Updated</h4>
                  <p className="text-sm">
                    Subscribe to our policy updates newsletter to receive notifications about 
                    important changes to our job posting guidelines and platform policies.
                  </p>
                </div>
              </div>
            </Card>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-6">
              <Button 
                onClick={() => navigate("/post-job")} 
                className="flex-1"
              >
                Post a Job
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate("/report-job-scam")}
                className="flex-1"
              >
                Report Violation
              </Button>
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default JobPolicy;