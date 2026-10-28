import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getUpdatedTimestamp } from "@/utils/timestampUtils";
import { 
  Phone, 
  Mail, 
  MapPin, 
  Clock, 
  Send,
  HeadphonesIcon,
  User,
  Building
} from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useContactInfo, useMerchantInfo } from "@/hooks/useSiteSettings";
import BrandSocialBar from "@/components/BrandSocialBar";
import SEO from "@/components/SEO";

const ContactUs = () => {
  const { data: contactInfo } = useContactInfo();
  const navigate = useNavigate();

  const supportEmail = contactInfo?.email?.trim() || "worklyindia@outlook.com";
  const supportPhone = contactInfo?.phone?.trim() || "+91 9904923067";
  const { data: merchantInfo } = useMerchantInfo();
  const DEFAULT_ADDRESS = "Sankhewsar, Patan, Gujarat, India 384246";
  const officeAddress = contactInfo?.office_address?.trim() || merchantInfo?.operational_address?.trim() || DEFAULT_ADDRESS;
  const legalName = merchantInfo?.legal_name?.trim() || "VISHALBHAI MULJIBHAI GOHIL";
  const merchantPhone = merchantInfo?.contact_number?.trim() || supportPhone;
  const merchantEmail = merchantInfo?.email?.trim() || supportEmail;
  const registeredAddress = merchantInfo?.registered_address?.trim() || officeAddress;
  const operationalAddress = merchantInfo?.operational_address?.trim() || officeAddress;
  const hoursWeekdays = contactInfo?.hours_weekdays?.trim() || "9:00 AM - 6:00 PM";
  const hoursSaturday = contactInfo?.hours_saturday?.trim() || "10:00 AM - 4:00 PM";
  const hoursSunday = contactInfo?.hours_sunday?.trim() || "Closed";
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    category: "",
    message: ""
  });

  // Hide Tidio widget on Contact Us page
  useEffect(() => {
    if (window.tidioChatApi) {
      window.tidioChatApi.hide();
    }
  }, []);

  const contactMethods = [
    {
      title: "Phone Support",
      description: "Speak with our support team",
      icon: Phone,
      value: supportPhone,
      action: "Call Now",
      available: contactInfo?.phone_hours?.trim() || "Mon-Fri, 9 AM - 6 PM"
    },
    {
      title: "Email Support", 
      description: "Send us your queries",
      icon: Mail,
      value: supportEmail,
      action: "Send Email",
      available: contactInfo?.email_response?.trim() || "24/7 Response"
    },
    {
      title: "Office Address",
      description: "Visit our office",
      icon: MapPin,
      value: officeAddress,
      action: "Get Directions",
      available: contactInfo?.office_note?.trim() || "By Appointment"
    }
  ];

  const supportCategories = [
    "General Inquiry",
    "Technical Support", 
    "Account Issues",
    "Billing & Payments",
    "Job Posting Help",
    "Partnership Opportunities",
    "Media & Press",
    "Feedback & Suggestions"
  ];

  const faqs = [
    {
      question: "How do I create an account?",
      answer: "You can create an account by clicking the 'Sign Up' button and filling out the registration form."
    },
    {
      question: "How can I post a job?",
      answer: "Navigate to the 'Post Job' section in your employer dashboard and follow the step-by-step guide."
    },
    {
      question: "Is Workly India free to use?",
      answer: "Job seekers can use most features for free. Employers have both free and premium posting options."
    },
    {
      question: "How do I update my profile?",
      answer: "Go to your profile settings and click 'Edit Profile' to make changes to your information."
    }
  ];

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Form submitted:", formData);
    // Handle form submission
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Contact Us"
        description={`Contact Workly India - Get in touch with our support team for job posting help, account issues, partnerships, and more. Phone: ${supportPhone}, Email: ${supportEmail}`}
        keywords="contact Workly India, support, help, customer service, Workly India support, job portal contact"
        canonical="/contact-us"
      />
      <PageHeader title="Contact Us" backTo="/" />
      
      <main className="container mx-auto px-4 py-6 pb-24 md:pb-8 max-w-6xl">
        {/* Header Section */}
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4">Support</Badge>
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Contact Us
          </h1>
          <p className="text-xs text-muted-foreground mb-4">
            Last updated on {getUpdatedTimestamp('contact-us')}
          </p>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            We're here to help! Reach out to us through any of the channels below 
            and we'll get back to you as soon as possible.
          </p>
        </div>

        {/* Merchant Information */}
        <Card className="p-6 mb-8 bg-gradient-to-br from-primary/5 to-secondary/5 border border-border/50">
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center">
            <Building className="w-5 h-5 mr-2 text-primary" />
            Merchant Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-foreground mb-2">Legal Entity Name</h3>
              <p className="text-sm text-muted-foreground">{legalName}</p>
            </div>
            <div>
              <h3 className="font-medium text-foreground mb-2">Contact Number</h3>
              <p className="text-sm text-muted-foreground">{merchantPhone}</p>
            </div>
            <div>
              <h3 className="font-medium text-foreground mb-2">Official Email</h3>
              <p className="text-sm text-muted-foreground">{merchantEmail}</p>
            </div>
            <div>
              <h3 className="font-medium text-foreground mb-2">Registered Address</h3>
              <p className="text-sm text-muted-foreground">
                {registeredAddress}
              </p>
            </div>
            <div>
              <h3 className="font-medium text-foreground mb-2">Operational Address</h3>
              <p className="text-sm text-muted-foreground">
                {operationalAddress}
              </p>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Contact Methods & Info - Mobile First */}
          <div className="lg:col-span-1 lg:order-2 space-y-6">
            {/* Contact Methods */}
            <Card className="p-6 bg-gradient-to-br from-primary/5 to-secondary/5 border border-border/50">
              <h3 className="font-semibold text-foreground mb-4 flex items-center">
                <HeadphonesIcon className="w-4 h-4 mr-2" />
                Get in Touch
              </h3>
              <div className="space-y-4">
                {contactMethods.map((method, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <method.icon className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-foreground">{method.title}</h4>
                        <p className="text-xs text-muted-foreground">{method.description}</p>
                      </div>
                    </div>
                    <div className="ml-11">
                      <p className="text-sm text-foreground">{method.value}</p>
                      <p className="text-xs text-muted-foreground">{method.available}</p>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-xs p-0 h-auto mt-1"
                         onClick={() => {
                          if (method.title === "Phone Support") {
                            window.open(`tel:${supportPhone.replace(/[^+\d]/g, "")}`, "_self");
                          } else if (method.title === "Email Support") {
                            window.open(`mailto:${supportEmail}`, "_self");
                          } else if (method.title === "Office Address") {
                            window.open(`https://maps.google.com/?q=${encodeURIComponent(officeAddress)}`, "_blank");
                          }
                        }}
                      >
                        {method.action}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Business Hours */}
            <Card className="p-6 bg-gradient-to-br from-white to-gray-50 border border-border/50">
              <h3 className="font-semibold text-foreground mb-4 flex items-center">
                <Clock className="w-4 h-4 mr-2" />
                Business Hours
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monday - Friday</span>
                  <span className="text-foreground">{hoursWeekdays}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Saturday</span>
                  <span className="text-foreground">{hoursSaturday}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sunday</span>
                  <span className="text-foreground">{hoursSunday}</span>
                </div>
              </div>
            </Card>

            {/* Quick FAQs */}
            <Card className="p-6 bg-gradient-to-br from-white to-gray-50 border border-border/50">
              <h3 className="font-semibold text-foreground mb-4">Quick FAQs</h3>
              <div className="space-y-3">
                {faqs.slice(0, 3).map((faq, index) => (
                  <div key={index}>
                    <h4 className="text-sm font-medium text-foreground mb-1">{faq.question}</h4>
                    <p className="text-xs text-muted-foreground">{faq.answer}</p>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => navigate("/faq")}>
                  View All FAQs
                </Button>
              </div>
            </Card>

            {/* Social Media - same as home page footer, no card box */}
            <div className="pt-2 pb-4">
              <BrandSocialBar title="Follow Us" />
            </div>
          </div>

        </div>

      </main>

    </div>
  );
};

export default ContactUs;
