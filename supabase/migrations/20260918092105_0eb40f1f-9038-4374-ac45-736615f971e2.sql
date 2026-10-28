INSERT INTO public.telegram_lifecycle_templates (event_type, enabled, title, body, button_text, button_url) VALUES ('subscribe', true, '🔔 Notifications Connected', 'Hi {{name}}, your Telegram is now linked to Workly India.

You will receive job matches, application updates and important account alerts right here.

🗓️ {{date}}  ⏰ {{time}}', 'Explore Jobs', '/jobs') ON CONFLICT (event_type) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, button_text = EXCLUDED.button_text, button_url = EXCLUDED.button_url, updated_at = now();
INSERT INTO public.telegram_lifecycle_templates (event_type, enabled, title, body, button_text, button_url) VALUES ('unsubscribe', true, '🔕 Notifications Disconnected', 'Hi {{name}}, Telegram alerts have been turned off.

You may miss job matches and application updates. You can turn them back on any time from your profile.

🗓️ {{date}}  ⏰ {{time}}', 'Turn On Again', '/notifications') ON CONFLICT (event_type) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, button_text = EXCLUDED.button_text, button_url = EXCLUDED.button_url, updated_at = now();
INSERT INTO public.telegram_lifecycle_templates (event_type, enabled, title, body, button_text, button_url) VALUES ('login_otp', true, '🔐 Your Workly India Login Code', 'Hi {{name}},

Your login code is <b>{{otp}}</b>
Valid for {{expiry_minutes}} minutes.

<i>Never share this code with anyone. Our team will never ask you for it.</i>', '', '/') ON CONFLICT (event_type) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, button_text = EXCLUDED.button_text, button_url = EXCLUDED.button_url, updated_at = now();
INSERT INTO public.telegram_lifecycle_templates (event_type, enabled, title, body, button_text, button_url) VALUES ('signup_welcome', true, '🎉 Welcome to Workly India', 'Hi {{name}}, your job seeker account is ready.

📍 {{location}}
🗓️ Joined {{date}} at {{time}}

<i>Complete your profile and upload your resume — complete profiles are shown to employers first and can apply to any job in one tap.</i>', 'Complete Profile', '/profile') ON CONFLICT (event_type) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, button_text = EXCLUDED.button_text, button_url = EXCLUDED.button_url, updated_at = now();
INSERT INTO public.telegram_lifecycle_templates (event_type, enabled, title, body, button_text, button_url) VALUES ('employer_signup_welcome', true, '🎉 Welcome to Workly India', 'Hi {{name}}, your employer account is ready.

🏢 {{company}}
🗓️ Joined {{date}} at {{time}}

<i>Complete your company profile and post your first job — verified, complete profiles receive far more applications.</i>', 'Post a Job', '/employer-portal') ON CONFLICT (event_type) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, button_text = EXCLUDED.button_text, button_url = EXCLUDED.button_url, updated_at = now();
INSERT INTO public.telegram_lifecycle_templates (event_type, enabled, title, body, button_text, button_url) VALUES ('profile_complete', true, '✅ Profile Complete', 'Well done {{name}}, your profile is 100% complete.

<i>Complete profiles rank higher in employer searches, and you can now apply to any job with a single tap.</i>', 'Browse Jobs', '/jobs') ON CONFLICT (event_type) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, button_text = EXCLUDED.button_text, button_url = EXCLUDED.button_url, updated_at = now();
INSERT INTO public.telegram_lifecycle_templates (event_type, enabled, title, body, button_text, button_url) VALUES ('application_submitted', true, '✅ Application Sent', '💼 {{job_title}}
🏢 {{company}}
🗓️ {{date}}  ⏰ {{time}}

<i>The employer can now see your profile. You will get an update here as soon as your status changes. Keep applying to similar roles — it gets you hired faster.</i>', 'View Activity', '/activity') ON CONFLICT (event_type) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, button_text = EXCLUDED.button_text, button_url = EXCLUDED.button_url, updated_at = now();
INSERT INTO public.telegram_lifecycle_templates (event_type, enabled, title, body, button_text, button_url) VALUES ('application_status_changed', true, '📋 Application Update', '💼 {{job_title}}
🏢 {{company}}
📌 Status: {{status}}
🗓️ {{date}}  ⏰ {{time}}

<i>Keep your phone and email reachable so the employer can contact you without delay.</i>', 'View Activity', '/activity') ON CONFLICT (event_type) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, button_text = EXCLUDED.button_text, button_url = EXCLUDED.button_url, updated_at = now();
INSERT INTO public.telegram_lifecycle_templates (event_type, enabled, title, body, button_text, button_url) VALUES ('application_under_review', true, '👀 Application Under Review', '💼 {{job_title}}
🏢 {{company}}
🗓️ {{date}}  ⏰ {{time}}

<i>The hiring team is going through your profile and resume. If you are a good fit, they will shortlist you and may call you for an interview.</i>', 'View Activity', '/activity') ON CONFLICT (event_type) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, button_text = EXCLUDED.button_text, button_url = EXCLUDED.button_url, updated_at = now();
INSERT INTO public.email_lifecycle_templates (event_type, enabled, subject, body, button_text, button_url) VALUES ('application_under_review', true, '{{company}} is reviewing your application for {{job_title}}', 'Hi {{name}},

Your application has moved to the review stage.

Application details
Position: {{job_title}}
Company: {{company}}
Current status: Under review
Updated on: {{date}} at {{time}}

What this means
The hiring team has opened your profile and is going through your experience, skills and resume. If they find you suitable, your application will move to the shortlisted stage and they may contact you for an interview.

What you should do now
• Keep your mobile number and email reachable.
• Make sure your resume on Workly India is the latest version.
• Keep applying to similar roles so you always have more options.

You can follow this application any time from the Activity section of your account.

Regards,
Team Workly India', 'View Application Status', '/activity') ON CONFLICT (event_type) DO NOTHING;
INSERT INTO public.push_lifecycle_templates (event_type, enabled, title, body, button_text, button_url) VALUES ('application_under_review', true, '👀 Application under review', '{{company}} is reviewing your application for {{job_title}}.
Date: {{date}}
Time: {{time}}', 'View Activity', '/activity') ON CONFLICT (event_type) DO NOTHING;
INSERT INTO public.telegram_lifecycle_templates (event_type, enabled, title, body, button_text, button_url) VALUES ('application_shortlisted', true, '🎉 You Have Been Shortlisted', '💼 {{job_title}}
🏢 {{company}}
🗓️ {{date}}  ⏰ {{time}}

<i>{{company}} has shortlisted you. Keep your phone reachable — they may call or email you soon to schedule an interview.</i>', 'View Activity', '/activity') ON CONFLICT (event_type) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, button_text = EXCLUDED.button_text, button_url = EXCLUDED.button_url, updated_at = now();
INSERT INTO public.email_lifecycle_templates (event_type, enabled, subject, body, button_text, button_url) VALUES ('application_shortlisted', true, 'Good news — you are shortlisted for {{job_title}}', 'Hi {{name}},

Congratulations, {{company}} has shortlisted your application.

Application details
Position: {{job_title}}
Company: {{company}}
Current status: Shortlisted
Updated on: {{date}} at {{time}}

What happens next
The employer may call or email you shortly to discuss the role or to schedule an interview. Shortlisted candidates who respond quickly usually move ahead faster.

How to prepare
• Keep your phone reachable and check your email regularly.
• Read the job description again so you can speak about the role confidently.
• Keep your resume, ID and certificates ready.

All the best,
Team Workly India', 'View Application Status', '/activity') ON CONFLICT (event_type) DO NOTHING;
INSERT INTO public.push_lifecycle_templates (event_type, enabled, title, body, button_text, button_url) VALUES ('application_shortlisted', true, '🎉 You have been shortlisted', 'Great news! {{company}} shortlisted you for {{job_title}}.
Keep your phone reachable.
Date: {{date}}
Time: {{time}}', 'View Activity', '/activity') ON CONFLICT (event_type) DO NOTHING;
INSERT INTO public.telegram_lifecycle_templates (event_type, enabled, title, body, button_text, button_url) VALUES ('application_interview_scheduled', true, '📅 Interview Scheduled', '💼 {{job_title}}
🏢 {{company}}
🗓️ {{interview_date}}
⏰ {{interview_time}}
💻 Mode: {{mode}}

<i>Join 10 minutes early, keep your resume and ID ready, and check your internet if it is a video interview.</i>', 'View Interview', '/activity') ON CONFLICT (event_type) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, button_text = EXCLUDED.button_text, button_url = EXCLUDED.button_url, updated_at = now();
INSERT INTO public.email_lifecycle_templates (event_type, enabled, subject, body, button_text, button_url) VALUES ('application_interview_scheduled', true, 'Interview scheduled for {{job_title}} at {{company}}', 'Hi {{name}},

Your application has moved to the interview stage.

Interview details
Position: {{job_title}}
Company: {{company}}
Date: {{interview_date}}
Time: {{interview_time}}
Mode: {{mode}}

How to prepare
• Join or arrive at least 10 minutes early.
• For a video interview, check your internet, camera and microphone in advance and pick a quiet, well-lit place.
• For an in-person interview, carry your resume, a valid ID and relevant certificates.
• Be ready to explain your experience and why you are a good fit for this role.

If you cannot attend at the given time, inform the employer as early as possible so another slot can be arranged.

Best of luck,
Team Workly India', 'View Interview Details', '/activity') ON CONFLICT (event_type) DO NOTHING;
INSERT INTO public.push_lifecycle_templates (event_type, enabled, title, body, button_text, button_url) VALUES ('application_interview_scheduled', true, '📅 Interview scheduled', '{{company}} scheduled an interview for {{job_title}}.
Date: {{interview_date}}
Time: {{interview_time}}
Mode: {{mode}}', 'View Activity', '/activity') ON CONFLICT (event_type) DO NOTHING;
INSERT INTO public.telegram_lifecycle_templates (event_type, enabled, title, body, button_text, button_url) VALUES ('application_hired', true, '🎊 Congratulations, You Are Hired', '💼 {{job_title}}
🏢 {{company}}
🗓️ {{date}}  ⏰ {{time}}

<i>{{company}} has selected you. They will contact you with your joining date and the documents required — keep your originals ready.</i>', 'View Activity', '/activity') ON CONFLICT (event_type) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, button_text = EXCLUDED.button_text, button_url = EXCLUDED.button_url, updated_at = now();
INSERT INTO public.email_lifecycle_templates (event_type, enabled, subject, body, button_text, button_url) VALUES ('application_hired', true, 'Congratulations {{name}} — you are hired for {{job_title}}', 'Hi {{name}},

Wonderful news — {{company}} has selected you for the position of {{job_title}}.

Application details
Position: {{job_title}}
Company: {{company}}
Current status: Hired
Updated on: {{date}} at {{time}}

What happens next
The employer will contact you with your joining date, documents required and other details. Please respond promptly and keep the originals of your ID, education and experience documents ready.

A small request
Once you join, do share your experience with Workly India. Your feedback helps us bring better opportunities to job seekers across India.

Congratulations once again and all the best for your new role,
Team Workly India', 'View Application', '/activity') ON CONFLICT (event_type) DO NOTHING;
INSERT INTO public.push_lifecycle_templates (event_type, enabled, title, body, button_text, button_url) VALUES ('application_hired', true, '🎊 Congratulations, you are hired', '{{company}} has selected you for {{job_title}}.
Date: {{date}}
Time: {{time}}', 'View Activity', '/activity') ON CONFLICT (event_type) DO NOTHING;
INSERT INTO public.telegram_lifecycle_templates (event_type, enabled, title, body, button_text, button_url) VALUES ('application_rejected', true, '📋 Application Update', '💼 {{job_title}}
🏢 {{company}}
📌 Status: Not selected
🗓️ {{date}}  ⏰ {{time}}

<i>This role did not work out, but many similar jobs are open for your skills. Candidates who keep applying get hired much faster.</i>', 'Browse Jobs', '/jobs') ON CONFLICT (event_type) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, button_text = EXCLUDED.button_text, button_url = EXCLUDED.button_url, updated_at = now();
INSERT INTO public.email_lifecycle_templates (event_type, enabled, subject, body, button_text, button_url) VALUES ('application_rejected', true, 'Update on your application for {{job_title}}', 'Hi {{name}},

Thank you for applying through Workly India. After reviewing your profile, {{company}} has decided not to move ahead with your application for {{job_title}} at this time.

Application details
Position: {{job_title}}
Company: {{company}}
Current status: Not selected
Updated on: {{date}} at {{time}}

Please do not feel discouraged. Employers often choose between many suitable candidates, and a different company may be exactly the right fit for you.

What to do next
• Apply to more jobs that match your skills and location — candidates who apply regularly get hired much faster.
• Add any new skills, certifications or experience to your profile.
• Turn on job alerts so matching openings reach you first.

We wish you great success in your job search,
Team Workly India', 'Browse Matching Jobs', '/jobs') ON CONFLICT (event_type) DO NOTHING;
INSERT INTO public.push_lifecycle_templates (event_type, enabled, title, body, button_text, button_url) VALUES ('application_rejected', true, '📋 Application update', '{{company}} did not move ahead with your application for {{job_title}}.
Keep applying — better jobs are waiting.
Date: {{date}}
Time: {{time}}', 'Browse Jobs', '/jobs') ON CONFLICT (event_type) DO NOTHING;
INSERT INTO public.telegram_lifecycle_templates (event_type, enabled, title, body, button_text, button_url) VALUES ('application_withdrawn', true, '↩️ Application Withdrawn', '💼 {{job_title}}
🏢 {{company}}
🗓️ {{date}}  ⏰ {{time}}

<i>This application is no longer with the employer. If this was a mistake, you can apply again while the job is live.</i>', 'Browse Jobs', '/jobs') ON CONFLICT (event_type) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, button_text = EXCLUDED.button_text, button_url = EXCLUDED.button_url, updated_at = now();
INSERT INTO public.email_lifecycle_templates (event_type, enabled, subject, body, button_text, button_url) VALUES ('application_withdrawn', true, 'Your application for {{job_title}} has been withdrawn', 'Hi {{name}},

This is a confirmation that your application has been withdrawn.

Application details
Position: {{job_title}}
Company: {{company}}
Current status: Withdrawn
Updated on: {{date}} at {{time}}

The employer will no longer consider this application. If this was done by mistake, you can apply to the job again while it is still live.

Plenty of other openings match your profile — browse the latest jobs and apply with your saved profile in one tap.

Regards,
Team Workly India', 'Browse Jobs', '/jobs') ON CONFLICT (event_type) DO NOTHING;
INSERT INTO public.push_lifecycle_templates (event_type, enabled, title, body, button_text, button_url) VALUES ('application_withdrawn', true, '↩️ Application withdrawn', 'Your application for {{job_title}} at {{company}} has been withdrawn.
Date: {{date}}
Time: {{time}}', 'Browse Jobs', '/jobs') ON CONFLICT (event_type) DO NOTHING;
INSERT INTO public.telegram_lifecycle_templates (event_type, enabled, title, body, button_text, button_url) VALUES ('application_viewed', true, '👀 Your Application Was Viewed', '💼 {{job_title}}
🏢 {{company}}
🗓️ {{date}}  ⏰ {{time}}

<i>Your profile has reached the hiring team. Keep your resume updated and your phone reachable.</i>', 'View Activity', '/activity') ON CONFLICT (event_type) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, button_text = EXCLUDED.button_text, button_url = EXCLUDED.button_url, updated_at = now();
INSERT INTO public.telegram_lifecycle_templates (event_type, enabled, title, body, button_text, button_url) VALUES ('interview_status_update', true, '📅 Interview Update', '💼 {{job_title}}
🏢 {{company}}
📌 Status: {{status}}
🗓️ {{interview_date}}
⏰ {{interview_time}}
💻 Mode: {{mode}}

<i>Join 10 minutes early and keep your resume and ID ready. If you cannot attend, inform the employer as early as possible.</i>', 'View Interview', '/activity') ON CONFLICT (event_type) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, button_text = EXCLUDED.button_text, button_url = EXCLUDED.button_url, updated_at = now();
INSERT INTO public.telegram_lifecycle_templates (event_type, enabled, title, body, button_text, button_url) VALUES ('new_job_match', true, '🔥 New Job Match', '💼 {{job_title}}
🏢 {{company}}
📍 {{location}}
🗓️ Posted {{date}} at {{time}}

<i>This job matches the skills and location in your profile. Apply early — employers usually review the first applications they receive.</i>', 'View & Apply', '/jobs') ON CONFLICT (event_type) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, button_text = EXCLUDED.button_text, button_url = EXCLUDED.button_url, updated_at = now();
INSERT INTO public.telegram_lifecycle_templates (event_type, enabled, title, body, button_text, button_url) VALUES ('new_application_received', true, '📥 New Application Received', '💼 {{job_title}}
👤 {{name}}
📱 {{mobile}}
📧 {{email}}
📍 {{location}}
🗓️ {{date}}  ⏰ {{time}}

<i>Review the candidate in your Employer Portal and shortlist or schedule an interview — employers who reply within 48 hours hire noticeably faster.</i>', 'Review Applicant', '/employer-portal') ON CONFLICT (event_type) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, button_text = EXCLUDED.button_text, button_url = EXCLUDED.button_url, updated_at = now();
INSERT INTO public.telegram_lifecycle_templates (event_type, enabled, title, body, button_text, button_url) VALUES ('job_posted', true, '🚀 Your Job Is Live', '💼 {{job_title}}
📍 {{location}}
🗓️ Published {{date}} at {{time}}

<i>Your job now appears in search results and job alerts. Boost it to stay at the top and reach many more candidates.</i>', 'Manage Job', '/employer-portal') ON CONFLICT (event_type) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, button_text = EXCLUDED.button_text, button_url = EXCLUDED.button_url, updated_at = now();
INSERT INTO public.telegram_lifecycle_templates (event_type, enabled, title, body, button_text, button_url) VALUES ('payment_success', true, '✅ Payment Successful', '💰 Amount: {{amount}}
🧾 Order ID: {{order_id}}
🪙 Points: {{points}}
👛 Balance: {{balance}}
🗓️ {{date}}  ⏰ {{time}}

<i>Your purchase is active. Keep the Order ID safe — support will ask for it if you ever need help with this payment.</i>', 'View Wallet', '/wallet') ON CONFLICT (event_type) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, button_text = EXCLUDED.button_text, button_url = EXCLUDED.button_url, updated_at = now();
INSERT INTO public.telegram_lifecycle_templates (event_type, enabled, title, body, button_text, button_url) VALUES ('payment_failed', true, '❌ Payment Failed', '💰 Amount: {{amount}}
🧾 Order ID: {{order_id}}
🗓️ {{date}}  ⏰ {{time}}

<i>No service was activated. Please try again with UPI, card or net banking. If money was deducted, banks reverse failed payments within 5-7 working days.</i>', 'Try Again', '/wallet') ON CONFLICT (event_type) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, button_text = EXCLUDED.button_text, button_url = EXCLUDED.button_url, updated_at = now();
INSERT INTO public.telegram_lifecycle_templates (event_type, enabled, title, body, button_text, button_url) VALUES ('wallet_credit', true, '💰 Points Added to Wallet', '🪙 Points added: {{points}}
👛 New balance: {{balance}}
🗓️ {{date}}  ⏰ {{time}}

<i>Use your points to post jobs, boost an opening, extend an expiring job or apply for company verification.</i>', 'Open Wallet', '/wallet') ON CONFLICT (event_type) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, button_text = EXCLUDED.button_text, button_url = EXCLUDED.button_url, updated_at = now();
INSERT INTO public.telegram_lifecycle_templates (event_type, enabled, title, body, button_text, button_url) VALUES ('referral_join', true, '🎉 New Referral Joined', '👤 {{referral_name}}
📍 {{location}}
🗓️ {{date}}  ⏰ {{time}}

<i>Your reward is credited as per the referral programme rules. Keep sharing your link — more referrals unlock milestone rewards too.</i>', 'View Referrals', '/referral') ON CONFLICT (event_type) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, button_text = EXCLUDED.button_text, button_url = EXCLUDED.button_url, updated_at = now();
INSERT INTO public.telegram_lifecycle_templates (event_type, enabled, title, body, button_text, button_url) VALUES ('referral_milestone', true, '🎯 Referral Milestone Unlocked', '🏅 Milestone: {{rank}}
🎁 Reward: {{amount}}
👛 Balance: {{balance}}
🗓️ {{date}}  ⏰ {{time}}

<i>Your reward has been added to your wallet. Keep inviting genuine users to unlock bigger milestones.</i>', 'View Referrals', '/referral') ON CONFLICT (event_type) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, button_text = EXCLUDED.button_text, button_url = EXCLUDED.button_url, updated_at = now();
INSERT INTO public.telegram_lifecycle_templates (event_type, enabled, title, body, button_text, button_url) VALUES ('commission_earned', true, '💸 Referral Earning Credited', '💰 Amount: {{amount}}
👤 From: {{referral_name}}
👛 Balance: {{balance}}
🗓️ {{date}}  ⏰ {{time}}

<i>This amount is now part of your withdrawable balance, subject to the minimum withdrawal limit.</i>', 'View Earnings', '/referral') ON CONFLICT (event_type) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, button_text = EXCLUDED.button_text, button_url = EXCLUDED.button_url, updated_at = now();
INSERT INTO public.telegram_lifecycle_templates (event_type, enabled, title, body, button_text, button_url) VALUES ('referral_withdrawal', true, '🏦 Withdrawal Update', '💰 Amount: {{amount}}
📌 Status: {{status}}
👛 Balance: {{balance}}
🗓️ {{date}}  ⏰ {{time}}

<i>Approved payouts usually reach your bank or UPI within 1-3 working days. Make sure your payout details match your own verified account.</i>', 'View Withdrawals', '/referral') ON CONFLICT (event_type) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, button_text = EXCLUDED.button_text, button_url = EXCLUDED.button_url, updated_at = now();
INSERT INTO public.telegram_lifecycle_templates (event_type, enabled, title, body, button_text, button_url) VALUES ('referral_competition_win', true, '🏆 You Won a Prize', '🥇 Rank: {{rank}}
🎁 Prize: {{prize}}
🗓️ {{date}}  ⏰ {{time}}

<i>Your prize is credited to your wallet after the standard verification of referral activity. The competition runs every month — keep sharing your link.</i>', 'View Rewards', '/referral') ON CONFLICT (event_type) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, button_text = EXCLUDED.button_text, button_url = EXCLUDED.button_url, updated_at = now();
INSERT INTO public.telegram_lifecycle_templates (event_type, enabled, title, body, button_text, button_url) VALUES ('job_expiry', true, '⏰ Job Post Expiring Soon', '💼 {{job_title}}
🗓️ Expires on {{expiry_date}}

<i>After expiry the job leaves search results and alerts, and candidates can no longer apply. Extend it to keep the same post and all applications received so far.</i>', 'Extend Job', '/employer-portal') ON CONFLICT (event_type) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, button_text = EXCLUDED.button_text, button_url = EXCLUDED.button_url, updated_at = now();
INSERT INTO public.telegram_lifecycle_templates (event_type, enabled, title, body, button_text, button_url) VALUES ('boost_expiry', true, '⏰ Job Boost Ending', '💼 {{job_title}}
🗓️ Boost ends on {{expiry_date}}

<i>When the boost ends your job leaves the top positions in search and alerts. Boosted jobs get several times more views — renew to keep the momentum.</i>', 'Renew Boost', '/employer-portal') ON CONFLICT (event_type) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, button_text = EXCLUDED.button_text, button_url = EXCLUDED.button_url, updated_at = now();
INSERT INTO public.telegram_lifecycle_templates (event_type, enabled, title, body, button_text, button_url) VALUES ('verification_expiry', true, '⏰ Verified Badge Expiring', '🏢 {{company}}
🗓️ Expires on {{expiry_date}}

<i>Candidates apply far more often to verified companies. If the badge expires it is removed from your profile and all job posts until you renew.</i>', 'Renew Verification', '/employer-portal') ON CONFLICT (event_type) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, button_text = EXCLUDED.button_text, button_url = EXCLUDED.button_url, updated_at = now();
INSERT INTO public.telegram_lifecycle_templates (event_type, enabled, title, body, button_text, button_url) VALUES ('domain_expiry', true, '⏰ Domain Expiring', '🌐 {{domain}}
🗓️ Expires on {{expiry_date}}
💰 Renewal: {{amount}}

<i>After expiry your website and email on this domain stop working, and once the grace period ends someone else can register it.</i>', 'Renew Domain', '/domains') ON CONFLICT (event_type) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, button_text = EXCLUDED.button_text, button_url = EXCLUDED.button_url, updated_at = now();
INSERT INTO public.telegram_lifecycle_templates (event_type, enabled, title, body, button_text, button_url) VALUES ('ai_plan_expiry', true, '⏰ AI Plan Expiring', '⭐ Plan: {{plan}}
🗓️ Expires on {{expiry_date}}
💰 Renewal: {{amount}}

<i>After expiry premium AI features stop and usage returns to the free limits. Your chat history stays safe and returns when you renew.</i>', 'Renew Plan', '/ai-assistant/subscription') ON CONFLICT (event_type) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, button_text = EXCLUDED.button_text, button_url = EXCLUDED.button_url, updated_at = now();