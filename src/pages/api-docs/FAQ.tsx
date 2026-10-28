import CopyPageButton from "@/components/docs/CopyPageButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, HelpCircle, Shield, CreditCard, Code, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

const FAQ = () => {
  const navigate = useNavigate();

  const faqSections = [
    {
      title: "Getting Started",
      icon: HelpCircle,
      faqs: [
        {
          question: "How do I get my first API key?",
          answer: "Go to API Documentation page, click 'Generate API Key', enter a name for your key, select a tier (Free or Pro), and click Generate. Your key will be copied to clipboard automatically. Save it securely - you won't see it again!"
        },
        {
          question: "Which SDK should I use for my project?",
          answer: "Choose based on your tech stack: JavaScript/TypeScript for web apps, Python for backend services, cURL for testing, or Postman for API exploration. All SDKs support the same features."
        },
        {
          question: "How long does it take to integrate?",
          answer: "Basic integration takes 5-10 minutes. Follow our Quick Start guide to make your first API call. Complex integrations with webhooks and full features typically take 1-2 hours."
        },
        {
          question: "Is there a sandbox environment?",
          answer: "Yes! Your Free tier API key provides 100 requests/day perfect for testing. All test data is isolated and won't affect production systems."
        },
        {
          question: "Can I test without a credit card?",
          answer: "Absolutely! The Free tier doesn't require any payment method. Get started with 100 requests/day immediately after generating your API key."
        }
      ]
    },
    {
      title: "Authentication",
      icon: Shield,
      faqs: [
        {
          question: "Where do I put my API key?",
          answer: "Include your API key in the request headers as 'X-Api-Key: your-api-key'. Never put it in URL parameters or request body for security reasons."
        },
        {
          question: "Why am I getting 401 Unauthorized?",
          answer: "Common causes: 1) Missing API key header, 2) Invalid API key format, 3) Revoked or deleted key, 4) Wrong header name (use 'X-Api-Key' not 'Authorization'). Check your key in the API Documentation page."
        },
        {
          question: "How do I rotate my API keys?",
          answer: "Only one API key row is allowed per user. Delete your existing key before generating its replacement, then update your server configuration and test it. Plan for a brief interruption; overlapping keys are not supported."
        },
        {
          question: "Can I use multiple API keys?",
          answer: "No. Each Workly user can have one API key row. Delete the existing key before creating another. This developer key accesses only that user's connected accounts; Meta access tokens remain separate per connection."
        },
        {
          question: "What's the difference between API key and Auth token?",
          answer: "API keys authenticate your application and control rate limits. Auth tokens (if required) authenticate specific user actions. API key is always required in the X-Api-Key header."
        }
      ]
    },
    {
      title: "Rate Limiting",
      icon: Zap,
      faqs: [
        {
          question: "What happens when I hit the rate limit?",
          answer: "You'll receive a 429 Too Many Requests response with a 'Retry-After' header indicating wait time. Implement exponential backoff and retry logic to handle this gracefully."
        },
        {
          question: "How do I check my remaining requests?",
          answer: "Check response headers: 'X-RateLimit-Limit' (total allowed), 'X-RateLimit-Remaining' (requests left), 'X-RateLimit-Reset' (reset timestamp). Monitor these in your application."
        },
        {
          question: "Can I upgrade mid-month?",
          answer: "Yes! Upgrade anytime in API Documentation. Your rate limit increases immediately. Billing is prorated based on when you upgrade."
        },
        {
          question: "Do webhooks count toward rate limits?",
          answer: "No! Incoming webhooks don't count. Only your outgoing API requests count toward rate limits. Set up webhooks to reduce API calls."
        },
        {
          question: "How do I handle 429 errors?",
          answer: "Implement exponential backoff: wait 1s, then 2s, 4s, 8s between retries. Use the Retry-After header value. Cache responses when possible. Consider upgrading if you consistently hit limits."
        }
      ]
    },
    {
      title: "Billing & Plans",
      icon: CreditCard,
      faqs: [
        {
          question: "How much does the Pro plan cost?",
          answer: "Pro plan costs ₹999/month with 10,000 requests/day. Free tier provides 100 requests/day at no cost. Enterprise plans available for higher volumes - contact sales."
        },
        {
          question: "Can I cancel anytime?",
          answer: "Yes! Cancel anytime from API Documentation. Your Pro access continues until the end of your billing period. No cancellation fees."
        },
        {
          question: "Do unused requests roll over?",
          answer: "Unused developer API calls carry forward during monthly refresh. Additional free monthly calls are added only for active subscribers. Check your current call balance and subscription in Developer Portal."
        },
        {
          question: "What payment methods are accepted?",
          answer: "We accept credit cards, debit cards, UPI, and net banking through Razorpay. All transactions are secure and encrypted."
        },
        {
          question: "Is there a refund policy?",
          answer: "Yes! Full refund within 7 days if you're not satisfied. Partial refunds available for unused months on annual plans. See our Refund Policy for details."
        }
      ]
    },
    {
      title: "Technical",
      icon: Code,
      faqs: [
        {
          question: "Why is my request failing?",
          answer: "Check: 1) API key header is correct, 2) Request body format matches documentation, 3) All required parameters included, 4) URL endpoint is correct, 5) Content-Type is application/json. Use cURL examples to test."
        },
        {
          question: "How do I debug API errors?",
          answer: "All errors return: status code, error message, error code, and request_id. Use request_id when contacting support. Check API Health Monitor for service status. Review error codes in documentation."
        },
        {
          question: "Can I test webhooks locally?",
          answer: "Yes! Use ngrok or similar tools to create a public URL for your local server. Configure the webhook URL in API settings. Test with tools like webhook.site first."
        },
        {
          question: "What's the request timeout?",
          answer: "Default timeout is 30 seconds. Most requests complete in <2 seconds. If you hit timeouts, reduce request size, optimize queries, or contact support for assistance."
        },
        {
          question: "Do you support CORS?",
          answer: "CORS support does not make exposing a private API key safe. Keep your wfh_ key on your server, and have browser or mobile applications call your own authenticated server. Never paste real credentials into AI chats or public documentation."
        }
      ]
    },
    {
      title: "Security",
      icon: Shield,
      faqs: [
        {
          question: "How do I secure my API keys?",
          answer: "Never expose keys in frontend code, mobile apps, AI chats or public repositories. Use server environment variables and monitor usage. Only one key is supported per user; delete it before generating a replacement."
        },
        {
          question: "Are requests encrypted?",
          answer: "Yes! All API requests use HTTPS/TLS encryption. Data in transit is protected with industry-standard encryption. Your data is also encrypted at rest."
        },
        {
          question: "How do I verify webhook signatures?",
          answer: "Each webhook includes an X-Webhook-Signature header. Verify using HMAC SHA256 with your webhook secret. Sample code available in documentation."
        },
        {
          question: "Can I whitelist IPs?",
          answer: "IP whitelisting is available on Enterprise plans. Contact sales for custom security requirements. Pro plans support API key restrictions."
        },
        {
          question: "Is there 2FA for API keys?",
          answer: "API key management requires your account login with 2FA (if enabled). Consider enabling 2FA in your account settings for enhanced security."
        }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50 p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => navigate('/owner-portal/api-docs')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to API Documentation
          </Button>
            <CopyPageButton title="API FAQ" />
          </div>
          
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <HelpCircle className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Frequently Asked Questions</h1>
              <p className="text-muted-foreground mt-1">Find answers to common questions about our API</p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-foreground mb-1">50+</div>
              <div className="text-sm text-muted-foreground">Questions Answered</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-foreground mb-1">&lt;5 min</div>
              <div className="text-sm text-muted-foreground">Average Response Time</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-foreground mb-1">24/7</div>
              <div className="text-sm text-muted-foreground">Documentation Access</div>
            </CardContent>
          </Card>
        </div>

        {/* FAQ Sections */}
        <div className="space-y-6">
          {faqSections.map((section, sectionIdx) => (
            <Card key={sectionIdx}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <section.icon className="h-5 w-5 text-primary" />
                  {section.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {section.faqs.map((faq, faqIdx) => (
                    <AccordionItem key={faqIdx} value={`${sectionIdx}-${faqIdx}`}>
                      <AccordionTrigger className="text-left hover:text-primary">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Still Need Help */}
        <Card className="mt-8 bg-gradient-to-br from-primary/10 via-purple-50 to-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="text-center">
              <h3 className="text-xl font-bold text-foreground mb-2">Still need help?</h3>
              <p className="text-muted-foreground mb-4">
                Can't find what you're looking for? Our support team is here to help.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={() => navigate('/contact-us')}>
                  Contact Support
                </Button>
                <Button variant="outline" onClick={() => navigate('/api-docs/troubleshooting')}>
                  View Troubleshooting Guide
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FAQ;
