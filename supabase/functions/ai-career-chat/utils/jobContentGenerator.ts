// Job Content Generation Logic - Merged from ai-job-content-generator
import { askAiChain } from '../../_shared/aiChain.ts';

interface JobContext {
  title?: string;
  department?: string;
  category?: string;
  availableCategories?: string[];
  jobType?: string;
  experienceLevel?: string;
  location?: string;
  companyName?: string;
  industry?: string;
  companyId?: string;
  companyDescription?: string;
  companySize?: string;
}

interface SimilarJob {
  title: string;
  description: string | null;
  requirements: string | null;
  benefits: string | null;
  required_skills: string[] | null;
  salary_min: number | null;
  salary_max: number | null;
  applications_count: number | null;
}

type GatewayLike = {
  name: string;
  url: string;
  key: string;
  modelMap?: Record<string, string>;
  extraHeaders?: Record<string, string>;
  maxPayloadBytes?: number;
};

// Model configuration for different field types
const MODEL_CONFIG = {
  simple: 'google/gemini-2.5-flash-lite', // Skills, salary - fast & cheap
  complex: 'google/gemini-2.5-flash',      // Description, requirements, benefits
};

// Fallback chain — only models the Lovable AI Gateway serves with
// LOVABLE_API_KEY. openai/* models require a user-provided sk_ key on the
// gateway, which caused the "Invalid API key, must start with 'sk_' prefix"
// 401 errors seen in the Post-Job AI dialog.
const JOB_CONTENT_FALLBACK_CHAIN = [
  'google/gemini-2.5-flash',
  'google/gemini-2.5-flash-lite',
  'google/gemini-2.5-pro',
];

export const getModelForField = (fieldType: string): string => {
  switch (fieldType) {
    case 'category':
    case 'skills':
    case 'salary':
      return MODEL_CONFIG.simple;
    default:
      return MODEL_CONFIG.complex;
  }
};

