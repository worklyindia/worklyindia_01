import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Profile Short URL Redirect Component
 * Handles /u/:shortId routes and redirects to full profile URL
 */
const ProfileShortUrlRedirect = () => {
  const { shortId } = useParams<{ shortId: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    const handleRedirect = async () => {
      if (!shortId) {
        console.error('❌ No short ID provided');
        toast.error('Invalid profile link');
        navigate('/');
        return;
      }

      console.log('🔗 Resolving profile short URL:', shortId);

      try {
        // Look up the profile by short_id
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('id, full_name, public_slug, short_id')
          .eq('short_id', shortId)
          .maybeSingle();

        if (error) {
          console.error('❌ Error looking up profile short URL:', error);
          toast.error('Failed to load profile');
          navigate('/');
          return;
        }

        if (!profile) {
          console.error('❌ Profile not found for short ID:', shortId);
          toast.error('Profile not found');
          navigate('/');
          return;
        }

        console.log('✅ Redirecting to profile:', profile.public_slug || profile.id);
        
        // Redirect to the full profile page with SEO-friendly slug
        navigate(`/candidate/${profile.public_slug || profile.id}`, { replace: true });

      } catch (error) {
        console.error('❌ Exception resolving profile short URL:', error);
        toast.error('An error occurred');
        navigate('/');
      }
    };

    handleRedirect();
  }, [shortId, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted">
      <div className="text-center space-y-4">
        <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
        <h2 className="text-xl font-semibold text-foreground">Loading profile...</h2>
        <p className="text-muted-foreground">Please wait while we redirect you</p>
      </div>
    </div>
  );
};

export default ProfileShortUrlRedirect;
