// Email provider detection and inbox opening utilities

export const detectEmailProvider = (email: string): string => {
  const domain = email.split('@')[1]?.toLowerCase();
  
  if (!domain) return 'unknown';
  
  // Gmail variants
  if (domain.includes('gmail') || domain.includes('googlemail')) return 'gmail';
  
  // Yahoo variants
  if (domain.includes('yahoo') || domain.includes('ymail') || domain.includes('rocketmail')) return 'yahoo';
  
  // Outlook/Hotmail/Live variants
  if (domain.includes('outlook') || domain.includes('hotmail') || domain.includes('live') || domain.includes('msn')) return 'outlook';
  
  // Indian email providers
  if (domain.includes('rediffmail') || domain.includes('rediff')) return 'rediffmail';
  if (domain.includes('zoho')) return 'zoho';
  
  // Apple
  if (domain.includes('icloud') || domain.includes('me.com') || domain.includes('mac.com')) return 'icloud';
  
  // AOL
  if (domain.includes('aol')) return 'aol';
  
  return 'unknown';
};

export const getEmailInboxUrl = (email: string): string => {
  const provider = detectEmailProvider(email);
  
  switch (provider) {
    case 'gmail':
      return 'https://mail.google.com/mail/u/0/#inbox';
    case 'yahoo':
      return 'https://mail.yahoo.com/';
    case 'outlook':
      return 'https://outlook.live.com/mail/0/inbox';
    case 'rediffmail':
      return 'https://mail.rediff.com/';
    case 'zoho':
      return 'https://mail.zoho.com/';
    case 'icloud':
      return 'https://www.icloud.com/mail';
    case 'aol':
      return 'https://mail.aol.com/';
    default:
      return 'mailto:';
  }
};

export const openEmailInbox = (email: string) => {
  const url = getEmailInboxUrl(email);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  if (isMobile && url === 'mailto:') {
    // On mobile, use mailto which opens the default email app
    window.location.href = 'mailto:';
    return;
  }
  
  // Try to open in new tab
  const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
  
  // If popup was blocked or on mobile, provide fallback
  if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
    // Try alternative method
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
