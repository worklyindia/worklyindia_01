import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Lock, Eye, Database, Users, AlertCircle } from "lucide-react";
import { getUpdatedTimestamp } from "@/utils/timestampUtils";
import { useContactInfo } from "@/hooks/useContactInfo";
import SEO from "@/components/SEO";

const Privacy = () => {
  const lastUpdated = getUpdatedTimestamp('privacy');
  const { data: contactInfo } = useContactInfo('general');

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Privacy Policy"
        description="Workly India Privacy Policy - Learn how we collect, use, and protect your personal information. Your privacy matters to us. Read our comprehensive data protection policy."
        keywords="privacy policy, data protection, personal information, Workly India privacy, Workly India privacy"
        canonical="/privacy"
      />
      <PageHeader title="Privacy Policy" />
      
      <main className="container mx-auto px-4 py-6 pb-24 md:pb-8 max-w-4xl">
        {/* Header Section */}
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4">Privacy Policy</Badge>
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Your Privacy Matters
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            We are committed to protecting your privacy and ensuring the security of your personal information.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Last updated: {lastUpdated}
          </p>
        </div>

        {/* Privacy Principles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="p-4 bg-gradient-to-br from-blue-500/5 to-blue-600/5 border border-blue-200">
            <div className="flex items-center space-x-3">
              <Shield className="w-6 h-6 text-blue-600" />
              <div>
                <h3 className="font-semibold text-foreground">Data Protection</h3>
                <p className="text-xs text-muted-foreground">Your data is secure with us</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4 bg-gradient-to-br from-green-500/5 to-green-600/5 border border-green-200">
            <div className="flex items-center space-x-3">
              <Eye className="w-6 h-6 text-green-600" />
              <div>
                <h3 className="font-semibold text-foreground">Transparency</h3>
                <p className="text-xs text-muted-foreground">Clear about data usage</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4 bg-gradient-to-br from-purple-500/5 to-purple-600/5 border border-purple-200">
            <div className="flex items-center space-x-3">
              <Lock className="w-6 h-6 text-purple-600" />
              <div>
                <h3 className="font-semibold text-foreground">Control</h3>
                <p className="text-xs text-muted-foreground">You control your data</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Privacy Policy Content */}
        <div className="space-y-8">
          {/* Information Collection */}
          <Card className="p-6 bg-gradient-to-br from-white to-gray-50 border border-border/50">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center">
              <Database className="w-5 h-5 mr-2 text-primary" />
              1. Information We Collect
            </h2>
            <div className="prose prose-sm max-w-none text-muted-foreground space-y-3">
              <h3 className="text-foreground font-medium">Personal Information:</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Name, email address, and phone number</li>
                <li>Professional information (experience, skills, education)</li>
                <li>Resume and portfolio content</li>
                <li>Profile photos and documents</li>
              </ul>
              
              <h3 className="text-foreground font-medium mt-4">Usage Information:</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>How you interact with our platform</li>
                <li>Search queries and preferences</li>
                <li>Device information and IP address</li>
                <li>Cookies and similar tracking technologies</li>
              </ul>

              <h3 className="text-foreground font-medium mt-4">Device & Technical Information:</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>IP Address:</strong> Your first login IP, last login IP, and history of unique IPs used to access your account</li>
                <li><strong>Device Details:</strong> Device model, operating system, browser name & version, screen resolution, CPU cores, memory, and GPU information</li>
                <li><strong>Device Fingerprint:</strong> A unique SHA-256 hash generated from your device's canvas rendering and hardware characteristics for security purposes</li>
                <li><strong>Network Information:</strong> Internet Service Provider (ISP), connection type, VPN/proxy detection status</li>
                <li><strong>Behavioral Data:</strong> Session duration, touch/scroll distance, interaction patterns, and login frequency</li>
                <li><strong>Location Data:</strong> Approximate geographic location derived from your IP address (city, state, country, timezone)</li>
                <li><strong>Login Metadata:</strong> Login timestamps, login count, session activity tracking</li>
              </ul>
            </div>
          </Card>

          {/* Device Information Tracking */}
          <Card className="p-6 bg-gradient-to-br from-orange-500/5 to-orange-600/5 border border-orange-200/50">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center">
              <Shield className="w-5 h-5 mr-2 text-orange-600" />
              2. Device Information & Tracking
            </h2>
            <div className="prose prose-sm max-w-none text-muted-foreground space-y-3">
              <p>To ensure account security, prevent fraud, and improve our services, we collect and store the following device-level information:</p>
              
              <h3 className="text-foreground font-medium">IP Address Tracking:</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>We record your <strong>first login IP address</strong> and <strong>most recent login IP address</strong></li>
                <li>We maintain a history of all <strong>unique IP addresses</strong> used to access your account</li>
                <li>Total count of unique IPs is tracked to detect suspicious activity</li>
                <li>IP-based geolocation is used to determine approximate city, state, and country</li>
              </ul>

              <h3 className="text-foreground font-medium mt-4">Device Fingerprinting:</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>We generate a <strong>SHA-256 device fingerprint</strong> based on your browser's canvas rendering and hardware characteristics</li>
                <li>This fingerprint helps us identify devices and detect unauthorized account access</li>
                <li>Fingerprint data is stored as a one-way hash and cannot be reversed to identify personal information</li>
                <li>GPU renderer information and WebGL capabilities are collected as part of fingerprinting</li>
              </ul>

              <h3 className="text-foreground font-medium mt-4">Device & Browser Details:</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Operating system name and version</li>
                <li>Browser name and version</li>
                <li>Screen resolution and pixel density</li>
                <li>CPU core count and available device memory</li>
                <li>GPU/graphics hardware information</li>
                <li>Installed language preferences</li>
              </ul>

              <h3 className="text-foreground font-medium mt-4">Behavioral Analytics:</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Session duration and activity timestamps</li>
                <li>Touch/scroll distance and interaction patterns</li>
                <li>Login frequency and session counts</li>
                <li>Page navigation patterns within the platform</li>
              </ul>

              <h3 className="text-foreground font-medium mt-4">Network Information:</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Internet Service Provider (ISP) name</li>
                <li>Connection type (WiFi, mobile data, etc.)</li>
                <li>VPN and proxy detection for security purposes</li>
                <li>Network timezone information</li>
              </ul>

              <p className="mt-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
                <strong>Why we collect this:</strong> Device tracking helps us protect your account from unauthorized access, detect suspicious login attempts, prevent fraud, and comply with Indian IT Act requirements. This data is used solely for security and platform improvement purposes and is never sold to third parties.
              </p>
            </div>
          </Card>

          {/* How We Use Information */}
          <Card className="p-6 bg-gradient-to-br from-white to-gray-50 border border-border/50">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center">
              <Users className="w-5 h-5 mr-2 text-primary" />
              3. How We Use Your Information
            </h2>
            <div className="prose prose-sm max-w-none text-muted-foreground space-y-3">
              <ul className="list-disc pl-6 space-y-1">
                <li>To provide and improve our job matching services</li>
                <li>To communicate with you about opportunities and updates</li>
                <li>To verify your identity and prevent fraud</li>
                <li>To analyze platform usage and improve user experience</li>
                <li>To send you relevant job alerts and recommendations</li>
                <li>To detect unauthorized access using device fingerprinting and IP tracking</li>
                <li>To comply with legal obligations under Indian IT Act, 2000</li>
              </ul>
            </div>
          </Card>

          {/* Information Sharing */}
          <Card className="p-6 bg-gradient-to-br from-white to-gray-50 border border-border/50">
            <h2 className="text-xl font-semibold text-foreground mb-4">4. Information Sharing</h2>
            <div className="prose prose-sm max-w-none text-muted-foreground space-y-3">
              <h3 className="text-foreground font-medium">We share information with:</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Employers:</strong> When you apply for jobs or make your profile visible</li>
                <li><strong>Service Providers:</strong> Third parties who help us operate our platform</li>
                <li><strong>Legal Authorities:</strong> When required by law or to protect our rights</li>
              </ul>
              
              <h3 className="text-foreground font-medium mt-4">We do NOT sell your personal information to third parties.
                Our privacy practices comply with Indian IT Act, 2000 and applicable data protection regulations."</h3>
            </div>
          </Card>

          {/* Data Security */}
          <Card className="p-6 bg-gradient-to-br from-white to-gray-50 border border-border/50">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center">
              <Lock className="w-5 h-5 mr-2 text-primary" />
              5. Data Security
            </h2>
            <div className="prose prose-sm max-w-none text-muted-foreground space-y-3">
              <p>We implement appropriate security measures to protect your information:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Encryption of data in transit and at rest</li>
                <li>Regular security audits and assessments</li>
                <li>Access controls and authentication measures</li>
                <li>Secure servers and infrastructure</li>
                <li>Employee training on data protection</li>
              </ul>
            </div>
          </Card>

          {/* Your Rights */}
          <Card className="p-6 bg-gradient-to-br from-white to-gray-50 border border-border/50">
            <h2 className="text-xl font-semibold text-foreground mb-4">6. Your Privacy Rights</h2>
            <div className="prose prose-sm max-w-none text-muted-foreground space-y-3">
              <p>You have the right to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Access:</strong> Request a copy of your personal information</li>
                <li><strong>Correct:</strong> Update or correct inaccurate information</li>
                <li><strong>Delete:</strong> Request deletion of your personal information</li>
                <li><strong>Portability:</strong> Request your data in a portable format</li>
                <li><strong>Opt-out:</strong> Unsubscribe from marketing communications</li>
                <li><strong>Restrict:</strong> Limit how we process your information</li>
              </ul>
            </div>
          </Card>

          {/* Cookies & Google AdSense */}
          <Card className="p-6 bg-gradient-to-br from-white to-gray-50 border border-border/50">
            <h2 className="text-xl font-semibold text-foreground mb-4">7. Cookies, Tracking & Google Advertising</h2>
            <div className="prose prose-sm max-w-none text-muted-foreground space-y-3">
              <h3 className="text-foreground font-medium">Cookies We Use:</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Remember your preferences and settings</li>
                <li>Analyze how you use our platform</li>
                <li>Provide personalized content and recommendations</li>
                <li>Ensure platform security and prevent fraud</li>
              </ul>
              
              <h3 className="text-foreground font-medium mt-4">Google AdSense & Advertising Cookies:</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>We use Google AdSense to display advertisements on our website</li>
                <li>Google uses cookies to serve ads based on your visits to our site and other sites on the Internet</li>
                <li>These cookies enable Google and its partners to serve ads based on your visit to our site and/or other sites</li>
                <li>You may opt out of personalized advertising by visiting <a href="https://www.google.com/settings/ads" className="text-primary hover:underline" target="_blank" rel="noopener">Google Ads Settings</a></li>
                <li>You can also opt out of a third-party vendor's use of cookies by visiting the <a href="https://www.networkadvertising.org/managing/opt_out.asp" className="text-primary hover:underline" target="_blank" rel="noopener">Network Advertising Initiative opt-out page</a></li>
              </ul>
              
              <h3 className="text-foreground font-medium mt-4">Managing Cookies:</h3>
              <p>You can control cookie settings through your browser preferences. However, please note that disabling cookies may affect the functionality of our website and the relevance of advertisements displayed.</p>
              
              <p className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <strong>GDPR Compliance:</strong> By using our website, you consent to the use of cookies in accordance with this policy. If you do not agree to our use of cookies, you should set your browser settings accordingly or leave our website.
              </p>
            </div>
          </Card>

          {/* Developer Platform & APIs */}
          <Card className="p-6 bg-gradient-to-br from-white to-gray-50 border border-border/50">
            <h2 className="text-xl font-semibold text-foreground mb-4">Developer Platform & APIs</h2>
            <div className="prose prose-sm max-w-none text-muted-foreground space-y-3">
              <p>When you use our developer platform and APIs, we collect and process the following information:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Account data:</strong> your name, email, mobile number, company details and billing information, used to manage your developer account and payments.</li>
                <li><strong>Credentials:</strong> API keys and OAuth client secrets are stored securely. New secrets are shown to you only once, so please save them safely.</li>
                <li><strong>Usage logs:</strong> we record each API call (time, endpoint, status and quota used) to provide your usage history, prevent abuse and handle billing. These logs are private to your account.</li>
                <li><strong>Message data:</strong> email and WhatsApp content you send through our APIs is processed only to deliver the message and show delivery status.</li>
                <li><strong>Sign in with Workly India (OAuth):</strong> with the user's consent, we share only their user ID, email address and basic profile with your app. Phone numbers are never shared.</li>
                <li><strong>Your responsibility:</strong> as a developer you are responsible for handling any user data you receive lawfully and for publishing your own privacy policy.</li>
              </ul>
            </div>
          </Card>

          {/* Data Retention */}
          <Card className="p-6 bg-gradient-to-br from-white to-gray-50 border border-border/50">
            <h2 className="text-xl font-semibold text-foreground mb-4">8. Data Retention</h2>
            <div className="prose prose-sm max-w-none text-muted-foreground space-y-3">
              <ul className="list-disc pl-6 space-y-1">
                <li>We retain your information as long as your account is active</li>
                <li>Some information may be retained for legal or business purposes</li>
                <li>You can request deletion of your account and data at any time</li>
                <li>Anonymized data may be retained for analytics purposes</li>
              </ul>
            </div>
          </Card>

          {/* Third-Party Services */}
          <Card className="p-6 bg-gradient-to-br from-white to-gray-50 border border-border/50">
            <h2 className="text-xl font-semibold text-foreground mb-4">9. Third-Party Services</h2>
            <div className="prose prose-sm max-w-none text-muted-foreground space-y-3">
              <p>Our platform may integrate with third-party services such as:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Social media platforms for profile creation</li>
                <li>Payment processors for transactions</li>
                <li>Analytics services for platform improvement</li>
                <li>Communication tools for messaging</li>
              </ul>
              <p>These third parties have their own privacy policies, which we encourage you to review.</p>
            </div>
            <p>We do not store your payment card or banking information on our servers. All payments are processed securely through third-party payment gateways.</p>
          </Card>

          {/* ChatWork AI Assistant */}
          <Card className="p-6 bg-gradient-to-br from-white to-gray-50 border border-border/50">
            <h2 className="text-xl font-semibold text-foreground mb-4">10. ChatWork AI Assistant</h2>
            <div className="prose prose-sm max-w-none text-muted-foreground space-y-3">
              <p>
                Our platform offers an AI chat assistant known as <strong>ChatWork AI</strong>. When you sign in to
                ChatWork AI (with email, Google, LinkedIn or X) and use it, the following applies:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Your name, email and profile photo from the chosen sign-in provider are used to create your ChatWork AI account.</li>
                <li>Your chat messages, prompts, uploaded files, voice inputs and generated replies may be stored so your chat history, translations and preferences are available to you.</li>
                <li>Messages are processed by trusted third-party AI model providers solely to generate a response.</li>
                <li>If you connect a social account (for example YouTube, LinkedIn or X) to ChatWork AI, we store only the access tokens needed for the actions you request, and you can disconnect at any time.</li>
                <li>ChatWork AI answers are generated automatically and may be inaccurate — they are not legal, financial, medical or professional advice.</li>
                <li>Please do not share passwords, OTPs, bank details or other sensitive personal data in the chat.</li>
                <li>You may delete your chat history, or request deletion of your ChatWork AI data, by contacting us.</li>
              </ul>
            </div>
          </Card>



          {/* Contact Information */}
          <Card className="p-6 bg-gradient-to-r from-primary/5 to-secondary/5 border border-border/50">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-6 h-6 text-primary shrink-0 mt-1" />
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-4">11. Contact Us</h2>
                <div className="prose prose-sm max-w-none text-muted-foreground">
                  <p>
                    If you have any questions about this Privacy Policy or want to exercise your privacy rights, contact us at:
                  </p>
                  <ul className="list-none space-y-1 mt-2">
                    <li>
                      Email: <a href={`mailto:${contactInfo?.email || 'worklyindia@outlook.com'}`} className="text-blue-600 hover:text-blue-800 hover:underline">{contactInfo?.email || 'worklyindia@outlook.com'}</a>
                    </li>
                    <li>
                      Phone: <a href={`tel:${contactInfo?.phone || '+919904923067'}`} className="text-blue-600 hover:text-blue-800 hover:underline">{contactInfo?.phone || '+91 9904923067'}</a>
                    </li>
                    <li>Address: {contactInfo?.address || 'Workly India Vishalbhai Muljibhai Gohil, Sankhewsar, Patan, Gujarat, India - 384246'}</li>
                  </ul>
                  <p className="mt-3">
                    We will respond to your inquiries within 30 days.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </main>

    </div>
  );
};

export default Privacy;
