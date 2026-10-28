import CopyPageButton from "@/components/docs/CopyPageButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Terminal, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SDKGuide } from "@/components/api/SDKGuide";

const JavaScriptSDK = () => {
  const navigate = useNavigate();

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied to clipboard!');
  };

  const baseUrl = "https://jubwzelupbntbetpajqb.supabase.co/functions/v1";

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
          <CopyPageButton title="JavaScript SDK" />
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Terminal className="w-8 h-8 text-yellow-600" />
              <h1 className="text-3xl md:text-4xl font-bold text-foreground">
                JavaScript/TypeScript SDK
              </h1>
            </div>
            <p className="text-muted-foreground text-lg">
              Direct API integration using fetch or axios
            </p>
          </div>

          <Separator />

          {/* SDK Note */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No NPM package installation required! Use standard HTTP libraries like fetch or axios to call the API directly.
            </AlertDescription>
          </Alert>

          {/* Quick Start with Fetch */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Start (Fetch API)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Initialize your API configuration:</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyCode(`const API_KEY = 'your-api-key';
const BASE_URL = '${baseUrl}';

const headers = {
  'X-Api-Key': API_KEY,
  'Content-Type': 'application/json'
};`)}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`const API_KEY = 'your-api-key';
const BASE_URL = '${baseUrl}';

const headers = {
  'X-Api-Key': API_KEY,
  'Content-Type': 'application/json'
};`}
              </pre>
            </CardContent>
          </Card>

          {/* Get Job Details */}
          <Card>
            <CardHeader>
              <CardTitle>Get Job Details by ID</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Fetch complete details for a specific job:</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyCode(`// Get job details by ID
const getJobDetails = async (jobId) => {
  const response = await fetch(\`${baseUrl}/jobs-search?job_id=\${jobId}\`, {
    method: 'GET',
    headers
  });

  const data = await response.json();
  
  if (data.success && data.data.length > 0) {
    const job = data.data[0];
    console.log('Job Title:', job.title);
    console.log('Company:', job.company_name);
    console.log('Location:', job.location);
    console.log('Salary:', \`\${job.salary_currency} \${job.salary_min} - \${job.salary_max}\`);
    console.log('Skills:', job.skills.join(', '));
    console.log('Workly India:', job.remote_work);
    console.log('Applications:', job.application_count);
    return job;
  } else {
    console.error('Job not found');
    return null;
  }
};

// Usage
getJobDetails('123e4567-e89b-12d3-a456-426614174000');`)}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`// Get job details by ID
const getJobDetails = async (jobId) => {
  const response = await fetch(\`${baseUrl}/jobs-search?job_id=\${jobId}\`, {
    method: 'GET',
    headers
  });

  const data = await response.json();
  
  if (data.success && data.data.length > 0) {
    const job = data.data[0];
    console.log('Job Title:', job.title);
    console.log('Company:', job.company_name);
    console.log('Location:', job.location);
    console.log('Salary:', \`\${job.salary_currency} \${job.salary_min} - \${job.salary_max}\`);
    console.log('Skills:', job.skills.join(', '));
    console.log('Workly India:', job.remote_work);
    console.log('Applications:', job.application_count);
    return job;
  } else {
    console.error('Job not found');
    return null;
  }
};

// Usage
getJobDetails('123e4567-e89b-12d3-a456-426614174000');`}
              </pre>
            </CardContent>
          </Card>

          {/* Job Boost */}
          <Card>
            <CardHeader>
              <CardTitle>Boost Job with Wallet</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Boost a job post using wallet points:</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyCode(`// Boost a job
const boostJob = async (jobId, boostPackageId) => {
  const response = await fetch(\`${baseUrl}/jobs-boost-wallet\`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      job_id: jobId,
      boost_package_id: boostPackageId
    })
  });

  const data = await response.json();
  
  if (data.success) {
    console.log('Job boosted:', data.data);
    console.log('Remaining balance:', data.data.remaining_balance);
  } else {
    console.error('Boost failed:', data.error);
  }
  
  return data;
};

// Usage
await boostJob('job-uuid-here', 'boost-package-uuid');`)}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`// Boost a job
const boostJob = async (jobId, boostPackageId) => {
  const response = await fetch(\`${baseUrl}/jobs-boost-wallet\`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      job_id: jobId,
      boost_package_id: boostPackageId
    })
  });

  const data = await response.json();
  
  if (data.success) {
    console.log('Job boosted:', data.data);
    console.log('Remaining balance:', data.data.remaining_balance);
  } else {
    console.error('Boost failed:', data.error);
  }
  
  return data;
};

// Usage
await boostJob('job-uuid-here', 'boost-package-uuid');`}
              </pre>
            </CardContent>
          </Card>

          {/* Extend Job */}
          <Card>
            <CardHeader>
              <CardTitle>Extend Job Duration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Extend job duration using wallet points (50 points/month):</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyCode(`// Extend job duration
const extendJob = async (jobId, durationMonths) => {
  const response = await fetch(\`${baseUrl}/wallet-job-extension\`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      job_id: jobId,
      duration_months: durationMonths // 1, 2, 3, or 6
    })
  });

  const data = await response.json();
  
  if (data.success) {
    console.log('Job extended:', data.data);
    console.log('New expiry:', data.data.new_expiry_date);
  } else {
    console.error('Extension failed:', data.error);
  }
  
  return data;
};

// Usage
await extendJob('job-uuid-here', 3); // Extend by 3 months`)}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`// Extend job duration
const extendJob = async (jobId, durationMonths) => {
  const response = await fetch(\`${baseUrl}/wallet-job-extension\`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      job_id: jobId,
      duration_months: durationMonths // 1, 2, 3, or 6
    })
  });

  const data = await response.json();
  
  if (data.success) {
    console.log('Job extended:', data.data);
    console.log('New expiry:', data.data.new_expiry_date);
  } else {
    console.error('Extension failed:', data.error);
  }
  
  return data;
};

// Usage
await extendJob('job-uuid-here', 3); // Extend by 3 months`}
              </pre>
            </CardContent>
          </Card>

          {/* Boost Job (API Key) */}
          <Card>
            <CardHeader>
              <CardTitle>Boost Job (API Key)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Boost a job post using API key (for non-wallet users):</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyCode(`// Boost a job via API key
const boostJobApi = async (jobId, boostLevel, durationDays) => {
  const response = await fetch(\`${baseUrl}/jobs-boost\`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      job_id: jobId,
      boost_level: boostLevel, // 1, 2, or 3
      duration_days: durationDays // 7, 14, or 30
    })
  });

  const data = await response.json();
  
  if (data.success) {
    console.log('Job boosted:', data.data);
  } else {
    console.error('Boost failed:', data.error);
  }
  
  return data;
};

// Usage
await boostJobApi('job-uuid-here', 1, 7);`)}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`// Boost a job via API key
const boostJobApi = async (jobId, boostLevel, durationDays) => {
  const response = await fetch(\`${baseUrl}/jobs-boost\`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      job_id: jobId,
      boost_level: boostLevel, // 1, 2, or 3
      duration_days: durationDays // 7, 14, or 30
    })
  });

  const data = await response.json();
  
  if (data.success) {
    console.log('Job boosted:', data.data);
  } else {
    console.error('Boost failed:', data.error);
  }
  
  return data;
};

// Usage
await boostJobApi('job-uuid-here', 1, 7);`}
              </pre>
            </CardContent>
          </Card>

          {/* Extend Job (API Key) */}
          <Card>
            <CardHeader>
              <CardTitle>Extend Job Duration (API Key)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Extend job duration using API key (for non-wallet users):</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyCode(`// Extend job via API key
const extendJobApi = async (jobId, durationMonths) => {
  const response = await fetch(\`${baseUrl}/jobs-extend\`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      job_id: jobId,
      duration_months: durationMonths // 1, 2, 3, or 6
    })
  });

  const data = await response.json();
  
  if (data.success) {
    console.log('Job extended:', data.data);
    console.log('New expiry:', data.data.new_expiry_date);
  } else {
    console.error('Extension failed:', data.error);
  }
  
  return data;
};

// Usage
await extendJobApi('job-uuid-here', 3);`)}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`// Extend job via API key
const extendJobApi = async (jobId, durationMonths) => {
  const response = await fetch(\`${baseUrl}/jobs-extend\`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      job_id: jobId,
      duration_months: durationMonths // 1, 2, 3, or 6
    })
  });

  const data = await response.json();
  
  if (data.success) {
    console.log('Job extended:', data.data);
    console.log('New expiry:', data.data.new_expiry_date);
  } else {
    console.error('Extension failed:', data.error);
  }
  
  return data;
};

// Usage
await extendJobApi('job-uuid-here', 3);`}
              </pre>
            </CardContent>
          </Card>

          {/* Update Job */}
          <Card>
            <CardHeader>
              <CardTitle>Update Job</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Update an existing job post:</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyCode(`// Update a job
const updateJob = async (jobId, updates) => {
  const response = await fetch(\`${baseUrl}/jobs-update/\${jobId}\`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(updates)
  });

  const data = await response.json();
  
  if (data.success) {
    console.log('Job updated:', data.data);
  } else {
    console.error('Update failed:', data.error);
  }
  
  return data;
};

// Usage
await updateJob('job-uuid-here', {
  title: 'Updated Job Title',
  description: 'New description',
  salary_min: 60000
});`)}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`// Update a job
const updateJob = async (jobId, updates) => {
  const response = await fetch(\`${baseUrl}/jobs-update/\${jobId}\`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(updates)
  });

  const data = await response.json();
  
  if (data.success) {
    console.log('Job updated:', data.data);
  } else {
    console.error('Update failed:', data.error);
  }
  
  return data;
};

// Usage
await updateJob('job-uuid-here', {
  title: 'Updated Job Title',
  description: 'New description',
  salary_min: 60000
});`}
              </pre>
            </CardContent>
          </Card>

          {/* Delete Job */}
          <Card>
            <CardHeader>
              <CardTitle>Delete Job</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Delete a job post:</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyCode(`// Delete a job
const deleteJob = async (jobId) => {
  const response = await fetch(\`${baseUrl}/jobs-delete/\${jobId}\`, {
    method: 'DELETE',
    headers
  });

  const data = await response.json();
  
  if (data.success) {
    console.log('Job deleted successfully');
  } else {
    console.error('Delete failed:', data.error);
  }
  
  return data;
};

// Usage
await deleteJob('job-uuid-here');`)}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`// Delete a job
const deleteJob = async (jobId) => {
  const response = await fetch(\`${baseUrl}/jobs-delete/\${jobId}\`, {
    method: 'DELETE',
    headers
  });

  const data = await response.json();
  
  if (data.success) {
    console.log('Job deleted successfully');
  } else {
    console.error('Delete failed:', data.error);
  }
  
  return data;
};

// Usage
await deleteJob('job-uuid-here');`}
              </pre>
            </CardContent>
          </Card>

          {/* Search Jobs */}
          <Card>
            <CardHeader>
              <CardTitle>Search Jobs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Find jobs with search filters:</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyCode(`// Search for jobs
const searchJobs = async (query, location) => {
  const params = new URLSearchParams({
    search_query: query || '',
    location: location || '',
    page: '1',
    limit: '20'
  });

  const response = await fetch(\`\${BASE_URL}/jobs-search?\${params}\`, {
    method: 'GET',
    headers
  });

  return await response.json();
};

// Usage
const results = await searchJobs('developer', 'Mumbai');
console.log('Found jobs:', results.data);`)}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`// Search for jobs
const searchJobs = async (query, location) => {
  const params = new URLSearchParams({
    search_query: query || '',
    location: location || '',
    page: '1',
    limit: '20'
  });

  const response = await fetch(\`\${BASE_URL}/jobs-search?\${params}\`, {
    method: 'GET',
    headers
  });

  return await response.json();
};

// Usage
const results = await searchJobs('developer', 'Mumbai');
console.log('Found jobs:', results.data);`}
              </pre>
            </CardContent>
          </Card>

          {/* Boost Job */}
          <Card>
            <CardHeader>
              <CardTitle>Boost Job with Wallet</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Boost a job to increase visibility:</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyCode(`// Boost a job using wallet points
const boostJob = async (jobId, boostPackageId) => {
  const response = await fetch(\`\${BASE_URL}/jobs-boost-wallet\`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      job_id: jobId,
      boost_package_id: boostPackageId
    })
  });

  const data = await response.json();
  
  if (data.success) {
    console.log('✅ Job boosted successfully!');
    console.log('Points deducted:', data.data.points_deducted);
    console.log('Remaining balance:', data.data.remaining_balance);
  } else {
    if (data.error.code === 'INSUFFICIENT_BALANCE') {
      console.error('❌ Not enough points. Need:', data.error.required_points);
    } else {
      console.error('❌ Boost failed:', data.error);
    }
  }
  
  return data;
};

// Usage
await boostJob('your-job-uuid', 'boost-package-uuid');`)}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`// Boost a job using wallet points
const boostJob = async (jobId, boostPackageId) => {
  const response = await fetch(\`\${BASE_URL}/jobs-boost-wallet\`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      job_id: jobId,
      boost_package_id: boostPackageId
    })
  });

  const data = await response.json();
  
  if (data.success) {
    console.log('✅ Job boosted successfully!');
    console.log('Points deducted:', data.data.points_deducted);
    console.log('Remaining balance:', data.data.remaining_balance);
  } else {
    if (data.error.code === 'INSUFFICIENT_BALANCE') {
      console.error('❌ Not enough points. Need:', data.error.required_points);
    } else {
      console.error('❌ Boost failed:', data.error);
    }
  }
  
  return data;
};

// Usage
await boostJob('your-job-uuid', 'boost-package-uuid');`}
              </pre>
            </CardContent>
          </Card>

          {/* Create Job */}
          <Card>
            <CardHeader>
              <CardTitle>Create Job Posting</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Post a new job to the platform:</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyCode(`// Post a new job
const createJob = async (jobData) => {
  const response = await fetch('${baseUrl}/jobs-create', {
    method: 'POST',
    headers: {
      'X-Api-Key': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(jobData)
  });

  if (!response.ok) {
    throw new Error(\`HTTP error! status: \${response.status}\`);
  }

  const data = await response.json();
  return data;
};

// Usage
const newJob = await createJob({
  title: 'Senior Developer',
  description: 'Looking for experienced developer',
  location: 'Mumbai',
  salary_min: 800000,
  salary_max: 1200000,
  salary_period: 'yearly',
  salary_currency: 'INR',
  skills: ['React', 'Node.js', 'MongoDB']
});

console.log('Job created:', newJob);`)}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`// Post a new job
const createJob = async (jobData) => {
  const response = await fetch('${baseUrl}/jobs-create', {
    method: 'POST',
    headers: {
      'X-Api-Key': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(jobData)
  });

  if (!response.ok) {
    throw new Error(\`HTTP error! status: \${response.status}\`);
  }

  const data = await response.json();
  return data;
};

// Usage
const newJob = await createJob({
  title: 'Senior Developer',
  description: 'Looking for experienced developer',
  location: 'Mumbai',
  salary_min: 800000,
  salary_max: 1200000,
  salary_period: 'yearly',
  salary_currency: 'INR',
  skills: ['React', 'Node.js', 'MongoDB']
});

console.log('Job created:', newJob);`}
              </pre>
            </CardContent>
          </Card>

          {/* Error Handling */}
          <Card>
            <CardHeader>
              <CardTitle>Error Handling</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Handle API errors gracefully:</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyCode(`const apiCall = async () => {
  try {
    const response = await fetch('${baseUrl}/jobs-search?search_query=developer', {
      headers: {
        'X-Api-Key': API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      
      if (response.status === 429) {
        console.error('Rate limit exceeded');
        const retryAfter = response.headers.get('Retry-After');
        console.log('Retry after:', retryAfter, 'seconds');
      } else if (response.status === 401) {
        console.error('Invalid API key');
      } else {
        console.error('API Error:', error);
      }
      
      throw error;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Request failed:', error);
    throw error;
  }
};`)}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`const apiCall = async () => {
  try {
    const response = await fetch('${baseUrl}/jobs-search?search_query=developer', {
      headers: {
        'X-Api-Key': API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      
      if (response.status === 429) {
        console.error('Rate limit exceeded');
        const retryAfter = response.headers.get('Retry-After');
        console.log('Retry after:', retryAfter, 'seconds');
      } else if (response.status === 401) {
        console.error('Invalid API key');
      } else {
        console.error('API Error:', error);
      }
      
      throw error;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Request failed:', error);
    throw error;
  }
};`}
              </pre>
            </CardContent>
          </Card>

          {/* Axios Alternative */}
          <Card>
            <CardHeader>
              <CardTitle>Using Axios (Alternative)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Install axios: <code className="bg-muted px-2 py-1 rounded">npm install axios</code>
              </p>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Axios example:</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyCode(`import axios from 'axios';

const api = axios.create({
  baseURL: '${baseUrl}',
  headers: {
    'X-Api-Key': API_KEY,
    'Content-Type': 'application/json'
  }
});

// Search jobs
const searchJobs = async (query, location) => {
  try {
    const { data } = await api.get('/jobs-search', {
      params: { search_query: query, location, page: 1, limit: 20 }
    });
    return data;
  } catch (error) {
    if (error.response) {
      // Server responded with error
      console.error('API Error:', error.response.data);
      console.error('Status:', error.response.status);
    } else {
      // Network error
      console.error('Network Error:', error.message);
    }
    throw error;
  }
};

// Create job
const createJob = async (jobData) => {
  const { data } = await api.post('/jobs-create', jobData);
  return data;
};`)}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`import axios from 'axios';

const api = axios.create({
  baseURL: '${baseUrl}',
  headers: {
    'X-Api-Key': API_KEY,
    'Content-Type': 'application/json'
  }
});

// Search jobs
const searchJobs = async (query, location) => {
  try {
    const { data } = await api.get('/jobs-search', {
      params: { query, location, page: 1, limit: 20 }
    });
    return data;
  } catch (error) {
    if (error.response) {
      // Server responded with error
      console.error('API Error:', error.response.data);
      console.error('Status:', error.response.status);
    } else {
      // Network error
      console.error('Network Error:', error.message);
    }
    throw error;
  }
};

// Create job
const createJob = async (jobData) => {
  const { data } = await api.post('/jobs-create', jobData);
  return data;
};`}
              </pre>
            </CardContent>
          </Card>

          {/* TypeScript Support */}
          <Card>
            <CardHeader>
              <CardTitle>TypeScript Support</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Define types for better type safety:
              </p>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Type definitions:</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyCode(`// types.ts
export interface Job {
  id: string;
  title: string;
  description: string;
  location: string;
  salary_min?: number;
  salary_max?: number;
  skills: string[];
  created_at: string;
}

export interface JobSearchParams {
  query?: string;
  location?: string;
  page?: number;
  limit?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// api.ts
const searchJobs = async (params: JobSearchParams): Promise<ApiResponse<Job[]>> => {
  const queryParams = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)])
  );

  const response = await fetch(\`${baseUrl}/jobs-search?\${queryParams}\`, {
    headers: {
      'X-Api-Key': API_KEY,
      'Content-Type': 'application/json'
    }
  });

  return response.json();
};`)}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`// types.ts
export interface Job {
  id: string;
  title: string;
  description: string;
  location: string;
  salary_min?: number;
  salary_max?: number;
  skills: string[];
  created_at: string;
}

export interface JobSearchParams {
  query?: string;
  location?: string;
  page?: number;
  limit?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// api.ts
const searchJobs = async (params: JobSearchParams): Promise<ApiResponse<Job[]>> => {
  const queryParams = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)])
  );

  const response = await fetch(\`${baseUrl}/jobs-search?\${queryParams}\`, {
    headers: {
      'X-Api-Key': API_KEY,
      'Content-Type': 'application/json'
    }
  });

  return response.json();
};`}
              </pre>
            </CardContent>
          </Card>

          {/* SDK Guide & FAQ */}
          <SDKGuide sdkName="JavaScript/TypeScript" language="javascript" />
        </div>
      </div>
    </div>
  );
};

export default JavaScriptSDK;
