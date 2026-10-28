import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Scale, Shield, AlertCircle, Clock } from "lucide-react";
import { getUpdatedTimestamp } from "@/utils/timestampUtils";
import { useContactInfo } from "@/hooks/useContactInfo";
import { BRAND_CONFIG } from "@/config/brandConfig";

const TermsAndConditions = () => {
  const lastUpdated = getUpdatedTimestamp('terms');
  const { data: contactInfo } = useContactInfo('general');

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Terms & Conditions" />
      
      <main className="container mx-auto px-4 py-6 pb-24 md:pb-8 max-w-4xl">
        {/* Header Section */}
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4">Legal</Badge>
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Terms & Conditions
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Please read these Terms and Conditions carefully before using the {BRAND_CONFIG.name} platform.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Last updated: {lastUpdated}
          </p>
        </div>

        {/* Quick Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="p-4 bg-gradient-to-br from-blue-500/5 to-blue-600/5 border border-blue-200">
            <div className="flex items-center space-x-3">
              <FileText className="w-6 h-6 text-blue-600" />
              <div>
                <h3 className="font-semibold text-foreground">Usage Rights</h3>
                <p className="text-xs text-muted-foreground">To access and use our Services</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4 bg-gradient-to-br from-green-500/5 to-green-600/5 border border-green-200">
            <div className="flex items-center space-x-3">
              <Scale className="w-6 h-6 text-green-600" />
              <div>
                <h3 className="font-semibold text-foreground">Responsibilities</h3>
                <p className="text-xs text-muted-foreground">What we expect from users</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4 bg-gradient-to-br from-purple-500/5 to-purple-600/5 border border-purple-200">
            <div className="flex items-center space-x-3">
              <Shield className="w-6 h-6 text-purple-600" />
              <div>
                <h3 className="font-semibold text-foreground">Protection</h3>
                <p className="text-xs text-muted-foreground">How we protect all parties</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Introduction */}
        <Card className="p-6 bg-gradient-to-br from-white to-gray-50 border border-border/50 mb-8">
        <div className="prose prose-sm max-w-none text-muted-foreground space-y-4">
            <p>
              These Terms and Conditions, along with our Privacy Policy and other applicable policies ("Terms"), constitute a binding agreement between <strong>{BRAND_CONFIG.name} (Vishalbhai Muljibhai Gohil)</strong> ("Website Owner", "we", "us", or "our") and you ("you" or "your") regarding your use of our website, products, or services (collectively, the "Services").
            </p>
            <p>
              By using our website and availing of our Services, you acknowledge that you have read, understood, and agreed to these Terms (including the Privacy Policy).
            </p>
            <p>
              We reserve the right to update or modify these Terms at any time without prior notice. It is your responsibility to review these Terms periodically for any updates.
            </p>
          </div>
        </Card>

        {/* Terms Content */}
        <div className="space-y-6">
          <Card className="p-6 bg-gradient-to-br from-white to-gray-50 border border-border/50">
            <h3 className="text-lg font-semibold text-foreground mb-3">Usage Rights</h3>
            <div className="prose prose-sm max-w-none text-muted-foreground space-y-4">
              <p>
                To access and use our Services, you agree to provide accurate, complete, and up-to-date information during registration and thereafter. You are solely responsible for all activities conducted under your registered account.
              </p>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-white to-gray-50 border border-border/50">
            <h3 className="text-lg font-semibold text-foreground mb-3">Disclaimer</h3>
            <div className="prose prose-sm max-w-none text-muted-foreground space-y-4">
              <p>
                Neither we nor any third parties provide any warranty or guarantee regarding the accuracy, timeliness, performance, completeness, or suitability of the information and materials offered on this website or through the Services. Such information and materials may contain inaccuracies or errors, and we expressly exclude liability for any such inaccuracies or errors to the fullest extent permitted by law.
              </p>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-white to-gray-50 border border-border/50">
            <h3 className="text-lg font-semibold text-foreground mb-3">User Responsibility</h3>
            <div className="prose prose-sm max-w-none text-muted-foreground space-y-4">
              <p>
                Your use of our Services and the website is entirely at your own risk. You are responsible for ensuring that the Services meet your requirements before use.
              </p>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-white to-gray-50 border border-border/50">
            <h3 className="text-lg font-semibold text-foreground mb-3">Intellectual Property</h3>
            <div className="prose prose-sm max-w-none text-muted-foreground space-y-4">
              <p>
                The contents of the website and Services are the property of the Website Owner. You may not claim any intellectual property rights, title, or interest in such contents.
              </p>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-white to-gray-50 border border-border/50">
            <h3 className="text-lg font-semibold text-foreground mb-3">Prohibited Use</h3>
            <div className="prose prose-sm max-w-none text-muted-foreground space-y-4">
              <p>
                You agree not to use the website or Services for any unlawful, illegal, misleading, or prohibited purposes under these Terms, Indian laws, or local laws that may apply to you.
              </p>
              <p>
                <strong>Note:</strong> {BRAND_CONFIG.name} only provides a platform for employers to post job opportunities and for job seekers to apply. We do not guarantee employment, specific job offers, or any earnings.
              </p>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-white to-gray-50 border border-border/50">
            <h3 className="text-lg font-semibold text-foreground mb-3">Third-Party Links & Advertising</h3>
            <div className="prose prose-sm max-w-none text-muted-foreground space-y-4">
              <p>
                Our website and Services may contain links to third-party websites. Access to these sites is governed by their respective terms and privacy policies. We are not responsible for the content or practices of such third-party sites.
              </p>
              
              <h4 className="text-foreground font-medium mt-4">Google AdSense & Advertising:</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li>We use Google AdSense to display advertisements on our website</li>
                <li>Advertisements are provided by third-party advertising networks and we do not endorse any products or services advertised</li>
                <li>Google and its partners may use cookies and other tracking technologies to serve personalized ads</li>
                <li>We are not responsible for the content, accuracy, or practices of advertised products/services</li>
                <li>Click on advertisements at your own discretion and risk</li>
              </ul>
              
              <p className="mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <strong>Advertising Disclaimer:</strong> {BRAND_CONFIG.name} displays advertisements for revenue generation. We do not guarantee the quality, safety, or legitimacy of advertised products. Users should exercise their own judgment when interacting with advertisements.
              </p>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-white to-gray-50 border border-border/50">
            <h3 className="text-lg font-semibold text-foreground mb-3">Payments & Refunds</h3>
            <div className="prose prose-sm max-w-none text-muted-foreground space-y-4">
              <p>
                By initiating a payment for our Services, you agree that you are entering into a legally binding contract with us.
              </p>
              <p>
                 If we are unable to provide the agreed Service, you may request a refund promptly after the issue is identified. Refunds will be processed in accordance with our Refund & Cancellation Policy. Activated digital subscriptions and plans are generally non-refundable, except where a verified technical issue prevents activation or delivery.
                 Job seekers are not charged for standard job-seeking access. Paid ChatWork AI plans and employer services are shown with their price, billing period, applicable taxes, and limits before payment.
                
              </p>
            </div>
          </Card>

           <Card className="p-6 bg-gradient-to-br from-white to-gray-50 border border-border/50">
             <h3 className="text-lg font-semibold text-foreground mb-3">ChatWork AI Payments</h3>
             <div className="prose prose-sm max-w-none text-muted-foreground space-y-3">
               <p>ChatWork AI is an optional digital service. Plans are billed in Indian rupees through a secure third-party payment gateway. We do not store card, UPI, or bank credentials on our servers.</p>
               <p>Plan limits, features, billing period, and any applicable taxes are presented before checkout. Access may be paused or changed if a payment fails, a plan expires, or these Terms are breached.</p>
             </div>
           </Card>

          <Card className="p-6 bg-gradient-to-br from-white to-gray-50 border border-border/50">
            <h3 className="text-lg font-semibold text-foreground mb-3">Force Majeure</h3>
            <div className="prose prose-sm max-w-none text-muted-foreground space-y-4">
              <p>
                We shall not be liable for any failure or delay in performing our obligations due to events beyond our reasonable control (force majeure events).
              </p>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-white to-gray-50 border border-border/50">
            <h3 className="text-lg font-semibold text-foreground mb-3">Governing Law & Jurisdiction</h3>
            <div className="prose prose-sm max-w-none text-muted-foreground space-y-4">
              <p>
                These Terms shall be governed by and construed in accordance with the laws of India.
              </p>
              <p>
                All disputes arising in relation to these Terms shall be subject to the exclusive jurisdiction of the courts in Patan, Gujarat.
              </p>
            </div>
          </Card>

          {/* ChatWork AI Assistant */}
          <Card className="p-6 bg-gradient-to-br from-white to-gray-50 border border-border/50">
            <h3 className="text-lg font-semibold text-foreground mb-3">ChatWork AI Assistant</h3>
            <div className="prose prose-sm max-w-none text-muted-foreground space-y-3">
              <p>
                <strong>ChatWork AI</strong> is the AI chat assistant offered as part of the {BRAND_CONFIG.name} platform.
                By logging in to and using ChatWork AI you additionally agree that:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>An account is required. You may sign in with email, Google, LinkedIn or X, and you are responsible for all activity on your account.</li>
                <li>Responses are generated automatically by AI models and may be incomplete, outdated or incorrect. They are provided for general information only and are not legal, financial, medical, career-guarantee or other professional advice.</li>
                <li>You must verify any important information before acting on it. {BRAND_CONFIG.name} is not liable for any loss arising from reliance on AI-generated content.</li>
                <li>You may not use ChatWork AI for unlawful, abusive, hateful, fraudulent, spam, adult or misleading content, to impersonate others, or to attempt to bypass usage limits or security controls.</li>
                <li>Do not submit passwords, OTPs, banking data or other sensitive personal information into the chat.</li>
                <li>Free usage limits, paid plans and fair-use restrictions may apply and can change. All payments are processed via Razorpay in INR and follow our Refund & Cancellation policy.</li>
                <li>Where you connect a social account for AI features, you remain bound by that platform's own terms and are responsible for content published on your behalf.</li>
                <li>We may suspend or terminate ChatWork AI access for misuse or breach of these Terms.</li>
              </ul>
            </div>
          </Card>

          {/* Developer Platform & APIs */}
          <Card className="p-6 bg-gradient-to-br from-white to-gray-50 border border-border/50">
            <h2 className="text-xl font-semibold text-foreground mb-4">Developer Platform & APIs</h2>
            <div className="prose prose-sm max-w-none text-muted-foreground space-y-3">
              <p>If you use our developer platform, including the Jobs API, Email API, WhatsApp API, Chat Widget and Sign in with {BRAND_CONFIG.name} (OAuth), you also agree to the following:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>You must create a developer account and keep your API keys, OAuth client secrets and webhook secrets confidential. You are responsible for all activity carried out with your credentials.</li>
                <li>The Jobs API lets you display live {BRAND_CONFIG.name} job listings on your own website or app. You must show job details accurately and must not alter, misrepresent or resell them. Every Apply button must send candidates to {BRAND_CONFIG.name} to apply.</li>
                <li>The Email, WhatsApp and Chat Widget APIs may only be used to send lawful messages to recipients who have agreed to receive them. Spam, bulk unsolicited messages, phishing and misleading content are strictly prohibited. WhatsApp messages must also follow Meta's WhatsApp Business policies.</li>
                <li>Sign in with {BRAND_CONFIG.name} (OAuth) shares only the user's ID, email address and basic profile, and only after the user gives consent. You must use this data only for sign-in and must not sell or share it.</li>
                <li>API usage is subject to plan limits, quotas and fair-use rules. Calls that exceed your balance or rate limits may be rejected. Paid plans and call balances are charged in INR through Razorpay and follow our Refund & Cancellation Policy.</li>
                <li>Webhook endpoints must be secure (HTTPS) and verify our signature. Endpoints that fail continuously may be disabled automatically.</li>
                <li>You must not attempt to bypass limits, scrape data outside the API, reverse-engineer our services or harm the platform or its users.</li>
                <li>We may change, suspend or discontinue any API, and we may suspend or revoke developer access at any time for misuse or breach of these Terms.</li>
              </ul>
            </div>
          </Card>

{/* Refund Processing */}
          <Card className="p-6 bg-gradient-to-br from-white to-gray-50 border border-border/50">
  <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center">
    <Clock className="w-5 h-5 mr-2 text-primary" />
    Refund Processing Timeline
  </h2>
  <div className="prose prose-sm max-w-none text-muted-foreground space-y-4">
    <p>
      • Subscriptions purchased for job postings or related services on our platform are
      generally <strong>non-refundable</strong> once activated.
    </p>
    <p>
      • A refund will only be issued in cases where the service could not be activated or
      delivered due to a verified <strong>technical issue</strong> from our side.
    </p>
    <p>
      • Any approved refund will be processed within <strong>9–15 working days</strong> to
      the original payment method, depending on your bank or payment provider.
    </p>
    <p>
      • Refunds are applicable only as per our published Terms & Conditions.
    </p>
  </div>
</Card>
          {/* Contact Information */}
          <Card className="p-6 bg-gradient-to-r from-primary/5 to-secondary/5 border border-border/50">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-6 h-6 text-primary shrink-0 mt-1" />
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-4">Contact Information</h2>
                <div className="prose prose-sm max-w-none text-muted-foreground">
                  <p>
                    If you have any questions or concerns regarding these Terms, please contact us:
                  </p>
                  <ul className="list-none space-y-1 mt-2">
                    <li>Email: <a href={`mailto:${contactInfo?.email || BRAND_CONFIG.email}`} className="text-primary hover:underline">{contactInfo?.email || BRAND_CONFIG.email}</a></li>
                    <li>Phone: <a href={`tel:${contactInfo?.phone || BRAND_CONFIG.phone}`} className="text-primary hover:underline">{contactInfo?.phone || BRAND_CONFIG.phone}</a></li>
                    <li>Address: {contactInfo?.address || `${BRAND_CONFIG.name} Vishalbhai Muljibhai Gohil, Sankhewsar, Patan, Gujarat, India - 384246`}</li>
                  </ul>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </main>

    </div>
  );
};

export default TermsAndConditions;
