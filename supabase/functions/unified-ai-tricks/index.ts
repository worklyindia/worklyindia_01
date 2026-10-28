import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { BRAND_CONFIG } from '../_shared/brandConfig.ts';
import { CANONICAL_DOMAIN, WEBSITE_DOMAIN } from '../_shared/domain.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Trick content templates by category and language
const trickTemplates: Record<string, Record<'hi' | 'en', { title: string; content: string }>> = {
  'resume_building': {
    en: {
      title: '5 Essential Resume Tips for Remote Jobs',
      content: `**Build a Winning Resume for Work-From-Home Positions**

1. **Highlight Workly India Skills**: Emphasize self-motivation, time management, and digital communication abilities.

2. **Use Action Verbs**: Start bullet points with strong verbs like "managed," "coordinated," "implemented."

3. **Quantify Achievements**: Include numbers and metrics (e.g., "Increased productivity by 30%").

4. **Customize for Each Job**: Tailor your resume to match the job description keywords.

5. **Keep it Concise**: Limit to 1-2 pages, focus on relevant experience from the last 5-10 years.

**Pro Tip**: Include your home office setup and Workly India experience prominently!`
    },
    hi: {
      title: 'रिमोट जॉब्स के लिए 5 आवश्यक रेज़्यूमे टिप्स',
      content: `**वर्क-फ्रॉम-होम पदों के लिए बेहतरीन रेज़्यूमे बनाएं**

1. **रिमोट वर्क स्किल्स हाइलाइट करें**: स्व-प्रेरणा, समय प्रबंधन और डिजिटल संचार क्षमताओं पर जोर दें।

2. **एक्शन वर्ब्स का उपयोग करें**: बुलेट पॉइंट्स को मजबूत क्रियाओं से शुरू करें।

3. **उपलब्धियों को संख्या में बताएं**: नंबर और मेट्रिक्स शामिल करें।

4. **हर जॉब के लिए कस्टमाइज़ करें**: अपने रेज़्यूमे को जॉब विवरण के कीवर्ड से मिलाएं।

5. **संक्षिप्त रखें**: 1-2 पेज तक सीमित रखें।

**प्रो टिप**: अपने होम ऑफिस सेटअप और रिमोट वर्क अनुभव को प्रमुखता से शामिल करें!`
    }
  },
  'interview_preparation': {
    en: {
      title: 'Ace Your Virtual Interview: Top 7 Strategies',
      content: `**Master Remote Job Interviews**

1. **Test Your Tech**: Check internet, camera, microphone 30 minutes before.
2. **Professional Background**: Use a clean, well-lit space or virtual background.
3. **Dress Professionally**: Dress as you would for in-person interviews.
4. **Prepare Examples**: Have 3-5 STAR method stories ready.
5. **Ask Smart Questions**: Prepare 2-3 questions about Workly India culture.
6. **Show Enthusiasm**: Make eye contact with camera, not screen.
7. **Follow Up**: Send thank-you email within 24 hours.`
    },
    hi: {
      title: 'वर्चुअल इंटरव्यू में सफल होने की 7 रणनीतियां',
      content: `**रिमोट जॉब इंटरव्यू में महारत हासिल करें**

1. **अपनी टेक्नोलॉजी टेस्ट करें**: इंटरव्यू से 30 मिनट पहले चेक करें।
2. **प्रोफेशनल बैकग्राउंड**: साफ, अच्छी रोशनी वाली जगह का उपयोग करें।
3. **प्रोफेशनली कपड़े पहनें**: वैसे ही तैयार हों जैसे व्यक्तिगत इंटरव्यू के लिए होते।
4. **उदाहरण तैयार करें**: 3-5 STAR मेथड स्टोरीज तैयार रखें।
5. **स्मार्ट सवाल पूछें**: रिमोट वर्क कल्चर के बारे में 2-3 प्रश्न तैयार करें।
6. **उत्साह दिखाएं**: स्क्रीन नहीं, कैमरे से आई कॉन्टैक्ट बनाएं।
7. **फॉलो अप करें**: 24 घंटे के भीतर धन्यवाद ईमेल भेजें।`
    }
  },
  'remote_work_best_practices': {
    en: {
      title: 'Workly India Success: 8 Daily Habits',
      content: `**Thrive in Your Work-From-Home Career**

1. **Set a Schedule**: Start and end work at consistent times daily.
2. **Create a Dedicated Workspace**: Separate work area from living space.
3. **Take Regular Breaks**: Follow the 50-10 rule (50 min work, 10 min break).
4. **Stay Connected**: Schedule virtual coffee chats with colleagues.
5. **Over-Communicate**: Share updates proactively via Slack/email.
6. **Maintain Boundaries**: Don't check work emails after hours.
7. **Exercise Daily**: 30 minutes of physical activity boosts productivity.
8. **End-of-Day Ritual**: Review tomorrow's tasks and "close" your workspace.`
    },
    hi: {
      title: 'रिमोट वर्क सफलता: 8 दैनिक आदतें',
      content: `**अपने वर्क-फ्रॉम-होम करियर में सफल हों**

1. **एक शेड्यूल सेट करें**: रोज एक निश्चित समय पर काम शुरू और खत्म करें।
2. **समर्पित कार्यस्थल बनाएं**: कार्य क्षेत्र को रहने की जगह से अलग रखें।
3. **नियमित ब्रेक लें**: 50-10 नियम फॉलो करें।
4. **जुड़े रहें**: सहकर्मियों के साथ वर्चुअल कॉफी चैट शेड्यूल करें।
5. **ज्यादा संवाद करें**: Slack/ईमेल के माध्यम से अपडेट शेयर करें।
6. **सीमाएं बनाए रखें**: काम के घंटों के बाद वर्क ईमेल न चेक करें।
7. **रोज व्यायाम करें**: 30 मिनट की शारीरिक गतिविधि उत्पादकता बढ़ाती है।
8. **दिन समाप्ति अनुष्ठान**: कल के कार्यों की समीक्षा करें।`
    }
  },
  'job_search_strategies': {
    en: {
      title: 'Land Your Dream Remote Job: 6 Proven Strategies',
      content: `**Effective Job Search for Remote Positions**

1. **Use Specialized Platforms**: Focus on Workly India-specific job sites.
2. **Network Strategically**: Join LinkedIn groups for remote professionals.
3. **Optimize Your Profile**: Add "Open to Remote" on LinkedIn.
4. **Set Job Alerts**: Create alerts for keywords: "remote," "Workly India."
5. **Apply Early**: Be among first 10-20 applicants for better visibility.
6. **Follow Up**: Send polite follow-up email after 1 week if no response.`
    },
    hi: {
      title: 'अपनी ड्रीम रिमोट जॉब पाएं: 6 सिद्ध रणनीतियां',
      content: `**रिमोट पदों के लिए प्रभावी जॉब सर्च**

1. **विशेषीकृत प्लेटफॉर्म का उपयोग करें**: Workly India जैसी साइटों पर फोकस करें।
2. **रणनीतिक नेटवर्किंग**: रिमोट वर्कर्स के लिए LinkedIn ग्रुप्स में शामिल हों।
3. **अपनी प्रोफाइल ऑप्टिमाइज़ करें**: LinkedIn पर "रिमोट वर्क के लिए खुला" जोड़ें।
4. **जॉब अलर्ट सेट करें**: कीवर्ड के लिए अलर्ट बनाएं।
5. **जल्दी आवेदन करें**: पहले 10-20 आवेदकों में शामिल हों।
6. **फॉलो अप करें**: 1 सप्ताह बाद फॉलो-अप ईमेल भेजें।`
    }
  },
  'skill_development': {
    en: {
      title: 'Top 5 In-Demand Skills for Workly India in 2024',
      content: `**Boost Your Remote Career with These Skills**

**Technical Skills**:
1. **Digital Communication**: Master Slack, Zoom, Microsoft Teams
2. **Project Management**: Learn Asana, Trello, or Monday.com
3. **Cloud Collaboration**: Google Workspace, Microsoft 365, Notion

**Soft Skills**:
4. **Self-Management**: Time blocking, priority setting
5. **Written Communication**: Clear emails, documentation`
    },
    hi: {
      title: '2024 में रिमोट वर्क के लिए शीर्ष 5 मांग वाले स्किल्स',
      content: `**इन स्किल्स से अपने रिमोट करियर को बढ़ावा दें**

**तकनीकी स्किल्स**:
1. **डिजिटल कम्युनिकेशन**: Slack, Zoom, Microsoft Teams में महारत हासिल करें
2. **प्रोजेक्ट मैनेजमेंट**: Asana, Trello, या Monday.com सीखें
3. **क्लाउड कोलैबोरेशन**: Google Workspace, Microsoft 365, Notion

**सॉफ्ट स्किल्स**:
4. **स्व-प्रबंधन**: टाइम ब्लॉकिंग, प्राथमिकता निर्धारण
5. **लिखित संचार**: स्पष्ट ईमेल, दस्तावेज़ीकरण`
    }
  }
};

// Action: Generate a new trick
async function generateTrick(params: any, supabaseClient: any) {
  const { category, language = 'en', tone = 'professional', trigger_type = 'manual' } = params;

  console.log(`🤖 Generating AI trick - Category: ${category}, Language: ${language}`);

  // Get or create AI system user
  const aiSystemEmail = `ai-system@${BRAND_CONFIG.domain}`;
  let { data: aiSystemUser } = await supabaseClient
    .from('ai_system_users')
    .select('*')
    .eq('email', aiSystemEmail)
    .single();

  if (!aiSystemUser) {
    const { data: newUser, error } = await supabaseClient
      .from('ai_system_users')
      .insert({
        name: `${BRAND_CONFIG.name} AI Assistant`,
        email: aiSystemEmail,
        capabilities: { generate_tricks: true, manage_content: true },
        status: 'active',
        metadata: { model: 'claude-3.5-sonnet', version: '1.0' }
      })
      .select()
      .single();

    if (error) throw error;
    aiSystemUser = newUser;
  }

  // Get trick content from templates
  const template = trickTemplates[category]?.[language as 'hi' | 'en'];
  if (!template) {
    throw new Error(`Invalid category or language: ${category}/${language}`);
  }

  // Insert the generated trick
  const { data: trick, error: insertError } = await supabaseClient
    .from('ai_generated_tricks')
    .insert({
      title: template.title,
      content: template.content,
      category,
      language,
      status: trigger_type === 'manual' ? 'published' : 'draft',
      ai_model: 'claude-3.5-sonnet',
      generated_by: aiSystemUser.id,
      metadata: {
        tone,
        trigger_type,
        generation_date: new Date().toISOString(),
        word_count: template.content.split(' ').length
      }
    })
    .select()
    .single();

  if (insertError) throw insertError;

  return {
    success: true,
    trick,
    message: `AI trick generated successfully in ${language === 'hi' ? 'Hindi' : 'English'}`
  };
}

// Action: List tricks with filters
async function listTricks(params: any, supabaseClient: any) {
  const { status, category, language, page = 1, limit = 20 } = params;
  const offset = (page - 1) * limit;

  let query = supabaseClient
    .from('ai_generated_tricks')
    .select(`*, ai_system_users!ai_generated_tricks_generated_by_fkey(name, email)`, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('status', status);
  if (category) query = query.eq('category', category);
  if (language) query = query.eq('language', language);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    success: true,
    tricks: data || [],
    total: count || 0,
    page,
    limit
  };
}

// Action: Get single trick
async function getTrick(params: any, supabaseClient: any) {
  const { trick_id } = params;

  const { data, error } = await supabaseClient
    .from('ai_generated_tricks')
    .select(`*, ai_system_users!ai_generated_tricks_generated_by_fkey(name, email)`)
    .eq('id', trick_id)
    .single();

  if (error) throw error;

  return { success: true, trick: data };
}

// Action: Update trick
async function updateTrick(params: any, supabaseClient: any) {
  const { trick_id, updates } = params;

  const { data, error } = await supabaseClient
    .from('ai_generated_tricks')
    .update(updates)
    .eq('id', trick_id)
    .select()
    .single();

  if (error) throw error;

  return { success: true, trick: data, message: 'Trick updated successfully' };
}

// Action: Delete trick
async function deleteTrick(params: any, supabaseClient: any) {
  const { trick_id } = params;

  const { error } = await supabaseClient
    .from('ai_generated_tricks')
    .delete()
    .eq('id', trick_id);

  if (error) throw error;

  return { success: true, message: 'Trick deleted successfully' };
}

// Action: Get stats
async function getStats(supabaseClient: any) {
  const { data: tricks } = await supabaseClient
    .from('ai_generated_tricks')
    .select('status, category, language, helpful_count, not_helpful_count, views_count');

  const stats = {
    total: tricks?.length || 0,
    published: tricks?.filter((t: any) => t.status === 'published').length || 0,
    draft: tricks?.filter((t: any) => t.status === 'draft').length || 0,
    archived: tricks?.filter((t: any) => t.status === 'archived').length || 0,
    total_views: tricks?.reduce((sum: number, t: any) => sum + (t.views_count || 0), 0) || 0,
    total_helpful: tricks?.reduce((sum: number, t: any) => sum + (t.helpful_count || 0), 0) || 0,
    by_language: {
      en: tricks?.filter((t: any) => t.language === 'en').length || 0,
      hi: tricks?.filter((t: any) => t.language === 'hi').length || 0,
    }
  };

  return { success: true, stats };
}

