import CopyPageButton from "@/components/docs/CopyPageButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Terminal } from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { SDKGuide } from "@/components/api/SDKGuide";

const CurlDocs = () => {
  const navigate = useNavigate();

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-2">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/owner-portal/api-docs')}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to API Documentation
        </Button>
          <CopyPageButton title="cURL Docs" />
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Terminal className="w-8 h-8 text-green-600" />
              <h1 className="text-3xl md:text-4xl font-bold text-foreground">
                cURL Documentation
              </h1>
            </div>
            <p className="text-muted-foreground text-lg">
              Direct API calls using cURL for testing and debugging
            </p>
          </div>

          <Separator />

          {/* Search Jobs */}
          <Card>
            <CardHeader>
              <CardTitle>Search Jobs (GET)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Find jobs with search filters:</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyCode(`curl -X GET "https://jubwzelupbntbetpajqb.supabase.co/functions/v1/jobs-search?search_query=developer&location=mumbai&page=1&limit=20" \\
  -H "X-Api-Key: your-api-key" \\
  -H "Content-Type: application/json"`)}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`curl -X GET "https://jubwzelupbntbetpajqb.supabase.co/functions/v1/jobs-search?search_query=developer&location=mumbai&page=1&limit=20" \\
  -H "X-Api-Key: your-api-key" \\
  -H "Content-Type: application/json"`}
              </pre>
            </CardContent>
          </Card>

          {/* Get Job Details */}
          <Card>
            <CardHeader>
              <CardTitle>Get Job Details by ID (GET)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Fetch complete details for a specific job:</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyCode(`curl -X GET "https://jubwzelupbntbetpajqb.supabase.co/functions/v1/jobs-search?job_id=123e4567-e89b-12d3-a456-426614174000" \\
  -H "X-Api-Key: your-api-key" \\
  -H "Content-Type: application/json"`)}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`curl -X GET "https://jubwzelupbntbetpajqb.supabase.co/functions/v1/jobs-search?job_id=123e4567-e89b-12d3-a456-426614174000" \\
  -H "X-Api-Key: your-api-key" \\
  -H "Content-Type: application/json"`}
              </pre>
              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <p className="text-xs font-semibold mb-2">Success Response (200):</p>
                <pre className="text-xs overflow-x-auto">
{`{
  "success": true,
  "data": [{
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "title": "Senior Full Stack Developer",
    "description": "We are looking for...",
    "company_name": "Tech Solutions India",
    "company_logo": "https://storage.supabase.co/...",
    "company_website": "https://techsolutions.in",
    "company_email": "hr@techsolutions.in",
    "location": "Mumbai, Maharashtra",
    "latitude": 19.0760,
    "longitude": 72.8777,
    "job_type": "full-time",
    "category": "Technology",
    "experience_level": "3-5",
    "skills": ["React", "Node.js", "PostgreSQL"],
    "languages": ["English", "Hindi"],
    "benefits": ["Health Insurance", "Workly India"],
    "requirements": ["Bachelor's degree", "3+ years experience"],
    "responsibilities": ["Develop features", "Code reviews"],
    "salary_min": 800000,
    "salary_max": 1500000,
    "salary_period": "yearly",
    "salary_currency": "INR",
    "remote_work": true,
    "visa_sponsorship": false,
    "job_videos": [
      {"title": "Company Culture", "url": "https://youtube.com/..."}
    ],
    "view_count": 1250,
    "application_count": 47,
    "company_social_media": {
      "linkedin": "https://linkedin.com/company/...",
      "twitter": "https://twitter.com/..."
    }
  }]
}`}
                </pre>
              </div>
            </CardContent>
          </Card>

          {/* Create Job */}
          <Card>
            <CardHeader>
              <CardTitle>Create Job (POST)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Post a new job to the platform:</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyCode(`curl -X POST "https://jubwzelupbntbetpajqb.supabase.co/functions/v1/jobs-create" \\
  -H "X-Api-Key: your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Senior Developer",
    "description": "Looking for experienced developer",
    "location": "Mumbai",
    "salary_min": 800000,
    "salary_max": 1200000,
    "salary_period": "yearly",
    "salary_currency": "INR",
    "skills": ["React", "Node.js", "MongoDB"]
  }'`)}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`curl -X POST "https://jubwzelupbntbetpajqb.supabase.co/functions/v1/jobs-create" \\
  -H "X-Api-Key: your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Senior Developer",
    "description": "Looking for experienced developer",
    "location": "Mumbai",
    "salary_min": 800000,
    "salary_max": 1200000,
    "salary_period": "yearly",
    "salary_currency": "INR",
    "skills": ["React", "Node.js", "MongoDB"]
  }'`}
              </pre>
            </CardContent>
          </Card>

          {/* List Companies */}
          <Card>
            <CardHeader>
              <CardTitle>List Companies (GET)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Get verified companies:</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyCode(`curl -X GET "https://jubwzelupbntbetpajqb.supabase.co/functions/v1/companies-list?verified=true&industry=technology" \\
  -H "X-Api-Key: your-api-key" \\
  -H "Content-Type: application/json"`)}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`curl -X GET "https://jubwzelupbntbetpajqb.supabase.co/functions/v1/companies-list?verified=true&industry=technology" \\
  -H "X-Api-Key: your-api-key" \\
  -H "Content-Type: application/json"`}
              </pre>
            </CardContent>
          </Card>

          {/* Boost Job with Wallet */}
          <Card>
            <CardHeader>
              <CardTitle>Boost Job with Wallet (POST)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Boost a job using wallet points:</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyCode(`curl -X POST "https://jubwzelupbntbetpajqb.supabase.co/functions/v1/jobs-boost-wallet" \\
  -H "X-Api-Key: your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "job_id": "uuid-here",
    "boost_package_id": "boost-package-uuid"
  }'`)}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`curl -X POST "https://jubwzelupbntbetpajqb.supabase.co/functions/v1/jobs-boost-wallet" \\
  -H "X-Api-Key: your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "job_id": "uuid-here",
    "boost_package_id": "boost-package-uuid"
  }'`}
              </pre>
            </CardContent>
          </Card>

          {/* Extend Job with Wallet */}
          <Card>
            <CardHeader>
              <CardTitle>Extend Job Duration with Wallet (POST)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Extend job duration using wallet points (50 points/month):</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyCode(`curl -X POST "https://jubwzelupbntbetpajqb.supabase.co/functions/v1/wallet-job-extension" \\
  -H "X-Api-Key: your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "job_id": "uuid-here",
    "duration_months": 3
  }'`)}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`curl -X POST "https://jubwzelupbntbetpajqb.supabase.co/functions/v1/wallet-job-extension" \\
  -H "X-Api-Key: your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "job_id": "uuid-here",
    "duration_months": 3
  }'`}
              </pre>
            </CardContent>
          </Card>

          {/* Boost Job (API Key) */}
          <Card>
            <CardHeader>
              <CardTitle>Boost Job (API Key) - POST</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Boost job using API key (for non-wallet users):</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyCode(`curl -X POST "https://jubwzelupbntbetpajqb.supabase.co/functions/v1/jobs-boost" \\
  -H "X-Api-Key: your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "job_id": "uuid-here",
    "boost_level": 1,
    "duration_days": 7
  }'`)}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`curl -X POST "https://jubwzelupbntbetpajqb.supabase.co/functions/v1/jobs-boost" \\
  -H "X-Api-Key: your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "job_id": "uuid-here",
    "boost_level": 1,
    "duration_days": 7
  }'`}
              </pre>
            </CardContent>
          </Card>

          {/* Extend Job (API Key) */}
          <Card>
            <CardHeader>
              <CardTitle>Extend Job Duration (API Key) - POST</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Extend job duration via API key (for non-wallet users):</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyCode(`curl -X POST "https://jubwzelupbntbetpajqb.supabase.co/functions/v1/jobs-extend" \\
  -H "X-Api-Key: your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "job_id": "uuid-here",
    "duration_months": 3
  }'`)}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`curl -X POST "https://jubwzelupbntbetpajqb.supabase.co/functions/v1/jobs-extend" \\
  -H "X-Api-Key: your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "job_id": "uuid-here",
    "duration_months": 3
  }'`}
              </pre>
            </CardContent>
          </Card>

          {/* Boost Job (API Key) */}
          <Card>
            <CardHeader>
              <CardTitle>Boost Job (API Key) (POST)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Boost job via API key with payment:</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyCode(`curl -X POST "https://jubwzelupbntbetpajqb.supabase.co/functions/v1/jobs-boost" \\
  -H "X-Api-Key: your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "job_id": "uuid-here",
    "boost_level": 1,
    "duration_days": 7
  }'`)}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`curl -X POST "https://jubwzelupbntbetpajqb.supabase.co/functions/v1/jobs-boost" \\
  -H "X-Api-Key: your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "job_id": "uuid-here",
    "boost_level": 1,
    "duration_days": 7
  }'`}
              </pre>
            </CardContent>
          </Card>

          {/* Extend Job (API Key) */}
          <Card>
            <CardHeader>
              <CardTitle>Extend Job Duration (API Key) (POST)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Extend job duration via API key (50 points/month):</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyCode(`curl -X POST "https://jubwzelupbntbetpajqb.supabase.co/functions/v1/jobs-extend" \\
  -H "X-Api-Key: your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "job_id": "uuid-here",
    "duration_months": 3
  }'`)}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`curl -X POST "https://jubwzelupbntbetpajqb.supabase.co/functions/v1/jobs-extend" \\
  -H "X-Api-Key: your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "job_id": "uuid-here",
    "duration_months": 3
  }'`}
              </pre>
            </CardContent>
          </Card>

          {/* Submit Application */}
          <Card>
            <CardHeader>
              <CardTitle>Submit Application (POST)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Apply for a job:</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyCode(`curl -X POST "https://jubwzelupbntbetpajqb.supabase.co/functions/v1/applications-submit" \\
  -H "X-Api-Key: your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "job_id": "uuid-here",
    "cover_letter": "I am interested in this position...",
    "resume_url": "https://storage.supabase.co/..."
  }'`)}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`curl -X POST "https://jubwzelupbntbetpajqb.supabase.co/functions/v1/applications-submit" \\
  -H "X-Api-Key: your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "job_id": "uuid-here",
    "cover_letter": "I am interested in this position...",
    "resume_url": "https://storage.supabase.co/..."
  }'`}
              </pre>
            </CardContent>
          </Card>

          {/* Headers Explanation */}
          <Card>
            <CardHeader>
              <CardTitle>Required Headers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 border rounded-lg">
                  <p className="font-mono text-sm font-semibold mb-1">Authorization</p>
                  <p className="text-xs text-muted-foreground">
                    Bearer token with your API key. Required for all requests.
                  </p>
                  <pre className="bg-muted p-2 rounded mt-2 text-xs">
