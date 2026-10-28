import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Calendar,
  Clock, 
  Video,
  MapPin,
  Phone,
  User,
  Plus,
  Filter,
  Search,
  Trash2,
  VideoIcon
} from "lucide-react";
import { useInterviews } from "@/hooks/useInterviews";
import { useWakeRefetch } from "@/hooks/useWakeRefetch";
import PageHeader from "@/components/PageHeader";

import { RescheduleInterviewDialog } from "@/components/RescheduleInterviewDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Interviews = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("all");
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [phoneDetailsDialogOpen, setPhoneDetailsDialogOpen] = useState(false);
  const [selectedPhoneInterview, setSelectedPhoneInterview] = useState<any>(null);
  
  const { 
    interviews, 
    loading, 
    error, 
    statusCounts, 
    todaysInterviews, 
    upcomingInterviews,
    updateInterviewStatus,
    refetch
  } = useInterviews();

  // Refetch when tab becomes visible after mobile screen off/on
  useWakeRefetch(refetch, true);

  // Navigate to schedule page with preselected candidate when navigated from Applicants page
  useEffect(() => {
    const openDialog = searchParams.get('openDialog');
    const jobId = searchParams.get('jobId');
    const applicantId = searchParams.get('applicantId');
    
    if (openDialog === 'true') {
      // Build query string for navigation
      const params = new URLSearchParams();
      if (jobId) params.append('jobId', jobId);
      if (applicantId) params.append('applicantId', applicantId);
      
      navigate(`/employer/schedule-interview?${params.toString()}`);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, navigate]);

  const handleRescheduleInterview = async (interviewId, scheduledAt, scheduledEndAt, mode, locationUrl, notes) => {
    const success = await updateInterviewStatus(interviewId, 'rescheduled', notes);
    if (success) {
      // Update the interview with new details
      await supabase
        .from('interviews')
        .update({
          scheduled_at: scheduledAt,
          scheduled_end_at: scheduledEndAt,
          mode,
          location_url: locationUrl,
          notes
        })
        .eq('id', interviewId);
      refetch();
    }
    return success;
  };

  const handleRescheduleClick = (interview) => {
    setSelectedInterview(interview);
    setRescheduleDialogOpen(true);
  };

  // Check if interview has valid meeting link based on mode
  const hasValidMeetingLink = (interview) => {
    switch(interview.mode) {
      case 'dailyco':
        return !!(interview.daily_room_url && 
               (interview.host_meeting_token || interview.participant_meeting_tokens));
      case 'online':
        return !!interview.location_url; // Employer adds custom video link
      case 'videosdk':
        return true; // Always show join button for VideoSDK
      case 'videosdk_iframe':
        return true; // Always show join button for VideoSDK iframe
      case 'jitsi':
        return true; // Always show join button for Jitsi
      case '100ms':
        return true; // Always show join button for 100ms (HMS)
      case '100ms_iframe':
        return true; // Always show join button for 100ms iframe
      case 'phone':
      case 'in_person':
        return !!interview.location_url;
      default:
        return false;
    }
  };

  // Get button text based on interview mode
  const getJoinButtonText = (interview) => {
    switch(interview.mode) {
      case 'dailyco':
      case 'videosdk':
      case 'videosdk_iframe':
      case 'jitsi':
      case '100ms':
      case '100ms_iframe':
        return 'Join Video Call';
      case 'phone':
        return 'View Phone Details';
      case 'in_person':
        return 'View Phone Details';
      default:
        return 'Join Interview';
    }
  };

  const handleJoinInterview = (interview) => {
    switch(interview.mode) {
      case 'dailyco':
        if (!interview.host_meeting_token && !interview.participant_meeting_tokens) {
          toast.error('Daily.co tokens missing');
          return;
        }
        navigate(`/interview/${interview.id}`);
        break;
        
      case 'online':
        // Online video call - employer provides custom link
        if (interview.location_url) {
          window.open(interview.location_url, '_blank');
        } else {
          toast.error('Video call link not available');
        }
        break;
        
      case 'videosdk':
        // VideoSDK opens in external URL
        if (interview.videosdk_meeting_url) {
          window.open(interview.videosdk_meeting_url, '_blank');
        } else {
          // Fallback to interview page if URL missing
          navigate(`/interview/${interview.id}`);
        }
        break;
        
      case 'videosdk_iframe':
        // VideoSDK iframe opens in interview page
        navigate(`/interview/${interview.id}`);
        break;
        
      case 'jitsi':
        // Jitsi opens in our internal player
        navigate(`/interview/${interview.id}`);
        break;
        
      case '100ms':
        // 100ms opens in our internal player
        navigate(`/interview/${interview.id}`);
        break;
        
      case '100ms_iframe':
        // 100ms iframe opens in interview page
        navigate(`/interview/${interview.id}`);
        break;
        
      case 'phone':
      case 'in_person':
        setSelectedPhoneInterview(interview);
        setPhoneDetailsDialogOpen(true);
        break;
        
      default:
        toast.error('Invalid interview mode');
    }
  };

  // Check if interview is live (happening now)
  const isLive = (interview) => {
    if (!interview.scheduled_end_at) return false;
    const now = new Date();
    const startTime = new Date(interview.scheduled_at);
    const endTime = new Date(interview.scheduled_end_at);
    return now >= startTime && now < endTime;
  };

  // Check if interview is upcoming (within 10 minutes)
  const isUpcoming = (interview) => {
    const now = new Date();
    const startTime = new Date(interview.scheduled_at);
    const minutesUntil = Math.floor((startTime.getTime() - now.getTime()) / (1000 * 60));
    return minutesUntil > 0 && minutesUntil <= 10;
  };

  const handleDeleteInterview = async (interviewId: string) => {
    try {
      const { error } = await supabase
        .from('interviews')
        .delete()
        .eq('id', interviewId);

      if (error) throw error;
      
      toast.success('Interview deleted successfully');
      refetch();
    } catch (error) {
      console.error('Error deleting interview:', error);
      toast.error('Failed to delete interview');
    }
  };

  const handleRegenerateMeetingRoom = async (interview: any) => {
    try {
      toast.info('Setting up meeting room...');
      
      // Call appropriate edge function based on mode
      let result;
      
      if (interview.mode === '100ms' || interview.mode === '100ms_iframe') {
        const { data, error } = await supabase.functions.invoke('create-100ms-room', {
          body: {
            jobId: interview.job_id,
            applicantId: interview.applicant_id,
            applicantName: interview.applicant?.full_name || 'Applicant',
            scheduledAt: interview.scheduled_at,
            scheduledEndAt: interview.scheduled_end_at
          }
        });
        
        if (error) throw error;
        result = data;
        
        // Update interview with 100ms details
        await supabase
          .from('interviews')
          .update({
            hms_room_id: result.roomId,
            hms_room_url: result.hostUrl,
            hms_host_token: result.hostUrl,
            hms_participant_tokens: { url: result.participantUrl }
          })
          .eq('id', interview.id);
          
      } else if (interview.mode === 'videosdk' || interview.mode === 'videosdk_iframe') {
        toast.info('VideoSDK room setup - Contact support for configuration');
        return;
      }
      
      toast.success('Meeting room setup successfully!');
      refetch(); // Refresh interviews list
      
    } catch (error) {
      console.error('Error setting up meeting room:', error);
      toast.error('Failed to setup meeting room. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <p className="text-slate-600">Unable to load interviews</p>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "scheduled":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "completed":
        return "bg-green-50 text-green-700 border-green-200";
      case "cancelled":
        return "bg-red-50 text-red-700 border-red-200";
      case "rescheduled":
        return "bg-orange-50 text-orange-700 border-orange-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  const getModeIcon = (mode: string) => {
    switch (mode.toLowerCase()) {
      case "online": return <Video className="w-4 h-4" />;
      case "phone": return <Phone className="w-4 h-4" />;
      case "in_person": return <MapPin className="w-4 h-4" />;
      default: return <Calendar className="w-4 h-4" />;
    }
  };

  const filterInterviews = (status: string) => {
    if (status === "all") return interviews;
    
    // Filter for upcoming interviews (within 10 minutes)
    if (status === "upcoming") {
      const now = new Date();
      return interviews.filter(interview => {
        if (interview.status.toLowerCase() !== 'scheduled') return false;
        const startTime = new Date(interview.scheduled_at);
        const minutesUntil = Math.floor((startTime.getTime() - now.getTime()) / (1000 * 60));
        return minutesUntil > 0 && minutesUntil <= 10;
      });
    }
    
    // Filter for live interviews (currently ongoing)
    if (status === "live") {
      const now = new Date();
      return interviews.filter(interview => {
        if (interview.status.toLowerCase() !== 'scheduled' || !interview.scheduled_end_at) return false;
        const startTime = new Date(interview.scheduled_at);
        const endTime = new Date(interview.scheduled_end_at);
        return now >= startTime && now < endTime;
      });
    }
    
    return interviews.filter(interview => interview.status.toLowerCase() === status);
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
    };
  };

  const handleRefresh = async () => {
    await refetch();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background">
      <PageHeader title="Interviews" backTo="/employer-portal" />
      <div className="p-4 md:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <p className="text-slate-600">
              {todaysInterviews.length} interviews scheduled for today
            </p>
          </div>
          <Button 
            className="w-full sm:w-auto rounded-full"
            onClick={() => navigate('/employer/schedule-interview')}
          >
            <Plus className="w-4 h-4 mr-2" />
            Schedule Interview
          </Button>
        </div>
      </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900">{todaysInterviews.length}</p>
              <p className="text-sm text-slate-600">Today</p>
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900">{upcomingInterviews.length}</p>
              <p className="text-sm text-slate-600">Upcoming</p>
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900">{statusCounts.completed}</p>
              <p className="text-sm text-slate-600">Completed</p>
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900">{statusCounts.scheduled}</p>
              <p className="text-sm text-slate-600">Scheduled</p>
            </div>
          </Card>
        </div>

        {/* Status Tabs */}
        <Card className="p-3 sm:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 gap-2 h-auto bg-transparent p-0">
              <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                All ({statusCounts.all})
              </TabsTrigger>
              <TabsTrigger value="scheduled" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Scheduled ({statusCounts.scheduled})
              </TabsTrigger>
              <TabsTrigger value="upcoming" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white">
                Upcoming ({statusCounts.upcoming})
              </TabsTrigger>
              <TabsTrigger value="live" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">
                Live ({statusCounts.live})
              </TabsTrigger>
              <TabsTrigger value="completed" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Completed ({statusCounts.completed})
              </TabsTrigger>
              <TabsTrigger value="cancelled" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Cancelled ({statusCounts.cancelled})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-4 mt-0">
              {filterInterviews(activeTab).map((interview) => {
                const { date, time } = formatDateTime(interview.scheduled_at);
                
                return (
                  <Card key={interview.id} className="p-4 md:p-6 hover:shadow-lg transition-all duration-200 border-l-4 border-l-blue-500">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between space-y-4 lg:space-y-0 lg:space-x-6">
                      {/* Interview Info */}
                      <div className="flex items-start space-x-4 flex-1 min-w-0">
                        <Avatar className="w-14 h-14 shrink-0 ring-2 ring-slate-100">
                          {interview.applicant?.profile_image_url ? (
                            <AvatarImage src={interview.applicant.profile_image_url} alt={interview.applicant?.full_name || 'Candidate'} />
                          ) : null}
                          <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold text-lg">
                            {interview.applicant?.full_name?.substring(0, 2).toUpperCase() || 'CA'}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3 mb-3">
                            <h3 className="font-semibold text-lg text-slate-900 truncate">
                              {interview.applicant?.full_name || 'Candidate'}
                            </h3>
                            <Badge className={`text-xs px-2 py-1 font-medium border ${getStatusColor(interview.status)} w-fit mt-1 sm:mt-0`}>
                              {interview.status.replace('_', ' ').toUpperCase()}
                            </Badge>
                          </div>
                          
                          <p className="text-slate-700 font-medium mb-3 truncate">
                            {interview.job?.title}
                          </p>
                          
                          <div className="flex flex-wrap gap-3 text-sm text-slate-600">
                            <div className="flex items-center bg-slate-50 px-2 py-1 rounded-md">
                              <Calendar className="w-4 h-4 mr-1 text-blue-600" />
                              <span className="font-medium">{date}</span>
                            </div>
                            <div className="flex items-center bg-slate-50 px-2 py-1 rounded-md">
                              <Clock className="w-4 h-4 mr-1 text-green-600" />
                              <span className="font-medium">{time}</span>
                              {interview.scheduled_end_at && (
                                <span className="ml-1 text-slate-500">
                                  - {formatDateTime(interview.scheduled_end_at).time}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center bg-slate-50 px-2 py-1 rounded-md">
                              {getModeIcon(interview.mode)}
                              <span className="ml-1 font-medium capitalize">{interview.mode.replace('_', ' ')}</span>
                            </div>
                          </div>

                          {/* Phone Interview Contact Details */}
                          {interview.mode === 'phone' && interview.location_url && (
                            <div className="mt-4">
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedPhoneInterview(interview);
                                  setPhoneDetailsDialogOpen(true);
                                }}
                                className="w-full bg-green-600 hover:bg-green-700 text-white"
                              >
                                <Video className="w-4 h-4 mr-2" />
                                View Phone Details
                              </Button>
                            </div>
                          )}

                          {/* Interview Notes - Hidden as per user request */}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col sm:flex-row gap-2 lg:flex-col lg:w-auto lg:min-w-[160px]">
                        {interview.status === 'scheduled' && (
                          <>
                            {/* Check if interview has valid meeting setup */}
                            {hasValidMeetingLink(interview) ? (
                              <>
                                {/* Live Button - Shows when interview is currently happening */}
                                {isLive(interview) && (
                                  <Button 
                                    size="sm" 
                                    variant="default"
                                    onClick={() => handleJoinInterview(interview)}
                                    className="bg-red-600 hover:bg-red-700 text-white animate-pulse w-full sm:w-auto"
                                  >
                                    <VideoIcon className="w-4 h-4 mr-2" />
                                    Live Now - Join
                                  </Button>
                                )}

                                {/* Upcoming Button - Shows 10 minutes before interview */}
                                {isUpcoming(interview) && !isLive(interview) && (
                                  <Button 
                                    size="sm" 
                                    variant="default"
                                    onClick={() => handleJoinInterview(interview)}
                                    className="bg-orange-600 hover:bg-orange-700 text-white w-full sm:w-auto"
                                  >
                                    <VideoIcon className="w-4 h-4 mr-2" />
                                    Starting Soon - Join
                                  </Button>
                                )}

                                {/* Regular Join Button - Shows for other scheduled interviews (not for phone) */}
                                {!isLive(interview) && !isUpcoming(interview) && interview.mode !== 'phone' && (
                                  <Button 
                                    size="sm" 
                                    variant="default"
                                    onClick={() => handleJoinInterview(interview)}
                                    className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
                                  >
                                    <VideoIcon className="w-4 h-4 mr-2" />
                                    {getJoinButtonText(interview)}
                                  </Button>
                                )}
                              </>
                            ) : (
                              <>
                                {/* Fallback: Meeting link missing - Show Setup button */}
                                <div className="text-xs text-red-600 bg-red-50 p-2 rounded mb-2">
                                  ⚠️ Meeting room not configured
                                </div>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handleRegenerateMeetingRoom(interview)}
                                  className="w-full sm:w-auto border-orange-500 text-orange-600 hover:bg-orange-50"
                                >
                                  <VideoIcon className="w-4 h-4 mr-2" />
                                  Setup Meeting Room
                                </Button>
                              </>
                            )}
                            {/* Mark Complete button - Hidden as per user request */}
                            {/* <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => updateInterviewStatus(interview.id, 'completed')}
                              className="w-full sm:w-auto"
                            >
                              Mark Complete
                            </Button> */}
                            {/* Reschedule button - Hidden as per user request */}
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="text-red-600 hover:text-red-700 w-full sm:w-auto"
                              onClick={() => updateInterviewStatus(interview.id, 'cancelled')}
                            >
                              Cancel
                            </Button>
                          </>
                        )}
                        {(interview.status === 'completed' || interview.status === 'cancelled') && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleDeleteInterview(interview.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 w-full sm:w-auto"
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}

              {filterInterviews(activeTab).length === 0 && (
                <div className="text-center py-12">
                  <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">
                    No interviews found
                  </h3>
                  <p className="text-slate-600">
                    {activeTab === "all" 
                      ? "No interviews scheduled yet." 
                      : `No ${activeTab} interviews.`
                    }
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </Card>

        {/* Reschedule Interview Dialog */}
        <RescheduleInterviewDialog
          open={rescheduleDialogOpen}
          onOpenChange={setRescheduleDialogOpen}
          interview={selectedInterview}
          onReschedule={handleRescheduleInterview}
        />

        {/* Phone Details Dialog */}
        <Dialog open={phoneDetailsDialogOpen} onOpenChange={setPhoneDetailsDialogOpen}>
          <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-center">📞 Phone Call</DialogTitle>
            </DialogHeader>
            
            {selectedPhoneInterview && (
              <div className="space-y-6 py-4">
                <div className="text-center space-y-3">
                  <p className="text-2xl font-bold text-slate-900 break-words">
                    {selectedPhoneInterview.applicant?.full_name || 'Candidate'}
                  </p>
                  <p className="text-xl font-semibold text-green-700 break-all px-4">
                    {selectedPhoneInterview.location_url}
                  </p>
                </div>

                <Button
                  size="lg"
                  onClick={() => window.location.href = `tel:${selectedPhoneInterview.location_url}`}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-6 text-lg"
                >
                  <Phone className="w-5 h-5 mr-2" />
                  Call Now
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
        </div>
    </div>
  );
};

export default Interviews;