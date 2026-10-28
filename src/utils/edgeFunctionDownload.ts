import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SITE_CONFIG } from "@/config/siteConfig";

export type DownloadType = 'pdf' | 'csv' | 'json';
export type ResumeTemplate =
  | 'professional'
  | 'creative'
  | 'minimalist'
  | 'Professional'
  | 'ATS Simple'
  | 'Modern'
  | 'Minimal'
  | 'Executive'
  | 'Fresher'
  | 'Two Column'
  | 'One Column'
  | 'Compact'
  | 'Creative';
export type CoverLetterTemplate =
  | 'Professional'
  | 'ATS Simple'
  | 'Modern'
  | 'Minimal'
  | 'Executive'
  | 'Fresher'
  | 'Creative'
  | 'Corporate'
  | 'Formal'
  | 'Simple';
export type TemplateType = 
  | 'wallet-statement' 
  | 'wallet-history' 
  | 'applicants-list' 
  | 'certificate'
  | 'resume'
  | 'cover-letter'
  | 'default';

export interface DownloadColumn {
  key: string;
  header: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  colorize?: boolean;
}

export interface SummaryBox {
  label: string;
  value: string | number;
  color: 'green' | 'red' | 'blue' | 'purple' | 'gray';
}

export interface DownloadConfig {
  title?: string;
  subtitle?: string;
  orientation?: 'portrait' | 'landscape';
  // User info
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  // Wallet specific
  totalCredits?: number;
  totalDebits?: number;
  currentBalance?: number;
  // Certificate specific
  certificateNumber?: string;
  skillName?: string;
  level?: string;
  score?: number;
  issuedAt?: string;
  expiresAt?: string;
  verificationUrl?: string;
  // Applicants specific
  jobTitle?: string;
  totalApplicants?: number;
  // Cover letter specific
  coverLetterContent?: string;
  coverLetterTemplate?: CoverLetterTemplate;
  applicantName?: string;
  applicationDate?: string;
  // Summary and columns
  summaryBoxes?: SummaryBox[];
  columns?: DownloadColumn[];
}

interface EdgeDownloadResponse {
  success: boolean;
  downloadUrl?: string;
  filename?: string;
  error?: string;
  details?: string;
}

/**
 * Download a file using the Edge Function
 * @param type - File type: 'pdf', 'csv', or 'json'
 * @param filename - Base filename (without extension)
 * @param data - Data to export
 * @param template - Template name for styled PDFs
 * @param config - Additional configuration
 * @returns Promise<boolean> - true if successful
 */
export async function downloadViaEdgeFunction(
  type: DownloadType,
  filename: string,
  data: Record<string, unknown> | unknown[],
  template?: TemplateType,
  config?: DownloadConfig
): Promise<boolean> {
  const loadingToast = toast.loading(`Generating ${type.toUpperCase()}...`);

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.dismiss(loadingToast);
      toast.error('Please login to download');
      return false;
    }

    const response = await supabase.functions.invoke<EdgeDownloadResponse>('generate-download', {
      body: {
        type,
        filename,
        data,
        template,
        config,
      },
    });

    toast.dismiss(loadingToast);

    if (response.error) {
      console.error('Edge function error:', response.error);
      toast.error(`Download failed: ${response.error.message || 'Unknown error'}`);
      return false;
    }

    if (!response.data?.success || !response.data?.downloadUrl) {
      console.error('Download failed:', response.data?.error || 'No download URL');
      toast.error(response.data?.error || 'Failed to generate download');
      return false;
    }

    // Trigger download - fetch as blob to force download instead of view
    try {
      const downloadResponse = await fetch(response.data.downloadUrl);
      const blob = await downloadResponse.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = response.data.filename || `${filename}.${type}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch {
      // Fallback to direct link if blob fetch fails
      const link = document.createElement('a');
      link.href = response.data.downloadUrl;
      link.download = response.data.filename || `${filename}.${type}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    toast.success(`${type.toUpperCase()} downloaded successfully!`);
    return true;
  } catch (error) {
    toast.dismiss(loadingToast);
    console.error('Download error:', error);
    toast.error('Failed to generate download. Please try again.');
    return false;
  }
}

// ============ WALLET STATEMENT HELPERS ============

interface WalletTransaction {
  id: string;
  type: string;
  description?: string;
  points: number;
  amount?: number;
  status?: string;
  created_at: string;
}

export function formatWalletDataForDownload(
  transactions: WalletTransaction[],
  config?: Partial<DownloadConfig>
): { data: unknown[]; config: DownloadConfig } {
  const formattedData = transactions.map((t, index) => {
    const txDate = new Date(t.created_at);
    const isCredit = t.points > 0;
    const statusText = t.status === 'completed' || t.status === 'success' ? 'Success' : t.status === 'pending' ? 'Pending' : 'Failed';
    
    return {
      '#': index + 1,
      Date: txDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'long' }),
      Description: t.description || t.type,
      Credit: isCredit ? `+${t.points}` : '',
      Debit: !isCredit ? `${t.points}` : '',
      Amount: t.amount > 0 ? `₹${t.amount}` : '-',
      Status: statusText,
    };
  });

  const downloadConfig: DownloadConfig = {
    title: 'Points Wallet Statement',
    ...config,
    columns: [
      { key: '#', header: '#', width: 30 },
      { key: 'Date', header: 'Date', width: 60 },
      { key: 'Description', header: 'Description', width: 180 },
      { key: 'Credit', header: 'Credit', width: 50, colorize: true },
      { key: 'Debit', header: 'Debit', width: 50, colorize: true },
      { key: 'Amount', header: 'Amount', width: 50 },
      { key: 'Status', header: 'Status', width: 50 },
    ],
  };

  return { data: formattedData, config: downloadConfig };
}

