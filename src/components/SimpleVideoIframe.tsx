import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Video, LogOut, AlertCircle, Loader2, Camera, Mic, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface SimpleVideoIframeProps {
  iframeUrl: string;
  onLeave: () => void;
  isHost?: boolean;
  interviewId?: string;
  scheduledEndAt?: string | null;
}

export const SimpleVideoIframe = ({ iframeUrl, onLeave, isHost = false, interviewId, scheduledEndAt }: SimpleVideoIframeProps) => {
  const [shouldLoadIframe, setShouldLoadIframe] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [checkingPermissions, setCheckingPermissions] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState<string | null>(null);
  const [showEmbedHint, setShowEmbedHint] = useState(false);
  const [meetingEnded, setMeetingEnded] = useState(false);
  const [exitCountdown, setExitCountdown] = useState(5);
  const { toast } = useToast();
  
  console.log('🎥 SimpleVideoIframe initialized:', {
    url: iframeUrl,
    isHost,
    urlValid: iframeUrl?.includes('http'),
    protocol: window.location.protocol,
    isHTTPS: window.location.protocol === 'https:',
    browserInfo: navigator.userAgent
  });

  const requestPermissions = async () => {
    setCheckingPermissions(true);
    try {
      console.log('📷 Requesting camera and microphone permissions...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      console.log('✅ Permissions granted');
      
      // Stop the stream immediately - we just needed to get permissions
      stream.getTracks().forEach(track => track.stop());
      
      setPermissionsGranted(true);
      setShouldLoadIframe(true);
      
      toast({
        title: "Permissions Granted",
        description: "Camera and microphone access granted. Loading meeting...",
      });
    } catch (error) {
      console.error('❌ Permission denied:', error);
      setIframeError('Camera and microphone access denied. Please allow permissions and try again.');
      
      toast({
        title: "Permission Denied",
        description: "Please allow camera and microphone access to join the meeting.",
        variant: "destructive",
      });
    } finally {
      setCheckingPermissions(false);
    }
  };

  // Show hint if iframe loads but stays black for too long
  useEffect(() => {
    if (iframeLoaded && !iframeError) {
      const timer = setTimeout(() => {
        setShowEmbedHint(true);
      }, 8000); // 8 seconds after load
      return () => clearTimeout(timer);
    }
  }, [iframeLoaded, iframeError]);

  // Realtime listener for auto-disconnect when meeting ends
  useEffect(() => {
    if (!interviewId) return;
    
    console.log('👂 SimpleVideoIframe: Setting up realtime listener for interview:', interviewId);
    
    const channel = supabase
      .channel(`interview-status-${interviewId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'interviews',
        filter: `id=eq.${interviewId}`
      }, (payload) => {
        console.log('📡 SimpleVideoIframe: Interview status update:', payload);
        
        if (payload.new && payload.new.status === 'completed') {
          console.log('✅ Meeting ended by server - showing end screen');
          setMeetingEnded(true);
        }
      })
      .subscribe((status) => {
        console.log('📡 SimpleVideoIframe: Realtime subscription status:', status);
      });
    
    return () => { 
      console.log('🔌 SimpleVideoIframe: Cleaning up realtime listener');
      supabase.removeChannel(channel); 
    };
  }, [interviewId, onLeave, toast]);

  // Client-side fallback: Check scheduled end time locally
  useEffect(() => {
    if (!scheduledEndAt || meetingEnded) return;
    
    const checkEndTimer = setInterval(() => {
      const now = new Date();
      const endTime = new Date(scheduledEndAt);
      
      if (now >= endTime) {
        console.log('⏰ Client-side: End time reached - showing end screen');
        setMeetingEnded(true);
      }
    }, 5000); // Check every 5 seconds
    
    return () => clearInterval(checkEndTimer);
  }, [scheduledEndAt, meetingEnded]);

  // Auto-exit countdown when meeting ends
  useEffect(() => {
    if (meetingEnded && exitCountdown > 0) {
      const timer = setTimeout(() => {
        setExitCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (meetingEnded && exitCountdown === 0) {
      onLeave();
    }
  }, [meetingEnded, exitCountdown, onLeave]);

  // Preview screen - show before permissions are granted
  if (!shouldLoadIframe) {
    return (
      <div className="h-screen w-screen bg-background flex flex-col">
        {/* Header */}
        <div className="bg-card border-b border-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" />
            <span className="font-semibold text-foreground">
              {isHost ? 'Interview Room (Host)' : 'Interview Room (Guest)'}
            </span>
          </div>
          <Button
            onClick={onLeave}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <LogOut className="w-4 h-4" />
            Cancel
          </Button>
        </div>

        {/* Preview Content */}
        <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-background to-muted p-6">
          <div className="max-w-md w-full space-y-6 text-center">
            {/* HTTPS Warning */}
            {window.location.protocol !== 'https:' && !iframeError && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-4">
                <AlertCircle className="w-5 h-5 text-yellow-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-yellow-700 dark:text-yellow-500">
                  Warning: This page is not served over HTTPS. Camera access may fail.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Please ensure the site is accessed via HTTPS for video meetings.
                </p>
              </div>
            )}
            
            {iframeError ? (
              <>
                <div className="w-20 h-20 mx-auto bg-destructive/10 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-10 h-10 text-destructive" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">Permission Required</h2>
                  <p className="text-muted-foreground mb-4">{iframeError}</p>
                  <div className="bg-muted/50 rounded-lg p-4 text-sm text-left space-y-2">
                    <p className="font-semibold">To fix this:</p>
                    <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                      <li>Click the lock icon in your browser's address bar</li>
                      <li>Allow camera and microphone access</li>
                      <li>Reload this page and try again</li>
                    </ol>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button onClick={requestPermissions} className="flex-1">
                    Try Again
                  </Button>
                  <Button onClick={onLeave} variant="outline" className="flex-1">
                    Exit
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                  <Video className="w-10 h-10 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">Ready to Join?</h2>
                  <p className="text-muted-foreground">
                    We need access to your camera and microphone to join the interview
                  </p>
                </div>

                <div className="bg-muted/50 rounded-lg p-6 space-y-4">
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <Camera className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Camera Access</p>
                      <p className="text-sm text-muted-foreground">Required for video call</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <Mic className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Microphone Access</p>
                      <p className="text-sm text-muted-foreground">Required for audio call</p>
                    </div>
                  </div>
                </div>

                <Button 
                  onClick={requestPermissions}
                  disabled={checkingPermissions}
                  size="lg"
                  className="w-full gap-2"
                >
                  {checkingPermissions ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Checking Permissions...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      Grant Permissions & Join
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black flex flex-col relative">
      {/* Meeting Ended Screen */}
      {meetingEnded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-50 p-6">
          <div className="text-center space-y-6 max-w-md">
            <div className="w-24 h-24 mx-auto bg-red-500/20 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-12 h-12 text-red-500" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white">Meeting Ended</h1>
            <p className="text-lg text-muted-foreground">
              The scheduled interview time has expired.
            </p>
            <Button 
              onClick={onLeave}
              size="lg"
              className="w-full max-w-xs gap-2 text-lg py-6"
            >
              <LogOut className="w-5 h-5" />
              Exit Meeting ({exitCountdown}s)
            </Button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {!iframeLoaded && !iframeError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-10">
          <Loader2 className="w-16 h-16 text-primary animate-spin mb-4" />
          <p className="text-white text-lg">Connecting to meeting...</p>
          <p className="text-muted-foreground text-sm mt-2">Please allow camera and microphone permissions</p>
        </div>
      )}
      
      {/* Error State */}
      {iframeError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-10 p-6">
          <AlertCircle className="w-16 h-16 text-destructive mb-4" />
          <p className="text-white text-lg mb-2">Failed to load meeting</p>
          <p className="text-muted-foreground text-sm mb-4 max-w-md text-center">{iframeError}</p>
          
          <div className="bg-muted/20 rounded-lg p-4 max-w-md mb-6 text-sm text-left space-y-2">
            <p className="font-semibold text-white">Common fixes:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Ensure you're on HTTPS (not HTTP)</li>
              <li>Allow camera and microphone in browser settings</li>
              <li>Check if another app is using your camera</li>
              <li>Disable ad-blockers or privacy extensions</li>
              <li>Try using Chrome or Firefox (latest versions)</li>
              <li>Refresh the page and try again</li>
            </ul>
          </div>
          
          <div className="flex gap-4">
            <Button onClick={() => window.location.reload()} variant="default">
              Retry
            </Button>
            <Button onClick={onLeave} variant="outline">
              Exit
            </Button>
          </div>
        </div>
      )}

      {/* Video Iframe - Full permissions for 100ms and VideoSDK */}
      <iframe
        src={iframeUrl}
        allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-read; clipboard-write; picture-in-picture; encrypted-media; screen-wake-lock"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
        className="flex-1 w-full border-0 bg-black"
        title="Video Interview"
        style={{ height: '100vh' }}
        onLoad={() => {
          console.log('✅ Iframe loaded successfully:', {
            url: iframeUrl,
            timestamp: new Date().toISOString()
          });
          setIframeLoaded(true);
        }}
        onError={(e) => {
          console.error('❌ Iframe load error:', {
            url: iframeUrl,
            error: e,
            timestamp: new Date().toISOString()
          });
          setIframeError('Unable to connect to the meeting. Please check your internet connection and try again.');
        }}
      />
    </div>
  );
};
