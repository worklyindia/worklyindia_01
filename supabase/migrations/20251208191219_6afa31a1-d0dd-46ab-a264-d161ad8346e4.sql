-- Create whatsapp_quick_replies table for cost-saving bot responses
CREATE TABLE public.whatsapp_quick_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_keywords TEXT[] NOT NULL,
  response_hindi TEXT NOT NULL,
  response_english TEXT NOT NULL,
  category TEXT,
  priority INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT TRUE,
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.whatsapp_quick_replies ENABLE ROW LEVEL SECURITY;

-- Admin-only access policy
CREATE POLICY "Admin full access to quick replies"
ON public.whatsapp_quick_replies
FOR ALL
USING (
  EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
);

-- Public read for edge functions (service role)
CREATE POLICY "Service role read access"
ON public.whatsapp_quick_replies
FOR SELECT
USING (true);

-- Create index for efficient lookups
CREATE INDEX idx_whatsapp_quick_replies_enabled ON public.whatsapp_quick_replies(enabled);
CREATE INDEX idx_whatsapp_quick_replies_priority ON public.whatsapp_quick_replies(priority DESC);

-- Insert pre-loaded quick replies
INSERT INTO public.whatsapp_quick_replies (trigger_keywords, response_hindi, response_english, category, priority) VALUES
-- Greetings (highest priority)
(ARRAY['hi', 'hello', 'hlo', 'hii', 'hey', 'namaste', 'namaskar', 'helo', 'helloo', 'hiii'], 
'नमस्ते! 🙏 मैं Workly India का AI Career Assistant हूं।

आप मुझसे पूछ सकते हैं:
• 💼 Remote Jobs के बारे में
• 📝 Career guidance
• 🔍 Job search tips

हमारी Website पर 15,000+ jobs हैं!
🌐 worklyindia.devs.surf', 
'Hello! 🙏 I''m Workly India''s AI Career Assistant.

You can ask me about:
• 💼 Remote Jobs
• 📝 Career guidance  
• 🔍 Job search tips

Check 15,000+ jobs on our website!
🌐 worklyindia.devs.surf', 
'greeting', 100),

-- Good morning/evening
(ARRAY['good morning', 'gm', 'suprabhat', 'subah', 'morning'], 
'Good Morning! 🌅

आज आपकी job search में क्या help करूं?
💼 Jobs देखें: worklyindia.devs.surf', 
'Good Morning! 🌅

How can I help with your job search today?
💼 Browse jobs: worklyindia.devs.surf', 
'greeting', 95),

(ARRAY['good evening', 'good night', 'shubh ratri', 'gn', 'evening'], 
'Good Evening! 🌙

कोई job related सवाल हो तो पूछें!
💼 Website: worklyindia.devs.surf', 
'Good Evening! 🌙

Feel free to ask any job-related questions!
💼 Website: worklyindia.devs.surf', 
'greeting', 94),

-- Thanks
(ARRAY['thanks', 'thank you', 'thankyou', 'thnx', 'thx', 'dhanyavaad', 'shukriya', 'धन्यवाद', 'शुक्रिया'], 
'🙏 धन्यवाद! आपकी बातचीत अच्छी लगी!

कोई और सवाल हो तो जरूर पूछें!
💼 Jobs: worklyindia.devs.surf', 
'🙏 You''re welcome! Glad I could help!

Feel free to ask if you have more questions!
💼 Jobs: worklyindia.devs.surf', 
'thanks', 90),

-- Goodbye
(ARRAY['bye', 'goodbye', 'alvida', 'tata', 'bye bye', 'byee', 'bbye'], 
'👋 Goodbye! आपका दिन शुभ हो!

Job updates के लिए website visit करें:
🌐 worklyindia.devs.surf

फिर मिलेंगे! 🙏', 
'👋 Goodbye! Have a great day!

Visit our website for job updates:
🌐 worklyindia.devs.surf

See you soon! 🙏', 
'goodbye', 85),

-- Ok/Okay acknowledgments
(ARRAY['ok', 'okay', 'okey', 'k', 'okk', 'okayy', 'theek hai', 'thik', 'thik hai', 'accha', 'acha', 'achha'], 
'👍 ठीक है! कोई और help चाहिए तो बताएं!

💼 Jobs browse करें: worklyindia.devs.surf', 
'👍 Alright! Let me know if you need anything else!

💼 Browse jobs: worklyindia.devs.surf', 
'acknowledgment', 80),

-- Website/Link request
(ARRAY['website', 'link', 'url', 'site', 'app'], 
'🌐 *Workly India Website:*
worklyindia.devs.surf

यहां आप देख सकते हैं:
• 15,000+ Remote Jobs
• 2,000+ Verified Companies
• Free Job Alerts

📱 WhatsApp: +91 9904923067
📧 Email: Workly India.india.24x7@gmail.com', 
'🌐 *Workly India Website:*
worklyindia.devs.surf

Here you can find:
• 15,000+ Remote Jobs
• 2,000+ Verified Companies  
• Free Job Alerts

📱 WhatsApp: +91 9904923067
📧 Email: Workly India.india.24x7@gmail.com', 
'info', 75),

-- Yes/No simple responses
(ARRAY['yes', 'haan', 'ha', 'ji', 'ji haan', 'yess', 'yup', 'yep'], 
'👍 बढ़िया! मुझे बताएं आपको क्या help चाहिए?

💼 Jobs, Career tips, या कुछ और?', 
'👍 Great! Let me know how I can help you!

💼 Jobs, Career tips, or something else?', 
'acknowledgment', 70),

(ARRAY['no', 'nahi', 'nhi', 'na', 'nope'], 
'👍 ठीक है! जब भी help चाहिए, message करें!

🌐 worklyindia.devs.surf', 
'👍 Alright! Message anytime you need help!

🌐 worklyindia.devs.surf', 
'acknowledgment', 70),

-- Hmm/thinking responses
(ARRAY['hmm', 'hm', 'hmmmm', '...', 'ohh', 'oh'], 
'🤔 कुछ सोच रहे हैं? मुझे बताएं क्या help चाहिए!

💼 Job search, career guidance - कुछ भी पूछें!', 
'🤔 Thinking about something? Let me know how I can help!

💼 Job search, career guidance - ask me anything!', 
'acknowledgment', 65);

-- Add trigger for updated_at
CREATE TRIGGER update_whatsapp_quick_replies_updated_at
BEFORE UPDATE ON public.whatsapp_quick_replies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();