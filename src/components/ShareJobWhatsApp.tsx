import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatJobForWhatsApp } from '@/utils/whatsappFormatter';

interface Job {
  id: string;
  title: string;
  location?: string;
  city?: string;
  state?: string;
  job_type?: string;
  experience_level?: string;
  salary_min?: number;
  salary_max?: number;
  salary_currency?: string;
  salary_period?: string;
  category?: string;
  company_name?: string;
  short_id?: string;
  public_slug?: string;
}

interface ShareJobWhatsAppProps {
  job: Job;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

/**
 * Component to share a job via WhatsApp with properly formatted message
 */
export const ShareJobWhatsApp = ({ 
  job, 
  variant = 'default', 
  size = 'default',
  className = '' 
}: ShareJobWhatsAppProps) => {
  
  const handleShare = () => {
    // Format the job for WhatsApp
    const message = formatJobForWhatsApp(job);
    
    // Create WhatsApp URL
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    
    // Open WhatsApp
    window.open(whatsappUrl, '_blank');
  };

  return (
    <Button
      onClick={handleShare}
      variant={variant}
      size={size}
      className={className}
    >
      <MessageCircle className="w-4 h-4 mr-2" />
      Share on WhatsApp
    </Button>
  );
};
