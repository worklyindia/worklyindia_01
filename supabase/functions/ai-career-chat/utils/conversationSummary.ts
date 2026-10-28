// Advanced Conversation Summary for Cost Optimization & Better Memory

interface Message {
  role: string;
  content: string | Array<any>;
}

interface ConversationMemory {
  userName: string | null;
  userPreferences: string[];
  topicsDiscussed: string[];
  toolsUsed: string[];
  keyDecisions: string[];
  actionItems: string[];
  jobsShared: string[];
  conversationPhase: 'greeting' | 'discovery' | 'action' | 'follow-up';
}

/**
 * Summarizes old messages with rich context extraction
 * Keeps the last 15 messages as-is, creates intelligent summary of older ones
 */
export function summarizeOldMessages(messages: Message[]): Message[] {
  if (messages.length <= 20) return messages;
  
  const recentMessages = messages.slice(-15);
  const oldMessages = messages.slice(0, -15);
  const memory = extractConversationMemory(oldMessages);
  const summary = buildSmartSummary(memory, oldMessages.length);
  
  console.log(`💰 Smart summary: ${oldMessages.length} msgs → 1 rich summary (phase: ${memory.conversationPhase})`);
  
  return [
    { 
      role: 'system', 
      content: `📝 CONVERSATION MEMORY (${oldMessages.length} earlier messages summarized):\n${summary}\n\n---\nRecent conversation continues below:` 
    },
    ...recentMessages
  ];
}

/**
 * Extracts structured memory from conversation history
 */
function extractConversationMemory(messages: Message[]): ConversationMemory {
  const memory: ConversationMemory = {
    userName: null,
    userPreferences: [],
    topicsDiscussed: [],
    toolsUsed: [],
    keyDecisions: [],
    actionItems: [],
    jobsShared: [],
    conversationPhase: 'greeting'
  };

  let messageIndex = 0;
  
  for (const msg of messages) {
    const text = extractText(msg.content).toLowerCase();
    if (text.length < 5) continue;
    
    if (msg.role === 'user') {
      // Extract user name patterns
      if (!memory.userName) {
        const nameMatch = text.match(/(?:mera naam|my name is|i am|i'm|mai|main)\s+([a-zA-Z\u0900-\u097F]+)/i);
        if (nameMatch) memory.userName = nameMatch[1];
      }
      
      // Extract preferences
      if (text.includes('prefer') || text.includes('chahiye') || text.includes('pasand') || text.includes('want')) {
        memory.userPreferences.push(extractText(msg.content).substring(0, 80));
      }
      
      // Extract topics
      extractTopics(text, memory.topicsDiscussed);
      
      // Detect decisions
      if (text.includes('yes') || text.includes('haan') || text.includes('ok') || text.includes('thik') || text.includes('apply')) {
        if (messageIndex > 0) {
          memory.keyDecisions.push(`User agreed at message ${messageIndex}`);
        }
      }
    }
    
    if (msg.role === 'assistant') {
      const fullText = extractText(msg.content);
      
      // Track shared job listings
      const jobMatches = fullText.match(/(?:💼|🏢|📌)\s*\*\*([^*]+)\*\*/g);
      if (jobMatches) {
        jobMatches.forEach(j => memory.jobsShared.push(j.substring(0, 60)));
      }
      
      // Track action items suggested
      if (fullText.includes('apply') || fullText.includes('update profile') || fullText.includes('resume')) {
        memory.actionItems.push(fullText.substring(0, 80));
      }
    }
    
    // Track tool usage from assistant messages
    if (msg.role === 'tool' || (msg.role === 'assistant' && typeof msg.content === 'string' && msg.content.includes('tool_call'))) {
      memory.toolsUsed.push(`Tool used at message ${messageIndex}`);
    }
    
    messageIndex++;
  }
  
  // Determine conversation phase
  if (messageIndex < 4) memory.conversationPhase = 'greeting';
  else if (memory.toolsUsed.length > 0) memory.conversationPhase = 'action';
  else if (memory.keyDecisions.length > 0) memory.conversationPhase = 'follow-up';
  else memory.conversationPhase = 'discovery';
  
  return memory;
}

/**
 * Extract topic categories from text
 */
function extractTopics(text: string, topics: string[]) {
  const topicMap: Record<string, string[]> = {
    'job search': ['job', 'naukri', 'vacancy', 'opening', 'hiring', 'काम', 'नौकरी'],
    'profile/resume': ['profile', 'resume', 'cv', 'experience', 'skills', 'प्रोफाइल'],
    'salary/payment': ['salary', 'payment', 'income', 'earning', 'paise', 'तनख्वाह'],
    'career advice': ['career', 'growth', 'future', 'guidance', 'सलाह'],
    'application help': ['apply', 'application', 'interview', 'cover letter', 'आवेदन'],
    'company info': ['company', 'employer', 'organization', 'कंपनी'],
    'skills/learning': ['learn', 'course', 'skill', 'certification', 'training', 'सीखना'],
    'freelancing': ['freelance', 'gig', 'contract', 'project based', 'फ्रीलांस'],
    'image generation': ['image', 'logo', 'banner', 'poster', 'photo', 'design'],
    'document creation': ['pdf', 'document', 'letter', 'report', 'resume bana']
  };
  
  for (const [topic, keywords] of Object.entries(topicMap)) {
    if (keywords.some(k => text.includes(k)) && !topics.includes(topic)) {
      topics.push(topic);
    }
  }
}

/**
 * Builds a rich, structured summary from extracted memory
 */
function buildSmartSummary(memory: ConversationMemory, messageCount: number): string {
  const parts: string[] = [];
  
  parts.push(`• ${messageCount} messages exchanged (phase: ${memory.conversationPhase})`);
  
  if (memory.userName) {
    parts.push(`• User name: ${memory.userName}`);
  }
  
  if (memory.topicsDiscussed.length > 0) {
    parts.push(`• Topics discussed: ${memory.topicsDiscussed.join(', ')}`);
  }
  
  if (memory.userPreferences.length > 0) {
    parts.push(`• User preferences: ${memory.userPreferences.slice(0, 3).join('; ')}`);
  }
  
  if (memory.jobsShared.length > 0) {
    parts.push(`• Jobs already shared (DO NOT repeat these): ${memory.jobsShared.slice(0, 5).join(', ')}`);
  }
  
  if (memory.keyDecisions.length > 0) {
    parts.push(`• Key decisions: ${memory.keyDecisions.slice(0, 3).join('; ')}`);
  }
  
  if (memory.toolsUsed.length > 0) {
    parts.push(`• Tools used: ${memory.toolsUsed.length} tool calls made`);
  }
  
  if (memory.actionItems.length > 0) {
    parts.push(`• Action items suggested: ${memory.actionItems.slice(0, 3).join('; ')}`);
  }
  
  return parts.join('\n');
}

/**
 * Extracts text from multi-modal content
 */
function extractText(content: string | Array<any>): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const textPart = content.find((part: any) => part.type === 'text');
    return textPart?.text || '[Image sent]';
  }
  return '';
}
