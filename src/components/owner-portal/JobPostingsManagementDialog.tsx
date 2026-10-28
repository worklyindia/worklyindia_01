import React, { useState, useEffect } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { StandardSheetHeader } from "@/components/StandardSheetHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { 
  Briefcase, 
  Eye, 
  Trash2, 
  Copy, 
  Search,
  Calendar,
  MapPin,
  DollarSign,
  Clock,
  TrendingUp
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "sonner";
import { useNativeFeel } from "@/hooks/useNativeFeel";
import LottieSearchIcon from "@/components/LottieSearchIcon";

interface Job {
  id: string;
  title: string;
  location: string;
  job_type: string;
  salary_range: string;
  status: string;
  category: string;
  created_at: string;
  expires_at: string;
  views_count: number;
  applications_count: number;
  is_boosted: boolean;
  boost_level: number;
}

interface JobPostingsManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employer: {
    user_id: string;
    company_name: string;
  };
}

const JobPostingsManagementDialog = ({ open, onOpenChange, employer }: JobPostingsManagementDialogProps) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const { tapFeedback, successFeedback, errorFeedback } = useNativeFeel();

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('get_employer_jobs', { p_user_id: employer.user_id });

      if (error) throw error;
      setJobs(data || []);
    } catch (error: any) {
      console.error('Error fetching jobs:', error);
      toast.error('Failed to fetch jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchJobs();
    }
  }, [open, employer.user_id]);

  const handleCopyJobId = (jobId: string) => {
    tapFeedback();
    navigator.clipboard.writeText(jobId);
    toast.success("Job ID copied to clipboard!");
  };

  const handleViewJob = (jobId: string) => {
    tapFeedback();
    window.open(`/job/${jobId}`, '_blank');
  };

  const handleDeleteJob = async (jobId: string) => {
    tapFeedback();
    setDeleteLoading(jobId);
    try {
      // Delete from Telegram channel first (if posted there)
      try {
        await supabase.functions.invoke('email-api/telegram', { body: { action: 'channel-delete', job_id: jobId }
        });
      } catch (tgErr) {
        console.warn('Telegram channel delete skipped:', tgErr);
      }

      const { error } = await supabase
        .from('jobs')
        .update({ 
          status: 'deleted',
          visibility: 'private'
        })
        .eq('id', jobId);

      if (error) throw error;

      successFeedback();
      toast.success("Job deleted successfully!");
      fetchJobs();
    } catch (error: any) {
      errorFeedback();
      console.error('Error deleting job:', error);
      toast.error('Failed to delete job');
    } finally {
      setDeleteLoading(null);
    }
  };

  const filteredJobs = jobs.filter(job => 
    job.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'expired':
        return <Badge variant="secondary">Expired</Badge>;
      case 'paused':
        return <Badge variant="outline">Paused</Badge>;
      case 'deleted':
        return <Badge variant="destructive">Deleted</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  const handleClose = () => {
    tapFeedback();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent 
        side="bottom" 
        className="rounded-t-3xl p-0 h-[95vh] [&>button]:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 pb-2 border-b flex-shrink-0">
            <StandardSheetHeader 
              title={`Jobs - ${employer.company_name}`}
              onClose={handleClose}
            />
          </div>

          {/* Search and Stats */}
          <div className="p-4 space-y-4 border-b">
            {/* Search Bar */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none"><LottieSearchIcon size={16} /></div>
                <Input
                  placeholder="Search by Job ID or title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-12 text-base"
                />
              </div>
              <Button 
                onClick={() => { tapFeedback(); fetchJobs(); }} 
                disabled={loading} 
                className="h-12 active:scale-95"
              >
                {loading ? "..." : "Refresh"}
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-2">
              <Card className="p-2">
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-600">{jobs.length}</div>
                  <div className="text-xs text-gray-600">Total</div>
                </div>
              </Card>
              <Card className="p-2">
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600">
                    {jobs.filter(j => j.status === 'active').length}
                  </div>
                  <div className="text-xs text-gray-600">Active</div>
                </div>
              </Card>
              <Card className="p-2">
                <div className="text-center">
                  <div className="text-lg font-bold text-orange-600">
                    {jobs.filter(j => j.is_boosted).length}
                  </div>
                  <div className="text-xs text-gray-600">Boosted</div>
                </div>
              </Card>
              <Card className="p-2">
                <div className="text-center">
                  <div className="text-lg font-bold text-purple-600">
                    {jobs.reduce((sum, job) => sum + (job.applications_count || 0), 0)}
                  </div>
                  <div className="text-xs text-gray-600">Apps</div>
                </div>
              </Card>
            </div>
          </div>

          {/* Jobs List */}
          <div className="flex-1 native-scrolling overflow-y-auto p-4">
            {loading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <Card className="p-4">
                      <div className="h-20 bg-gray-200 rounded"></div>
                    </Card>
                  </div>
                ))}
              </div>
            ) : filteredJobs.length > 0 ? (
              <div className="space-y-4">
                {filteredJobs.map((job) => (
                  <Card key={job.id} className="p-4">
                    <div className="space-y-3">
                      {/* Job Header */}
                      <div>
                        <h3 className="font-semibold text-base truncate" title={job.title}>
                          {job.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                              {job.id.slice(0, 8)}...
                            </code>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleCopyJobId(job.id)}
                              className="h-6 w-6 p-0 hover:bg-gray-200 active:scale-95"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          {getStatusBadge(job.status)}
                          {job.is_boosted && (
                            <Badge variant="outline" className="bg-orange-50 text-orange-700">
                              <TrendingUp className="h-3 w-3 mr-1" />
                              L{job.boost_level}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Job Details */}
                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{job.location}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          <span className="truncate">{job.salary_range || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span className="truncate">{job.job_type}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Briefcase className="h-3 w-3" />
                          <span className="truncate">{job.category}</span>
                        </div>
                      </div>

                      {/* Dates and Stats */}
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500">Posted</span>
                          <div className="font-medium">
                            {format(new Date(job.created_at), 'dd/MM/yy')}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-500">Expires</span>
                          <div className={`font-medium ${isExpired(job.expires_at) ? 'text-red-600' : ''}`}>
                            {format(new Date(job.expires_at), 'dd/MM/yy')}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-500">Views</span>
                          <div className="font-medium text-blue-600">
                            {job.views_count || 0}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-500">Apps</span>
                          <div className="font-medium text-green-600">
                            {job.applications_count || 0}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewJob(job.id)}
                          className="flex-1 h-10 active:scale-95"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={deleteLoading === job.id}
                              className="flex-1 h-10 text-red-600 border-red-200 hover:bg-red-50 active:scale-95"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Job Post</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete <strong>"{job.title}"</strong>? 
                                This action will mark the job as deleted and hide it from public view. 
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteJob(job.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                {deleteLoading === job.id ? 'Deleting...' : 'Delete Job'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Briefcase className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">
                  {searchQuery ? 'No jobs found' : 'No jobs posted yet'}
                </h3>
                <p className="text-sm">
                  {searchQuery 
                    ? 'Try adjusting your search query'
                    : 'Jobs posted by this company will appear here'
                  }
                </p>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default JobPostingsManagementDialog;