export const buildJobContentPrompt = (
  fieldType: string, 
  context: JobContext, 
  similarJobs: SimilarJob[], 
  previousJobs: SimilarJob[]
): string => {
  // Build company context section
  const companyDetails = [];
  if (context.companyName) companyDetails.push(`Company Name: ${context.companyName}`);
  if (context.industry) companyDetails.push(`Industry: ${context.industry}`);
  if (context.companySize) companyDetails.push(`Company Size: ${context.companySize}`);
  if (context.companyDescription) {
    companyDetails.push(`About Company: ${context.companyDescription.substring(0, 500)}`);
  }

  const baseContext = `
📋 JOB DETAILS:
Job Title: ${context.title || 'Not specified'}
Department: ${context.department || 'Not specified'}
Category: ${context.category || 'Not specified'}
Job Type: ${context.jobType || 'Full Time'}
Experience Level: ${context.experienceLevel || 'Not specified'}
Location: ${context.location || 'Remote (Workly India)'}

🏢 COMPANY PROFILE:
${companyDetails.length > 0 ? companyDetails.join('\n') : 'Company details not provided'}
`;

  // Build examples from similar jobs
  let similarJobsContext = '';
  if (similarJobs.length > 0) {
    similarJobsContext = `\n\n📊 REFERENCE: Top ${similarJobs.length} similar successful job postings (sorted by applications received):
`;
    similarJobs.slice(0, 5).forEach((job, idx) => {
      similarJobsContext += `\n--- Example ${idx + 1}: ${job.title} (${job.applications_count || 0} applications) ---\n`;
      
      switch (fieldType) {
        case 'description':
          if (job.description) {
            similarJobsContext += `Description snippet: ${job.description.substring(0, 500)}...\n`;
          }
          break;
        case 'requirements':
          if (job.requirements) {
            similarJobsContext += `Requirements snippet: ${job.requirements.substring(0, 500)}...\n`;
          }
          break;
        case 'benefits':
          if (job.benefits) {
            similarJobsContext += `Benefits snippet: ${job.benefits.substring(0, 500)}...\n`;
          }
          break;
        case 'skills':
          if (job.required_skills && job.required_skills.length > 0) {
            similarJobsContext += `Skills: ${job.required_skills.join(', ')}\n`;
          }
          break;
        case 'salary':
          if (job.salary_min && job.salary_max) {
            similarJobsContext += `Salary Range: ₹${job.salary_min.toLocaleString()} - ₹${job.salary_max.toLocaleString()}/month\n`;
          }
          break;
      }
    });
  }

  // Build examples from employer's previous jobs
  let previousJobsContext = '';
  if (previousJobs.length > 0) {
    previousJobsContext = `\n\n🏢 EMPLOYER'S STYLE: Previous job postings by this company:
`;
    previousJobs.slice(0, 3).forEach((job, idx) => {
      previousJobsContext += `\n--- Previous Job ${idx + 1}: ${job.title} ---\n`;
      
      switch (fieldType) {
        case 'description':
          if (job.description) {
            previousJobsContext += `Their style: ${job.description.substring(0, 400)}...\n`;
          }
          break;
        case 'requirements':
          if (job.requirements) {
            previousJobsContext += `Their requirements style: ${job.requirements.substring(0, 400)}...\n`;
          }
          break;
        case 'benefits':
          if (job.benefits) {
            previousJobsContext += `Their benefits style: ${job.benefits.substring(0, 400)}...\n`;
          }
          break;
        case 'skills':
          if (job.required_skills && job.required_skills.length > 0) {
            previousJobsContext += `Their common skills: ${job.required_skills.join(', ')}\n`;
          }
          break;
        case 'salary':
          if (job.salary_min && job.salary_max) {
            previousJobsContext += `Their salary range: ₹${job.salary_min.toLocaleString()} - ₹${job.salary_max.toLocaleString()}/month\n`;
          }
          break;
      }
    });
    previousJobsContext += `\n⚠️ Important: Match the employer's tone and style from their previous postings.\n`;
  }

  switch (fieldType) {
    case 'description':
      return `You are an expert HR content writer specializing in remote/work-from-home job postings for the Indian market.

Based on the following job details, write a compelling and professional job description in HTML format:
${baseContext}
${similarJobsContext}
${previousJobsContext}

Requirements:
1. Write in professional English suitable for Indian job seekers
2. Use proper HTML formatting with <h3>, <p>, <ul>, <li> tags
3. Include sections: Role Overview, Key Responsibilities (5-7 points), What You'll Do
4. Highlight Workly India benefits and flexibility
5. Keep it engaging and informative (200-300 words)
6. Use Indian English spellings where applicable
7. Make it SEO-friendly with relevant keywords
8. ${similarJobs.length > 0 ? 'Learn from the successful job postings provided above' : ''}
9. ${previousJobs.length > 0 ? 'Match the employer\'s writing style from their previous posts' : ''}

Return ONLY the HTML content, no markdown.`;

    case 'requirements':
      return `You are an expert HR content writer specializing in job requirements for the Indian market.

Based on the following job details, write detailed job requirements in HTML format:
${baseContext}
${similarJobsContext}
${previousJobsContext}

Requirements:
1. Use proper HTML formatting with <h3>, <ul>, <li> tags
2. Include sections: Educational Qualifications, Technical Skills, Experience Required, Soft Skills
3. Be specific to the role and experience level
4. Add relevant certifications if applicable
5. Keep requirements realistic for the Indian job market
6. Use bullet points for easy reading
7. ${similarJobs.length > 0 ? 'Reference the requirements from successful similar jobs' : ''}
8. ${previousJobs.length > 0 ? 'Match the employer\'s style from their previous posts' : ''}

Return ONLY the HTML content, no markdown.`;

    case 'benefits':
      return `You are an expert HR content writer specializing in employee benefits for remote jobs in India.

Based on the following job details, write attractive benefits and perks in HTML format:
${baseContext}
${similarJobsContext}
${previousJobsContext}

Requirements:
1. Use proper HTML formatting with <h3>, <ul>, <li> tags
2. Include sections: Compensation Benefits, Work-Life Balance, Growth & Learning, Perks
3. Focus on Workly India advantages (flexible hours, no commute, etc.)
4. Include typical Indian benefits (PF, health insurance, leaves)
5. Add unique perks that appeal to remote professionals
6. Make it attractive but realistic
7. Use emojis sparingly for visual appeal
8. ${similarJobs.length > 0 ? 'Include popular benefits from successful job postings' : ''}
9. ${previousJobs.length > 0 ? 'Match the employer\'s benefits style from their previous posts' : ''}

Return ONLY the HTML content, no markdown.`;

    case 'skills':
      return `You are an expert HR recruiter for tech and remote jobs in India.

Based on the following job details, suggest the most relevant skills:
${baseContext}
${similarJobsContext}
${previousJobsContext}

Requirements:
1. Return a JSON array of skill strings
2. Include 8-12 relevant skills
3. Mix technical skills (60%) and soft skills (40%)
4. Skills should match the job title, department, and experience level
5. Include both common and specialized skills
6. Skills should be relevant to Indian job market
7. Include tools and technologies commonly used in this role
8. ${similarJobs.length > 0 ? 'Prioritize skills from successful job postings' : ''}
9. ${previousJobs.length > 0 ? 'Include skills the employer commonly uses' : ''}

Return ONLY a valid JSON array like: ["Skill 1", "Skill 2", "Skill 3"]`;

    case 'salary':
      return `You are a salary research expert for the Indian remote job market.

Based on the following job details, suggest an appropriate salary range:
${baseContext}
${similarJobsContext}
${previousJobsContext}

Requirements:
1. Return a JSON object with min and max monthly salary in INR
2. Base the salary on current Indian market rates (2024-2025)
3. Consider:
   - Experience level
   - Job type (full-time pays more than part-time)
   - Industry standards
   - Workly India premium
   - Location (adjust for tier-1 vs tier-2 cities)
4. Be realistic for the Indian market
5. Include period (monthly)
6. ${similarJobs.length > 0 ? 'Reference salary ranges from successful similar jobs' : ''}
7. ${previousJobs.length > 0 ? 'Consider employer\'s typical salary range from previous posts' : ''}

Return ONLY a valid JSON object like: {"min": 50000, "max": 80000, "period": "monthly"}`;

    case 'category': {
      const categories = Array.isArray(context.availableCategories) && context.availableCategories.length > 0
        ? context.availableCategories
        : [
          'Accounting & Finance', 'Administrative & Clerical', 'Agriculture & Farming',
          'Architecture & Construction', 'Arts & Entertainment', 'Automotive', 'Banking & Insurance',
          'Beauty & Wellness', 'Business Development', 'Call Center & BPO', 'Consulting & Strategy',
          'Construction & Real Estate', 'Content Writing & Creation', 'Customer Service',
          'Data Entry & Processing', 'Data Science & Analytics', 'Design & Creative',
          'Digital Marketing', 'E-commerce & Retail', 'Education & Training', 'Engineering',
          'Environmental Services', 'Event Management', 'Fashion & Textiles', 'Finance & Investment',
          'Food & Beverage', 'Government & Public Service', 'Graphic Design', 'Healthcare & Medical',
          'Hospitality & Tourism', 'Human Resources', 'Information Technology', 'Insurance',
          'Journalism & Media', 'Legal Services', 'Logistics & Supply Chain', 'Manufacturing',
          'Marketing & Advertising', 'Non-Profit & NGO', 'Oil & Gas', 'Operations & Management',
          'Pharmaceutical', 'Photography & Videography', 'Project Management', 'Quality Assurance',
          'Research & Development', 'Sales & Business Development', 'Security Services',
          'Social Media Management', 'Software Development', 'Sports & Fitness', 'Teaching & Tutoring',
          'Telecommunications', 'Transportation & Delivery', 'Travel & Tourism', 'Utilities',
          'Virtual Assistant', 'Web Development', 'Other'
        ];

      return `You are an expert HR recruiter for the Indian job market.

Pick the single best job category for this posting from the allowed A-Z category list.
${baseContext}

Allowed categories:
${categories.map((category) => `- ${category}`).join('\n')}

Rules:
1. Return EXACTLY one category from the allowed list.
2. Do not invent a new category.
3. Use the job title, department, company industry, and role context.
4. If uncertain, return "Other".

Return ONLY the category text, no markdown, no explanation.`;
    }

    default:
      return '';
  }
};

