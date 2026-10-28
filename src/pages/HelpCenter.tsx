import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  MessageSquare, 
  Phone, 
  Mail
} from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useContactInfo } from "@/hooks/useContactInfo";
import SEO from "@/components/SEO";
import { CANONICAL_URL } from "@/config/domainConfig";

const HelpCenter = () => {
  const navigate = useNavigate();
  const { data: contactInfo } = useContactInfo('support');
  
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : CANONICAL_URL;

  // Keep Tidio widget hidden on Help Center page
  useEffect(() => {
    if (window.tidioChatApi) {
      window.tidioChatApi.hide();
    }
  }, []);

  const contactOptions = [
    {
      type: "Live Chat",
      description: "Get instant help from our support team",
      availability: "Available 24/7",
      icon: MessageSquare,
      action: "Start Chat"
    },
    {
      type: "Phone Support",
      description: "Speak directly with our support agents",
      availability: "Mon-Fri, 9 AM - 6 PM",
      icon: Phone,
      action: "Call Now"
    },
    {
      type: "Email Support",
      description: "Send us your questions via email",
      availability: "Response within 24 hours",
      icon: Mail,
      action: "Send Email"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
      <SEO 
        title="Help Center - Workly India Jobs"
        description="Get help with Workly India job portal. Contact support for account management, job applications, payments, privacy, and technical issues."
        keywords="help center, support, job portal help, customer support, technical support"
        canonical="/help-center"
      />
      <PageHeader title="Help Center" />
      
      <main className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 pb-24 md:pb-8 max-w-7xl">
        <h2 className="text-xl font-semibold text-foreground mb-6">Contact Our Support Team</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {contactOptions.map((option, index) => (
            <Card key={index} className="p-6 text-center hover:shadow-soft hover:scale-105 transition-all duration-300 group">
              <div className="space-y-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto group-hover:bg-primary/20 transition-colors">
                  <option.icon className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{option.type}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
                  <p className="text-xs text-muted-foreground mt-2">{option.availability}</p>
                </div>
                <Button 
                  className="w-full rounded-xl hover:scale-105 transition-transform"
                  onClick={() => {
                    if (option.type === "Phone Support") {
                      const phone = contactInfo?.phone || "+919904923067";
                      window.open(`tel:${phone}`, "_self");
                    } else if (option.type === "Email Support") {
                      const email = contactInfo?.email || "worklyindia@outlook.com";
                      window.open(`mailto:${email}`, "_self");
                    } else if (option.type === "Live Chat") {
                      navigate('/ai-assistant');
                    }
                  }}
                >
                  {option.action}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
};

export default HelpCenter;
