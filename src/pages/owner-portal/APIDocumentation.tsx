import { confirmDialog } from '@/lib/confirmDialog';
import OAuthAppRegister from "@/components/developers/OAuthAppRegister";
import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { APIPlayground } from "@/components/api/APIPlayground";
import { APIAnalytics } from "@/components/api/APIAnalytics";
import { APIHealthMonitor } from "@/components/api/APIHealthMonitor";
import { SDKTester } from "@/components/api/SDKTester";
import { RealTimeStatus } from "@/components/api/RealTimeStatus";
import { WebhookManager } from "@/components/api/WebhookManager";
import { formatDateWithSeconds } from "@/utils/dateFormatUtils";
import { 
  Book, 
  Search, 
  Code, 
  Copy, 
  CheckCircle,
  ExternalLink,
  Globe,
  Database,
  Zap,
  Shield,
  Users,
  Activity,
  Key,
  CreditCard,
  ScrollText,
  Trash2,
  ChevronDown,
  ChevronUp,
  Download,
  Terminal,
  AlertTriangle,
  ArrowLeft,
  Menu,
  Home
, Receipt } from "lucide-react";
import LottieSearchIcon from "@/components/LottieSearchIcon";
import { MessageSquare as MessageSquareIcon, Mail as MailIcon, ShieldCheck as ShieldCheckIcon, Handshake as HandshakeIcon, Instagram as InstagramIcon, Facebook as FacebookIcon, Briefcase as BriefcaseIcon, UserCircle as UserCircleIcon, Gauge as GaugeIcon } from "lucide-react";
const MessageSquare = MessageSquareIcon;

interface ApiKey {
  id: string;
  key_name: string;
  api_key: string;
  key_prefix: string;
  rate_limit_tier: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
  usage_count: number;
}

const MAX_API_KEYS = 1;