// Action: Record feedback
async function recordFeedback(params: any, supabaseClient: any) {
  const { trick_id, user_id, is_helpful, feedback_text } = params;

  const { data: existing } = await supabaseClient
    .from('trick_feedback')
    .select('id')
    .eq('trick_id', trick_id)
    .eq('user_id', user_id)
    .single();

  if (existing) {
    await supabaseClient
      .from('trick_feedback')
      .update({ is_helpful, feedback_text, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
  } else {
    await supabaseClient
      .from('trick_feedback')
      .insert({ trick_id, user_id, is_helpful, feedback_text });
  }

  return { success: true, message: 'Feedback recorded' };
}


async function checkEmailExists(params: any, supabaseAdmin: any) {
  const { email, excludeUserId } = params;
  if (!email || typeof email !== 'string') {
    throw new Error('Email is required');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    throw new Error('Invalid email format');
  }

  // Check both the primary auth email and emails attached to OAuth identities.
  try {
    const { data: accountInfo, error: accountInfoError } = await supabaseAdmin.rpc('auth_email_account_info', {
      p_email: normalizedEmail,
    });
    if (!accountInfoError && typeof accountInfo?.exists === 'boolean' && !excludeUserId) {
      return {
        exists: accountInfo.exists,
        providers: Array.isArray(accountInfo.providers) ? accountInfo.providers : [],
      };
    }
  } catch (_e) {
    // fall through to admin listUsers below
  }

  let page = 1;
  const perPage = 1000;
  let emailExists = false;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error('Failed to check email');

    const users = data.users || [];
    emailExists = users.some((user: any) => {
      const matches = user.email?.toLowerCase() === normalizedEmail;
      return matches && !(excludeUserId && user.id === excludeUserId);
    });

    if (emailExists || users.length < perPage) break;
    page++;
  }

  return { exists: emailExists, providers: [] };
}

async function resolvePhoneEmail(params: any, supabaseAdmin: any): Promise<string | null> {
  const raw = typeof params?.phone === 'string' ? params.phone : '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) {
    throw new Error('Invalid mobile number');
  }
  const { data, error } = await supabaseAdmin.rpc('get_login_email_by_phone', { p_phone: digits });
  if (error) {
    console.error('phone lookup failed:', error.message);
    throw new Error('Login failed. Please try again.');
  }
  return (data as string | null) || null;
}

async function checkPhoneExists(params: any, supabaseAdmin: any) {
  const email = await resolvePhoneEmail(params, supabaseAdmin);
  return { exists: !!email };
}

async function phonePasswordLogin(params: any, supabaseAdmin: any) {
  const password = typeof params?.password === 'string' ? params.password : '';
  if (password.length < 1 || password.length > 200) {
    return { success: false, error: 'Invalid mobile number or password' };
  }

  const email = await resolvePhoneEmail(params, supabaseAdmin);
  if (!email) {
    return { success: false, error: 'Invalid login credentials' };
  }

  const anon = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    return { success: false, error: error?.message || 'Invalid login credentials' };
  }

  return {
    success: true,
    email,
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  };
}



async function generateReferralCode(params: any, supabaseAdmin: any, req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header');
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !user) throw new Error('Invalid or expired token');

  const { data: existingCode } = await supabaseAdmin
    .from('referral_codes')
    .select('referral_code')
    .eq('user_id', user.id)
    .single();

  if (existingCode) {
    return {
      success: true,
      referral_code: existingCode.referral_code,
      message: 'Referral code already exists',
      merged_into: 'unified-ai-tricks',
    };
  }

  const { data: newCode, error: generateError } = await supabaseAdmin
    .rpc('generate_unique_referral_code', { p_user_id: user.id });
  if (generateError) throw generateError;

  const { error: insertError } = await supabaseAdmin
    .from('referral_codes')
    .insert({ user_id: user.id, referral_code: newCode, is_active: true });
  if (insertError) throw insertError;

  const { error: walletError } = await supabaseAdmin
    .from('referral_wallets')
    .upsert({ user_id: user.id, balance_amount: 0, total_earned: 0, total_withdrawn: 0 }, {
      onConflict: 'user_id',
      ignoreDuplicates: true,
    });
  if (walletError) console.error('Referral wallet creation warning:', walletError);

  return {
    success: true,
    referral_code: newCode,
    message: 'Referral code generated successfully',
    merged_into: 'unified-ai-tricks',
  };
}

// Action: Schedule - auto-generate based on rotation
async function scheduleGenerate(supabaseClient: any) {
  console.log("🤖 AI Trick Scheduler started");

  const categories = [
    'resume_building',
    'interview_preparation',
    'remote_work_best_practices',
    'job_search_strategies',
    'skill_development'
  ];

  // Get last generated trick
  const { data: lastTrick } = await supabaseClient
    .from('ai_generated_tricks')
    .select('category, language')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // Rotate category and language
  let nextCategoryIndex = 0;
  if (lastTrick) {
    const currentIndex = categories.indexOf(lastTrick.category);
    nextCategoryIndex = (currentIndex + 1) % categories.length;
  }
  const selectedCategory = categories[nextCategoryIndex];
  const selectedLanguage = lastTrick?.language === 'hi' ? 'en' : 'hi';

  console.log(`📝 Generating scheduled trick: ${selectedCategory} (${selectedLanguage})`);

  const result = await generateTrick({
    category: selectedCategory,
    language: selectedLanguage,
    trigger_type: 'scheduled'
  }, supabaseClient);

  return {
    success: true,
    message: "Scheduled trick generated successfully",
    trick: result.trick,
    scheduler_info: {
      category: selectedCategory,
      language: selectedLanguage,
      triggered_at: new Date().toISOString()
    }
  };
}

// ============================================================================
// ===============  AI JOB MATCHING (Lovable AI Gateway)  =====================
// Takes a job seeker's skills/preferences and ranks live Workly listings.
// ============================================================================

const JOB_MATCH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string', description: 'One or two friendly sentences about the overall fit.' },
    matches: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          job_id: { type: 'string' },
          score: { type: 'number', description: 'Match score from 0 to 100.' },
          reason: { type: 'string', description: 'Why this job fits, 1-2 sentences.' },
          highlights: { type: 'array', items: { type: 'string' } },
          gaps: { type: ['string', 'null'], description: 'What the seeker may be missing, or null.' },
        },
        required: ['job_id', 'score', 'reason', 'highlights', 'gaps'],
      },
    },
  },
  required: ['summary', 'matches'],
};

const JOB_MATCH_COLUMNS =
  'id,title,description,location,city,state,job_type,work_mode,experience_level,salary_range,salary_min,salary_max,salary_period,skills,category,public_slug,published_at';