X-Api-Key: your-api-key
                  </pre>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="font-mono text-sm font-semibold mb-1">Content-Type</p>
                  <p className="text-xs text-muted-foreground">
                    Specifies JSON format for request and response data.
                  </p>
                  <pre className="bg-muted p-2 rounded mt-2 text-xs">
Content-Type: application/json
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Response Codes */}
          <Card>
            <CardHeader>
              <CardTitle>Common Response Codes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-start gap-3 p-2 border rounded">
                  <span className="font-mono text-sm font-semibold text-green-600">200</span>
                  <p className="text-sm">Success - Request completed successfully</p>
                </div>
                <div className="flex items-start gap-3 p-2 border rounded">
                  <span className="font-mono text-sm font-semibold text-green-600">201</span>
                  <p className="text-sm">Created - Resource created successfully</p>
                </div>
                <div className="flex items-start gap-3 p-2 border rounded">
                  <span className="font-mono text-sm font-semibold text-yellow-600">400</span>
                  <p className="text-sm">Bad Request - Invalid parameters</p>
                </div>
                <div className="flex items-start gap-3 p-2 border rounded">
                  <span className="font-mono text-sm font-semibold text-red-600">401</span>
                  <p className="text-sm">Unauthorized - Invalid API key</p>
                </div>
                <div className="flex items-start gap-3 p-2 border rounded">
                  <span className="font-mono text-sm font-semibold text-red-600">429</span>
                  <p className="text-sm">Rate Limited - Too many requests</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Testing Tips */}
          <Card>
            <CardHeader>
              <CardTitle>Testing Tips</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Use <code className="bg-muted px-1 rounded">-v</code> flag for verbose output to see headers and debug info</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Add <code className="bg-muted px-1 rounded">-w "\n"</code> to print a newline after response</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Save responses to file with <code className="bg-muted px-1 rounded">-o output.json</code></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Use <code className="bg-muted px-1 rounded">jq</code> to format JSON output: <code className="bg-muted px-1 rounded">curl ... | jq</code></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Test webhook security by verifying signatures in your webhook handler</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* SDK Guide & FAQ */}
          <SDKGuide sdkName="cURL" language="curl" />
        </div>
      </div>
    </div>
  );
};

export default CurlDocs;