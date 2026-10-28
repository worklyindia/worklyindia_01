import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Info, Shield, FileText, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import SEO from "@/components/SEO";
import { getUpdatedTimestamp } from "@/utils/timestampUtils";
import { useContactInfo } from "@/hooks/useContactInfo";

const Disclaimer = () => {
  const navigate = useNavigate();
  const lastUpdated = getUpdatedTimestamp('disclaimer');
  const { data: legalContact } = useContactInfo('legal');
  const { data: generalContact } = useContactInfo('general');

  return (
    <>
      <SEO 
        title="Website Disclaimer - Workly India Jobs"
        description="Important disclaimer about the use of Workly India Jobs platform, limitations of liability, and terms governing the use of our services."
        keywords="disclaimer, liability, terms of use, platform disclaimer, job portal disclaimer, Workly India"
      />
      
      <div className="min-h-screen bg-background">
        <PageHeader title="Disclaimer" />
        
        <main className="container mx-auto px-4 py-6 pb-24 md:pb-8 max-w-4xl">
          {/* Header Section */}
          <div className="text-center mb-12">
            <Badge variant="secondary" className="mb-4">Legal</Badge>
            <h1 className="text-4xl font-bold text-foreground mb-4">
              Website Disclaimer
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              This disclaimer governs your use of Workly India Jobs platform. By accessing and using this website, 
              you acknowledge that you have read, understood, and agree to be bound by the terms of this disclaimer.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Last updated: {lastUpdated}
            </p>
          </div>

          <div className="space-y-8">
            {/* Platform Disclaimer */}
            <Card className="p-6">
              <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center">
                <Info className="w-5 h-5 mr-2 text-primary" />
                Platform & Service Disclaimer
              </h3>
              <div className="space-y-4 text-muted-foreground">
                <div className="pl-4 border-l-2 border-primary/20">
                  <h4 className="font-medium text-foreground mb-2">Information Accuracy</h4>
                  <ul className="space-y-2 text-sm">
                    <li>• Job listings are provided by third-party employers and recruiters</li>
                    <li>• We do not guarantee the accuracy, completeness, or reliability of job information</li>
                    <li>• Company details and job descriptions are provided by the posting entities</li>
                    <li>• We make reasonable efforts to verify information but cannot guarantee its accuracy</li>
                  </ul>
                </div>
                
                <div className="pl-4 border-l-2 border-primary/20">
                  <h4 className="font-medium text-foreground mb-2">Service Availability</h4>
                  <ul className="space-y-2 text-sm">
                    <li>• Services are provided on an "as is" and "as available" basis</li>
                    <li>• We do not guarantee uninterrupted or error-free service</li>
                    <li>• Technical issues, maintenance, or updates may cause temporary unavailability</li>
                    <li>• We reserve the right to modify or discontinue services without notice</li>
                  </ul>
                </div>
              </div>
            </Card>

            {/* Employment Disclaimer */}
            <Card className="p-6">
              <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center">
                <Shield className="w-5 h-5 mr-2 text-primary" />
                Employment & Job Placement
              </h3>
              <div className="space-y-4 text-muted-foreground">
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <h4 className="font-medium text-foreground mb-2 text-amber-800 dark:text-amber-200">Important Notice</h4>
                  <ul className="space-y-2 text-sm text-amber-700 dark:text-amber-300">
                    <li>• Workly India Jobs is a job portal platform, not an employment agency</li>
                    <li>• We do not guarantee job placement or employment opportunities</li>
                    <li>• We are not responsible for hiring decisions made by employers</li>
                    <li>• Employment relationships are solely between job seekers and employers</li>
                  </ul>
                </div>
                
                <div className="pl-4 border-l-2 border-primary/20">
                  <h4 className="font-medium text-foreground mb-2">Employer Verification</h4>
                  <ul className="space-y-2 text-sm">
                    <li>• While we implement verification processes, we cannot guarantee all employers are legitimate</li>
                    <li>• Users should conduct their own due diligence before applying or sharing personal information</li>
                    <li>• We encourage reporting of suspicious or fraudulent job postings</li>
                    <li>• Always verify employer credentials independently</li>
                  </ul>
                </div>
              </div>
            </Card>

            {/* Financial Disclaimer */}
            <Card className="p-6">
              <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2 text-destructive" />
                Financial & Payment Disclaimer
              </h3>
              <div className="space-y-4 text-muted-foreground">
                <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4">
                  <h4 className="font-medium text-foreground mb-2 text-destructive">Payment Warning</h4>
                  <ul className="space-y-2 text-sm">
                    <li>• Legitimate employers never ask for upfront payments</li>
                    <li>• We are not responsible for any payments made to third parties</li>
                    <li>• Never share financial information with unverified employers</li>
                    <li>• Report any requests for payment as potential scams</li>
                  </ul>
                </div>
                
                <div className="pl-4 border-l-2 border-primary/20">
                  <h4 className="font-medium text-foreground mb-2">Payment & Transaction Disclaimer</h4>
                  <ul className="space-y-2 text-sm">
                    <li>• All payments are processed securely and directly via Razorpay in INR</li>
                    <li>• Paid services are subject to separate terms and conditions</li>
                    <li>• All transactions are processed through RBI-approved payment gateways</li>
                    <li>• Refunds, where applicable, follow our Refund & Cancellation policy</li>
                    <li>• Users are responsible for maintaining account security</li>
                  </ul>
                </div>
              </div>
            </Card>

            {/* Content Disclaimer */}
            <Card className="p-6">
              <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-primary" />
                Content & User-Generated Content
              </h3>
              <div className="space-y-4 text-muted-foreground">
                <div className="pl-4 border-l-2 border-primary/20">
                  <h4 className="font-medium text-foreground mb-2">User-Generated Content</h4>
                  <ul className="space-y-2 text-sm">
                    <li>• Users are responsible for the content they post, including resumes and profiles</li>
                    <li>• We do not endorse or verify user-generated content</li>
                    <li>• We reserve the right to remove inappropriate or violating content</li>
                    <li>• Users grant us license to use posted content for platform operations</li>
                    <li>We do not store your payment card or banking information on our servers.</li>
                  </ul>
                </div>
                
                <div className="pl-4 border-l-2 border-primary/20">
                  <h4 className="font-medium text-foreground mb-2">Third-Party Content</h4>
                  <ul className="space-y-2 text-sm">
                    <li>• Job descriptions and company information are provided by third parties</li>
                    <li>• We do not control or endorse third-party content</li>
                    <li>• External links lead to independent websites not under our control</li>
                    <li>• We are not responsible for the content or practices of linked websites</li>
                  </ul>
                </div>
              </div>
            </Card>

            {/* Limitation of Liability */}
            <Card className="p-6">
              <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center">
                <Shield className="w-5 h-5 mr-2 text-primary" />
                Limitation of Liability
              </h3>
              <div className="space-y-4 text-muted-foreground">
                <div className="bg-slate-50 dark:bg-slate-950/50 border rounded-lg p-4">
                  <h4 className="font-medium text-foreground mb-2">Exclusion of Damages</h4>
                  <p className="text-sm leading-relaxed">
                    To the maximum extent permitted by law, Workly India Jobs shall not be liable for any direct, 
                    indirect, incidental, special, consequential, or punitive damages, including but not limited to:
                  </p>
                  <ul className="space-y-1 text-sm mt-2">
                    <li>• Loss of profits, revenue, or business opportunities</li>
                    <li>• Data loss or corruption</li>
                    <li>• Personal or professional damages</li>
                    <li>• Third-party claims or actions</li>
                    <li>• Fraudulent activities by employers or users</li>
                  </ul>
                </div>
                
                <div className="pl-4 border-l-2 border-primary/20">
                  <h4 className="font-medium text-foreground mb-2">Maximum Liability</h4>
                  <p className="text-sm">
                    Our total liability for any claims arising out of or relating to this platform 
                    shall not exceed the amount paid by you for services in the 12 months preceding the claim.
                  </p>
                </div>
              </div>
            </Card>

            {/* Indemnification */}
            <Card className="p-6">
              <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center">
                <ExternalLink className="w-5 h-5 mr-2 text-primary" />
                User Indemnification
              </h3>
              <div className="space-y-4 text-muted-foreground">
                <div className="pl-4 border-l-2 border-primary/20">
                  <h4 className="font-medium text-foreground mb-2">User Responsibility</h4>
                  <p className="text-sm leading-relaxed mb-2">
                    You agree to indemnify, defend, and hold harmless Workly India Jobs, its officers, 
                    directors, employees, and agents from and against any claims, liabilities, damages, 
                    losses, costs, or expenses arising out of or relating to:
                  </p>
                  <ul className="space-y-1 text-sm">
                    <li>• Your use of the platform</li>
                    <li>• Your violation of these terms</li>
                    <li>• Your violation of any third-party rights</li>
                    <li>• Content you post or transmit</li>
                    <li>• Your interactions with other users or employers</li>
                  </ul>
                </div>
              </div>
            </Card>

            {/* ChatWork AI Disclaimer */}
            <Card className="p-6">
              <h3 className="text-xl font-semibold text-foreground mb-4">ChatWork AI Assistant Disclaimer</h3>
              <div className="space-y-4 text-muted-foreground">
                <p className="text-sm leading-relaxed">
                  <strong>ChatWork AI</strong> is an automated AI chat assistant. Its answers, resumes, cover letters,
                  translations, job suggestions and other outputs are generated by AI models and may be inaccurate,
                  incomplete or outdated.
                </p>
                <ul className="list-disc pl-6 space-y-1 text-sm">
                  <li>AI output is general information only — not legal, financial, medical, tax or professional advice.</li>
                  <li>We do not guarantee a job, interview, salary or any specific outcome from using ChatWork AI.</li>
                  <li>Always verify important details independently before acting on an AI response.</li>
                  <li>Never share passwords, OTPs, bank details or other sensitive information in the chat.</li>
                  <li>AI features may be unavailable, rate-limited or changed at any time without notice.</li>
                </ul>
              </div>
            </Card>

            {/* Governing Law */}
            <Card className="p-6">
              <h3 className="text-xl font-semibold text-foreground mb-4">Governing Law & Jurisdiction</h3>
              <div className="space-y-4 text-muted-foreground">
                <div className="p-4 bg-primary/5 rounded-lg">
                  <p className="text-sm leading-relaxed">
                    This disclaimer and your use of the platform are governed by the laws of India. 
                    Any disputes arising out of or relating to this platform shall be subject to the 
                    exclusive jurisdiction of the courts in Mumbai, Maharashtra, India.
                  </p>
                </div>
              </div>
            </Card>

            {/* Contact Information */}
            <Card className="p-6">
              <h3 className="text-xl font-semibold text-foreground mb-4">Questions About This Disclaimer</h3>
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  If you have any questions about this disclaimer or need clarification on any terms, 
                  please contact us:
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-primary/5 rounded-lg">
                    <h4 className="font-medium text-foreground mb-2">Legal Department</h4>
                    <p className="text-sm text-muted-foreground">Email: <a href={`mailto:${legalContact?.email || 'worklyindia@outlook.com'}`} className="text-primary hover:underline">{legalContact?.email || 'worklyindia@outlook.com'}</a></p>
                    <p className="text-sm text-muted-foreground">Phone: <a href={`tel:${legalContact?.phone || '+919904923067'}`} className="text-primary hover:underline">{legalContact?.phone || '+91 9904923067'}</a></p>
                    <p className="text-sm text-muted-foreground">Address: {legalContact?.address || 'Workly India (Vishalbhai Muljibhai Gohil), Sankhewsar, Patan, Gujarat, PIN: 384246'}</p>
                  </div>
                  
                  <div className="p-4 bg-primary/5 rounded-lg">
                    <h4 className="font-medium text-foreground mb-2">General Support</h4>
                    <p className="text-sm text-muted-foreground">Email: <a href={`mailto:${generalContact?.email || 'worklyindia@outlook.com'}`} className="text-primary hover:underline">{generalContact?.email || 'worklyindia@outlook.com'}</a></p>
                    <p className="text-sm text-muted-foreground">Phone: <a href={`tel:${generalContact?.phone || '+919904923067'}`} className="text-primary hover:underline">{generalContact?.phone || '+91 9904923067'}</a></p>
                    <p className="text-sm text-muted-foreground">Address: {generalContact?.address || 'Workly India (Vishalbhai Muljibhai Gohil), Sankhewsar, Patan, Gujarat, PIN: 384246'}</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-6">
              <Button 
                onClick={() => navigate("/terms-conditions")} 
                className="flex-1"
              >
                View Terms & Conditions
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate("/privacy")}
                className="flex-1"
              >
                Privacy Policy
              </Button>
            </div>
          </div>
        </main>
      </div>
      
    </>
  );
};

export default Disclaimer;
