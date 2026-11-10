import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import SEO from "@/components/SEO";
import { faqStructuredData, breadcrumbStructuredData } from "@/utils/structuredData";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFAQs } from "@/hooks/useFAQs";
import { Skeleton } from "@/components/ui/skeleton";
import { CANONICAL_URL } from '@/config/domainConfig';

const DEVELOPER_FAQS = [
  { id: "dev-0", question: "What is the Workly India developer platform?", answer: "It lets you connect your website or app to Workly India. You can show live Workly India jobs, send emails and WhatsApp messages, add a chat widget and let users sign in with Workly India, all from one developer account." },
  { id: "dev-1", question: "What does the Jobs API do?", answer: "The Jobs API lets you show live Workly India jobs on your own website or app with full job details. You can search by keyword, location and category. Every Apply button sends candidates to Workly India to apply." },
  { id: "dev-2", question: "Can I post jobs or manage hiring through the API?", answer: "No. The Jobs API is read-only and is used to display Workly India jobs. Jobs are posted and managed by employers from the Workly India employer portal." },
  { id: "dev-3", question: "How do I get an API key?", answer: "Create a developer account, complete onboarding and generate your API key from the Developer section. Each account has one active API key; delete the old key before creating a new one." },
  { id: "dev-4", question: "How does Sign in with Workly India work?", answer: "Register an OAuth app in the Developer section to get a client ID and secret. Users approve access on a consent screen, and your app receives only their user ID, email and basic profile. Phone numbers are never shared." },
  { id: "dev-5", question: "How are API calls charged?", answer: "Each plan includes a monthly number of API calls. Unused calls carry forward to the next month while your subscription is active. You can view every call in your API history and buy more calls when needed. Payments are made in INR via Razorpay." },
  { id: "dev-6", question: "What are webhooks?", answer: "Webhooks send real-time event updates to your server. We send a signed test request before saving your URL, and an endpoint that fails continuously for 24 hours is disabled automatically." },
  { id: "dev-7", question: "Where can I find the API documentation?", answer: "Full API documentation with examples is available on the Developers page. For help, contact our support team." },
];

const FAQ = () => {
  const [openFAQ, setOpenFAQ] = useState<number | string | null>(null);
  const { data: faqsData, isLoading } = useFAQs();

  // Group FAQs by category
  const groupedFAQs = useMemo(() => {
    if (!faqsData) return {};
    
    return faqsData.reduce((acc, faq) => {
      if (!acc[faq.category]) {
        acc[faq.category] = [];
      }
      acc[faq.category].push(faq);
      return acc;
    }, {} as Record<string, typeof faqsData>);
  }, [faqsData]);

  const categories = useMemo(() => {
    return Object.keys(groupedFAQs).sort();
  }, [groupedFAQs]);


  const breadcrumbs = [
    { name: "Home", url: `${CANONICAL_URL}/` },
    { name: "FAQ", url: `${CANONICAL_URL}/faq` }
  ];

  const toggleFAQ = (index: number | string) => {
    setOpenFAQ(openFAQ === index ? null : index);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="FAQ" />
        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="text-center mb-12">
            <Skeleton className="h-12 w-3/4 mx-auto mb-4" />
            <Skeleton className="h-6 w-2/3 mx-auto" />
          </div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  // Use database FAQs if available, otherwise fallback to empty array
  const displayFAQs = [...(faqsData || []), ...DEVELOPER_FAQS];

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Frequently Asked Questions - Workly India | Remote Jobs FAQ"
        description="Get answers to common questions about Workly India's remote job platform. Learn about job applications, verification process, requirements, and how to find legitimate Workly India in India."
        keywords="Workly India FAQ, remote jobs questions, remote jobs help, online jobs support, Remote platform guide"
        canonical="/faq"
        structured={[faqStructuredData(displayFAQs), breadcrumbStructuredData(breadcrumbs)]}
      />
      <PageHeader title="FAQ" />
      
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Frequently Asked Questions
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Find answers to common questions about Workly India's remote job platform
          </p>
        </div>

        {/* FAQ Categories */}
        <div className="mb-8">
          {/* Payments & Refunds Section */}
          {groupedFAQs["Payments & Refunds"] && groupedFAQs["Payments & Refunds"].length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-6">
                Payments & Refunds
              </h2>
              <div className="space-y-4">
                {groupedFAQs["Payments & Refunds"].map((faq) => (
                  <Card key={faq.id} className="border border-border">
                    <CardHeader 
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => toggleFAQ(faq.id)}
                    >
                      <CardTitle className="flex justify-between items-center text-lg">
                        <span>{faq.question}</span>
                        {openFAQ === faq.id ? (
                          <ChevronUp className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        )}
                      </CardTitle>
                    </CardHeader>
                    {openFAQ === faq.id && (
                      <CardContent className="pt-0">
                        <p className="text-muted-foreground leading-relaxed">
                          {faq.answer}{" "}
                          {faq.question.toLowerCase().includes("refund") && (
                            <Link to="/refund-policy" className="text-primary hover:underline">
                              View our complete Refund Policy
                            </Link>
                          )}
                        </p>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Other Categories */}
          {categories.filter(cat => cat !== "Payments & Refunds").map((category) => (
            <div key={category} className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-6">
                {category}
              </h2>
              <div className="space-y-4">
                {groupedFAQs[category].map((faq) => (
                  <Card key={faq.id} className="border border-border">
                    <CardHeader 
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => toggleFAQ(faq.id)}
                    >
                      <CardTitle className="flex justify-between items-center text-lg">
                        <span>{faq.question}</span>
                        {openFAQ === faq.id ? (
                          <ChevronUp className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        )}
                      </CardTitle>
                    </CardHeader>
                    {openFAQ === faq.id && (
                      <CardContent className="pt-0">
                        <p className="text-muted-foreground leading-relaxed">
                          {faq.answer}
                        </p>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          ))}
          {/* Developer Section */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-6">Developers & APIs</h2>
            <div className="space-y-4">
              {DEVELOPER_FAQS.map((faq) => (
                <Card key={faq.id} className="border border-border">
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => toggleFAQ(faq.id)}>
                    <CardTitle className="flex justify-between items-center text-lg">
                      <span>{faq.question}</span>
                      {openFAQ === faq.id ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                    </CardTitle>
                  </CardHeader>
                  {openFAQ === faq.id && (
                    <CardContent className="pt-0">
                      <p className="text-muted-foreground leading-relaxed">{faq.answer}</p>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          </div>
        </div>

        {/* Contact Section */}
        <div className="bg-muted/50 rounded-lg p-6 text-center">
          <h3 className="text-xl font-semibold text-foreground mb-3">
            Still have questions?
          </h3>
          <p className="text-muted-foreground mb-4">
            Can't find the answer you're looking for? Our support team is here to help.
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            Support Hours: Monday–Saturday, 10 AM – 6 PM IST
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              to="/contact-us" 
              className="bg-primary text-primary-foreground px-6 py-2 rounded-lg hover:bg-primary/90 transition-colors"
            >
              Contact Support
            </Link>
            <Link 
              to="/help-center" 
              className="border border-border px-6 py-2 rounded-lg hover:bg-muted transition-colors"
            >
              Help Center
            </Link>
          </div>
        </div>

        {/* Compliance Links */}
        <div className="mt-8 text-center">
          <p className="text-xs text-muted-foreground">
            For more details, please read our{" "}
            <Link to="/terms-and-conditions" className="text-primary hover:underline">
              Terms & Conditions
            </Link>{" "}
            and{" "}
            <Link to="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </main>
      
    </div>
  );
};

export default FAQ;