const getGatewayHeaders = (gateway: GatewayLike) => {
  if (gateway.name === 'Lovable AI Gateway') {
    return {
      'Lovable-API-Key': gateway.key,
      'X-Lovable-AIG-SDK': 'job-content-generator',
      'Content-Type': 'application/json',
      ...(gateway.extraHeaders || {}),
    };
  }

  return {
    'Authorization': `Bearer ${gateway.key}`,
    'Content-Type': 'application/json',
    ...(gateway.extraHeaders || {}),
  };
};

const getJsonPayloadBytes = (payload: unknown): number =>
  new TextEncoder().encode(JSON.stringify(payload)).length;

export async function handleJobContentGeneration(
  fieldType: string,
  context: JobContext,
  supabase: any,
  userId: string,
  gateways: GatewayLike[],
  resolveModelForGateway?: (gateway: GatewayLike, internalModel: string) => string | null
): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  try {
    if (!fieldType) {
      return new Response(
        JSON.stringify({ error: 'Field type is required', errorType: 'unknown' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🤖 Generating ${fieldType} content for:`, context?.title || 'Unknown job');
    console.log(`🏢 Company ID:`, context?.companyId || 'Not provided');

    // Fetch similar successful jobs
    let similarJobs: SimilarJob[] = [];
    try {
      let query = supabase
        .from('jobs')
        .select('title, description, requirements, benefits, required_skills, salary_min, salary_max, applications_count')
        .eq('status', 'active')
        .order('applications_count', { ascending: false })
        .limit(10);

      if (context?.category) {
        query = query.eq('category', context.category);
      } else if (context?.department) {
        query = query.eq('department', context.department);
      }

      if (context?.experienceLevel) {
        query = query.eq('experience_level', context.experienceLevel);
      }

      const { data: jobs, error } = await query;
      
      if (!error && jobs) {
        similarJobs = jobs;
        console.log(`📊 Found ${similarJobs.length} similar jobs for reference`);
      }
    } catch (err) {
      console.warn('Could not fetch similar jobs:', err);
    }

    // Fetch employer's previous jobs
    let previousJobs: SimilarJob[] = [];
    if (context?.companyId) {
      try {
        const { data: prevJobs, error } = await supabase
          .from('jobs')
          .select('title, description, requirements, benefits, required_skills, salary_min, salary_max, applications_count')
          .eq('employer_id', context.companyId)
          .order('created_at', { ascending: false })
          .limit(5);

        if (!error && prevJobs) {
          previousJobs = prevJobs;
          console.log(`🏢 Found ${previousJobs.length} previous jobs from this employer`);
        }
      } catch (err) {
        console.warn('Could not fetch employer previous jobs:', err);
      }
    }

    // Build smart prompt with examples
    const prompt = buildJobContentPrompt(fieldType, context || {}, similarJobs, previousJobs);
    
    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Invalid field type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!gateways || gateways.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'AI service not configured',
          errorType: 'api_error',
          details: 'No AI gateway is available for job content generation.'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Select model based on field type
    const selectedModel = getModelForField(fieldType);
    console.log(`🤖 Using model: ${selectedModel} for ${fieldType}`);

    // Call the same configured gateway chain used by AI Career Chat.
    let response: Response | null = null;
    const modelsToTry = [selectedModel, ...JOB_CONTENT_FALLBACK_CHAIN.filter(m => m !== selectedModel)];
    let lastModelTried: string | null = null;
    let lastGatewayTried: string | null = null;
    let lastErrorSnippet: string | null = null;

    for (const model of modelsToTry) {
      lastModelTried = model;
      for (const gateway of gateways) {
        const providerModel = resolveModelForGateway
          ? resolveModelForGateway(gateway, model)
          : (gateway.modelMap ? gateway.modelMap[model] : model);

        if (!providerModel) {
          console.log(`⏭️ ${gateway.name}: no mapping for ${model}, skipping`);
          continue;
        }

        lastGatewayTried = gateway.name;
        const body = {
          model: providerModel,
          messages: [
            {
              role: 'system',
              content: 'You are an expert HR content writer for the Indian job market, specializing in remote and work-from-home positions. Always respond in the exact format requested. Learn from the examples provided to create better content.'
            },
            { role: 'user', content: prompt }
          ],
          max_tokens: 1500,
          temperature: 0.7,
          stream: false,
        };

        if (gateway.maxPayloadBytes && getJsonPayloadBytes(body) > gateway.maxPayloadBytes) {
          console.log(`⏭️ ${gateway.name}: payload too large, skipping`);
          continue;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 18000);

        try {
          console.log(`🔄 Trying ${gateway.name}: ${model} → ${providerModel}`);

          response = await fetch(gateway.url, {
            method: 'POST',
            headers: getGatewayHeaders(gateway),
            body: JSON.stringify(body),
            signal: controller.signal,
          });
          clearTimeout(timeout);

          if (response.ok) {
            console.log(`✅ Success with ${gateway.name}: ${providerModel}`);
            break;
          }

          const errorText = await response.text();
          lastErrorSnippet = errorText?.substring(0, 500) || null;
          console.error(`❌ ${gateway.name} ${providerModel} failed:`, errorText.substring(0, 200));
          response = null;
        } catch (err) {
          clearTimeout(timeout);
          lastErrorSnippet = err instanceof Error ? err.message : String(err);
          console.error(`❌ ${gateway.name} ${providerModel} error:`, err);
          response = null;
        }
      }

      if (response?.ok) break;
    }

    let content = '';
    let usedModel = String(selectedModel || 'unknown');

    if (response?.ok) {
      const data = await response.json();
      content = data.choices?.[0]?.message?.content || '';
      usedModel = String(data?.model || usedModel);
    }


    if (!content) {
      // Last-resort: the shared multi-provider / multi-model chain (same routing
      // the AI chat page uses), so job content keeps working when the primary
      // gateway list is exhausted.
      console.log('🔁 Falling back to the shared AI provider chain');
      content = (await askAiChain(
        'You are an expert HR content writer for the Indian job market, specializing in remote and work-from-home positions. Always respond in the exact format requested.',
        prompt,
        { label: 'job-content', maxTokens: 1500, temperature: 0.7, model: selectedModel },
      )) || '';
    }

    if (!content) {
      console.error('All models failed');
      return new Response(
        JSON.stringify({
          error: 'AI service temporarily unavailable',
          errorType: 'api_error',
          details: `All AI models failed. Last gateway: ${lastGatewayTried || 'unknown'}. Last model: ${lastModelTried || 'unknown'}. ${lastErrorSnippet ? `Last error: ${lastErrorSnippet}` : ''}`.trim(),
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Generated ${fieldType} content successfully`);
    console.log(`📊 Based on ${similarJobs.length} similar jobs and ${previousJobs.length} employer previous jobs`);

    // Validate + parse response per field type
    let parsedContent: any = content;

    if (fieldType === 'skills') {
      try {
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        parsedContent = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      } catch (e) {
        console.error('Failed to parse skills JSON:', e);
        parsedContent = [];
      }

      if (!Array.isArray(parsedContent) || parsedContent.length === 0) {
        return new Response(
          JSON.stringify({
            error: 'AI returned invalid skills. Please try again.',
            errorType: 'api_error',
            details: 'The AI response could not be parsed into a non-empty JSON array of skills.'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (fieldType === 'salary') {
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        parsedContent = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      } catch (e) {
        console.error('Failed to parse salary JSON:', e);
        parsedContent = null;
      }

      const min = parsedContent?.min;
      const max = parsedContent?.max;
      if (typeof min !== 'number' || typeof max !== 'number' || min <= 0 || max <= 0 || max < min) {
        return new Response(
          JSON.stringify({
            error: 'AI returned invalid salary range. Please try again.',
            errorType: 'api_error',
            details: 'The AI response could not be parsed into a valid {min,max} object.'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!parsedContent.period) parsedContent.period = 'monthly';
    } else if (fieldType === 'category') {
      const categories = Array.isArray(context?.availableCategories) ? context.availableCategories : [];
      const normalizedContent = String(content || '')
        .replace(/^```[a-z]*|```$/gi, '')
        .replace(/^[-*\s"']+|[-*\s"'.]+$/g, '')
        .trim();

      const exact = categories.find((category) => category.toLowerCase() === normalizedContent.toLowerCase());
      const contained = categories.find((category) =>
        normalizedContent.toLowerCase().includes(category.toLowerCase()) ||
        category.toLowerCase().includes(normalizedContent.toLowerCase())
      );
      parsedContent = exact || contained || (normalizedContent === 'Other' ? 'Other' : '');

      if (!parsedContent) {
        return new Response(
          JSON.stringify({
            error: 'AI returned invalid category. Please try again.',
            errorType: 'api_error',
            details: 'The AI response did not match the allowed job category list.'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // HTML fields must be non-empty strings
      if (typeof parsedContent !== 'string' || parsedContent.trim().length === 0) {
        return new Response(
          JSON.stringify({
            error: 'AI returned empty content. Please try again.',
            errorType: 'api_error',
            details: `Empty response for fieldType: ${fieldType}`
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Increment AI usage after successful generation
    try {
      await supabase.rpc('increment_ai_chat_usage', {
        p_user_id: userId,
        p_usage_type: 'message',
        p_tokens: 0
      });
      console.log(`✅ AI usage incremented for user ${userId}`);
    } catch (usageErr) {
      console.error('Failed to increment usage:', usageErr);
    }

    return new Response(
      JSON.stringify({
        content: parsedContent,
        fieldType,
        meta: {
          similarJobsAnalyzed: similarJobs.length,
          employerPreviousJobs: previousJobs.length,
          model: usedModel
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in job content generation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage, 
        errorType: 'api_error',
        details: 'Please try again later'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// Check AI usage limits (without incrementing)
export async function checkJobContentUsageLimits(supabase: any, userId: string): Promise<{ allowed: boolean; remaining: number; limit: number; messagesUsed: number; error?: string }> {
  try {
    const { data: status, error: statusError } = await supabase.rpc('get_user_ai_chat_status', {
      p_user_id: userId
    });

    if (statusError) {
      console.error('Error fetching AI status:', statusError);
      return { allowed: false, remaining: 0, limit: 0, messagesUsed: 0, error: 'Failed to check subscription status' };
    }

    const plan = status?.plan;
    const usage = status?.usage;

    if (!plan) {
      return { allowed: false, remaining: 0, limit: 0, messagesUsed: 0, error: 'No active AI subscription found' };
    }

    const messagesLimit = plan.messages_per_month || 0;
    const messagesUsed = usage?.messages_count || 0;
    const remaining = Math.max(0, messagesLimit - messagesUsed);

    // Check if limit exceeded (unless unlimited - 999999)
    if (messagesLimit < 999999 && messagesUsed >= messagesLimit) {
      return { 
        allowed: false, 
        remaining: 0, 
        limit: messagesLimit,
        messagesUsed,
        error: 'Monthly AI usage limit exceeded' 
      };
    }

    return { allowed: true, remaining, limit: messagesLimit, messagesUsed };
  } catch (err) {
    console.error('Error in checkJobContentUsageLimits:', err);
    return { allowed: false, remaining: 0, limit: 0, messagesUsed: 0, error: 'Usage check failed' };
  }
}
