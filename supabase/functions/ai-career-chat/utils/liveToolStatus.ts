/**
 * Subject-aware live status for the tool that is ACTUALLY running.
 *
 * Instead of a generic "Processing get_youtube_channel_details..." the chip
 * says exactly what is being done, with the real subject from the tool
 * arguments: `"Manoj Dey" search kar rahi hoon...`,
 * `YouTube channel dekh rahi hoon...`, `Video ka SEO update kar rahi hoon...`.
 */

const clip = (v: unknown, n = 40): string => {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};

const firstOf = (args: Record<string, unknown>, keys: string[]): string => {
  for (const k of keys) {
    const v = clip(args?.[k]);
    if (v) return v;
  }
  return "";
};

const TOOL_STATUS: Record<
  string,
  (a: Record<string, unknown>) => string
> = {
  // Web / lookup
  web_search: (a) => {
    const q = firstOf(a, ["query", "q", "search_query", "text"]);
    if (!q) return "Web par search kar rahi hoon...";
    const lower = q.toLowerCase();
    // Subject + platform aware: "LinkedIn account dekh rahi hoon...",
    // "YouTube channel dekh rahi hoon..." — never generic filler.
    const subject = q
      .replace(/\b(linkedin|youtube|instagram|twitter|x|facebook|profile|channel|account)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    if (/linkedin/.test(lower)) {
      return subject
        ? `${subject} ka LinkedIn dekh rahi hoon...`
        : "LinkedIn account dekh rahi hoon...";
    }
    if (/youtube/.test(lower)) {
      return subject
        ? `${subject} ka YouTube channel dekh rahi hoon...`
        : "YouTube channel dekh rahi hoon...";
    }
    if (/instagram/.test(lower)) {
      return subject
        ? `${subject} ka Instagram dekh rahi hoon...`
        : "Instagram account dekh rahi hoon...";
    }
    return `${q} search kar rahi hoon...`;
  },
  search_web_images: (a) => {
    const q = firstOf(a, ["query", "q"]);
    return q ? `${q} ki HD images dhundh rahi hoon...` : "Images dhundh rahi hoon...";
  },

  // YouTube
  search_youtube: (a) => {
    const q = firstOf(a, ["query", "q", "search_query"]);
    return q ? `YouTube par ${q} dhundh rahi hoon...` : "YouTube par dhundh rahi hoon...";
  },
  get_youtube_channel_details: (a) => {
    const c = firstOf(a, ["channel_name", "channel", "handle", "channel_id"]);
    return c ? `${c} channel dekh rahi hoon...` : "YouTube channel dekh rahi hoon...";
  },
  get_youtube_channel_videos: (a) => {
    const c = firstOf(a, ["channel_name", "channel", "handle", "channel_id"]);
    return c ? `${c} ke videos dekh rahi hoon...` : "Channel ke videos dekh rahi hoon...";
  },
  get_youtube_video_details: (a) => {
    const v = firstOf(a, ["title", "video_title", "video_id", "url"]);
    return v ? `Video "${v}" dekh rahi hoon...` : "Video ki detail dekh rahi hoon...";
  },
  get_youtube_video_comments: (a) => {
    const v = firstOf(a, ["title", "video_title", "video_id"]);
    return v ? `"${v}" ke comments padh rahi hoon...` : "Video ke comments padh rahi hoon...";
  },
  get_youtube_trending: () => "Trending videos dekh rahi hoon...",
  get_youtube_channel_playlists: () => "Channel ki playlists dekh rahi hoon...",
  get_youtube_playlist_details: () => "Playlist dekh rahi hoon...",

  // User's OWN connected YouTube channel (real API work)
  list_my_youtube_videos: () => "Aapke channel ke videos dekh rahi hoon...",
  get_my_youtube_video_meta: (a) => {
    const v = firstOf(a, ["title", "video_title", "video_id"]);
    return v
      ? `"${v}" ka current SEO padh rahi hoon...`
      : "Video ka current SEO padh rahi hoon...";
  },
  update_my_youtube_video: (a) => {
    const v = firstOf(a, ["title", "video_title", "video_id"]);
    const changing: string[] = [];
    if (a?.["title"]) changing.push("title");
    if (a?.["description"]) changing.push("description");
    if (a?.["tags"]) changing.push("tags");
    if (a?.["category_id"]) changing.push("category");
    if (a?.["privacy_status"]) changing.push("privacy");
    if (changing.length) {
      return `Video ka ${changing.slice(0, 3).join(", ")} update kar rahi hoon...`;
    }
    return v ? `"${v}" update kar rahi hoon...` : "Video SEO update kar rahi hoon...";
  },
  generate_youtube_seo_pack: () => "Video ka SEO taiyaar kar rahi hoon...",
  audit_my_youtube_seo: () => "Aapke videos ka SEO audit kar rahi hoon...",
  check_my_youtube_health: () => "YouTube connection check kar rahi hoon...",
  get_my_youtube_channel_stats: () => "Aapke channel ka data nikaal rahi hoon...",
  get_my_youtube_video_stats: (a) => {
    const v = firstOf(a, ["title", "video_title", "video_id"]);
    return v
      ? `"${v}" ki performance dekh rahi hoon...`
      : "Aapke viral video dekh rahi hoon...";
  },
  analyze_youtube_channel: (a) => {
    const c = firstOf(a, ["channel_name", "channel", "handle", "channel_id"]);
    return c
      ? `${c} channel analyze kar rahi hoon...`
      : "Channel analyze kar rahi hoon...";
  },

  // Jobs
  search_jobs: (a) => {
    const q = firstOf(a, ["query", "keywords", "title", "role", "search"]);
    const loc = firstOf(a, ["location", "city"]);
    if (q && loc) return `${loc} mein ${q} jobs dhundh rahi hoon...`;
    if (q) return `${q} jobs dhundh rahi hoon...`;
    return "Jobs dhundh rahi hoon...";
  },
  get_job_details: (a) => {
    const j = firstOf(a, ["title", "job_title", "job_id"]);
    return j ? `"${j}" job ki detail dekh rahi hoon...` : "Job ki detail dekh rahi hoon...";
  },
  apply_for_job: (a) => {
    const j = firstOf(a, ["title", "job_title", "job_id"]);
    return j ? `"${j}" par apply kar rahi hoon...` : "Apply kar rahi hoon...";
  },
  smart_job_match: () => "Aapki profile se jobs match kar rahi hoon...",
  get_user_applications: () => "Aapki applications dekh rahi hoon...",
  check_applications: () => "Aapki applications dekh rahi hoon...",
  get_market_insights: () => "Market data nikaal rahi hoon...",
  get_popular_jobs: () => "Trending jobs dekh rahi hoon...",

  // Profile / account
  get_user_profile: () => "Aapki profile padh rahi hoon...",
  get_profile: () => "Aapki profile padh rahi hoon...",
  update_user_profile: (a) => {
    const f = Object.keys(a || {}).filter((k) => k !== "user_id").slice(0, 2).join(", ");
    return f ? `Profile ka ${f} update kar rahi hoon...` : "Profile update kar rahi hoon...";
  },
  update_profile: () => "Profile update kar rahi hoon...",
  check_account_status: () => "Account status check kar rahi hoon...",
  get_user_message_history: () => "Purane messages dekh rahi hoon...",

  // Company
  get_company_details: (a) => {
    const c = firstOf(a, ["company_name", "name", "company"]);
    return c ? `${c} ki detail dekh rahi hoon...` : "Company ki detail dekh rahi hoon...";
  },
  search_companies: (a) => {
    const c = firstOf(a, ["query", "company_name", "name"]);
    return c ? `${c} dhundh rahi hoon...` : "Companies dhundh rahi hoon...";
  },
  get_my_company: () => "Aapki company profile padh rahi hoon...",
  update_company_profile: () => "Company profile update kar rahi hoon...",

  // Wallet
  get_wallet_balance: () => "Wallet balance check kar rahi hoon...",
  view_wallet_transactions: () => "Transactions dekh rahi hoon...",
  request_refund: () => "Refund request bana rahi hoon...",
  view_referral_status: () => "Referral status dekh rahi hoon...",

  // Delivery / creation
  send_email_to_user: () => "Email bhej rahi hoon...",
  send_telegram_to_user: () => "Telegram par bhej rahi hoon...",
  send_notification: () => "Notification bhej rahi hoon...",
  send_user_notification: () => "Notification bhej rahi hoon...",
  generate_image: (a) => {
    const p = firstOf(a, ["prompt", "description", "text"], );
    return p ? `"${p}" image bana rahi hoon...` : "Image bana rahi hoon...";
  },
  generate_image_for_user: () => "Image bana rahi hoon...",
  create_document: (a) => {
    const t = firstOf(a, ["title", "file_name", "type"]);
    return t ? `${t} taiyaar kar rahi hoon...` : "Document taiyaar kar rahi hoon...";
  },
  create_file_for_user: () => "File taiyaar kar rahi hoon...",
  analyze_screenshot: () => "Aapki image dekh rahi hoon...",

  // Support / platform
  search_faqs: (a) => {
    const q = firstOf(a, ["query", "question"]);
    return q ? `${q} ka answer dhundh rahi hoon...` : "FAQs dekh rahi hoon...";
  },
  get_faq_answer: () => "Answer dhundh rahi hoon...",
  get_contact_information: () => "Contact detail nikaal rahi hoon...",
  get_platform_info: () => "Platform info padh rahi hoon...",
  get_app_settings_info: () => "App settings padh rahi hoon...",
  get_complete_platform_knowledge: () => "Platform knowledge padh rahi hoon...",
  report_issue: () => "Support ticket bana rahi hoon...",
  manage_support_ticket: () => "Ticket update kar rahi hoon...",

  // Admin / analytics
  get_live_platform_stats: () => "Live stats nikaal rahi hoon...",
  get_platform_analytics: () => "Analytics nikaal rahi hoon...",
  get_platform_health_status: () => "Platform health check kar rahi hoon...",
  get_user_management_data: () => "User data nikaal rahi hoon...",
  inspect_database_table: (a) => {
    const t = firstOf(a, ["table", "table_name"]);
    return t ? `${t} table dekh rahi hoon...` : "Database dekh rahi hoon...";
  },
  get_system_logs: () => "System logs padh rahi hoon...",
  analyze_data_quality: () => "Data quality check kar rahi hoon...",

  // Jobs / applications (extended)
  cancel_job_application: (a) => {
    const j = firstOf(a, ["title", "job_title", "job_id"]);
    return j ? `"${j}" ki application cancel kar rahi hoon...` : "Application cancel kar rahi hoon...";
  },
  check_job_status: (a) => {
    const j = firstOf(a, ["title", "job_title", "job_id"]);
    return j ? `"${j}" ka status dekh rahi hoon...` : "Job ka status dekh rahi hoon...";
  },
  manage_applications: () => "Applications manage kar rahi hoon...",
  manage_job_alerts: () => "Job alerts update kar rahi hoon...",
  post_job: (a) => {
    const j = firstOf(a, ["title", "job_title", "role"]);
    return j ? `"${j}" job post kar rahi hoon...` : "Job post kar rahi hoon...";
  },
  suggest_career_path: () => "Aapka career path taiyaar kar rahi hoon...",
  submit_company_review: (a) => {
    const c = firstOf(a, ["company_name", "company"]);
    return c ? `${c} ka review bhej rahi hoon...` : "Review bhej rahi hoon...";
  },

  // Account / users (extended)
  find_user: (a) => {
    const u = firstOf(a, ["query", "name", "email", "phone", "user_id"]);
    return u ? `${u} ko dhundh rahi hoon...` : "User dhundh rahi hoon...";
  },
  get_user_details: (a) => {
    const u = firstOf(a, ["name", "email", "user_id"]);
    return u ? `${u} ki detail nikaal rahi hoon...` : "User detail nikaal rahi hoon...";
  },
  update_user_status: () => "Account status update kar rahi hoon...",
  delete_account_request: () => "Account deletion request process kar rahi hoon...",
  manage_verification: () => "Verification check kar rahi hoon...",
  manage_wallet: () => "Wallet manage kar rahi hoon...",

  // Message history / delivery (extended)
  get_my_email_history: () => "Purane emails dekh rahi hoon...",
  get_my_telegram_history: () => "Telegram history dekh rahi hoon...",
  get_my_whatsapp_history: () => "WhatsApp history dekh rahi hoon...",
  send_push_to_user: () => "Push notification bhej rahi hoon...",
  schedule_user_notification: () => "Notification schedule kar rahi hoon...",
  schedule_smart_notifications: () => "Smart notifications schedule kar rahi hoon...",
  update_notification_preferences: () => "Notification settings update kar rahi hoon...",
  generate_notification_card_image: () => "Notification card bana rahi hoon...",

  // Misc
  get_calendar_info: () => "Date aur time check kar rahi hoon...",
};

/** Humanises an unknown tool name into a truthful Hinglish action line. */
function fallbackStatus(toolName: string): string {
  const words = toolName.replace(/_/g, " ").trim();
  if (/^get |^read |^view |^check |^fetch /.test(words)) {
    return `${words.replace(/^(get|read|view|check|fetch)\s+/, "")} dekh rahi hoon...`;
  }
  if (/^update |^set |^edit /.test(words)) {
    return `${words.replace(/^(update|set|edit)\s+/, "")} update kar rahi hoon...`;
  }
  if (/^send |^share /.test(words)) {
    return `${words.replace(/^(send|share)\s+/, "")} bhej rahi hoon...`;
  }
  if (/^search |^find /.test(words)) {
    return `${words.replace(/^(search|find)\s+/, "")} dhundh rahi hoon...`;
  }
  if (/^create |^generate |^make /.test(words)) {
    return `${words.replace(/^(create|generate|make)\s+/, "")} bana rahi hoon...`;
  }
  return `${words} kar rahi hoon...`;
}

/**
 * Builds the live status line for a tool call using its real arguments.
 * Never throws — status must never break the reply.
 */
export function buildToolStatus(
  toolName: string,
  rawArgs?: string | Record<string, unknown>,
): string {
  let args: Record<string, unknown> = {};
  try {
    args = typeof rawArgs === "string"
      ? (rawArgs ? JSON.parse(rawArgs) : {})
      : (rawArgs || {});
  } catch {
    args = {};
  }
  try {
    const fn = TOOL_STATUS[toolName];
    if (fn) {
      const text = fn(args);
      if (text) return text;
    }
  } catch { /* noop */ }
  return fallbackStatus(toolName);
}

/**
 * Status shown right after tools return, naming what is being verified.
 */
export function buildVerifyStatus(toolNames: string[]): string {
  const first = toolNames.find(Boolean) || "";
  if (/^update_my_youtube_video$/.test(first)) {
    return "YouTube update verify kar rahi hoon...";
  }
  if (/youtube/.test(first)) return "YouTube data verify kar rahi hoon...";
  if (/job/.test(first)) return "Jobs verify kar rahi hoon...";
  if (/^web_search$|search/.test(first)) return "Search results verify kar rahi hoon...";
  if (/profile|user/.test(first)) return "Aapki detail verify kar rahi hoon...";
  if (/company/.test(first)) return "Company detail verify kar rahi hoon...";
  if (/wallet|refund|referral/.test(first)) return "Wallet detail verify kar rahi hoon...";
  if (/^send_/.test(first)) return "Delivery verify kar rahi hoon...";
  if (/image/.test(first)) return "Image check kar rahi hoon...";
  return "Result verify kar rahi hoon...";
}
