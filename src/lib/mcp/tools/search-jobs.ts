import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

const toJobSummary = (job: Record<string, unknown>) => ({
  id: String(job.id ?? ""),
  title: (job.title as string) ?? null,
  location: (job.location as string) ?? null,
  city: (job.city as string) ?? null,
  state: (job.state as string) ?? null,
  job_type: (job.job_type as string) ?? null,
  work_mode: (job.work_mode as string) ?? null,
  experience_level: (job.experience_level as string) ?? null,
  salary_range: (job.salary_range as string) ?? null,
  skills: Array.isArray(job.skills) ? (job.skills as string[]).map(String) : [],
  published_at: (job.published_at as string) ?? null,
  public_slug: (job.public_slug as string) ?? null,
});

export default defineTool({
  name: "search_jobs",
  title: "Search jobs",
  description: "Search published job listings by keyword, location, job type or work mode.",
  inputSchema: {
    query: z.string().trim().min(1).optional().describe("Keyword matched against the job title."),
    location: z.string().trim().min(1).optional().describe("City, state or location text to match."),
    job_type: z.string().trim().min(1).optional().describe("Job type, e.g. full-time or internship."),
    work_mode: z.string().trim().min(1).optional().describe("Work mode, e.g. remote, hybrid or onsite."),
    limit: z.number().int().min(1).max(50).default(10).describe("Maximum number of jobs to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, location, job_type, work_mode, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    let request = supabaseForUser(ctx)
      .from("jobs")
      .select("id,title,location,city,state,job_type,work_mode,experience_level,salary_range,skills,published_at,public_slug")
      .eq("status", "active")
      .order("published_at", { ascending: false })
      .limit(limit ?? 10);

    if (query) request = request.ilike("title", `%${query}%`);
    if (location) request = request.or(`location.ilike.%${location}%,city.ilike.%${location}%,state.ilike.%${location}%`);
    if (job_type) request = request.ilike("job_type", job_type);
    if (work_mode) request = request.ilike("work_mode", work_mode);

    const { data, error } = await request;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const jobs = (data ?? []).map((job) => toJobSummary(job as Record<string, unknown>));
    return {
      content: [{ type: "text", text: jobs.length ? JSON.stringify(jobs, null, 2) : "No matching jobs found." }],
      structuredContent: { jobs },
    };
  },
});
