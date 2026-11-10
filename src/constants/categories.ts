// Comprehensive A-Z Job Categories and Skills for Job Postings
// Centralized constants for consistent use across all components

// ===== JOB CATEGORIES (A-Z) =====
export const JOB_CATEGORIES = [
  "Accounting & Finance",
  "Administrative & Clerical", 
  "Agriculture & Farming",
  "Architecture & Construction",
  "Arts & Entertainment",
  "Automotive",
  "Banking & Insurance",
  "Beauty & Wellness",
  "Business Development",
  "Call Center & BPO",
  "Consulting & Strategy",
  "Construction & Real Estate",
  "Content Writing & Creation",
  "Customer Service",
  "Data Entry & Processing",
  "Data Science & Analytics", 
  "Design & Creative",
  "Digital Marketing",
  "E-commerce & Retail",
  "Education & Training",
  "Engineering",
  "Environmental Services",
  "Event Management",
  "Fashion & Textiles",
  "Finance & Investment",
  "Food & Beverage",
  "Government & Public Service",
  "Graphic Design",
  "Healthcare & Medical",
  "Hospitality & Tourism",
  "Human Resources",
  "Information Technology",
  "Insurance",
  "Journalism & Media",
  "Legal Services",
  "Logistics & Supply Chain",
  "Manufacturing",
  "Marketing & Advertising",
  "Non-Profit & NGO",
  "Oil & Gas",
  "Operations & Management",
  "Pharmaceutical",
  "Photography & Videography",
  "Project Management",
  "Quality Assurance",
  "Research & Development",
  "Sales & Business Development",
  "Security Services",
  "Social Media Management",
  "Software Development",
  "Sports & Fitness",
  "Teaching & Tutoring",
  "Telecommunications",
  "Transportation & Delivery",
  "Travel & Tourism",
  "Utilities",
  "Virtual Assistant",
  "Web Development",
  "Other"
] as const;

// ===== DEPARTMENTS (A-Z) =====
export const DEPARTMENTS = [
  "Administration",
  "Business Development", 
  "Content Creation",
  "Customer Service",
  "Data Analytics",
  "Design",
  "Engineering",
  "Finance",
  "Human Resources",
  "IT Support",
  "Legal",
  "Marketing", 
  "Operations",
  "Product",
  "Project Management",
  "Public Relations",
  "Quality Assurance",
  "Research & Development",
  "Sales",
  "Supply Chain"
] as const;

