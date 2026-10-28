import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const JOB_MATCH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string", description: "One or two friendly sentences about the overall fit." },
    matches: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          job_id: { type: "string" },
          score: { type: "number", description: "Match score from 0 to 100." },
          reason: { type: "string", description: "Why this job fits, 1-2 sentences." },
          highlights: { type: "array", items: { type: "string" } },
          gaps: { type: ["string", "null"], description: "What the seeker may be missing, or null." },
        },
        required: ["job_id", "score", "reason", "highlights", "gaps"],
      },
    },
  },
  required: ["summary", "matches"],
};

const JOB_MATCH_COLUMNS =
  "id,title,description,location,city,state,job_type,work_mode,experience_level,salary_range,salary_min,salary_max,salary_period,skills,category,public_slug,published_at";

function formatLocation(job: any) {
  const parts = [job.location, job.city, job.state]
    .map((p: any) => String(p ?? "").trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const part of parts) {
    for (const piece of part.split(",").map((x) => x.trim()).filter(Boolean)) {
      const key = piece.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(piece);
    }
  }
  return unique.join(", ");
}

async function matchJobs(params: any, supabaseClient: any) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return { success: false, error: "AI is not configured yet." };

  const skills = String(params?.skills ?? "").trim();
  const preferences = String(params?.preferences ?? "").trim();
  const location = String(params?.location ?? "").trim();
  const jobType = String(params?.job_type ?? "").trim();
  const workMode = String(params?.work_mode ?? "").trim();
  const experience = String(params?.experience ?? "").trim();

  if (!skills && !preferences) {
    return { success: false, error: "Please describe your skills or what you are looking for." };
  }

  let query = supabaseClient
    .from("jobs")
    .select(JOB_MATCH_COLUMNS)
    .eq("status", "active")
    .order("published_at", { ascending: false })
    .limit(80);

  if (location) {
    query = query.or(
      `location.ilike.%${location}%,city.ilike.%${location}%,state.ilike.%${location}%`,
    );
  }
  if (jobType) query = query.ilike("job_type", `%${jobType}%`);
  if (workMode) query = query.ilike("work_mode", `%${workMode}%`);

  const { data: filtered, error } = await query;
  if (error) return { success: false, error: error.message };

  let jobs: any[] = filtered ?? [];

  if (jobs.length < 5) {
    const { data: fallback } = await supabaseClient
      .from("jobs")
      .select(JOB_MATCH_COLUMNS)
      .eq("status", "active")
      .order("published_at", { ascending: false })
      .limit(60);
    const seen = new Set(jobs.map((j: any) => j.id));
    jobs = [...jobs, ...((fallback ?? []) as any[]).filter((j) => !seen.has(j.id))];
  }

  if (!jobs.length) {
    return { success: true, summary: "No active jobs are listed right now.", matches: [] };
  }

  const compact = jobs.map((j: any) => ({
    id: j.id,
    title: j.title,
    category: j.category,
    job_type: j.job_type,
    work_mode: j.work_mode,
    experience_level: j.experience_level,
    location: formatLocation(j),
    salary: j.salary_range ?? [j.salary_min, j.salary_max].filter(Boolean).join("-"),
    skills: Array.isArray(j.skills) ? j.skills.slice(0, 12) : [],
    about: typeof j.description === "string" ? j.description.slice(0, 400) : "",
  }));

  const seeker = [
    skills && `Skills: ${skills}`,
    experience && `Experience: ${experience}`,
    preferences && `What they want: ${preferences}`,
    location && `Preferred location: ${location}`,
    jobType && `Preferred job type: ${jobType}`,
    workMode && `Preferred work mode: ${workMode}`,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `You are Workly India's job matching assistant.

JOB SEEKER
${seeker}

AVAILABLE WORKLY JOBS (JSON)
${JSON.stringify(compact)}

Pick the best matching jobs for this seeker, ranked best first.
Rules:
- Only use job_id values that appear in the list above. Never invent a job.
- Return at most 8 matches, and only jobs that are a genuine fit (fewer is fine).
- score is 0-100 honesty-first: 85+ strong, 60-84 decent, below 60 only if nothing better.
- reason must mention the seeker's own words/skills, max 2 sentences, simple English.
- highlights: 2-4 very short phrases (e.g. "Remote", "Matches Excel skill").
- gaps: one short sentence about anything missing, or null.
- summary: 1-2 encouraging sentences about their overall options.`;

  const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      input: prompt,
      stream: true,
      reasoning: { effort: "low" },
      text: {
        format: { type: "json_schema", name: "job_matches", strict: true, schema: JOB_MATCH_SCHEMA },
      },
    }),
  });

  if (!aiRes.ok || !aiRes.body) {
    const detail = await aiRes.text().catch(() => "");
    console.error("[ai-job-match] gateway error", aiRes.status, detail);
    if (aiRes.status === 429) return { success: false, error: "AI is busy right now. Please try again in a moment." };
    if (aiRes.status === 402) return { success: false, error: "AI credits are exhausted. Please top up to keep using matching." };
    return { success: false, error: "AI matching is unavailable right now." };
  }

  const reader = aiRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const evt = JSON.parse(payload);
        if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") {
          text += evt.delta;
        } else if (evt.type === "response.completed" && !text && typeof evt.response?.output_text === "string") {
          text = evt.response.output_text;
        }
      } catch {
        /* ignore partial frames */
      }
    }
  }

  let parsed: { summary?: string; matches?: any[] } = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    console.error("[ai-job-match] unparsable output", text.slice(0, 300));
    return { success: false, error: "AI could not build your matches. Please try again." };
  }

  const byId = new Map(jobs.map((j: any) => [String(j.id), j]));
  const matches = (parsed.matches ?? [])
    .map((m: any) => {
      const job = byId.get(String(m?.job_id));
      if (!job) return null;
      return {
        score: Math.max(0, Math.min(100, Math.round(Number(m.score) || 0))),
        reason: String(m.reason ?? ""),
        highlights: Array.isArray(m.highlights) ? m.highlights.slice(0, 4).map(String) : [],
        gaps: m.gaps ? String(m.gaps) : null,
        job: {
          id: job.id,
          title: job.title,
          location: formatLocation(job),
          job_type: job.job_type,
          work_mode: job.work_mode,
          experience_level: job.experience_level,
          salary_range: job.salary_range ?? null,
          skills: Array.isArray(job.skills) ? job.skills.slice(0, 8) : [],
          public_slug: job.public_slug ?? null,
        },
      };
    })
    .filter(Boolean)
    .slice(0, 8);

  return { success: true, summary: String(parsed.summary ?? ""), matches };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const body = await req.json().catch(() => ({}));
    const result = await matchJobs(body, supabaseClient);
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[ai-job-match] fatal", e);
    return new Response(JSON.stringify({ success: false, error: "Unexpected error." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
