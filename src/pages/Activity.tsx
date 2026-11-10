import BottomNavigation from "@/components/BottomNavigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Building, Clock, Eye, Loader2, ExternalLink, Video, Bell, LogIn, CheckCircle } from "lucide-react";
import LottieIcon from "@/components/LottieIcon";
import callAnimation from "@/assets/lottie/call.json";
import whatsappAnimation from "@/assets/lottie/whatsapp.json";
import emailAnimation from "@/assets/lottie/email.json";
import { useAuth } from "@/contexts/AuthContext";
import { useRealTimeActivity } from "@/hooks/useRealTimeActivity";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useHybridApplications } from "@/hooks/useHybridApplications";
import ApplicationCardSkeleton from "@/components/ApplicationCardSkeleton";
import { InterviewDetailsDialog } from "@/components/InterviewDetailsDialog";
import { useState, useEffect } from "react";


const Activity = () => {
  const { user } = useAuth();
  const { applications, loading, error, stats, isGuest } = useHybridApplications();
  const { activities, loading: activityLoading, newActivityCount } = useRealTimeActivity({
    limit: 10,
    showToastOnUpdate: true
  });
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [selectedInterview, setSelectedInterview] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Auto-open interview dialog from shared link
  useEffect(() => {
    const interviewId = searchParams.get('interview');
    if (interviewId && applications.length > 0 && user) {
      // Find the interview in user's applications
      const application = applications.find(app => 
        app.interview && app.interview.id === interviewId
      );
      
      if (application && application.interview) {
        // User has access - open the dialog
        setSelectedInterview({
          id: application.interview.id,
          scheduledAt: application.interview.scheduledAt,
          mode: application.interview.mode,
          locationUrl: application.interview.locationUrl,
          status: application.interview.status,
          notes: application.interview.notes,
          scheduledEndAt: application.interview.scheduledEndAt,
          video_platform: application.interview.video_platform
        });
        setIsDialogOpen(true);
        // Remove the query parameter
        searchParams.delete('interview');
        setSearchParams(searchParams);
      } else {
        // User doesn't have access to this interview
        toast({
          title: "Interview Not Found",
          description: "This interview is not in your activity list.",
          variant: "destructive"
        });
        // Remove the query parameter
        searchParams.delete('interview');
        setSearchParams(searchParams);
      }
    }
  }, [searchParams, applications, user, setSearchParams, toast]);

  const handleJoinInterview = (application: any) => {
    if (!application.interview) {
      toast({
        title: "No Interview Scheduled",
        description: "Interview details not found for this application.",
        variant: "destructive"
      });
      return;
    }

    // Navigate to interview room with guest mode for Activity page
    navigate(`/interview/${application.interview.id}?source=activity&role=guest`);
  };

  const handleFilterClick = (filterType: string) => {
    setActiveFilter(activeFilter === filterType ? null : filterType);
  };

  // Calculate additional stats
  const upcomingCount = applications.filter(app => {
    if (app.status !== 'Interview Scheduled' || !app.interview) return false;
    if (app.interview.interviewPhase === 'live' || app.interview.interviewPhase === 'ended') return false;
    
    // Count as upcoming if interview start time is in the future
    const now = new Date();
    const startTime = new Date(app.interview.scheduledAt);
    
    return startTime.getTime() > now.getTime();
  }).length;

  const liveCount = applications.filter(app => 
    app.status === 'Interview Scheduled' && 
    app.interview && 
    app.interview.interviewPhase === 'live'
  ).length;

  const getFilteredApplications = () => {
    if (!activeFilter) return applications;
    
    switch (activeFilter) {
      case 'total':
        return applications;
      case 'underReview':
        return applications.filter(app => 
          app.status === 'Under Review' || app.status === 'Shortlisted'
        );
      case 'interviews':
        return applications.filter(app => 
          app.status === 'Interview Scheduled'
        );
      case 'upcoming':
        return applications.filter(app => {
          if (app.status !== 'Interview Scheduled' || !app.interview) return false;
          if (app.interview.interviewPhase === 'live' || app.interview.interviewPhase === 'ended') return false;
          
          // Show as upcoming if interview start time is in the future
          const now = new Date();
          const startTime = new Date(app.interview.scheduledAt);
          
          return startTime.getTime() > now.getTime();
        });
      case 'live':
        return applications.filter(app => 
          app.status === 'Interview Scheduled' && 
          app.interview && 
          app.interview.interviewPhase === 'live'
        );
      case 'hired':
        return applications.filter(app => 
          app.status === 'Hired'
        );
      default:
        return applications;
    }
  };

  const filteredApplications = getFilteredApplications();

  return (
    <div className="min-h-screen bg-background">
      
        <main className="container mx-auto px-4 py-6 pb-24">
        <div className="space-y-6">
          {/* Guest user banner */}
          {isGuest && (
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-4">
              <div className="flex items-center space-x-3">
                <LogIn className="w-5 h-5 text-primary" />
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">Using Guest Mode</h3>
                  <p className="text-sm text-muted-foreground">Your activity is saved locally. Login to sync across devices and unlock all features.</p>
                </div>
                <Button onClick={() => navigate('/auth')} size="sm">
                  Login
                </Button>
              </div>
            </div>
          )}
          
          {/* Page Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground mb-2">My Activity</h1>
                <p className="text-muted-foreground">
                  {isGuest ? 'Track your job applications locally' : 'Track your job applications and their status'}
                </p>
              </div>
              {!isGuest && newActivityCount > 0 && (
                <div className="flex items-center space-x-2 bg-primary/10 px-3 py-2 rounded-full">
                  <Bell className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-primary">{newActivityCount} new updates</span>
                </div>
              )}
            </div>

              {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <Card 
              className={`cursor-pointer transition-all hover:shadow-md ${
                activeFilter === 'total' ? 'ring-2 ring-primary bg-primary/5' : ''
              }`}
              onClick={() => handleFilterClick('total')}
            >
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <Building className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Applied</p>
                    <p className="text-xl font-bold">{loading ? '...' : stats.totalApplied}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card 
              className={`cursor-pointer transition-all hover:shadow-md ${
                activeFilter === 'underReview' ? 'ring-2 ring-primary bg-primary/5' : ''
              }`}
              onClick={() => handleFilterClick('underReview')}
            >
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                    <Clock className="w-4 h-4 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Under Review</p>
                    <p className="text-xl font-bold">{loading ? '...' : stats.underReview}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card 
              className={`cursor-pointer transition-all hover:shadow-md ${
                activeFilter === 'interviews' ? 'ring-2 ring-primary bg-primary/5' : ''
              }`}
              onClick={() => handleFilterClick('interviews')}
            >
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <Eye className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Interviews</p>
                    <p className="text-xl font-bold">{loading ? '...' : stats.interviews}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card 
              className={`cursor-pointer transition-all hover:shadow-md ${
                activeFilter === 'hired' ? 'ring-2 ring-primary bg-primary/5' : ''
              }`}
              onClick={() => handleFilterClick('hired')}
            >
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <Building className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Hired</p>
                    <p className="text-xl font-bold">{loading ? '...' : stats.hired}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card 
              className={`cursor-pointer transition-all hover:shadow-md ${
                activeFilter === 'upcoming' ? 'ring-2 ring-primary bg-primary/5' : ''
              }`}
              onClick={() => handleFilterClick('upcoming')}
            >
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Upcoming</p>
                    <p className="text-xl font-bold">{loading ? '...' : upcomingCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card 
              className={`cursor-pointer transition-all hover:shadow-md ${
                activeFilter === 'live' ? 'ring-2 ring-primary bg-primary/5' : ''
              }`}
              onClick={() => handleFilterClick('live')}
            >
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center animate-pulse">
                    <Video className="w-4 h-4 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Live</p>
                    <p className="text-xl font-bold">{loading ? '...' : liveCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Applications List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {activeFilter ? (
                  activeFilter === 'total' ? 'All Applications' :
                  activeFilter === 'underReview' ? 'Under Review Applications' :
                  activeFilter === 'interviews' ? 'Interview Applications' :
                  activeFilter === 'upcoming' ? 'Upcoming Interviews' :
                  activeFilter === 'live' ? 'Live Interviews' :
                  activeFilter === 'hired' ? 'Hired Applications' : 'Recent Applications'
                ) : 'Recent Applications'}
              </h2>
              {activeFilter && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setActiveFilter(null)}
                >
                  Clear Filter
                </Button>
              )}
            </div>
            
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, index) => (
                  <ApplicationCardSkeleton key={index} />
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">{error}</p>
              </div>
            ) : filteredApplications.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  {activeFilter ? 'No applications found for this filter' : 'No job applications yet'}
                </p>
                {!activeFilter && (
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => navigate('/jobs')}
                  >
                    Browse Jobs
                  </Button>
                )}
              </div>
            ) : (
              filteredApplications.map((application) => (
                <Card key={application.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                     <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-4 sm:space-y-0">
                       <div className="flex-1">
                         <h3 className="text-sm font-semibold text-foreground truncate mb-2">{application.title}</h3>
                        
                         <div className="space-y-2">
                           <div className="flex items-center justify-between">
                             <div className="flex items-center text-muted-foreground">
                               {application.companyLogoUrl ? (
                                 <img referrerPolicy="no-referrer" loading="lazy" decoding="async" src={application.companyLogoUrl} alt={application.company} className="w-5 h-5 rounded-full object-cover mr-2" />
                               ) : (
                                 <Building className="w-4 h-4 mr-2" />
                               )}
                               <span className="text-sm">{application.company}</span>
                             </div>
                             <div className="flex gap-1.5 shrink-0 ml-2">
                                {!(application.interview?.interviewPhase === 'live' || application.interview?.interviewPhase === 'ended') && (
                                  <Badge className={`${application.statusColor} text-white text-xs px-2 py-0.5 font-medium`}>
                                    {application.status === 'Interview Scheduled' ? 'Interview' : application.status}
                                  </Badge>
                                )}
                                {application.interview?.interviewPhase === 'live' && (
                                 <Badge className="bg-green-600 text-white animate-pulse flex items-center gap-1 text-xs px-2 py-0.5 font-medium">
                                   <div className="h-1.5 w-1.5 bg-green-300 rounded-full"></div>
                                   Live
                                 </Badge>
                               )}
                               {application.interview?.interviewPhase === 'ended' && (
                                 <Badge className="bg-gray-500 text-white text-xs px-2 py-0.5 font-medium">
                                   Closed
                                 </Badge>
                               )}
                              </div>
                           </div>
                          
                          <div className="flex items-center text-muted-foreground">
                            <MapPin className="w-4 h-4 mr-2" />
                            <span className="text-sm">{application.location}</span>
                          </div>
                          
                          <div className="flex items-center text-muted-foreground">
                            <Calendar className="w-4 h-4 mr-2" />
                            <span className="text-sm">Applied on {new Date(application.appliedDate).toLocaleDateString()} {new Date(application.appliedDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                          </div>
                        </div>
                        
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-sm font-medium text-primary">{application.salary}</span>
                          <div className="flex items-center gap-2">
                            {application.companyPhone && (
                              <a href={`tel:${application.companyPhone}`} onClick={(e) => e.stopPropagation()}>
                                <div className="w-7 h-7 rounded-full bg-green-600 flex items-center justify-center">
                                  <LottieIcon animationData={callAnimation} size={18} />
                                </div>
                              </a>
                            )}
                            {application.companyEmail && (
                              <a href={`mailto:${application.companyEmail}?subject=${encodeURIComponent(`Regarding my application for ${application.title}`)}&body=${encodeURIComponent(`Hi,\n\nI applied for the position of ${application.title} at ${application.company}. I would like to follow up on my application.\n\nThank you.`)}`} onClick={(e) => e.stopPropagation()}>
                                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center">
                                  <LottieIcon animationData={emailAnimation} size={18} />
                                </div>
                              </a>
                            )}
                            {application.companyWhatsapp && (
                              <a href={`https://wa.me/${application.companyWhatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hi, I applied for the position of ${application.title} at ${application.company}. I would like to know the status of my application.`)}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                                <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center">
                                  <LottieIcon animationData={whatsappAnimation} size={18} />
                                </div>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex space-x-2 sm:ml-4">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            if (application.jobId) {
                              navigate(`/job/${application.jobId}`);
                            } else {
                              toast({
                                title: "Job No Longer Available",
                                description: "This job post has been removed or expired.",
                                variant: "destructive"
                              });
                            }
                          }}
                        >
                          View Details
                        </Button>
                         {application.status === "Interview Scheduled" && application.interview && (
                           <Button 
                             size="sm"
                             onClick={() => {
                               setSelectedInterview({
                                 id: application.interview.id,
                                 scheduledAt: application.interview.scheduledAt,
                                 mode: application.interview.mode,
                                 locationUrl: application.interview.locationUrl,
                                 status: application.interview.status,
                                 notes: application.interview.notes,
                                 scheduledEndAt: application.interview.scheduledEndAt,
                                 video_platform: application.interview.video_platform
                               });
                               setIsDialogOpen(true);
                             }}
                             className="gap-2"
                             variant="outline"
                           >
                             <Eye className="w-4 h-4" />
                             Interview Details
                           </Button>
                         )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </main>

      <BottomNavigation />

    
      

    
    {/* Interview Details Dialog */}
    {selectedInterview && (
      <InterviewDetailsDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        interview={selectedInterview}
        jobTitle={applications.find(app => app.interview?.id === selectedInterview.id)?.title || "Interview"}
        company={applications.find(app => app.interview?.id === selectedInterview.id)?.company || "Company"}
      />
    )}
  </div>
);
};

export default Activity;