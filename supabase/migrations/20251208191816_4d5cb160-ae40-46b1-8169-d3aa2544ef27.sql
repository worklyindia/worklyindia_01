-- ============================================
-- RESPONSE CACHE TABLE - Save AI costs by caching responses
-- ============================================
CREATE TABLE public.whatsapp_response_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_hash TEXT UNIQUE NOT NULL,
  normalized_message TEXT NOT NULL,
  ai_response TEXT NOT NULL,
  use_count INTEGER DEFAULT 1,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for fast lookups
CREATE INDEX idx_whatsapp_response_cache_hash ON whatsapp_response_cache(message_hash);
CREATE INDEX idx_whatsapp_response_cache_last_used ON whatsapp_response_cache(last_used_at DESC);

-- Enable RLS
ALTER TABLE whatsapp_response_cache ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role can manage response cache"
  ON whatsapp_response_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- ADD MORE QUICK REPLIES - Reduce AI costs by 50%+
-- ============================================
INSERT INTO whatsapp_quick_replies (trigger_keywords, response_hindi, response_english, category, priority) VALUES
-- Job Search queries
(ARRAY['job', 'jobs', 'naukri', 'kaam', 'work', 'vacancy', 'opening', 'hiring'], 
 '🔍 *Jobs देखने के लिए:*\n\n🌐 worklyindia.devs.surf\n\n✅ 15,000+ Remote Jobs\n✅ Daily New Openings\n✅ 100% Free Apply\n\n💼 Aaj hi apply karein!', 
 '🔍 *Browse Jobs:*\n\n🌐 worklyindia.devs.surf\n\n✅ 15,000+ Remote Jobs\n✅ Daily New Openings\n✅ 100% Free to Apply\n\n💼 Apply today!', 
 'job_search', 90),

-- Salary queries
(ARRAY['salary', 'kitna milega', 'pay', 'payment', 'paise', 'income', 'earning', 'monthly', 'per month'],
 '💰 *Salary Range:*\n\n📊 Entry Level: ₹15K-25K/month\n📊 Experienced: ₹25K-50K/month\n📊 Expert: ₹50K-1L+/month\n\n🎯 Salary job type pe depend karta hai!\n\n🔍 Check jobs: worklyindia.devs.surf',
 '💰 *Salary Range:*\n\n📊 Entry Level: ₹15K-25K/month\n📊 Experienced: ₹25K-50K/month\n📊 Expert: ₹50K-1L+/month\n\n🎯 Salary depends on job type!\n\n🔍 Browse jobs: worklyindia.devs.surf',
 'salary', 85),

-- Contact queries
(ARRAY['contact', 'phone', 'call', 'number', 'mobile', 'whatsapp number', 'support'],
 '📞 *Contact Us:*\n\n📱 WhatsApp: +91 9904923067\n📧 Email: Workly India.india.24x7@gmail.com\n🌐 Website: worklyindia.devs.surf\n\n🙏 Hum zaroor help karenge!',
 '📞 *Contact Us:*\n\n📱 WhatsApp: +91 9904923067\n📧 Email: Workly India.india.24x7@gmail.com\n🌐 Website: worklyindia.devs.surf\n\n🙏 We''re here to help!',
 'contact', 85),

-- Apply help
(ARRAY['apply', 'apply kaise', 'how to apply', 'kaise karu', 'registration', 'register'],
 '📝 *Apply कैसे करें:*\n\n1️⃣ Visit: worklyindia.devs.surf\n2️⃣ Job select करें\n3️⃣ Apply button click करें\n4️⃣ Profile complete करें\n\n✅ 100% FREE | कोई fees नहीं!',
 '📝 *How to Apply:*\n\n1️⃣ Visit: worklyindia.devs.surf\n2️⃣ Select a job\n3️⃣ Click Apply button\n4️⃣ Complete your profile\n\n✅ 100% FREE | No fees ever!',
 'apply_help', 85),

-- Location queries
(ARRAY['location', 'where', 'city', 'place', 'kahan', 'area', 'remote', 'Workly India'],
 '🏠 *100% Workly India!*\n\n✅ Ghar se kaam karein\n✅ Koi office nahi jaana\n✅ Pan India opportunities\n✅ Internet + laptop = Ready!\n\n🔍 Jobs: worklyindia.devs.surf',
 '🏠 *100% Workly India!*\n\n✅ Work from anywhere\n✅ No office commute\n✅ Pan India opportunities\n✅ Just need internet + laptop!\n\n🔍 Browse: worklyindia.devs.surf',
 'location', 80),

-- Skills queries
(ARRAY['skills', 'qualification', 'requirement', 'kya chahiye', 'eligibility', 'degree'],
 '💼 *Basic Requirements:*\n\n✅ Computer/Laptop\n✅ Good Internet\n✅ Basic English/Hindi\n✅ Communication Skills\n\n📚 Kuch jobs mein degree chahiye, kuch mein nahi!\n\n🔍 Check: worklyindia.devs.surf',
 '💼 *Basic Requirements:*\n\n✅ Computer/Laptop\n✅ Good Internet\n✅ Basic English/Hindi\n✅ Communication Skills\n\n📚 Some jobs need degree, some don''t!\n\n🔍 Check: worklyindia.devs.surf',
 'skills', 80),

