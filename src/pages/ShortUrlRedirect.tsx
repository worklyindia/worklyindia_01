import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Short URL Redirect Component
 * Handles /j/:shortId routes and redirects to full job URL
 */
const ShortUrlRedirect = () => {
  const { shortId } = useParams<{ shortId: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    const handleRedirect = async () => {
      if (!shortId) {
        console.error('❌ No short ID provided');
        toast.error('Invalid job link');
        navigate('/jobs');
        return;
      }

      console.log('🔗 Resolving short URL:', shortId);

      try {
        // Look up the job by short_id (only active jobs)
        const { data: job, error } = await supabase
          .from('jobs')
          .select('id, title, status, public_slug')
          .eq('short_id', shortId)
          .eq('status', 'active')
          .maybeSingle();

        if (error) {
          console.error('❌ Error looking up short URL:', error);
        }

        if (job) {
          console.log('✅ Redirecting to job:', job.public_slug || job.id);
          navigate(`/job/${job.public_slug || job.id}`, { replace: true });
          return;
        }

        // Fallback: this short_id might belong to an external partner job
        // (older Telegram posts used /j/:shortId for external jobs).
        const { data: ext } = await supabase
          .from('external_job_shortlinks')
          .select('short_id')
          .eq('short_id', shortId)
          .maybeSingle();

        if (ext?.short_id) {
          console.log('✅ Redirecting to external job:', ext.short_id);
          navigate(`/ej/s/${ext.short_id}`, { replace: true });
          return;
        }

        console.error('❌ Job not found for short ID:', shortId);
        toast.error('Job not found or no longer available');
        navigate('/jobs');
        return;

      } catch (error) {
        console.error('❌ Exception resolving short URL:', error);
        toast.error('An error occurred');
        navigate('/jobs');
      }
    };

    handleRedirect();
  }, [shortId, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted">
      <div className="text-center space-y-4">
        <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
        <h2 className="text-xl font-semibold text-foreground">Loading job details...</h2>
        <p className="text-muted-foreground">Please wait while we redirect you</p>
      </div>
    </div>
  );
};

export default ShortUrlRedirect;