// ===== SKILLS CATEGORIES (A-Z with comprehensive skills) =====
export const SKILLS_CATEGORIES = {
  "Accounting & Finance": [
    "Accounting", "Bookkeeping", "Tax Preparation", "Financial Analysis", "Budget Management",
    "Financial Planning", "Investment Analysis", "Auditing", "QuickBooks", "Excel Advanced",
    "Financial Modeling", "Cost Accounting", "Payroll Management", "GST Filing", "Tally ERP",
    "SAP Finance", "Oracle Financials", "Cash Flow Management", "Risk Assessment", "Credit Analysis"
  ],
  "Administrative & Office": [
    "Data Entry", "Microsoft Office", "Google Workspace", "Administrative Support", "Office Management",
    "Document Management", "Calendar Management", "Travel Planning", "Meeting Coordination", "Filing Systems",
    "Reception Duties", "Phone Etiquette", "Email Management", "Record Keeping", "Scheduling",
    "Multi-tasking", "Time Management", "Office Equipment", "Database Management", "Typing Speed"
  ],
  "Artificial Intelligence & Machine Learning": [
    "Machine Learning", "Deep Learning", "Natural Language Processing", "Computer Vision", "Neural Networks",
    "TensorFlow", "PyTorch", "Scikit-learn", "OpenCV", "NLTK", "Keras", "MLflow", "AI Model Deployment",
    "Reinforcement Learning", "Feature Engineering", "Model Optimization", "AI Ethics", "AutoML", "GPT Models", "LangChain"
  ],
  "Business & Management": [
    "Project Management", "Team Leadership", "Strategic Planning", "Business Analysis", "Process Improvement",
    "Change Management", "Risk Management", "Quality Management", "Operations Management", "Vendor Management",
    "Budget Planning", "Performance Management", "Stakeholder Management", "Agile Methodology", "Scrum Master",
    "PMP Certification", "Six Sigma", "Lean Management", "KPI Development", "Business Intelligence"
  ],
  "Cloud & Infrastructure": [
    "Amazon Web Services", "Microsoft Azure", "Google Cloud Platform", "Docker", "Kubernetes", "DevOps",
    "CI/CD", "Infrastructure as Code", "Terraform", "Ansible", "Jenkins", "GitHub Actions", "Cloud Security",
    "Serverless Architecture", "Microservices", "Load Balancing", "Auto Scaling", "Cloud Migration", "Monitoring", "Logging"
  ],
  "Content & Writing": [
    "Content Writing", "Copywriting", "Technical Writing", "Creative Writing", "Blog Writing", "SEO Writing",
    "Social Media Content", "Email Marketing", "Press Releases", "Grant Writing", "Academic Writing",
    "Proofreading", "Editing", "Content Strategy", "Storytelling", "Brand Voice", "Content Marketing",
    "Newsletter Writing", "Product Descriptions", "Web Content"
  ],
  "Customer Service & Support": [
    "Customer Support", "Technical Support", "Live Chat Support", "Email Support", "Phone Support",
    "Help Desk", "CRM Software", "Zendesk", "Salesforce", "Customer Success", "Complaint Resolution",
    "Product Knowledge", "Cross-selling", "Upselling", "Customer Retention", "Service Excellence",
    "Multi-channel Support", "Escalation Management", "Customer Feedback", "Support Documentation"
  ],
  "Cybersecurity": [
    "Information Security", "Network Security", "Ethical Hacking", "Penetration Testing", "Security Auditing",
    "Compliance", "Risk Assessment", "Incident Response", "Vulnerability Management", "SIEM Tools",
    "Firewall Configuration", "Identity Management", "Access Control", "Encryption", "Security Policies",
    "CISSP", "CEH", "CompTIA Security+", "ISO 27001", "GDPR Compliance"
  ],
  "Data Science & Analytics": [
    "Data Analysis", "Statistics", "Python", "R Programming", "SQL", "Data Visualization", "Tableau",
    "Power BI", "Excel", "Pandas", "NumPy", "Matplotlib", "Seaborn", "Big Data", "Hadoop", "Spark",
    "ETL Processes", "Data Mining", "Predictive Analytics", "A/B Testing", "Data Cleaning", "Business Intelligence"
  ],
  "Design & Creative": [
    "Graphic Design", "UI/UX Design", "Web Design", "Logo Design", "Branding", "Adobe Photoshop",
    "Adobe Illustrator", "Adobe InDesign", "Figma", "Sketch", "Canva", "CorelDRAW", "Layout Design",
    "Typography", "Color Theory", "Print Design", "Digital Design", "Mockups", "Prototyping", "Design Thinking"
  ],
  "Digital Marketing & SEO": [
    "Search Engine Optimization", "Google Ads", "Facebook Ads", "Social Media Marketing", "Content Marketing",
    "Email Marketing", "Affiliate Marketing", "Influencer Marketing", "Google Analytics", "Keyword Research",
    "Link Building", "PPC Campaign", "Conversion Optimization", "Marketing Automation", "Lead Generation",
    "Brand Management", "Online Reputation", "Marketing Strategy", "Campaign Management", "ROI Analysis"
  ],
  "E-commerce & Retail": [
    "Amazon Seller Central", "Shopify", "WooCommerce", "Product Listing", "Inventory Management", "Order Processing",
    "Customer Service", "Product Photography", "Marketplace Management", "Dropshipping", "Supply Chain",
    "Pricing Strategy", "Category Management", "Vendor Relations", "Sales Analysis", "Return Management",
    "Payment Processing", "Shipping Coordination", "Cross-selling", "Upselling"
  ],
  "Engineering & Technical": [
    "Mechanical Engineering", "Electrical Engineering", "Civil Engineering", "Chemical Engineering", "AutoCAD",
    "SolidWorks", "MATLAB", "Technical Documentation", "Quality Control", "Safety Protocols", "Project Planning",
    "Equipment Maintenance", "Troubleshooting", "Process Engineering", "Design Engineering", "Manufacturing",
    "Testing Procedures", "Compliance Standards", "Technical Analysis", "System Integration"
  ],
  "Healthcare & Medical": [
    "Medical Coding", "Healthcare Administration", "Patient Care", "Medical Terminology", "HIPAA Compliance",
    "Electronic Health Records", "Medical Billing", "Clinical Research", "Healthcare Quality", "Patient Safety",
    "Medical Writing", "Pharmacy Knowledge", "Nursing Care", "Diagnostic Procedures", "Treatment Planning",
    "Health Education", "Medical Documentation", "Insurance Claims", "Healthcare Analytics", "Telemedicine"
  ],
  "Human Resources": [
    "Recruitment", "Talent Acquisition", "Employee Relations", "Performance Management", "HR Policies",
    "Compensation & Benefits", "Training & Development", "HRIS Systems", "Labor Law Compliance", "Payroll Processing",
    "Employee Engagement", "Conflict Resolution", "Organizational Development", "Succession Planning", "HR Analytics",
    "Onboarding", "Exit Interviews", "Diversity & Inclusion", "Employee Wellness", "HR Strategy"
  ],
  "Information Technology": [
    "Software Development", "System Administration", "Network Administration", "Database Management", "IT Support",
    "Help Desk", "Hardware Troubleshooting", "Software Installation", "System Security", "Backup & Recovery",
    "Server Management", "Cloud Computing", "Virtualization", "IT Strategy", "Technology Planning",
    "Vendor Management", "IT Compliance", "Disaster Recovery", "IT Documentation", "User Training"
  ],
  "Languages": [
    "English", "Hindi", "Tamil", "Telugu", "Marathi", "Gujarati", "Bengali", "Kannada", "Malayalam", "Punjabi",
    "Urdu", "Odia", "Assamese", "Sanskrit", "Spanish", "French", "German", "Chinese", "Japanese", "Korean",
    "Arabic", "Portuguese", "Russian", "Italian", "Translation", "Interpretation", "Multilingual Support"
  ],
  "Legal & Compliance": [
    "Legal Research", "Contract Management", "Compliance Monitoring", "Regulatory Affairs", "Legal Documentation",
    "Intellectual Property", "Corporate Law", "Employment Law", "Contract Negotiation", "Legal Writing",
    "Litigation Support", "Due Diligence", "Risk Management", "Legal Analysis", "Court Procedures",
    "Legal Technology", "Case Management", "Legal Ethics", "Dispute Resolution", "Legal Advisory"
  ],
  "Manufacturing & Production": [
    "Production Planning", "Quality Control", "Lean Manufacturing", "Six Sigma", "Supply Chain Management",
    "Inventory Control", "Equipment Operation", "Safety Procedures", "Process Optimization", "Production Scheduling",
    "Materials Management", "Cost Control", "Efficiency Improvement", "Maintenance Management", "Production Reports",
    "Standard Operating Procedures", "Continuous Improvement", "Waste Reduction", "Production Metrics", "Team Leadership"
  ],
  "Mobile Development": [
    "React Native", "Flutter", "iOS Development", "Android Development", "Swift", "Kotlin", "Java",
    "Objective-C", "Xamarin", "Ionic", "PhoneGap", "Cordova", "Mobile UI/UX", "App Store Optimization",
    "Mobile Testing", "Cross-platform Development", "Native Development", "Mobile Security", "Push Notifications", "Mobile Analytics"
  ],
  "Photography & Video": [
    "Photography", "Video Production", "Photo Editing", "Video Editing", "Adobe Premiere Pro", "Final Cut Pro",
    "Adobe After Effects", "Lightroom", "Photoshop", "Camera Operation", "Lighting", "Composition",
    "Color Grading", "Motion Graphics", "Animation", "Documentary Production", "Commercial Photography",
    "Portrait Photography", "Event Photography", "Product Photography"
  ],
  "Programming Languages": [
    "JavaScript", "Python", "Java", "C++", "C#", "PHP", "Ruby", "Go", "Rust", "Swift", "Kotlin", "Dart",
    "TypeScript", "Scala", "R", "MATLAB", "Perl", "Shell Scripting", "VB.NET", "Objective-C", "C",
    "Assembly Language", "Haskell", "Erlang", "Clojure", "F#", "Lua", "Groovy", "Pascal", "COBOL"
  ],
  "Project Management": [
    "Agile Methodology", "Scrum", "Kanban", "Waterfall", "Project Planning", "Resource Management", "Risk Management",
    "Budget Management", "Timeline Management", "Stakeholder Communication", "Team Coordination", "Quality Assurance",
    "Project Documentation", "Change Management", "Performance Tracking", "Project Reporting", "Vendor Management",
    "Contract Management", "Project Closure", "Lessons Learned"
  ],
  "Sales & Business Development": [
    "Sales Strategy", "Lead Generation", "Account Management", "Business Development", "Client Relations",
    "Negotiation", "Closing Deals", "Sales Presentations", "CRM Management", "Pipeline Management",
    "Territory Management", "Channel Sales", "B2B Sales", "B2C Sales", "Inside Sales", "Field Sales",
    "Sales Analytics", "Forecasting", "Customer Acquisition", "Revenue Growth"
  ],
  "Social Media & Community": [
    "Social Media Management", "Community Management", "Social Media Strategy", "Content Creation", "Facebook Marketing",
    "Instagram Marketing", "LinkedIn Marketing", "Twitter Marketing", "YouTube Marketing", "TikTok Marketing",
    "Social Media Analytics", "Influencer Outreach", "Brand Management", "Online Engagement", "Social Listening",
    "Content Calendar", "Social Media Advertising", "Community Building", "Brand Advocacy", "Crisis Management"
  ],
  "Web Development": [
    "HTML", "CSS", "JavaScript", "React", "Vue.js", "Angular", "Node.js", "Express.js", "PHP", "Laravel",
    "WordPress", "Drupal", "Bootstrap", "Tailwind CSS", "Sass/SCSS", "jQuery", "AJAX", "REST APIs",
    "GraphQL", "MongoDB", "MySQL", "PostgreSQL", "Firebase", "Git", "Responsive Design", "Cross-browser Compatibility"
  ]
} as const;

