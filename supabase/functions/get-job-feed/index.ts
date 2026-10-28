import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { WEBSITE_DOMAIN } from '../_shared/domain.ts';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// Module-scoped TTL cache for Adzuna aux endpoints (categories/histogram/history/etc.)
// Reduces upstream calls and helps stay under Adzuna's rate limits (429).
const ADZUNA_AUX_CACHE = new Map<string, {
  payload: unknown;
  expiresAt: number;
}>();
interface JobFeedRequest {
  action?: 'feed' | 'ai-search' | 'jooble' | 'careerjet' | 'adzuna' | 'adzuna-categories' | 'adzuna-geodata' | 'adzuna-histogram' | 'adzuna-history' | 'adzuna-top-companies';
  filters?: {
    location?: string;
    min_salary?: number;
    max_salary?: number;
    experience_level?: string;
    remote_allowed?: boolean;
    skills?: string[];
    category?: string;
    job_type?: string;
    search?: string;
  };
  page?: number;
  limit?: number;
  sort?: 'latest' | 'salary' | 'relevance' | 'trending';
  query?: string;
}

// ========== ULTRA POWERFUL SMART SEARCH ENGINE ==========

// Hindi/Hinglish/Multi-language dictionary → English job keywords (500+ mappings)
const LANGUAGE_DICTIONARY: Record<string, string[]> = {
  // === Hindi/Hinglish core terms ===
  'naukri': ['job', 'vacancy', 'opening'],
  'naukari': ['job', 'vacancy', 'opening'],
  'naukariyan': ['jobs', 'vacancies'],
  'rozgar': ['employment', 'job'],
  'rojgar': ['employment', 'job'],
  'rozgaar': ['employment', 'job'],
  'kaam': ['work', 'job'],
  'kam': ['work', 'job'],
  'kaam dhundho': ['find job', 'job search'],
  'kaam chahiye': ['need job', 'job'],
  'kaam do': ['give job', 'job'],
  'nokri': ['job', 'vacancy'],
  'vakancy': ['vacancy', 'job'],
  'bharti': ['recruitment', 'hiring', 'job'],
  'bhrti': ['recruitment', 'hiring'],
  'hiring': ['hiring', 'recruitment', 'job'],
  // === Workly India / Remote ===
  'ghar': ['home', 'Workly India'],
  'ghar se': ['Workly India', 'remote'],
  'ghar se kaam': ['Workly India', 'remote', 'Workly India'],
  'ghar baithe': ['Workly India', 'remote'],
  'ghar baithe kaam': ['Workly India', 'remote'],
  'ghar pe kaam': ['Workly India', 'remote'],
  'ghar par kaam': ['Workly India', 'remote'],
  'online kaam': ['online work', 'remote', 'Workly India'],
  'online job': ['online', 'remote', 'Workly India'],
  'mobile se kaam': ['mobile work', 'online', 'Workly India'],
  'phone se kaam': ['mobile work', 'online', 'Workly India'],
  'laptop se kaam': ['online work', 'remote', 'Workly India'],
  // === Data Entry / Typing ===
  'typing': ['typing', 'data entry', 'typist'],
  'typing ka kaam': ['typing job', 'data entry'],
  'typing job': ['typing', 'data entry', 'typist'],
  'data entry': ['data entry', 'typing', 'data operator'],
  'data entry job': ['data entry', 'typing', 'data operator'],
  'data entry kaam': ['data entry', 'typing'],
  'form filling': ['form filling', 'data entry'],
  'copy paste': ['copy paste', 'data entry', 'back office'],
  'excel': ['excel', 'data entry', 'MIS'],
  'excel ka kaam': ['excel work', 'MIS', 'data entry'],
  'ms office': ['MS office', 'computer operator', 'data entry'],
  'computer operator': ['computer operator', 'data entry'],
  // === Call Center / BPO / Calling ===
  'calling': ['calling', 'telecaller', 'call center', 'tele calling', 'BPO'],
  'call': ['calling', 'telecaller', 'call center'],
  'call center': ['call center', 'BPO', 'telecaller', 'customer service'],
  'telecaller': ['telecaller', 'calling', 'call center'],
  'telecalling': ['telecalling', 'telecaller', 'call center'],
  'tele calling': ['tele calling', 'telecaller', 'BPO'],
  'bpo': ['BPO', 'call center', 'telecaller', 'customer service'],
  'inbound': ['inbound calling', 'call center', 'customer service'],
  'outbound': ['outbound calling', 'telecaller', 'sales calling'],
  'voice process': ['voice process', 'call center', 'BPO'],
  'non voice': ['non voice', 'back office', 'data entry', 'chat support'],
  'chat support': ['chat support', 'customer service', 'non voice'],
  'email support': ['email support', 'customer service', 'back office'],
  // === Sales / Marketing ===
  'sales': ['sales', 'sales executive', 'salesman', 'business development'],
  'bechna': ['sales', 'selling'],
  'bikri': ['sales'],
  'sales ka kaam': ['sales job', 'sales executive'],
  'field sales': ['field sales', 'sales executive', 'outdoor sales'],
  'marketing': ['marketing', 'digital marketing'],
  'digital marketing': ['digital marketing', 'SEO', 'social media'],
  'seo': ['SEO', 'digital marketing', 'search engine optimization'],
  'social media': ['social media', 'social media marketing', 'SMM'],
  'facebook ads': ['facebook ads', 'digital marketing', 'social media'],
  'google ads': ['google ads', 'PPC', 'digital marketing'],
  // === Teaching / Education ===
  'teacher': ['teacher', 'teaching', 'tutor', 'faculty'],
  'padhai': ['teaching', 'education', 'tutor'],
  'padhana': ['teaching', 'tutor'],
  'tuition': ['tuition', 'tutor', 'teaching'],
  'coaching': ['coaching', 'teaching', 'trainer'],
  'trainer': ['trainer', 'training', 'teacher'],
  'faculty': ['faculty', 'professor', 'teacher'],
  'professor': ['professor', 'faculty', 'teaching'],
  // === Accounts / Finance ===
  'accountant': ['accountant', 'accounting', 'accounts'],
  'hisaab': ['accountant', 'accounting'],
  'accounts': ['accounts', 'accountant', 'accounting'],
  'tally': ['tally', 'accountant', 'accounting'],
  'gst': ['GST', 'accountant', 'tax'],
  'tax': ['tax', 'accountant', 'CA'],
  'ca': ['chartered accountant', 'CA', 'accountant'],
  'finance': ['finance', 'accountant', 'banking'],
  'banking': ['banking', 'bank', 'finance'],
  'bank': ['bank', 'banking', 'finance'],
  'cashier': ['cashier', 'accounts', 'billing'],
  'billing': ['billing', 'accounts', 'cashier'],
  // === Delivery / Driver / Logistics ===
  'driver': ['driver', 'delivery driver', 'cab driver'],
  'chalak': ['driver'],
  'delivery': ['delivery', 'delivery boy', 'courier', 'delivery executive'],
  'delivery boy': ['delivery boy', 'delivery executive', 'courier'],
  'courier': ['courier', 'delivery', 'logistics'],
  'logistics': ['logistics', 'supply chain', 'warehouse'],
  'warehouse': ['warehouse', 'godown', 'logistics'],
  'godown': ['warehouse', 'godown', 'store keeper'],
  'store keeper': ['store keeper', 'warehouse', 'inventory'],
  // === Office / Admin / Reception ===
  'office': ['office', 'office work', 'office assistant'],
  'office ka kaam': ['office work', 'office assistant'],
  'admin': ['admin', 'administration', 'office admin'],
  'back office': ['back office', 'data entry', 'admin'],
  'front office': ['front office', 'receptionist', 'front desk'],
  'receptionist': ['receptionist', 'front desk', 'front office'],
  'assistant': ['assistant', 'office assistant', 'personal assistant'],
  'pa': ['personal assistant', 'PA', 'executive assistant'],
  'secretary': ['secretary', 'personal assistant', 'office assistant'],
  'clerk': ['clerk', 'office clerk', 'data entry'],
  'peon': ['peon', 'office boy', 'helper'],
  'office boy': ['office boy', 'peon', 'helper'],
  // === IT / Tech / Development ===
  'coding': ['developer', 'programmer', 'coding', 'software'],
  'programming': ['developer', 'programmer', 'software engineer'],
  'developer': ['developer', 'software developer', 'web developer'],
  'web developer': ['web developer', 'frontend', 'backend', 'full stack'],
  'app developer': ['app developer', 'mobile developer', 'android developer'],
  'android': ['android developer', 'mobile developer', 'app developer'],
  'ios': ['iOS developer', 'mobile developer', 'swift developer'],
  'python': ['python developer', 'python', 'backend developer'],
  'java': ['java developer', 'java', 'backend developer'],
  'react': ['react developer', 'frontend developer', 'javascript'],
  'node': ['node.js developer', 'backend developer', 'javascript'],
  'php': ['PHP developer', 'web developer', 'backend'],
  'wordpress': ['wordpress developer', 'web developer', 'CMS'],
  'engineer': ['engineer', 'software engineer'],
  'software': ['software', 'software developer', 'software engineer'],
  'it': ['IT', 'information technology', 'technical support'],
  'technical': ['technical', 'IT', 'tech support'],
  'qa': ['QA', 'quality assurance', 'testing'],
  'testing': ['testing', 'QA', 'quality assurance'],
  'devops': ['DevOps', 'cloud engineer', 'AWS'],
  'cloud': ['cloud', 'AWS', 'Azure', 'cloud engineer'],
  // === Design / Creative ===
  'design': ['design', 'graphic design', 'designer'],
  'graphic design': ['graphic design', 'graphic designer', 'designer'],
  'photoshop': ['photoshop', 'graphic designer', 'photo editing'],
  'canva': ['canva', 'graphic designer', 'social media designer'],
  'ui ux': ['UI/UX', 'UI designer', 'UX designer'],
  'video editing': ['video editing', 'video editor', 'youtube editor'],
  'video editor': ['video editor', 'video editing', 'post production'],
  'photography': ['photography', 'photographer', 'camera'],
  'photographer': ['photographer', 'photography', 'videographer'],
  // === Content / Writing ===
  'writing': ['content writing', 'writer', 'copywriting'],
  'content writing': ['content writing', 'content writer', 'blog writing'],
  'content writer': ['content writer', 'content writing', 'copywriting'],
  'likhna': ['content writing', 'writer'],
  'lekhan': ['content writing', 'writer'],
  'copywriter': ['copywriter', 'copywriting', 'content writer'],
  'blogger': ['blogger', 'blog writing', 'content writer'],
  'translator': ['translator', 'translation', 'language expert'],
  'transcription': ['transcription', 'transcriptionist', 'typing'],
  // === Healthcare / Medical ===
  'nurse': ['nurse', 'nursing', 'healthcare', 'staff nurse'],
  'doctor': ['doctor', 'physician', 'medical'],
  'pharma': ['pharmacy', 'pharmacist', 'pharmaceutical'],
  'medical': ['medical', 'healthcare', 'hospital'],
  'hospital': ['hospital', 'healthcare', 'medical'],
  'lab technician': ['lab technician', 'pathology', 'medical lab'],
  'physiotherapist': ['physiotherapist', 'physiotherapy', 'healthcare'],
  'dentist': ['dentist', 'dental', 'dental surgeon'],
  'ayurveda': ['ayurveda', 'ayurvedic doctor', 'alternative medicine'],
  // === Hospitality / Food ===
  'hotel': ['hotel', 'hospitality', 'restaurant'],
  'restaurant': ['restaurant', 'hotel', 'food'],
  'waiter': ['waiter', 'steward', 'restaurant'],
  'cook': ['cook', 'chef', 'kitchen'],
  'chef': ['chef', 'cook', 'kitchen'],
  'khana': ['cook', 'chef', 'kitchen'],
  'kitchen': ['kitchen', 'cook', 'chef'],
  'housekeeping': ['housekeeping', 'hotel', 'cleaning'],
  'bartender': ['bartender', 'bar', 'restaurant'],
  'bakery': ['bakery', 'baker', 'food'],
  // === Security / Maintenance ===
  'guard': ['security guard', 'guard', 'security'],
  'watchman': ['security guard', 'watchman', 'guard'],
  'security': ['security', 'security guard', 'watchman'],
  'chowkidar': ['security guard', 'watchman'],
  'electrician': ['electrician', 'electrical', 'maintenance'],
  'plumber': ['plumber', 'plumbing', 'maintenance'],
  'mechanic': ['mechanic', 'technician', 'maintenance'],
  'technician': ['technician', 'mechanic', 'maintenance'],
  'carpenter': ['carpenter', 'carpentry', 'woodwork'],
  'painter': ['painter', 'painting', 'house painter'],
  'welder': ['welder', 'welding', 'fabrication'],
  'fitter': ['fitter', 'pipe fitter', 'mechanical'],
  'helper': ['helper', 'assistant', 'support'],
  // === HR / Management ===
  'hr': ['HR', 'human resources', 'recruitment'],
  'manager': ['manager', 'management'],
  'supervisor': ['supervisor', 'team lead', 'team leader'],
  'team lead': ['team lead', 'team leader', 'supervisor'],
  'coordinator': ['coordinator', 'executive'],
  'executive': ['executive', 'officer'],
  'director': ['director', 'management', 'head'],
  'ceo': ['CEO', 'chief executive', 'managing director'],
  // === Packing / Manufacturing ===
  'packing': ['packing', 'packaging', 'warehouse'],
  'packing ka kaam': ['packing job', 'packaging'],
  'manufacturing': ['manufacturing', 'production', 'factory'],
  'factory': ['factory', 'manufacturing', 'production'],
  'production': ['production', 'manufacturing', 'factory'],
  'quality': ['quality', 'quality control', 'QC'],
  'machine operator': ['machine operator', 'operator', 'manufacturing'],
  'assembly': ['assembly', 'manufacturing', 'production line'],
  // === Freelance / Gig ===
  'freelance': ['freelance', 'freelancer', 'contract'],
  'part time': ['part time', 'part-time'],
  'full time': ['full time', 'full-time'],
  'intern': ['intern', 'internship', 'trainee'],
  'internship': ['internship', 'intern', 'trainee'],
  'fresher': ['fresher', 'entry level', 'trainee', 'freshers'],
  'experienced': ['experienced', 'senior', 'mid-level'],
  'remote': ['remote', 'Workly India', 'Workly India'],
  'Workly India': ['Workly India', 'remote', 'Workly India'],
  'online': ['online', 'remote', 'Workly India'],
  'contract': ['contract', 'freelance', 'temporary'],
  'temporary': ['temporary', 'contract', 'temp job'],
  // === Salary related ===
  'paisa': ['salary', 'income'],
  'tankhah': ['salary', 'income'],
  'salary': ['salary'],
  'income': ['income', 'salary'],
  'kamai': ['earning', 'income', 'salary'],
  'earning': ['earning', 'income', 'salary'],
  'acchi salary': ['good salary', 'high salary'],
  'zyada salary': ['high salary', 'good salary'],
  'high salary': ['high salary'],
  // === Hindi script ===
  'नौकरी': ['job', 'vacancy'],
  'काम': ['work', 'job'],
  'घर': ['home', 'Workly India'],
  'घर से काम': ['Workly India', 'remote'],
  'घर बैठे काम': ['Workly India', 'remote'],
  'टाइपिंग': ['typing', 'data entry'],
  'कॉलिंग': ['calling', 'telecaller'],
  'ड्राइवर': ['driver'],
  'टीचर': ['teacher', 'teaching'],
  'डिलीवरी': ['delivery'],
  'ऑफिस': ['office', 'office work'],
  'कंप्यूटर': ['computer', 'computer operator'],
  'सेल्स': ['sales', 'sales executive'],
  'मार्केटिंग': ['marketing', 'digital marketing'],
  'डाटा एंट्री': ['data entry', 'typing'],
  'पैकिंग': ['packing'],
  'अकाउंटेंट': ['accountant'],
  'रोजगार': ['employment', 'job'],
  'भर्ती': ['recruitment', 'hiring'],
  'तनख्वाह': ['salary', 'income'],
  'पैसा': ['money', 'salary'],
  'फ्रीलांस': ['freelance'],
  'ऑनलाइन': ['online', 'remote'],
  'पार्ट टाइम': ['part time'],
  'फुल टाइम': ['full time'],
  'फ्रेशर': ['fresher', 'entry level'],
  'इंजीनियर': ['engineer'],
  'डॉक्टर': ['doctor', 'medical'],
  'नर्स': ['nurse', 'nursing'],
  'मैनेजर': ['manager'],
  'सुपरवाइजर': ['supervisor'],
  'गार्ड': ['security guard'],
  'रिसेप्शनिस्ट': ['receptionist'],
  // === Tamil ===
  'வேலை': ['job', 'work'],
  'வாய்ப்பு': ['opportunity', 'job'],
  'வீட்டிலிருந்து வேலை': ['Workly India'],
  // === Telugu ===
  'ఉద్యోగం': ['job', 'employment'],
  'పని': ['work', 'job'],
  // === Bengali ===
  'চাকরি': ['job', 'employment'],
  'কাজ': ['work', 'job'],
  // === Marathi ===
  'नोकरी': ['job', 'employment'],
  // === Gujarati ===
  'નોકરી': ['job', 'employment'],
  'કામ': ['work', 'job'],
  // === Kannada ===
  'ಕೆಲಸ': ['job', 'work'],
  'ಉದ್ಯೋಗ': ['employment', 'job'],
  // === Malayalam ===
  'ജോലി': ['job', 'work'],
  // === Punjabi ===
  'ਨੌਕਰੀ': ['job', 'employment'],
  'ਕੰਮ': ['work', 'job'],
  // === Urdu ===
  'وظيفة': ['job', 'employment'],
  'عمل': ['work', 'job'],
  'ملازمت': ['job', 'employment'],
  // === Spanish ===
  'trabajo': ['job', 'work'],
  'empleo': ['job', 'employment'],
  // === Common misspellings (200+ entries) ===
  'jab': ['job'],
  'joob': ['job'],
  'jobb': ['job'],
  'jobd': ['job'],
  'jobs': ['job'],
  'wrk': ['work'],
  'wrok': ['work'],
  'worl': ['work'],
  'dta': ['data'],
  'daata': ['data'],
  'dtaa': ['data'],
  'enrty': ['entry'],
  'enty': ['entry'],
  'entri': ['entry'],
  'custmer': ['customer'],
  'customar': ['customer'],
  'custumor': ['customer'],
  'customr': ['customer'],
  'sevice': ['service'],
  'servise': ['service'],
  'servis': ['service'],
  'survice': ['service'],
  'recptionist': ['receptionist'],
  'recepsionist': ['receptionist'],
  'receptionst': ['receptionist'],
  'acountant': ['accountant'],
  'accoutant': ['accountant'],
  'accountent': ['accountant'],
  'acoountant': ['accountant'],
  'delvery': ['delivery'],
  'delivry': ['delivery'],
  'delivary': ['delivery'],
  'dlivery': ['delivery'],
  'drivr': ['driver'],
  'drver': ['driver'],
  'drivar': ['driver'],
  'teachr': ['teacher'],
  'techer': ['teacher'],
  'teachar': ['teacher'],
  'typng': ['typing'],
  'typeing': ['typing'],
  'typist': ['typist', 'typing'],
  'packng': ['packing'],
  'pakcing': ['packing'],
  'packin': ['packing'],
  'calng': ['calling'],
  'caling': ['calling'],
  'callin': ['calling'],
  'mrktng': ['marketing'],
  'marketng': ['marketing'],
  'markting': ['marketing'],
  'marketin': ['marketing'],
  'sellz': ['sales'],
  'saels': ['sales'],
  'slaes': ['sales'],
  'develper': ['developer'],
  'devloper': ['developer'],
  'develoer': ['developer'],
  'develope': ['developer'],
  'enginer': ['engineer'],
  'enginear': ['engineer'],
  'engeneer': ['engineer'],
  'engineeer': ['engineer'],
  'managr': ['manager'],
  'manger': ['manager'],
  'managar': ['manager'],
  'desing': ['design'],
  'desgin': ['design'],
  'desginer': ['designer'],
  'programer': ['programmer'],
  'programmar': ['programmer'],
  'progammer': ['programmer'],
  'softwre': ['software'],
  'sofware': ['software'],
  'softwar': ['software'],
  'compter': ['computer'],
  'computar': ['computer'],
  'comuter': ['computer'],
  'secuirty': ['security'],
  'secrity': ['security'],
  'securty': ['security'],
  'suport': ['support'],
  'supprt': ['support'],
  'suppot': ['support'],
  'asistant': ['assistant'],
  'assitant': ['assistant'],
  'assistent': ['assistant'],
  'freelanc': ['freelance'],
  'frelance': ['freelance'],
  'frelanc': ['freelance'],
  'internshp': ['internship'],
  'intership': ['internship'],
  'trainee': ['trainee', 'intern'],
  'traine': ['trainee'],
  'helpr': ['helper'],
  'helpar': ['helper'],
  'opretor': ['operator'],
  'operater': ['operator'],
  'oprator': ['operator'],
  'coordinater': ['coordinator'],
  'cordinator': ['coordinator'],
  'analist': ['analyst'],
  'analust': ['analyst'],
  'warehoue': ['warehouse'],
  'warehous': ['warehouse'],
  'logistcs': ['logistics'],
  'logistik': ['logistics']
};

