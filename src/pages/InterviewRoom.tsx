import React, { useEffect, useState, useRef } from 'react';
import { goBack } from "@/lib/goBack";
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { SimpleVideoIframe } from '@/components/SimpleVideoIframe';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, AlertCircle, Video } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { InterviewCountdown } from '@/components/InterviewCountdown';
import { notifyEmployerJoined } from '@/lib/interviewNotify';


interface Interview {
  id: string;
  job_id: string;
  applicant_id: string;
  scheduled_at: string;
  scheduled_end_at: string | null;
  mode: string;
  location_url: string | null;
  daily_room_url: string | null;
  daily_room_name: string | null;
  status: string;
  notes: string | null;
  youtube_stream_key?: string | null;
  youtube_stream_url?: string | null;
  is_streaming_to_youtube?: boolean;
  host_meeting_token?: string | null;
  participant_meeting_tokens?: any;
  host_user_id?: string | null;
  jitsi_room_name?: string | null;
  jitsi_meeting_url?: string | null;
  jitsi_password?: string | null;
  videosdk_room_id?: string | null;
  videosdk_meeting_url?: string | null;
  videosdk_host_token?: string | null;
  videosdk_participant_tokens?: any;
  hms_room_id?: string | null;
  hms_room_url?: string | null;
  hms_host_token?: string | null;
  hms_participant_tokens?: any;
  hms_host_prebuilt_url?: string | null;
  hms_participant_prebuilt_urls?: any;
  job?: {
    title: string;
    company_id: string;
  };
  applicant?: {
    full_name: string;
  };
}

