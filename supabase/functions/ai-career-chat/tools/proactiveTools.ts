// Proactive AI Notification System

export async function sendProactiveNotification(
  supabase: any,
  user_id: string,
  notificationType: string,
  context: any
) {
  const notifications = {
    // Job matching notifications
    perfect_match_found: {
      title: '🎯 Perfect Job Match Found!',
      message: `We found ${context.jobCount} jobs that perfectly match your skills (${context.skills?.slice(0, 3).join(', ')}). Check them out now!`,
      action_url: '/jobs',
      priority: 'high'
    },

    // Application status updates
    application_viewed: {
      title: '👀 Employer Viewed Your Application',
      message: `The employer at ${context.companyName} just viewed your application for ${context.jobTitle}. They might contact you soon!`,
      action_url: `/applications/${context.applicationId}`,
      priority: 'medium'
    },

    interview_scheduled: {
      title: '📅 Interview Scheduled!',
      message: `Great news! ${context.companyName} has scheduled an interview with you for ${context.jobTitle} on ${context.scheduledDate}`,
      action_url: `/interviews/${context.interviewId}`,
      priority: 'high'
    },

    // Profile optimization
    profile_incomplete: {
      title: '⚡ Complete Your Profile - Get 3x More Job Matches!',
      message: `Your profile is ${context.completionPercent}% complete. Add missing fields to increase your chances!`,
      action_url: '/profile/edit',
      priority: 'medium'
    },

    skills_trending: {
      title: '🔥 Your Skills Are in High Demand!',
      message: `${context.skillName} is trending! ${context.newJobsCount} new jobs posted this week require this skill.`,
      action_url: '/jobs',
      priority: 'medium'
    },

    // Wallet & rewards
    wallet_low: {
      title: '💰 Low Wallet Balance Alert',
      message: `Your wallet balance is ${context.balance} points. Recharge now to continue applying for premium jobs.`,
      action_url: '/wallet',
      priority: 'low'
    },

    referral_reward: {
      title: '🎉 Referral Reward Earned!',
      message: `Congratulations! You earned ${context.points} points for referring ${context.friendName}. Keep sharing!`,
      action_url: '/referrals',
      priority: 'medium'
    },

    // Competition updates
    competition_rank: {
      title: '🏆 You\'re Rising in Monthly Competition!',
      message: `You're now rank #${context.rank}! ${context.pointsToNext} more points to reach next rank and win prizes.`,
      action_url: '/competition',
      priority: 'low'
    },

    // Scam protection
    scam_detected: {
      title: '🚨 SCAM ALERT - Job Removed',
      message: `We detected and removed a fraudulent job posting you were viewing. Your safety is our priority!`,
      action_url: '/safety-tips',
      priority: 'critical'
    },

    suspicious_activity: {
      title: '⚠️ Suspicious Account Activity',
      message: `We noticed unusual activity on your account from ${context.location}. If this wasn't you, secure your account immediately.`,
      action_url: '/security',
      priority: 'critical'
    }
  };

  const notification = notifications[notificationType as keyof typeof notifications];
  
  if (!notification) {
    return { error: 'Unknown notification type' };
  }

  // Insert notification into database
  const { data, error } = await supabase
    .from('employer_notifications')
    .insert({
      user_id,
      type: notificationType,
      title: notification.title,
      message: notification.message,
      action_url: notification.action_url,
      metadata: { priority: notification.priority, context },
      is_read: false
    })
    .select()
    .single();

  if (error) {
    console.error('Notification creation error:', error);
    return { error: error.message };
  }

  // For critical notifications, also send SMS/email (if enabled)
  if (notification.priority === 'critical') {
    await triggerCriticalAlert(supabase, user_id, notification);
  }

  return { success: true, notification: data };
}

async function triggerCriticalAlert(supabase: any, user_id: string, notification: any) {
  // Get user preferences
  const { data: profile } = await supabase
    .from('profiles')
    .select('phone, email, notification_preferences')
    .eq('user_id', user_id)
    .single();

  if (!profile) return;

  const prefs = profile.notification_preferences || {};

  // Log critical alert (actual SMS/email would be sent via separate service)
  console.log('CRITICAL ALERT triggered for user:', user_id, notification.title);
  
  // This would integrate with SMS/Email service in production
  return { alerted: true };
}

// Smart notification scheduling based on user behavior
export async function scheduleSmartNotifications(supabase: any, user_id: string) {
  // Get user data
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, job_applications(*), job_alerts(*)')
    .eq('user_id', user_id)
    .single();

  if (!profile) return { error: 'Profile not found' };

  const scheduledNotifications = [];

  // 1. Check for perfect job matches
  if (profile.skills && profile.skills.length > 0) {
    const { data: matchedJobs } = await supabase
      .from('jobs')
      .select('id, title, company_id, skills_required')
      .eq('status', 'active')
      .contains('skills_required', profile.skills.slice(0, 3));

    if (matchedJobs && matchedJobs.length > 0) {
      scheduledNotifications.push({
        type: 'perfect_match_found',
        context: { jobCount: matchedJobs.length, skills: profile.skills }
      });
    }
  }

  // 2. Check profile completion
  const completionFields = ['full_name', 'phone', 'email', 'location', 'skills', 'experience_years', 'bio'];
  const completedFields = completionFields.filter(field => profile[field]);
  const completionPercent = Math.round((completedFields.length / completionFields.length) * 100);

  if (completionPercent < 80) {
    scheduledNotifications.push({
      type: 'profile_incomplete',
      context: { completionPercent }
    });
  }

  // 3. Check wallet balance
  if (profile.wallet_balance !== undefined && profile.wallet_balance < 10) {
    scheduledNotifications.push({
      type: 'wallet_low',
      context: { balance: profile.wallet_balance }
    });
  }

  return { scheduledNotifications, count: scheduledNotifications.length };
}
