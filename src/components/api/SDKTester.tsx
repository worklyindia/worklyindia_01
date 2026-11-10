import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { APIDebugger } from "./APIDebugger";
import { 
  Play, 
  Code, 
  CheckCircle, 
  XCircle, 
  Loader2,
  Copy,
  Terminal,
  Key
} from "lucide-react";

export const SDKTester = () => {
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState('');
  const [endpoint, setEndpoint] = useState('jobs-search');
  const [method, setMethod] = useState('GET');
  const [requestBody, setRequestBody] = useState('');
  const [queryParams, setQueryParams] = useState('search_query=developer&location=mumbai');
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [responseTime, setResponseTime] = useState<number | null>(null);

  const endpoints = {
    'jobs-latest': { method: 'GET', path: '/functions/v1/jobs-latest', description: 'Get latest jobs with filters' },
    'jobs-detail': { method: 'GET', path: '/functions/v1/jobs-detail', description: 'Get job details by ID' },
    'jobs-list': { method: 'GET', path: '/functions/v1/jobs-list', description: 'List jobs with pagination' },
    'jobs-multiple': { method: 'POST', path: '/functions/v1/jobs-multiple', description: 'Get multiple jobs by IDs' },
    'jobs-boost-wallet': { method: 'POST', path: '/functions/v1/jobs-boost-wallet', description: 'Boost job with wallet points' },
    'jobs-boost': { method: 'POST', path: '/functions/v1/jobs-boost', description: 'Boost job (API Key method)' },
    'jobs-extend': { method: 'POST', path: '/functions/v1/jobs-extend', description: 'Extend job duration (API Key)' },
    'applications-submit': { method: 'POST', path: '/functions/v1/applications-submit', description: 'Submit job application' }
  };

  const validateApiKey = () => {
    if (!apiKey || apiKey.trim() === '') {
      toast.error('Please enter your API key', {
        description: 'Get your API key from the API Documentation page'
      });
      return false;
    }
    if (!apiKey.startsWith('wfh_')) {
      toast.warning('API key format issue', {
        description: 'API keys should start with "wfh_". Double-check your key.'
      });
    }
    return true;
  };

  const testEndpoint = async () => {
    if (!validateApiKey()) {
      return;
    }

    // Check for dummy job_id in applications-submit
    if (endpoint === 'applications-submit' && requestBody) {
      try {
        const body = JSON.parse(requestBody);
        if (body.job_id === '00000000-0000-0000-0000-000000000000') {
          toast.error('Cannot test with example job_id', {
            description: 'Please create a real job first and use its job_id',
            duration: 5000
          });
          return;
        }
      } catch (e) {
        // If JSON parse fails, let it proceed and fail later with proper error
      }
    }

    setLoading(true);
    setResponse(null);
    setResponseTime(null);

    const startTime = performance.now();

    try {
      const selectedEndpoint = endpoints[endpoint as keyof typeof endpoints];
      const url = `https://jubwzelupbntbetpajqb.supabase.co${selectedEndpoint.path}${queryParams ? `?${queryParams}` : ''}`;
      
      const options: RequestInit = {
        method: selectedEndpoint.method,
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        }
      };

      if (selectedEndpoint.method === 'POST' && requestBody) {
        try {
          options.body = JSON.stringify(JSON.parse(requestBody));
        } catch (e) {
          toast.error('Invalid JSON in request body');
          setLoading(false);
          return;
        }
      }

      const res = await fetch(url, options);
      const endTime = performance.now();
      setResponseTime(Math.round(endTime - startTime));

      const data = await res.json();
      
      setResponse({
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries(res.headers.entries()),
        data: data,
        requestDetails: {
          url,
          method: selectedEndpoint.method,
          timestamp: new Date().toISOString()
        }
      });

      if (res.ok) {
        toast.success(`Request successful (${res.status})`);
      } else {
        const errorData = data;
        let errorDescription = errorData.message || errorData.error || res.statusText;
        
        // Add helpful hints based on status code
        if (res.status === 401) {
          errorDescription = `${errorDescription}\n\n💡 Tip: Check if your API key is active and valid in the API Documentation page.`;
        } else if (res.status === 429) {
          errorDescription = `${errorDescription}\n\n💡 Tip: You've exceeded your rate limit. Wait a bit or upgrade your plan.`;
        }
        
        toast.error(`Request failed (${res.status})`, {
          description: errorDescription,
          duration: 6000
        });
      }
    } catch (error: any) {
      const endTime = performance.now();
      setResponseTime(Math.round(endTime - startTime));
      
      setResponse({
        status: 0,
        statusText: 'Network Error',
        error: error.message,
        errorDetails: {
          name: error.name,
          message: error.message,
          stack: error.stack?.split('\n').slice(0, 3).join('\n'),
          timestamp: new Date().toISOString()
        }
      });
      toast.error('Request failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied to clipboard!');
  };

  const generateCurlCommand = () => {
    const selectedEndpoint = endpoints[endpoint as keyof typeof endpoints];
    const url = `https://jubwzelupbntbetpajqb.supabase.co${selectedEndpoint.path}${queryParams ? `?${queryParams}` : ''}`;
    
    let curl = `curl -X ${selectedEndpoint.method} "${url}" \\\n`;
    curl += `  -H "x-api-key: YOUR_API_KEY" \\\n`;
    curl += `  -H "Content-Type: application/json"`;
    
    if (selectedEndpoint.method === 'POST' && requestBody) {
      curl += ` \\\n  -d '${requestBody}'`;
    }
    
    return curl;
  };

  const generateJavaScriptCode = () => {
    const selectedEndpoint = endpoints[endpoint as keyof typeof endpoints];
    const url = `https://jubwzelupbntbetpajqb.supabase.co${selectedEndpoint.path}${queryParams ? `?${queryParams}` : ''}`;
    
    let code = `const response = await fetch('${url}', {\n`;
    code += `  method: '${selectedEndpoint.method}',\n`;
    code += `  headers: {\n`;
    code += `    'x-api-key': 'YOUR_API_KEY',\n`;
    code += `    'Content-Type': 'application/json'\n`;
    code += `  }`;
    
    if (selectedEndpoint.method === 'POST' && requestBody) {
      code += `,\n  body: JSON.stringify(${requestBody})`;
    }
    
    code += `\n});\n\nconst data = await response.json();\nconsole.log(data);`;
    
    return code;
  };

  const generatePythonCode = () => {
    const selectedEndpoint = endpoints[endpoint as keyof typeof endpoints];
    const url = `https://jubwzelupbntbetpajqb.supabase.co${selectedEndpoint.path}${queryParams ? `?${queryParams}` : ''}`;
    
    let code = `import requests\n\n`;
    code += `url = "${url}"\n`;
    code += `headers = {\n`;
    code += `    "x-api-key": "YOUR_API_KEY",\n`;
    code += `    "Content-Type": "application/json"\n`;
    code += `}\n\n`;
    
    if (selectedEndpoint.method === 'POST' && requestBody) {
      code += `data = ${requestBody}\n\n`;
      code += `response = requests.${selectedEndpoint.method.toLowerCase()}(url, headers=headers, json=data)\n`;
    } else {
      code += `response = requests.${selectedEndpoint.method.toLowerCase()}(url, headers=headers)\n`;
    }
    
    code += `print(response.json())`;
    
    return code;
  };

  return (
    <div className="space-y-6">
      {/* API Debugger */}
      <APIDebugger apiKey={apiKey} />
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="w-5 h-5" />
            SDK Test Console
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* API Key Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="api-key">API Key</Label>
              <Button
                variant="link"
                size="sm"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="gap-1 h-auto p-0"
              >
                <Key className="h-3 w-3" />
                Get API Key
              </Button>
            </div>
            <Input
              id="api-key"
              type="password"
              placeholder="wfh_..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {apiKey && !apiKey.startsWith('wfh_') && (
                <span className="text-orange-500">⚠️ API keys should start with "wfh_"</span>
              )}
              {!apiKey && "Enter your API key to test endpoints"}
            </p>
          </div>

          {/* Endpoint Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="endpoint">Endpoint</Label>
              <Select value={endpoint} onValueChange={setEndpoint}>
                <SelectTrigger id="endpoint">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(endpoints).map(([key, value]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {value.method}
                        </Badge>
                        <span>{value.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="query-params">Query Parameters</Label>
              <Input
                id="query-params"
                placeholder={
                  endpoint === 'jobs-latest' ? 'page=1&limit=20&location=Mumbai&job_type=full-time' :
                  endpoint === 'jobs-detail' ? 'job_id=00000000-0000-0000-0000-000000000000' :
                  endpoint === 'jobs-list' ? 'page=1&limit=20&status=active&my_jobs=true' :
                  'Optional query parameters'
                }
                value={queryParams}
                onChange={(e) => setQueryParams(e.target.value)}
              />
              {(endpoint === 'jobs-latest' || endpoint === 'jobs-list') && (
                <p className="text-xs text-muted-foreground">
                  Available filters: page, limit, location, job_type, experience_level
                  {endpoint === 'jobs-list' && ', status, search, my_jobs=true'}
                </p>
              )}
            </div>
          </div>

          {/* Request Body (for POST requests) */}
          {endpoints[endpoint as keyof typeof endpoints]?.method === 'POST' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="request-body">Request Body (JSON)</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const examples: Record<string, string> = {
                      'jobs-post': JSON.stringify({
                        // ===== REQUIRED FIELDS =====
                        "title": "Senior React Developer",
                        "description": "We are looking for an experienced React developer to join our dynamic team. Must have 5+ years of experience with React, TypeScript, and modern frontend development practices.",
                        "location": "Bangalore, Karnataka, India",
                        "job_type": "full-time", // Options: full-time, part-time, contract, internship, temporary
                        "duration_months": 1, // Use duration_months (1, 3, 6, 12) OR legacy duration (30, 90, 180 days)
                        
                        // ===== OPTIONAL JOB DETAILS =====
                        "latitude": 12.9716,
                        "longitude": 77.5946,
                        "experience_level": "senior", // Options: entry, intermediate, senior, expert
                        "department": "Engineering",
                        "salary_min": 800000,
                        "salary_max": 1500000,
                        "salary_period": "yearly", // Options: yearly, monthly, hourly
                        "salary_currency": "INR",
                        "skills": ["React", "TypeScript", "Node.js", "MongoDB"],
                        "languages": ["English", "Hindi"],
                        "benefits": ["Health Insurance", "Workly India", "Flexible Hours"],
                        "requirements": ["5+ years React experience", "Strong TypeScript skills", "Experience with REST APIs"],
                        "responsibilities": ["Lead frontend development", "Code reviews", "Mentor junior developers"],
                        "remote_allowed": true,
                        "visa_sponsorship": false,
                        "publish_immediately": true,
                        
                        // ===== JOB VIDEOS (Up to 2 YouTube videos) =====
                        "job_videos": [
                          {
                            "title": "Company Culture & Work Environment",
                            "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                          },
                          {
                            "title": "Day in the Life of a Developer",
                            "url": "https://www.youtube.com/watch?v=9bZkp7q19f0"
                          }
                        ],
                        
                        // ===== OPTIONAL CONTACT DETAILS (overrides your company profile on job page) =====
                        "email": "hr@example-company.com",
                        "hr_contact_name": "HR Manager",
                        "phone": "+91 XXXXX XXXXX",
                        "whatsapp_number": "+91 XXXXX XXXXX",
                        
                        // ===== OPTIONAL COMPANY DETAILS (overrides your company profile on job page) =====
                        // If not provided, your company profile details will be shown
                        "company_name": "Tech Solutions Pvt Ltd",
                        "industry": "Technology",
                        "organisation_size": "51-200",
                        "company_details": "A leading technology company focused on innovative solutions.",
                        "instagram_link": "https://instagram.com/company",
                        "facebook_link": "https://facebook.com/company",
                        "linkedin_link": "https://linkedin.com/company/example",
                        "youtube_link": "https://youtube.com/@company"
                      }, null, 2),
                      'jobs-extend': JSON.stringify({
                        "job_id": "00000000-0000-0000-0000-000000000000",
                        "duration_months": 3 // Options: 1, 3, 6, or 12 months (50 points per month)
                      }, null, 2),
                      'jobs-boost-wallet': JSON.stringify({
                        "job_id": "00000000-0000-0000-0000-000000000000",
                        "boost_package_id": "1" // Options: "1", "2", or "3" (100-300 points per week)
                      }, null, 2),
                      'jobs-boost': JSON.stringify({
                        "job_id": "00000000-0000-0000-0000-000000000000",
                        "boost_level": 1, // Options: 1, 2, or 3
                        "duration_days": 7 // Options: 7, 14, or 30 days
                      }, null, 2),
                      'jobs-multiple': JSON.stringify({
                        "job_ids": [
                          "00000000-0000-0000-0000-000000000000",
                          "11111111-1111-1111-1111-111111111111"
                        ]
                      }, null, 2),
                      'applications-submit': JSON.stringify({
                        "job_id": "00000000-0000-0000-0000-000000000000",
                        "email": "rahul@example.com",
                        "cover_letter": "I am very interested in this position and believe my skills align well with the requirements.",
                        "resume_url": "https://example.com/resume.pdf",
                        "full_name": "Rahul Kumar",
                        "phone": "+91 98765 43210",
                        "location": "Mumbai, Maharashtra",
                        "skills": ["JavaScript", "React", "Node.js", "TypeScript"],
                        "current_position": "Senior Full Stack Developer",
                        "bio": "Experienced full-stack developer with 5+ years of building scalable web applications. Passionate about clean code and user experience.",
                        "experience_years": 5,
                        "languages": ["English", "Hindi", "Marathi"],
                        "whatsapp_number": "+91 98765 43210",
                        "social_links": {
                          "instagram": "https://instagram.com/rahulkumar",
                          "linkedin": "https://linkedin.com/in/rahulkumar",
                          "facebook": "https://facebook.com/rahulkumar",
                          "youtube": "https://youtube.com/@rahulkumar"
                        },
                        "certifications": [
                          {
                            "certification_name": "AWS Certified Solutions Architect",
                            "issuing_organization": "Amazon Web Services",
                            "issue_date": "2024-01-15",
                            "credential_id": "AWS-123456",
                            "credential_url": "https://aws.amazon.com/verify/123456"
                          },
                          {
                            "certification_name": "Google Cloud Professional",
                            "issuing_organization": "Google",
                            "issue_date": "2023-06-10"
                          }
                        ],
                        "professional_experiences": [
                          {
                            "position": "Senior Full Stack Developer",
                            "company": "Tech Solutions Pvt Ltd",
                            "start_date": "2020-03-01",
                            "is_current": true,
                            "description": "Leading development of scalable web applications using React and Node.js. Mentoring junior developers and conducting code reviews."
                          },
                          {
                            "position": "Full Stack Developer",
                            "company": "Digital Innovations",
                            "start_date": "2018-06-01",
                            "end_date": "2020-02-28",
                            "description": "Developed and maintained multiple client projects using MERN stack."
                          }
                        ],
                        "education_entries": [
                          {
                            "degree": "Bachelor of Technology in Computer Science",
                            "institution": "Mumbai University",
                            "field_of_study": "Computer Science",
                            "start_year": 2014,
                            "end_year": 2018,
                            "grade": "8.5 CGPA"
                          }
                        ]
                      }, null, 2)
                    };
                    const example = examples[endpoint];
                    if (example) {
                      setRequestBody(example);
                      toast.success('Example loaded!');
                    }
                  }}
                >
                  <Code className="w-3 h-3 mr-1" />
                  Load Example
                </Button>
              </div>
              <Textarea
                id="request-body"
                placeholder='{"key": "value"}'
                rows={8}
                value={requestBody}
                onChange={(e) => setRequestBody(e.target.value)}
                className="font-mono text-sm"
              />
              {endpoint === 'applications-submit' && (
                <div className="p-4 bg-destructive/10 dark:bg-destructive/20 rounded-lg border-2 border-destructive/50">
                  <p className="text-sm font-bold text-destructive mb-2">
                    ⚠️ IMPORTANT - READ BEFORE TESTING
                  </p>
                  <p className="text-xs text-destructive/90 dark:text-destructive-foreground mb-3 font-semibold">
                    You MUST follow these steps in order:
                  </p>
                  <ol className="text-xs text-destructive/90 dark:text-destructive-foreground space-y-2 ml-4 list-decimal">
                    <li className="font-medium">First, use the "Create job posting" endpoint to create a job</li>
                    <li className="font-medium">Copy the <code className="bg-destructive/20 px-1.5 py-0.5 rounded font-mono">job_id</code> from the response</li>
                    <li className="font-medium">Replace the example job_id (00000000...) in the request body above</li>
                    <li className="font-medium">Only then submit the application</li>
                  </ol>
                  <p className="text-xs mt-3 font-bold text-destructive">
                    ❌ Testing with the example job_id will FAIL
                  </p>
                </div>
              )}
              <div className="p-3 bg-muted rounded-lg border">
                <p className="text-xs text-muted-foreground">
                  <strong>Tip:</strong> Click "Load Example" to populate with sample request data
                </p>
              </div>
            </div>
          )}

          {/* Test Button */}
          <Button 
            onClick={testEndpoint} 
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Test Endpoint
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Response */}
      {response && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Code className="w-5 h-5" />
                Response
                {response.status >= 200 && response.status < 300 ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant={response.status >= 200 && response.status < 300 ? 'default' : 'destructive'}>
                  {response.status} {response.statusText}
                </Badge>
                {responseTime !== null && (
                  <Badge variant="outline">
                    {responseTime}ms
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
              {JSON.stringify(response, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Code Examples */}
      <Card>
        <CardHeader>
          <CardTitle>Code Examples</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="curl">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="curl">cURL</TabsTrigger>
              <TabsTrigger value="javascript">JavaScript</TabsTrigger>
              <TabsTrigger value="python">Python</TabsTrigger>
            </TabsList>

            <TabsContent value="curl" className="space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">Command line request</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => copyCode(generateCurlCommand())}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
                {generateCurlCommand()}
              </pre>
            </TabsContent>

            <TabsContent value="javascript" className="space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">Fetch API example</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => copyCode(generateJavaScriptCode())}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
                {generateJavaScriptCode()}
              </pre>
            </TabsContent>

            <TabsContent value="python" className="space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">Requests library example</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => copyCode(generatePythonCode())}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
                {generatePythonCode()}
              </pre>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