export default function InterviewRoom() {
  const { interviewId } = useParams<{ interviewId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [interview, setInterview] = useState<Interview | null>(null);
  const [loading, setLoading] = useState(true);
  const [canJoin, setCanJoin] = useState(false);
  const [employerId, setEmployerId] = useState<string | null>(null);
  const [meetingToken, setMeetingToken] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [userName, setUserName] = useState('Guest');
  const [companyName, setCompanyName] = useState('The employer');
  const fiveMinWarningShown = useRef(false);
  const oneMinWarningShown = useRef(false);
  const employerJoinNotified = useRef(false);

  
  // Check if user is joining from Activity page as guest
  const searchParams = new URLSearchParams(window.location.search);
  const joinAsGuest = searchParams.get('role') === 'guest' && searchParams.get('source') === 'activity';

  useEffect(() => {
    if (!interviewId || !user) return;

    const fetchInterview = async () => {
      try {
        // Fetch interview data (flat, no relational selects)
        const { data: interviewRow, error: interviewError } = await supabase
          .from('interviews')
          .select('*')
          .eq('id', interviewId)
          .maybeSingle();

        if (interviewError) {
          console.error('❌ Failed to fetch interview:', {
            error: interviewError.message,
            code: interviewError.code,
            interviewId
          });
          throw interviewError;
        }

        if (!interviewRow) {
          console.warn('ℹ️ Interview not found', { interviewId, userId: user.id });
          setInterview(null);
          return;
        }

        console.log('✅ Interview row fetched:', interviewRow);

        // Fetch job details separately
        let jobTitle = 'Job';
        let jobCompanyId = '';
        
        if (interviewRow.job_id) {
          const { data: jobRow, error: jobError } = await supabase
            .from('jobs')
            .select('title, company_id')
            .eq('id', interviewRow.job_id)
            .maybeSingle();

          if (jobError) {
            console.warn('⚠️ Failed to fetch job details:', jobError.message);
          } else if (jobRow) {
            jobTitle = jobRow.title;
            jobCompanyId = jobRow.company_id;
            console.log('✅ Job details fetched:', { title: jobTitle, company_id: jobCompanyId });
          }
        }

        // Construct interview data with job info
        const interviewData: Interview = {
          ...interviewRow,
          job: {
            title: jobTitle,
            company_id: jobCompanyId
          },
          applicant: {
            full_name: 'Applicant' // Will be populated if needed
          }
        };

        setInterview(interviewData);

        // Fetch user's name for Jitsi Meet display
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', user.id)
            .single();
          
          setUserName(profile?.full_name || 'User');
        }

        // Get employer ID from company
        let companyUserId: string | null = null;
        if (interviewData.job?.company_id) {
          const { data: company } = await supabase
            .from('companies')
            .select('user_id, company_name')
            .eq('id', interviewData.job.company_id)
            .single();
          
          if (company) {
            companyUserId = company.user_id;
            setEmployerId(company.user_id);
            if (company.company_name) setCompanyName(company.company_name);
          }
        }


        // Debug logging
        console.log('🔍 Interview Data:', {
          interviewId: interviewRow.id,
          hostUserId: interviewRow.host_user_id,
          applicantId: interviewRow.applicant_id,
          currentUserId: user.id,
          companyUserId,
          hasHostToken: !!interviewRow.host_meeting_token,
          hasParticipantTokens: !!interviewRow.participant_meeting_tokens,
          participantTokenKeys: interviewRow.participant_meeting_tokens ? Object.keys(interviewRow.participant_meeting_tokens) : []
        });

        // Check access permission and determine role
        const isEmployer = user.id === companyUserId;
        const isCandidate = user.id === interviewRow.applicant_id;

        // Special handling for Activity page guest mode
        if (joinAsGuest) {
          setIsHost(false);
          console.log('👥 User role: GUEST (joining from Activity page)');
          
          // Verify user is actually the candidate
          if (!isCandidate) {
            console.error('❌ Access denied - guest mode only for candidates');
            toast.error('You do not have permission to access this interview');
            navigate('/');
            return;
          }
        } else {
          // Regular access verification
          if (!isEmployer && !isCandidate) {
            console.error('❌ Access denied - user is neither employer nor candidate');
            toast.error('You do not have permission to access this interview');
            navigate('/');
            return;
          }

          // Set isHost based on role
          if (isEmployer && isCandidate) {
            setIsHost(true);
            console.log('⚠️ Same user is both host and applicant - defaulting to HOST role');
          } else if (isEmployer) {
            setIsHost(true);
            console.log('👔 User role: EMPLOYER/HOST');
          } else {
            setIsHost(false);
            console.log('👤 User role: CANDIDATE/PARTICIPANT');
          }
        }

        // Handle iframe modes separately (no token needed)
        if (interviewRow.mode === 'videosdk_iframe' || interviewRow.mode === '100ms_iframe') {
          console.log('📱 Iframe mode detected, skipping token validation');
          
          // Check time window (start time to end time + grace period)
          const now = new Date();
          const scheduledTime = new Date(interviewRow.scheduled_at);
          const scheduledEnd = interviewRow.scheduled_end_at 
            ? new Date(interviewRow.scheduled_end_at) 
            : new Date(scheduledTime.getTime() + 60 * 60 * 1000);

          // Can join AT or AFTER scheduled start time (not before)
          const canJoinTime = scheduledTime.getTime();
          const mustLeaveTime = scheduledEnd.getTime() + 30 * 60 * 1000;

          console.log('⏰ Time check:', {
            now: now.toISOString(),
            scheduledStart: scheduledTime.toISOString(),
            scheduledEnd: scheduledEnd.toISOString(),
            canJoin: now.getTime() >= canJoinTime && now.getTime() <= mustLeaveTime
          });

          if (now.getTime() >= canJoinTime && now.getTime() <= mustLeaveTime) {
            setCanJoin(true);
          }
          
          setLoading(false);
          return;
        }

        // Token validation for token-based modes
        if (interviewRow.mode === 'videosdk' || 
            interviewRow.mode === '100ms' || interviewRow.mode === 'jitsi') {
          
          // Handle special case: same user as both host and applicant (test scenario)
          if (isEmployer && isCandidate) {
            if (interviewRow.host_meeting_token) {
              setMeetingToken(interviewRow.host_meeting_token);
              if (import.meta.env.DEV) console.log('✅ Host token loaded (test mode)');
            } else {
              console.error('❌ Missing host meeting token (test mode)');
              toast.error('Meeting token missing. This interview needs to be rescheduled.');
              setLoading(false);
              return;
            }
          } else if (isEmployer) {
            // User is the employer/host
            if (interviewRow.host_meeting_token) {
              setMeetingToken(interviewRow.host_meeting_token);
              if (import.meta.env.DEV) console.log('✅ Host token loaded successfully');
            } else {
              console.error('❌ Missing host meeting token', {
                interviewId: interviewRow.id,
                hostUserId: interviewRow.host_user_id,
                currentUserId: user.id
              });
              toast.error('Meeting access token not found. Please reschedule this interview.');
              setLoading(false);
              return;
            }
          } else if (isCandidate) {
            // User is the candidate/participant
            const participantTokens = interviewRow.participant_meeting_tokens || {};
            const participantToken = participantTokens[user.id];
            
            if (import.meta.env.DEV) {
              console.log('🔑 Participant token extraction:', {
                userId: user.id,
                availableTokens: Object.keys(participantTokens),
                tokenFound: !!participantToken
              });
            }
            
            if (participantToken) {
              setMeetingToken(participantToken);
              if (import.meta.env.DEV) console.log('✅ Participant token loaded successfully');
            } else {
              console.error('❌ Missing participant meeting token', {
                interviewId: interviewRow.id,
                applicantId: interviewRow.applicant_id,
                currentUserId: user.id,
                availableTokenKeys: Object.keys(participantTokens)
              });
              toast.error('Meeting access token not found. Please contact the employer to reschedule.');
              setLoading(false);
              return;
            }
          }
        }

        // Check time window (start time to end time + grace period)
        const now = new Date();
        const scheduledTime = new Date(interviewRow.scheduled_at);
        const scheduledEnd = interviewRow.scheduled_end_at 
          ? new Date(interviewRow.scheduled_end_at) 
          : new Date(scheduledTime.getTime() + 60 * 60 * 1000); // 1 hour default

        // Can join AT or AFTER scheduled start time (not before)
        const canJoinTime = scheduledTime.getTime();
        const mustLeaveTime = scheduledEnd.getTime() + 30 * 60 * 1000; // 30 min after end

        console.log('⏰ Time check (token mode):', {
          now: now.toISOString(),
          scheduledStart: scheduledTime.toISOString(),
          scheduledEnd: scheduledEnd.toISOString(),
          canJoin: now.getTime() >= canJoinTime && now.getTime() <= mustLeaveTime
        });

        if (now.getTime() >= canJoinTime && now.getTime() <= mustLeaveTime) {
          setCanJoin(true);
        }

      } catch (error: any) {
        console.error('Error fetching interview:', error);
        toast.error('Failed to load interview details');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    fetchInterview();
  }, [interviewId, user, navigate, employerId]);

  // When the interviewer opens the room, alert the candidate once
  // (push + email + telegram) so they know they can join.
  useEffect(() => {
    if (!interview || !isHost || !canJoin) return;
    if (!interview.applicant_id || employerJoinNotified.current) return;
    employerJoinNotified.current = true;

    notifyEmployerJoined({
      interviewId: interview.id,
      applicantId: interview.applicant_id,
      jobTitle: interview.job?.title || 'the role',
      companyName,
      mode: interview.mode || 'online',
      scheduledAt: interview.scheduled_at,
    });
  }, [interview, isHost, canJoin, companyName]);



  // Auto-end monitoring: Check time and show warnings
  useEffect(() => {
    if (!interview?.scheduled_end_at || !canJoin) return;

    const checkEndTime = setInterval(() => {
      const now = new Date();
      const endTime = new Date(interview.scheduled_end_at);
      const timeLeft = endTime.getTime() - now.getTime();

      // Show warning 5 minutes before end (only once)
      if (timeLeft <= 5 * 60 * 1000 && timeLeft > 1 * 60 * 1000 && !fiveMinWarningShown.current) {
        toast.warning('⏰ Interview will end in 5 minutes', {
          duration: 10000,
        });
        fiveMinWarningShown.current = true;
      }

      // Show warning 1 minute before end (only once)
      if (timeLeft <= 1 * 60 * 1000 && timeLeft > 0 && !oneMinWarningShown.current) {
        toast.warning('⏰ Interview will end in 1 minute', {
          duration: 10000,
        });
        oneMinWarningShown.current = true;
      }

      // Show final warning when time reached (server will handle actual ending)
      if (timeLeft <= 0) {
        console.log('⏰ Interview time expired - waiting for server to end meeting');
        toast.info('Interview time has ended. Meeting will close shortly...', {
          duration: 5000,
        });
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(checkEndTime);
  }, [interview?.scheduled_end_at, canJoin]);

  // Realtime listener for interview status changes (server-side auto-end)
  useEffect(() => {
    if (!interviewId || !canJoin) return;

    console.log('👂 Setting up Realtime listener for interview status');

    const channel = supabase
      .channel(`interview-${interviewId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'interviews',
          filter: `id=eq.${interviewId}`,
        },
        (payload) => {
          console.log('📡 Interview status update received:', payload);
          
          if (payload.new && payload.new.status === 'completed') {
            console.log('✅ Interview completed by server - leaving meeting');
            toast.error('Interview has ended');
            handleLeaveCall();
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime subscription status:', status);
      });

    return () => {
      console.log('🔌 Cleaning up Realtime listener');
      supabase.removeChannel(channel);
    };
  }, [interviewId, canJoin]);

  const handleLeaveCall = () => {
    // Navigate based on role - Guest goes to Activity, Host goes to Interviews
    if (joinAsGuest) {
      navigate('/activity');
    } else {
      navigate('/employer/interviews');
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!interview) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-destructive" />
          <h2 className="text-2xl font-semibold mb-2">Interview Not Found</h2>
          <p className="text-muted-foreground mb-4">This interview does not exist or has been cancelled.</p>
          <Button onClick={() => navigate('/')}>Go Home</Button>
        </div>
      </div>
    );
  }

  // Handle 'online' mode - redirect to external link
  if (interview.mode === 'online') {
    if (interview.location_url && canJoin) {
      // Redirect to external video call link
      window.location.href = interview.location_url;
      return (
        <div className="h-screen flex items-center justify-center">
          <div className="text-center">
            <Video className="w-16 h-16 mx-auto mb-4 text-primary animate-pulse" />
            <h2 className="text-2xl font-semibold mb-2">Redirecting to Video Call...</h2>
            <p className="text-muted-foreground mb-4">Please wait while we connect you to the meeting.</p>
          </div>
        </div>
      );
    } else if (!canJoin) {
      const scheduledTime = new Date(interview.scheduled_at);
      return (
        <div className="h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-background">
          <div className="text-center max-w-md p-8 bg-card rounded-xl shadow-lg">
            <Calendar className="w-16 h-16 mx-auto mb-4 text-primary" />
            <h2 className="text-2xl font-semibold mb-2">Interview Scheduled</h2>
            <p className="text-lg mb-4">{interview.job?.title}</p>
            
            <div className="space-y-2 mb-6">
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>{format(scheduledTime, 'PPP')}</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>{format(scheduledTime, 'p')}</span>
              </div>
            </div>

            <InterviewCountdown 
              scheduledAt={interview.scheduled_at}
              scheduledEndAt={interview.scheduled_end_at}
            />

            <Button 
              variant="outline" 
              className="w-full mt-4"
              onClick={() => navigate('/employer/interviews')}
            >
              Back to Interviews
            </Button>
          </div>
        </div>
      );
    } else {
      return (
        <div className="h-screen flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
            <h2 className="text-2xl font-semibold mb-2">Video Link Not Available</h2>
            <p className="text-muted-foreground mb-4">The video call link has not been set up for this interview.</p>
            <Button onClick={() => goBack(navigate, '/employer/interviews')}>Back to Interviews</Button>
          </div>
        </div>
      );
    }
  }

  // Check for VideoSDK iframe mode
  if (interview.mode === 'videosdk_iframe') {
    if (!canJoin) {
      const scheduledTime = new Date(interview.scheduled_at);
      return (
        <div className="h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-background">
          <div className="text-center max-w-md p-8 bg-card rounded-xl shadow-lg">
            <Calendar className="w-16 h-16 mx-auto mb-4 text-primary" />
            <h2 className="text-2xl font-semibold mb-2">Interview Scheduled</h2>
            <p className="text-lg mb-4">{interview.job?.title}</p>
            
            <div className="space-y-2 mb-6">
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>{format(scheduledTime, 'PPP')}</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>{format(scheduledTime, 'p')}</span>
              </div>
            </div>

            <InterviewCountdown 
              scheduledAt={interview.scheduled_at}
              scheduledEndAt={interview.scheduled_end_at}
            />

            <Button 
              variant="outline" 
              className="w-full mt-4"
              onClick={() => navigate('/employer/interviews')}
            >
              Back to Interviews
            </Button>
          </div>
        </div>
      );
    }

    // Use appropriate URL based on role
    // Host gets host URL with full permissions (can end meeting)
    // Participant gets guest URL with limited permissions (cannot end meeting)
    const videosdkIframeUrl = isHost 
      ? interview.videosdk_host_token || interview.videosdk_meeting_url
      : (interview.videosdk_participant_tokens?.[user?.id || ''] || interview.videosdk_meeting_url);

    if (!videosdkIframeUrl) {
      return (
        <div className="h-screen flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
            <h2 className="text-2xl font-semibold mb-2">Video Meeting Not Available</h2>
            <p className="text-muted-foreground mb-4">
              Meeting URL not configured for this VideoSDK interview.
            </p>
            <Button onClick={() => goBack(navigate, '/employer/interviews')}>Back to Interviews</Button>
          </div>
        </div>
      );
    }
    
    return (
      <SimpleVideoIframe
        iframeUrl={videosdkIframeUrl}
        onLeave={handleLeaveCall}
        isHost={isHost}
        interviewId={interviewId}
        scheduledEndAt={interview.scheduled_end_at}
      />
    );
  }

  // Check for 100ms iframe mode
  if (interview.mode === '100ms_iframe') {
    if (!canJoin) {
      const scheduledTime = new Date(interview.scheduled_at);
      return (
        <div className="h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-background">
          <div className="text-center max-w-md p-8 bg-card rounded-xl shadow-lg">
            <Calendar className="w-16 h-16 mx-auto mb-4 text-primary" />
            <h2 className="text-2xl font-semibold mb-2">Interview Scheduled</h2>
            <p className="text-lg mb-4">{interview.job?.title}</p>
            
            <div className="space-y-2 mb-6">
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>{format(scheduledTime, 'PPP')}</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>{format(scheduledTime, 'p')}</span>
              </div>
            </div>

            <InterviewCountdown 
              scheduledAt={interview.scheduled_at}
              scheduledEndAt={interview.scheduled_end_at}
            />

            <Button 
              variant="outline" 
              className="w-full mt-4"
              onClick={() => navigate('/employer/interviews')}
            >
              Back to Interviews
            </Button>
          </div>
        </div>
      );
    }

    const hmsIframeUrl = isHost ? interview.hms_host_prebuilt_url : interview.hms_participant_prebuilt_urls?.[user?.id || ''];
    
    if (!hmsIframeUrl) {
      return (
        <div className="h-screen flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
            <h2 className="text-2xl font-semibold mb-2">Video Meeting Not Available</h2>
            <p className="text-muted-foreground mb-4">This 100ms interview was not set up properly.</p>
            <Button onClick={() => goBack(navigate, '/employer/interviews')}>Back to Interviews</Button>
          </div>
        </div>
      );
    }

    // Use the clean 100ms URL directly (room code already contains authentication)
    const finalHmsUrl = hmsIframeUrl;
    
    return (
      <SimpleVideoIframe
        iframeUrl={finalHmsUrl}
        onLeave={handleLeaveCall}
        isHost={isHost}
        interviewId={interviewId}
        scheduledEndAt={interview.scheduled_end_at}
      />
    );
  }

  // Check for daily_room_url if mode is dailyco
  if (interview.mode === 'dailyco' && !interview.daily_room_url) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
          <h2 className="text-2xl font-semibold mb-2">Video Call Not Available</h2>
          <p className="text-muted-foreground mb-4">This Daily.co interview was not set up properly.</p>
          <Button onClick={() => goBack(navigate, '/employer/interviews')}>Back to Interviews</Button>
        </div>
      </div>
    );
  }

  if (!canJoin) {
    const scheduledTime = new Date(interview.scheduled_at);

    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-background">
        <div className="text-center max-w-md p-8 bg-card rounded-xl shadow-lg">
          <Calendar className="w-16 h-16 mx-auto mb-4 text-primary" />
          <h2 className="text-2xl font-semibold mb-2">Interview Scheduled</h2>
          <p className="text-lg mb-4">{interview.job?.title}</p>
          
          <div className="space-y-2 mb-6">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>{format(scheduledTime, 'PPP')}</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>{format(scheduledTime, 'p')}</span>
            </div>
          </div>

          <InterviewCountdown 
            scheduledAt={interview.scheduled_at}
            scheduledEndAt={interview.scheduled_end_at}
          />

          <Button 
            disabled 
            className="w-full"
            size="lg"
          >
            <Video className="w-4 h-4 mr-2" />
            Join Available 15 min Before
          </Button>

          <Button 
            variant="outline" 
            className="w-full mt-4"
            onClick={() => navigate('/employer/interviews')}
          >
            Back to Interviews
          </Button>
        </div>
      </div>
    );
  }

  // Check if meeting token is available (only for token-based modes)
  if (!meetingToken && 
      (interview.mode === 'dailyco' || 
       interview.mode === 'videosdk' || 
       interview.mode === '100ms' || 
       interview.mode === 'jitsi')) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-background">
        <div className="text-center max-w-md p-8 bg-card rounded-xl shadow-lg">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-destructive" />
          <h2 className="text-2xl font-semibold mb-2">Meeting Link Invalid</h2>
          <p className="text-muted-foreground mb-4">
            This interview was scheduled in an older version and does not have meeting tokens.
          </p>
          <p className="text-sm text-yellow-600 dark:text-yellow-500 mb-6">
            Please delete this interview and schedule a new one, or contact admin.
          </p>
          <div className="flex gap-2 justify-center">
            <Button 
              variant="outline"
              onClick={() => navigate('/employer/interviews')}
            >
              Back to Interviews
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Fallback for unsupported interview modes
  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-background">
      <div className="text-center max-w-md p-8 bg-card rounded-xl shadow-lg">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-destructive" />
        <h2 className="text-2xl font-semibold mb-2">Meeting Not Available</h2>
        <p className="text-muted-foreground mb-4">
          This interview meeting mode is not configured or supported.
        </p>
        <Button onClick={() => goBack(navigate, '/employer/interviews')}>Back to Interviews</Button>
      </div>
    </div>
  );
}
