import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { BRAND_CONFIG } from '../_shared/brandConfig.ts';
// NOTE: We no longer import checkAiChatLimit/incrementAiChatUsage here.
// The shared brain (ai-career-chat) handles limit checking AND usage
// incrementing in exactly one place. Counting here would double-charge users.
import { callAiChatBrain } from '../_shared/aiChatBrain.ts';
import { buildUserDiagnosticSnapshot, fetchRecentPlatformErrors } from '../_shared/aiSupabaseInspector.ts';

function isGenerationRequest(message: string): 'image' | 'file' | null {
  const lower = message.toLowerCase().trim();
  const imageKeywords = [
    'generate image', 'create image', 'make image', 'image generate karo', 'photo generate karo',
    'image bana do', 'image bana de', 'photo bana do', 'photo bana de', 'logo bana do', 'logo bana de',
    'banner bana do', 'poster bana do', 'tasveer bana do', 'pic bana do'
  ];
  const fileKeywords = [
    'resume bana do', 'resume bana de', 'cv bana do', 'cv bana de', 'pdf bana do', 'pdf bana de',
    'biodata bana do', 'bio data bana do', 'resume create karo', 'resume generate karo',
    'create a resume', 'create a cv', 'generate pdf', 'generate a pdf', 'generate resume', 'generate cv',
    'file bana do', 'document bana do', 'report bana do'
  ];

  if (lower.split(/\s+/).length < 2) return null;
  if (imageKeywords.some((keyword) => lower.includes(keyword))) return 'image';
  if (fileKeywords.some((keyword) => lower.includes(keyword))) return 'file';
  return null;
}

function getWaitMessage(kind: 'image' | 'file', lang: 'hi' | 'en') {
  if (kind === 'image') {
    return lang === 'hi'
      ? '⏳ Image ban rahi hai... thoda wait kijiye, main ready hote hi yahin bhej dunga.'
      : '⏳ Creating your image... please wait, I will send it here as soon as it is ready.';
  }

  return lang === 'hi'
    ? '⏳ File/PDF ban rahi hai... thoda wait kijiye, main ready hote hi yahin bhej dunga.'
    : '⏳ Creating your file/PDF... please wait, I will send it here as soon as it is ready.';
}