// Expanded synonym map
const SYNONYMS: Record<string, string[]> = {
  'job': ['job', 'work', 'vacancy', 'opening', 'position', 'opportunity'],
  'data entry': ['data entry', 'typing', 'data operator', 'back office', 'computer operator', 'form filling'],
  'customer service': ['customer service', 'customer support', 'helpdesk', 'customer care', 'chat support', 'email support'],
  'content writing': ['content writing', 'content writer', 'copywriting', 'blog writing', 'article writing'],
  'graphic design': ['graphic design', 'graphic designer', 'designer', 'photoshop', 'illustrator'],
  'web developer': ['web developer', 'frontend developer', 'backend developer', 'full stack developer', 'web development'],
  'telecaller': ['telecaller', 'tele caller', 'calling', 'call center', 'BPO', 'tele calling', 'voice process'],
  'Workly India': ['Workly India', 'Workly India', 'remote', 'online', 'Workly India', 'home based'],
  'accountant': ['accountant', 'accounting', 'accounts', 'finance', 'tally', 'GST'],
  'teacher': ['teacher', 'tutor', 'teaching', 'trainer', 'instructor', 'faculty', 'professor'],
  'sales': ['sales', 'sales executive', 'business development', 'BD', 'salesman', 'sales officer'],
  'marketing': ['marketing', 'digital marketing', 'social media', 'SEO', 'brand marketing'],
  'delivery': ['delivery', 'delivery boy', 'delivery executive', 'courier', 'last mile delivery'],
  'packing': ['packing', 'packaging', 'warehouse', 'warehouse associate'],
  'driver': ['driver', 'delivery driver', 'cab driver', 'commercial driver'],
  'security': ['security', 'security guard', 'watchman', 'security officer'],
  'receptionist': ['receptionist', 'front desk', 'front office', 'front desk executive'],
  'nurse': ['nurse', 'nursing', 'staff nurse', 'healthcare'],
  'hr': ['HR', 'human resources', 'recruitment', 'talent acquisition', 'hiring'],
  'admin': ['admin', 'administration', 'office admin', 'back office', 'office assistant'],
  'developer': ['developer', 'software developer', 'programmer', 'coder', 'engineer'],
  'designer': ['designer', 'graphic designer', 'UI designer', 'UX designer', 'web designer'],
  'analyst': ['analyst', 'data analyst', 'business analyst', 'research analyst'],
  'manager': ['manager', 'management', 'team manager', 'project manager'],
  'engineer': ['engineer', 'software engineer', 'technical', 'developer'],
  'assistant': ['assistant', 'office assistant', 'personal assistant', 'executive assistant'],
  'freelance': ['freelance', 'freelancer', 'contract', 'gig work', 'self employed'],
  'intern': ['intern', 'internship', 'trainee', 'apprentice'],
  'fresher': ['fresher', 'entry level', 'trainee', 'beginner', 'freshers']
};

