import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, Loader2, Search, Briefcase, Send, 
  MapPin, Building2, IndianRupee, Check 
} from "lucide-react";
import { toast } from "sonner";
import { formatJobsForWhatsApp } from "@/utils/whatsappFormatter";
import LottieSearchIcon from "@/components/LottieSearchIcon";

interface Job {
  id: string;
  title: string;
  location: string;
  job_type: string;
  salary_min: number | null;
  salary_max: number | null;
  category: string | null;
  experience_level: string | null;
  companies: {
    company_name: string;
  } | null;
}

export default function JobSharePage() {
  const navigate = useNavigate();
  const { phoneNumber } = useParams<{ phoneNumber: string }>();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedJobs, setSelectedJobs] = useState<Job[]>([]);

  // Fetch active jobs with company info
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['active-jobs-for-share', searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('jobs')
        .select('id, title, location, job_type, salary_min, salary_max, category, experience_level, companies(company_name)')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(50);

      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,location.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Job[];
    },
  });

  const toggleJobSelection = (job: Job) => {
    setSelectedJobs(prev => {
      const isSelected = prev.find(j => j.id === job.id);
      if (isSelected) {
        return prev.filter(j => j.id !== job.id);
      }
      if (prev.length >= 5) {
        toast.error("Maximum 5 jobs can be shared at once");
        return prev;
      }
      return [...prev, job];
    });
  };

  const handleShare = async () => {
    if (selectedJobs.length === 0) {
      toast.error("Please select at least one job");
      return;
    }

    const jobsForFormat = selectedJobs.map(job => ({
      id: job.id,
      title: job.title,
      company_name: job.companies?.company_name || 'Unknown Company',
      location: job.location,
      job_type: job.job_type,
      salary_min: job.salary_min,
      salary_max: job.salary_max,
      salary_display: null,
      category: job.category,
    }));

    const message = formatJobsForWhatsApp(jobsForFormat, "🎯 *Job Opportunities for You*");

    // Navigate back to chat with message in state
    navigate(`/owner-portal/whatsapp/chat/${phoneNumber}`, {
      state: { shareMessage: message }
    });
    toast.success("Jobs ready to share!");
  };

  const formatSalary = (job: Job) => {
    if (job.salary_min && job.salary_max) {
      return `₹${(job.salary_min/1000).toFixed(0)}K - ₹${(job.salary_max/1000).toFixed(0)}K`;
    }
    if (job.salary_min) return `₹${(job.salary_min/1000).toFixed(0)}K+`;
    return 'Competitive';
  };

  const getCompanyName = (job: Job) => {
    return job.companies?.company_name || 'Unknown Company';
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-card safe-area-inset-top">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate(`/owner-portal/whatsapp/chat/${phoneNumber}`)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2 flex-1">
          <Briefcase className="h-5 w-5 text-green-600" />
          <h1 className="font-semibold">Share Jobs</h1>
        </div>
        {selectedJobs.length > 0 && (
          <Badge variant="secondary" className="bg-green-100 text-green-700">
            {selectedJobs.length}/5 selected
          </Badge>
        )}
      </div>

      {/* Search */}
      <div className="p-4 border-b">
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"><LottieSearchIcon size={16} /></div>
          <Input
            placeholder="Search jobs by title or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Jobs List */}
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Briefcase className="h-16 w-16 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No active jobs found</p>
            <p className="text-sm mt-1">Post new jobs in Employer Portal</p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => {
              const isSelected = selectedJobs.find(j => j.id === job.id);
              return (
                <div
                  key={job.id}
                  onClick={() => toggleJobSelection(job)}
                  className={`p-4 border rounded-xl cursor-pointer transition-all ${
                    isSelected 
                      ? 'border-green-500 bg-green-50 dark:bg-green-950/20' 
                      : 'border-border hover:bg-muted/50 bg-card'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      isSelected 
                        ? 'border-green-500 bg-green-500' 
                        : 'border-muted-foreground'
                    }`}>
                      {isSelected && <Check className="h-4 w-4 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-base truncate">{job.title}</p>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                        <Building2 className="h-3.5 w-3.5" />
                        <span className="truncate">{getCompanyName(job)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                        <MapPin className="h-3.5 w-3.5" />
                        <span className="truncate">{job.location}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs">
                          <IndianRupee className="h-3 w-3 mr-0.5" />
                          {formatSalary(job)}
                        </Badge>
                        {job.job_type && (
                          <Badge variant="outline" className="text-xs">{job.job_type}</Badge>
                        )}
                        {job.experience_level && (
                          <Badge variant="outline" className="text-xs">{job.experience_level}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fixed Share Button */}
      {selectedJobs.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-card border-t safe-area-inset-bottom">
          <Button 
            onClick={handleShare}
            className="w-full bg-green-600 hover:bg-green-700 h-12 text-base"
          >
            <Send className="h-5 w-5 mr-2" />
            Share {selectedJobs.length} Job{selectedJobs.length > 1 ? 's' : ''}
          </Button>
        </div>
      )}
    </div>
  );
}
