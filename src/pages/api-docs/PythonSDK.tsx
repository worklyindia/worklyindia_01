import CopyPageButton from "@/components/docs/CopyPageButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Terminal, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SDKGuide } from "@/components/api/SDKGuide";

const PythonSDK = () => {
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
          <CopyPageButton title="Python SDK" />
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Terminal className="w-8 h-8 text-blue-600" />
              <h1 className="text-3xl md:text-4xl font-bold text-foreground">
                Python SDK
              </h1>
            </div>
            <p className="text-muted-foreground text-lg">
              Backend integration using Python requests library
            </p>
          </div>

          <Separator />

          {/* SDK Note */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No pip package required! Use the standard requests library to call the API directly.
            </AlertDescription>
          </Alert>

          {/* Installation */}
          <Card>
            <CardHeader>
              <CardTitle>Installation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">Install requests library:</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyCode('pip install requests')}
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Copy
                  </Button>
                </div>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
pip install requests
                </pre>
              </div>
            </CardContent>
          </Card>

          {/* Quick Start */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Start</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Initialize your API configuration:</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyCode(`import requests

API_KEY = 'your-api-key'
BASE_URL = '${baseUrl}'

headers = {
    'X-Api-Key': API_KEY,
    'Content-Type': 'application/json'
}`)}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`import requests

API_KEY = 'your-api-key'
BASE_URL = '${baseUrl}'

headers = {
    'X-Api-Key': API_KEY,
    'Content-Type': 'application/json'
}`}
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
                  onClick={() => copyCode(`# Search for jobs
def search_jobs(query, location, page=1, limit=20):
    params = {
        'search_query': query,
        'location': location,
        'page': page,
        'limit': limit
    }
    
    response = requests.get(
        f'${baseUrl}/jobs-search',
        headers=headers,
        params=params
    )
    
    response.raise_for_status()  # Raises an HTTPError for bad responses
    return response.json()

# Usage
jobs = search_jobs('developer', 'mumbai')
print(f'Found {len(jobs.get("data", []))} jobs')
for job in jobs.get('data', []):
    print(f'{job["title"]} at {job.get("company", {}).get("name", "Unknown")}')`)}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`# Search for jobs
def search_jobs(query, location, page=1, limit=20):
    params = {
        'search_query': query,
        'location': location,
        'page': page,
        'limit': limit
    }
    
    response = requests.get(
        f'${baseUrl}/jobs-search',
        headers=headers,
        params=params
    )
    
    response.raise_for_status()  # Raises an HTTPError for bad responses
    return response.json()

# Usage
jobs = search_jobs('developer', 'mumbai')
print(f'Found {len(jobs.get("data", []))} jobs')
for job in jobs.get('data', []):
    print(f'{job["title"]} at {job.get("company", {}).get("name", "Unknown")}')`}
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
                  onClick={() => copyCode(`# Get job details by ID
def get_job_details(job_id: str) -> dict:
    """
    Fetch complete job details including company info, skills, requirements
    
    Args:
        job_id: UUID of the job
        
    Returns:
        dict: Complete job data or None if not found
    """
    try:
        params = {'job_id': job_id}
        response = requests.get(
            f'${baseUrl}/jobs-search',
            headers=headers,
            params=params
        )
        response.raise_for_status()
        data = response.json()
        
        if data.get('success') and len(data.get('data', [])) > 0:
            job = data['data'][0]
            print(f"Job Title: {job['title']}")
            print(f"Company: {job['company_name']}")
            print(f"Location: {job['location']}")
            print(f"Salary: {job['salary_currency']} {job['salary_min']} - {job['salary_max']}")
            print(f"Skills: {', '.join(job['skills'])}")
            print(f"Workly India: {job['remote_work']}")
            print(f"Applications: {job['application_count']}")
            return job
        else:
            print("Job not found")
            return None
            
    except requests.exceptions.HTTPError as e:
        print(f"HTTP Error: {e}")
        return None

# Usage
job_details = get_job_details('123e4567-e89b-12d3-a456-426614174000')`)}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`# Get job details by ID
def get_job_details(job_id: str) -> dict:
    """
    Fetch complete job details including company info, skills, requirements
    
    Args:
        job_id: UUID of the job
        
    Returns:
        dict: Complete job data or None if not found
    """
    try:
        params = {'job_id': job_id}
        response = requests.get(
            f'${baseUrl}/jobs-search',
            headers=headers,
            params=params
        )
        response.raise_for_status()
        data = response.json()
        
        if data.get('success') and len(data.get('data', [])) > 0:
            job = data['data'][0]
            print(f"Job Title: {job['title']}")
            print(f"Company: {job['company_name']}")
            print(f"Location: {job['location']}")
            print(f"Salary: {job['salary_currency']} {job['salary_min']} - {job['salary_max']}")
            print(f"Skills: {', '.join(job['skills'])}")
            print(f"Workly India: {job['remote_work']}")
            print(f"Applications: {job['application_count']}")
            return job
        else:
            print("Job not found")
            return None
            
    except requests.exceptions.HTTPError as e:
        print(f"HTTP Error: {e}")
        return None

# Usage
job_details = get_job_details('123e4567-e89b-12d3-a456-426614174000')`}
              </pre>
            </CardContent>
          </Card>

          {/* Boost Job with Wallet */}
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
                  onClick={() => copyCode(`# Boost a job with wallet
def boost_job_with_wallet(job_id, boost_package_id):
    response = requests.post(
        f'${baseUrl}/jobs-boost-wallet',
        headers=headers,
        json={
            'job_id': job_id,
            'boost_package_id': boost_package_id
        }
    )
    
    response.raise_for_status()
    return response.json()

# Usage
result = boost_job_with_wallet('job-uuid-here', 'boost-package-uuid')
print(f'Job boosted. Remaining balance: {result.get("data", {}).get("remaining_balance")}')`)}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`# Boost a job with wallet
def boost_job_with_wallet(job_id, boost_package_id):
    response = requests.post(
        f'${baseUrl}/jobs-boost-wallet',
        headers=headers,
        json={
            'job_id': job_id,
            'boost_package_id': boost_package_id
        }
    )
    
    response.raise_for_status()
    return response.json()

# Usage
result = boost_job_with_wallet('job-uuid-here', 'boost-package-uuid')
print(f'Job boosted. Remaining balance: {result.get("data", {}).get("remaining_balance")}')`}
              </pre>
            </CardContent>
          </Card>

          {/* Extend Job with Wallet */}
          <Card>
            <CardHeader>
              <CardTitle>Extend Job Duration with Wallet</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Extend job duration using wallet points (50 points/month):</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyCode(`# Extend job with wallet
def extend_job_with_wallet(job_id, duration_months):
    response = requests.post(
        f'${baseUrl}/wallet-job-extension',
        headers=headers,
        json={
            'job_id': job_id,
            'duration_months': duration_months  # 1, 2, 3, or 6
        }
    )
    
    response.raise_for_status()
    return response.json()

# Usage
result = extend_job_with_wallet('job-uuid-here', 3)
print(f'Job extended to: {result.get("data", {}).get("new_expiry_date")}')`)}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`# Extend job with wallet
def extend_job_with_wallet(job_id, duration_months):
    response = requests.post(
        f'${baseUrl}/wallet-job-extension',
        headers=headers,
        json={
            'job_id': job_id,
            'duration_months': duration_months  # 1, 2, 3, or 6
        }
    )
    
    response.raise_for_status()
    return response.json()

# Usage
result = extend_job_with_wallet('job-uuid-here', 3)
print(f'Job extended to: {result.get("data", {}).get("new_expiry_date")}')`}
              </pre>
            </CardContent>
          </Card>

          {/* Boost Job with API Key */}
          <Card>
            <CardHeader>
              <CardTitle>Boost Job (API Key)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Boost job using API key with payment:</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyCode(`# Boost job via API key
def boost_job_api(job_id, boost_level, duration_days):
    response = requests.post(
        f'${baseUrl}/jobs-boost',
        headers=headers,
        json={
            'job_id': job_id,
            'boost_level': boost_level,  # 1, 2, or 3
            'duration_days': duration_days  # 7, 14, or 30
        }
    )
    
    response.raise_for_status()
    return response.json()

# Usage
result = boost_job_api('job-uuid-here', 1, 7)
print(f'Job boosted with level {result.get("data", {}).get("boost_level")}')`)}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`# Boost job via API key
def boost_job_api(job_id, boost_level, duration_days):
    response = requests.post(
        f'${baseUrl}/jobs-boost',
        headers=headers,
        json={
            'job_id': job_id,
            'boost_level': boost_level,  # 1, 2, or 3
            'duration_days': duration_days  # 7, 14, or 30
        }
    )
    
    response.raise_for_status()
    return response.json()

# Usage
result = boost_job_api('job-uuid-here', 1, 7)
print(f'Job boosted with level {result.get("data", {}).get("boost_level")}')`}
              </pre>
            </CardContent>
          </Card>

          {/* Extend Job with API Key */}
          <Card>
            <CardHeader>
              <CardTitle>Extend Job Duration (API Key)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Extend job duration via API key:</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyCode(`# Extend job via API key
def extend_job_api(job_id, duration_months):
    response = requests.post(
        f'${baseUrl}/jobs-extend',
        headers=headers,
        json={
            'job_id': job_id,
            'duration_months': duration_months  # 1, 2, 3, or 6
        }
    )
    
    response.raise_for_status()
    return response.json()

# Usage
result = extend_job_api('job-uuid-here', 3)
print(f'Extended by {result.get("data", {}).get("duration_months")} months')`)}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`# Extend job via API key
def extend_job_api(job_id, duration_months):
    response = requests.post(
        f'${baseUrl}/jobs-extend',
        headers=headers,
        json={
            'job_id': job_id,
            'duration_months': duration_months  # 1, 2, 3, or 6
        }
    )
    
    response.raise_for_status()
    return response.json()

# Usage
result = extend_job_api('job-uuid-here', 3)
print(f'Extended by {result.get("data", {}).get("duration_months")} months')`}
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
                  onClick={() => copyCode(`# Post a new job
def create_job(job_data):
    response = requests.post(
        f'${baseUrl}/jobs-create',
        headers=headers,
        json=job_data
    )
    
    response.raise_for_status()
    return response.json()

# Usage
new_job = create_job({
    'title': 'Senior Developer',
    'description': 'Looking for experienced developer',
    'location': 'Mumbai',
    'salary_min': 800000,
    'salary_max': 1200000,
    'salary_period': 'yearly',
    'salary_currency': 'INR',
    'skills': ['React', 'Node.js', 'MongoDB']
})

print(f'Job created with ID: {new_job.get("data", {}).get("id")}')`)}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`# Post a new job
def create_job(job_data):
    response = requests.post(
        f'${baseUrl}/jobs-create',
        headers=headers,
        json=job_data
    )
    
    response.raise_for_status()
    return response.json()

# Usage
new_job = create_job({
    'title': 'Senior Developer',
    'description': 'Looking for experienced developer',
    'location': 'Mumbai',
    'salary_min': 800000,
    'salary_max': 1200000,
    'salary_period': 'yearly',
    'salary_currency': 'INR',
    'skills': ['React', 'Node.js', 'MongoDB']
})

print(f'Job created with ID: {new_job.get("data", {}).get("id")}')`}
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
                  onClick={() => copyCode(`from requests.exceptions import HTTPError, RequestException

def api_call_with_error_handling():
    try:
        response = requests.get(
            f'${baseUrl}/jobs-search',
            headers=headers,
            params={'query': 'developer'}
        )
        
        response.raise_for_status()
        return response.json()
        
    except HTTPError as e:
        if e.response.status_code == 429:
            print('Rate limit exceeded')
            retry_after = e.response.headers.get('Retry-After')
            print(f'Retry after: {retry_after} seconds')
        elif e.response.status_code == 401:
            print('Invalid API key')
        else:
            print(f'HTTP Error: {e.response.status_code}')
            print(f'Response: {e.response.text}')
        raise
        
    except RequestException as e:
        print(f'Request failed: {str(e)}')
        raise`)}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`from requests.exceptions import HTTPError, RequestException

def api_call_with_error_handling():
    try:
        response = requests.get(
            f'${baseUrl}/jobs-search',
            headers=headers,
            params={'search_query': 'developer'}
        )
        
        response.raise_for_status()
        return response.json()
        
    except HTTPError as e:
        if e.response.status_code == 429:
            print('Rate limit exceeded')
            retry_after = e.response.headers.get('Retry-After')
            print(f'Retry after: {retry_after} seconds')
        elif e.response.status_code == 401:
            print('Invalid API key')
        else:
            print(f'HTTP Error: {e.response.status_code}')
            print(f'Response: {e.response.text}')
        raise
        
    except RequestException as e:
        print(f'Request failed: {str(e)}')
        raise`}
              </pre>
            </CardContent>
          </Card>

          {/* Async Support */}
          <Card>
            <CardHeader>
              <CardTitle>Async Support (with aiohttp)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Install aiohttp: <code className="bg-muted px-2 py-1 rounded">pip install aiohttp</code>
              </p>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Async example:</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyCode(`import aiohttp
import asyncio

async def search_jobs_async(query, location):
    async with aiohttp.ClientSession() as session:
        params = {'query': query, 'location': location}
        
        async with session.get(
            f'${baseUrl}/jobs-search',
            headers=headers,
            params=params
        ) as response:
            response.raise_for_status()
            return await response.json()

async def create_multiple_jobs(jobs_data):
    async with aiohttp.ClientSession() as session:
        tasks = []
        
        for job_data in jobs_data:
            task = session.post(
                f'${baseUrl}/jobs-create',
                headers=headers,
                json=job_data
            )
            tasks.append(task)
        
        responses = await asyncio.gather(*tasks)
        return [await r.json() for r in responses]

# Usage
async def main():
    jobs = await search_jobs_async('developer', 'mumbai')
    print(f'Found {len(jobs.get("data", []))} jobs')

asyncio.run(main())`)}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`import aiohttp
import asyncio

async def search_jobs_async(query, location):
    async with aiohttp.ClientSession() as session:
        params = {'search_query': query, 'location': location}
        
        async with session.get(
            f'${baseUrl}/jobs-search',
            headers=headers,
            params=params
        ) as response:
            response.raise_for_status()
            return await response.json()

async def create_multiple_jobs(jobs_data):
    async with aiohttp.ClientSession() as session:
        tasks = []
        
        for job_data in jobs_data:
            task = session.post(
                f'${baseUrl}/jobs-create',
                headers=headers,
                json=job_data
            )
            tasks.append(task)
        
        responses = await asyncio.gather(*tasks)
        return [await r.json() for r in responses]

# Usage
async def main():
    jobs = await search_jobs_async('developer', 'mumbai')
    print(f'Found {len(jobs.get("data", []))} jobs')

asyncio.run(main())`}
              </pre>
            </CardContent>
          </Card>

          {/* Pagination Helper */}
          <Card>
            <CardHeader>
              <CardTitle>Pagination Helper</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Easily paginate through results:</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyCode(`def paginated_search(query, location, limit=50):
    """Generator function to iterate through all pages"""
    page = 1
    
    while True:
        response = requests.get(
            f'${baseUrl}/jobs-search',
            headers=headers,
            params={
                'query': query,
                'location': location,
                'page': page,
                'limit': limit
            }
        )
        
        response.raise_for_status()
        data = response.json()
        
        jobs = data.get('data', [])
        if not jobs:
            break
            
        yield jobs
        
        # Check if there are more pages
        meta = data.get('meta', {})
        if page >= meta.get('total_pages', 1):
            break
            
        page += 1

# Usage
for page_jobs in paginated_search('developer', 'mumbai'):
    for job in page_jobs:
        print(f'Job: {job["title"]}')`)}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`def paginated_search(query, location, limit=50):
    """Generator function to iterate through all pages"""
    page = 1
    
    while True:
        response = requests.get(
            f'${baseUrl}/jobs-search',
            headers=headers,
            params={
                'search_query': query,
                'location': location,
                'page': page,
                'limit': limit
            }
        )
        
        response.raise_for_status()
        data = response.json()
        
        jobs = data.get('data', [])
        if not jobs:
            break
            
        yield jobs
        
        # Check if there are more pages
        meta = data.get('meta', {})
        if page >= meta.get('total_pages', 1):
            break
            
        page += 1

# Usage
for page_jobs in paginated_search('developer', 'mumbai'):
    for job in page_jobs:
        print(f'Job: {job["title"]}')`}
              </pre>
            </CardContent>
          </Card>

          {/* SDK Guide & FAQ */}
          <SDKGuide sdkName="Python" language="python" />
        </div>
      </div>
    </div>
  );
};

export default PythonSDK;