// Flatten all skills for easy searching
export const ALL_SKILLS = Object.values(SKILLS_CATEGORIES).flat().sort();

// Popular categories for homepage
export const POPULAR_JOB_CATEGORIES = [
  "Customer Service",
  "Data Entry & Processing", 
  "Content Writing & Creation",
  "Virtual Assistant",
  "Digital Marketing",
  "Software Development"
] as const;

// Experience levels
export const EXPERIENCE_LEVELS = [
  "0-1 years",
  "1-3 years", 
  "3-5 years",
  "5-8 years",
  "8+ years"
] as const;

// Job types
export const JOB_TYPES = [
  "Full Time",
  "Part Time", 
  "Contract",
  "Internship",
  "Freelance"
] as const;

// Salary ranges for job alerts
export const SALARY_RANGES = [
  "Any Salary",
  "₹0-3 LPA",
  "₹3-6 LPA", 
  "₹6-10 LPA",
  "₹10-15 LPA",
  "₹15-25 LPA",
  "₹25+ LPA"
] as const;

// Popular locations
export const LOCATIONS = [
  "All India",
  "Mumbai", 
  "Delhi",
  "Bangalore",
  "Hyderabad",
  "Chennai",
  "Pune", 
  "Kolkata",
  "Ahmedabad",
  "Jaipur",
  "Surat",
  "Lucknow",
  "Kanpur", 
  "Nagpur",
  "Indore",
  "Bhopal",
  "Visakhapatnam",
  "Patna",
  "Vadodara",
  "Coimbatore"
] as const;

// Export types for TypeScript
export type JobCategory = typeof JOB_CATEGORIES[number];
export type Department = typeof DEPARTMENTS[number];  
export type SkillCategory = keyof typeof SKILLS_CATEGORIES;
export type Skill = string;
export type ExperienceLevel = typeof EXPERIENCE_LEVELS[number];
export type JobType = typeof JOB_TYPES[number];
export type SalaryRange = typeof SALARY_RANGES[number];
export type Location = typeof LOCATIONS[number];