import { FormattedError } from './errorFormatter';
import { formatErrorForClipboard } from './errorFormatter';
import { BRAND_CONFIG } from '@/config/brandConfig';

export const reportError = async (error: FormattedError): Promise<boolean> => {
  try {
    const errorReport = formatErrorForClipboard(error);
    const subject = `Error Report: ${error.category.title}`;
    const body = encodeURIComponent(errorReport);
    
    // Open email client with pre-filled error report
    window.location.href = `mailto:${BRAND_CONFIG.email}?subject=${encodeURIComponent(subject)}&body=${body}`;
    
    return true;
  } catch (e) {
    console.error('Failed to send error report:', e);
    return false;
  }
};

export const shareErrorOnWhatsApp = (error: FormattedError): void => {
  const errorReport = formatErrorForClipboard(error);
  const message = encodeURIComponent(`Error Report:\n\n${errorReport}`);
  const phone = BRAND_CONFIG.whatsappNumber;
  
  // Send WhatsApp to support number from Contact Us page
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const whatsappUrl = isMobile 
    ? `whatsapp://send?phone=${phone}&text=${message}`
    : `https://web.whatsapp.com/send?phone=${phone}&text=${message}`;
  
  window.open(whatsappUrl, '_blank');
};

export const copyErrorToClipboard = async (error: FormattedError): Promise<boolean> => {
  try {
    const errorReport = formatErrorForClipboard(error);
    await navigator.clipboard.writeText(errorReport);
    return true;
  } catch (e) {
    console.error('Failed to copy to clipboard:', e);
    return false;
  }
};
