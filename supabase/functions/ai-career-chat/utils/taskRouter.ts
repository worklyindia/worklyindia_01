import { ACTION_FALLBACK_CHAIN, FALLBACK_CHAIN } from '../config/models.ts';
import { selectBestModel } from './modelSelector.ts';

interface Message {
  role: string;
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

export type ChatTaskType =
  | 'greeting'
  | 'profile_audit'
  | 'personal_lookup'
  | 'job_search'
  | 'web_search'
  | 'youtube_search'
  | 'mailbox'
  | 'youtube_seo'
  | 'youtube_analytics'
  | 'image_generation'
  | 'document_generation'
  | 'delivery'
  | 'profile_update'
  | 'vision_analysis'
  | 'general_chat';

export interface TaskRouting {
  taskType: ChatTaskType;
  enableTools: boolean;
  primaryModel: string;
  fallbackChain: string[];
  /**
   * Optional whitelist of tool names. When set, the edge function should
   * filter the global `allTools` array down to just these tool names so the
   * model can only call a safe, task-relevant subset.
   * If null/undefined, all tools (subject to admin filtering) are exposed.
   */
  toolSubset?: string[] | null;
  /**
   * Server-emitted opener status text (shown immediately above the typing
   * dots so the user always sees activity, even before the model starts
   * streaming). Localized in Hinglish to match the assistant persona.
   */
  openerStatus?: string;
  /**
   * When true, set tool_choice='required' on the AI gateway call so the
   * model MUST emit tool_calls instead of free-text. Used for explicit
   * action tasks (delivery / image_generation / document_generation /
   * personal_lookup) where a bare text reply would be wrong and also
   * triggers an expensive redundant streaming retry.
   */
  forceTools?: boolean;
}

// Read-only profile tool subset — used for personal lookups and profile
// audits. The model can read user data but cannot send emails, generate
// images, update profile, etc. Always include the meta tools so the model
// can still emit live status / progress messages.
export const PROFILE_READ_TOOLS = [
  'set_status',
  'send_progress_message',
  'get_user_profile',
  'get_user_management_data',
  'get_wallet_balance',
  'view_wallet_transactions',
  'get_user_applications',
  'get_contact_information',
  'get_platform_info',
];

function extractText(content: Message['content']): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const textPart = content.find((part) => part.type === 'text');
    return textPart?.text || '';
  }
  return '';
}

function hasDocumentHints(messages: Message[]): boolean {
  return messages.slice(-4).some((message) => {
    const text = extractText(message.content).toLowerCase();
    return /attached document|extracted content|resume\.pdf|\.pdf|cv\b|document\b/.test(text);
  });
}

