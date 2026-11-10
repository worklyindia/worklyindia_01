import { CANONICAL_DOMAIN } from '@/config/domainConfig';
/**
 * Reactive Resume API Service
 * Connects to a self-hosted Reactive Resume instance
 */

export interface ReactiveResumeData {
  id?: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  website?: string;
  summary?: string;
  skills: string[];
  languages: string[];
  certifications: string[];
  experience: {
    position: string;
    company: string;
    duration: string;
    description: string;
  }[];
  education: {
    degree: string;
    institution: string;
    year: string;
    grade?: string;
  }[];
}

export interface ReactiveResumeResponse {
  id: string;
  createdAt: string;
  updatedAt: string;
  data: ReactiveResumeData;
}

// Pre-configured API URL
const DEFAULT_API_URL = `https://resume-api.${CANONICAL_DOMAIN}`;

class ReactiveResumeApiService {
  private apiUrl: string = DEFAULT_API_URL;

  setApiUrl(url: string) {
    // Remove trailing slash if present
    this.apiUrl = url.replace(/\/$/, '');
    localStorage.setItem('reactive_resume_api_url', this.apiUrl);
  }

  getApiUrl(): string {
    const stored = localStorage.getItem('reactive_resume_api_url');
    return stored || DEFAULT_API_URL;
  }

  isConfigured(): boolean {
    return true; // Always configured with default URL
  }

  private getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  /**
   * Create a new resume
   */
  async createResume(data: ReactiveResumeData): Promise<ReactiveResumeResponse> {
    const apiUrl = this.getApiUrl();
    if (!apiUrl) {
      throw new Error('Reactive Resume API URL not configured');
    }

    const response = await fetch(`${apiUrl}/resume`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create resume: ${error}`);
    }

    return response.json();
  }

  /**
   * Get a resume by ID
   */
  async getResume(id: string): Promise<ReactiveResumeResponse> {
    const apiUrl = this.getApiUrl();
    if (!apiUrl) {
      throw new Error('Reactive Resume API URL not configured');
    }

    const response = await fetch(`${apiUrl}/resume/${id}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch resume');
    }

    return response.json();
  }

  /**
   * Update an existing resume
   */
  async updateResume(id: string, data: Partial<ReactiveResumeData>): Promise<ReactiveResumeResponse> {
    const apiUrl = this.getApiUrl();
    if (!apiUrl) {
      throw new Error('Reactive Resume API URL not configured');
    }

    const response = await fetch(`${apiUrl}/resume/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Failed to update resume');
    }

    return response.json();
  }

  /**
   * Delete a resume
   */
  async deleteResume(id: string): Promise<void> {
    const apiUrl = this.getApiUrl();
    if (!apiUrl) {
      throw new Error('Reactive Resume API URL not configured');
    }

    const response = await fetch(`${apiUrl}/resume/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to delete resume');
    }
  }

  /**
   * Generate PDF for a resume
   */
  async generatePdf(id: string): Promise<Blob> {
    const apiUrl = this.getApiUrl();
    if (!apiUrl) {
      throw new Error('Reactive Resume API URL not configured');
    }

    const response = await fetch(`${apiUrl}/resume/${id}/pdf`, {
      method: 'GET',
      headers: {
        'Accept': 'application/pdf',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to generate PDF');
    }

    return response.blob();
  }

  /**
   * Download PDF for a resume
   */
  async downloadPdf(id: string, filename: string = 'resume.pdf'): Promise<void> {
    const blob = await this.generatePdf(id);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    const apiUrl = this.getApiUrl();
    if (!apiUrl) {
      return false;
    }

    try {
      const response = await fetch(`${apiUrl}/health`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      return response.ok;
    } catch {
      // Try base URL if health endpoint doesn't exist
      try {
        const response = await fetch(apiUrl, {
          method: 'GET',
        });
        return response.ok || response.status === 404; // 404 means server is running
      } catch {
        return false;
      }
    }
  }
}

export const reactiveResumeApi = new ReactiveResumeApiService();
