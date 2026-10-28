import { formatInTimeZone } from 'date-fns-tz';

// Time-only values for each page (IST timezone)
// These times will be combined with today's date for daily auto-updates
const PAGE_UPDATE_TIMES: Record<string, string> = {
  'terms': '12:00:00',
  'privacy': '11:12:09',
  'refund': '11:42:55',
  'wallet': '09:50:33',
  'disclaimer': '12:10:33',
  'points': '11:15:21',
  'rbi-compliance': '10:25:47',
  'about-us': '10:21:11',
  'contact-us': '10:45:36',
  'help-center': '10:35:18',
  'faq': '10:15:42',
  'company-profile': '09:25:56',
  'job-policy': '09:15:14',
  'how-it-works': '10:45:29',
  'career-guidance': '10:05:38',
  'skill-assessment': '09:35:52',
  'interview-tips': '11:05:27',
  'resume-builder': '09:05:41',
  'default': '10:30:00'
};

// Utility function to get dynamic last updated timestamp in IST
// Returns today's date with page-specific time
// Format: "29 October 2025 at 10:21:11 AM"
export const getUpdatedTimestamp = (pageIdentifier: string) => {
  const time = PAGE_UPDATE_TIMES[pageIdentifier] || PAGE_UPDATE_TIMES.default;
  
  // Get today's date in IST
  const now = new Date();
  const todayIST = formatInTimeZone(now, 'Asia/Kolkata', 'yyyy-MM-dd');
  
  // Combine today's date with the page-specific time
  const timestamp = `${todayIST}T${time}+05:30`;
  
  // Format in IST timezone
  return formatInTimeZone(
    new Date(timestamp),
    'Asia/Kolkata',
    "d MMMM yyyy 'at' hh:mm:ss a"
  );
};