import { useState } from 'react';
import { FormattedError } from '@/utils/errorFormatter';
import { copyErrorToClipboard, reportError, shareErrorOnWhatsApp } from '@/utils/errorReporter';
import { useToast } from '@/hooks/use-toast';

export const useErrorActions = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const copyError = async (error: FormattedError) => {
    setIsLoading(true);
    const success = await copyErrorToClipboard(error);
    setIsLoading(false);

    if (success) {
      toast({
        title: 'Copied!',
        description: 'Error details copied to clipboard',
      });
    } else {
      toast({
        title: 'Failed',
        description: 'Could not copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  const sendReport = async (error: FormattedError) => {
    setIsLoading(true);
    const success = await reportError(error);
    setIsLoading(false);

    if (success) {
      toast({
        title: 'Report Sent',
        description: 'Opening email client...',
      });
    } else {
      toast({
        title: 'Failed',
        description: 'Could not send report',
        variant: 'destructive',
      });
    }
  };

  const shareOnWhatsApp = (_error: FormattedError) => {
    shareErrorOnWhatsApp(_error);
    toast({
      title: 'Opening WhatsApp',
      description: 'Share error details with support',
    });
  };

  return {
    copyError,
    sendReport,
    shareOnWhatsApp,
    isLoading,
  };
};
