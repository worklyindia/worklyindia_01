import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, HelpCircle } from "lucide-react";

interface SDKGuideProps {
  sdkName: string;
  language: string;
}

export const SDKGuide = ({ sdkName, language }: SDKGuideProps) => {
  const getFAQs = () => {
    const commonFAQs = [
      {
        question: "How do I handle rate limiting?",
        answer: "Check the X-RateLimit-Remaining header in responses. When you get a 429 status code, wait for the time specified in the Retry-After header before making more requests."
      },
      {
        question: "How do I authenticate my requests?",
        answer: "Include your API key in the X-Api-Key header for all requests. Never expose your API key in client-side code."
      },
      {
        question: "What's the difference between Free and Pro tiers?",
        answer: "Free tier allows 100 requests/day with 1 API key. Pro tier provides 10,000 requests/day with 2 API keys and priority support."
      },
      {
        question: "What's the difference between wallet-based and API key endpoints?",
        answer: "Paid actions (job posting, boosting, extension and interviews) are paid via Razorpay in the employer portal. Jobs created through the API are saved as drafts until payment is completed."
      },
      {
        question: "How do boost packages work?",
        answer: "Boost packages increase your job's visibility. Package 1 is Standard (100 points/week), Package 2 is Premium (200 points/week), and Package 3 is Featured (300 points/week). The boost_level parameter (1-3) determines visibility priority."
      },
      {
        question: "What happens if I don't have enough wallet points?",
        answer: "If your wallet balance is insufficient, you'll receive a 402 Payment Required error. You'll need to add more points to your wallet before you can boost or extend jobs."
      }
    ];

    if (language === 'javascript') {
      return [
        ...commonFAQs,
        {
          question: "Should I use fetch or axios?",
          answer: "Both work well. Fetch is built-in to modern browsers, while axios provides more features like automatic request/response transformation and better error handling."
        },
        {
          question: "How do I handle CORS issues?",
          answer: "Our API supports CORS for browser requests. Ensure your domain is whitelisted in your API key settings if you encounter CORS errors."
        },
        {
          question: "Can I use this in React/Vue/Angular?",
          answer: "Yes! The JavaScript SDK works with all modern frameworks. You can wrap API calls in React hooks, Vue composables, or Angular services."
        }
      ];
    } else if (language === 'python') {
      return [
        ...commonFAQs,
        {
          question: "Should I use requests or aiohttp?",
          answer: "Use requests for simple synchronous applications. Use aiohttp for async/await support and better performance in concurrent scenarios."
        },
        {
          question: "How do I handle pagination efficiently?",
          answer: "Use a generator function to yield results page by page. This prevents loading all data into memory at once."
        },
        {
          question: "Can I use this with Django/Flask?",
          answer: "Absolutely! You can integrate the API in Django views, Flask routes, or FastAPI endpoints. Store your API key in environment variables."
        }
      ];
    } else if (language === 'curl') {
      return [
        ...commonFAQs,
        {
          question: "How do I save the response to a file?",
          answer: "Use the -o flag: curl -o response.json 'URL' -H 'X-Api-Key: your-key'"
        },
        {
          question: "How do I make POST requests with JSON?",
          answer: "Use -X POST -H 'Content-Type: application/json' -d '{\"key\":\"value\"}'"
        },
        {
          question: "Can I use cURL in production?",
          answer: "cURL is great for testing and debugging. For production, use a proper SDK or HTTP library in your programming language."
        }
      ];
    }

    return commonFAQs;
  };

  const getGettingStarted = () => {
    if (language === 'javascript') {
      return [
        { title: "Prerequisites", items: ["Node.js 14+ or modern browser", "Basic JavaScript/TypeScript knowledge", "Your API key"] },
        { title: "Installation", items: ["No installation needed for fetch", "For axios: npm install axios", "For TypeScript: npm install @types/node -D"] },
        { title: "First Steps", items: ["Set up API configuration", "Make your first GET request", "Handle the response", "Implement error handling"] }
      ];
    } else if (language === 'python') {
      return [
        { title: "Prerequisites", items: ["Python 3.7 or higher", "pip package manager", "Your API key"] },
        { title: "Installation", items: ["pip install requests", "For async: pip install aiohttp", "For type hints: pip install types-requests"] },
        { title: "First Steps", items: ["Import requests library", "Set up headers with API key", "Make your first request", "Parse JSON response"] }
      ];
    } else if (language === 'curl') {
      return [
        { title: "Prerequisites", items: ["cURL installed (included in most Unix systems)", "Your API key", "Basic terminal knowledge"] },
        { title: "Setup", items: ["Open terminal/command prompt", "Set API key as environment variable", "Test connection with simple GET"] },
        { title: "First Steps", items: ["Make a simple GET request", "Add headers for authentication", "Test POST with JSON data", "Save responses to files"] }
      ];
    }

    return [];
  };

  const getBestPractices = () => {
    const common = [
      "Store API keys in environment variables, never in code",
      "Implement exponential backoff for retries",
      "Monitor your rate limit usage",
      "Cache responses when appropriate",
      "Log errors for debugging"
    ];

    if (language === 'javascript') {
      return [
        ...common,
        "Use async/await for cleaner code",
        "Implement request timeouts",
        "Handle network errors gracefully",
        "Use TypeScript for better type safety"
      ];
    } else if (language === 'python') {
      return [
        ...common,
        "Use context managers with requests.Session()",
        "Implement connection pooling for multiple requests",
        "Use async for concurrent operations",
        "Type hint your functions for clarity"
      ];
    } else if (language === 'curl') {
      return [
        ...common,
        "Use -v flag for debugging",
        "Store common headers in files",
        "Use variables for repeated values",
        "Pipe responses to jq for formatting"
      ];
    }

    return common;
  };

  const getCommonPitfalls = () => {
    if (language === 'javascript') {
      return [
        { issue: "Not handling promise rejections", solution: "Always use try/catch with async/await or .catch() with promises" },
        { issue: "Exposing API keys in client-side code", solution: "Use a backend proxy to make API calls with your key" },
        { issue: "Not checking response.ok before parsing JSON", solution: "Check response.ok or response.status before calling response.json()" }
      ];
    } else if (language === 'python') {
      return [
        { issue: "Not using raise_for_status()", solution: "Call response.raise_for_status() to automatically handle HTTP errors" },
        { issue: "Making synchronous requests in async contexts", solution: "Use aiohttp for async/await compatibility" },
        { issue: "Not closing sessions", solution: "Use context managers: with requests.Session() as session:" }
      ];
    } else if (language === 'curl') {
      return [
        { issue: "Incorrect JSON escaping in shell", solution: "Use single quotes around JSON data or escape double quotes properly" },
        { issue: "Not handling special characters in URLs", solution: "URL encode parameters or use --data-urlencode" },
        { issue: "Missing Content-Type header for POST", solution: "Always include -H 'Content-Type: application/json' for JSON data" }
      ];
    }

    return [];
  };

  const faqs = getFAQs();
  const gettingStarted = getGettingStarted();
  const bestPractices = getBestPractices();
  const commonPitfalls = getCommonPitfalls();

  return (
    <div className="space-y-6">
      {/* Getting Started */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Getting Started Guide
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {gettingStarted.map((section, index) => (
              <div key={index}>
                <h4 className="font-semibold text-foreground mb-2">{section.title}</h4>
                <ul className="space-y-1">
                  {section.items.map((item, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground flex items-start">
                      <CheckCircle className="w-4 h-4 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Best Practices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Badge variant="secondary" className="mr-2">Pro Tips</Badge>
            Best Practices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {bestPractices.map((practice, index) => (
              <li key={index} className="text-sm text-muted-foreground flex items-start">
                <CheckCircle className="w-4 h-4 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
                {practice}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Common Pitfalls */}
      {commonPitfalls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-600" />
              Common Pitfalls & Solutions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {commonPitfalls.map((pitfall, index) => (
                <div key={index} className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="font-semibold text-orange-900 text-sm mb-1">❌ {pitfall.issue}</p>
                  <p className="text-sm text-orange-700">✅ {pitfall.solution}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* FAQ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-purple-600" />
            Frequently Asked Questions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`faq-${index}`}>
                <AccordionTrigger className="text-sm font-medium text-foreground hover:text-primary">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
};
