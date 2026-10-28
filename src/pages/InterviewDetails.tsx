import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import BottomNavigation from '@/components/BottomNavigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, Video, Phone, ExternalLink, FileText, Copy, Check, Share2, ArrowLeft, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { InterviewCountdown } from '@/components/InterviewCountdown';
import { Helmet } from 'react-helmet-async';
import { sanitizeHtml } from '@/utils/sanitize';
import { BRAND_CONFIG } from '@/config/brandConfig';

interface InterviewData {
  id: string;
  applicant_id: string;
  scheduled_at: string;
  scheduled_end_at?: string;
  mode: string;
  location_url?: string;
  status: string;
  notes?: string;
  video_platform?: string;
  jobs: {
    title: string;
    companies: {
      company_name: string;
    };
  };
}

const InterviewDetails = () => {
  const { interviewId } = useParams<{ interviewId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [interview, setInterview] = useState<InterviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const fetchInterview = async () => {
      if (!interviewId) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('interviews')
          .select(`
            *,
            jobs!interviews_job_id_fkey(
              title,
              companies!jobs_company_id_fkey(
                company_name
              )
            )
          `)
          .eq('id', interviewId)
          .single();

        if (error) throw error;

        if (data) {
          setInterview(data as unknown as InterviewData);
        } else {
          toast({
            title: "Interview Not Found",
            description: "The interview you're looking for doesn't exist.",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error('Error fetching interview:', error);
        toast({
          title: "Error",
          description: "Failed to load interview details.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchInterview();
  }, [interviewId, toast]);

  // Sync with server time
  useEffect(() => {
    const syncServerTime = async () => {
      try {
        const { data, error } = await supabase.rpc('get_server_time_ist');
        if (!error && data) {
          setCurrentTime(new Date(data as number));
        }
      } catch (error) {
        console.error('Failed to sync server time:', error);
      }
    };

    syncServerTime();
    const interval = setInterval(syncServerTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Real-time status updates
  useEffect(() => {
    if (!interviewId) return;

    const channel = supabase
      .channel(`interview-details-${interviewId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'interviews',
        filter: `id=eq.${interviewId}`
      }, (payload) => {
        if (payload.new) {
          // Only update the interview fields, not the jobs relationship
          setInterview(prev => {
            if (!prev) return null;
            return {
              ...prev,
              status: payload.new.status,
              scheduled_at: payload.new.scheduled_at,
              scheduled_end_at: payload.new.scheduled_end_at,
              mode: payload.new.mode,
              location_url: payload.new.location_url,
              notes: payload.new.notes,
              video_platform: payload.new.video_platform
            };
          });
          if (payload.new.status === 'completed') {
            toast({
              title: "Interview Ended",
              description: "The scheduled time has expired.",
            });
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [interviewId, toast]);

  const handleCopyLink = async () => {
    const link = window.location.href;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast({
        title: "Link Copied!",
        description: "Interview details link copied to clipboard.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Please copy the link manually.",
        variant: "destructive"
      });
    }
  };

  const handleWhatsAppShare = () => {
    if (!interview) return;
    const text = `Interview Details: ${interview.jobs.title} at ${interview.jobs.companies.company_name}\n${window.location.href}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleEmailShare = () => {
    if (!interview) return;
    const subject = `Interview Details: ${interview.jobs.title}`;
    const body = `Hi,\n\nHere are the details for my interview:\n\nJob: ${interview.jobs.title}\nCompany: ${interview.jobs.companies.company_name}\nDate: ${format(new Date(interview.scheduled_at), 'PPP')}\nTime: ${format(new Date(interview.scheduled_at), 'p')}\n\nView full details: ${window.location.href}`;
    const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header hideSearch />
        <main className="container mx-auto px-4 py-6 pb-20">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </main>
        <BottomNavigation />
      </div>
    );
  }

  if (!interview) {
    return (
      <div className="min-h-screen bg-background">
        <Header hideSearch />
        <main className="container mx-auto px-4 py-6 pb-20">
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold text-foreground mb-2">Interview Not Found</h2>
            <p className="text-muted-foreground mb-4">The interview you're looking for doesn't exist or has been removed.</p>
            <Button onClick={() => navigate('/activity')}>
              Go to Activity
            </Button>
          </div>
        </main>
        <BottomNavigation />
      </div>
    );
  }

  const scheduledDate = new Date(interview.scheduled_at);
  const endDate = interview.scheduled_end_at ? new Date(interview.scheduled_end_at) : null;
  const isUpcoming = scheduledDate > currentTime;
  const isLive = currentTime >= scheduledDate && (!endDate || currentTime <= endDate);
  const isCompleted = interview.status === 'completed' || (endDate && currentTime > endDate);
  
  // Check if current user is the owner (applicant or employer)
  const isApplicant = user?.id === interview.applicant_id;
  const isOwner = isApplicant; // Can extend to check if user is employer too

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Interview Details - {interview.jobs.title} | {BRAND_CONFIG.name}</title>
        <meta name="description" content={`Interview details for ${interview.jobs.title} at ${interview.jobs.companies.company_name}`} />
      </Helmet>

      <Header hideSearch />
      
      <main className="container mx-auto px-4 py-6 pb-20 max-w-3xl">
        <div className="space-y-6">
          {/* Back Button */}
          <Button 
            variant="ghost" 
            onClick={() => navigate(-1)}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          {/* Header with Share Buttons */}
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-foreground">Interview Details</h1>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="gap-2"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy Link'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleWhatsAppShare}
                className="gap-2"
              >
                <Phone className="w-4 h-4" />
                WhatsApp
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleEmailShare}
                className="gap-2"
              >
                <FileText className="w-4 h-4" />
                Email
              </Button>
            </div>
          </div>

          {/* Main Card */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-xl mb-2">{interview.jobs.title}</CardTitle>
                  <p className="text-muted-foreground">{interview.jobs.companies.company_name}</p>
                </div>
                <Badge className={
                  isLive ? 'bg-green-600 text-white animate-pulse' :
                  isCompleted ? 'bg-gray-500 text-white' :
                  'bg-blue-600 text-white'
                }>
                  {isLive ? '🔴 Live' : isCompleted ? 'Completed' : 'Upcoming'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Countdown */}
              {isUpcoming && (
                <InterviewCountdown
                  scheduledAt={interview.scheduled_at}
                  scheduledEndAt={interview.scheduled_end_at}
                />
              )}

              {/* Interview Details */}
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">Date</p>
                    <p className="text-sm text-muted-foreground">{format(scheduledDate, 'PPP')}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">Time</p>
                    <p className="text-sm text-muted-foreground">
                      {format(scheduledDate, 'p')}
                      {endDate && ` - ${format(endDate, 'p')}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  {interview.mode === 'video' ? (
                    <Video className="w-5 h-5 text-muted-foreground mt-0.5" />
                  ) : (
                    <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
                  )}
                  <div>
                    <p className="font-medium text-foreground">Mode</p>
                    <p className="text-sm text-muted-foreground capitalize">{interview.mode}</p>
                  </div>
                </div>

                {interview.location_url && isOwner && (
                  <div className="flex items-start gap-3">
                    <ExternalLink className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-foreground mb-1">
                        {interview.mode === 'video' ? 'Meeting Link' : 'Location'}
                      </p>
                      {interview.mode === 'video' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(interview.location_url, '_blank')}
                        >
                          Join Meeting
                        </Button>
                      ) : (
                        <a
                          href={interview.location_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline"
                        >
                          {interview.location_url}
                        </a>
                      )}
                    </div>
                  </div>
                )}
                
                {interview.location_url && !isOwner && (
                  <div className="flex items-start gap-3">
                    <ExternalLink className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground mb-1">
                        {interview.mode === 'video' ? 'Meeting Link' : 'Location'}
                      </p>
                      <p className="text-sm text-muted-foreground">Hidden for privacy</p>
                    </div>
                  </div>
                )}

                {interview.notes && isOwner && (
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground mb-1">Notes</p>
                      <div 
                        className="text-sm text-muted-foreground prose dark:prose-invert max-w-none" 
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(interview.notes) }} 
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {user && (
                <div className="pt-4 border-t">
                  <Button
                    onClick={() => navigate('/activity')}
                    variant="outline"
                    className="w-full"
                  >
                    Go to Activity Page
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      
      <BottomNavigation />
    </div>
  );
};

export default InterviewDetails;