async function matchJobs(params: any, supabaseClient: any) {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) return { success: false, error: 'AI is not configured yet.' };

  const skills = String(params?.skills ?? '').trim();
  const preferences = String(params?.preferences ?? '').trim();
  const location = String(params?.location ?? '').trim();
  const jobType = String(params?.job_type ?? '').trim();
  const workMode = String(params?.work_mode ?? '').trim();
  const experience = String(params?.experience ?? '').trim();

  if (!skills && !preferences) {
    return { success: false, error: 'Please describe your skills or what you are looking for.' };
  }

  let query = supabaseClient
    .from('jobs')
    .select(JOB_MATCH_COLUMNS)
    .eq('status', 'active')
    .order('published_at', { ascending: false })
    .limit(80);

  if (location) {
    query = query.or(
      `location.ilike.%${location}%,city.ilike.%${location}%,state.ilike.%${location}%`,
    );
  }
  if (jobType) query = query.ilike('job_type', `%${jobType}%`);
  if (workMode) query = query.ilike('work_mode', `%${workMode}%`);

  const { data: filtered, error } = await query;
  if (error) return { success: false, error: error.message };

  let jobs: any[] = filtered ?? [];

  // If the filters were too tight, top up with the newest active jobs.
  if (jobs.length < 5) {
    const { data: fallback } = await supabaseClient
      .from('jobs')
      .select(JOB_MATCH_COLUMNS)
      .eq('status', 'active')
      .order('published_at', { ascending: false })
      .limit(60);
    const seen = new Set(jobs.map((j: any) => j.id));
    jobs = [...jobs, ...((fallback ?? []) as any[]).filter((j) => !seen.has(j.id))];
  }

  if (!jobs.length) {
    return { success: true, summary: 'No active jobs are listed right now.', matches: [] };
  }

  const compact = jobs.map((j: any) => ({
    id: j.id,
    title: j.title,
    category: j.category,
    job_type: j.job_type,
    work_mode: j.work_mode,
    experience_level: j.experience_level,
    location: [j.location, j.city, j.state].filter(Boolean).join(', '),
    salary: j.salary_range ?? [j.salary_min, j.salary_max].filter(Boolean).join('-'),
    skills: Array.isArray(j.skills) ? j.skills.slice(0, 12) : [],
    about: typeof j.description === 'string' ? j.description.slice(0, 400) : '',
  }));

  const seeker = [
    skills && `Skills: ${skills}`,
    experience && `Experience: ${experience}`,
    preferences && `What they want: ${preferences}`,
    location && `Preferred location: ${location}`,
    jobType && `Preferred job type: ${jobType}`,
    workMode && `Preferred work mode: ${workMode}`,
  ]
    .filter(Boolean)
    .join('\n');

  const prompt = `You are Workly India's job matching assistant.

JOB SEEKER
${seeker}

AVAILABLE WORKLY JOBS (JSON)
${JSON.stringify(compact)}

Pick the best matching jobs for this seeker, ranked best first.
Rules:
- Only use job_id values that appear in the list above. Never invent a job.
- Return at most 8 matches, and only jobs that are a genuine fit (fewer is fine).
- score is 0-100 honesty-first: 85+ strong, 60-84 decent, below 60 only if nothing better.
- reason must mention the seeker's own words/skills, max 2 sentences, simple English.
- highlights: 2-4 very short phrases (e.g. "Remote", "Matches Excel skill").
- gaps: one short sentence about anything missing, or null.
- summary: 1-2 encouraging sentences about their overall options.`;

  const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Lovable-API-Key': apiKey,
      'X-Lovable-AIG-SDK': 'fetch',
    },
    body: JSON.stringify({
      model: 'openai/gpt-6-astra',
      input: prompt,
      stream: true,
      reasoning: { effort: 'low' },
      text: {
        format: { type: 'json_schema', name: 'job_matches', strict: true, schema: JOB_MATCH_SCHEMA },
      },
    }),
  });

  if (!aiRes.ok || !aiRes.body) {
    const detail = await aiRes.text().catch(() => '');
    console.error('[unified-ai-tricks] job_match gateway error', aiRes.status, detail);
    if (aiRes.status === 429) return { success: false, error: 'AI is busy right now. Please try again in a moment.' };
    if (aiRes.status === 402) return { success: false, error: 'AI credits are exhausted. Please top up to keep using matching.' };
    return { success: false, error: 'AI matching is unavailable right now.' };
  }

  const reader = aiRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const evt = JSON.parse(payload);
        if (evt.type === 'response.output_text.delta' && typeof evt.delta === 'string') {
          text += evt.delta;
        } else if (evt.type === 'response.completed' && !text && typeof evt.response?.output_text === 'string') {
          text = evt.response.output_text;
        }
      } catch {
        /* ignore partial frames */
      }
    }
  }

  let parsed: { summary?: string; matches?: any[] } = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    console.error('[unified-ai-tricks] job_match unparsable output', text.slice(0, 300));
    return { success: false, error: 'AI could not build your matches. Please try again.' };
  }

  const byId = new Map(jobs.map((j: any) => [String(j.id), j]));
  const matches = (parsed.matches ?? [])
    .map((m: any) => {
      const job = byId.get(String(m?.job_id));
      if (!job) return null;
      return {
        score: Math.max(0, Math.min(100, Math.round(Number(m.score) || 0))),
        reason: String(m.reason ?? ''),
        highlights: Array.isArray(m.highlights) ? m.highlights.slice(0, 4).map(String) : [],
        gaps: m.gaps ? String(m.gaps) : null,
        job: {
          id: job.id,
          title: job.title,
          location: [job.location, job.city, job.state].filter(Boolean).join(', '),
          job_type: job.job_type,
          work_mode: job.work_mode,
          experience_level: job.experience_level,
          salary_range: job.salary_range ?? null,
          skills: Array.isArray(job.skills) ? job.skills.slice(0, 8) : [],
          public_slug: job.public_slug ?? null,
        },
      };
    })
    .filter(Boolean)
    .slice(0, 8);

  return { success: true, summary: String(parsed.summary ?? ''), matches };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const { action, ...params } = body;

    console.log(`[unified-ai-tricks] Action: ${action}`);

    let result;

    switch (action) {
      case 'generate':
        result = await generateTrick(params, supabaseClient);
        break;
      case 'list':
        result = await listTricks(params, supabaseClient);
        break;
      case 'get':
        result = await getTrick(params, supabaseClient);
        break;
      case 'update':
        result = await updateTrick(params, supabaseClient);
        break;
      case 'delete':
        result = await deleteTrick(params, supabaseClient);
        break;
      case 'stats':
        result = await getStats(supabaseClient);
        break;
      case 'feedback':
        result = await recordFeedback(params, supabaseClient);
        break;
      case 'schedule':
        result = await scheduleGenerate(supabaseClient);
        break;
      case 'check_email_exists':
        result = await checkEmailExists(params, supabaseClient);
        break;
      case 'check_phone_exists':
        result = await checkPhoneExists(params, supabaseClient);
        break;
      case 'phone_password_login':
        result = await phonePasswordLogin(params, supabaseClient);
        break;

      case 'generate_referral_code':
        result = await generateReferralCode(params, supabaseClient, req);
        break;
      case 'job_match':
        result = await matchJobs(params, supabaseClient);
        break;
      // ============================================================
      //  AUTONOMOUS GROWTH AGENT (merged — no extra slot)
      // ============================================================
      case 'agent_run':
        result = await agentRun(supabaseClient, params);
        break;
      case 'agent_get_runs':
        result = await agentGetRuns(supabaseClient, params);
        break;
      case 'agent_get_health':
        result = await agentGetHealth(supabaseClient);
        break;
      case 'agent_get_plans':
        result = await agentGetPlans(supabaseClient);
        break;
      case 'agent_pause':
        result = await agentSetPaused(supabaseClient, true);
        break;
      case 'agent_resume':
        result = await agentSetPaused(supabaseClient, false);
        break;
      case 'agent_status':
        result = await agentStatus(supabaseClient);
        break;
      case 'agent_admin_overview':
        await requireOwnerAdmin(req, supabaseClient);
        result = await agentAdminOverview(supabaseClient);
        break;
      case 'agent_admin_profiles':
        await requireOwnerAdmin(req, supabaseClient);
        result = await agentAdminProfiles(supabaseClient, params);
        break;
      case 'agent_admin_messaging':
        await requireOwnerAdmin(req, supabaseClient);
        result = await agentAdminMessaging(supabaseClient, params);
        break;
      case 'agent_admin_user_360':
        await requireOwnerAdmin(req, supabaseClient);
        result = await agentAdminUser360(supabaseClient, params);
        break;
      case 'agent_admin_jobs':
        await requireOwnerAdmin(req, supabaseClient);
        result = await agentAdminJobs(supabaseClient, params);
        break;
      case 'agent_admin_referrals':
        await requireOwnerAdmin(req, supabaseClient);
        result = await agentAdminReferrals(supabaseClient, params);
        break;
      case 'agent_admin_daily':
        await requireOwnerAdmin(req, supabaseClient);
        result = await agentAdminDaily(supabaseClient, params);
        break;
      default:
        return new Response(
          JSON.stringify({
            success: false,
            error: `Unknown action: ${action}`,
            available_actions: ['generate', 'list', 'get', 'update', 'delete', 'stats', 'feedback', 'schedule', 'check_email_exists', 'generate_referral_code',
              'agent_run', 'agent_get_runs', 'agent_get_health', 'agent_get_plans',
              'agent_pause', 'agent_resume', 'agent_status',
              'agent_admin_overview', 'agent_admin_profiles', 'agent_admin_messaging',
              'agent_admin_user_360', 'agent_admin_jobs', 'agent_admin_referrals', 'agent_admin_daily', 'job_match']
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("❌ Error in unified-ai-tricks:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Operation failed"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ============================================================================
// =====================  AUTONOMOUS GROWTH AGENT  ============================
// ----------------------------------------------------------------------------
// Self-running orchestrator. 6 phases per run:
//   1. SENSE   — read last hour of metrics, errors, queue depth
//   2. DIAGNOSE — AI: what's broken? where is engagement dropping?
//   3. PLAN    — AI: who to target, what message, which channel
//   4. EXECUTE — trigger ai-proactive-engagement + email-api
//   5. HEAL    — auto-fix detected errors (retry / fallback / clear queue)
//   6. REPORT  — write markdown summary to ai_agent_runs
// ============================================================================

const AGENT_PAUSE_KEY = 'autonomous_agent_paused';

// Providers that returned 401/403 in this isolate are skipped for the rest of
// its lifetime to avoid log spam and wasted latency. Cleared on cold start.
const _disabledGateways = new Set<string>();

async function agentCallAI(prompt: string, system: string, expectJson = true): Promise<string> {
  const vercelKey = Deno.env.get("VERCEL_AI_GATEWAY_API_KEY");
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const googleKey = Deno.env.get("GOOGLE_AI_STUDIO_API_KEY");
  const groqKey = Deno.env.get("GROQ_API_KEY");
  const openRouterKey = Deno.env.get("OPENROUTER_API_KEY");

  const gateways = [
    { name: "vercel",     url: "https://ai-gateway.vercel.sh/v1/chat/completions",                       key: vercelKey,     model: "google/gemini-2.5-flash" },
    { name: "lovable",    url: "https://ai.gateway.lovable.dev/v1/chat/completions",                     key: lovableKey,    model: "google/gemini-2.5-flash" },
    { name: "google",     url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", key: googleKey,   model: "gemini-2.5-flash" },
    { name: "openrouter", url: "https://openrouter.ai/api/v1/chat/completions",                          key: openRouterKey, model: "meta-llama/llama-3.3-70b-instruct:free",
      extraHeaders: { "HTTP-Referer": WEBSITE_DOMAIN, "X-Title": "Workly India Autonomous Agent" } },
    { name: "groq",       url: "https://api.groq.com/openai/v1/chat/completions",                        key: groqKey,       model: "llama-3.1-8b-instant" },
  ].filter((g: any) => !!g.key && !_disabledGateways.has(g.name));

  if (gateways.length === 0) throw new Error("No AI gateway keys configured (or all disabled by auth failures)");

  for (const gw of gateways as any[]) {
    try {
      const payload: any = {
        model: gw.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        temperature: 0.6,
        max_tokens: 1200,
      };
      // Vercel AI Gateway rejects response_format param entirely → skip for vercel
      const supportsJsonMode = gw.name !== "vercel" && gw.name !== "openrouter";
      if (expectJson && supportsJsonMode) payload.response_format = { type: "json_object" };
      const res = await fetch(gw.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${gw.key}`, "Content-Type": "application/json", ...(gw.extraHeaders ?? {}) },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        // 401/403: bad/missing key for THIS provider — disable for rest of isolate.
        if (res.status === 401 || res.status === 403) {
          _disabledGateways.add(gw.name);
          console.log(`[agent] gateway=${gw.name} auth_failed (${res.status}) — disabled for this isolate`);
          continue;
        }
        // 429: rate-limited — try next, info level.
        if (res.status === 429) {
          console.log(`[agent] gateway=${gw.name} rate_limited (429), trying next`);
          continue;
        }
        console.warn(`[agent] gateway=${gw.name} status=${res.status} body=${errBody.slice(0, 300)}`);
        // Broad retry: any 400 with response_format mentioned, OR Invalid input on that param
        if (res.status === 400 && expectJson && /response_format|json_object|unsupported|invalid input|invalid_request/i.test(errBody)) {
          const retryPayload = { ...payload };
          delete retryPayload.response_format;
          const retry = await fetch(gw.url, {
            method: "POST",
            headers: { Authorization: `Bearer ${gw.key}`, "Content-Type": "application/json", ...(gw.extraHeaders ?? {}) },
            body: JSON.stringify(retryPayload),
          });
          if (retry.ok) {
            const j = await retry.json();
            const content = j?.choices?.[0]?.message?.content ?? "";
            if (content) {
              console.log(`[agent] gateway=${gw.name} succeeded on retry without response_format`);
              return content;
            }
          } else {
            const retryErr = await retry.text().catch(() => "");
            console.warn(`[agent] gateway=${gw.name} retry failed status=${retry.status} body=${retryErr.slice(0, 200)}`);
          }
        }
        continue;
      }
      const j = await res.json();
      const content = j?.choices?.[0]?.message?.content ?? "";
      if (content) return content;
    } catch (e) {
      console.warn(`[agent] gateway=${gw.name} error`, e);
    }
  }
  throw new Error("All AI gateways failed");
}

function safeParseJson(s: string): any {
  try { return JSON.parse(s); } catch {
    const m = s.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch { /* noop */ } }
    return {};
  }
}

function getBearerToken(req: Request): string | null {
  const header = req.headers.get('Authorization') || req.headers.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

async function requireOwnerAdmin(req: Request, supabase: any) {
  const token = getBearerToken(req);
  if (!token) throw new Error('Owner/admin authentication required');

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  const user = userData?.user;
  if (userErr || !user?.id) throw new Error('Invalid or expired admin session');

  const { data: admin, error: adminErr } = await supabase
    .from('admin_users')
    .select('user_id, role')
    .eq('user_id', user.id)
    .in('role', ['owner', 'admin'])
    .maybeSingle();

  if (adminErr || !admin) throw new Error('Owner/admin access only');
  return { user_id: user.id, role: admin.role };
}

async function safeCount(supabase: any, table: string, apply?: (q: any) => any): Promise<number> {
  try {
    let query = supabase.from(table).select('id', { count: 'exact', head: true });
    if (apply) query = apply(query);
    const { count, error } = await query;
    if (error) return 0;
    return count ?? 0;
  } catch (_e) {
    return 0;
  }
}

async function safeRows(supabase: any, table: string, select = '*', apply?: (q: any) => any, limit = 100): Promise<any[]> {
  try {
    let query = supabase.from(table).select(select).limit(limit);
    if (apply) query = apply(query);
    const { data, error } = await query;
    if (error) return [];
    return data ?? [];
  } catch (_e) {
    return [];
  }
}

function statusBuckets(rows: any[], statusKey = 'status') {
  return rows.reduce((acc: Record<string, number>, row: any) => {
    const key = String(row?.[statusKey] ?? 'unknown');
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

// ─── helpers used by all admin/agent views ─────────────────────────────────
function isComplete(r: any): boolean { return r?.is_profile_complete === true; }
function isActive(r: any): boolean {
  const s = String(r?.account_status ?? '').toLowerCase();
  if (!s) return true; // null/undefined => treat active
  return s === 'active' || s === 'enabled' || s === 'verified';
}
function isRecent(r: any, since: string): boolean {
  const t = r?.created_at || r?.started_at || r?.event_at || r?.occurred_at || r?.applied_at || 0;
  try { return new Date(t).toISOString() >= since; } catch { return false; }
}
const sumNum = (rows: any[], key: string) => rows.reduce((n, r) => n + (Number(r?.[key]) || 0), 0);

// Aggregate notification rows that may either expose `status` (push_notification_logs)
// or composite `total_sent`/`total_failed`/`channels_requested` (unified_notification_logs)
function notificationStats(rows: any[]) {
  let sent = 0, failed = 0, queued = 0;
  const byChannel: Record<string, { sent: number; failed: number; total: number }> = {};
  const errors: Record<string, number> = {};
  for (const r of rows) {
    if (typeof r.total_sent === 'number') sent += r.total_sent;
    if (typeof r.total_failed === 'number') failed += r.total_failed;
    const status = String(r.status ?? '').toLowerCase();
    if (status === 'sent' || status === 'delivered' || status === 'success') sent++;
    else if (status === 'failed' || status === 'error' || status === 'bounced') failed++;
    else if (status === 'queued' || status === 'pending' || status === 'processing') queued++;
    const channels: string[] = Array.isArray(r.channels_requested) && r.channels_requested.length
      ? r.channels_requested
      : (r.channel ? [r.channel] : ['unknown']);
    for (const ch of channels) {
      const k = String(ch).toLowerCase();
      if (!byChannel[k]) byChannel[k] = { sent: 0, failed: 0, total: 0 };
      byChannel[k].total++;
      if (typeof r.total_sent === 'number') byChannel[k].sent += r.total_sent;
      if (typeof r.total_failed === 'number') byChannel[k].failed += r.total_failed;
      if (status === 'sent' || status === 'delivered' || status === 'success') byChannel[k].sent++;
      else if (status === 'failed' || status === 'error' || status === 'bounced') byChannel[k].failed++;
    }
    const err = String(r.error_message ?? r.bounce_reason ?? '').slice(0, 200);
    if (err) errors[err] = (errors[err] || 0) + 1;
  }
  const top_errors = Object.entries(errors).sort((a, b) => b[1] - a[1]).slice(0, 15)
    .map(([msg, count]) => ({ error: msg, count }));
  return { sent, failed, queued, total: rows.length, by_channel: byChannel, top_errors };
}

async function agentAdminOverview(supabase: any) {
  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
  const since7d = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();

  const [
    profiles, companies, jobs, applications, jobPayments, wallets,
    unifiedNotifs, pushLogs, telegramMsgs, emailEvents,
    devices, searches, referrals, commissions, withdrawals, refWallets,
    interviews,
  ] = await Promise.all([
    safeRows(supabase, 'profiles', 'user_id, is_profile_complete, account_status, created_at', (q) => q.order('created_at', { ascending: false }), 5000),
    safeRows(supabase, 'companies', 'user_id, is_profile_complete, account_status, created_at', (q) => q.order('created_at', { ascending: false }), 5000),
    safeRows(supabase, 'jobs', 'id, company_id, title, status, created_at, expires_at', (q) => q.order('created_at', { ascending: false }), 5000),
    safeRows(supabase, 'job_applications', 'id, job_id, applicant_id, employer_id, status, applied_at, created_at', (q) => q.order('created_at', { ascending: false }), 5000),
    safeRows(supabase, 'job_payments', 'id, user_id, job_id, points_spent, payment_type, created_at', (q) => q.order('created_at', { ascending: false }), 5000),
    safeRows(supabase, 'wallets', 'user_id, balance_points, total_purchased, total_spent', undefined, 5000),
    safeRows(supabase, 'unified_notification_logs', 'id, event_type, user_id, user_type, channels_requested, results, total_sent, total_failed, trigger_source, created_at', (q) => q.order('created_at', { ascending: false }), 3000),
    safeRows(supabase, 'push_notification_logs', 'id, user_id, status, error_message, sent_at, created_at', (q) => q.order('created_at', { ascending: false }), 3000),
    safeRows(supabase, 'telegram_messages', 'id, status, direction, sent_at, created_at', (q) => q.order('created_at', { ascending: false }), 2000),
    safeRows(supabase, 'email_outbound_events', 'id, recipient_email, event_type, user_id, bounce_reason, event_at, created_at', (q) => q.order('event_at', { ascending: false }), 3000),
    safeRows(supabase, 'device_info_logs', 'user_id, device_id, browser_name, operating_system, country, vpn_detected, is_bot, updated_at, created_at', (q) => q.order('updated_at', { ascending: false }), 5000),
    safeRows(supabase, 'search_history', 'user_id, search_query, results_count, created_at', (q) => q.order('created_at', { ascending: false }), 5000),
    safeRows(supabase, 'user_referrals', 'id, referrer_id, referred_user_id, is_active, created_at', (q) => q.order('created_at', { ascending: false }), 5000),
    safeRows(supabase, 'referral_commissions', 'id, referrer_id, commission_amount, source_type, status, created_at', (q) => q.order('created_at', { ascending: false }), 5000),
    safeRows(supabase, 'referral_withdrawal_requests', 'id, user_id, amount, status, failure_reason, created_at, processed_at', (q) => q.order('created_at', { ascending: false }), 2000),
    safeRows(supabase, 'referral_wallets', 'user_id, balance_amount, total_earned, total_withdrawn', undefined, 5000),
    safeRows(supabase, 'interviews', 'id, job_id, applicant_id, host_user_id, status, scheduled_at, actual_start_time, total_participants, created_at', (q) => q.order('created_at', { ascending: false }), 3000),
  ]);

  // company_id -> employer user_id (for jobs)
  const companyToEmployer = new Map<string, string>();
  for (const c of companies) {
    // companies row keyed by user_id; we need company.id mapping - fetch separately if missing
  }
  // Fetch id<->user_id for companies (only id column, not in earlier select)
  const companyIdMap = await safeRows(supabase, 'companies', 'id, user_id', undefined, 5000);
  for (const c of companyIdMap) if (c.id && c.user_id) companyToEmployer.set(c.id, c.user_id);

  // Top 20 search queries
  const queryCounts: Record<string, number> = {};
  for (const s of searches) {
    const q = String(s.search_query || '').trim().toLowerCase();
    if (q) queryCounts[q] = (queryCounts[q] || 0) + 1;
  }
  const topSearches = Object.entries(queryCounts).sort((a, b) => b[1] - a[1]).slice(0, 20)
    .map(([query, count]) => ({ query, count }));

  // Daily new accounts (last 7 days)
  const dailyNew: Record<string, { job_seekers: number; employers: number }> = {};
  const dayKey = (d: any) => { try { return new Date(d).toISOString().slice(0, 10); } catch { return 'unknown'; } };
  for (const p of profiles) { if (!isRecent(p, since7d)) continue; const k = dayKey(p.created_at); dailyNew[k] ??= { job_seekers: 0, employers: 0 }; dailyNew[k].job_seekers++; }
  for (const c of companies) { if (!isRecent(c, since7d)) continue; const k = dayKey(c.created_at); dailyNew[k] ??= { job_seekers: 0, employers: 0 }; dailyNew[k].employers++; }

  // Notification rollup
  const unifiedStats = notificationStats(unifiedNotifs);
  const pushStats = notificationStats(pushLogs);
  const telegramStats = (() => {
    const sent = telegramMsgs.filter((m: any) => m.status === 'sent' || m.status === 'delivered').length;
    const failed = telegramMsgs.filter((m: any) => m.status === 'failed' || m.status === 'error').length;
    return { total: telegramMsgs.length, sent, failed };
  })();
  const emailStats = (() => {
    const buckets: Record<string, number> = {};
    for (const e of emailEvents) {
      const t = String(e.event_type || 'unknown').toLowerCase();
      buckets[t] = (buckets[t] || 0) + 1;
    }
    const bounceReasons: Record<string, number> = {};
    for (const e of emailEvents) {
      if (e.bounce_reason) bounceReasons[e.bounce_reason] = (bounceReasons[e.bounce_reason] || 0) + 1;
    }
    return { total: emailEvents.length, by_event_type: buckets, top_bounce_reasons: Object.entries(bounceReasons).sort((a, b) => b[1] - a[1]).slice(0, 10) };
  })();

  // Job posting + expiry breakdown
  const nowMs = now.getTime();
  const jobsExpired = jobs.filter((j: any) => j.expires_at && new Date(j.expires_at).getTime() < nowMs).length;
  const jobsExpiringSoon = jobs.filter((j: any) => j.expires_at && new Date(j.expires_at).getTime() >= nowMs && new Date(j.expires_at).getTime() < nowMs + 7 * 24 * 3600 * 1000).length;

  // Commission breakdown — paid / pending / failed + reason
  const commissionBuckets = statusBuckets(commissions);
  const totalCommissionPaid = commissions.filter((c: any) => c.status === 'paid' || c.status === 'completed').reduce((n, c) => n + Number(c.commission_amount || 0), 0);
  const totalCommissionPending = commissions.filter((c: any) => c.status === 'pending').reduce((n, c) => n + Number(c.commission_amount || 0), 0);
  const withdrawalBuckets = statusBuckets(withdrawals);
  const withdrawalFailures = withdrawals.filter((w: any) => w.status === 'failed' || w.failure_reason).map((w: any) => ({ id: w.id, amount: w.amount, reason: w.failure_reason || 'unknown', at: w.created_at })).slice(0, 30);

  return {
    success: true,
    generated_at: now.toISOString(),
    users: {
      job_seekers: {
        total: profiles.length,
        complete_profiles: profiles.filter(isComplete).length,
        incomplete_profiles: profiles.filter((r) => !isComplete(r)).length,
        active: profiles.filter(isActive).length,
        inactive: profiles.filter((r) => !isActive(r)).length,
        new_24h: profiles.filter((r) => isRecent(r, since24h)).length,
        new_7d: profiles.filter((r) => isRecent(r, since7d)).length,
      },
      employers: {
        total: companies.length,
        complete_profiles: companies.filter(isComplete).length,
        incomplete_profiles: companies.filter((r) => !isComplete(r)).length,
        active: companies.filter(isActive).length,
        inactive: companies.filter((r) => !isActive(r)).length,
        new_24h: companies.filter((r) => isRecent(r, since24h)).length,
        new_7d: companies.filter((r) => isRecent(r, since7d)).length,
      },
      daily_new_last_7d: dailyNew,
    },
    jobs: {
      total: jobs.length,
      by_status: statusBuckets(jobs),
      new_24h: jobs.filter((r) => isRecent(r, since24h)).length,
      new_7d: jobs.filter((r) => isRecent(r, since7d)).length,
      expired: jobsExpired,
      expiring_in_7_days: jobsExpiringSoon,
      applications_total: applications.length,
      applications_by_status: statusBuckets(applications),
      applications_24h: applications.filter((r) => isRecent(r, since24h)).length,
    },
    money: {
      wallet_users: wallets.length,
      total_wallet_balance_points: sumNum(wallets, 'balance_points'),
      total_points_purchased: sumNum(wallets, 'total_purchased'),
      total_points_spent: sumNum(wallets, 'total_spent'),
      job_payments_total: jobPayments.length,
      job_payments_by_type: statusBuckets(jobPayments, 'payment_type'),
      points_spent_in_payments: sumNum(jobPayments, 'points_spent'),
    },
    referrals: {
      total_referrals: referrals.length,
      active_referrals: referrals.filter((r: any) => r.is_active).length,
      new_24h: referrals.filter((r) => isRecent(r, since24h)).length,
      commissions_total: commissions.length,
      commissions_by_status: commissionBuckets,
      commissions_paid_amount: totalCommissionPaid,
      commissions_pending_amount: totalCommissionPending,
      referral_wallet_users: refWallets.length,
      referral_wallet_total_earned: sumNum(refWallets, 'total_earned'),
      referral_wallet_total_withdrawn: sumNum(refWallets, 'total_withdrawn'),
      referral_wallet_current_balance: sumNum(refWallets, 'balance_amount'),
      withdrawal_requests: withdrawals.length,
      withdrawals_by_status: withdrawalBuckets,
      recent_withdrawal_failures: withdrawalFailures,
    },
    interviews: {
      total: interviews.length,
      by_status: statusBuckets(interviews),
      new_24h: interviews.filter((r) => isRecent(r, since24h)).length,
      with_actual_start: interviews.filter((i: any) => i.actual_start_time).length,
      total_participants: sumNum(interviews, 'total_participants'),
    },
    activity: {
      device_records: devices.length,
      vpn_detected_users: devices.filter((d: any) => d.vpn_detected).length,
      bot_flagged_users: devices.filter((d: any) => d.is_bot).length,
      searches_24h: searches.filter((r) => isRecent(r, since24h)).length,
      searches_7d: searches.filter((r) => isRecent(r, since7d)).length,
      top_searches: topSearches,
    },
    messaging: {
      unified_notifications: unifiedStats,
      push_notifications: pushStats,
      telegram: telegramStats,
      email: emailStats,
      total_sent_24h: unifiedStats.sent + pushStats.sent + telegramStats.sent,
      total_failed_24h: unifiedStats.failed + pushStats.failed + telegramStats.failed,
    },
    _company_to_employer_map_size: companyToEmployer.size,
  };
}

async function agentAdminProfiles(supabase: any, params: any) {
  const kind = ['employer', 'job_seeker'].includes(String(params?.kind)) ? String(params.kind) : 'all';
  const limit = Math.min(200, Math.max(1, Number(params?.limit) || 50));
  const userId = params?.user_id ? String(params.user_id) : null;

  const profileRows = kind === 'employer' ? [] : await safeRows(
    supabase, 'profiles', '*',
    (q) => (userId ? q.eq('user_id', userId) : q.order('created_at', { ascending: false })),
    limit,
  );
  const companyRows = kind === 'job_seeker' ? [] : await safeRows(
    supabase, 'companies', '*',
    (q) => (userId ? q.eq('user_id', userId) : q.order('created_at', { ascending: false })),
    limit,
  );
  const ids = [...profileRows, ...companyRows].map((r: any) => r.user_id).filter(Boolean);
  const companyIds = companyRows.map((c: any) => c.id).filter(Boolean);

  const [devices, searches, applications, jobs, wallets, payments, referrals, commissions, refWallets, withdrawals, interviewsAsApplicant, interviewsAsHost, savedJobs, jobFavorites] = await Promise.all([
    ids.length ? safeRows(supabase, 'device_info_logs', '*', (q) => q.in('user_id', ids).order('updated_at', { ascending: false }), 1000) : [],
    ids.length ? safeRows(supabase, 'search_history', '*', (q) => q.in('user_id', ids).order('created_at', { ascending: false }), 1000) : [],
    ids.length ? safeRows(supabase, 'job_applications', '*', (q) => q.in('applicant_id', ids).order('created_at', { ascending: false }), 1000) : [],
    companyIds.length ? safeRows(supabase, 'jobs', '*', (q) => q.in('company_id', companyIds).order('created_at', { ascending: false }), 1000) : [],
    ids.length ? safeRows(supabase, 'wallets', '*', (q) => q.in('user_id', ids), 1000) : [],
    ids.length ? safeRows(supabase, 'job_payments', '*', (q) => q.in('user_id', ids).order('created_at', { ascending: false }), 1000) : [],
    ids.length ? safeRows(supabase, 'user_referrals', '*', (q) => q.in('referrer_id', ids).order('created_at', { ascending: false }), 1000) : [],
    ids.length ? safeRows(supabase, 'referral_commissions', '*', (q) => q.in('referrer_id', ids).order('created_at', { ascending: false }), 1000) : [],
    ids.length ? safeRows(supabase, 'referral_wallets', '*', (q) => q.in('user_id', ids), 1000) : [],
    ids.length ? safeRows(supabase, 'referral_withdrawal_requests', '*', (q) => q.in('user_id', ids).order('created_at', { ascending: false }), 500) : [],
    ids.length ? safeRows(supabase, 'interviews', '*', (q) => q.in('applicant_id', ids).order('created_at', { ascending: false }), 1000) : [],
    ids.length ? safeRows(supabase, 'interviews', '*', (q) => q.in('host_user_id', ids).order('created_at', { ascending: false }), 1000) : [],
    ids.length ? safeRows(supabase, 'saved_jobs', '*', (q) => q.in('user_id', ids).order('created_at', { ascending: false }), 500) : [],
    ids.length ? safeRows(supabase, 'job_favorites', '*', (q) => q.in('user_id', ids).order('created_at', { ascending: false }), 500) : [],
  ]);

  const byUser = (rows: any[], key = 'user_id') => rows.reduce((acc: Record<string, any[]>, row: any) => {
    const id = row?.[key]; if (!id) return acc;
    if (!acc[id]) acc[id] = []; acc[id].push(row); return acc;
  }, {});

  const devicesByUser = byUser(devices);
  const searchesByUser = byUser(searches);
  const appsByApplicant = byUser(applications, 'applicant_id');
  const walletsByUser = byUser(wallets);
  const paymentsByUser = byUser(payments);
  const referralsByUser = byUser(referrals, 'referrer_id');
  const commissionsByUser = byUser(commissions, 'referrer_id');
  const refWalletsByUser = byUser(refWallets);
  const withdrawalsByUser = byUser(withdrawals);
  const savedByUser = byUser(savedJobs);
  const favsByUser = byUser(jobFavorites);
  const intvAsApplByUser = byUser(interviewsAsApplicant, 'applicant_id');
  const intvAsHostByUser = byUser(interviewsAsHost, 'host_user_id');

  // map company.id -> jobs
  const jobsByCompany = jobs.reduce((acc: Record<string, any[]>, j: any) => {
    if (!j.company_id) return acc;
    (acc[j.company_id] ||= []).push(j); return acc;
  }, {});

  const pack = (row: any, type: 'job_seeker' | 'employer') => {
    const uid = row.user_id;
    const cid = type === 'employer' ? row.id : null;
    const userJobs = cid ? (jobsByCompany[cid] ?? []) : [];
    return {
      type,
      profile: row,
      device_info: devicesByUser[uid] ?? [],
      searches: searchesByUser[uid] ?? [],
      applications: appsByApplicant[uid] ?? [],
      saved_jobs: savedByUser[uid] ?? [],
      favorites: favsByUser[uid] ?? [],
      jobs_posted: userJobs,
      wallet: walletsByUser[uid]?.[0] ?? null,
      job_payments: paymentsByUser[uid] ?? [],
      referrals_made: referralsByUser[uid] ?? [],
      referral_commissions: commissionsByUser[uid] ?? [],
      referral_wallet: refWalletsByUser[uid]?.[0] ?? null,
      withdrawal_requests: withdrawalsByUser[uid] ?? [],
      interviews_as_applicant: intvAsApplByUser[uid] ?? [],
      interviews_as_host: intvAsHostByUser[uid] ?? [],
      summary: {
        device_count: devicesByUser[uid]?.length ?? 0,
        search_count: searchesByUser[uid]?.length ?? 0,
        application_count: appsByApplicant[uid]?.length ?? 0,
        jobs_posted_count: userJobs.length,
        active_jobs: userJobs.filter((j: any) => j.status === 'active').length,
        expired_jobs: userJobs.filter((j: any) => j.expires_at && new Date(j.expires_at) < new Date()).length,
        payment_count: paymentsByUser[uid]?.length ?? 0,
        wallet_balance_points: walletsByUser[uid]?.[0]?.balance_points ?? 0,
        referral_count: referralsByUser[uid]?.length ?? 0,
        referral_commission_total: (commissionsByUser[uid] ?? []).reduce((n: number, c: any) => n + Number(c.commission_amount || 0), 0),
        referral_wallet_balance: refWalletsByUser[uid]?.[0]?.balance_amount ?? 0,
        interview_count: (intvAsApplByUser[uid]?.length ?? 0) + (intvAsHostByUser[uid]?.length ?? 0),
      },
    };
  };

  return {
    success: true,
    kind,
    count: profileRows.length + companyRows.length,
    profiles: [
      ...profileRows.map((p: any) => pack(p, 'job_seeker')),
      ...companyRows.map((c: any) => pack(c, 'employer')),
    ],
  };
}

async function agentAdminMessaging(supabase: any, params: any) {
  const limit = Math.min(500, Math.max(1, Number(params?.limit) || 100));
  const since = params?.since ? String(params.since) : new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const userId = params?.user_id ? String(params.user_id) : null;

  const filterByUser = (q: any) => userId ? q.eq('user_id', userId) : q;

  const [unified, push, telegram, email, queue, engagement] = await Promise.all([
    safeRows(supabase, 'unified_notification_logs', '*', (q) => filterByUser(q.gte('created_at', since)).order('created_at', { ascending: false }), limit),
    safeRows(supabase, 'push_notification_logs', '*', (q) => filterByUser(q.gte('created_at', since)).order('created_at', { ascending: false }), limit),
    safeRows(supabase, 'telegram_messages', '*', (q) => q.gte('created_at', since).order('created_at', { ascending: false }), limit),
    safeRows(supabase, 'email_outbound_events', '*', (q) => filterByUser(q.gte('event_at', since)).order('event_at', { ascending: false }), limit),
    safeRows(supabase, 'notification_trigger_queue', '*', (q) => filterByUser(q.gte('created_at', since)).order('created_at', { ascending: false }), limit),
    safeRows(supabase, 'notification_engagement_events', '*', (q) => filterByUser(q.gte('occurred_at', since)).order('occurred_at', { ascending: false }), limit),
  ]);

  return {
    success: true,
    since,
    user_id: userId,
    summary: {
      unified_notifications: notificationStats(unified),
      push_notifications: notificationStats(push),
      telegram: { total: telegram.length, by_status: statusBuckets(telegram), by_direction: statusBuckets(telegram, 'direction') },
      email: { total: email.length, by_event_type: statusBuckets(email, 'event_type'), bounces: email.filter((e: any) => e.bounce_reason).length },
      queue: { total: queue.length, by_status: statusBuckets(queue), recent_errors: queue.filter((q: any) => q.error_message).slice(0, 20).map((q: any) => ({ event: q.event_type, error: q.error_message, at: q.created_at })) },
      engagement: { total: engagement.length, by_action: statusBuckets(engagement, 'action'), by_channel: statusBuckets(engagement, 'channel') },
    },
    logs: { unified, push, telegram, email, queue, engagement },
  };
}

// 360° view of one user — A→Z, including profile, device, activity, money, referrals, messages
async function agentAdminUser360(supabase: any, params: any) {
  const userId = String(params?.user_id || '').trim();
  if (!userId) return { success: false, error: 'user_id required' };

  // Profiles → role detection
  const [profile, company, authUser] = await Promise.all([
    safeRows(supabase, 'profiles', '*', (q) => q.eq('user_id', userId), 1).then((r) => r[0] ?? null),
    safeRows(supabase, 'companies', '*', (q) => q.eq('user_id', userId), 1).then((r) => r[0] ?? null),
    supabase.auth.admin.getUserById(userId).then((r: any) => r?.data?.user ?? null).catch(() => null),
  ]);

  const role = company ? 'employer' : 'job_seeker';
  const companyId = company?.id;

  const [devices, searches, applications, jobs, wallet, payments, referrals, commissions, refWallet, withdrawals,
    interviewsAsApplicant, interviewsAsHost, saved, favorites, savedSearches, notifications,
    pushLogs, telegramMsgs, emailEvents, engagement, conversations, blockedAcct] = await Promise.all([
    safeRows(supabase, 'device_info_logs', '*', (q) => q.eq('user_id', userId).order('updated_at', { ascending: false }), 200),
    safeRows(supabase, 'search_history', '*', (q) => q.eq('user_id', userId).order('created_at', { ascending: false }), 500),
    safeRows(supabase, 'job_applications', '*', (q) => q.eq('applicant_id', userId).order('created_at', { ascending: false }), 500),
    companyId ? safeRows(supabase, 'jobs', '*', (q) => q.eq('company_id', companyId).order('created_at', { ascending: false }), 500) : Promise.resolve([]),
    safeRows(supabase, 'wallets', '*', (q) => q.eq('user_id', userId), 1).then((r) => r[0] ?? null),
    safeRows(supabase, 'job_payments', '*', (q) => q.eq('user_id', userId).order('created_at', { ascending: false }), 500),
    safeRows(supabase, 'user_referrals', '*', (q) => q.eq('referrer_id', userId).order('created_at', { ascending: false }), 500),
    safeRows(supabase, 'referral_commissions', '*', (q) => q.eq('referrer_id', userId).order('created_at', { ascending: false }), 500),
    safeRows(supabase, 'referral_wallets', '*', (q) => q.eq('user_id', userId), 1).then((r) => r[0] ?? null),
    safeRows(supabase, 'referral_withdrawal_requests', '*', (q) => q.eq('user_id', userId).order('created_at', { ascending: false }), 200),
    safeRows(supabase, 'interviews', '*', (q) => q.eq('applicant_id', userId).order('created_at', { ascending: false }), 200),
    safeRows(supabase, 'interviews', '*', (q) => q.eq('host_user_id', userId).order('created_at', { ascending: false }), 200),
    safeRows(supabase, 'saved_jobs', '*', (q) => q.eq('user_id', userId).order('created_at', { ascending: false }), 200),
    safeRows(supabase, 'job_favorites', '*', (q) => q.eq('user_id', userId).order('created_at', { ascending: false }), 200),
    safeRows(supabase, 'job_alert_preferences', '*', (q) => q.eq('user_id', userId), 50),
    safeRows(supabase, 'notifications', '*', (q) => q.eq('user_id', userId).order('created_at', { ascending: false }), 200),
    safeRows(supabase, 'push_notification_logs', '*', (q) => q.eq('user_id', userId).order('created_at', { ascending: false }), 200),
    safeRows(supabase, 'telegram_messages', 'id, status, direction, sent_at, created_at, conversation_id', undefined, 200),
    safeRows(supabase, 'email_outbound_events', '*', (q) => q.eq('user_id', userId).order('event_at', { ascending: false }), 200),
    safeRows(supabase, 'notification_engagement_events', '*', (q) => q.eq('user_id', userId).order('occurred_at', { ascending: false }), 200),
    safeRows(supabase, 'conversations', '*', (q) => q.or(`user_id.eq.${userId},participant_id.eq.${userId}`).order('updated_at', { ascending: false }), 50),
    safeRows(supabase, 'blocked_accounts', '*', (q) => q.eq('user_id', userId), 5),
  ]);

  // applicants list per posted job (for employer)
  const jobIds = jobs.map((j: any) => j.id);
  const jobApplicants = jobIds.length
    ? await safeRows(supabase, 'job_applications', '*', (q) => q.in('job_id', jobIds).order('created_at', { ascending: false }), 1000)
    : [];
  const applicantsByJob = jobApplicants.reduce((acc: Record<string, any[]>, a: any) => {
    (acc[a.job_id] ||= []).push(a); return acc;
  }, {});

  return {
    success: true,
    user_id: userId,
    role,
    auth_user: authUser ? { email: authUser.email, phone: authUser.phone, last_sign_in_at: authUser.last_sign_in_at, created_at: authUser.created_at, email_confirmed_at: authUser.email_confirmed_at, banned_until: authUser.banned_until } : null,
    profile,
    company,
    blocked_account: blockedAcct[0] ?? null,
    device_info: devices,
    activity: { searches, saved_jobs: saved, favorites, alert_preferences: savedSearches },
    job_seeker_activity: role === 'job_seeker' ? { applications, interviews_attended: interviewsAsApplicant } : null,
    employer_activity: role === 'employer' ? {
      jobs_posted: jobs.map((j: any) => ({
        ...j,
        is_expired: j.expires_at ? new Date(j.expires_at) < new Date() : false,
        applicants: applicantsByJob[j.id] ?? [],
        applicant_count: applicantsByJob[j.id]?.length ?? 0,
      })),
      total_jobs_posted: jobs.length,
      active_jobs: jobs.filter((j: any) => j.status === 'active').length,
      expired_jobs: jobs.filter((j: any) => j.expires_at && new Date(j.expires_at) < new Date()).length,
      total_applicants_received: jobApplicants.length,
      interviews_hosted: interviewsAsHost,
    } : null,
    money: {
      wallet,
      job_payments: payments,
      total_points_spent: sumNum(payments, 'points_spent'),
    },
    referrals: {
      referrals_made: referrals,
      commissions,
      total_commission_earned: sumNum(commissions, 'commission_amount'),
      total_commission_paid: commissions.filter((c: any) => c.status === 'paid' || c.status === 'completed').reduce((n: number, c: any) => n + Number(c.commission_amount || 0), 0),
      total_commission_pending: commissions.filter((c: any) => c.status === 'pending').reduce((n: number, c: any) => n + Number(c.commission_amount || 0), 0),
      not_paid_reasons: commissions.filter((c: any) => c.status && c.status !== 'paid' && c.status !== 'completed').map((c: any) => ({ id: c.id, status: c.status, amount: c.commission_amount, created_at: c.created_at })),
      referral_wallet: refWallet,
      withdrawal_requests: withdrawals,
    },
    messaging: {
      in_app_notifications: notifications,
      push_logs: pushLogs,
      email_events: emailEvents,
      engagement_events: engagement,
      conversations,
      counts: {
        push_total: pushLogs.length,
        push_sent: pushLogs.filter((p: any) => p.status === 'sent' || p.status === 'delivered').length,
        push_failed: pushLogs.filter((p: any) => p.status === 'failed' || p.error_message).length,
        email_total: emailEvents.length,
        email_bounced: emailEvents.filter((e: any) => e.bounce_reason).length,
      },
    },
    summary: {
      total_devices: devices.length,
      total_searches: searches.length,
      total_applications: applications.length,
      total_jobs_posted: jobs.length,
      total_payments: payments.length,
      total_referrals: referrals.length,
      total_interviews: interviewsAsApplicant.length + interviewsAsHost.length,
    },
  };
}

// Per-job analytics + applicant list — for "kis job pe kitne apply, kaun apply"
async function agentAdminJobs(supabase: any, params: any) {
  const limit = Math.min(200, Math.max(1, Number(params?.limit) || 50));
  const employerUserId = params?.employer_user_id ? String(params.employer_user_id) : null;
  const jobId = params?.job_id ? String(params.job_id) : null;
  const status = params?.status ? String(params.status) : null;

  let companyId: string | null = null;
  if (employerUserId) {
    const c = await safeRows(supabase, 'companies', 'id', (q) => q.eq('user_id', employerUserId), 1);
    companyId = c[0]?.id ?? null;
    if (!companyId) return { success: true, count: 0, jobs: [], note: 'No company found for employer' };
  }

  const jobs = await safeRows(supabase, 'jobs', '*', (q) => {
    let qq = q.order('created_at', { ascending: false });
    if (jobId) qq = qq.eq('id', jobId);
    if (companyId) qq = qq.eq('company_id', companyId);
    if (status) qq = qq.eq('status', status);
    return qq;
  }, limit);

  const jobIds = jobs.map((j: any) => j.id);
  const [applications, boosts, payments] = await Promise.all([
    jobIds.length ? safeRows(supabase, 'job_applications', '*', (q) => q.in('job_id', jobIds).order('created_at', { ascending: false }), 5000) : [],
    jobIds.length ? safeRows(supabase, 'job_boosts', '*', (q) => q.in('job_id', jobIds).order('created_at', { ascending: false }), 1000) : [],
    jobIds.length ? safeRows(supabase, 'job_payments', '*', (q) => q.in('job_id', jobIds).order('created_at', { ascending: false }), 1000) : [],
  ]);

  // Pull applicant profile snapshots for the applications shown
  const applicantIds = [...new Set(applications.map((a: any) => a.applicant_id).filter(Boolean))];
  const applicantProfiles = applicantIds.length
    ? await safeRows(supabase, 'profiles', 'user_id, full_name, email, phone, location, skills, experience_years', (q) => q.in('user_id', applicantIds), 5000)
    : [];
  const profileByUser: Record<string, any> = {};
  for (const p of applicantProfiles) profileByUser[p.user_id] = p;

  const groupBy = (rows: any[], key: string) => rows.reduce((acc: Record<string, any[]>, row: any) => {
    (acc[row[key]] ||= []).push(row); return acc;
  }, {});
  const appsByJob = groupBy(applications, 'job_id');
  const boostsByJob = groupBy(boosts, 'job_id');
  const paymentsByJob = groupBy(payments, 'job_id');

  return {
    success: true,
    count: jobs.length,
    jobs: jobs.map((j: any) => ({
      ...j,
      is_expired: j.expires_at ? new Date(j.expires_at) < new Date() : false,
      days_until_expiry: j.expires_at ? Math.ceil((new Date(j.expires_at).getTime() - Date.now()) / 86400000) : null,
      applicants: (appsByJob[j.id] ?? []).map((a: any) => ({
        ...a,
        applicant_profile: profileByUser[a.applicant_id] ?? null,
      })),
      applicant_count: appsByJob[j.id]?.length ?? 0,
      applications_by_status: statusBuckets(appsByJob[j.id] ?? []),
      boosts: boostsByJob[j.id] ?? [],
      payments: paymentsByJob[j.id] ?? [],
      total_points_spent: (paymentsByJob[j.id] ?? []).reduce((n: number, p: any) => n + Number(p.points_spent || 0), 0),
    })),
  };
}

// Deep referral analytics — paid/unpaid, why not paid, leaderboard
async function agentAdminReferrals(supabase: any, params: any) {
  const limit = Math.min(500, Math.max(1, Number(params?.limit) || 100));
  const since = params?.since ? String(params.since) : new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

  const [referrals, commissions, withdrawals, refWallets] = await Promise.all([
    safeRows(supabase, 'user_referrals', '*', (q) => q.gte('created_at', since).order('created_at', { ascending: false }), limit),
    safeRows(supabase, 'referral_commissions', '*', (q) => q.gte('created_at', since).order('created_at', { ascending: false }), limit),
    safeRows(supabase, 'referral_withdrawal_requests', '*', (q) => q.gte('created_at', since).order('created_at', { ascending: false }), limit),
    safeRows(supabase, 'referral_wallets', '*', undefined, limit),
  ]);

  // Top referrers
  const byReferrer: Record<string, { referrals: number; commission_total: number; commission_paid: number; commission_pending: number }> = {};
  for (const r of referrals) {
    const k = r.referrer_id; if (!k) continue;
    byReferrer[k] ??= { referrals: 0, commission_total: 0, commission_paid: 0, commission_pending: 0 };
    byReferrer[k].referrals++;
  }
  for (const c of commissions) {
    const k = c.referrer_id; if (!k) continue;
    byReferrer[k] ??= { referrals: 0, commission_total: 0, commission_paid: 0, commission_pending: 0 };
    const amt = Number(c.commission_amount || 0);
    byReferrer[k].commission_total += amt;
    if (c.status === 'paid' || c.status === 'completed') byReferrer[k].commission_paid += amt;
    if (c.status === 'pending') byReferrer[k].commission_pending += amt;
  }
  const leaderboard = Object.entries(byReferrer).map(([user_id, v]) => ({ user_id, ...v }))
    .sort((a, b) => b.commission_total - a.commission_total).slice(0, 50);

  return {
    success: true,
    since,
    totals: {
      referrals: referrals.length,
      commissions: commissions.length,
      commissions_paid: commissions.filter((c: any) => c.status === 'paid' || c.status === 'completed').length,
      commissions_pending: commissions.filter((c: any) => c.status === 'pending').length,
      commissions_failed: commissions.filter((c: any) => c.status === 'failed' || c.status === 'rejected').length,
      total_amount_paid: commissions.filter((c: any) => c.status === 'paid' || c.status === 'completed').reduce((n: number, c: any) => n + Number(c.commission_amount || 0), 0),
      total_amount_pending: commissions.filter((c: any) => c.status === 'pending').reduce((n: number, c: any) => n + Number(c.commission_amount || 0), 0),
      withdrawals: withdrawals.length,
      withdrawals_by_status: statusBuckets(withdrawals),
      withdrawal_total_paid: withdrawals.filter((w: any) => w.status === 'paid' || w.status === 'completed').reduce((n: number, w: any) => n + Number(w.amount || 0), 0),
    },
    not_paid_reasons: commissions.filter((c: any) => c.status && c.status !== 'paid' && c.status !== 'completed')
      .reduce((acc: Record<string, number>, c: any) => { acc[c.status] = (acc[c.status] || 0) + 1; return acc; }, {}),
    withdrawal_failures: withdrawals.filter((w: any) => w.status === 'failed' || w.failure_reason).map((w: any) => ({ id: w.id, user_id: w.user_id, amount: w.amount, reason: w.failure_reason, at: w.created_at })),
    leaderboard,
    recent_referrals: referrals.slice(0, 50),
    recent_commissions: commissions.slice(0, 50),
    recent_withdrawals: withdrawals.slice(0, 50),
    wallets_summary: {
      users: refWallets.length,
      total_balance: refWallets.reduce((n: number, w: any) => n + Number(w.balance_amount || 0), 0),
      total_earned: refWallets.reduce((n: number, w: any) => n + Number(w.total_earned || 0), 0),
      total_withdrawn: refWallets.reduce((n: number, w: any) => n + Number(w.total_withdrawn || 0), 0),
    },
  };
}

// Daily new accounts + activity time-series
async function agentAdminDaily(supabase: any, params: any) {
  const days = Math.min(90, Math.max(1, Number(params?.days) || 30));
  const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

  const [profiles, companies, jobs, applications, payments, notifications] = await Promise.all([
    safeRows(supabase, 'profiles', 'user_id, created_at', (q) => q.gte('created_at', since), 10000),
    safeRows(supabase, 'companies', 'user_id, created_at', (q) => q.gte('created_at', since), 10000),
    safeRows(supabase, 'jobs', 'id, created_at', (q) => q.gte('created_at', since), 10000),
    safeRows(supabase, 'job_applications', 'id, created_at', (q) => q.gte('created_at', since), 10000),
    safeRows(supabase, 'job_payments', 'id, points_spent, created_at', (q) => q.gte('created_at', since), 10000),
    safeRows(supabase, 'unified_notification_logs', 'id, total_sent, total_failed, created_at', (q) => q.gte('created_at', since), 10000),
  ]);

  const dayKey = (d: any) => { try { return new Date(d).toISOString().slice(0, 10); } catch { return 'unknown'; } };
  const buckets: Record<string, any> = {};
  const ensure = (k: string) => (buckets[k] ??= { date: k, new_job_seekers: 0, new_employers: 0, new_jobs: 0, new_applications: 0, payments: 0, points_spent: 0, notifications_sent: 0, notifications_failed: 0 });

  for (const p of profiles) ensure(dayKey(p.created_at)).new_job_seekers++;
  for (const c of companies) ensure(dayKey(c.created_at)).new_employers++;
  for (const j of jobs) ensure(dayKey(j.created_at)).new_jobs++;
  for (const a of applications) ensure(dayKey(a.created_at)).new_applications++;
  for (const p of payments) { const b = ensure(dayKey(p.created_at)); b.payments++; b.points_spent += Number(p.points_spent || 0); }
  for (const n of notifications) { const b = ensure(dayKey(n.created_at)); b.notifications_sent += Number(n.total_sent || 0); b.notifications_failed += Number(n.total_failed || 0); }

  return {
    success: true,
    since,
    days,
    daily: Object.values(buckets).sort((a: any, b: any) => a.date.localeCompare(b.date)),
  };
}


// ─── PHASE 1: SENSE ─────────────────────────────────────────────────────────
async function agentSense(supabase: any) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const [eng, queue, fails, intel, variantPerf, recentRuns, platformIntel,
         pushPrefs, telegramProfiles, onesignalSessions, telegramConvs, profilesEmail] = await Promise.all([
    supabase.from('notification_engagement_events')
      .select('action, channel', { count: 'exact', head: false })
      .gte('occurred_at', since).limit(2000),
    supabase.from('notification_trigger_queue')
      .select('id, status', { count: 'exact', head: false })
      .in('status', ['pending', 'processing', 'failed']).limit(500),
    supabase.from('unified_notification_logs')
      .select('channel, status, error_message')
      .gte('created_at', since).eq('status', 'failed').limit(200),
    supabase.from('user_notification_intelligence')
      .select('user_id, overall_ctr, fatigue_score, recommended_daily_cap, best_channel', { count: 'exact', head: false })
      .order('overall_ctr', { ascending: false }).limit(1000),
    supabase.from('notification_variant_performance')
      .select('variant_id, channel, score, sent_count')
      .order('score', { ascending: false }).limit(20),
    supabase.from('ai_agent_runs')
      .select('id, status, started_at, errors_found')
      .gte('started_at', since24h).order('started_at', { ascending: false }).limit(10),
    agentAdminOverview(supabase).catch((e) => ({ success: false, error: String(e) })),
    // Per-user channel availability
    supabase.from('push_notification_preferences')
      .select('user_id, job_alerts, system_notifications').limit(10000),
    supabase.from('profiles')
      .select('user_id, telegram_chat_id, telegram_notifications_enabled, email').limit(10000),
    supabase.from('onesignal_sessions')
      .select('user_id, status, last_seen, notifications_clicked, notifications_sent').eq('status', 'active').limit(10000),
    supabase.from('telegram_conversations')
      .select('linked_user_id, is_active').eq('is_active', true).limit(10000),
    supabase.from('profiles').select('user_id, email').limit(10000),
  ]);

  // Aggregate engagement
  const channelStats: Record<string, { sent: number; opened: number; clicked: number }> = {};
  for (const e of (eng.data ?? [])) {
    const ch = String(e.channel || 'unknown');
    if (!channelStats[ch]) channelStats[ch] = { sent: 0, opened: 0, clicked: 0 };
    if (e.action === 'sent') channelStats[ch].sent++;
    else if (e.action === 'opened') channelStats[ch].opened++;
    else if (e.action === 'clicked') channelStats[ch].clicked++;
  }

  // Top error signatures
  const errorMap: Record<string, { count: number; sample: string; channels: Set<string> }> = {};
  for (const f of (fails.data ?? [])) {
    const sig = String(f.error_message || 'unknown').slice(0, 120).toLowerCase().replace(/[0-9a-f-]{8,}/g, '*');
    if (!errorMap[sig]) errorMap[sig] = { count: 0, sample: String(f.error_message || ''), channels: new Set() };
    errorMap[sig].count++;
    if (f.channel) errorMap[sig].channels.add(String(f.channel));
  }
  const topErrors = Object.entries(errorMap)
    .sort((a, b) => b[1].count - a[1].count).slice(0, 10)
    .map(([sig, v]) => ({ signature: sig, count: v.count, sample: v.sample, channels: [...v.channels] }));

  // ── Per-user channel reachability rollup
  const pushUsers = new Set<string>();
  for (const r of (pushPrefs.data ?? [])) {
    if (r.user_id && (r.job_alerts !== false || r.system_notifications !== false)) pushUsers.add(r.user_id);
  }
  for (const s of (onesignalSessions.data ?? [])) {
    if (s.user_id) pushUsers.add(s.user_id);
  }
  const telegramUsers = new Set<string>();
  for (const p of (telegramProfiles.data ?? [])) {
    if (p.user_id && p.telegram_chat_id && p.telegram_notifications_enabled !== false) telegramUsers.add(p.user_id);
  }
  for (const c of (telegramConvs.data ?? [])) {
    if (c.linked_user_id) telegramUsers.add(c.linked_user_id);
  }
  const emailUsers = new Set<string>();
  for (const p of (profilesEmail.data ?? [])) {
    if (p.user_id && p.email) emailUsers.add(p.user_id);
  }
  // Multi-channel intersection
  const allUsers = new Set<string>([...pushUsers, ...telegramUsers, ...emailUsers]);
  let pushAndTelegram = 0, pushOnly = 0, telegramOnly = 0, emailOnly = 0, multi3 = 0, unreachable = 0;
  for (const uid of allUsers) {
    const hasP = pushUsers.has(uid), hasT = telegramUsers.has(uid), hasE = emailUsers.has(uid);
    if (hasP && hasT && hasE) multi3++;
    if (hasP && hasT && !hasE) pushAndTelegram++;
    if (hasP && !hasT && !hasE) pushOnly++;
    if (!hasP && hasT && !hasE) telegramOnly++;
    if (!hasP && !hasT && hasE) emailOnly++;
  }
  // Top responders (highest CTR users)
  const topResponders = (intel.data ?? [])
    .filter((u: any) => Number(u.overall_ctr || 0) > 0)
    .slice(0, 20)
    .map((u: any) => ({ user_id: u.user_id, ctr: u.overall_ctr, best_channel: u.best_channel }));

  return {
    window: { since, until: new Date().toISOString() },
    engagement_last_hour: channelStats,
    queue_depth: queue.data?.length ?? 0,
    failed_messages: fails.data?.length ?? 0,
    top_errors: topErrors,
    smart_users_count: intel.data?.length ?? 0,
    top_variants: variantPerf.data ?? [],
    recent_runs_24h: recentRuns.data?.length ?? 0,
    platform_intelligence: platformIntel,
    channel_reachability: {
      push_enabled_users: pushUsers.size,
      telegram_connected_users: telegramUsers.size,
      email_reachable_users: emailUsers.size,
      multi_channel_3: multi3,
      push_and_telegram: pushAndTelegram,
      push_only: pushOnly,
      telegram_only: telegramOnly,
      email_only: emailOnly,
      total_addressable_users: allUsers.size,
    },
    top_responders: topResponders,
  };
}

// ─── PHASE 2 + 3: DIAGNOSE & PLAN ───────────────────────────────────────────
async function agentDiagnoseAndPlan(senseData: any): Promise<{ diagnosis: any; plan: any; aiModel: string }> {
  const system = `You are the autonomous growth agent for "Workly India" (${CANONICAL_DOMAIN}), a remote-jobs platform serving Indian job seekers and employers.

You receive a FULL 360° platform snapshot in sensor.platform_intelligence including:
- users.job_seekers + users.employers (total, complete_profiles, incomplete_profiles, active, inactive, new_24h, new_7d, daily_new_last_7d)
- jobs (total, by_status, new_24h/7d, expired, expiring_in_7_days, applications_total, applications_by_status, applications_24h)
- money (wallet balances, total points purchased/spent, job_payments_by_type)
- referrals (total, active, commissions paid/pending, withdrawals by status, recent_withdrawal_failures with reasons)
- interviews (total, by_status, with_actual_start, total_participants)
- activity (devices, vpn/bot flags, top_searches with counts)
- messaging (unified, push, telegram, email — sent/failed/top_errors per channel)
- channel_reachability — per-user channel availability rollup: push_enabled_users, telegram_connected_users, email_reachable_users, multi_channel_3, push_only, telegram_only, email_only, total_addressable_users
- top_responders — top 20 users by historical CTR with their best_channel (use these as priority audience)

Use this to produce TWO things in JSON:
1. diagnosis  — what is happening, what's broken, where engagement and supply are dropping
2. plan       — concrete actions for the next hour (audience, channels, themes)

CRITICAL BUSINESS PRIORITIES (in order):
A. SUPPLY GAP — if jobs.new_7d < 20 OR jobs.total_active < 30, TILT toward EMPLOYER activation but DO NOT set audience to "employer" only. ALWAYS prefer audience="both" so job seekers also get value (job alerts, profile nudges, referral). Use channel_mix and message_themes to weight ~60-70% employer + 30-40% seeker. Only pick audience="employer" or "job_seeker" exclusively if the OTHER pool is literally empty.
A2. AUDIENCE BALANCE — Default audience MUST be "both" unless one pool has 0 reachable users. Each run should send to BOTH job seekers AND employers so dual-role accounts (same email, 2 profiles) receive 2 separate messages — one per role.
B. PERSONALIZATION — use top_searches to write seeker messages ("Aapke liye 5 'data entry' jobs ready hain"). Never send generic blasts when search data exists.
C. CONVERSION — every CTA must be a deep link to a real page (/jobs, /post-job, /profile, /referrals, /wallet). Use cta_url accordingly.
D. RE-ENGAGEMENT — dormant_30d seekers + employers with 0 jobs posted are highest-leverage targets.
E. HEAL FIRST — if messaging.*.failed > 20 OR queue_depth > 100, shrink the plan and avoid the broken channel.
F. NO SPAM — respect 7-day per-theme cooldown (already enforced downstream); pick varied themes.
G. CHANNEL REACHABILITY — set channel_mix proportional to channel_reachability counts. If telegram_connected_users is small (<20% of total), do NOT make telegram > 0.15 of mix. Prefer push when push_enabled_users is large. Always include inapp as fallback for unreachable users.
H. RESPONDER PRIORITY — prefer top_responders.best_channel for high-CTR users. Spend more budget on users with proven engagement.
I. NEVER over-promise channels we cannot deliver — if channel_reachability.email_only is 0, don't waste budget on email.

Be brutally practical. Indian audience. Hinglish welcome.
Channels available: push, email, telegram, inapp.
Audiences: job_seeker, employer, both.

Output STRICT JSON shape:
{
  "diagnosis": {
    "headline": "...",
    "what_works": ["..."],
    "what_breaks": ["..."],
    "supply_gap": "none|moderate|critical",
    "engagement_trend": "rising|flat|falling",
    "biggest_risk": "..."
  },
  "plan": {
    "audience": "job_seeker|employer|both",
    "goal": "...",
    "rationale": "tie back to specific numbers from platform_intelligence",
    "target_segments": ["high_ctr_users", "fresh_signups", "dormant_30d", "employers_no_jobs", "incomplete_profiles"],
    "channel_mix": { "push": 0.6, "inapp": 0.25, "email": 0.1, "telegram": 0.05 },
    "recommended_daily_cap": 2,
    "message_themes": [
      { "theme": "employer_activation", "audience": "employer", "channel": "push", "language": "hinglish",
        "title": "Candidates ready hain!", "body": "189 active job seekers waiting. Free me job post karein.", "cta_text": "Post Job Free", "cta_url": "https://CANONICAL_DOMAIN/post-job" },
      { "theme": "data_entry_match", "audience": "job_seeker", "channel": "push", "language": "hinglish",
        "title": "5 Data Entry jobs aaye", "body": "Aapke search 'data entry' ke liye new jobs available. 1-click apply karein.", "cta_text": "Apply Now", "cta_url": "https://CANONICAL_DOMAIN/jobs?q=data+entry" }
    ],
    "expected_impact": "X new job posts, Y applications",
    "max_users_this_run": 500
  }
}

Rules:
- max_users_this_run between 50 and 1500
- Always include at least 1 message_theme. Max 4. Mix audiences when "both".
- Title <= 50 chars, body <= 140 chars, cta_text <= 22 chars
- cta_url MUST be a real ${CANONICAL_DOMAIN} deep link relevant to the theme`;

  const prompt = `SENSOR DATA (last 1 hour + full 360° platform snapshot):\n${JSON.stringify(senseData, null, 2)}\n\nProduce diagnosis + plan JSON now. Use platform_intelligence numbers explicitly in rationale.`;
  const raw = await agentCallAI(prompt, system, true);
  const parsed = safeParseJson(raw);
  return {
    diagnosis: parsed.diagnosis ?? { headline: "AI returned empty diagnosis", raw },
    plan: parsed.plan ?? { audience: 'both', goal: 'noop', message_themes: [], max_users_this_run: 0 },
    aiModel: 'gemini-2.5-flash (auto)',
  };
}

// ─── PHASE 4: EXECUTE ──────────────────────────────────────────────────────
function agentNormalizeChannels(theme: any, bestChannel?: string | null): string[] {
  const requested = [theme?.channel, bestChannel, 'push', 'inapp']
    .flatMap((c: any) => String(c || '').split(','))
    .map((c: string) => c.trim().toLowerCase())
    .filter(Boolean)
    .map((c: string) => c === 'in_app' ? 'inapp' : c);
  const allowed = new Set(['push', 'email', 'telegram', 'inapp']);
  return [...new Set(requested.filter((c) => allowed.has(c)))].slice(0, 3);
}

// Helper: detect dummy/zero UUIDs
function isDummyUserId(uid: string | null | undefined): boolean {
  if (!uid) return true;
  const s = String(uid).toLowerCase();
  return s === '00000000-0000-0000-0000-000000000000' || s.replace(/[-0]/g, '') === '';
}

async function agentExecute(supabase: any, plan: any, runId: string) {
  const actions: any[] = [];
  let messagesSent = 0;
  let messagesFailed = 0;
  let usersTargeted = 0;
  let messagesQueued = 0;

  const themes: any[] = Array.isArray(plan?.message_themes) ? plan.message_themes : [];
  const maxUsers = Math.min(1500, Math.max(0, Number(plan?.max_users_this_run) || 0));
  if (themes.length === 0 || maxUsers === 0) {
    actions.push({ kind: 'noop', reason: 'plan empty or max_users=0' });
    return { actions, messagesSent, messagesFailed, usersTargeted, messagesQueued };
  }

  const audience = String(plan?.audience || 'both');
  const segments: string[] = Array.isArray(plan?.target_segments) ? plan.target_segments.map((s: any) => String(s).toLowerCase()) : [];
  const channelMix: Record<string, number> = (plan?.channel_mix && typeof plan.channel_mix === 'object') ? plan.channel_mix : {};
  const recommendedDailyCap = Math.max(1, Math.min(5, Number(plan?.recommended_daily_cap) || 2));
  const perTheme = Math.max(1, Math.floor(maxUsers / themes.length));

  // ── FIX 1+5: Build candidate pool from intelligence + fallback to profiles/companies
  // ── FIX 8: Filter dummy UUIDs
  const intelMap = new Map<string, { best_channel: string | null; fatigue: number }>();
  try {
    const { data: intel } = await supabase
      .from('user_notification_intelligence')
      .select('user_id, best_channel, fatigue_score, overall_ctr')
      .lt('fatigue_score', 0.7)
      .order('overall_ctr', { ascending: false })
      .limit(maxUsers * 3);
    for (const c of (intel ?? [])) {
      if (isDummyUserId(c.user_id)) continue;
      intelMap.set(c.user_id, { best_channel: c.best_channel ?? null, fatigue: Number(c.fatigue_score ?? 0) });
    }
  } catch (e) {
    console.warn('[agent] intelligence query failed', e);
  }

  // Audience-based candidate pools (FIX 3: 'both' properly mixes)
  // IMPORTANT: same auth user can have BOTH a job-seeker profile AND an employer
  // (company) row. We treat each as a SEPARATE profile/target — so a person who
  // signed up as both will count as 2 in users_targeted and receive 2 messages
  // (one as seeker, one as employer). This matches the product rule that each
  // role is a distinct profile even if the underlying email/auth user is shared.
  type Profiled = { uid: string; role: 'seeker' | 'employer' };
  const seekerProfiles: Profiled[] = [];
  const employerProfiles: Profiled[] = [];
  const dormantCutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const freshCutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const wantDormant = segments.includes('dormant_30d');
  const wantFresh = segments.includes('fresh_signups');

  if (audience === 'job_seeker' || audience === 'both') {
    let q = supabase.from('profiles').select('user_id, created_at, updated_at').limit(maxUsers);
    if (wantFresh) q = q.gte('created_at', freshCutoff);
    else if (wantDormant) q = q.lte('updated_at', dormantCutoff);
    const { data } = await q;
    const seenSeeker = new Set<string>();
    for (const r of (data ?? [])) {
      if (!isDummyUserId(r.user_id) && !seenSeeker.has(r.user_id)) {
        seenSeeker.add(r.user_id);
        seekerProfiles.push({ uid: r.user_id, role: 'seeker' });
      }
    }
  }
  if (audience === 'employer' || audience === 'both') {
    let q = supabase.from('companies').select('user_id, created_at').limit(maxUsers);
    if (wantFresh) q = q.gte('created_at', freshCutoff);
    const { data } = await q;
    const seenEmployer = new Set<string>();
    for (const r of (data ?? [])) {
      if (r.user_id && !isDummyUserId(r.user_id) && !seenEmployer.has(r.user_id)) {
        seenEmployer.add(r.user_id);
        employerProfiles.push({ uid: r.user_id, role: 'employer' });
      }
    }
  }

  // Mix audiences for 'both' — interleave so both roles get fair share even
  // when one pool is much larger (prevents seekers swamping employers).
  let profilePool: Profiled[] = [];
  if (audience === 'both') {
    const half = Math.ceil(maxUsers / 2);
    const s = seekerProfiles.slice(0, half);
    const e = employerProfiles.slice(0, half);
    const len = Math.max(s.length, e.length);
    for (let i = 0; i < len; i++) {
      if (i < s.length) profilePool.push(s[i]);
      if (i < e.length) profilePool.push(e[i]);
    }
  } else if (audience === 'employer') {
    profilePool = employerProfiles;
  } else {
    profilePool = seekerProfiles;
  }

  // Sort: intelligence-known users first (by low fatigue), then unknown (cold).
  // Sort BY PROFILE (not uid) so seeker+employer of the same person are
  // ranked independently.
  profilePool.sort((a, b) => {
    const ai = intelMap.get(a.uid), bi = intelMap.get(b.uid);
    if (ai && !bi) return -1;
    if (!ai && bi) return 1;
    if (ai && bi) return ai.fatigue - bi.fatigue;
    return 0;
  });

  // Dedup BY (uid + role) — keeps both profiles of a dual-role user.
  {
    const seen = new Set<string>();
    profilePool = profilePool.filter((p) => {
      const k = `${p.role}:${p.uid}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).slice(0, maxUsers);
  }

  // Legacy `pool` (uids only) is still used by downstream queries that index
  // by user_id (cooldown / daily-cap lookups). Distinct uids only.
  let pool: string[] = [...new Set(profilePool.map((p) => p.uid))];

  // ── FIX 4: De-duplication — exclude users who got the same theme in last 7 days
  const themeKeys = themes.map((t: any) => String(t.theme || t.kind || 'generic').toLowerCase());
  const cooldownCutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const recentByUser = new Map<string, Set<string>>(); // key: `${role}:${uid}` -> set of recent theme sigs
  try {
    if (pool.length > 0) {
      const { data: recent } = await supabase
        .from('user_scheduled_notifications')
        .select('user_id, title, message, created_at')
        .in('user_id', pool.slice(0, 1000))
        .gte('created_at', cooldownCutoff)
        .eq('source', 'autonomous_growth_agent')
        .limit(5000);
      for (const r of (recent ?? [])) {
        const sig = String(r.title || '').toLowerCase().slice(0, 40);
        // Historical sends predate role-tagging — apply to both role keys conservatively
        for (const role of ['seeker', 'employer']) {
          const k = `${role}:${r.user_id}`;
          if (!recentByUser.has(k)) recentByUser.set(k, new Set());
          recentByUser.get(k)!.add(sig);
        }
      }
    }
  } catch (e) {
    console.warn('[agent] cooldown lookup failed', e);
  }

  // ── FIX 5: Daily cap — exclude users who already received >= cap notifications today
  const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0);
  const sentTodayByUser = new Map<string, number>();
  try {
    if (pool.length > 0) {
      const { data: today } = await supabase
        .from('user_scheduled_notifications')
        .select('user_id')
        .in('user_id', pool.slice(0, 1000))
        .gte('created_at', todayStart.toISOString())
        .limit(5000);
      for (const r of (today ?? [])) {
        sentTodayByUser.set(r.user_id, (sentTodayByUser.get(r.user_id) ?? 0) + 1);
      }
    }
  } catch (e) {
    console.warn('[agent] daily cap lookup failed', e);
  }

  // Profile-aware filter: cap is per-uid (a person), so dual-role users (seeker+employer)
  // share the daily cap. We still keep BOTH profiles in the eligible list — the cap
  // just limits how many pushes that human gets in 24h.
  const validProfiles = profilePool.filter((p) => (sentTodayByUser.get(p.uid) ?? 0) < recommendedDailyCap);
  const validUserIds = [...new Set(validProfiles.map((p) => p.uid))];
  const seekerCount = validProfiles.filter((p) => p.role === 'seeker').length;
  const employerCount = validProfiles.filter((p) => p.role === 'employer').length;
  // users_targeted = total profiles (seeker + employer counted separately)
  usersTargeted = validProfiles.length;
  actions.push({ kind: 'audience_breakdown', seekers: seekerCount, employers: employerCount, total_profiles: usersTargeted, distinct_humans: validUserIds.length });

  if (validProfiles.length === 0) {
    actions.push({ kind: 'noop', reason: 'no eligible users after caps/dedup', pool_size: profilePool.length });
    return { actions, messagesSent, messagesFailed, usersTargeted, messagesQueued };
  }

  // ── FIX 6: Auto-seed intelligence rows for unknown users
  const unseededIds = validUserIds.filter((uid) => !intelMap.has(uid)).slice(0, 500);
  if (unseededIds.length > 0) {
    try {
      await supabase.from('user_notification_intelligence').upsert(
        unseededIds.map((uid) => ({
          user_id: uid,
          fatigue_score: 0,
          overall_ctr: 0,
          recommended_daily_cap: 2,
        })),
        { onConflict: 'user_id', ignoreDuplicates: true },
      );
      actions.push({ kind: 'seeded_intelligence', count: unseededIds.length });
    } catch (e) {
      console.warn('[agent] seed intelligence failed', e);
    }
  }

  // ── FIX 7: Channel routing — respect plan.channel_mix weights
  const channelOrder = Object.entries(channelMix)
    .filter(([_, v]) => Number(v) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .map(([k]) => k.toLowerCase().replace('in_app', 'inapp'));

  // Distribute users across themes — apply per-theme dedup (FIX 4)
  for (let i = 0; i < themes.length; i++) {
    const theme = themes[i];
    const themeKey = themeKeys[i];
    const themeTitle = String(theme.title || 'Workly India').slice(0, 60);
    const themeSig = themeTitle.toLowerCase().slice(0, 40);

    // Filter out PROFILES whose uid+role saw this theme/title in last 7 days.
    // Dual-role users keep BOTH profile-rows independently — the seeker copy and
    // employer copy are different "audiences" and should not block each other.
    const eligibleProfiles = validProfiles.filter((p) => {
      const seen = recentByUser.get(`${p.role}:${p.uid}`);
      if (!seen) return true;
      return !seen.has(themeSig) && !seen.has(themeKey);
    });
    const sliceProfiles = eligibleProfiles.slice(i * perTheme, (i + 1) * perTheme);
    if (sliceProfiles.length === 0) {
      actions.push({ kind: 'theme_skipped', theme: theme.theme, reason: 'all users on cooldown' });
      continue;
    }

    // 🎨 Auto-generate a 1200×630 card image once per theme
    let themeImageUrl: string | null = null;
    try {
      const { data: imgData } = await supabase.functions.invoke('email-api', {
        body: {
          action: 'card_image',
          title: String(theme.title || 'Workly India').slice(0, 80),
          subtitle: String(theme.body || '').slice(0, 120),
          kind: String(theme.kind || theme.theme || 'generic'),
          accent: theme.accent,
          badge: theme.badge,
        },
      });
      if (imgData?.ok && imgData?.url) themeImageUrl = imgData.url;
    } catch (imgErr) {
      console.warn('[agent] card_image generation failed', imgErr);
    }

    const buttonText = String(theme.button_text || theme.cta_text || 'View').slice(0, 30);

    // FIX 7: prefer plan.channel_mix order, then per-user best_channel
    const themeChannelHint = channelOrder[0] || theme.channel || 'push';
    const themeAdjusted = { ...theme, channel: themeChannelHint };

    const rows = sliceProfiles.map((p) => {
      const userBest = intelMap.get(p.uid)?.best_channel ?? null;
      return {
        user_id: p.uid,
        channels: agentNormalizeChannels(themeAdjusted, userBest),
        title: themeTitle,
        message: String(theme.body || '').slice(0, 220),
        action_url: theme.cta_url || (p.role === 'employer' ? `${WEBSITE_DOMAIN}/employer-portal` : `${WEBSITE_DOMAIN}/jobs`),
        image_url: themeImageUrl,
        button_text: buttonText,
        scheduled_for: new Date().toISOString(),
        source: 'autonomous_growth_agent',
      };
    });

    const { error: queueErr } = await supabase.from('user_scheduled_notifications').insert(rows);
    if (queueErr) {
      messagesFailed += rows.length;
      actions.push({ kind: 'queue_failed', theme: theme.theme, error: queueErr.message, target_count: rows.length });
      continue;
    }
    messagesQueued += rows.length;

    // Mark these PROFILES as having received this theme (per uid+role).
    for (const p of sliceProfiles) {
      const k = `${p.role}:${p.uid}`;
      if (!recentByUser.has(k)) recentByUser.set(k, new Set());
      recentByUser.get(k)!.add(themeSig);
      sentTodayByUser.set(p.uid, (sentTodayByUser.get(p.uid) ?? 0) + 1);
    }

    actions.push({
      kind: 'queue_multichannel_batch',
      theme: theme.theme,
      channels: rows[0]?.channels || ['push', 'inapp'],
      channel_mix_used: channelOrder,
      target_count: sliceProfiles.length,
      target_seekers: sliceProfiles.filter((p) => p.role === 'seeker').length,
      target_employers: sliceProfiles.filter((p) => p.role === 'employer').length,
      image_url: themeImageUrl,
    });
  }

  if (messagesQueued > 0) {
    try {
      const { data, error } = await supabase.functions.invoke('email-api', {
        body: { action: 'dispatch_scheduled', limit: Math.min(100, messagesQueued) },
      });
      const processed = Number((data as any)?.processed || 0);
      const failed = Number((data as any)?.failed || 0);
      const success = Number((data as any)?.success || Math.max(0, processed - failed));
      messagesSent += success;
      messagesFailed += failed + (error ? messagesQueued : 0);
      actions.push({ kind: 'dispatch_scheduled', processed, success, failed, error: error?.message || null });
    } catch (e) {
      messagesFailed += messagesQueued;
      actions.push({ kind: 'dispatch_scheduled_failed', error: String((e as Error)?.message || e) });
    }
  }

  return { actions, messagesSent, messagesFailed, usersTargeted, messagesQueued };
}

// ─── PHASE 5: HEAL ─────────────────────────────────────────────────────────
async function agentHeal(supabase: any, senseData: any) {
  const fixes: any[] = [];
  let autoFixed = 0;

  // Fix 1: Failed queue rows older than 1h — mark as 'skipped'
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: stale, error: staleErr } = await supabase
    .from('notification_trigger_queue')
    .update({ status: 'skipped', error_message: 'auto-skip by autonomous-agent (stale failed)' })
    .eq('status', 'failed').lt('created_at', oneHourAgo)
    .select('id');
  if (!staleErr && stale && stale.length > 0) {
    fixes.push({ kind: 'queue_skip_stale_failed', count: stale.length });
    autoFixed += stale.length;
  }

  // Fix 2: Track top error signatures into ai_agent_health
  for (const err of (senseData.top_errors || [])) {
    if (err.count < 2) continue;
    const category =
      /timeout|network|fetch/i.test(err.sample) ? 'channel_failure' :
      /rate.?limit|429/i.test(err.sample) ? 'rate_limit' :
      /unauthor|401|403/i.test(err.sample) ? 'auth' :
      /not.?found|missing|null/i.test(err.sample) ? 'data' : 'unknown';

    const fixStrategy =
      category === 'rate_limit' ? 'retry' :
      category === 'channel_failure' ? 'fallback_channel' :
      category === 'data' ? 'skip' : 'escalate';

    const { data: existing } = await supabase
      .from('ai_agent_health').select('id, occurrence_count, fix_attempts').eq('error_signature', err.signature).maybeSingle();

    if (existing) {
      await supabase.from('ai_agent_health').update({
        last_seen_at: new Date().toISOString(),
        occurrence_count: (existing.occurrence_count || 0) + err.count,
        fix_attempts: (existing.fix_attempts || 0) + 1,
      }).eq('id', existing.id);
      fixes.push({ kind: 'health_update', signature: err.signature, strategy: fixStrategy });
    } else {
      await supabase.from('ai_agent_health').insert({
        error_signature: err.signature,
        error_category: category,
        source: err.channels?.[0] || 'unknown',
        occurrence_count: err.count,
        fix_strategy: fixStrategy,
        sample_payload: { sample: err.sample, channels: err.channels },
      });
      fixes.push({ kind: 'health_new', signature: err.signature, strategy: fixStrategy });
      autoFixed++;
    }
  }

  return { fixes, autoFixed };
}

// ─── PHASE 6: REPORT ───────────────────────────────────────────────────────
function buildMarkdownReport(sense: any, diagnosis: any, plan: any, exec: any, heal: any, durationMs: number): string {
  const themes = (plan?.message_themes || []).map((t: any, i: number) =>
    `   ${i + 1}. **${t.theme}** → ${t.channel} (${t.audience})\n      _${t.title}_\n      ${t.body}`
  ).join('\n');

  return `# 🤖 Autonomous Growth Agent — Run Report

**Duration:** ${durationMs}ms

## 🩺 Diagnosis
**${diagnosis?.headline || '—'}**
- Trend: ${diagnosis?.engagement_trend || '—'}
- Biggest risk: ${diagnosis?.biggest_risk || '—'}
- Works: ${(diagnosis?.what_works || []).join(', ') || '—'}
- Breaks: ${(diagnosis?.what_breaks || []).join(', ') || '—'}

## 📋 Plan
- **Audience:** ${plan?.audience}
- **Goal:** ${plan?.goal}
- **Rationale:** ${plan?.rationale || '—'}
- **Channel mix:** ${JSON.stringify(plan?.channel_mix || {})}
- **Expected impact:** ${plan?.expected_impact || '—'}
- **Themes (${(plan?.message_themes || []).length}):**
${themes || '   _none_'}

## ⚡ Execution
- Users targeted (profiles): **${exec.usersTargeted}**
${(() => {
  const bd = (exec.actions || []).find((a: any) => a.kind === 'audience_breakdown');
  if (!bd) return '';
  return `  - Job seekers: **${bd.seekers}**\n  - Employers: **${bd.employers}**\n  - Distinct humans: **${bd.distinct_humans}**\n`;
})()}- Messages sent: **${exec.messagesSent}**
- Messages failed: **${exec.messagesFailed}**
- Actions: ${exec.actions.length}

## 🔧 Self-Healing
- Errors auto-fixed: **${heal.autoFixed}**
- Fixes applied: ${heal.fixes.length}

## 📊 Sensors (last 1h)
- Queue depth: ${sense.queue_depth}
- Failed messages: ${sense.failed_messages}
- Smart users tracked: ${sense.smart_users_count}
- Top errors: ${(sense.top_errors || []).length}
`;
}

// ─── MAIN: agent_run ───────────────────────────────────────────────────────
async function agentRun(supabase: any, params: any) {
  // Check pause flag
  const { data: pauseRow } = await supabase
    .from('engagement_settings').select('setting_value').eq('setting_key', AGENT_PAUSE_KEY).maybeSingle();
  const isPaused = pauseRow?.setting_value === true || pauseRow?.setting_value === 'true';

  const triggerSource = String(params?.trigger_source || 'manual_ui');
  const isManual = triggerSource !== 'pg_cron';

  if (isPaused && !isManual) {
    return { success: true, paused: true, message: 'Agent is paused — skipped' };
  }

  const startedAt = new Date();
  const { data: run, error: runErr } = await supabase
    .from('ai_agent_runs').insert({
      run_type: isManual ? 'manual' : 'hourly',
      status: 'running', trigger_source: triggerSource,
      started_at: startedAt.toISOString(),
    }).select('id').single();
  if (runErr || !run) throw new Error(`Failed to create run: ${runErr?.message}`);
  const runId = run.id;

  try {
    // Phase 1
    const sense = await agentSense(supabase);

    // Phase 2 + 3
    let diagnosis: any = {}, plan: any = {}, aiModel = 'unknown';
    try {
      const dp = await agentDiagnoseAndPlan(sense);
      diagnosis = dp.diagnosis; plan = dp.plan; aiModel = dp.aiModel;
    } catch (e) {
      diagnosis = { headline: 'AI gateway failed — running heal-only mode', error: String(e) };
      plan = { audience: 'both', goal: 'heal_only', max_users_this_run: 0, message_themes: [] };
    }

    // Save plan
    if (plan?.message_themes?.length > 0) {
      await supabase.from('ai_agent_plans').insert({
        run_id: runId,
        audience: plan.audience || 'both',
        goal: plan.goal || 'auto',
        rationale: plan.rationale || null,
        target_segments: plan.target_segments || [],
        channel_mix: plan.channel_mix || {},
        message_themes: plan.message_themes || [],
        expected_impact: plan.expected_impact || null,
      });
    }

    // Phase 4
    const exec = await agentExecute(supabase, plan, runId);

    // Phase 5
    const heal = await agentHeal(supabase, sense);

    // Phase 6
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    const status = exec.messagesFailed > exec.messagesSent && exec.messagesSent === 0 ? 'partial' : 'success';
    const report = buildMarkdownReport(sense, diagnosis, plan, exec, heal, durationMs);

    await supabase.from('ai_agent_runs').update({
      status, finished_at: finishedAt.toISOString(), duration_ms: durationMs,
      ai_model: aiModel,
      sense_summary: sense, diagnosis, plan,
      actions_taken: exec.actions, errors_found: sense.top_errors,
      fixes_applied: heal.fixes,
      users_targeted: exec.usersTargeted,
      messages_sent: exec.messagesSent,
      messages_failed: exec.messagesFailed,
      errors_auto_fixed: heal.autoFixed,
      markdown_report: report,
    }).eq('id', runId);

    return {
      success: true, run_id: runId, status, duration_ms: durationMs,
      users_targeted: exec.usersTargeted,
      messages_sent: exec.messagesSent,
      messages_failed: exec.messagesFailed,
      errors_auto_fixed: heal.autoFixed,
      summary: diagnosis?.headline || '',
    };
  } catch (e) {
    const finishedAt = new Date();
    await supabase.from('ai_agent_runs').update({
      status: 'failed', finished_at: finishedAt.toISOString(),
      duration_ms: finishedAt.getTime() - startedAt.getTime(),
      error_message: String(e),
    }).eq('id', runId);
    return { success: false, run_id: runId, error: String(e) };
  }
}

async function agentGetRuns(supabase: any, params: any) {
  const limit = Math.min(100, Math.max(1, Number(params?.limit) || 20));
  const { data, error } = await supabase
    .from('ai_agent_runs')
    .select('id, run_type, status, trigger_source, started_at, finished_at, duration_ms, users_targeted, messages_sent, messages_failed, errors_auto_fixed, markdown_report, error_message')
    .order('started_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return { success: true, runs: data ?? [] };
}

async function agentGetHealth(supabase: any) {
  const { data, error } = await supabase
    .from('ai_agent_health')
    .select('*').order('last_seen_at', { ascending: false }).limit(50);
  if (error) throw error;
  return { success: true, health: data ?? [] };
}

async function agentGetPlans(supabase: any) {
  const { data, error } = await supabase
    .from('ai_agent_plans')
    .select('*').order('created_at', { ascending: false }).limit(20);
  if (error) throw error;
  return { success: true, plans: data ?? [] };
}

async function agentSetPaused(supabase: any, paused: boolean) {
  // Try update; if no row, insert.
  const { data: existing } = await supabase
    .from('engagement_settings').select('id').eq('setting_key', AGENT_PAUSE_KEY).maybeSingle();
  if (existing) {
    await supabase.from('engagement_settings').update({ setting_value: paused }).eq('setting_key', AGENT_PAUSE_KEY);
  } else {
    await supabase.from('engagement_settings').insert({ setting_key: AGENT_PAUSE_KEY, setting_value: paused });
  }
  return { success: true, paused };
}

async function agentStatus(supabase: any) {
  const { data: pauseRow } = await supabase
    .from('engagement_settings').select('setting_value').eq('setting_key', AGENT_PAUSE_KEY).maybeSingle();
  const { data: lastRun } = await supabase
    .from('ai_agent_runs').select('id, status, started_at, finished_at, messages_sent, errors_auto_fixed')
    .order('started_at', { ascending: false }).limit(1).maybeSingle();
  const { count: unresolvedHealth } = await supabase
    .from('ai_agent_health').select('id', { count: 'exact', head: true }).eq('resolved', false);
  return {
    success: true,
    paused: pauseRow?.setting_value === true || pauseRow?.setting_value === 'true',
    last_run: lastRun ?? null,
    unresolved_health_issues: unresolvedHealth ?? 0,
  };
}
