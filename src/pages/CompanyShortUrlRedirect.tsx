import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Company Short URL Redirect Component
 * Handles /c/:shortId routes and redirects to full company URL
 */
const CompanyShortUrlRedirect = () => {
  const { shortId } = useParams<{ shortId: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    const handleRedirect = async () => {
      if (!shortId) {
        console.error('❌ No short ID provided');
        toast.error('Invalid company link');
        navigate('/company-directory');
        return;
      }

      console.log('🔗 Resolving company short URL:', shortId);

      try {
        // Look up the company by short_id
        const { data: company, error } = await supabase
          .from('companies')
          .select('id, company_name, slug, short_id')
          .eq('short_id', shortId)
          .maybeSingle();

        if (error) {
          console.error('❌ Error looking up company short URL:', error);
          toast.error('Failed to load company');
          navigate('/company-directory');
          return;
        }

        if (!company) {
          console.error('❌ Company not found for short ID:', shortId);
          toast.error('Company not found');
          navigate('/company-directory');
          return;
        }

        console.log('✅ Redirecting to company:', company.slug || company.id);
        
        // Redirect to the full company profile page with SEO-friendly slug
        navigate(`/company/${company.slug || company.id}`, { replace: true });

      } catch (error) {
        console.error('❌ Exception resolving company short URL:', error);
        toast.error('An error occurred');
        navigate('/company-directory');
      }
    };

    handleRedirect();
  }, [shortId, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted">
      <div className="text-center space-y-4">
        <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
        <h2 className="text-xl font-semibold text-foreground">Loading company profile...</h2>
        <p className="text-muted-foreground">Please wait while we redirect you</p>
      </div>
    </div>
  );
};

export default CompanyShortUrlRedirect;