const APIDocumentation = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showManageKeysModal, setShowManageKeysModal] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [expandedPlayground, setExpandedPlayground] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('endpoints');
  const [devMenuOpen, setDevMenuOpen] = useState(false);
  const [keySheetViewport, setKeySheetViewport] = useState<{ bottom: number; height: number } | null>(null);
  const [devAvatar, setDevAvatar] = useState('');
  const [devName, setDevName] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await (supabase as any)
        .from('developer_profiles')
        .select('avatar_url, full_name')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setDevAvatar(data.avatar_url || '');
        setDevName(data.full_name || '');
      }
    })();
  }, []);

  useEffect(() => {
    fetchApiKeys();
  }, []);

  useEffect(() => {
    if (!showApiKeyModal || !window.visualViewport) {
      setKeySheetViewport(null);
      return;
    }

    const viewport = window.visualViewport;
    const updateKeySheetViewport = () => {
      const bottom = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      setKeySheetViewport({ bottom, height: viewport.height });
    };

    updateKeySheetViewport();
    viewport.addEventListener('resize', updateKeySheetViewport);
    viewport.addEventListener('scroll', updateKeySheetViewport);

    return () => {
      viewport.removeEventListener('resize', updateKeySheetViewport);
      viewport.removeEventListener('scroll', updateKeySheetViewport);
    };
  }, [showApiKeyModal]);

  const fetchApiKeys = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApiKeys(data || []);
    } catch (error: unknown) {
      console.error('Error fetching API keys:', error);
      toast.error('Failed to fetch API keys');
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success('Copied to clipboard!');
  };

  const generateApiKey = async () => {
    if (apiKeys.length >= MAX_API_KEYS) {
      toast.error('Delete your existing API key before generating a new one.');
      return;
    }
    if (!newKeyName.trim()) {
      toast.error('Please enter a key name');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in');
        return;
      }

      // Generate a secure API key
      const randomPart = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      const apiKey = `wfh_${randomPart}`;
      const keyPrefix = `wfh_${randomPart.substring(0, 8)}...`;

      const { error } = await supabase
        .from('api_keys')
        .insert({
          user_id: user.id,
          key_name: newKeyName,
          api_key: apiKey,
          key_prefix: keyPrefix,
          rate_limit_tier: 'free'
        });

      if (error) throw error;

      // Copy the full key to clipboard
      navigator.clipboard.writeText(apiKey);
      
      toast.success('API Key generated and copied to clipboard! Save it securely - you won\'t see it again.');
      setShowApiKeyModal(false);
      setNewKeyName('');
      await fetchApiKeys();
    } catch (error: unknown) {
      console.error('Error generating API key:', error);
      const errorCode = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
      toast.error(errorCode === '23505' ? 'Delete your existing API key before generating a new one.' : 'Failed to generate API key');
    } finally {
      setLoading(false);
    }
  };

  const setApiKeyActive = async (keyId: string, active: boolean) => {
    try {
      const { error } = await supabase
        .from('api_keys')
        .update({ is_active: active })
        .eq('id', keyId);

      if (error) throw error;

      toast.success(active ? 'API key activated' : 'API key deactivated');
      await fetchApiKeys();
    } catch (error: unknown) {
      console.error('Error updating API key:', error);
      toast.error('Failed to update API key');
    }
  };

  const deleteApiKey = async (keyId: string) => {
    try {
      const { error } = await supabase
        .from('api_keys')
        .delete()
        .eq('id', keyId);

      if (error) throw error;

      toast.success('API key deleted successfully');
      await fetchApiKeys();
    } catch (error: unknown) {
      console.error('Error deleting API key:', error);
      toast.error('Failed to delete API key');
    }
  };

  const apiEndpoints = [
    {
      id: 'jobs-search',
      method: 'GET',
      endpoint: '/api/jobs/search',
      description: 'Search and filter active jobs with comprehensive filters, sorting, and pagination',
      category: 'Jobs',
      parameters: [
        { name: 'search_query', type: 'string', description: 'Search term for job titles, companies, descriptions, or skills' },
        { name: 'location', type: 'string', description: 'Filter by job location (e.g., Mumbai, Delhi, Remote)' },
        { name: 'job_type', type: 'string', description: 'Filter by job type: full-time, part-time, contract, internship, temporary' },
        { name: 'job_id', type: 'string', description: 'Get a specific job by UUID (returns single job if provided)' },
        { name: 'category', type: 'string', description: 'Filter by job category. Comma-separated for multiple (e.g., "Technology,Marketing")' },
        { name: 'skills', type: 'string', description: 'Filter by required skills. Comma-separated for multiple (e.g., "React,Node.js,Python")' },
        { name: 'experience_level', type: 'string', description: 'Filter by experience level: entry, intermediate, senior, 0-1, 1-3, 3-5, 5-10, 10+' },
        { name: 'languages', type: 'string', description: 'Filter by required languages. Comma-separated for multiple (e.g., "English,Hindi")' },
        { name: 'sort_by', type: 'string', description: 'Sort results: latest (default), salary_high, salary_low, experience' },
        { name: 'page', type: 'number', description: 'Page number for pagination. Default: 1' },
        { name: 'limit', type: 'number', description: 'Results per page (max 50). Default: 20' }
      ],
      example: `GET /api/jobs/search?search_query=developer&location=mumbai&job_type=full-time&sort_by=latest

Advanced Filtering Examples:

1. Multi-skill search:
GET /api/jobs/search?skills=React,Node.js&experience_level=1-3&sort_by=salary_high

2. Category + Language filter:
GET /api/jobs/search?category=Technology,Marketing&languages=English,Hindi&location=Remote

3. Specific job by ID:
GET /api/jobs/search?job_id=123e4567-e89b-12d3-a456-426614174000

Response includes:
- Job details with salary breakdown (min, max, period, currency)
- Company information (logo, verification status, badge color)
- Skills, languages, benefits, requirements arrays
- Category and experience level
- Location coordinates (latitude, longitude)
- Video URLs, responsibilities
- Application count per job
- Workly India and visa sponsorship flags
- Applied filters in response metadata`
    },
    {
      id: 'jobs-detail',
      method: 'GET',
      endpoint: '/api/jobs/{job_id}',
      description: 'Get detailed information about a specific job by ID including complete company details, skills, requirements, and all metadata',
      category: 'Jobs',
      parameters: [
        { name: 'job_id', type: 'string', description: 'Job ID - UUID format (required in URL path)', required: true }
      ],
      example: `GET /api/jobs/123e4567-e89b-12d3-a456-426614174000

Complete Response Example:
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "title": "Senior Full Stack Developer",
    "description": "We are looking for an experienced developer to join our growing team...",
    "company_id": "company-uuid-here",
    "company_name": "Tech Solutions India",
    "company_logo": "https://storage.supabase.co/v1/object/public/logos/company.jpg",
    "company_website": "https://techsolutions.in",
    "company_email": "hr@techsolutions.in",
    "company_phone": "+91-9876543210",
    "location": "Mumbai, Maharashtra",
    "latitude": 19.0760,
    "longitude": 72.8777,
    "job_type": "full-time",
    "category": "Technology",
    "experience_level": "3-5",
    "skills": ["React", "Node.js", "PostgreSQL", "TypeScript", "MongoDB"],
    "languages": ["English", "Hindi"],
    "benefits": [
      "Health Insurance",
      "Workly India",
      "Flexible Hours",
      "Learning Budget",
      "Performance Bonus"
    ],
    "requirements": [
      "Bachelor's degree in Computer Science or related field",
      "3+ years of experience in full-stack development",
      "Strong problem-solving skills",
      "Experience with cloud platforms (AWS/Azure/GCP)"
    ],
    "responsibilities": [
      "Develop and maintain web applications",
      "Collaborate with cross-functional teams",
      "Code reviews and mentoring junior developers",
      "Participate in architecture decisions"
    ],
    "salary_min": 800000,
    "salary_max": 1500000,
    "salary_period": "yearly",
    "salary_currency": "INR",
    "remote_work": true,
    "visa_sponsorship": false,
    "job_videos": [
      {
        "title": "Company Culture Overview",
        "url": "https://youtube.com/watch?v=example1"
      },
      {
        "title": "Day in the Life of a Developer",
        "url": "https://youtube.com/watch?v=example2"
      }
    ],
    "view_count": 1250,
    "application_count": 47,
    "is_active": true,
    "is_featured": false,
    "boost_level": 0,
    "created_at": "2025-11-01T10:00:00Z",
    "updated_at": "2025-11-10T15:30:00Z",
    "expires_at": "2025-12-01T10:00:00Z",
    "company_social_media": {
      "linkedin": "https://linkedin.com/company/techsolutions",
      "twitter": "https://twitter.com/techsolutions",
      "facebook": "https://facebook.com/techsolutions",
      "instagram": "https://instagram.com/techsolutions"
    }
  }
}

All Fields Explained:
- id, title, description: Basic job information
- company_*: Complete company details (name, logo, website, email, phone)
- location, latitude, longitude: Job location with coordinates
- job_type: full-time, part-time, contract, internship, temporary
- category: Job category/industry
- experience_level: Required experience (e.g., "0-1", "3-5", "10+")
- skills[]: Array of required technical skills
- languages[]: Array of required languages
- benefits[]: Array of job benefits/perks
- requirements[]: Array of job requirements
- responsibilities[]: Array of job responsibilities
- salary_min/max: Salary range in specified currency
- salary_period: yearly, monthly, hourly
- salary_currency: INR, USD, etc.
- remote_work: true/false - whether Workly India is allowed
- visa_sponsorship: true/false - whether visa sponsorship is provided
- job_videos[]: Array of video objects with title and URL
- view_count: Number of times job has been viewed
- application_count: Number of applications received
- is_active: Whether job is currently active
- is_featured: Whether job is featured on homepage
- boost_level: 0-3, indicates boost status
- created_at, updated_at, expires_at: Timestamp information
- company_social_media: Object with social media links`
    },
    {
      id: 'jobs-multiple',
      method: 'POST',
      endpoint: '/api/jobs/multiple',
      description: 'Fetch multiple jobs by providing an array of job IDs (max 50)',
      category: 'Jobs',
      parameters: [
        { name: 'job_ids', type: 'array', description: 'Array of job IDs (UUID format). Maximum 50 IDs per request', required: true }
      ],
      example: `POST /api/jobs/multiple
{
  "job_ids": [
    "123e4567-e89b-12d3-a456-426614174000",
    "987fcdeb-51a2-43e1-b456-426614174999",
    "456def89-01ab-23cd-ef45-678901234567"
  ]
}

Response: {
  "success": true,
  "data": {
    "jobs": [...array of job objects with company details...],
    "found": 3,
    "not_found": [],
    "requested": 3
  }
}

Features:
- Batch fetch up to 50 jobs in one request
- Returns complete job details with company info
- Shows which IDs were found vs not found
- Only returns active jobs`
    },
    {
      id: 'jobs-latest',
      method: 'GET',
      endpoint: '/api/jobs/latest',
      description: 'Get latest jobs sorted by creation date (newest first) with optional filters',
      category: 'Jobs',
      parameters: [
        { name: 'page', type: 'number', description: 'Page number for pagination. Default: 1' },
        { name: 'limit', type: 'number', description: 'Results per page (max 100). Default: 20' },
        { name: 'location', type: 'string', description: 'Optional: Filter by location' },
        { name: 'job_type', type: 'string', description: 'Optional: Filter by job type (full-time, part-time, contract, internship, temporary)' },
        { name: 'experience_level', type: 'string', description: 'Optional: Filter by experience level' }
      ],
      example: `GET /api/jobs/latest?page=1&limit=20&location=Mumbai

Response: {
  "success": true,
  "data": {
    "jobs": [
      {
        ...complete job details...,
        "created_at": "2025-11-13T10:30:00Z",
        "companies": {...company details...}
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "total_pages": 8,
      "has_more": true
    }
  }
}

Features:
- Jobs sorted by created_at DESC (newest first)
- Optional location, job_type, experience_level filters
- Full pagination with total counts
- Includes complete company information`
    },
    {
      id: 'jobs-trending',
      method: 'GET',
      endpoint: '/api/jobs/trending',
      description: 'Get trending jobs sorted by engagement score (views + applications + boost)',
      category: 'Jobs',
      parameters: [
        { name: 'page', type: 'number', description: 'Page number for pagination. Default: 1' },
        { name: 'limit', type: 'number', description: 'Results per page (max 100). Default: 20' },
        { name: 'location', type: 'string', description: 'Optional: Filter by location' },
        { name: 'job_type', type: 'string', description: 'Optional: Filter by job type' },
        { name: 'experience_level', type: 'string', description: 'Optional: Filter by experience level' },
        { name: 'include_boosted', type: 'boolean', description: 'Include boosted jobs in results. Default: true' }
      ],
      example: `GET /api/jobs/trending?page=1&limit=20&include_boosted=true

Response: {
  "success": true,
  "data": {
    "jobs": [
      {
        ...complete job details...,
        "trending_score": 450,
        "base_score": 250,
        "trending_rank": 1,
        "organic_rank": 3,
        "is_boosted": true,
        "boost_level": 2,
        "views_count": 1500,
        "applications_count": 25,
        "companies": {...company details...}
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "total_pages": 8,
      "has_more": true
    }
  }
}

Trending Score Formula:
- base_score = (views × 0.10) + (applications × 1.0)
- boost_bonus = boost_level × 100
- trending_score = base_score + boost_bonus

Features:
- Jobs sorted by trending_score DESC (highest engagement first)
- Shows trending rank and organic rank
- Optional filters (location, job_type, experience_level)
- Can exclude boosted jobs with include_boosted=false
- Includes engagement metrics (views, applications)
- Full company information`
    },
    {
      id: 'jobs-boost-wallet',
      method: 'POST',
      endpoint: '/api/jobs/boost',
      description: 'Boost a job post using wallet points to increase visibility',
      category: 'Jobs',
      parameters: [
        { name: 'job_id', type: 'string', description: 'Job ID - UUID format (required)', required: true },
        { name: 'boost_package_id', type: 'string', description: 'Boost package ID - UUID format (required)', required: true }
      ],
      example: `POST /api/jobs/boost
{
  "job_id": "123e4567-e89b-12d3-a456-426614174000",
  "boost_package_id": "boost-pkg-uuid"
}

Response: {
  "success": true,
  "data": {
    "job_id": "123e4567-e89b-12d3-a456-426614174000",
    "points_deducted": 200,
    "remaining_balance": 800
  }
}

Requirements:
- API key user must own the job
- Sufficient wallet balance required
- Job must not already be boosted`
    },
    {
      id: 'jobs-post',
      method: 'POST',
      endpoint: '/api/jobs',
      description: 'Create a new job posting with auto employer account/company creation (requires points deducted from API user wallet)',
      category: 'Jobs',
      parameters: [
        { name: 'title', type: 'string', description: 'Job title - 5-200 characters (required)' },
        { name: 'description', type: 'string', description: 'Job description - 20-10000 characters (required)' },
        { name: 'location', type: 'string', description: 'Job location (required)' },
        { name: 'job_type', type: 'string', description: 'Job type: full-time, part-time, contract, internship, temporary (required)' },
        { name: 'email', type: 'string', description: 'Employer email - Auto-creates/updates employer account (required)' },
        { name: 'company_name', type: 'string', description: 'Company name - Min 2 characters (required)' },
        { name: 'duration_months', type: 'number', description: 'Job duration in months. Pricing: 1 month=100pts, 2 months=120pts, 3 months=120pts, 6 months=200pts, 12 months=350pts' },
        { name: 'duration', type: 'number', description: 'LEGACY: Job duration in days (30, 90, or 180). Cost: 30=50pts, 90=150pts, 180=250pts. Use duration_months for package pricing.' },
        { name: 'hr_contact_name', type: 'string', description: 'HR contact person name' },
        { name: 'phone', type: 'string', description: 'Contact phone number' },
        { name: 'whatsapp_number', type: 'string', description: 'WhatsApp contact number' },
        { name: 'industry', type: 'string', description: 'Company industry (e.g., Technology, Healthcare)' },
        { name: 'organisation_size', type: 'string', description: 'Organization size (e.g., 1-10, 51-200, 201-500)' },
        { name: 'company_details', type: 'string', description: 'About company / company description' },
        { name: 'instagram_link', type: 'string', description: 'Instagram profile URL' },
        { name: 'facebook_link', type: 'string', description: 'Facebook page URL' },
        { name: 'linkedin_link', type: 'string', description: 'LinkedIn company URL' },
        { name: 'youtube_link', type: 'string', description: 'YouTube channel URL' },
        { name: 'experience_level', type: 'string', description: 'Experience level: entry, intermediate, senior. Default: intermediate' },
        { name: 'salary_min', type: 'number', description: 'Minimum salary' },
        { name: 'salary_max', type: 'number', description: 'Maximum salary' },
        { name: 'salary_period', type: 'string', description: 'Salary period: hourly, daily, weekly, monthly, yearly. Default: yearly' },
        { name: 'salary_currency', type: 'string', description: 'Salary currency. Default: INR' },
        { name: 'skills', type: 'array', description: 'Required skills array' },
        { name: 'languages', type: 'array', description: 'Required languages array' },
        { name: 'benefits', type: 'array', description: 'Job benefits array' },
        { name: 'requirements', type: 'array', description: 'Job requirements array' },
        { name: 'responsibilities', type: 'array', description: 'Job responsibilities array' },
        { name: 'video_url', type: 'string', description: 'LEGACY: Single video URL (no title). Use job_videos instead.' },
        { name: 'job_videos', type: 'array', description: 'Job videos (max 2). Format: [{title: "Video Title", url: "https://youtube.com/..."}]. Max title length: 60 chars.' },
        { name: 'video_title_1', type: 'string', description: 'First video title (max 60 characters)' },
        { name: 'video_url_1', type: 'string', description: 'First video YouTube URL' },
        { name: 'video_title_2', type: 'string', description: 'Second video title (max 60 characters)' },
        { name: 'video_url_2', type: 'string', description: 'Second video YouTube URL' },
        { name: 'latitude', type: 'number', description: 'Location latitude' },
        { name: 'longitude', type: 'number', description: 'Location longitude' },
        { name: 'remote_allowed', type: 'boolean', description: 'Whether Workly India is allowed. Default: false' },
        { name: 'visa_sponsorship', type: 'boolean', description: 'Whether visa sponsorship is available. Default: false' },
        { name: 'publish_immediately', type: 'boolean', description: 'Whether to publish immediately. Default: true' }
      ],
      example: `POST /api/jobs
{
  "title": "Senior Full Stack Developer",
  "description": "We are looking for an experienced full stack developer...",
  "location": "Mumbai, Maharashtra",
  "job_type": "full-time",
  "email": "employer@example.com",
  "company_name": "Tech Solutions Inc",
  "hr_contact_name": "John Doe",
  "phone": "+91 9876543210",
  "whatsapp_number": "+919876543210",
  "industry": "Technology",
  "organisation_size": "51-200",
  "company_details": "Leading technology solutions provider",
  "instagram_link": "https://instagram.com/techsolutions",
  "linkedin_link": "https://linkedin.com/company/techsolutions",
  "duration_months": 1,
  "experience_level": "senior",
  "salary_min": 800000,
  "salary_max": 1200000,
  "salary_period": "yearly",
  "skills": ["React", "Node.js", "MongoDB", "AWS"],
  "languages": ["English", "Hindi"],
  "remote_allowed": true,
  "visa_sponsorship": false,
  "job_videos": [
    {
      "title": "Company Culture & Work Environment",
      "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    },
    {
      "title": "Day in the Life of a Developer",
      "url": "https://www.youtube.com/watch?v=9bZkp7q19f0"
    }
  ]
}

Response: {
  "success": true,
  "data": {
    "job": { 
      ...job details (NO employer email/contact)...,
      "job_videos": [
        {
          "title": "Company Culture & Work Environment",
          "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        },
        {
          "title": "Day in the Life of a Developer",
          "url": "https://www.youtube.com/watch?v=9bZkp7q19f0"
        }
      ]
    },
    "points_deducted": 100,
    "remaining_balance": 900,
    "duration_info": {
      "days": 30,
      "months": 1,
      "expires_at": "2025-12-11T10:00:00Z"
    }
  },
  "message": "Job posted successfully! Company profile created for employer."
}

IMPORTANT:
- Points deducted from API user's wallet (NOT employer's wallet)
- Auto-creates employer auth account if email doesn't exist
- Auto-creates/updates company profile with provided details
- Employer profile data NOT included in API response
- Use duration_months for package pricing or duration for legacy pricing`
    },
    {
      id: 'companies-list',
      method: 'GET',
      endpoint: '/api/companies',
      description: 'Get list of companies with detailed profiles and recent jobs',
      category: 'Companies',
      parameters: [
        { name: 'verified', type: 'boolean', description: 'Filter by verification status (true/false)' },
        { name: 'industry', type: 'string', description: 'Filter by industry name' },
        { name: 'size', type: 'string', description: 'Filter by company size' }
      ],
      example: `GET /api/companies?verified=true&industry=technology

Response includes:
- Company profile (name, logo, description, website)
- Verification status and industry details
- Active jobs count
- Recent 5 jobs with details
- Contact information (email, phone)
- Company size and employee count
- Founded year and location`
    },
    {
      id: 'applications-submit',
      method: 'POST',
      endpoint: '/api/applications',
      description: 'Submit job application with duplicate check and notifications',
      category: 'Applications',
      parameters: [
        { name: 'job_id', type: 'string', description: 'Job ID - UUID format (required)' },
        { name: 'cover_letter', type: 'string', description: 'Cover letter text - max 5000 characters' },
        { name: 'resume_url', type: 'string', description: 'Resume file URL (optional if profile has resume)' }
      ],
      example: `POST /api/applications
{
  "job_id": "123e4567-e89b-12d3-a456-426614174000",
  "cover_letter": "I am very interested in this position because...",
  "resume_url": "https://storage.supabase.co/object/public/resumes/my-resume.pdf"
}

Response: {
  "success": true,
  "data": {
    "application": { ...application details... },
    "job": {
      "id": "...",
      "title": "Senior Developer",
      "company_name": "Tech Corp"
    }
  },
  "message": "Application submitted successfully"
}

Requirements:
- API key user must be a job_seeker account
- Account must not be banned
- Job must be active and accepting applications
- No duplicate applications allowed
- Employer receives notification automatically`
    }
  ];

  const webhooks = [
    {
      id: 'job-application',
      event: 'job.application.created',
      description: 'Triggered when a new job application is submitted with complete applicant and job details',
      payload: {
        job_id: 'string (UUID)',
        application_id: 'string (UUID)',
        timestamp: 'string (ISO 8601 datetime)',
        applicant: {
          id: 'string (UUID)',
          name: 'string | null',
          email: 'string',
          phone: 'string | null',
          whatsapp_number: 'string | null',
          location: 'string | null',
          skills: 'array of strings | null',
          current_position: 'string | null',
          company: 'string | null',
          experience_years: 'number | null',
          languages: 'array of strings | null',
          bio: 'string | null',
          profile_image_url: 'string | null'
        },
        application: {
          cover_letter: 'string | null',
          resume_url: 'string (URL)',
          status: 'string',
          applied_at: 'string (ISO 8601 datetime)',
          application_source: 'string',
          social_links: 'object | null',
          certifications: 'array | null',
          professional_experiences: 'array | null',
          education_entries: 'array | null'
        },
        job: {
          id: 'string (UUID)',
          title: 'string',
          status: 'string'
        },
        company: {
          name: 'string | null',
          industry: 'string | null',
          organisation_size: 'string | null',
          hr_contact_name: 'string | null',
          phone: 'string | null'
        },
        employer: {
          user_id: 'string (UUID) - Job creator/employer user ID',
          email: 'string | null - Employer email',
          whatsapp_number: 'string | null - Employer WhatsApp',
          phone: 'string | null - Employer phone',
          support_email: 'string | null - Support/HR email',
          hr_contact_name: 'string | null - HR contact name'
        }
      }
    },
    {
      id: 'job-boost',
      event: 'job.boost.activated',
      description: 'Triggered when a job boost is activated',
      payload: {
        job_id: 'string',
        boost_level: 'number',
        boost_end_date: 'ISO 8601 datetime'
      }
    }
  ];

  const sdks = [
    {
      name: 'JavaScript/TypeScript',
      language: 'javascript',
      description: 'Direct API integration using fetch or axios',
      installCommand: 'No installation required - use fetch or axios',
      documentation: '/api-docs/javascript-sdk',
      example: `const API_KEY = 'your-api-key';
const BASE_URL = 'https://jubwzelupbntbetpajqb.supabase.co/functions/v1';

// Search for jobs
const searchJobs = async (query, location) => {
  const params = new URLSearchParams({ search_query: query, location, page: '1', limit: '20' });
  const response = await fetch(\`\${BASE_URL}/jobs-search?\${params}\`, {
    headers: {
      'X-Api-Key': API_KEY,
      'Content-Type': 'application/json'
    }
  });
  return response.json();
};

// Create job
const createJob = async (jobData) => {
  const response = await fetch(\`\${BASE_URL}/jobs-create\`, {
    method: 'POST',
    headers: {
      'X-Api-Key': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(jobData)
  });
  return response.json();
};`
    },
    {
      name: 'Python',
      language: 'python',
      description: 'Backend integration using Python requests library',
      installCommand: 'pip install requests',
      documentation: '/api-docs/python-sdk',
      example: `import requests

API_KEY = 'your-api-key'
BASE_URL = 'https://jubwzelupbntbetpajqb.supabase.co/functions/v1'
headers = {
    'X-Api-Key': API_KEY,
    'Content-Type': 'application/json'
}

# Search for jobs
def search_jobs(query, location):
    params = {'search_query': query, 'location': location, 'page': 1, 'limit': 20}
    response = requests.get(f'{BASE_URL}/jobs-search', headers=headers, params=params)
    return response.json()

# Create job
def create_job(job_data):
    response = requests.post(f'{BASE_URL}/jobs-create', headers=headers, json=job_data)
    return response.json()`
    },
    {
      name: 'cURL',
      language: 'bash',
      description: 'Direct API calls using cURL for testing and debugging',
      installCommand: 'Available on all Unix-based systems',
      documentation: '/api-docs/curl-docs',
      example: `# Search for jobs
curl -X GET "https://jubwzelupbntbetpajqb.supabase.co/functions/v1/jobs-search?search_query=developer&location=mumbai" \\
  -H "X-Api-Key: your-api-key" \\
  -H "Content-Type: application/json"

# Post a new job
curl -X POST "https://jubwzelupbntbetpajqb.supabase.co/functions/v1/jobs-create" \\
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
    "skills": ["React", "Node.js"]
  }'`
    },
    {
      name: 'Postman Collection',
      language: 'postman',
      description: 'Ready-to-use collection with all endpoints including boost, extend, and applications',
      installCommand: 'Download and import into Postman',
      documentation: '/api-docs/postman-docs',
      example: `// Workly India API Collection Includes:
✅ Job Search - Find jobs with filters
✅ Job Boost (Wallet) - 100/200/300 pts per week
✅ Job Boost (API Key) - Levels 1-3, 7/14/30 days
✅ Job Extension (Wallet) - 50 pts per month
✅ Job Extension (API Key) - 1/2/3/6 months
✅ Applications Submit - Full application data

// Collection Features:
- Pre-configured authentication headers
- Environment variables (base_url, api_key, job_id)
- All request bodies with example data
- Success & error response examples
- Ready for immediate testing

// Quick Start:
1. Visit Postman Docs page
2. Download Workly-India-API-Collection.json
3. Import into Postman (File > Import)
4. Set your API key in environment
5. Start testing all endpoints!`
    }
  ];

  const filteredEndpoints = apiEndpoints.filter(endpoint =>
    endpoint.endpoint.toLowerCase().includes(searchTerm.toLowerCase()) ||
    endpoint.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    endpoint.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <Sheet open={devMenuOpen} onOpenChange={setDevMenuOpen}>
        <SheetContent side="left" className="w-screen max-w-none overflow-x-hidden overflow-y-auto px-4 sm:w-[85vw] sm:max-w-sm sm:px-6">
          <SheetHeader className="border-b border-border pb-4 text-left">
            <SheetTitle className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
                <Code className="h-5 w-5 text-primary-foreground" />
              </span>
              <span className="text-base">Developer Portal</span>
            </SheetTitle>
          </SheetHeader>
          <nav className="mt-4 space-y-1" aria-label="Developer menu">
            <Button variant="ghost" className="h-12 w-full justify-start gap-3 bg-primary/10 px-3 text-primary" onClick={() => setDevMenuOpen(false)}>
              <Home className="h-5 w-5 shrink-0" />
              <span className="font-medium">Portal Home</span>
            </Button>
            <Button variant="ghost" className="h-12 w-full justify-start gap-3 px-3 text-muted-foreground" onClick={() => { setDevMenuOpen(false); navigate('/ai-assistant?audience=developer'); }}>
              <MessageSquare className="h-5 w-5 shrink-0" />
              <span className="font-medium">AI Chat</span>
            </Button>
            <Button variant="ghost" className="h-12 w-full justify-start gap-3 px-3 text-muted-foreground" onClick={() => { setDevMenuOpen(false); navigate('/developers/subscription'); }}>
              <CreditCard className="h-5 w-5 shrink-0" />
              <span className="font-medium">Subscription</span>
            </Button>
            <Button variant="ghost" className="h-12 w-full justify-start gap-3 px-3 text-muted-foreground" onClick={() => { setDevMenuOpen(false); navigate('/payment-history'); }}>
              <Receipt className="h-5 w-5 shrink-0" />
              <span className="font-medium">Payment History</span>
            </Button>
            <Button variant="ghost" className="h-12 w-full justify-start gap-3 px-3 text-muted-foreground" onClick={() => { setDevMenuOpen(false); navigate('/developers/logs'); }}>
              <ScrollText className="h-5 w-5 shrink-0" />
              <span className="font-medium">API Logs</span>
            </Button>
            <Button variant="ghost" className="h-12 w-full justify-start gap-3 px-3 text-muted-foreground" onClick={() => { setDevMenuOpen(false); navigate('/developers/workbook-logs'); }}>
              <Activity className="h-5 w-5 shrink-0" />
              <span className="font-medium">Workbook Logs</span>
            </Button>
            <Button variant="ghost" className="h-12 w-full justify-start gap-3 px-3 text-muted-foreground" onClick={() => { setDevMenuOpen(false); navigate('/developers/chat-widget'); }}>
              <MessageSquareIcon className="h-5 w-5 shrink-0" />
              <span className="font-medium">Chat Widget</span>
            </Button>
            <Button variant="ghost" className="h-12 w-full justify-start gap-3 px-3 text-muted-foreground" onClick={() => { setDevMenuOpen(false); navigate('/developers/widget-docs'); }}>
              <MessageSquareIcon className="h-5 w-5 shrink-0" />
              <span className="font-medium">Widget Guide</span>
            </Button>
            <Button variant="ghost" className="h-12 w-full justify-start gap-3 px-3 text-muted-foreground" onClick={() => { setDevMenuOpen(false); navigate('/developers/sub-accounts'); }}>
              <Users className="h-5 w-5 shrink-0" />
              <span className="font-medium">Sub-accounts</span>
            </Button>
            <Button variant="ghost" className="h-12 w-full justify-start gap-3 px-3 text-muted-foreground" onClick={() => { setDevMenuOpen(false); navigate('/employer/workly-email'); }}>
              <MailIcon className="h-5 w-5 shrink-0" />
              <span className="font-medium">Workly Email</span>
            </Button>
            <Button variant="ghost" className="h-12 w-full justify-start gap-3 px-3 text-muted-foreground" onClick={() => { setDevMenuOpen(false); navigate('/employer/workly-chat'); }}>
              <MessageSquareIcon className="h-5 w-5 shrink-0" />
              <span className="font-medium">Workly Chat</span>
            </Button>
            <Button variant="ghost" className="h-12 w-full justify-start gap-3 px-3 text-muted-foreground" onClick={() => { setDevMenuOpen(false); navigate('/developers/faq'); }}>
              <ShieldCheckIcon className="h-5 w-5 shrink-0" />
              <span className="font-medium">FAQ</span>
            </Button>
            <Button variant="ghost" className="h-12 w-full justify-start gap-3 px-3 text-muted-foreground" onClick={() => { setDevMenuOpen(false); navigate('/developers/whatsapp-limits'); }}>
              <GaugeIcon className="h-5 w-5 shrink-0" />
              <span className="font-medium">WhatsApp Limits</span>
            </Button>
            <Button variant="ghost" className="h-12 w-full justify-start gap-3 px-3 text-muted-foreground" onClick={() => { setDevMenuOpen(false); navigate('/developers/whatsapp-docs'); }}>
              <MessageSquare className="h-5 w-5 shrink-0" />
              <span className="font-medium">WhatsApp Docs</span>
            </Button>
            <Button variant="ghost" className="h-12 w-full justify-start gap-3 px-3 text-muted-foreground" onClick={() => { setDevMenuOpen(false); navigate('/developers/email-docs'); }}>
              <MailIcon className="h-5 w-5 shrink-0" />
              <span className="font-medium">Email Docs</span>
            </Button>
            <Button variant="ghost" className="h-12 w-full justify-start gap-3 px-3 text-muted-foreground" onClick={() => { setDevMenuOpen(false); navigate('/developers/job-docs'); }}>
              <BriefcaseIcon className="h-5 w-5 shrink-0" />
              <span className="font-medium">Job Docs</span>
            </Button>
            <Button variant="ghost" className="h-12 w-full justify-start gap-3 px-3 text-muted-foreground" onClick={() => { setDevMenuOpen(false); navigate('/developers/instagram-docs'); }}>
              <InstagramIcon className="h-5 w-5 shrink-0" />
              <span className="font-medium">Instagram Docs</span>
            </Button>
            <Button variant="ghost" className="h-12 w-full justify-start gap-3 px-3 text-muted-foreground" onClick={() => { setDevMenuOpen(false); navigate('/developers/facebook-docs'); }}>
              <FacebookIcon className="h-5 w-5 shrink-0" />
              <span className="font-medium">Facebook Docs</span>
            </Button>
            <Button variant="ghost" className="h-12 w-full justify-start gap-3 px-3 text-muted-foreground" onClick={() => { setDevMenuOpen(false); navigate('/developers/oauth'); }}>
              <ShieldCheckIcon className="h-5 w-5 shrink-0" />
              <span className="font-medium">Workly India OAuth</span>
            </Button>
            <Button variant="ghost" className="h-12 w-full justify-start gap-3 px-3 text-muted-foreground" onClick={() => { setDevMenuOpen(false); navigate('/developers/partner-solutions'); }}>
              <HandshakeIcon className="h-5 w-5 shrink-0" />
              <span className="font-medium">Partner Solutions</span>
            </Button>
          </nav>
        </SheetContent>
      </Sheet>
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background px-4 py-3">
        <Button variant="ghost" size="icon" aria-label="Developer menu" onClick={() => setDevMenuOpen(true)}>
          <Menu className="w-5 h-5" />
        </Button>
        <h1 className="flex-1 text-lg font-semibold text-foreground">Developer Portal</h1>
        <Button
          variant="ghost"
          size="icon"
          aria-label={devAvatar || devName ? `Developer profile (${devName || 'Developer'})` : 'Set up developer profile'}
          className="h-9 w-9 shrink-0 rounded-full p-0"
          onClick={() => navigate('/developers/profile')}
        >
          {devAvatar ? (
            <img src={devAvatar} alt={devName || 'Developer profile'} className="h-9 w-9 rounded-full object-cover border border-border" />
          ) : devName ? (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {devName.charAt(0).toUpperCase()}
            </span>
          ) : (
            <UserCircleIcon className="h-9 w-9" />
          )}
        </Button>
      </header>
      <div className="p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex flex-col gap-2 sm:w-fit">
            <Sheet open={showApiKeyModal} onOpenChange={setShowApiKeyModal}>
              <SheetTrigger asChild>
                <Button 
                  className="gap-2"
                  onClick={() => setShowApiKeyModal(true)}
                >
                  <Key className="w-4 h-4" />
                  Generate New Key
                </Button>
              </SheetTrigger>
              <SheetContent
                side="bottom"
                className="max-h-[90dvh] overflow-y-auto rounded-t-3xl border-t-0 px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 [&>button]:hidden"
                style={keySheetViewport ? {
                  bottom: `${keySheetViewport.bottom}px`,
                  maxHeight: `${Math.max(220, keySheetViewport.height - 8)}px`,
                } : undefined}
              >
                <SheetHeader className="pr-8 text-left">
                  <SheetTitle className="flex items-center gap-2 text-lg">
                    <Button variant="ghost" size="icon" aria-label="Back to Developer Portal" onClick={() => setShowApiKeyModal(false)}><ArrowLeft className="h-5 w-5" /></Button>
                    <Shield className="w-5 h-5" />
                    Generate API Key
                  </SheetTitle>
                  <SheetDescription>
                    Create a new API key for accessing Workly India API
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-5 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="keyName">Key Name</Label>
                    <Input
                      id="keyName"
                      placeholder="e.g., Production Server"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {apiKeys.length >= MAX_API_KEYS
                      ? 'Only one API key is allowed. Delete the existing key before creating another.'
                      : 'Your API key will be shown only once. Save it securely.'}
                  </p>
                </div>
                <div className="mt-6">
                  <Button onClick={generateApiKey} disabled={loading || apiKeys.length >= MAX_API_KEYS} className="w-full">
                    {apiKeys.length >= MAX_API_KEYS ? "Delete Existing Key First" : loading ? "Generating..." : "Generate & Copy API Key"}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
            <Button
              variant="outline" 
              className="gap-2"
              onClick={() => setShowManageKeysModal(true)}
            >
              <Key className="w-4 h-4" />
              Manage Keys
            </Button>
            <OAuthAppRegister />
          </div>
        </div>

        {/* Webhook setup for real-time updates */}
        <div className="mb-8 space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Webhooks</h2>
            <p className="text-sm text-muted-foreground">Get instant WhatsApp updates on your own server. Every request is signed with your secret, so you can confirm it came from us.</p>
          </div>
          <WebhookManager />
        </div>



        {/* Manage API Keys Modal */}
        <Sheet open={showManageKeysModal} onOpenChange={setShowManageKeysModal}>
          <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-3xl border-t-0 px-4 pb-8 pt-4 sm:max-w-2xl sm:px-6 [&>button]:hidden">
            <SheetHeader className="pr-8 text-left">
              <SheetTitle className="flex items-center gap-2 text-lg">
                <Button variant="ghost" size="icon" aria-label="Back to Developer Portal" onClick={() => setShowManageKeysModal(false)}><ArrowLeft className="h-5 w-5" /></Button>
                <Key className="w-5 h-5" />
                Manage API Keys
              </SheetTitle>
              <SheetDescription className="text-sm">
                View and manage your API keys. Keep them secure and never share them publicly.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-5 space-y-3 sm:space-y-4">
              {apiKeys.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Key className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No API keys yet. Generate your first key to get started.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {apiKeys.map((key) => (
                    <Card key={key.id}>
                      <CardContent className="p-3 sm:p-4">
                        <div className="space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <h4 className="font-medium text-sm sm:text-base break-words">{key.key_name}</h4>
                                <Badge variant={key.is_active ? 'default' : 'secondary'} className="text-xs">
                                  {key.is_active ? 'Active' : 'Inactive'}
                                </Badge>
                              </div>
                              <div className="space-y-1 text-xs sm:text-sm text-muted-foreground">
                                <code className="block w-full bg-muted px-2 py-1 rounded text-xs break-all">
                                  {key.api_key}
                                </code>

                                <p>Created: {formatDateWithSeconds(key.created_at)}</p>
                                {key.last_used_at && (
                                  <p>Last used: {formatDateWithSeconds(key.last_used_at)}</p>
                                )}
                                <p>Usage: {key.usage_count} requests</p>
                                <p className="break-all">
                                  API Key ID: <code className="bg-muted px-1 py-0.5 rounded text-xs">{key.id}</code>
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full min-w-0 px-1 sm:px-3"
                              onClick={() => copyToClipboard(key.api_key, key.id)}
                            >
                              {copiedId === key.id ? (
                                <>
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  <span className="text-xs">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-4 h-4 mr-1" />
                                  <span className="text-xs">Copy</span>
                                </>
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full min-w-0 px-1 sm:px-3"
                              onClick={() => setApiKeyActive(key.id, !key.is_active)}
                            >
                              <span className="text-xs">{key.is_active ? 'Deactivate' : 'Activate'}</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full min-w-0 px-1 sm:px-3"
                              onClick={async () => {
                                if (await confirmDialog('Are you sure you want to delete this API key? This action cannot be undone.')) {

                                  deleteApiKey(key.id);
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              <span className="text-xs">Delete</span>
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
      </div>
    </div>
  );
};

export default APIDocumentation;