// Known job keywords for fuzzy matching
const KNOWN_KEYWORDS = ['data entry', 'typing', 'calling', 'telecaller', 'call center', 'BPO', 'customer service', 'customer support', 'content writing', 'graphic design', 'web developer', 'software developer', 'marketing', 'digital marketing', 'sales', 'accountant', 'teacher', 'tutor', 'driver', 'delivery', 'packing', 'receptionist', 'security guard', 'nurse', 'doctor', 'cook', 'chef', 'hotel', 'restaurant', 'office assistant', 'clerk', 'helper', 'freelance', 'part time', 'full time', 'intern', 'fresher', 'remote', 'Workly India', 'Workly India', 'online', 'computer operator', 'back office', 'front office', 'HR', 'admin', 'manager', 'supervisor', 'engineer', 'designer', 'analyst', 'coordinator', 'executive', 'operator', 'technician', 'mechanic', 'electrician', 'plumber', 'photographer', 'video editor', 'social media', 'SEO', 'copywriter', 'developer', 'programmer', 'tester', 'DevOps', 'cloud', 'warehouse', 'logistics', 'courier', 'store keeper', 'inventory', 'billing', 'cashier', 'finance', 'banking', 'tally', 'trainer', 'faculty', 'professor', 'coaching', 'house keeping', 'cleaning', 'laundry', 'tailor', 'beautician', 'salon', 'spa', 'contractor', 'construction', 'civil engineer', 'architect', 'interior designer', 'real estate', 'insurance', 'mutual fund', 'investment', 'ecommerce', 'amazon', 'flipkart', 'youtube', 'influencer', 'content creator', 'app developer', 'android developer', 'ios developer', 'python', 'java', 'react', 'node', 'php', 'wordpress', 'quality control', 'quality assurance', 'production', 'manufacturing', 'factory', 'assembly', 'translator', 'transcription', 'proofreader', 'medical representative', 'pharma', 'lab technician', 'physiotherapist', 'dentist', 'personal assistant', 'secretary'];

// Category detection from search terms
const CATEGORY_MAP: Record<string, string> = {
  'data entry': 'Data Entry & Typing',
  'typing': 'Data Entry & Typing',
  'typist': 'Data Entry & Typing',
  'form filling': 'Data Entry & Typing',
  'telecaller': 'Customer Service',
  'call center': 'Customer Service',
  'BPO': 'Customer Service',
  'customer service': 'Customer Service',
  'customer support': 'Customer Service',
  'chat support': 'Customer Service',
  'content writing': 'Content & Writing',
  'content writer': 'Content & Writing',
  'copywriter': 'Content & Writing',
  'graphic design': 'Design & Creative',
  'designer': 'Design & Creative',
  'UI/UX': 'Design & Creative',
  'web developer': 'IT & Software',
  'software developer': 'IT & Software',
  'developer': 'IT & Software',
  'programmer': 'IT & Software',
  'engineer': 'IT & Software',
  'python': 'IT & Software',
  'java': 'IT & Software',
  'react': 'IT & Software',
  'sales': 'Sales & Marketing',
  'sales executive': 'Sales & Marketing',
  'marketing': 'Sales & Marketing',
  'digital marketing': 'Sales & Marketing',
  'accountant': 'Accounts & Finance',
  'accounting': 'Accounts & Finance',
  'tally': 'Accounts & Finance',
  'finance': 'Accounts & Finance',
  'teacher': 'Education & Training',
  'tutor': 'Education & Training',
  'teaching': 'Education & Training',
  'trainer': 'Education & Training',
  'delivery': 'Delivery & Logistics',
  'driver': 'Delivery & Logistics',
  'courier': 'Delivery & Logistics',
  'logistics': 'Delivery & Logistics',
  'warehouse': 'Delivery & Logistics',
  'nurse': 'Healthcare',
  'doctor': 'Healthcare',
  'medical': 'Healthcare',
  'pharma': 'Healthcare',
  'hotel': 'Hospitality',
  'restaurant': 'Hospitality',
  'chef': 'Hospitality',
  'cook': 'Hospitality',
  'HR': 'HR & Recruitment',
  'human resources': 'HR & Recruitment',
  'recruitment': 'HR & Recruitment',
  'security guard': 'Security',
  'watchman': 'Security',
  'admin': 'Admin & Office',
  'office assistant': 'Admin & Office',
  'receptionist': 'Admin & Office',
  'back office': 'Admin & Office'
};

