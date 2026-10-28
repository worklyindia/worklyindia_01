import React from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { StandardSheetHeader } from '@/components/StandardSheetHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, Video, Phone, ExternalLink, FileText, Copy, Check, Smartphone, Lock, Share2 } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { InterviewCountdown } from '@/components/InterviewCountdown';
import { sanitizeHtml } from '@/utils/sanitize';

interface InterviewDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  interview: {
    id: string;
    scheduledAt: string;
    mode: string;
    locationUrl?: string;
    status: string;
    notes?: string;
    scheduledEndAt?: string;
    video_platform?: string;
  };
  jobTitle: string;
  company: string;
}

export const InterviewDetailsDialog: React.FC<InterviewDetailsDialogProps> = ({
  open,
  onOpenChange,
  interview,
  jobTitle,
  company
}) => {
  const [currentTime, setCurrentTime] = React.useState(new Date());
  const [copied, setCopied] = React.useState(false);
  const [linkCopied, setLinkCopied] = React.useState(false);
  const [interviewStatus, setInterviewStatus] = React.useState(interview.status);
  const notesRef = React.useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  
  // Realtime listener for interview status updates
  React.useEffect(() => {
    if (!open || !interview.id) return;

    console.log('👂 InterviewDetailsDialog: Setting up realtime listener for interview:', interview.id);

    const channel = supabase
      .channel(`interview-status-dialog-${interview.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'interviews',
        filter: `id=eq.${interview.id}`
      }, (payload) => {
        console.log('📡 InterviewDetailsDialog: Interview status update:', payload);
        
        if (payload.new && payload.new.status === 'completed') {
          console.log('✅ Interview completed - updating status');
          setInterviewStatus('completed');
          toast({
            title: "Interview Ended",
            description: "The scheduled time has expired.",
            variant: "default",
          });
        }
      })
      .subscribe((status) => {
        console.log('📡 InterviewDetailsDialog: Realtime subscription status:', status);
      });

    return () => {
      console.log('🔌 InterviewDetailsDialog: Cleaning up realtime listener');
      supabase.removeChannel(channel);
    };
  }, [open, interview.id, toast]);

  // Sync with server time when dialog opens and update every second
  React.useEffect(() => {
    const syncServerTime = async () => {
      try {
        const { data, error } = await supabase.rpc('get_server_time_ist');
        if (!error && data) {
          // data is epoch milliseconds in IST timezone
          const serverTimeEpoch = data as number;
          console.log('Server time (IST epoch ms):', serverTimeEpoch, 'Date:', new Date(serverTimeEpoch));
          setCurrentTime(new Date(serverTimeEpoch));
        } else {
          console.error('Error fetching server time:', error);
          // Fallback to local time
          setCurrentTime(new Date());
        }
      } catch (error) {
        console.error('Failed to sync server time:', error);
        // Fallback to local time
        setCurrentTime(new Date());
      }
    };

    if (open) {
      syncServerTime();
    }

    // Update time every second
    const timer = setInterval(() => {
      setCurrentTime(prev => new Date(prev.getTime() + 1000));
    }, 1000);
    
    return () => clearInterval(timer);
  }, [open]);

  // Handle links in notes to open in new tab
  React.useEffect(() => {
    if (!notesRef.current) return;
    
    const links = notesRef.current.querySelectorAll('a');
    links.forEach(link => {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    });
  }, [interview?.notes]);

  const interviewDate = new Date(interview.scheduledAt);
  
  // Validate interview date
  if (isNaN(interviewDate.getTime())) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-3xl p-6 max-h-[90vh] [&>button]:hidden">
          <StandardSheetHeader 
            title="Interview Details" 
            onClose={() => onOpenChange(false)}
          />
          <div className="py-4">
            <p className="text-center text-muted-foreground">
              Invalid interview date. Please contact support.
            </p>
          </div>
          <div className="flex justify-end pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const timeDiff = interviewDate.getTime() - currentTime.getTime();
  const minutesUntilInterview = Math.floor(timeDiff / (1000 * 60));

  const getModeIcon = () => {
    const mode = interview.mode?.toLowerCase();
    switch (mode) {
      case 'online':
      case '100ms':
      case '100ms_iframe':
      case 'videosdk':
      case 'videosdk_iframe':
        return <Video className="w-4 h-4" />;
      case 'phone':
        return <Phone className="w-4 h-4" />;
      case 'in-person':
      case 'in_person':
        return <MapPin className="w-4 h-4" />;
      default:
        return <Calendar className="w-4 h-4" />;
    }
  };

  const getModeLabel = () => {
    const mode = interview.mode?.toLowerCase();
    const platform = interview.video_platform?.toLowerCase();
    const url = (interview.locationUrl || '').toLowerCase();

    const isZoomUrl = /(zoom\.us|zoom\.com|zoommtg:|zoomus:)/i.test(url);
    const isMeetUrl = /(meet\.google\.com|g\.co\/meet|google\.com\/_meet)/i.test(url);
    const isTeamsUrl = /(teams\.microsoft\.com|teams\.live\.com|teams\.link)/i.test(url);
    
    switch (mode) {
      case 'videosdk':
      case 'videosdk_iframe':
        return 'VideoSDK Meeting';
      case '100ms':
      case '100ms_iframe':
        return '100ms Meeting';
      case 'online':
        // Check video platform for specific labels (support both google_meet and googlemeet)
        if (platform?.includes('zoom') || isZoomUrl) return 'Zoom Meeting';
        if (platform === 'google_meet' || platform === 'googlemeet' || isMeetUrl) return 'Google Meet';
        if (platform === 'teams' || isTeamsUrl) return 'Microsoft Teams';
        return 'Online (Video Call)';
      case 'phone':
        return 'Phone Call';
      case 'in-person':
      case 'in_person':
        return 'In Person';
      default:
        return 'Interview';
    }
  };

  const getStatusColor = () => {
    switch (interviewStatus.toLowerCase()) {
      case 'scheduled':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-green-500';
      case 'cancelled':
        return 'bg-red-500';
      case 'rescheduled':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  const isLive = () => {
    if (!interview.scheduledEndAt) return false;
    const endTime = new Date(interview.scheduledEndAt).getTime();
    return timeDiff <= 0 && currentTime.getTime() < endTime;
  };

  const isUpcoming = () => {
    return minutesUntilInterview > 0 && minutesUntilInterview <= 10;
  };

  const canJoinInterview = () => {
    // Can join ONLY AT or AFTER scheduled start time (exact millisecond check)
    // And before scheduled end time or within grace period after start
    
    // If interview has a scheduled end time, check if it's still within that window
    if (interview.scheduledEndAt) {
      const endTime = new Date(interview.scheduledEndAt).getTime();
      // Can join if: current time >= start time AND current time < end time
      return timeDiff <= 0 && currentTime.getTime() < endTime;
    }
    
    // Fallback: within 2 hours after start time (for old interviews without end time)
    const twoHoursInMs = 2 * 60 * 60 * 1000;
    return timeDiff <= 0 && timeDiff >= -twoHoursInMs;
  };

  const handleJoinInterview = () => {
    const videoModes = ['online', '100ms', '100ms_iframe', 'videosdk', 'videosdk_iframe'];
    if (videoModes.includes(interview.mode) && interview.locationUrl) {
      // For 'online' mode, open the custom link in new tab
      if (interview.mode === 'online') {
        window.open(interview.locationUrl, '_blank');
      } else {
        // For other video modes, navigate to the interview room page as guest (from Activity page)
        window.location.href = `/interview/${interview.id}?source=activity&role=guest`;
      }
    }
  };

  const handleCopyToClipboard = async () => {
    if (!interview.locationUrl) return;
    
    try {
      await navigator.clipboard.writeText(interview.locationUrl);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Link copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      toast({
        title: "Copy failed",
        description: "Unable to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const getTimeStatus = () => {
    const totalSeconds = Math.floor(timeDiff / 1000);
    
    if (totalSeconds > 900) { // More than 15 minutes
      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      
      const pad = (num: number) => String(num).padStart(2, '0');
      return `Starts in ${pad(days)}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    } else if (totalSeconds >= 0) {
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      const pad = (num: number) => String(num).padStart(2, '0');
      return `Starting in ${pad(minutes)}:${pad(seconds)}`;
    } else if (totalSeconds >= -7200) { // Within 2 hours after start
      return 'Interview is ongoing';
    } else {
      return 'Interview has ended';
    }
  };

  const formatDateTime = (date: Date) => {
    try {
      return new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'full',
        timeStyle: 'short',
        timeZone: 'Asia/Kolkata'
      }).format(date);
    } catch {
      return format(date, 'PPP p');
    }
  };

  const getDuration = () => {
    if (!interview.scheduledEndAt) return null;
    const startTime = new Date(interview.scheduledAt).getTime();
    const endTime = new Date(interview.scheduledEndAt).getTime();
    const durationMs = endTime - startTime;
    const durationMinutes = Math.floor(durationMs / (1000 * 60));
    
    if (durationMinutes < 60) {
      return `${durationMinutes} minutes`;
    } else {
      const hours = Math.floor(durationMinutes / 60);
      const minutes = durationMinutes % 60;
      if (minutes === 0) {
        return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
      }
      return `${hours} ${hours === 1 ? 'hour' : 'hours'} ${minutes} minutes`;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto [&>button]:hidden">
        <StandardSheetHeader 
          title="Interview Details" 
          onClose={() => onOpenChange(false)}
          subtitle={`${jobTitle} at ${company}`}
        />

        <div className="space-y-6 py-4">
          {/* Job Information */}
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">{jobTitle}</h3>
            <p className="text-muted-foreground">{company}</p>
          </div>

          {/* Interview ID */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Interview ID:</span>
            <div className="flex items-center gap-2">
              <code className="text-xs text-muted-foreground">
                {interview.id.substring(0, 13)}...
              </code>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(interview.id);
                    setCopied(true);
                    toast({
                      title: "Copied!",
                      description: "Interview ID copied to clipboard",
                    });
                    setTimeout(() => setCopied(false), 2000);
                  } catch (error) {
                    console.error('Failed to copy:', error);
                    toast({
                      title: "Copy failed",
                      description: "Unable to copy to clipboard",
                      variant: "destructive",
                    });
                  }
                }}
                className="h-8 w-8 p-0"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Interview Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Status:</span>
            <Badge className={`${getStatusColor()} text-white`}>
              {interviewStatus.charAt(0).toUpperCase() + interviewStatus.slice(1)}
            </Badge>
          </div>

          {/* Interview Type */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Type:</span>
            <div className="flex items-center gap-2">
              {getModeIcon()}
              <span className="text-sm">{getModeLabel()}</span>
            </div>
          </div>

          {/* Date and Time */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Date:</span>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">{format(interviewDate, 'dd MMMM yyyy')}</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Start Time:</span>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span className="text-sm">
                  {format(interviewDate, 'p')} - {
                    interview.scheduledEndAt 
                      ? format(new Date(interview.scheduledEndAt), 'p')
                      : format(new Date(interviewDate.getTime() + 2 * 60 * 60 * 1000), 'p')
                  }
                </span>
              </div>
            </div>

            {getDuration() && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Duration:</span>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">{getDuration()}</span>
                </div>
              </div>
            )}

            <InterviewCountdown 
              scheduledAt={interview.scheduledAt}
              scheduledEndAt={interview.scheduledEndAt}
              variant="compact"
            />
          </div>

          {/* Zoom App Download Notice */}
          {(() => {
            const platform = interview.video_platform?.toLowerCase();
            const url = (interview.locationUrl || '').toLowerCase();
            const isZoom = (platform?.includes('zoom')) || /(zoom\.us|zoom\.com|zoommtg:|zoomus:)/i.test(url);
            return isZoom && (
              <div className="space-y-3 p-4 bg-primary/10 border border-primary/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <Smartphone className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="space-y-2 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      Zoom App Required
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {`To join the Zoom meeting, you must have the Zoom app installed on your device. Please download the app to join your scheduled interview at ${format(interviewDate, 'p')}.`}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2 text-xs h-8"
                        onClick={() => window.open('https://play.google.com/store/apps/details?id=us.zoom.videomeetings', '_blank')}
                      >
                        <Smartphone className="w-3 h-3" />
                        Play Store: Download Zoom App
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2 text-xs h-8"
                        onClick={() => window.open('https://apps.apple.com/in/app/zoom-one-platform-to-connect/id546505307', '_blank')}
                      >
                        <Smartphone className="w-3 h-3" />
                        App Store: Download Zoom App
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}


          {/* Location/Link */}
          {(() => {
            const isVideoMode = ['online', '100ms', '100ms_iframe', 'videosdk', 'videosdk_iframe'].includes(interview.mode);
            
            if (interview.locationUrl && isVideoMode) {
              return (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium">Video Interview</span>
                  <Button
                    size="sm"
                    onClick={handleJoinInterview}
                    disabled={!canJoinInterview()}
                    className="gap-2"
                  >
                    <Video className="w-4 h-4" />
                    Join Interview
                  </Button>
                </div>
              );
            } else if (interview.locationUrl && interview.mode === 'phone') {
              return (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium">Phone Interview</span>
                  <Button
                    size="sm"
                    onClick={() => window.location.href = `tel:${interview.locationUrl}`}
                    disabled={!canJoinInterview()}
                    className="gap-2"
                  >
                    <Phone className="w-4 h-4" />
                    Call Now
                  </Button>
                </div>
              );
            } else if (interview.locationUrl) {
              return (
                <div className="space-y-2">
                  <span className="text-sm font-medium">
                    {getModeLabel()}:
                  </span>
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm flex-1">
                      {interview.locationUrl}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyToClipboard}
                      className="h-8 w-8 p-0"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* YouTube Video - Extract and Display with Lock Overlay */}
          {(() => {
            if (!interview.notes) return null;
            
            // Extract YouTube URL from notes - supports both videos and playlists
            const videoRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})(?:[?&][\w=&-]*)?/;
            const playlistRegex = /(?:https?:\/\/)?(?:www\.)?youtube\.com\/playlist\?list=([a-zA-Z0-9_-]+)(?:[?&][\w=&-]*)?/;
            
            const videoMatch = interview.notes.match(videoRegex);
            const playlistMatch = interview.notes.match(playlistRegex);
            
            if (videoMatch || playlistMatch) {
              const videoId = videoMatch ? videoMatch[1] : null;
              const playlistId = playlistMatch ? playlistMatch[1] : null;
              
              // Build embed URL based on what we found
              let embedUrl = '';
              if (videoId) {
                embedUrl = `https://www.youtube.com/embed/${videoId}`;
              } else if (playlistId) {
                embedUrl = `https://www.youtube.com/embed/videoseries?list=${playlistId}`;
              }
              
              // Check if there's a "starttime" access mode indicator in notes
              const isStartTimeMode = interview.notes.includes('{{youtube_access:starttime}}');
              // Use precise millisecond check - unlocks ONLY at exact start time
              const isLocked = isStartTimeMode && timeDiff > 0;
              
              return (
                  <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Video className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      {isStartTimeMode ? 'Video Interview' : 'YouTube Video'}
                    </span>
                    {isLocked && (
                      <Badge variant="secondary" className="text-xs flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Unlocks at start time
                      </Badge>
                    )}
                  </div>
                  <div className="relative w-full rounded-xl overflow-hidden shadow-lg border border-border/50" style={{ paddingBottom: '56.25%' }}>
                    <iframe
                      className="absolute top-0 left-0 w-full h-full"
                      src={embedUrl}
                      title="YouTube video player"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                    
                    {/* Lock Overlay - Shows video preview but prevents interaction */}
                    {isLocked && (
                      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/80 to-black/70 backdrop-blur-md flex flex-col items-center justify-center z-10 cursor-not-allowed p-4">
                        <div className="text-center space-y-1.5 w-full max-w-sm">
                          <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 shadow-md">
                            <Lock className="w-2.5 h-2.5 text-primary" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-white font-bold text-sm tracking-tight">Video Locked</p>
                            <p className="text-white/90 text-[9px] leading-tight">
                              This video will unlock when your interview starts
                            </p>
                            <div className="pt-1 bg-black/40 rounded-lg p-1.5 backdrop-blur-sm">
                              <InterviewCountdown 
                                scheduledAt={interview.scheduledAt}
                                scheduledEndAt={interview.scheduledEndAt}
                                variant="compact"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* Notes - Render as HTML (excluding YouTube link and metadata) */}
          {(() => {
            if (!interview.notes) return null;
            
            // Remove standalone YouTube URLs (not inside anchor tags) and access mode metadata from notes
            let cleanedNotes = interview.notes;
            
            // First, protect anchor tags by temporarily replacing them
            const anchorTags: string[] = [];
            cleanedNotes = cleanedNotes.replace(/(<a\s+[^>]*>.*?<\/a>)/gi, (match) => {
              anchorTags.push(match);
              return `__ANCHOR_${anchorTags.length - 1}__`;
            });
            
            // Now remove standalone YouTube URLs
            cleanedNotes = cleanedNotes
              .replace(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})(?:[?&][\w=&-]*)?/g, '')
              .replace(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/playlist\?list=([a-zA-Z0-9_-]+)(?:[?&][\w=&-]*)?/g, '')
              .replace(/\{\{youtube_access:starttime\}\}/g, '');
            
            // Restore anchor tags
            cleanedNotes = cleanedNotes.replace(/__ANCHOR_(\d+)__/g, (_, index) => {
              return anchorTags[parseInt(index)];
            });
            
            cleanedNotes = cleanedNotes.trim();
            
            if (!cleanedNotes) return null;
            
            return (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span className="text-sm font-medium">Additional Notes</span>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg border border-border/50">
                  <div 
                    ref={notesRef}
                    className="quill-content-display max-w-none prose dark:prose-invert break-words"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(cleanedNotes) }} 
                  />
                </div>
                <style>{`
                  .quill-content-display {
                    color: hsl(var(--foreground));
                    line-height: 1.6;
                  }
                  
                  /* Headers */
                  .quill-content-display h1 {
                    font-size: 2em;
                    font-weight: bold;
                    color: hsl(var(--foreground));
                    margin-bottom: 0.5em;
                  }
                  
                  .quill-content-display h2 {
                    font-size: 1.5em;
                    font-weight: bold;
                    color: hsl(var(--foreground));
                    margin-bottom: 0.5em;
                  }
                  
                  .quill-content-display h3 {
                    font-size: 1.25em;
                    font-weight: bold;
                    color: hsl(var(--foreground));
                    margin-bottom: 0.5em;
                  }
                  
                  /* Paragraphs */
                  .quill-content-display p {
                    color: hsl(var(--foreground));
                    margin-bottom: 0.75em;
                    word-break: break-word;
                    overflow-wrap: break-word;
                  }
                  
                  /* Text formatting */
                  .quill-content-display strong {
                    font-weight: bold;
                    color: hsl(var(--foreground));
                  }
                  
                  .quill-content-display em {
                    font-style: italic;
                    color: hsl(var(--foreground));
                  }
                  
                  .quill-content-display u {
                    text-decoration: underline;
                  }
                  
                  .quill-content-display s {
                    text-decoration: line-through;
                  }
                  
                  /* Lists */
                  .quill-content-display ul,
                  .quill-content-display ol {
                    padding-left: 1.5em;
                    margin-bottom: 0.75em;
                    color: hsl(var(--foreground));
                  }
                  
                  .quill-content-display li {
                    color: hsl(var(--foreground));
                    margin-bottom: 0.25em;
                  }
                  
                  /* Links - make them clickable and styled */
                  .quill-content-display a {
                    color: hsl(var(--primary));
                    text-decoration: underline;
                    word-break: break-all;
                    cursor: pointer;
                  }
                  
                  .quill-content-display a:hover {
                    color: hsl(var(--primary) / 0.8);
                  }
                  
                  /* Quill font sizes - these are the classes Quill outputs */
                  .quill-content-display .ql-size-small {
                    font-size: 0.75em;
                  }
                  
                  .quill-content-display .ql-size-large {
                    font-size: 1.5em;
                  }
                  
                  .quill-content-display .ql-size-huge {
                    font-size: 2.5em;
                  }
                  
                  /* Alignment */
                  .quill-content-display .ql-align-center {
                    text-align: center;
                  }
                  
                  .quill-content-display .ql-align-right {
                    text-align: right;
                  }
                  
                  .quill-content-display .ql-align-justify {
                    text-align: justify;
                  }
                  
                  /* Allow inline styles to work (colors, custom sizes, etc.) */
                  .quill-content-display span {
                    color: inherit;
                  }
                  
                  /* Break long URLs and text */
                  .quill-content-display * {
                    word-wrap: break-word;
                    overflow-wrap: break-word;
                  }
                `}</style>
              </div>
            );
          })()}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          
          {(() => {
            const isVideoMode = ['online', '100ms', '100ms_iframe', 'videosdk', 'videosdk_iframe'].includes(interview.mode);
            
            if (!isVideoMode || !interview.locationUrl) return null;
            
            /* Live Button - Shows when interview is currently happening */
            if (isLive()) {
              return (
                <Button onClick={handleJoinInterview} className="gap-2 bg-red-600 hover:bg-red-700 text-white animate-pulse">
                  <Video className="w-4 h-4" />
                  Live Now - Join
                </Button>
              );
            }
            
            /* Upcoming Button - Shows 10 minutes before interview */
            if (isUpcoming()) {
              return (
                <Button disabled={true} className="gap-2 bg-orange-600/50 text-white cursor-not-allowed opacity-75">
                  <Video className="w-4 h-4" />
                  Starting Soon
                </Button>
              );
            }
            
            /* Regular Join Button - Shows for other cases */
            if (canJoinInterview()) {
              return (
                <Button onClick={handleJoinInterview} className="gap-2">
                  <Video className="w-4 h-4" />
                  Join Interview
                </Button>
              );
            }
            
            return null;
          })()}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default InterviewDetailsDialog;