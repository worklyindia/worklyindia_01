import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, Briefcase, MapPin, DollarSign, Send, Loader2 } from "lucide-react";
import { formatJobForWhatsApp } from "@/utils/whatsappFormatter";
import LottieSearchIcon from "@/components/LottieSearchIcon";
import { CANONICAL_DOMAIN } from '@/config/domainConfig';

interface Job {
  id: string;
  title: string;
  api_company_name?: string | null;
  city?: string | null;
  state?: string | null;
  location?: string | null;
  job_type?: string | null;
  experience_level?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  salary_period?: string | null;
  category?: string | null;
  short_id?: string | null;
}

interface JobShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShare: (message: string) => void;
}

export function JobShareDialog({ open, onOpenChange, onShare }: JobShareDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedJobs, setSelectedJobs] = useState<Job[]>([]);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs-for-share', searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('jobs')
        .select('id, title, api_company_name, city, state, location, job_type, experience_level, salary_min, salary_max, salary_currency, salary_period, category, short_id')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(20);

      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,api_company_name.ilike.%${searchQuery}%,category.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Job[];
    },
    enabled: open,
  });

  const toggleJobSelection = (job: Job) => {
    setSelectedJobs(prev => {
      const exists = prev.find(j => j.id === job.id);
      if (exists) {
        return prev.filter(j => j.id !== job.id);
      }
      if (prev.length >= 5) {
        return prev; // Max 5 jobs
      }
      return [...prev, job];
    });
  };

  const handleShare = () => {
    if (selectedJobs.length === 0) return;

    let message = '';
    const formattedJobs = selectedJobs.map(j => ({
      ...j,
      company_name: j.api_company_name || undefined,
    }));
    
    if (formattedJobs.length === 1) {
      message = '🔥 *Check out this job opportunity!*\n\n' + formatJobForWhatsApp(formattedJobs[0]);
    } else {
      message = `🚀 *${formattedJobs.length} Job Opportunities for You!*\n\n`;
      formattedJobs.forEach((job, index) => {
        message += formatJobForWhatsApp(job, index + 1);
      });
    }
    
    message += `\n✨ *Workly India* - Remote Jobs\n🌐 ${CANONICAL_DOMAIN}`;
    
    onShare(message);
    setSelectedJobs([]);
    onOpenChange(false);
  };

  const formatSalary = (job: Job) => {
    if (!job.salary_min && !job.salary_max) return null;
    const currency = job.salary_currency || '₹';
    if (job.salary_min && job.salary_max) {
      return `${currency}${(job.salary_min / 1000).toFixed(0)}K - ${currency}${(job.salary_max / 1000).toFixed(0)}K`;
    }
    return job.salary_min ? `${currency}${(job.salary_min / 1000).toFixed(0)}K+` : null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Share Job Opportunities
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"><LottieSearchIcon size={16} /></div>
          <Input
            placeholder="Search jobs by title, company, category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Selected Jobs Count */}
        {selectedJobs.length > 0 && (
          <div className="flex items-center justify-between p-2 bg-primary/10 rounded-lg">
            <span className="text-sm">
              {selectedJobs.length} job{selectedJobs.length > 1 ? 's' : ''} selected
            </span>
            <Button size="sm" variant="ghost" onClick={() => setSelectedJobs([])}>
              Clear
            </Button>
          </div>
        )}

        {/* Jobs List */}
        <ScrollArea className="flex-1 -mx-6 px-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Briefcase className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No active jobs found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => {
                const isSelected = selectedJobs.some(j => j.id === job.id);
                return (
                  <div
                    key={job.id}
                    onClick={() => toggleJobSelection(job)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      isSelected 
                        ? 'border-primary bg-primary/5' 
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{job.title}</h4>
                        {job.api_company_name && (
                          <p className="text-xs text-muted-foreground">{job.api_company_name}</p>
                        )}
                      </div>
                      {isSelected && (
                        <Badge variant="default" className="ml-2">Selected</Badge>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(job.city || job.state || job.location) && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {job.city || job.location || job.state}
                        </div>
                      )}
                      {formatSalary(job) && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <DollarSign className="h-3 w-3" />
                          {formatSalary(job)}
                        </div>
                      )}
                      {job.job_type && (
                        <Badge variant="secondary" className="text-xs">
                          {job.job_type}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Share Button */}
        <div className="pt-4 border-t">
          <Button 
            onClick={handleShare} 
            disabled={selectedJobs.length === 0}
            className="w-full"
          >
            <Send className="h-4 w-4 mr-2" />
            Share {selectedJobs.length > 0 ? `${selectedJobs.length} Job${selectedJobs.length > 1 ? 's' : ''}` : 'Jobs'}
          </Button>
          <p className="text-xs text-center text-muted-foreground mt-2">
            Select up to 5 jobs to share
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