function getLimitOnlyMessage(rawMessage: string | undefined, lang: 'hi' | 'en') {
  if (rawMessage && rawMessage.trim()) return rawMessage;
  return lang === 'hi'
    ? `🚫 Aapki AI limit khatam ho gayi hai. Naya plan lene ke liye visit karein: ${BRAND_CONFIG.domain}/ai-chat-plans`
    : `🚫 Your AI limit has been reached. Please upgrade here: ${BRAND_CONFIG.domain}/ai-chat-plans`;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Telegram AI System Prompt
const SYSTEM_PROMPT = `You are ${BRAND_CONFIG.name}'s AI Career Assistant on Telegram.

🎯 YOUR ROLE:
- Help users find remote/work-from-home jobs in India
- Answer questions about job search, career guidance
- Provide platform information and support
- Help users check their profile, applications, wallet balance
- Be friendly, helpful, and conversational

🇮🇳 LANGUAGE:
- Respond in Hindi/Hinglish if user writes in Hindi
- Respond in English if user writes in English
- Keep responses SHORT (under 200 words) - this is Telegram!

📱 TELEGRAM FORMATTING:
- Use emojis for visual appeal
- Use <b>bold</b> for emphasis
- Keep paragraphs short
- Use bullet points for lists
- Use HTML formatting (Telegram supports HTML)

💼 ${BRAND_CONFIG.name.toUpperCase()} INFO:
- India's #1 Workly India Job Portal
- 75,000+ Active Job Seekers
- 15,000+ Job Listings
- 2,000+ Verified Companies
- Website: ${BRAND_CONFIG.domain}
- WhatsApp: ${BRAND_CONFIG.phone}
- Email: ${BRAND_CONFIG.email}

🔐 USER DATA ACCESS:
When the user asks about their profile, applications, wallet balance, or account:
- You will receive their profile data below (if registered)
- ONLY share data that belongs to THIS user
- Never share other users' data
- If no profile found, guide them to register at ${BRAND_CONFIG.domain}

🔗 CONNECT CODE:
- If user hasn't linked their account, tell them to send their Connect Code
- Job Seekers: Profile → Edit Profile → Telegram Section (code: P-XXXXXX)
- Employers: Profile → Edit Profile → Telegram Section (code: E-XXXXXX)

🚨 IMPORTANT:
- Job seekers NEVER pay any fees
- If asked about suspicious job offers, warn about scams
- Guide users to website for job applications
- Be warm and supportive

Keep responses concise and actionable!`;

// Bot detection patterns
const BOT_PATTERNS = [
  /\b(automated|auto-?reply|do-?not-?reply|no-?reply)\b/i,
  /\b(otp|verification code|verify your|confirm your)\b/i,
  /\b(transaction|payment|credited|debited|₹\d+)\b/i,
  /\b(delivery|shipped|dispatched|order.*placed|tracking)\b/i,
  /\b(dear customer|dear user|dear valued)\b/i,
  /\b(unsubscribe|opt-?out|reply stop)\b/i,
  /\b(congratulations|you.*won|winner|lottery|prize)\b/i,
  /\b(free.*gift|claim.*now|hurry.*up)\b/i,
  /^\d{4,6}$/, // OTP codes
];

// Helper: Get user data by Telegram ID
async function getUserDataByTelegramId(supabase: any, telegramId: number): Promise<any> {
  try {
    console.log('🔍 Looking up user by telegram_id:', telegramId);
    
    const userData: any = { found: false, profile: null, company: null };

    // Find profile by telegram_id
    const { data: profile } = await supabase
      .from('profiles')
      .select(`user_id, full_name, email, phone, city, state, skills, experience_years, current_position, account_status, profile_completion_percentage`)
      .eq('telegram_id', telegramId)
      .limit(1)
      .maybeSingle();

    if (profile) {
      userData.found = true;
      userData.profile = { ...profile, email: profile.email ? profile.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : null };

      // Get applications count
      const { count: applicationsCount } = await supabase
        .from('job_applications')
        .select('id', { count: 'exact', head: true })
        .eq('applicant_id', profile.user_id);
      userData.applications_count = applicationsCount || 0;

      // Get referral wallet
      const { data: referralWallet } = await supabase
        .from('referral_wallets')
        .select('balance_amount, total_earned, total_withdrawn')
        .eq('user_id', profile.user_id)
        .maybeSingle();
      userData.referral_wallet = referralWallet || { balance_amount: 0, total_earned: 0, total_withdrawn: 0 };

      // Recent applications
      const { data: recentApps } = await supabase
        .from('job_applications')
        .select(`status, applied_at, jobs:job_id (title, company_name)`)
        .eq('applicant_id', profile.user_id)
        .order('applied_at', { ascending: false })
        .limit(5);
      userData.recent_applications = recentApps || [];
    }

    // Find company by telegram_id
    const { data: company } = await supabase
      .from('companies')
      .select(`user_id, company_name, email, phone, city, state, industry, is_verified, account_status`)
      .eq('telegram_id', telegramId)
      .limit(1)
      .maybeSingle();

    if (company) {
      userData.found = true;
      userData.company = { ...company, email: company.email ? company.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : null };

      const { count: activeJobsCount } = await supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('employer_id', company.user_id)
        .eq('status', 'active');
      userData.active_jobs_count = activeJobsCount || 0;

    }

    console.log('📊 User data lookup:', { found: userData.found, hasProfile: !!userData.profile, hasCompany: !!userData.company });
    return userData;
  } catch (error) {
    console.error('Error in getUserDataByTelegramId:', error);
    return { found: false, error: 'Failed to lookup user data' };
  }
}

// Send Telegram message
async function sendTelegramMessage(botToken: string, chatId: number, text: string): Promise<boolean> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'HTML' })
    });
    const result = await response.json();
    if (!result.ok) {
      console.error('❌ Telegram send error:', result.description);
      return false;
    }
    return true;
  } catch (error) {
    console.error('❌ Telegram send exception:', error);
    return false;
  }
}