// Levenshtein distance for typo correction
function levenshtein(a: string, b: string): number {
  const m = a.length,
    n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({
    length: m + 1
  }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// Adaptive fuzzy match - allows more distance for longer words
function fuzzyMatchKeyword(word: string, maxDist?: number): string | null {
  if (word.length < 3) return null;
  // Adaptive: longer words allow more typos
  const allowedDist = maxDist ?? (word.length <= 4 ? 1 : word.length <= 7 ? 2 : 3);
  let best: string | null = null;
  let bestDist = allowedDist + 1;
  for (const kw of KNOWN_KEYWORDS) {
    const kwWords = kw.split(' ');
    for (const kwWord of kwWords) {
      if (Math.abs(word.length - kwWord.length) > allowedDist) continue; // skip impossible
      const dist = levenshtein(word.toLowerCase(), kwWord.toLowerCase());
      if (dist < bestDist) {
        bestDist = dist;
        best = kw;
      }
    }
  }
  return bestDist <= allowedDist ? best : null;
}

// Simple phonetic similarity (Soundex-like for Indian names)
function phoneticCode(word: string): string {
  if (!word || word.length < 2) return word;
  const w = word.toLowerCase().replace(/ph/g, 'f').replace(/ck/g, 'k').replace(/sh/g, 's').replace(/th/g, 't').replace(/ee/g, 'i').replace(/oo/g, 'u').replace(/aa/g, 'a').replace(/gh/g, 'g').replace(/kh/g, 'k').replace(/dh/g, 'd').replace(/bh/g, 'b').replace(/[aeiou]/g, (m, i) => i === 0 ? m : '').replace(/(.)\1+/g, '$1'); // remove doubles
  return w.slice(0, 6);
}

// Phonetic match against known keywords
function phoneticMatch(word: string): string | null {
  if (word.length < 4) return null;
  const code = phoneticCode(word);
  for (const kw of KNOWN_KEYWORDS) {
    for (const kwWord of kw.split(' ')) {
      if (kwWord.length < 4) continue;
      if (phoneticCode(kwWord) === code) return kw;
    }
  }
  return null;
}

// Extract salary hints from query
function extractSalaryHint(query: string): {
  min?: number;
  max?: number;
} | null {
  // Patterns: "50k", "50000", "50k-80k", "above 30000", "upto 50000"
  const rangeMatch = query.match(/(\d+)\s*k?\s*[-–to]\s*(\d+)\s*k?/i);
  if (rangeMatch) {
    let min = parseInt(rangeMatch[1]);
    let max = parseInt(rangeMatch[2]);
    if (min < 1000) min *= 1000;
    if (max < 1000) max *= 1000;
    return {
      min,
      max
    };
  }
  const aboveMatch = query.match(/(?:above|over|more than|zyada|upar|minimum|min|atleast|at least)\s*(\d+)\s*k?/i);
  if (aboveMatch) {
    let min = parseInt(aboveMatch[1]);
    if (min < 1000) min *= 1000;
    return {
      min
    };
  }
  const belowMatch = query.match(/(?:below|under|less than|kam|niche|maximum|max|upto|up to)\s*(\d+)\s*k?/i);
  if (belowMatch) {
    let max = parseInt(belowMatch[1]);
    if (max < 1000) max *= 1000;
    return {
      max
    };
  }
  const singleNum = query.match(/(\d{4,6})\s*(?:salary|per month|monthly|pm|rupees|rs|₹)?/i);
  if (singleNum) {
    const val = parseInt(singleNum[1]);
    if (val >= 5000 && val <= 500000) return {
      min: val
    };
  }
  return null;
}

// Extract experience level from query
function extractExperienceLevel(query: string): string | null {
  const q = query.toLowerCase();
  if (/(?:fresher|freshers|entry level|no experience|bina experience|beginner|0 year|0-1)/.test(q)) return '0-1';
  if (/(?:1[-\s]?2\s*year|junior|1 year exp|1 sal)/.test(q)) return '1-2';
  if (/(?:2[-\s]?3\s*year|2 year exp|2 sal)/.test(q)) return '2-3';
  if (/(?:3[-\s]?5\s*year|mid level|3 year|4 year|5 year)/.test(q)) return '3-5';
  if (/(?:5[-\s]?10\s*year|senior|experienced|5\+ year|6 year|7 year|8 year)/.test(q)) return '5-10';
  if (/(?:10\+|10 year|15 year|expert|lead|principal)/.test(q)) return '10+';
  return null;
}

// Extract location hints from query
const INDIAN_CITIES = ['delhi', 'new delhi', 'mumbai', 'bangalore', 'bengaluru', 'hyderabad', 'chennai', 'kolkata', 'pune', 'ahmedabad', 'jaipur', 'lucknow', 'kanpur', 'nagpur', 'indore', 'thane', 'bhopal', 'visakhapatnam', 'vizag', 'patna', 'vadodara', 'ghaziabad', 'ludhiana', 'agra', 'nashik', 'faridabad', 'meerut', 'rajkot', 'varanasi', 'srinagar', 'aurangabad', 'dhanbad', 'amritsar', 'noida', 'greater noida', 'gurgaon', 'gurugram', 'chandigarh', 'coimbatore', 'jodhpur', 'ranchi', 'surat', 'kochi', 'cochin', 'trivandrum', 'thiruvananthapuram', 'mysore', 'mysuru', 'guwahati', 'dehradun', 'shimla', 'bhubaneswar', 'raipur', 'udaipur', 'jalandhar', 'allahabad', 'prayagraj', 'jammu', 'mangalore', 'navi mumbai', 'andheri', 'powai', 'borivali', 'malad', 'whitefield', 'electronic city', 'koramangala', 'indiranagar', 'hsr layout', 'dwarka', 'rohini', 'saket', 'laxmi nagar', 'karol bagh', 'connaught place', 'sector 62', 'sector 63', 'sector 125', 'sector 135', 'hinjewadi', 'kharadi', 'hadapsar', 'magarpatta', 'aundh', 'salt lake', 'rajarhat', 'howrah', 'hitech city', 'gachibowli', 'madhapur', 'kondapur', 'jubilee hills', 'siliguri', 'durgapur', 'asansol', 'baroda', 'gandhinagar', 'anand', 'mohali', 'panchkula', 'zirakpur', 'ambala', 'jamshedpur', 'bokaro', 'hazaribagh', 'gorakhpur', 'bareilly', 'aligarh', 'moradabad', 'mathura', 'firozabad', 'jabalpur', 'gwalior', 'ujjain', 'satna', 'salem', 'madurai', 'tiruchirappalli', 'trichy', 'erode', 'tirunelveli', 'hubli', 'belgaum', 'davangere', 'gulbarga', 'thrissur', 'kozhikode', 'calicut', 'kollam', 'palakkad', 'cuttack', 'berhampur', 'sambalpur', 'bilaspur', 'bhilai', 'korba', 'ajmer', 'bikaner', 'kota', 'alwar', 'bharatpur', 'panipat', 'sonipat', 'karnal', 'hisar', 'rohtak', 'bathinda', 'patiala', 'hoshiarpur'];
const INDIAN_STATES = ['maharashtra', 'karnataka', 'tamil nadu', 'telangana', 'uttar pradesh', 'rajasthan', 'gujarat', 'west bengal', 'madhya pradesh', 'kerala', 'bihar', 'punjab', 'haryana', 'jharkhand', 'chhattisgarh', 'assam', 'odisha', 'uttarakhand', 'himachal pradesh', 'goa', 'andhra pradesh', 'jammu kashmir', 'tripura', 'meghalaya', 'manipur', 'mizoram', 'nagaland', 'arunachal pradesh', 'sikkim', 'delhi ncr', 'ncr'];

// Filler words to skip
const FILLER_WORDS = new Set(['ka', 'ki', 'ke', 'me', 'mein', 'mai', 'se', 'hai', 'ho', 'he', 'the', 'in', 'for', 'a', 'an', 'is', 'and', 'or', 'of', 'to', 'i', 'want', 'need', 'find', 'get', 'looking', 'search', 'show', 'chahiye', 'chahie', 'do', 'de', 'dena', 'batao', 'dikhao', 'mujhe', 'humko', 'hume', 'ko', 'wala', 'wali', 'vale', 'vala', 'karo', 'karein', 'with', 'near', 'me', 'my', 'please', 'best', 'good', 'top', 'new', 'latest', 'urgent', 'immediately', 'ye', 'wo', 'yeh', 'woh', 'kya', 'kaisa', 'kaise', 'kaha', 'kab', 'ya', 'aur', 'bhi', 'hi', 'toh', 'na', 'nahi', 'mat', 'par', 'pe', 'jaldi', 'abhi', 'aaj', 'kal', 'sab', 'bahut', 'ek', 'koi', 'available', 'vacancy', 'opening', 'hiring', 'required']);

// Main smart search processor
function processSmartQuery(rawQuery: string): {
  corrected_query: string;
  search_terms: string[];
  extracted_filters: {
    location?: string;
    job_type?: string;
    category?: string;
    experience_level?: string;
    salary_min?: number;
    salary_max?: number;
    skills?: string[];
  };
} {
  const query = rawQuery.trim().toLowerCase();
  const words = query.split(/\s+/).filter(Boolean);
  const searchTerms = new Set<string>();
  let locationHint: string | undefined;
  let jobTypeHint: string | undefined;
  let categoryHint: string | undefined;
  const nonLocationWords: string[] = [];

  // Pre-step: Extract salary and experience from raw query
  const salaryHint = extractSalaryHint(query);
  const experienceHint = extractExperienceLevel(query);

  // Step 1: Check full query in dictionary
  if (LANGUAGE_DICTIONARY[query]) {
    LANGUAGE_DICTIONARY[query].forEach(t => searchTerms.add(t));
  }

  // Step 2: Check multi-word phrases (2-4 word combos, longest first)
  const usedIndices = new Set<number>();
  for (let len = Math.min(4, words.length); len >= 2; len--) {
    for (let i = 0; i <= words.length - len; i++) {
      // Skip if any word in this phrase was already consumed by a longer match
      if ([...Array(len)].some((_, k) => usedIndices.has(i + k))) continue;
      const phrase = words.slice(i, i + len).join(' ');

      // Check dictionary
      if (LANGUAGE_DICTIONARY[phrase]) {
        LANGUAGE_DICTIONARY[phrase].forEach(t => searchTerms.add(t));
        for (let k = 0; k < len; k++) usedIndices.add(i + k);
        continue;
      }

      // Check if phrase is a city
      if (INDIAN_CITIES.includes(phrase)) {
        locationHint = phrase.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        for (let k = 0; k < len; k++) usedIndices.add(i + k);
      }
    }
  }

  // Step 3: Process remaining individual words
  for (let idx = 0; idx < words.length; idx++) {
    if (usedIndices.has(idx)) continue;
    const word = words[idx];

    // Skip filler words
    if (FILLER_WORDS.has(word)) continue;

    // Skip numbers (handled in salary extraction)
    if (/^\d+k?$/.test(word)) continue;

    // Check for location (single word city)
    if (INDIAN_CITIES.includes(word)) {
      locationHint = word.charAt(0).toUpperCase() + word.slice(1);
      continue;
    }
    const stateMatch = INDIAN_STATES.find(s => s === word || s.includes(word) && word.length >= 4);
    if (stateMatch) {
      locationHint = stateMatch.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      continue;
    }

    // Check for job type hints
    if (['part-time', 'parttime'].includes(word)) {
      jobTypeHint = 'part-time';
      continue;
    }
    if (word === 'part' && words[idx + 1] === 'time') {
      jobTypeHint = 'part-time';
      usedIndices.add(idx + 1);
      continue;
    }
    if (['full-time', 'fulltime'].includes(word)) {
      jobTypeHint = 'full-time';
      continue;
    }
    if (word === 'full' && words[idx + 1] === 'time') {
      jobTypeHint = 'full-time';
      usedIndices.add(idx + 1);
      continue;
    }
    if (['freelance', 'contract'].includes(word)) {
      jobTypeHint = word;
      continue;
    }
    if (['internship', 'intern'].includes(word)) {
      jobTypeHint = 'internship';
      searchTerms.add('intern');
      continue;
    }
    nonLocationWords.push(word);

    // Dictionary lookup
    if (LANGUAGE_DICTIONARY[word]) {
      LANGUAGE_DICTIONARY[word].forEach(t => searchTerms.add(t));
      continue;
    }

    // Fuzzy match against known keywords (adaptive distance)
    const fuzzyMatch = fuzzyMatchKeyword(word);
    if (fuzzyMatch) {
      searchTerms.add(fuzzyMatch);
      if (SYNONYMS[fuzzyMatch]) {
        SYNONYMS[fuzzyMatch].slice(0, 3).forEach(s => searchTerms.add(s));
      }
      continue;
    }

    // Phonetic match (catches Hindi transliteration variations)
    const phonMatch = phoneticMatch(word);
    if (phonMatch) {
      searchTerms.add(phonMatch);
      continue;
    }

    // Substring match: if word is a prefix/suffix of a known keyword
    const substringMatch = KNOWN_KEYWORDS.find(kw => {
      const kwWords = kw.split(' ');
      return kwWords.some(kww => (kww.startsWith(word) || word.startsWith(kww)) && word.length >= 3);
    });
    if (substringMatch) {
      searchTerms.add(substringMatch);
      continue;
    }

    // Add the word as-is
    searchTerms.add(word);
  }

  // Step 4: Expand synonyms
  for (const term of [...searchTerms]) {
    const termLower = term.toLowerCase();
    // Direct synonym lookup
    if (SYNONYMS[termLower]) {
      SYNONYMS[termLower].slice(0, 4).forEach(s => searchTerms.add(s));
    }
    // Also check if term is IN a synonym list → add the key
    for (const [key, syns] of Object.entries(SYNONYMS)) {
      if (syns.some(s => s.toLowerCase() === termLower) && key !== termLower) {
        searchTerms.add(key);
        syns.slice(0, 2).forEach(s => searchTerms.add(s));
      }
    }
  }

  // Step 5: Auto-detect category
  for (const term of searchTerms) {
    if (CATEGORY_MAP[term] && !categoryHint) {
      categoryHint = CATEGORY_MAP[term];
      break;
    }
  }

  // Step 6: If no terms found, use original words
  if (searchTerms.size === 0) {
    nonLocationWords.forEach(w => searchTerms.add(w));
    if (nonLocationWords.length > 1) {
      searchTerms.add(nonLocationWords.join(' '));
    }
  }

  // Build corrected query
  const correctedParts = [...searchTerms].slice(0, 5);
  const corrected = correctedParts.join(' ') || rawQuery;
  return {
    corrected_query: corrected,
    search_terms: [...searchTerms].slice(0, 12),
    // Max 12 terms for broader matching
    extracted_filters: {
      ...(locationHint && {
        location: locationHint
      }),
      ...(jobTypeHint && {
        job_type: jobTypeHint
      }),
      ...(categoryHint && {
        category: categoryHint
      }),
      ...(experienceHint && {
        experience_level: experienceHint
      }),
      ...(salaryHint?.min && {
        salary_min: salaryHint.min
      }),
      ...(salaryHint?.max && {
        salary_max: salaryHint.max
      })
    }
  };
}

// ========== MAIN SERVER ==========

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: {
        headers: {
          Authorization: req.headers.get('Authorization') || ''
        }
      }
    });
    const body: JobFeedRequest = await req.json().catch(() => ({
      page: 1,
      limit: 20,
      sort: 'latest'
    }));
    const {
      action = 'feed',
      filters = {},
      page = 1,
      limit = 20,
      sort = 'latest',
      query
    } = body;

    // ===== JOOBLE EXTERNAL JOBS (India only) =====
    // Fetches supplementary job listings from Jooble to enrich the feed when
    // the platform has few internal jobs. Only Indian jobs are returned.
    if (action === 'jooble') {
      const joobleKey = Deno.env.get('JOOBLE_API_KEY');
      if (!joobleKey) {
        console.error('JOOBLE_API_KEY not configured');
        return new Response(JSON.stringify({
          success: false,
          jobs: [],
          totalCount: 0,
          error: 'Jooble not configured'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 200
        });
      }
      const rawKeywords = (body as any).keywords ?? query ?? filters?.search ?? '';
      const keywords = String(rawKeywords || '').trim() || 'jobs';
      // Force India: use provided location but always keep it within India.
      let rawLocation = String((body as any).location ?? filters?.location ?? '').trim();
      // Strip a trailing ", India" to avoid duplication, then re-append.
      rawLocation = rawLocation.replace(/,?\s*india\s*$/i, '').trim();
      const location = rawLocation ? `${rawLocation}, India` : 'India';
      try {
        const joobleResp = await fetch(`https://jooble.org/api/${joobleKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            keywords,
            location,
            page: String(page),
            ResultOnPage: Math.min(limit, 20)
          })
        });
        if (!joobleResp.ok) {
          const txt = await joobleResp.text();
          console.error('Jooble API error', joobleResp.status, txt);
          return new Response(JSON.stringify({
            success: false,
            jobs: [],
            totalCount: 0,
            error: `Jooble ${joobleResp.status}`
          }), {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            },
            status: 200
          });
        }
        const joobleData = await joobleResp.json();
        const rawJobs: any[] = Array.isArray(joobleData?.jobs) ? joobleData.jobs : [];

        // Keep only Indian jobs (Jooble sometimes returns nearby-country noise).
        const NON_INDIA = /\b(united states|usa|u\.s\.|uk|united kingdom|canada|australia|singapore|dubai|uae|germany|remote - us|philippines)\b/i;
        const normalized = rawJobs.filter(j => {
          const loc = String(j?.location || '');
          if (NON_INDIA.test(loc)) return false;
          return true;
        }).map(j => ({
          external_id: `jooble_${j.id}`,
          id: j.id,
          title: j.title || 'Job Opening',
          company: j.company || j.source || 'Company',
          location: j.location || 'India',
          salary: j.salary || '',
          type: j.type || '',
          // Keep raw HTML snippet so the details page can render formatting.
          snippet: String(j.snippet || ''),
          description: String(j.snippet || ''),
          link: j.link,
          source: j.source || 'Jooble',
          updated: j.updated || null,
          // Pass through any other useful fields Jooble may return.
          employment: j.employment || null,
          experience: j.experience || null,
          education: j.education || null,
          company_logo: j.company_logo || j.logo || null,
          company_url: j.company_url || null,
          category: j.category || null,
          currency: j.currency || null,
          // Complete raw payload so the details page can render every field.
          raw: j
        })).filter(j => j.link);
        return new Response(JSON.stringify({
          success: true,
          jobs: normalized,
          totalCount: Number(joobleData?.totalCount || normalized.length),
          page
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 200
        });
      } catch (err) {
        console.error('Jooble fetch failed', err);
        return new Response(JSON.stringify({
          success: false,
          jobs: [],
          totalCount: 0,
          error: String(err)
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 200
        });
      }
    }

    // ===== ADZUNA EXTERNAL JOBS (India only) =====
    // Mirrors the Jooble branch above. Uses ADZUNA_APP_ID + ADZUNA_APP_KEY.
    // Docs: https://developer.adzuna.com/docs/search
    if (action === 'adzuna') {
      const adzunaId = Deno.env.get('ADZUNA_APP_ID');
      const adzunaKey = Deno.env.get('ADZUNA_APP_KEY');
      if (!adzunaId || !adzunaKey) {
        console.error('ADZUNA_APP_ID / ADZUNA_APP_KEY not configured');
        return new Response(JSON.stringify({
          success: false,
          jobs: [],
          totalCount: 0,
          error: 'Adzuna not configured'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 200
        });
      }
      const rawKeywords = (body as any).keywords ?? query ?? filters?.search ?? '';
      const keywords = String(rawKeywords || '').trim();
      let rawLocation = String((body as any).location ?? filters?.location ?? '').trim();
      rawLocation = rawLocation.replace(/,?\s*india\s*$/i, '').trim();
      const country = 'in'; // India
      const perPage = Math.min(limit, 20);
      const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/${Math.max(1, page)}`);
      url.searchParams.set('app_id', adzunaId);
      url.searchParams.set('app_key', adzunaKey);
      url.searchParams.set('results_per_page', String(perPage));
      url.searchParams.set('content-type', 'application/json');
      if (keywords) url.searchParams.set('what', keywords);
      if (rawLocation) url.searchParams.set('where', rawLocation);
      if (sort === 'latest') url.searchParams.set('sort_by', 'date');else if (sort === 'salary') url.searchParams.set('sort_by', 'salary');else url.searchParams.set('sort_by', 'relevance');
      url.searchParams.set('max_days_old', '30');
      // Include Adzuna's predicted salary when the posting has no explicit one.
      url.searchParams.set('salary_include_unknown', '1');
      try {
        const adzunaResp = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });
        if (!adzunaResp.ok) {
          const txt = await adzunaResp.text();
          console.error('Adzuna API error', adzunaResp.status, txt);
          return new Response(JSON.stringify({
            success: false,
            jobs: [],
            totalCount: 0,
            error: `Adzuna ${adzunaResp.status}`
          }), {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            },
            status: 200
          });
        }
        const adzunaData = await adzunaResp.json();
        const rawJobs: any[] = Array.isArray(adzunaData?.results) ? adzunaData.results : [];
        const formatSalary = (min?: number, max?: number, predicted?: boolean): string => {
          if (!min && !max) return '';
          const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
          const base = min && max && min !== max ? `${fmt(min)} - ${fmt(max)}` : fmt((min || max) as number);
          return predicted ? `${base} (est.)` : base;
        };
        const normalized = rawJobs.map(j => {
          const loc = j?.location?.display_name || (Array.isArray(j?.location?.area) ? j.location.area.slice().reverse().join(', ') : '') || 'India';
          const isPredicted = !!(j?.salary_is_predicted && String(j.salary_is_predicted) !== '0');
          return {
            external_id: `adzuna_${j.id}`,
            id: j.id,
            title: j.title || 'Job Opening',
            company: j?.company?.display_name || 'Company',
            company_url: j?.company?.canonical_name || null,
            company_logo: null,
            location: loc,
            latitude: j?.latitude ?? null,
            longitude: j?.longitude ?? null,
            area: Array.isArray(j?.location?.area) ? j.location.area : null,
            salary: formatSalary(j?.salary_min, j?.salary_max, isPredicted),
            salary_min: j?.salary_min ?? null,
            salary_max: j?.salary_max ?? null,
            salary_is_predicted: isPredicted,
            type: j?.contract_time || j?.contract_type || '',
            contract_time: j?.contract_time || null,
            contract_type: j?.contract_type || null,
            snippet: String(j?.description || ''),
            description: String(j?.description || ''),
            link: j?.redirect_url,
            adref: j?.adref || null,
            source: 'Adzuna',
            updated: j?.created || null,
            employment: j?.contract_time || null,
            experience: null,
            education: null,
            category: j?.category?.label || null,
            category_tag: j?.category?.tag || null,
            // Complete raw payload so the details page can render every field.
            raw: j
          };
        }).filter(j => j.link);

        // ===== Salary fallback via Adzuna /histogram =====
        // Some Adzuna postings have no explicit or predicted salary. In that case
        // pull the salary histogram for the job's category (cached per request)
        // and derive a category-average band so the UI never shows a blank salary.
        try {
          const missing = normalized.filter(j => !j.salary && j.category_tag);
          if (missing.length) {
            const uniqueTags = Array.from(new Set(missing.map(j => j.category_tag as string)));
            const histCache = new Map<string, {
              min: number;
              max: number;
            } | null>();
            await Promise.all(uniqueTags.map(async tag => {
              try {
                const hUrl = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/histogram`);
                hUrl.searchParams.set('app_id', adzunaId);
                hUrl.searchParams.set('app_key', adzunaKey);
                hUrl.searchParams.set('content-type', 'application/json');
                hUrl.searchParams.set('category', tag);
                if (rawLocation) hUrl.searchParams.set('location0', rawLocation);
                const hResp = await fetch(hUrl.toString(), {
                  headers: {
                    Accept: 'application/json'
                  }
                });
                if (!hResp.ok) {
                  histCache.set(tag, null);
                  return;
                }
                const hData = await hResp.json();
                const hist: Record<string, number> = hData?.histogram || {};
                const entries = Object.entries(hist).map(([k, v]) => [Number(k), Number(v)] as [number, number]).filter(([k, v]) => Number.isFinite(k) && Number.isFinite(v) && v > 0).sort((a, b) => a[0] - b[0]);
                if (!entries.length) {
                  histCache.set(tag, null);
                  return;
                }
                const total = entries.reduce((s, [, v]) => s + v, 0);
                // Find 25th and 75th percentile salary buckets for a realistic band.
                let cum = 0;
                let p25 = entries[0][0];
                let p75 = entries[entries.length - 1][0];
                for (const [k, v] of entries) {
                  cum += v;
                  if (cum >= total * 0.25 && p25 === entries[0][0]) p25 = k;
                  if (cum >= total * 0.75) {
                    p75 = k;
                    break;
                  }
                }
                histCache.set(tag, {
                  min: p25,
                  max: p75
                });
              } catch {
                histCache.set(tag, null);
              }
            }));
            const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
            for (const j of normalized) {
              if (j.salary || !j.category_tag) continue;
              const band = histCache.get(j.category_tag);
              if (!band) continue;
              const label = band.min !== band.max ? `${fmt(band.min)} - ${fmt(band.max)} (category avg.)` : `${fmt(band.min)} (category avg.)`;
              j.salary = label;
              j.salary_min = band.min;
              j.salary_max = band.max;
              j.salary_is_predicted = true;
            }
          }
        } catch (fallbackErr) {
          console.error('Adzuna salary histogram fallback failed', fallbackErr);
        }
        return new Response(JSON.stringify({
          success: true,
          jobs: normalized,
          totalCount: Number(adzunaData?.count || normalized.length),
          page
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 200
        });
      } catch (err) {
        console.error('Adzuna fetch failed', err);
        return new Response(JSON.stringify({
          success: false,
          jobs: [],
          totalCount: 0,
          error: String(err)
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 200
        });
      }
    }

    // ===== CAREERJET EXTERNAL JOBS (India only) =====
    // Mirrors the Adzuna/Jooble branches. Uses CAREERJET_AFFID.
    // Docs: https://www.careerjet.com/partners/api/  (Public Search API)
    // Endpoint: http://public.api.careerjet.net/search
    // Required params: affid, user_ip, user_agent, url
    // Optional: keywords, location, sort, page, pagesize, locale_code
    if (action === 'careerjet') {
      const affid = Deno.env.get('CAREERJET_AFFID');
      if (!affid) {
        console.error('CAREERJET_AFFID not configured');
        return new Response(JSON.stringify({
          success: false,
          jobs: [],
          totalCount: 0,
          error: 'Careerjet not configured'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 200
        });
      }
      const rawKeywords = (body as any).keywords ?? query ?? filters?.search ?? '';
      const keywords = String(rawKeywords || '').trim();
      let rawLocation = String((body as any).location ?? filters?.location ?? '').trim();
      rawLocation = rawLocation.replace(/,?\s*india\s*$/i, '').trim();
      const perPage = Math.min(limit, 99); // Careerjet allows up to 99
      const userIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || '8.8.8.8';
      const browserUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
      const userAgent = req.headers.get('user-agent') || browserUA;
      const callerUrl = req.headers.get('referer') || req.headers.get('origin') || `${WEBSITE_DOMAIN}/jobs`;

      // Careerjet Public Search API — full parameter set per docs:
      // https://www.careerjet.com/partners/api/
      // params: affid, user_ip, user_agent, url, keywords, location,
      //         sort (relevance|date|salary), page, pagesize,
      //         contracttype (c/p/t/i/v), contractperiod (f/p), locale_code
      const cjUrl = new URL('http://public.api.careerjet.net/search');
      cjUrl.searchParams.set('affid', affid);
      cjUrl.searchParams.set('user_ip', userIp);
      cjUrl.searchParams.set('user_agent', userAgent);
      cjUrl.searchParams.set('url', callerUrl);
      cjUrl.searchParams.set('locale_code', String((body as any).locale_code || 'en_IN'));
      cjUrl.searchParams.set('page', String(Math.max(1, page)));
      cjUrl.searchParams.set('pagesize', String(perPage));
      if (keywords) cjUrl.searchParams.set('keywords', keywords);
      cjUrl.searchParams.set('location', rawLocation || 'India');
      if (sort === 'latest') cjUrl.searchParams.set('sort', 'date');else if (sort === 'salary') cjUrl.searchParams.set('sort', 'salary');else cjUrl.searchParams.set('sort', 'relevance');

      // Map generic job_type filter → Careerjet contracttype / contractperiod.
      // c=contract, p=permanent, t=temporary, i=internship/training, v=voluntary
      // f=full-time, p=part-time
      const jt = String(filters?.job_type || (body as any).contract_type || '').toLowerCase();
      const explicitCT = String((body as any).contracttype || '').toLowerCase();
      const explicitCP = String((body as any).contractperiod || '').toLowerCase();
      if (explicitCT && /^[cptiv]$/.test(explicitCT)) {
        cjUrl.searchParams.set('contracttype', explicitCT);
      } else if (jt) {
        if (/contract/.test(jt)) cjUrl.searchParams.set('contracttype', 'c');else if (/permanent|full[\s_-]?time/.test(jt)) cjUrl.searchParams.set('contracttype', 'p');else if (/temp/.test(jt)) cjUrl.searchParams.set('contracttype', 't');else if (/intern|trainee|training/.test(jt)) cjUrl.searchParams.set('contracttype', 'i');else if (/volunt/.test(jt)) cjUrl.searchParams.set('contracttype', 'v');
      }
      if (explicitCP && /^[fp]$/.test(explicitCP)) {
        cjUrl.searchParams.set('contractperiod', explicitCP);
      } else if (jt) {
        if (/part[\s_-]?time/.test(jt)) cjUrl.searchParams.set('contractperiod', 'p');else if (/full[\s_-]?time/.test(jt)) cjUrl.searchParams.set('contractperiod', 'f');
      }
      try {
        const cjResp = await fetch(cjUrl.toString(), {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'User-Agent': browserUA,
            Referer: callerUrl
          }
        });
        if (!cjResp.ok) {
          const txt = await cjResp.text();
          console.error('Careerjet API error', cjResp.status, txt);
          return new Response(JSON.stringify({
            success: false,
            jobs: [],
            totalCount: 0,
            error: `Careerjet ${cjResp.status}`,
            details: txt.slice(0, 300)
          }), {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            },
            status: 200
          });
        }
        const cjData = await cjResp.json();
        if (cjData?.type && cjData.type !== 'JOBS') {
          console.error('Careerjet non-JOBS response', cjData?.type, cjData?.error);
          return new Response(JSON.stringify({
            success: false,
            jobs: [],
            totalCount: 0,
            error: `Careerjet ${cjData.type}${cjData?.error ? `: ${cjData.error}` : ''}`,
            suggestions: cjData?.solutions || cjData?.locations || null
          }), {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            },
            status: 200
          });
        }
        const rawJobs: any[] = Array.isArray(cjData?.jobs) ? cjData.jobs : [];
        const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
        const formatSalary = (raw?: string, min?: number, max?: number, currency?: string, salaryType?: string): string => {
          if (raw && String(raw).trim()) return String(raw).trim();
          if (!min && !max) return '';
          const isINR = !currency || String(currency).toUpperCase() === 'INR';
          const suffix = salaryType ? ` /${String(salaryType).toLowerCase()}` : '';
          if (isINR) {
            const base = min && max && min !== max ? `${fmt(min)} - ${fmt(max)}` : fmt((min || max) as number);
            return base + suffix;
          }
          const cur = String(currency).toUpperCase();
          const f = (n: number) => `${cur} ${Math.round(n).toLocaleString('en-IN')}`;
          const base = min && max && min !== max ? `${f(min)} - ${f(max)}` : f((min || max) as number);
          return base + suffix;
        };
        const stripHtml = (s: string) => String(s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

        // Careerjet doesn't return logos — derive a best-effort Clearbit URL
        // from the company name so cards/detail page display something.
        const guessLogo = (company?: string): string | null => {
          if (!company) return null;
          const slug = String(company).toLowerCase().replace(/&/g, 'and').replace(/\b(inc|llc|ltd|pvt|private|limited|corp|corporation|co|company|technologies|tech|solutions|services|group)\b\.?/g, '').replace(/[^a-z0-9]/g, '').trim();
          return slug.length >= 2 ? `https://logo.clearbit.com/${slug}.com` : null;
        };
        const normalized = rawJobs.map(j => {
          const desc = stripHtml(j?.description || '');
          const idBase = j?.url ? j.url : `${j?.title || 'job'}_${j?.company || ''}_${j?.date || ''}`;
          const id = j?.url ? j.url : idBase;
          const salaryString = formatSalary(j?.salary, j?.salary_min, j?.salary_max, j?.salary_currency_code, j?.salary_type);
          return {
            external_id: `careerjet_${btoa(unescape(encodeURIComponent(String(id)))).slice(0, 40)}`,
            id: String(id),
            title: j?.title || 'Job Opening',
            company: j?.company || 'Company',
            company_url: j?.url || null,
            company_logo: guessLogo(j?.company),
            location: j?.locations || 'India',
            latitude: j?.latitude ?? null,
            longitude: j?.longitude ?? null,
            area: null,
            salary: salaryString,
            salary_min: j?.salary_min ?? null,
            salary_max: j?.salary_max ?? null,
            salary_is_predicted: false,
            currency: j?.salary_currency_code || null,
            type: j?.salary_type || '',
            contract_time: j?.contractperiod_name || null,
            contract_type: j?.contracttype_name || null,
            snippet: desc,
            description: desc,
            link: j?.url,
            adref: null,
            source: j?.site ? `Careerjet · ${j.site}` : 'Careerjet',
            updated: j?.date || null,
            employment: j?.contractperiod_name || null,
            experience: null,
            education: null,
            category: j?.site || null,
            category_tag: null,
            raw: j
          };
        }).filter(j => j.link);
        return new Response(JSON.stringify({
          success: true,
          jobs: normalized,
          totalCount: Number(cjData?.hits || normalized.length),
          page,
          pages: Number(cjData?.pages || 1)
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 200
        });
      } catch (err) {
        console.error('Careerjet fetch failed', err);
        return new Response(JSON.stringify({
          success: false,
          jobs: [],
          totalCount: 0,
          error: String(err)
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 200
        });
      }
    }

    // ===== ADZUNA AUX SERVICES (India) =====
    // Full API coverage so nothing is left pending:
    //   /categories  – job category list
    //   /top_companies – top hiring companies for a keyword
    //   /histogram   – salary histogram
    //   /geodata     – jobs by region
    //   /history     – historical salary trend
    // Client passes { action, keywords?, location?, category? }.
    if (action === 'adzuna-categories' || action === 'adzuna-top-companies' || action === 'adzuna-histogram' || action === 'adzuna-geodata' || action === 'adzuna-history') {
      const adzunaId = Deno.env.get('ADZUNA_APP_ID');
      const adzunaKey = Deno.env.get('ADZUNA_APP_KEY');
      if (!adzunaId || !adzunaKey) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Adzuna not configured'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 200
        });
      }
      const country = 'in';
      const endpointMap: Record<string, string> = {
        'adzuna-categories': `https://api.adzuna.com/v1/api/jobs/${country}/categories`,
        'adzuna-top-companies': `https://api.adzuna.com/v1/api/jobs/${country}/top_companies`,
        'adzuna-histogram': `https://api.adzuna.com/v1/api/jobs/${country}/histogram`,
        'adzuna-geodata': `https://api.adzuna.com/v1/api/jobs/${country}/geodata`,
        'adzuna-history': `https://api.adzuna.com/v1/api/jobs/${country}/history`
      };
      const url = new URL(endpointMap[action]);
      url.searchParams.set('app_id', adzunaId);
      url.searchParams.set('app_key', adzunaKey);
      url.searchParams.set('content-type', 'application/json');
      const kw = String((body as any).keywords ?? query ?? filters?.search ?? '').trim();
      const loc = String((body as any).location ?? filters?.location ?? '').replace(/,?\s*india\s*$/i, '').trim();
      const cat = String((body as any).category ?? filters?.category ?? '').trim();
      if (kw && action !== 'adzuna-categories') url.searchParams.set('what', kw);
      if (loc && action !== 'adzuna-categories') url.searchParams.set('where', loc);
      if (cat && (action === 'adzuna-histogram' || action === 'adzuna-history' || action === 'adzuna-top-companies')) {
        url.searchParams.set('category', cat);
      }
      if (action === 'adzuna-history') url.searchParams.set('months', '12');
      const cacheKey = `${action}|${url.searchParams.toString()}`;
      const now = Date.now();
      const cached = ADZUNA_AUX_CACHE.get(cacheKey);
      if (cached && cached.expiresAt > now) {
        return new Response(JSON.stringify(cached.payload), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 200
        });
      }

      // L2: shared 24h DB cache (adzuna_insights_cache). Prevents multiple
      // edge-function instances (or a cold start) from each hitting Adzuna
      // for the same category. Category endpoints change slowly (~daily),
      // so a 24h shared cache is safe and drops upstream calls dramatically.
      const cacheAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });
      try {
        const {
          data: dbHit
        } = await cacheAdmin.from('adzuna_insights_cache').select('data, expires_at').eq('cache_key', cacheKey).gt('expires_at', new Date().toISOString()).maybeSingle();
        if (dbHit?.data) {
          const payload = {
            success: true,
            action,
            data: dbHit.data,
            cached: 'db-24h'
          };
          ADZUNA_AUX_CACHE.set(cacheKey, {
            payload,
            expiresAt: now + 30 * 60_000
          });
          return new Response(JSON.stringify(payload), {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            },
            status: 200
          });
        }
      } catch (e) {
        console.warn('[adzuna-cache] db read failed, falling through to Adzuna:', e);
      }
      try {
        const r = await fetch(url.toString(), {
          headers: {
            Accept: 'application/json'
          }
        });
        const txt = await r.text();
        if (!r.ok) {
          console.error(`Adzuna ${action} error`, r.status, txt);
          const errPayload = {
            success: false,
            error: r.status === 429 ? 'Data temporarily unavailable, please try again in a moment.' : `Adzuna ${r.status}`,
            details: txt,
            status: r.status
          };
          // Cache 429s briefly to avoid hammering the upstream rate limit.
          if (r.status === 429) {
            ADZUNA_AUX_CACHE.set(cacheKey, {
              payload: errPayload,
              expiresAt: now + 60_000
            });
          }
          return new Response(JSON.stringify(errPayload), {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            },
            status: 200
          });
        }
        let data: any = {};
        try {
          data = JSON.parse(txt);
        } catch {
          data = {
            raw: txt
          };
        }
        const payload = {
          success: true,
          action,
          data
        };
        // Cache aux responses for 30 minutes — these change slowly.
        ADZUNA_AUX_CACHE.set(cacheKey, {
          payload,
          expiresAt: now + 30 * 60_000
        });
        // Persist to shared 24h DB cache so other instances / next-day
        // callers get an instant hit without touching Adzuna.
        try {
          const {
            error: upErr
          } = await cacheAdmin.from('adzuna_insights_cache').upsert({
            cache_key: cacheKey,
            action,
            keywords: kw || null,
            location: loc || null,
            category: cat || null,
            data,
            fetched_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 24 * 60 * 60_000).toISOString()
          }, {
            onConflict: 'cache_key'
          });
          if (upErr) console.error('[adzuna-cache] upsert error:', upErr.message);
        } catch (e) {
          console.warn('[adzuna-cache] db upsert failed:', e);
        }
        return new Response(JSON.stringify(payload), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 200
        });
      } catch (err) {
        console.error(`Adzuna ${action} fetch failed`, err);
        return new Response(JSON.stringify({
          success: false,
          error: String(err)
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          status: 200
        });
      }
    }
    const JOB_SELECT = `
      id, short_id, public_slug, title, location, salary_range, salary_min, salary_max,
      experience_level, job_type, skills, category, description, status, created_at,
      applications_count, views_count, calls_count, shares_count, is_boosted, boost_level, trending_score,
      trending_rank, organic_rank, city, state, country, remote_allowed,
      education_required, work_mode, shift_timing, openings,
      api_company_name, company_id,
      companies!left(company_name, logo_url, is_verified, badge_color, verified_plan_end, slug)
    `;
    const transformJob = (job: any) => ({
      ...job,
      company_name: job.companies?.company_name || job.api_company_name || 'Unknown Company',
      company_logo: job.companies?.logo_url || null,
      company_verified: job.companies?.is_verified || false,
      company_badge_color: job.companies?.badge_color || null,
      company_slug: job.companies?.slug || null
    });

    // ===== SMART SEARCH =====
    if (action === 'ai-search' && query) {
      const startTime = Date.now();
      const smartResult = processSmartQuery(query);
      const {
        search_terms,
        extracted_filters
      } = smartResult;
      const offset = (page - 1) * limit;
      let data: any[] | null = null;
      let count: number | null = null;
      let searchMethod = 'direct';

      // Strategy 0: DIRECT MATCH — respect exactly what the user typed.
      // Try the raw query as a phrase against title + company + description
      // BEFORE synonym expansion. This ensures "Kotak Mahindra Bank" returns
      // Kotak jobs, not any accounting job pulled in by finance synonyms.
      const rawTerm = query.trim().replace(/[%,()]/g, ' ').slice(0, 120);
      if (rawTerm.length >= 2) {
        const directConditions = [`title.ilike.%${rawTerm}%`, `api_company_name.ilike.%${rawTerm}%`, `description.ilike.%${rawTerm}%`].join(',');
        const {
          data: directData,
          count: directCount
        } = await supabaseClient.from('jobs').select(JOB_SELECT, {
          count: 'exact'
        }).eq('status', 'active').or(directConditions).order('is_boosted', {
          ascending: false
        }).order('trending_score', {
          ascending: false,
          nullsFirst: false
        }).order('created_at', {
          ascending: false
        }).range(offset, offset + limit - 1);
        if (directData && directData.length > 0) {
          data = directData.map(transformJob);
          count = directCount;
        }
      }

      // Strategy 1: Full-text search using tsvector (fallback)
      let tsQuery = search_terms.slice(0, 6).map(t => t.replace(/[^a-zA-Z0-9\s]/g, '').trim()).filter(t => t.length >= 2).map(t => t.split(/\s+/).join(' & ')).join(' | ');
      if ((!data || data.length === 0) && tsQuery) {
        searchMethod = 'fulltext';
        try {
          const {
            data: ftsData,
            error: ftsError
          } = await supabaseClient.rpc('search_jobs_fts', {
            search_query: tsQuery,
            result_limit: limit,
            result_offset: offset,
            location_filter: extracted_filters.location || null,
            job_type_filter: extracted_filters.job_type || null
          });
          if (!ftsError && ftsData && ftsData.length > 0) {
            data = ftsData;
            count = Array.isArray(ftsData) ? ftsData.length : 0;
            searchMethod = 'fulltext';
          }
        } catch (e) {}
      }

      // Strategy 2: Multi-condition ilike search with all extracted filters
      if (!data || data.length === 0) {
        searchMethod = 'ilike';

        // Build OR conditions from all search terms
        const searchConditions = search_terms.slice(0, 8).flatMap(term => [`title.ilike.%${term}%`, `description.ilike.%${term}%`, `category.ilike.%${term}%`]).join(',');
        let searchQuery = supabaseClient.from('jobs').select(JOB_SELECT, {
          count: 'exact'
        }).eq('status', 'active').or(searchConditions);

        // Apply extracted filters
        if (extracted_filters.location) {
          searchQuery = searchQuery.or(`location.ilike.%${extracted_filters.location}%,city.ilike.%${extracted_filters.location}%,state.ilike.%${extracted_filters.location}%`);
        }
        if (extracted_filters.experience_level) {
          searchQuery = searchQuery.eq('experience_level', extracted_filters.experience_level);
        }
        if (extracted_filters.salary_min) {
          searchQuery = searchQuery.gte('salary_max', extracted_filters.salary_min);
        }
        if (extracted_filters.salary_max) {
          searchQuery = searchQuery.lte('salary_min', extracted_filters.salary_max);
        }
        searchQuery = searchQuery.order('is_boosted', {
          ascending: false
        }).order('trending_score', {
          ascending: false,
          nullsFirst: false
        }).order('created_at', {
          ascending: false
        }).range(offset, offset + limit - 1);
        const result = await searchQuery;
        if (!result.error) {
          data = (result.data || []).map(transformJob);
          count = result.count;
        }
      }

      // Strategy 3: Skills-based search (search in skills array)
      if (!data || data.length === 0) {
        searchMethod = 'skills';
        const skillTerms = search_terms.filter(t => t.length >= 3).slice(0, 5);
        if (skillTerms.length > 0) {
          const skillConditions = skillTerms.map(t => `skills.cs.{${t}}`).join(',');
          const {
            data: skillData,
            count: skillCount
          } = await supabaseClient.from('jobs').select(JOB_SELECT, {
            count: 'exact'
          }).eq('status', 'active').or(skillConditions).order('trending_score', {
            ascending: false,
            nullsFirst: false
          }).range(offset, offset + limit - 1);
          if (skillData && skillData.length > 0) {
            data = skillData.map(transformJob);
            count = skillCount;
          }
        }
      }

      // Strategy 4: Category-based fallback
      if ((!data || data.length === 0) && extracted_filters.category) {
        searchMethod = 'category';
        const {
          data: catData,
          count: catCount
        } = await supabaseClient.from('jobs').select(JOB_SELECT, {
          count: 'exact'
        }).eq('status', 'active').ilike('category', `%${extracted_filters.category}%`).order('is_boosted', {
          ascending: false
        }).order('trending_score', {
          ascending: false,
          nullsFirst: false
        }).range(offset, offset + limit - 1);
        if (catData && catData.length > 0) {
          data = catData.map(transformJob);
          count = catCount;
        }
      }

      // Strategy 5: Trending fallback (never empty)
      let isFallback = false;
      if (!data || data.length === 0) {
        isFallback = true;
        searchMethod = 'fallback';
        const {
          data: fallbackJobs,
          count: fallbackCount
        } = await supabaseClient.from('jobs').select(JOB_SELECT, {
          count: 'exact'
        }).eq('status', 'active').order('is_boosted', {
          ascending: false
        }).order('trending_score', {
          ascending: false,
          nullsFirst: false
        }).order('created_at', {
          ascending: false
        }).range(offset, offset + limit - 1);
        data = (fallbackJobs || []).map(transformJob);
        count = fallbackCount;
      }
      const elapsed = Date.now() - startTime;
      return new Response(JSON.stringify({
        success: true,
        data: data || [],
        is_fallback: isFallback,
        ai_interpretation: {
          original_query: query,
          corrected_query: smartResult.corrected_query,
          search_terms: smartResult.search_terms,
          extracted_filters: smartResult.extracted_filters,
          intent: 'search'
        },
        pagination: {
          page,
          limit,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limit),
          has_more: offset + limit < (count || 0)
        },
        search_method: searchMethod,
        search_time_ms: elapsed,
        timestamp: new Date().toISOString()
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=30'
        },
        status: 200
      });
    }

    // ===== REGULAR JOB FEED =====

    let feedQuery = supabaseClient.from('jobs').select(JOB_SELECT, {
      count: 'exact'
    }).eq('status', 'active');
    if (filters.location) {
      feedQuery = feedQuery.or(`location.ilike.%${filters.location}%,city.ilike.%${filters.location}%,state.ilike.%${filters.location}%`);
    }
    if (filters.experience_level) {
      feedQuery = feedQuery.eq('experience_level', filters.experience_level);
    }
    if (filters.remote_allowed !== undefined) {
      feedQuery = feedQuery.eq('remote_allowed', filters.remote_allowed);
    }
    if (filters.category) {
      feedQuery = feedQuery.ilike('category', `%${filters.category}%`);
    }
    if (filters.job_type) {
      feedQuery = feedQuery.eq('job_type', filters.job_type);
    }
    if (filters.min_salary) {
      feedQuery = feedQuery.gte('salary_min', filters.min_salary);
    }
    if (filters.max_salary) {
      feedQuery = feedQuery.lte('salary_max', filters.max_salary);
    }
    if (filters.skills && filters.skills.length > 0) {
      feedQuery = feedQuery.overlaps('skills', filters.skills);
    }
    if (filters.search) {
      feedQuery = feedQuery.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }
    switch (sort) {
      case 'salary':
        feedQuery = feedQuery.order('salary_max', {
          ascending: false,
          nullsFirst: false
        });
        break;
      case 'relevance':
        feedQuery = feedQuery.order('applications_count', {
          ascending: false,
          nullsFirst: false
        });
        break;
      case 'trending':
        feedQuery = feedQuery.order('is_boosted', {
          ascending: false
        }).order('trending_score', {
          ascending: false,
          nullsFirst: false
        });
        break;
      case 'latest':
      default:
        feedQuery = feedQuery.order('is_boosted', {
          ascending: false
        }).order('created_at', {
          ascending: false
        });
    }
    const offset = (page - 1) * limit;
    feedQuery = feedQuery.range(offset, offset + limit - 1);
    const {
      data,
      error,
      count
    } = await feedQuery;
    if (error) {
      console.error('❌ Job feed query error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 500
      });
    }
    const transformedData = (data || []).map(transformJob);
    return new Response(JSON.stringify({
      success: true,
      data: transformedData,
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
        has_more: offset + limit < (count || 0)
      },
      filters_applied: filters,
      sort_applied: sort,
      timestamp: new Date().toISOString()
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60, s-maxage=120, stale-while-revalidate=300'
      },
      status: 200
    });
  } catch (error) {
    console.error('❌ Job feed error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});