function classifyTask(
  latestMessage: string,
  hasImages: boolean,
  hasDocs: boolean,
  recentContext: string = '',
): ChatTaskType {
  const text = latestMessage.toLowerCase().trim();

  if (hasImages) return 'vision_analysis';

  // Profile-field nouns covering English, Hinglish, and Hindi script.
  // IMPORTANT: keep this in sync with the field list accepted by
  // update_user_profile / update_company_profile.
  const PROFILE_NOUN_RE = /\b(profile|resume|cv|account|email|mail|phone|mobile|number|whatsapp|wa\s*number|location|address|city|state|country|pincode|postal|skill|skills|bio|about|summary|name|naam|full\s*name|first\s*name|last\s*name|birthday|birth\s*date|dob|date\s*of\s*birth|gender|language|languages|education|qualification|experience|years?|current\s*position|designation|role|company|industry|job\s*type|preferred\s*location|telegram|instagram|insta|facebook|fb|youtube|yt|linkedin|social|link|links|founder|website|gst|pan|cin|msme|logo|description|mission|vision)\b|प्रोफाइल|ईमेल|फोन|व्हाट्सऐप|व्हाट्सएप|पता|शहर|स्किल|बायो|नाम|जन्म|उम्र|भाषा|अनुभव|कंपनी|टेलीग्राम|इंस्टाग्राम|फेसबुक|यूट्यूब|लिंक्डइन/;

  // Update verbs covering English, Hinglish, and Hindi script.
  const UPDATE_VERB_RE = /\b(update|edit|change|modify|set|add|remove|delete|clear|hata|hatao|hata\s*do|likh|likho|likh\s*do|likhdo|likhna|naya\s*likho|likhna\s*hai|fill|enter|put|save|store|kar\s*de|kar\s*do|karna|karo|kr\s*de|kr\s*do)\b|अपडेट|बदल|बदलो|बदलना|जोड़|जोड़ो|हटा|हटाओ|डाल|डालो|लिख|लिखो|सेव|बना|बनाओ/;

  // Detect short follow-up confirmations like "ok kar de", "haan update", "yes go ahead",
  // "kar de update", "ho jaye", "chalu karo" — these only count as profile_update when the
  // recent assistant context shows we were in the middle of a profile update flow.
  const SHORT_CONFIRM_RE = /^(ok(ay)?|haan|han|yes|yup|sahi|sure|theek\s*hai|thik\s*hai|chalo|chalu|go\s*ahead|kar\s*de|kar\s*do|kr\s*de|kr\s*do|update|do\s*it|please\s*do|haan\s*kar\s*de|ok\s*kar\s*de\s*update|haan\s*update\s*karo|yes\s*update)\b[\s\S]{0,40}$/;
  const recentLower = (recentContext || '').toLowerCase();
  const recentlyDiscussedProfileUpdate =
    PROFILE_NOUN_RE.test(recentLower) &&
    /\b(update|change|edit|set|add|remove|delete|naya|new|likh|bio|profile)\b/.test(recentLower);

  // Greeting check — but DON'T short-circuit if this is a confirmation
  // continuing an in-flight profile update.
  const isGreeting = /^(hi|hello|hey|hii|hlo|namaste|good morning|good night|thanks|thank you|ok|okay|haan|han|yes|yo)\b/.test(text) && text.length <= 40;
  if (isGreeting && !(SHORT_CONFIRM_RE.test(text) && recentlyDiscussedProfileUpdate)) {
    return 'greeting';
  }

  // ── MAILBOX / GMAIL intent.
  // MUST run before YouTube/job/web detection: phrases like
  // "Meri Gmail check kare jio payment bank statement search de" contain
  // "search"/"dhundh" and used to be hijacked by public YouTube search.
  const MAILBOX_STRONG_RE = /\b(gmail|g\s*mail|inbox|mailbox|mail\s*box)\b|जीमेल|इनबॉक्स/;
  const MAILBOX_WEAK_RE = /\b(email|e-?mail|mail|mails|emails)\b|ईमेल|मेल/;
  const MAILBOX_ACTION_RE = /\b(check|dekh|dekho|dekhe|padh|padho|read|unread|search|dhundh|dhoondh|reply|replies|jawab|jvab|draft|forward|summary|summarize|thread|conversation|attachment|latest|naya|new|aaye|aaya|kitne)\b|चेक|देख|पढ़|जवाब|खोज/;
  const MAILBOX_DELIVERY_RE = /\b(mere|mera|meri|my)\s*(email|e-?mail|mail|gmail)\s*(pe|par|pr|me|mein|on|id)\b/;
  const recentWasMailbox = /\b(gmail|inbox|mailbox|sender|subject|unread|email|mail)\b|ईमेल|जीमेल|मेल/.test(recentLower);
  const SHORT_MAIL_FOLLOWUP_RE = /^(pdf|image|photo|link|attachment|file|reply|jawab|draft|next|iska|isko|is\s*email|usko|conversation|thread|puri|pura)\b[\s\S]{0,60}$/;
  const BARE_NUMBER_SELECTION_RE = /^(?:(?:email|mail)\s*)?(?:no\.?|number|num|#)?\s*([0-9]{1,2})\s*(?:number|no\.?|wala|vala|wali|ka|ko|batao|bataw|dikhao|dekho|please|plz)?[\s.!]*$/;
  const MAIL_NUMBER_FOLLOWUP_RE =
    text.length <= 60 && /\b[0-9]{1,2}\b/.test(text) &&
    /\b(email|mail|no\.?|number|num|wala|vala|wali|wale|ka|ko|batao|bataw|dikhao|dekho)\b/.test(text);
  const mentionsYouTubeHard = /\b(youtube|yt|video|channel|shorts?)\b|यूट्यूब|चैनल|वीडियो/.test(text);
  const isMailbox =
    !MAILBOX_DELIVERY_RE.test(text) &&
    (MAILBOX_STRONG_RE.test(text) ||
      (MAILBOX_WEAK_RE.test(text) && MAILBOX_ACTION_RE.test(text)) ||
      (recentWasMailbox && (SHORT_MAIL_FOLLOWUP_RE.test(text) || BARE_NUMBER_SELECTION_RE.test(text) || MAIL_NUMBER_FOLLOWUP_RE)));
  if (isMailbox && !mentionsYouTubeHard) {
    return 'mailbox';
  }

  const isProfileAudit = [
    /\b(profile check|check my profile|profile review|profile complete|profile sahi|profile a to z|review my profile)\b/,
    /\b(meri profile check|mera profile check|profile dekho|profile mein kya|profile sab sahi)\b/,
    /\b(?:meri|mera|my)?\s*(?:job\s*seeker|job\s*seekers|candidate)?\s*profile\s*(?:a\s*(?:se|to)\s*z|full|complete|sab|detail|details|pura|poora|check)\b/,
    /\b(मेरा प्रोफाइल चेक|मेरी प्रोफाइल चेक|प्रोफाइल चेक|प्रोफाइल रिव्यू|प्रोफाइल में क्या)\b/
  ].some((pattern) => pattern.test(text));
  if (isProfileAudit && !/\b(update|edit|change|modify|अपडेट|बदल)\b/.test(text)) {
    return 'profile_audit';
  }

  // Connected-channel analytics must beat the broad profile-update detector.
  // Phrases such as "YouTube connect kiya" and "video analytics check karo"
  // contain words that otherwise look like profile edits (connect/check/video).
  const hasOwnChannelMarker = /\b(my|mine|mera|meri|mere|apna|apni|hamara|humara|connected|connect kiya|connect ki|mere channel|meri channel)\b|मेरा|मेरी|अपने|हमारा/.test(text);
  const hasYouTubeSubject = /\b(youtube|yt|channel|chanel|video|videos|vidio|short|shorts|subscriber|subscribers|views|analytics|performance|growth|grow|watch\s*time|retention|ctr|impression|comment|comments|last\s*video|latest\s*video)\b|यूट्यूब|चैनल|वीडियो|एनालिटिक्स/.test(text);
  // ── YouTube SEO / metadata work on the user's OWN videos.
  // MUST beat both youtube_analytics and public youtube_search: the user asked
  // us to fix their video's title/description/tags, not to discover videos.
  const SEO_RE = /\b(seo|title|titel|description|discription|tag|tags|hashtag|hashtags|thumbnail\s*text|metadata|meta|keyword|keywords|optimi[sz]e|rank)\b|एसईओ|टाइटल|डिस्क्रिप्शन|टैग|हैशटैग|कीवर्ड/;
  const isYouTubeSeo = SEO_RE.test(text) && hasYouTubeSubject;

  // Short follow-up selection after we listed the user's videos and asked for a
  // number ("2", "video 4", "4 kar do", "chautha"). Without this the bare number
  // fell through to public YouTube search and wasted the user's turn.
  const isBareSelection = /^(?:video\s*)?(?:no\.?|number|num|#)?\s*([0-9]{1,2})\s*(?:number|no\.?|wala|vala|ka|ko|kar\s*do|kar\s*de|karo|please|plz)?[\s.!]*$/.test(text);
  const recentAskedVideoNumber =
    /\b(number bata|number batao|kaun se video|kaun sa video|konsa video|inmein se|in me se|which video|video ka seo|seo update|seo pack)\b|कौन से वीडियो|नंबर बता|एसईओ/.test(recentContext.toLowerCase()) &&
    /\b(youtube|yt|video|channel|shorts?|seo)\b|यूट्यूब|चैनल|वीडियो|एसईओ/.test(recentContext.toLowerCase());
  const recentWasOwnVideoList =
    /\b(list|videos|video)\b/.test(recentContext.toLowerCase()) &&
    /\b(seo|update|channel)\b/.test(recentContext.toLowerCase());

  if (isYouTubeSeo || (isBareSelection && (recentAskedVideoNumber || recentWasOwnVideoList))) {
    return 'youtube_seo';
  }

  const isOwnYouTubeAnalytics = hasOwnChannelMarker && hasYouTubeSubject;
  if (isOwnYouTubeAnalytics) return 'youtube_analytics';

  const isPersonalLookup = [
    /\b(my email|my phone|my whatsapp|my location|my skills|my experience)\b/,
    /\b(my wallet|wallet balance|current balance|my balance|my points|my referral wallet)\b/,
    /\b(mera email|meri email|mera phone|mera whatsapp|mera number|meri skills|mera skill|mera location)\b/,
    /\b(mera wallet|meri wallet|wallet balance|mera balance|mere points|wallet mein kitna|wallet me kitna|referral wallet)\b/,
    /\b(मेरा ईमेल|मेरा फोन|मेरा व्हाट्सऐप|मेरी स्किल|मेरा लोकेशन|मेरा वॉलेट|वॉलेट बैलेंस|मेरा बैलेंस|मेरे पॉइंट्स)\b/
  ].some((pattern) => pattern.test(text));
  if (isPersonalLookup) return 'personal_lookup';

  // Check profile_update BEFORE delivery so messages like
  // "telegram username set karo @rahul" / "email update karo to x@y.com"
  // are correctly classified as a profile edit instead of a send action.
  // (Both branches use the same broadened regexes defined below.)
  const isProfileUpdate =
    (UPDATE_VERB_RE.test(text) && PROFILE_NOUN_RE.test(text)) ||
    (SHORT_CONFIRM_RE.test(text) && recentlyDiscussedProfileUpdate) ||
    // Pure verb in current message + profile noun in recent context
    // covers follow-ups like "naya likho update kare" after the assistant
    // just showed the user's bio.
    (UPDATE_VERB_RE.test(text) && recentlyDiscussedProfileUpdate);
  if (isProfileUpdate) return 'profile_update';

  const isDelivery = /\b(email|mail|telegram|push|notification|notify|alert|reminder|send|share|forward|bhej|bhejo|bhejna|bhejdo|mail kar|email kar)\b|ईमेल|मेल|भेज|नोटिफिकेशन|सूचना|रिमाइंडर/.test(text);
  if (isDelivery) return 'delivery';

  const VERB_RE = /\b(generate|create|make|build|design|draft|prepare|write|bana|banao|banado|bana do|banake|banakar|banwa|banwao|tayar kar|taiyar kar|taiyaar kar|chahiye|chahiyē|do|de do|dedo)\b|बना|बनाओ|बनाकर|बनवा|तैयार|चाहिए/;
  const isImageGeneration = /\b(image|photo|picture|poster|banner|logo|thumbnail|tasveer|chhavi)\b|फोटो|छवि|तस्वीर/.test(text) && VERB_RE.test(text);
  if (isImageGeneration) return 'image_generation';

  const isDocumentGeneration = /\b(pdf|resume|cv|file|document|letter|report)\b|पीडीएफ|फाइल|रिज्यूमे/.test(text) && VERB_RE.test(text);
  if (isDocumentGeneration || hasDocs) return 'document_generation';

  // Broader profile_update detection:
  //   1. update verb + profile noun in same message, OR
  //   2. short confirmation ("ok kar de update", "haan update karo")
  //      when recent context already discussed a profile change.
  const isWebSearch = /\b(web search|search online|google|internet|online search|web pe)\b/.test(text);
  if (isWebSearch) return 'web_search';

  // A connected-channel request is analysis, not public discovery. Route it
  // to the model with the private, factual YouTube context injected upstream.
  // This check MUST stay before public YouTube search.
  // Public discovery only runs when the user explicitly asks to find/show a
  // video, supplies a YouTube URL, asks for trending content, or asks about a
  // named public channel's statistics. A mere mention of "YouTube" or
  // "video" is not search intent.
  const hasYouTubeUrl = /https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//.test(text);
  const asksForDiscovery = /\b(search|find|dhundh|dhoondh|dikha|dikhao|dikhaye|video\s+do|videos\s+do|link\s+do|play|trending|viral|popular|latest\s+videos?|best\s+video|youtube\s+pe|youtube\s+par)\b|खोज|ढूंढ|दिखाओ|ट्रेंडिंग|वीडियो\s*दो/.test(text);
  const asksForPublicStats = /\b(subscriber|subscribers|subs|total\s*views|video\s*count|channel\s*details|channel\s*info|playlist|comments?)\b/.test(text) && /\b(channel|youtube|yt)\b/.test(text);
  const isYouTubeSearch = hasYouTubeUrl || (asksForDiscovery && hasYouTubeSubject) || asksForPublicStats;
  if (isYouTubeSearch) return 'youtube_search';

  const isJobSearch = /\b(job|jobs|vacancy|opening|company|companies|apply|application|role|hiring|naukri|dhundh|find)\b|नौकरी|वैकेंसी|कंपनी/.test(text);
  if (isJobSearch) return 'job_search';

  return 'general_chat';
}

export function getTaskRouting(messages: Message[], hasImages: boolean): TaskRouting {
  const latestMessage = extractText(messages[messages.length - 1]?.content || '');
  // Build a small context window from the last few messages so short
  // confirmations ("ok kar de", "haan") can be classified correctly when
  // they continue an in-flight profile update conversation.
  const recentContext = messages
    .slice(-5, -1)
    .map((m) => extractText(m.content))
    .join(' \n ');
  const taskType = classifyTask(latestMessage, hasImages, hasDocumentHints(messages), recentContext);

  switch (taskType) {
    case 'vision_analysis':
      return {
        taskType,
        enableTools: false,
        primaryModel: 'openai/gpt-5',
        fallbackChain: ['openai/gpt-5', 'google/gemini-2.5-pro', 'google/gemini-2.5-flash'],
        toolSubset: null,
        openerStatus: '👀 Image dekh rahi hoon...',
      };

    case 'profile_audit':
      return {
        taskType,
        enableTools: true,
        primaryModel: 'google/gemini-2.5-flash',
        fallbackChain: ['google/gemini-2.5-flash', 'openai/gpt-5-mini', 'google/gemini-2.5-pro', 'openai/gpt-5'],
        toolSubset: PROFILE_READ_TOOLS,
        openerStatus: '👀 Profile check kar rahi hoon...',
        forceTools: true,
      };

    case 'personal_lookup':
      return {
        taskType,
        enableTools: true,
        primaryModel: 'google/gemini-2.5-flash',
        fallbackChain: ['google/gemini-2.5-flash', 'openai/gpt-5-mini', 'openai/gpt-5-nano', 'openai/gpt-5'],
        toolSubset: PROFILE_READ_TOOLS,
        openerStatus: '🔎 Apki detail nikaal rahi hoon...',
        forceTools: true,
      };

    case 'image_generation':
      return {
        taskType,
        enableTools: true,
        primaryModel: 'google/gemini-2.5-flash',
        fallbackChain: ['google/gemini-2.5-flash', 'openai/gpt-5-mini', 'openai/gpt-5-nano', 'openai/gpt-5'],
        toolSubset: null,
        openerStatus: '🎨 Image bana rahi hoon...',
        forceTools: true,
      };

    case 'document_generation':
      return {
        taskType,
        enableTools: true,
        primaryModel: 'google/gemini-2.5-flash',
        fallbackChain: ['google/gemini-2.5-flash', 'openai/gpt-5-mini', 'openai/gpt-5-nano', 'openai/gpt-5'],
        toolSubset: null,
        openerStatus: '📄 Document taiyaar kar rahi hoon...',
        forceTools: true,
      };

    case 'delivery':
      return {
        taskType,
        enableTools: true,
        primaryModel: 'google/gemini-2.5-flash',
        fallbackChain: ['google/gemini-2.5-flash', 'openai/gpt-5-mini', 'openai/gpt-5-nano', 'openai/gpt-5'],
        toolSubset: null,
        openerStatus: '✉️ Bhejne ki taiyari...',
        forceTools: true,
      };

    case 'profile_update':
      return {
        taskType,
        enableTools: true,
        primaryModel: 'google/gemini-2.5-flash',
        fallbackChain: ['google/gemini-2.5-flash', 'openai/gpt-5-mini', 'openai/gpt-5-nano', 'openai/gpt-5'],
        toolSubset: null,
        openerStatus: '✏️ Profile update kar rahi hoon...',
        forceTools: true,
      };

    case 'job_search':
    case 'web_search':
      return {
        taskType,
        enableTools: true,
        primaryModel: 'google/gemini-2.5-flash',
        fallbackChain: ['google/gemini-2.5-flash', 'openai/gpt-5-mini', 'google/gemini-2.5-pro', 'openai/gpt-5'],
        toolSubset: null,
        openerStatus: taskType === 'job_search' ? '🔍 Jobs dhundh rahi hoon...' : '🌐 Web search...',
      };

    case 'youtube_search':
      return {
        taskType,
        enableTools: true,
        primaryModel: 'google/gemini-2.5-flash',
        fallbackChain: ['google/gemini-2.5-flash', 'openai/gpt-5-mini', 'openai/gpt-5'],
        toolSubset: [
          'search_youtube',
          'get_youtube_video_details',
          'get_youtube_channel_videos',
          'get_youtube_trending',
          'get_youtube_channel_details',
          'get_youtube_channel_playlists',
          'get_youtube_playlist_details',
          'get_youtube_video_comments',
          'analyze_youtube_channel',
          'get_calendar_info',
        ],
        openerStatus: '▶️ YouTube videos check kar rahi hoon...',
        forceTools: true,
      };

    case 'mailbox':
      return {
        taskType,
        enableTools: true,
        primaryModel: 'google/gemini-2.5-flash',
        fallbackChain: ['google/gemini-2.5-flash', 'openai/gpt-5-mini', 'openai/gpt-5'],
        toolSubset: [
          'set_status',
          'send_progress_message',
          'get_my_mailbox_overview',
          'check_my_mailbox',
          'search_my_mailbox',
          'get_mailbox_message_details',
          'get_email_attachment',
          'reply_to_mailbox_email',
          'send_email_from_my_mailbox',
          'manage_mailbox_message',
          'get_my_email_history',
          'run_email_autoreply_now',
        ],
        openerStatus: '📬 Aapka mailbox check kar rahi hoon...',
        forceTools: true,
      };

    case 'youtube_seo':
      return {
        taskType,
        enableTools: true,
        primaryModel: 'google/gemini-2.5-flash',
        fallbackChain: ['google/gemini-2.5-flash', 'openai/gpt-5-mini', 'openai/gpt-5'],
        // NO public search tools here — SEO work happens on the user's own videos.
        toolSubset: [
          'list_my_youtube_videos',
          'get_my_youtube_video_meta',
          'get_my_youtube_video_stats',
          'get_my_youtube_channel_stats',
          'research_trending_youtube_seo',
          'generate_youtube_seo_pack',
          'audit_my_youtube_seo',
          'update_my_youtube_video',
          'check_my_youtube_health',
        ],
        openerStatus: '🛠️ Video ka SEO taiyaar kar rahi hoon...',
        forceTools: true,
      };

    case 'youtube_analytics':
      return {
        taskType,
        enableTools: false,
        primaryModel: 'google/gemini-2.5-flash',
        fallbackChain: ['google/gemini-2.5-flash', 'google/gemini-2.5-pro', 'openai/gpt-5'],
        toolSubset: null,
        openerStatus: '📊 Aapke channel ka data analyze kar rahi hoon...',
      };

    case 'greeting':
      return {
        taskType,
        enableTools: false,
        primaryModel: 'google/gemini-2.5-flash-lite',
        fallbackChain: ['google/gemini-2.5-flash-lite', 'google/gemini-2.5-flash', 'openai/gpt-5-mini'],
        toolSubset: null,
        openerStatus: '✍️ Reply likh rahi hoon...',
      };

    case 'general_chat':
    default: {
      const primaryModel = selectBestModel(messages, false);
      return {
        taskType,
        enableTools: false,
        primaryModel,
        fallbackChain: FALLBACK_CHAIN,
        toolSubset: null,
        openerStatus: '💭 Soch rahi hoon...',
      };
    }
  }
}