// Send a photo (image generated by the AI brain)
async function sendTelegramPhoto(botToken: string, chatId: number, photoUrl: string, caption?: string): Promise<boolean> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        photo: photoUrl,
        caption: caption?.slice(0, 1024), // Telegram caption max 1024 chars
        parse_mode: 'HTML',
      }),
    });
    const result = await response.json();
    if (!result.ok) {
      console.error('❌ Telegram sendPhoto error:', result.description);
      return false;
    }
    return true;
  } catch (e) {
    console.error('❌ Telegram sendPhoto exception:', e);
    return false;
  }
}

// Send a document (PDF / file generated by the AI brain)
async function sendTelegramDocument(botToken: string, chatId: number, docUrl: string, caption?: string): Promise<boolean> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        document: docUrl,
        caption: caption?.slice(0, 1024),
        parse_mode: 'HTML',
      }),
    });
    const result = await response.json();
    if (!result.ok) {
      console.error('❌ Telegram sendDocument error:', result.description);
      return false;
    }
    return true;
  } catch (e) {
    console.error('❌ Telegram sendDocument exception:', e);
    return false;
  }
}

// Detect language
function detectLanguage(text: string): 'hi' | 'en' {
  const hindiPattern = /[\u0900-\u097F]|kya|hai|hain|kaise|kab|kahan|naukri|chahiye|karni|karna|mujhe|mera|mere|kuch|batao|bolo/i;
  return hindiPattern.test(text) ? 'hi' : 'en';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { chat_id, username, message_text, message_id, first_name } = await req.json();

    console.log('🤖 AI Telegram Reply Request:', { chat_id, username, messageLength: message_text?.length });

    if (!chat_id || !message_text) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing chat_id or message_text' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');

    if (!TELEGRAM_BOT_TOKEN) {
      console.error('❌ TELEGRAM_BOT_TOKEN not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Bot token not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Bot detection - skip automated messages
    const isBotMessage = BOT_PATTERNS.some(pattern => pattern.test(message_text));
    if (isBotMessage) {
      console.log('🤖 Bot message detected, skipping AI reply');
      return new Response(
        JSON.stringify({ success: false, error: 'Bot message detected', reason: 'bot_message' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting - max 3 AI replies per minute per chat
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    const { data: recentMessages } = await supabase
      .from('telegram_messages')
      .select('id')
      .eq('chat_id', chat_id)
      .eq('direction', 'outgoing')
      .gte('sent_at', oneMinuteAgo);

    if (recentMessages && recentMessages.length >= 3) {
      console.log('⏹️ Rate limit reached for chat:', chat_id);
      return new Response(
        JSON.stringify({ success: false, error: 'Rate limit reached', reason: 'rate_limit' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lang = detectLanguage(message_text);
    const generationKind = isGenerationRequest(message_text);

    // Get user data by telegram_id (chat_id equals telegram user id in private chats)
    const userData = await getUserDataByTelegramId(supabase, chat_id);

    // Matched-user is needed below for diagnostic injection + logs
    const matchedUserId =
      userData.profile?.user_id || userData.company?.user_id || null;

    // Build user context (passed to the shared brain so AI knows who's writing)
    let userContext = '';
    if (userData.found) {
      userContext = '📋 USER DATA (for this Telegram user ONLY):';

      if (userData.profile) {
        userContext += `\n\n👤 Job Seeker Profile:
- Name: ${userData.profile.full_name || 'Not set'}
- Location: ${userData.profile.city || ''} ${userData.profile.state || ''}
- Experience: ${userData.profile.experience_years || 0} years
- Current Position: ${userData.profile.current_position || 'Not set'}
- Skills: ${userData.profile.skills?.slice(0, 5).join(', ') || 'Not set'}
- Profile Completion: ${userData.profile.profile_completion_percentage || 0}%

💼 Applications: ${userData.applications_count || 0} total
🎁 Referral Wallet: ₹${userData.referral_wallet?.balance_amount || 0}`;

        if (userData.recent_applications?.length > 0) {
          userContext += '\n\n📝 Recent Applications:';
          userData.recent_applications.forEach((app: any, idx: number) => {
            userContext += `\n${idx + 1}. ${app.jobs?.title || 'Job'} at ${app.jobs?.company_name || 'Company'} - ${app.status}`;
          });
        }
      }

      if (userData.company) {
        userContext += `\n\n🏢 Employer Profile:
- Company: ${userData.company.company_name}
- Industry: ${userData.company.industry || 'Not set'}
- Location: ${userData.company.city || ''} ${userData.company.state || ''}
- Verified: ${userData.company.is_verified ? 'Yes' : 'No'}
- Active Jobs: ${userData.active_jobs_count || 0}`;
      }
    } else {
      userContext = '📋 USER NOT LINKED: This Telegram user has not linked their account yet. Guide them to send their Connect Code (P-XXXXXX or E-XXXXXX) to link their account. They can find it in Profile → Edit Profile → Telegram Section on ' + BRAND_CONFIG.domain;
    }

    // 🔍 Deep Supabase diagnostic snapshot (so AI can debug user issues intelligently)
    try {
      const diag = await buildUserDiagnosticSnapshot(supabase, matchedUserId, {
        channel: 'telegram',
        identifier: String(chat_id),
      });
      const platformHealth = diag.hasIssues ? await fetchRecentPlatformErrors(supabase) : '';
      userContext += `\n\n🔍 SUPABASE DIAGNOSTIC (use this to give precise, helpful answers):\n${diag.summary}`;
      if (platformHealth) userContext += `\n\n${platformHealth}`;
      console.log('🩺 Diagnostic injected. issues:', diag.issueHints);
    } catch (diagErr) {
      console.warn('⚠️ Diagnostic snapshot failed:', diagErr);
    }

    // ============================================================
    // 🧠 Delegate to the SHARED AI BRAIN (ai-career-chat).
    //
    // This single call gives Telegram the SAME capabilities as the
    // in-app AI Chat page: image generation, PDF generation, web
    // search, profile lookups, etc. It also enforces and increments
    // the user's monthly AI Chat quota EXACTLY ONCE — Telegram does
    // not need (and must not) call any limit / increment helpers.
    // ============================================================
    console.log('🧠 Calling shared AI brain (ai-career-chat) ...');

    if (generationKind) {
      await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chat_id, getWaitMessage(generationKind, lang));
    }

    const userLabel = first_name || username || 'Unknown';
    const brain = await callAiChatBrain({
      userMessage: `User: ${userLabel}\n\nMessage: ${message_text}`,
      userId: matchedUserId,
      channel: 'telegram',
      language: lang,
      extraContext: userContext,
      timeoutMs: 150_000, // image generation can take 30-60s; give plenty of buffer
    });

    // Limit reached → send the upgrade message and stop.
    if (brain.limitReached) {
      const upgradeMsg = getLimitOnlyMessage(brain.limitInfo?.message, lang);
      await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chat_id, upgradeMsg);
      try {
        const { data: conversation } = await supabase
          .from('telegram_conversations')
          .select('id')
          .eq('chat_id', chat_id)
          .maybeSingle();
        if (conversation) {
          await supabase.from('telegram_messages').insert({
            conversation_id: conversation.id,
            chat_id: chat_id,
            direction: 'outgoing',
            message_content: upgradeMsg,
            message_type: 'text',
            status: 'sent',
            sent_at: new Date().toISOString(),
            metadata: { ai_model: 'limit_reached', plan: brain.limitInfo?.plan },
          });
        }
      } catch (logErr) {
        console.error('⚠️ Failed to log upgrade nudge:', logErr);
      }
      return new Response(
        JSON.stringify({ success: false, error: 'AI chat limit reached', reason: 'usage_limit', plan: brain.limitInfo?.plan }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Brain failed entirely → send a friendly fallback so the user isn't ghosted.
    let aiResponse = brain.text;
    let usedModel = 'shared-brain';
    let sent = false;

    if (!aiResponse && brain.images.length === 0 && brain.files.length === 0) {
      console.error('❌ Shared brain returned no content. Error:', brain.error);
      aiResponse = lang === 'hi'
        ? `🙏 <b>Namaste ${first_name || ''}!</b>\n\nAbhi humara AI assistant busy hai. Aap yahan se madad le sakte hain:\n\n🌐 Website: ${BRAND_CONFIG.domain}\n📞 WhatsApp: ${BRAND_CONFIG.phone}\n📧 Email: ${BRAND_CONFIG.email}\n\nHum jaldi jawab denge! 🙏`
        : `🙏 <b>Hello ${first_name || ''}!</b>\n\nOur AI assistant is currently busy. You can reach us at:\n\n🌐 Website: ${BRAND_CONFIG.domain}\n📞 WhatsApp: ${BRAND_CONFIG.phone}\n📧 Email: ${BRAND_CONFIG.email}\n\nWe'll get back to you soon! 🙏`;
      usedModel = 'fallback';
      sent = await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chat_id, aiResponse);
    } else {
      // Send the text reply first (if any)
      if (aiResponse && aiResponse.trim()) {
        sent = await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chat_id, aiResponse);
      } else {
        sent = true; // images-only reply is still a success
      }

      // Then send any images the AI generated as native photo attachments.
      for (const imageUrl of brain.images) {
        const photoSent = await sendTelegramPhoto(TELEGRAM_BOT_TOKEN, chat_id, imageUrl);
        if (!photoSent) {
          // If sendPhoto fails (e.g. URL not reachable), fall back to a plain text link.
          await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chat_id, `🖼️ ${imageUrl}`);
        }
      }

      // Then send any files (PDFs etc.) as native document attachments.
      for (const fileUrl of brain.files) {
        const docSent = await sendTelegramDocument(TELEGRAM_BOT_TOKEN, chat_id, fileUrl);
        if (!docSent) {
          await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chat_id, `📎 ${fileUrl}`);
        }
      }
    }

    if (sent) {
      console.log(`✅ AI reply delivered. text=${(aiResponse || '').length} chars, images=${brain.images.length}, files=${brain.files.length}`);
    } else {
      console.error('❌ Failed to send AI reply to chat:', chat_id);
    }
    // ⚠️ Note: We intentionally do NOT call incrementAiChatUsage here.
    // The shared brain (ai-career-chat) already incremented the user's
    // monthly quota exactly once. Counting again would double-charge.

    // Log the AI reply in telegram_messages
    try {
      // Find conversation for this chat
      const { data: conversation } = await supabase
        .from('telegram_conversations')
        .select('id')
        .eq('chat_id', chat_id)
        .maybeSingle();

      if (conversation) {
        await supabase.from('telegram_messages').insert({
          conversation_id: conversation.id,
          chat_id: chat_id,
          direction: 'outgoing',
          message_content: aiResponse,
          message_type: 'text',
          status: sent ? 'sent' : 'failed',
          sent_at: new Date().toISOString(),
          metadata: { ai_model: usedModel, response_time_ms: Date.now() - startTime }
        });
      }
    } catch (logError) {
      console.error('⚠️ Failed to log AI reply:', logError);
    }

    // Log AI data access
    try {
      await supabase.from('ai_data_access_logs').insert({
        ai_type: 'telegram_ai',
        access_type: 'all',
        user_identifier: String(chat_id),
        matched_user_id: userData.profile?.user_id || userData.company?.user_id || null,
        matched_user_name: userData.profile?.full_name || userData.company?.company_name || null,
        matched_user_type: userData.profile && userData.company ? 'both' : userData.profile ? 'website_user' : userData.company ? 'employer' : null,
        data_accessed: { has_profile: !!userData.profile, has_company: !!userData.company },
        request_metadata: { source: 'telegram_ai', username },
        response_time_ms: Date.now() - startTime
      });
    } catch (accessLogError) {
      console.error('⚠️ Failed to log AI data access:', accessLogError);
    }

    const responseTime = Date.now() - startTime;
    return new Response(
      JSON.stringify({ success: true, sent, model: usedModel, response_time_ms: responseTime }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ AI Telegram Reply error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
