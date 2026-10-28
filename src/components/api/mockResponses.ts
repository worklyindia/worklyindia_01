// Mock response generator for API Playground Demo Mode
export const generateMockResponse = (endpoint: string, method: string, params: Record<string, string>) => {
  const responses: Record<string, any> = {
    '/api/jobs/search': {
      success: true,
      data: {
        jobs: [
          {
            id: 'job_1',
            title: 'Senior React Developer',
            company: 'Tech Innovators Pvt Ltd',
            location: params.location || 'Mumbai',
            job_type: params.job_type || 'full-time',
            salary_range: '₹10-15 LPA',
            skills: ['React', 'TypeScript', 'Node.js'],
            posted_at: '2025-01-01T10:00:00Z',
            applications_count: 24
          },
          {
            id: 'job_2',
            title: 'Full Stack Developer',
            company: 'Digital Solutions Inc',
            location: params.location || 'Bangalore',
            job_type: params.job_type || 'full-time',
            salary_range: '₹12-18 LPA',
            skills: ['React', 'Python', 'PostgreSQL'],
            posted_at: '2025-01-02T14:30:00Z',
            applications_count: 15
          },
          {
            id: 'job_3',
            title: 'Frontend Engineer',
            company: 'StartupHub Technologies',
            location: params.location || 'Remote',
            job_type: params.job_type || 'contract',
            salary_range: '₹8-12 LPA',
            skills: ['React', 'CSS', 'JavaScript'],
            posted_at: '2025-01-03T09:15:00Z',
            applications_count: 31
          }
        ],
        pagination: {
          page: parseInt(params.page) || 1,
          limit: parseInt(params.limit) || 20,
          total: 127,
          total_pages: 7
        }
      },
      message: 'Jobs fetched successfully'
    },
    
    '/api/jobs': {
      success: true,
      data: {
        job_id: 'job_new_123',
        title: 'Senior Developer',
        status: 'active',
        created_at: new Date().toISOString(),
        views: 0,
        applications: 0,
        job_videos: [
          {
            title: "Company Culture & Work Environment",
            url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
          },
          {
            title: "Day in the Life of a Developer",
            url: "https://www.youtube.com/watch?v=9bZkp7q19f0"
          }
        ]
      },
      message: 'Job posted successfully'
    },
    
    '/api/companies': {
      success: true,
      data: {
        companies: [
          {
            id: 'comp_1',
            name: 'Tech Innovators Pvt Ltd',
            industry: params.industry || 'technology',
            size: params.size || '100-500',
            verified: true,
            logo_url: 'https://via.placeholder.com/100',
            active_jobs: 12,
            location: 'Mumbai, Maharashtra'
          },
          {
            id: 'comp_2',
            name: 'Digital Solutions Inc',
            industry: params.industry || 'software',
            size: params.size || '50-100',
            verified: true,
            logo_url: 'https://via.placeholder.com/100',
            active_jobs: 8,
            location: 'Bangalore, Karnataka'
          },
          {
            id: 'comp_3',
            name: 'StartupHub Technologies',
            industry: params.industry || 'technology',
            size: params.size || '10-50',
            verified: true,
            logo_url: 'https://via.placeholder.com/100',
            active_jobs: 5,
            location: 'Remote'
          }
        ],
        total: 45,
        verified_count: 38
      },
      message: 'Companies fetched successfully'
    },
    
    '/api/applications': {
      success: true,
      data: {
        application_id: 'app_new_456',
        job_id: 'job_123',
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        estimated_review_time: '2-3 business days'
      },
      message: 'Application submitted successfully'
    }
  };

  return responses[endpoint] || {
    success: false,
    error: 'Endpoint not found',
    message: 'This endpoint is not implemented yet'
  };
};

export const getMockErrorResponse = (statusCode: number) => {
  const errors: Record<number, any> = {
    400: {
      success: false,
      error: 'Bad Request',
      message: 'Invalid parameters provided. Please check your request.',
      details: {
        field: 'search_query',
        issue: 'Must be at least 3 characters long'
      }
    },
    401: {
      success: false,
      error: 'Unauthorized',
      message: 'Invalid or missing API key. Please provide a valid API key in the Authorization header.',
      code: 'AUTH_INVALID_KEY'
    },
    403: {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to access this resource.',
      code: 'AUTH_INSUFFICIENT_PERMISSIONS'
    },
    404: {
      success: false,
      error: 'Not Found',
      message: 'The requested resource was not found.',
      code: 'RESOURCE_NOT_FOUND'
    },
    429: {
      success: false,
      error: 'Rate Limit Exceeded',
      message: 'You have exceeded your rate limit. Please try again later.',
      retry_after: 3600,
      limit: 1000,
      remaining: 0,
      reset_at: new Date(Date.now() + 3600000).toISOString()
    },
    500: {
      success: false,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred. Please try again later.',
      code: 'INTERNAL_ERROR',
      request_id: 'req_' + Math.random().toString(36).substring(7)
    }
  };

  return errors[statusCode] || errors[500];
};
