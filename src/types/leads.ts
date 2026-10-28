export interface Lead {
  id: number;
  name: string;
  email: string;
  phone: string;
  position: string;
  experience: string;
  location: string;
  appliedDate: string;
  status: 'Hot' | 'Warm' | 'Fresh';
  skills: string[];
  expectedSalary: string;
  currentCompany: string;
  education: string;
  price: number;
  rating: number;
  verified: boolean;
  purchased: boolean;
  jobId?: string;
  resumeUrl?: string;
  coverLetter?: string;
  fullData: {
    email: string;
    phone: string;
  };
}

export interface JobApplication {
  id: string;
  jobId: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  resumeUrl: string;
  coverLetter?: string;
  appliedAt: string;
  status: 'New' | 'Reviewed' | 'Shortlisted' | 'Rejected';
  experience: string;
  expectedSalary: string;
  currentLocation: string;
  skills: string[];
  education: string;
  currentCompany?: string;
}

export interface LeadFilters {
  status: string;
  experience: string;
  location: string;
  salaryRange: string;
}

export interface WalletTransaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  date: string;
  leadId?: string;
}