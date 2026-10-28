import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DownloadOptions {
  type: 'pdf' | 'csv' | 'json';
  filename: string;
  data: Record<string, unknown> | unknown[];
  template?: string;
}

interface DownloadResult {
  success: boolean;
  downloadUrl?: string;
  filename?: string;
  error?: string;
}

export const useSupabaseDownload = () => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);

  const download = async (options: DownloadOptions): Promise<DownloadResult> => {
    setIsDownloading(true);
    setProgress(10);

    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('Please login to download files');
        return { success: false, error: 'Not authenticated' };
      }

      setProgress(30);

      // Call Edge Function
      const { data, error } = await supabase.functions.invoke('generate-download', {
        body: options,
      });

      if (error) {
        console.error('Download error:', error);
        toast.error('Download failed: ' + error.message);
        return { success: false, error: error.message };
      }

      setProgress(70);

      if (!data?.success || !data?.downloadUrl) {
        const errorMsg = data?.error || 'Unknown error occurred';
        toast.error('Download failed: ' + errorMsg);
        return { success: false, error: errorMsg };
      }

      // Trigger download - fetch as blob to force download on mobile instead of viewing
      try {
        const downloadResponse = await fetch(data.downloadUrl);
        const blob = await downloadResponse.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = data.filename || options.filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up blob URL after a short delay
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      } catch (blobError) {
        // Fallback to direct link if blob fetch fails
        console.warn('Blob download failed, using direct link:', blobError);
        const link = document.createElement('a');
        link.href = data.downloadUrl;
        link.download = data.filename || options.filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      setProgress(100);
      toast.success('Download started!');

      return {
        success: true,
        downloadUrl: data.downloadUrl,
        filename: data.filename,
      };

    } catch (error) {
      console.error('Download error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Download failed';
      toast.error(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsDownloading(false);
      setProgress(0);
    }
  };

  const downloadCSV = async (filename: string, data: unknown[]) => {
    return download({ type: 'csv', filename, data });
  };

  const downloadJSON = async (filename: string, data: Record<string, unknown> | unknown[]) => {
    return download({ type: 'json', filename, data });
  };

  const downloadPDF = async (filename: string, data: Record<string, unknown> | unknown[], template?: string) => {
    return download({ type: 'pdf', filename, data, template });
  };

  return {
    download,
    downloadCSV,
    downloadJSON,
    downloadPDF,
    isDownloading,
    progress,
  };
};
