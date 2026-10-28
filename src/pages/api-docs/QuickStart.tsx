import CopyPageButton from "@/components/docs/CopyPageButton";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Zap, Code, CheckCircle, Copy, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const QuickStart = () => {
  const navigate = useNavigate();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success('Copied to clipboard!');
  };

  const steps = [
    {
      number: 1,
      title: "Generate Your API Key",
      description: "Get started in seconds with your first API key",
      time: "1 minute",
      actions: [
        "Navigate to API Documentation page",
        "Click 'Generate API Key' button",
        "Enter a name (e.g., 'My First App')",
        "Select 'Free' tier for testing",
        "Click Generate - key is auto-copied!"
      ]
    },
    {
      number: 2,
      title: "Choose Your Language",
      description: "We support JavaScript, Python, cURL, and more",
      time: "30 seconds",
      actions: [
        "Pick your preferred programming language",
        "Review the SDK documentation",
        "Install required dependencies (if any)",
        "Copy the base URL and example code"
      ]
    },
    {
      number: 3,
      title: "Make Your First API Call",
      description: "Test with a simple job search request",
      time: "2 minutes",
      actions: [
        "Copy the example code below",
        "Replace 'your-api-key' with your key",
        "Run the code in your environment",
        "See the JSON response with job data"
      ]
    },
    {
      number: 4,
      title: "Handle the Response",
      description: "Process and display the data in your app",
      time: "1 minute",
      actions: [
        "Parse the JSON response",
        "Extract job listings from data.jobs",
        "Display job titles, companies, locations",
        "Add pagination using page parameter"
      ]
    },
    {
      number: 5,
      title: "Test with Live Data",
      description: "Try different endpoints and parameters",
      time: "1 minute",
      actions: [
        "Use API Playground for interactive testing",
        "Test job creation (requires employer account)",
        "Try company listing endpoint",
        "Explore application submission"
      ]
    }
  ];

  const codeExamples = {
    javascript: {
      name: "JavaScript",
      code: `// Step 1: Set up your configuration
const API_KEY = 'your-api-key';
const BASE_URL = 'https://jubwzelupbntbetpajqb.supabase.co/functions/v1';

// Step 2: Make your first API call
async function searchJobs() {
  const params = new URLSearchParams({
    search_query: 'developer',
    location: 'mumbai',
    page: '1',
    limit: '10'
  });
  
  try {
    const response = await fetch(\`\${BASE_URL}/jobs-search?\${params}\`, {
      headers: {
        'X-Api-Key': API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    // Step 3: Process the response
    if (data.success) {
      console.log('Total jobs found:', data.data.pagination.total);
      data.data.jobs.forEach(job => {
        console.log(\`\${job.title} at \${job.companies?.company_name}\`);
      });
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run it!
searchJobs();`
    },
    python: {
      name: "Python",
      code: `# Step 1: Install requests library
# pip install requests

import requests

# Step 2: Set up your configuration
API_KEY = 'your-api-key'
BASE_URL = 'https://jubwzelupbntbetpajqb.supabase.co/functions/v1'

headers = {
    'X-Api-Key': API_KEY,
    'Content-Type': 'application/json'
}

# Step 3: Make your first API call
def search_jobs():
    params = {
        'search_query': 'developer',
        'location': 'mumbai',
        'page': 1,
        'limit': 10
    }
    
    try:
        response = requests.get(
            f'{BASE_URL}/jobs-search',
            headers=headers,
            params=params
        )
        
        data = response.json()
        
        # Step 4: Process the response
        if data.get('success'):
            print(f"Total jobs found: {data['data']['pagination']['total']}")
            for job in data['data']['jobs']:
                company = job.get('companies', {}).get('company_name', 'Unknown')
                print(f"{job['title']} at {company}")
    except Exception as e:
        print(f'Error: {e}')

# Run it!
search_jobs()`
    },
    curl: {
      name: "cURL",
      code: `# Step 1: Open your terminal

# Step 2: Make your first API call
curl -X GET "https://jubwzelupbntbetpajqb.supabase.co/functions/v1/jobs-search?search_query=developer&location=mumbai&page=1&limit=10" \\
  -H "X-Api-Key: your-api-key" \\
  -H "Content-Type: application/json"

# Step 3: Pretty print the response (optional)
curl -X GET "https://jubwzelupbntbetpajqb.supabase.co/functions/v1/jobs-search?search_query=developer&location=mumbai&page=1&limit=10" \\
  -H "X-Api-Key: your-api-key" \\
  -H "Content-Type: application/json" | jq

# That's it! You should see JSON response with job listings`
    }
  };

  const commonProjects = [
    {
      title: "Job Search Widget",
      description: "Add a job search box to your website",
      difficulty: "Easy",
      time: "15 minutes",
      features: ["Search by keyword", "Location filter", "Display results", "Pagination"]
    },
    {
      title: "Application Portal",
      description: "Let users apply for jobs through your platform",
      difficulty: "Medium",
      time: "30 minutes",
      features: ["Job listing", "Application form", "Resume upload", "Status tracking"]
    },
    {
      title: "Company Directory",
      description: "Display all hiring companies with details",
      difficulty: "Easy",
      time: "20 minutes",
      features: ["Company list", "Verification badges", "Active jobs count", "Filter by industry"]
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
            <CopyPageButton title="API Quick Start" />
          </div>
          
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Zap className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Quick Start Guide</h1>
              <p className="text-muted-foreground mt-1">Make your first API call in under 5 minutes</p>
            </div>
          </div>
        </div>

        {/* Progress Timeline */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>5-Minute Integration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {steps.map((step, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      {step.number}
                    </div>
                    {idx < steps.length - 1 && (
                      <div className="w-0.5 h-full bg-border my-2" />
                    )}
                  </div>
                  <div className="flex-1 pb-8">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-foreground">{step.title}</h3>
                      <Badge variant="secondary">{step.time}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{step.description}</p>
                    <ul className="space-y-1">
                      {step.actions.map((action, actionIdx) => (
                        <li key={actionIdx} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span className="text-muted-foreground">{action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Code Examples */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              Interactive Code Examples
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="javascript">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                <TabsTrigger value="python">Python</TabsTrigger>
                <TabsTrigger value="curl">cURL</TabsTrigger>
              </TabsList>
              
              {Object.entries(codeExamples).map(([key, example]) => (
                <TabsContent key={key} value={key} className="mt-4">
                  <div className="relative">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute top-2 right-2 z-10"
                      onClick={() => copyToClipboard(example.code, key)}
                    >
                      {copiedId === key ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <pre className="bg-slate-900 text-slate-50 p-4 rounded-lg overflow-x-auto">
                      <code>{example.code}</code>
                    </pre>
                  </div>
                </TabsContent>
              ))}
            </Tabs>

            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900">
                <strong>💡 Pro Tip:</strong> Replace <code>your-api-key</code> with the key you generated in Step 1.
                The project ID <code>jubwzelupbntbetpajqb</code> is already configured in the examples above.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Common First Projects */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Common First Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              {commonProjects.map((project, idx) => (
                <Card key={idx} className="border-2 hover:border-primary transition-colors">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-foreground">{project.title}</h3>
                      <Badge variant={project.difficulty === 'Easy' ? 'secondary' : 'default'}>
                        {project.difficulty}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{project.description}</p>
                    <div className="text-sm text-muted-foreground mb-3">⏱️ {project.time}</div>
                    <ul className="space-y-1">
                      {project.features.map((feature, featureIdx) => (
                        <li key={featureIdx} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Next Steps */}
        <Card className="bg-gradient-to-br from-primary/10 via-purple-50 to-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <h3 className="text-xl font-bold text-foreground mb-4">🎉 You're Ready!</h3>
            <p className="text-muted-foreground mb-6">
              Now that you've made your first API call, explore more advanced features:
            </p>
            <div className="grid md:grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => navigate('/developers/whatsapp-docs')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View WhatsApp API Docs
              </Button>
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => navigate('/api-docs/examples')}
              >
                <Code className="h-4 w-4 mr-2" />
                Explore Code Examples
              </Button>
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => navigate('/owner-portal/api-docs')}
              >
                <Zap className="h-4 w-4 mr-2" />
                Try API Playground
              </Button>
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => navigate('/api-docs/production-guide')}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Production Deployment Guide
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default QuickStart;