// ============ APPLICANTS HELPERS ============

interface Applicant {
  profile?: {
    full_name?: string;
    email?: string;
    phone?: string;
    current_position?: string;
    company?: string;
    location?: string;
    skills?: string[];
  };
  api_full_name?: string;
  api_email?: string;
  api_phone?: string;
  api_current_position?: string;
  api_company?: string;
  api_location?: string;
  api_skills?: string[];
  application_source?: string;
  user_id?: string;
  status: string;
  applied_at: string;
}

export function formatApplicantsForDownload(
  applicants: Applicant[],
  jobTitle: string
): { data: unknown[]; config: DownloadConfig } {
  const getStatusDisplayName = (status: string) => {
    switch (status.toLowerCase()) {
      case "applied": return "Applied";
      case "reviewed": return "Under Review";
      case "shortlisted": return "Shortlisted";
      case "interview_scheduled": return "Interview Scheduled";
      case "rejected": return "Rejected";
      case "hired": return "Hired";
      default: return status;
    }
  };

  const formattedData = applicants.map((applicant) => {
    const isGuestOrApiSource = applicant.application_source === 'api' || !applicant.user_id;
    return {
      Name: isGuestOrApiSource ? (applicant.api_full_name || '') : (applicant.profile?.full_name || ''),
      Email: isGuestOrApiSource ? (applicant.api_email || '') : (applicant.profile?.email || ''),
      Phone: isGuestOrApiSource ? (applicant.api_phone || '') : (applicant.profile?.phone || ''),
      Position: isGuestOrApiSource ? (applicant.api_current_position || '') : (applicant.profile?.current_position || ''),
      Location: isGuestOrApiSource ? (applicant.api_location || '') : (applicant.profile?.location || ''),
      Status: getStatusDisplayName(applicant.status),
      'Applied Date': new Date(applicant.applied_at).toLocaleDateString('en-IN'),
    };
  });

  const downloadConfig: DownloadConfig = {
    title: `${jobTitle} - Applicants`,
    jobTitle,
    totalApplicants: applicants.length,
    columns: [
      { key: 'Name', header: 'Name', width: 80 },
      { key: 'Email', header: 'Email', width: 100 },
      { key: 'Phone', header: 'Phone', width: 70 },
      { key: 'Position', header: 'Position', width: 80 },
      { key: 'Location', header: 'Location', width: 60 },
      { key: 'Status', header: 'Status', width: 60 },
      { key: 'Applied Date', header: 'Applied', width: 55 },
    ],
  };

  return { data: formattedData, config: downloadConfig };
}

// ============ CERTIFICATE HELPERS ============

export interface CertificateData {
  certificate_number: string;
  skill_name: string;
  level: string;
  score: number;
  issued_at: string;
  expires_at?: string;
  verification_url: string;
}

export function formatCertificateForDownload(
  certificate: CertificateData,
  userName: string
): { data: Record<string, unknown>; config: DownloadConfig } {
  const verificationUrl = certificate.verification_url.startsWith('http') 
    ? certificate.verification_url 
    : `${SITE_CONFIG.PRODUCTION_DOMAIN}${certificate.verification_url}`;

  return {
    data: {
      certificateNumber: certificate.certificate_number,
      userName,
      skillName: certificate.skill_name,
      level: certificate.level,
      score: certificate.score,
      issuedAt: certificate.issued_at,
      expiresAt: certificate.expires_at,
    },
    config: {
      orientation: 'landscape',
      userName,
      certificateNumber: certificate.certificate_number,
      skillName: certificate.skill_name,
      level: certificate.level,
      score: certificate.score,
      issuedAt: certificate.issued_at,
      expiresAt: certificate.expires_at,
      verificationUrl,
    },
  };
}

// ============ RESUME HELPERS ============

export interface ResumeData {
  personalInfo: {
    fullName: string;
    email: string;
    phone: string;
    address: string;
    linkedin?: string;
    portfolio?: string;
    title?: string;
    website?: string;
  };
  summary: string;
  experience: Array<{
    id?: string;
    position: string;
    company: string;
    duration: string;
    description: string;
  }>;
  education: Array<{
    id?: string;
    degree: string;
    institution: string;
    year: string;
    grade?: string;
  }>;
  skills: string[];
  languages: string[];
  certifications: string[];
}

export async function downloadResumeViaEdge(
  resumeData: ResumeData,
  template: ResumeTemplate = 'professional',
  filename: string
): Promise<boolean> {
  return downloadViaEdgeFunction(
    'pdf',
    filename,
    {},
    'resume',
    {
      resumeTemplate: template,
      resumeData: resumeData,
    } as DownloadConfig & { resumeTemplate: ResumeTemplate; resumeData: ResumeData }
  );
}

// ============ COVER LETTER HELPERS ============

export interface CoverLetterDownloadData {
  content: string;
  applicantName: string;
  date?: string;
}

export async function downloadCoverLetterViaEdge(
  coverLetterData: CoverLetterDownloadData,
  filename: string,
  template: CoverLetterTemplate = 'Professional'
): Promise<boolean> {
  return downloadViaEdgeFunction(
    'pdf',
    filename,
    { content: coverLetterData.content },
    'cover-letter',
    {
      coverLetterContent: coverLetterData.content,
      coverLetterTemplate: template,
      applicantName: coverLetterData.applicantName,
      applicationDate: coverLetterData.date,
    }
  );
}
