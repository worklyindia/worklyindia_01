import { supabase } from '@/integrations/supabase/client';

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

/**
 * Download service for generating and downloading files via Supabase
 * Files are temporarily stored and automatically deleted after download
 */
export const downloadService = {
  /**
   * Generic download function
   */
  async download(options: DownloadOptions): Promise<DownloadResult> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        return { success: false, error: 'Not authenticated' };
      }

      const { data, error } = await supabase.functions.invoke('generate-download', {
        body: options,
      });

      if (error) {
        console.error('Download service error:', error);
        return { success: false, error: error.message };
      }

      if (!data?.success || !data?.downloadUrl) {
        return { success: false, error: data?.error || 'Unknown error' };
      }

      // Trigger browser download - fetch as blob to force download on mobile
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
      } catch {
        // Fallback to direct link if blob fetch fails
        const link = document.createElement('a');
        link.href = data.downloadUrl;
        link.download = data.filename || options.filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      return {
        success: true,
        downloadUrl: data.downloadUrl,
        filename: data.filename,
      };
    } catch (error) {
      console.error('Download service error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Download failed' 
      };
    }
  },

  /**
   * Download data as CSV
   */
  async downloadCSV(filename: string, data: unknown[]): Promise<DownloadResult> {
    return this.download({ type: 'csv', filename, data });
  },

  /**
   * Download data as JSON
   */
  async downloadJSON(filename: string, data: Record<string, unknown> | unknown[]): Promise<DownloadResult> {
    return this.download({ type: 'json', filename, data });
  },

  /**
   * Download data as PDF
   */
  async downloadPDF(filename: string, data: Record<string, unknown> | unknown[], template?: string): Promise<DownloadResult> {
    return this.download({ type: 'pdf', filename, data, template });
  },

  /**
   * Convert array of objects to CSV string (for local fallback)
   */
  arrayToCSV(data: Record<string, unknown>[]): string {
    if (!data.length) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          const stringValue = value === null || value === undefined 
            ? '' 
            : typeof value === 'object' 
              ? JSON.stringify(value) 
              : String(value);
          
          // Escape quotes and wrap if contains special chars
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        }).join(',')
      )
    ];
    
    return csvRows.join('\n');
  },
};