-- Timing/Hours queries
(ARRAY['timing', 'time', 'hours', 'kitne ghante', 'schedule', 'shift', 'part time', 'full time'],
 '⏰ *Work Timings:*\n\n🌅 Day Shift: 9 AM - 6 PM\n🌙 Night Shift: Available\n⚡ Part Time: 4-5 hours\n💼 Full Time: 8-9 hours\n\n✅ Flexible options available!\n\n🔍 worklyindia.devs.surf',
 '⏰ *Work Timings:*\n\n🌅 Day Shift: 9 AM - 6 PM\n🌙 Night Shift: Available\n⚡ Part Time: 4-5 hours\n💼 Full Time: 8-9 hours\n\n✅ Flexible options available!\n\n🔍 worklyindia.devs.surf',
 'timing', 80),

-- Fresher queries
(ARRAY['fresher', 'experience', 'no experience', 'beginner', 'new', 'start', 'shuru'],
 '👋 *Freshers Welcome!*\n\n✅ No experience needed\n✅ Training provided\n✅ Learn & Earn\n✅ Grow your career\n\n🎯 1000+ fresher-friendly jobs!\n\n🔍 Apply: worklyindia.devs.surf',
 '👋 *Freshers Welcome!*\n\n✅ No experience needed\n✅ Training provided\n✅ Learn & Earn\n✅ Grow your career\n\n🎯 1000+ fresher-friendly jobs!\n\n🔍 Apply: worklyindia.devs.surf',
 'fresher', 80),

-- Benefits queries
(ARRAY['benefits', 'facilities', 'perks', 'advantage', 'fayda'],
 '✨ *Workly India Benefits:*\n\n✅ No commute - save time & money\n✅ Flexible schedule\n✅ Work-life balance\n✅ No dress code\n✅ Safe & comfortable\n\n🏠 Ghar se karo India build!\n\n🔍 worklyindia.devs.surf',
 '✨ *Workly India Benefits:*\n\n✅ No commute - save time & money\n✅ Flexible schedule\n✅ Work-life balance\n✅ No dress code\n✅ Safe & comfortable\n\n🏠 Build your career from home!\n\n🔍 worklyindia.devs.surf',
 'benefits', 75),

-- Scam/Fraud queries
(ARRAY['scam', 'fraud', 'fake', 'real', 'genuine', 'trust', 'safe', 'legit'],
 '🛡️ *Safety Tips:*\n\n🚨 NEVER pay any fees!\n✅ Real jobs = FREE apply\n✅ Workly India verified companies only\n❌ Avoid too-good-to-be-true offers\n\n🔒 Safe jobs: worklyindia.devs.surf\n\n📞 Report fraud: +91 9904923067',
 '🛡️ *Safety Tips:*\n\n🚨 NEVER pay any fees!\n✅ Real jobs = FREE apply\n✅ Workly India has verified companies only\n❌ Avoid too-good-to-be-true offers\n\n🔒 Safe jobs: worklyindia.devs.surf\n\n📞 Report fraud: +91 9904923067',
 'safety', 90),

-- Data entry queries
(ARRAY['data entry', 'typing', 'typing job', 'excel', 'copy paste'],
 '⌨️ *Data Entry Jobs:*\n\n✅ Simple typing work\n✅ ₹15K-30K/month\n✅ No experience needed\n✅ Flexible timing\n\n📊 100+ data entry jobs available!\n\n🔍 Apply: worklyindia.devs.surf',
 '⌨️ *Data Entry Jobs:*\n\n✅ Simple typing work\n✅ ₹15K-30K/month\n✅ No experience needed\n✅ Flexible timing\n\n📊 100+ data entry jobs available!\n\n🔍 Apply: worklyindia.devs.surf',
 'data_entry', 85),

-- Customer support queries
(ARRAY['customer support', 'customer service', 'call center', 'bpo', 'telecalling'],
 '📞 *Customer Support Jobs:*\n\n✅ Voice & Non-voice\n✅ ₹18K-40K/month\n✅ Day & Night shifts\n✅ Training provided\n\n🎧 Join top companies!\n\n🔍 Apply: worklyindia.devs.surf',
 '📞 *Customer Support Jobs:*\n\n✅ Voice & Non-voice\n✅ ₹18K-40K/month\n✅ Day & Night shifts\n✅ Training provided\n\n🎧 Join top companies!\n\n🔍 Apply: worklyindia.devs.surf',
 'customer_support', 85),

-- Short acknowledgments
(ARRAY['hmm', 'hmmm', 'achha', 'acha', 'ohhh', 'oh', 'i see', 'got it', 'samjha'],
 '👍 Samajh gaye! Koi aur sawal ho toh zaroor puchiye! 🙏\n\n🔍 Jobs: worklyindia.devs.surf',
 '👍 Got it! Feel free to ask anything else! 🙏\n\n🔍 Jobs: worklyindia.devs.surf',
 'acknowledgment', 70),

-- Question words
(ARRAY['kya', 'what', 'why', 'kyu', 'kyun', 'how', 'kaise', 'when', 'kab'],
 '🤔 Aapka poora sawal batayein toh main better help kar sakta hoon!\n\nYa direct jobs browse karein: worklyindia.devs.surf',
 '🤔 Please share your complete question so I can help better!\n\nOr browse jobs directly: worklyindia.devs.surf',
 'question_prompt', 60);

-- Update existing quick replies to have better matching
UPDATE whatsapp_quick_replies 
SET trigger_keywords = ARRAY['hi', 'hello', 'hlo', 'hii', 'hey', 'helo', 'hllo', 'hiiii', 'hiii', 'helloo', 'hlw', 'hii', 'hyy', 'hyyy', 'hy']
WHERE category = 'greeting';