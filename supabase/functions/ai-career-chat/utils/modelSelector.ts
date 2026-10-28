// Advanced Model Selection Logic with History Awareness
// Only uses gateway-allowed models (gpt-5 family + gemini-2.5/3 family)
//
// Reliability-first routing principles:
//  - flash-lite ONLY for clearly trivial, tool-free, single-turn greetings.
//  - Anything that may need tools, multi-step reasoning, multilingual handling,
//    or comes after a previous failure → flash or stronger.
//  - Vision context, action requests (email/file/image), and sensitive issues
//    are escalated explicitly.

interface Message {
  role: string;
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

function extractTextFromContent(content: string | Array<any>): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const textPart = content.find(part => part.type === 'text');
    return textPart?.text || '';
  }
  return '';
}

function hasRecentImages(messages: Message[], lookback: number = 5): boolean {
  const recent = messages.slice(-lookback);
  return recent.some(msg => {
    if (Array.isArray(msg.content)) {
      return msg.content.some((part: any) => part.type === 'image_url');
    }
    return false;
  });
}

function isMultiPartQuery(text: string): boolean {
  const questionMarks = (text.match(/\?/g) || []).length;
  const conjunctions = (text.match(/\b(aur|and|also|bhi|plus|saath)\b/gi) || []).length;
  const actionVerbs = (text.match(/\b(search|find|check|update|show|bata|dikha|kar|bana)\b/gi) || []).length;
  return (questionMarks >= 2) || (conjunctions >= 2 && actionVerbs >= 2) || (actionVerbs >= 3);
}

