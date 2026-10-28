import CopyPageButton from "@/components/docs/CopyPageButton";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Code, Copy, CheckCircle, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const Examples = () => {
  const navigate = useNavigate();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const tutorials = [
    {
      id: "job-board-30min",
      title: "Build a Job Board in 30 Minutes",
      difficulty: "Medium",
      time: "30 minutes",
      description: "Create a full-featured job board with search, filters, and pagination",
      technologies: ["React", "TypeScript", "Tailwind CSS"],
      features: [
        "Job search with keywords",
        "Location-based filtering",
        "Job type filters (Full-time, Part-time, etc.)",
        "Pagination for results",
        "Responsive design",
        "Job detail modal"
      ],
      code: {
        react: `// JobBoard.tsx - Complete React Component
import React, { useState, useEffect } from 'react';

const API_KEY = 'your-api-key';
const BASE_URL = 'https://YOUR_PROJECT_ID.supabase.co/functions/v1';

interface Job {
  id: string;
  title: string;
  location: string;
  job_type: string;
  salary_min?: number;
  salary_max?: number;
  companies?: { company_name: string; logo_url?: string };
}

export default function JobBoard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [location, setLocation] = useState('');
  const [jobType, setJobType] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const searchJobs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        ...(searchQuery && { search_query: searchQuery }),
        ...(location && { location }),
        ...(jobType && { job_type: jobType }),
        page: page.toString(),
        limit: '20'
      });

      const response = await fetch(\`\${BASE_URL}/jobs-search?\${params}\`, {
        headers: {
          'X-Api-Key': API_KEY,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (data.success) {
        setJobs(data.data.jobs);
        setTotalPages(Math.ceil(data.data.pagination.total / 20));
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    searchJobs();
  }, [page]);

  return (
    <div className="max-w-7xl mx-auto p-4">
      {/* Search Bar */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h1 className="text-3xl font-bold mb-6">Find Your Dream Job</h1>
        <div className="grid md:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="Job title, keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          />
          <input
            type="text"
            placeholder="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          />
          <select
            value={jobType}
            onChange={(e) => setJobType(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="">All Job Types</option>
            <option value="full-time">Full-time</option>
            <option value="part-time">Part-time</option>
            <option value="contract">Contract</option>
            <option value="internship">Internship</option>
          </select>
          <button
            onClick={() => { setPage(1); searchJobs(); }}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Search
          </button>
        </div>
      </div>

      {/* Job Listings */}
      <div className="space-y-4">
        {loading ? (
          <div>Loading...</div>
        ) : (
          jobs.map((job) => (
            <div key={job.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
              <div className="flex items-start gap-4">
                {job.companies?.logo_url && (
                  <img referrerPolicy="no-referrer"
                    src={job.companies.logo_url}
                    alt={job.companies.company_name}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                )}
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2">{job.title}</h3>
                  <p className="text-gray-600 mb-2">{job.companies?.company_name}</p>
                  <div className="flex gap-3 text-sm text-gray-500">
                    <span>📍 {job.location}</span>
                    <span>💼 {job.job_type}</span>
                    {job.salary_min && job.salary_max && (
                      <span>💰 ₹{job.salary_min} - ₹{job.salary_max}</span>
                    )}
                  </div>
                </div>
                <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
                  Apply Now
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      <div className="mt-8 flex justify-center gap-2">
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          className="px-4 py-2 border rounded-lg disabled:opacity-50"
        >
          Previous
        </button>
        <span className="px-4 py-2">Page {page} of {totalPages}</span>
        <button
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          className="px-4 py-2 border rounded-lg disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}`
      }
    },
    {
      id: "application-system",
      title: "Integrate Application System",
      difficulty: "Medium",
      time: "45 minutes",
      description: "Allow users to apply for jobs through your platform with resume upload",
      technologies: ["React", "TypeScript", "Supabase Storage"],
      features: [
        "Job application form",
        "Resume file upload",
        "Cover letter text area",
        "Duplicate application check",
        "Success/error notifications",
        "Application status tracking"
      ],
      code: {
        react: `// ApplicationForm.tsx
import React, { useState } from 'react';

const API_KEY = 'your-api-key';
const BASE_URL = 'https://YOUR_PROJECT_ID.supabase.co/functions/v1';

interface Props {
  jobId: string;
  jobTitle: string;
  companyName: string;
}

export default function ApplicationForm({ jobId, jobTitle, companyName }: Props) {
  const [coverLetter, setCoverLetter] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Upload resume to storage (if provided)
      let resumeUrl = '';
      if (resumeFile) {
        // You'll need to implement storage upload
        // For now, assuming resume_url is optional
        resumeUrl = 'https://storage.example.com/resumes/resume.pdf';
      }

      // 2. Submit application via API
      const response = await fetch(\`\${BASE_URL}/applications-create\`, {
        method: 'POST',
        headers: {
          'X-Api-Key': API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          job_id: jobId,
          cover_letter: coverLetter,
          ...(resumeUrl && { resume_url: resumeUrl })
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        setTimeout(() => {
          // Redirect or close modal
          window.location.href = '/applications';
        }, 2000);
      } else {
        alert(data.error || 'Failed to submit application');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to submit application');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold mb-2">Application Submitted!</h2>
        <p className="text-gray-600">
          Your application for {jobTitle} at {companyName} has been submitted successfully.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h2 className="text-2xl font-bold mb-2">Apply for {jobTitle}</h2>
      <p className="text-gray-600 mb-6">{companyName}</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Cover Letter */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Cover Letter <span className="text-red-500">*</span>
          </label>
          <textarea
            value={coverLetter}
            onChange={(e) => setCoverLetter(e.target.value)}
            required
            rows={8}
            maxLength={5000}
            placeholder="Tell us why you're a great fit for this position..."
            className="w-full px-4 py-2 border rounded-lg"
          />
          <p className="text-sm text-gray-500 mt-1">
            {coverLetter.length} / 5000 characters
          </p>
        </div>

        {/* Resume Upload */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Resume (Optional if profile has resume)
          </label>
          <input
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
            className="w-full px-4 py-2 border rounded-lg"
          />
          <p className="text-sm text-gray-500 mt-1">
            PDF, DOC, or DOCX format, max 5MB
          </p>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || !coverLetter.trim()}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Submitting...' : 'Submit Application'}
        </button>

        <p className="text-sm text-gray-500 text-center">
          Your application will be sent to the employer immediately.
          You'll receive a confirmation notification.
        </p>
      </form>
    </div>
  );
}`
      }
    },
    {
      id: "company-directory",
      title: "Create Company Directory",
      difficulty: "Easy",
      time: "20 minutes",
      description: "Display all hiring companies with verification badges and active jobs",
      technologies: ["React", "TypeScript"],
      features: [
        "Company grid/list view",
        "Verification badges",
        "Active jobs count",
        "Industry filters",
        "Company size filters",
        "Link to company details"
      ],
      code: {
        react: `// CompanyDirectory.tsx
import React, { useState, useEffect } from 'react';

const API_KEY = 'your-api-key';
const BASE_URL = 'https://YOUR_PROJECT_ID.supabase.co/functions/v1';

interface Company {
  id: string;
  company_name: string;
  logo_url?: string;
  description?: string;
  is_verified: boolean;
  industry?: string;
  company_size?: string;
  active_jobs_count: number;
}

export default function CompanyDirectory() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [selectedIndustry, setSelectedIndustry] = useState('');

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        ...(verifiedOnly && { verified: 'true' }),
        ...(selectedIndustry && { industry: selectedIndustry })
      });

      const response = await fetch(\`\${BASE_URL}/companies-list?\${params}\`, {
        headers: {
          'X-Api-Key': API_KEY,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (data.success) {
        setCompanies(data.data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, [verifiedOnly, selectedIndustry]);

  return (
    <div className="max-w-7xl mx-auto p-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Hiring Companies</h1>
        <p className="text-gray-600">
          Explore {companies.length}+ companies actively hiring
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6 flex gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={(e) => setVerifiedOnly(e.target.checked)}
          />
          <span>Verified Only</span>
        </label>
        
        <select
          value={selectedIndustry}
          onChange={(e) => setSelectedIndustry(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="">All Industries</option>
          <option value="technology">Technology</option>
          <option value="finance">Finance</option>
          <option value="healthcare">Healthcare</option>
          <option value="education">Education</option>
        </select>
      </div>

      {/* Company Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div>Loading...</div>
        ) : (
          companies.map((company) => (
            <div
              key={company.id}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition cursor-pointer"
              onClick={() => window.location.href = \`/company/\${company.id}\`}
            >
              {/* Logo & Verification */}
              <div className="flex items-start justify-between mb-4">
                {company.logo_url ? (
                  <img referrerPolicy="no-referrer"
                    src={company.logo_url}
                    alt={company.company_name}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">🏢</span>
                  </div>
                )}
                {company.is_verified && (
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-semibold">
                    ✓ Verified
                  </span>
                )}
              </div>

              {/* Company Info */}
              <h3 className="text-xl font-semibold mb-2">{company.company_name}</h3>
              {company.description && (
                <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                  {company.description}
                </p>
              )}

              {/* Meta Info */}
              <div className="flex justify-between text-sm text-gray-500 mb-3">
                <span>🏢 {company.company_size || 'Unknown'}</span>
                <span>📊 {company.industry || 'Other'}</span>
              </div>

              {/* Active Jobs */}
              <div className="pt-3 border-t">
                <span className="text-blue-600 font-semibold">
                  {company.active_jobs_count} Active Jobs
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}`
      }
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
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
            <CopyPageButton title="API Examples" />
          </div>
          
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Code className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Code Examples Library</h1>
              <p className="text-muted-foreground mt-1">Complete tutorials and real-world integration examples</p>
            </div>
          </div>
        </div>

        {/* Tutorials */}
        <div className="space-y-8">
          {tutorials.map((tutorial) => (
            <Card key={tutorial.id}>
              <CardHeader>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <CardTitle className="text-2xl mb-2">{tutorial.title}</CardTitle>
                    <p className="text-muted-foreground">{tutorial.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={tutorial.difficulty === 'Easy' ? 'secondary' : 'default'}>
                      {tutorial.difficulty}
                    </Badge>
                    <Badge variant="outline">⏱️ {tutorial.time}</Badge>
                  </div>
                </div>

                {/* Technologies */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {tutorial.technologies.map((tech, idx) => (
                    <Badge key={idx} variant="outline" className="bg-blue-50">
                      {tech}
                    </Badge>
                  ))}
                </div>

                {/* Features */}
                <div>
                  <h4 className="font-semibold text-foreground mb-2">What you'll build:</h4>
                  <div className="grid md:grid-cols-2 gap-2">
                    {tutorial.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <Tabs defaultValue="react">
                  <TabsList>
                    <TabsTrigger value="react">React</TabsTrigger>
                  </TabsList>

                  <TabsContent value="react" className="mt-4">
                    <div className="relative">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute top-2 right-2 z-10"
                        onClick={() => copyToClipboard(tutorial.code.react, tutorial.id)}
                      >
                        {copiedId === tutorial.id ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <pre className="bg-slate-900 text-slate-50 p-4 rounded-lg overflow-x-auto text-xs max-h-[600px]">
                        <code>{tutorial.code.react}</code>
                      </pre>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* More Examples Coming */}
        <Card className="mt-8 bg-gradient-to-br from-primary/10 via-purple-50 to-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="text-center">
              <h3 className="text-xl font-bold text-foreground mb-2">More Examples Coming Soon!</h3>
              <p className="text-muted-foreground mb-4">
                We're constantly adding new tutorials and code examples. Check back soon for:
              </p>
              <div className="grid md:grid-cols-3 gap-3 mb-6">
                <div className="text-sm text-muted-foreground">📱 Mobile App Integration</div>
                <div className="text-sm text-muted-foreground">🔔 Webhook Implementation</div>
                <div className="text-sm text-muted-foreground">🎯 Advanced Filtering</div>
              </div>
              <div className="flex gap-3 justify-center">
                <Button onClick={() => navigate('/owner-portal/api-docs')}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Full Documentation
                </Button>
                <Button variant="outline" onClick={() => navigate('/contact-us')}>
                  Request an Example
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Examples;
