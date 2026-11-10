/**
 * Downloads a file directly instead of opening in browser
 * Works by fetching as blob and triggering download
 */
export const downloadFileDirectly = async (url: string, filename?: string): Promise<void> => {
  try {
    // Fetch the file as blob
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch file');
    }
    
    const blob = await response.blob();
    
    // Create blob URL
    const blobUrl = URL.createObjectURL(blob);
    
    // Extract filename from URL if not provided
    const downloadFilename = filename || url.split('/').pop()?.split('?')[0] || 'download.pdf';
    
    // Create temporary link and trigger download
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = downloadFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Cleanup blob URL
    URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('Direct download failed, falling back to window.open:', error);
    // Fallback to opening in new tab if fetch fails (CORS issues)
    window.open(url, '_blank');
  }
};