function analyzeConversationContext(messages: Message[]): {
  hasImageContext: boolean;
  isMultiTurn: boolean;
  avgComplexity: 'low' | 'medium' | 'high';
  toolCallCount: number;
  hasRecentFailureSignal: boolean;
  hasDocContext: boolean;
  hasRecentToolCall: boolean;
  hasPendingActionContext: boolean;
  isShortConfirmation: boolean;
} {
  const hasImageContext = hasRecentImages(messages);
  const isMultiTurn = messages.length > 6;

  let toolCallCount = 0;
  messages.forEach(msg => {
    if (msg.role === 'tool') toolCallCount++;
  });

  const recentUserMsgs = messages.filter(m => m.role === 'user').slice(-5);
  const avgLength = recentUserMsgs.reduce((sum, m) => sum + extractTextFromContent(m.content).length, 0) / (recentUserMsgs.length || 1);
  const avgComplexity = avgLength < 50 ? 'low' : avgLength < 150 ? 'medium' : 'high';

  // Heuristic: previous user message asking to retry / "try again" / "phir se" suggests prior failure
  const lastUserText = extractTextFromContent(recentUserMsgs[recentUserMsgs.length - 1]?.content || '').toLowerCase().trim();
  const hasRecentFailureSignal = /\b(retry|try again|phir se|dobara|fir se|reattempt|firse)\b/.test(lastUserText);

  // Heuristic: any recent message with attached document context block
  const hasDocContext = messages.slice(-4).some(m => {
    const t = extractTextFromContent(m.content);
    return /attached document|extracted content|\[user has attached/i.test(t);
  });

  // CRITICAL: detect if any recent message had tool calls or was about to perform an action.
  // This prevents short follow-ups like "karo", "haan", "ok", "yes" from being downgraded
  // to flash-lite which then hallucinates "email sent" without invoking the tool.
  const recentSlice = messages.slice(-6);
  const hasRecentToolCall = recentSlice.some(m =>
    m.role === 'tool' ||
    (m as any).tool_calls ||
    (Array.isArray((m as any).tool_calls) && (m as any).tool_calls.length > 0)
  );

  // Detect if recent assistant message proposed an action (e.g. "bhejti hoon abhi", "I'll send")
  const actionProposalPattern = /\b(bhej(ti|ta|ne|ungi|unga|oonga|oongi|ungi)|bhej deti|send kar(ti|ta|ne)|sending|i'?ll send|i will send|email kar(ti|ta|ne|deti|deta)|mail kar(ti|ta|ne)|generate kar(ti|ta|ne)|bana(ti|ta|ne) (hoon|hu)|abhi karti|abhi karta|chalo bhej|let me send|preparing|tayar kar)\b/i;
  const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');
  const lastAssistantText = lastAssistantMsg ? extractTextFromContent(lastAssistantMsg.content).toLowerCase() : '';
  const hasPendingActionContext = actionProposalPattern.test(lastAssistantText);

  // Detect short confirmation/acknowledgement messages (very high risk of being misrouted)
  const confirmationWords = new Set([
    'karo', 'kar do', 'kardo', 'haan', 'han', 'ha', 'haa', 'ji', 'ji haan', 'theek hai', 'thik hai',
    'ok', 'okay', 'k', 'kk', 'yes', 'yeah', 'yep', 'sure', 'go', 'do it', 'send it',
    'bhej do', 'bhejo', 'bhej', 'bhejdo', 'send', 'kar de', 'karde', 'kr do', 'krdo',
    'हाँ', 'हां', 'ठीक', 'भेजो', 'करो'
  ]);
  const isShortConfirmation = lastUserText.length <= 20 && confirmationWords.has(lastUserText.replace(/[!.?]/g, '').trim());

  return {
    hasImageContext, isMultiTurn, avgComplexity, toolCallCount,
    hasRecentFailureSignal, hasDocContext, hasRecentToolCall,
    hasPendingActionContext, isShortConfirmation
  };
}

export function selectBestModel(messages: Message[], toolsNeeded: boolean): string {
  const lastContent = messages[messages.length - 1]?.content;
  const lastUserMessage = extractTextFromContent(lastContent).toLowerCase();
  const messageLength = lastUserMessage.length;
  const context = analyzeConversationContext(messages);
  const isMultiPart = isMultiPartQuery(lastUserMessage);

  // 0. VISION CONTINUITY → vision-capable model
  if (context.hasImageContext) {
    return 'openai/gpt-5';
  }

  // 0.01 PENDING ACTION + SHORT CONFIRMATION → OpenAI gpt-5-mini (most reliable tool calling).
  // CRITICAL: Without this, "karo" / "haan" / "ok" / "phir se bhejo" after AI promised
  // to send an email gets routed to a Gemini model that HALLUCINATES the tool call —
  // it writes "tool_code print(send_email_to_user(...))" as plain text instead of
  // invoking the function. User never receives the email. (Reported bug, screenshot evidence.)
  // OpenAI models emit proper structured tool_calls and do not hallucinate this way.
  if (context.hasPendingActionContext || context.isShortConfirmation || context.hasRecentToolCall) {
    return 'openai/gpt-5-mini';
  }

  // 0.05 DOCUMENT CONTEXT → strong model that handles long context reliably
  if (context.hasDocContext) {
    return 'google/gemini-2.5-flash';
  }

  // 0.1 ACTION REQUESTS (email/image/file/pdf send/generate) → tool-capable model
  // CRITICAL: gemini-2.5-flash-lite hallucinates tool calls (claims "email sent" without invoking the tool).
  // These keywords MUST route to a model that reliably executes function calls.
  const actionKeywords = [
    // English
    'email', 'mail', 'send', 'message', 'test', 'generate', 'create', 'make', 'image', 'picture',
    'photo', 'logo', 'banner', 'poster', 'pdf', 'file', 'download', 'attach',
    'resume', 'document', 'inbox',
    // Hinglish / Hindi (latin)
    'bhej', 'bheje', 'bhejo', 'bhejna', 'bhejdo', 'bhej do', 'send kar', 'send karo',
    'send kar do', 'mail kar', 'email kar', 'banao', 'bana do', 'bana de', 'banaye',
    'banadi', 'banwa', 'generate kar', 'create kar', 'tasveer', 'image bana',
    'photo bana', 'pdf bana', 'file bana', 'download kar', 'kar do', 'kardo',
    // Devanagari
    'ईमेल', 'मेल', 'भेज', 'बना', 'बनाओ', 'बनादो', 'फोटो', 'छवि', 'फाइल', 'पीडीएफ', 'संदेश'
  ];
  const hasActionKeyword = actionKeywords.some(k => lastUserMessage.includes(k));
  if (hasActionKeyword) {
    // OpenAI gpt-5-mini: most reliable structured tool calling, never hallucinates
    // "tool_code print(...)" as text the way Gemini sometimes does.
    // For multi-part action requests (e.g. "do images banao", "image bana ke email
    // aur telegram dono pe bhejo") gpt-5-mini handles parallel tool calling more
    // reliably than Gemini and emits all required tool_calls in one round.
    return 'openai/gpt-5-mini';
  }

  // 0.2 RECENT FAILURE / EXPLICIT RETRY → never use flash-lite, prefer reliable model
  if (context.hasRecentFailureSignal) {
    return 'google/gemini-2.5-flash';
  }

  // 1. CRITICAL ISSUES → strongest reasoning
  const criticalKeywords = [
    'fraud', 'scam', 'cheat', 'fake', 'illegal', 'police', 'lawyer', 'legal',
    'complaint', 'dispute', 'court', 'धोखा', 'जालसाजी', 'शिकायत'
  ];
  if (criticalKeywords.some(keyword => lastUserMessage.includes(keyword))) {
    return 'google/gemini-2.5-pro';
  }

  // 2. REFUND REQUESTS → strong model
  const refundKeywords = ['refund', 'money back', 'return', 'रिफंड', 'पैसे वापस'];
  if (refundKeywords.some(keyword => lastUserMessage.includes(keyword))) {
    return 'google/gemini-2.5-pro';
  }

  // 3. MULTI-PART QUERIES with tools → gpt-5-mini (better at parallel tool calls
  //    than Gemini, which sometimes splits across rounds and slows things down)
  if (isMultiPart && toolsNeeded) {
    return 'openai/gpt-5-mini';
  }

  // 4. PURE GREETINGS (single-turn, very short, tool-free) → cheapest
  // Reliability-first: only use flash-lite if conversation is brand new AND tools not needed.
  const greetingKeywords = ['hi', 'hello', 'hey', 'namaste', 'नमस्ते', 'हाय', 'हेलो', 'thanks', 'thank you', 'ok', 'okay', 'yes', 'no', 'bye', 'gm', 'good morning', 'good night'];
  const isGreeting = greetingKeywords.some(keyword => lastUserMessage === keyword || lastUserMessage.startsWith(keyword + ' ') || lastUserMessage.startsWith(keyword + '!'));
  if (isGreeting && messageLength < 30 && !toolsNeeded && !context.isMultiTurn) {
    return 'google/gemini-2.5-flash-lite';
  }

  // 5. SHORT TOOL-FREE SINGLE-TURN MESSAGES → cheapest (only if conversation hasn't grown)
  if (messageLength < 25 && !toolsNeeded && !context.isMultiTurn) {
    return 'google/gemini-2.5-flash-lite';
  }

  // 6. JOB SEARCH & APPLICATIONS → Gemini Flash (reliable tool calling)
  const jobKeywords = [
    'job', 'apply', 'search', 'vacancy', 'opening', 'position', 'hiring',
    'नौकरी', 'काम', 'भर्ती', 'वैकेंसी'
  ];
  if (jobKeywords.some(keyword => lastUserMessage.includes(keyword))) {
    return 'google/gemini-2.5-flash';
  }

  // 6.1 PROFILE / RESUME / ACCOUNT QUERIES → Gemini Flash (often need tools)
  const profileQueryKeywords = ['profile', 'resume', 'cv', 'meri', 'mera', 'account', 'पindar', 'प्रोफाइल'];
  if (profileQueryKeywords.some(k => lastUserMessage.includes(k))) {
    return 'google/gemini-2.5-flash';
  }

  // 7. CODING QUERIES → GPT-5
  const codeKeywords = ['code', 'bug', 'error', 'function', 'api', 'debug', 'programming'];
  if (codeKeywords.some(keyword => lastUserMessage.includes(keyword))) {
    return 'openai/gpt-5';
  }

  // 8. PROFILE UPDATES & STRUCTURED DATA → GPT-5 Mini
  const profileUpdateKeywords = [
    'update', 'change', 'edit', 'modify',
    'अपडेट', 'बदल'
  ];
  if (profileUpdateKeywords.some(keyword => lastUserMessage.includes(keyword)) && toolsNeeded) {
    return 'openai/gpt-5-mini';
  }

  // 9. HIGH COMPLEXITY + TOOLS → Gemini Pro
  if (messageLength > 300 && toolsNeeded) {
    return 'google/gemini-2.5-pro';
  }

  // 10. COMPLEX QUERIES WITH TOOLS → Gemini Flash
  if (toolsNeeded && messageLength > 100) {
    return 'google/gemini-2.5-flash';
  }

  // 11. HINDI/MULTILINGUAL → Gemini Flash (more reliable for mixed-script)
  const hindiPattern = /[\u0900-\u097F]/;
  const hinglishHints = /\b(kar|hai|kya|kaise|kyun|mujhe|mera|meri|aap|tum|theek|nahi|nahin|chahiye)\b/i;
  if (hindiPattern.test(lastUserMessage) || hinglishHints.test(lastUserMessage)) {
    return 'google/gemini-2.5-flash';
  }

  // 12. LONG MESSAGES → Gemini Pro
  if (messageLength > 250) {
    return 'google/gemini-2.5-pro';
  }

  // 13. LONG CONVERSATIONS → Gemini Flash (reliability over cost)
  if (context.isMultiTurn) {
    return 'google/gemini-2.5-flash';
  }

  // 14. ANY remaining tool-needed case → Gemini Flash (never flash-lite when tools may run)
  if (toolsNeeded) {
    return 'google/gemini-2.5-flash';
  }

  // DEFAULT → cheapest (only reached for short, tool-free, single-turn, non-multilingual messages)
  return 'google/gemini-2.5-flash-lite';
}

export function getQueryComplexity(message: string): 'low' | 'medium' | 'high' {
  const length = message.length;
  const questionMarks = (message.match(/\?/g) || []).length;

  if (length < 50 && questionMarks <= 1) {
    return 'low';
  } else if (length < 150 && questionMarks <= 2) {
    return 'medium';
  } else {
    return 'high';
  }
}
