import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

const toJobDetail = (job: Record<string, unknown>) => ({
  id: String(job.id ?? ""),
  title: (job.title as string) ?? null,
  description: (job.description as string) ?? null,
  requirements: (job.requirements as string) ?? null,
  benefits: (job.benefits as string) ?? null,
  responsibilities: Array.isArray(job.responsibilities) ? (job.responsibilities as string[]).map(String) : [],
  location: (job.location as string) ?? null,
  city: (job.city as string) ?? null,
  state: (job.state as string) ?? null,
  country: (job.country as string) ?? null,
  job_type: (job.job_type as string) ?? null,
  work_mode: (job.work_mode as string) ?? null,
  experience_level: (job.experience_level as string) ?? null,
  education_required: (job.education_required as string) ?? null,
  salary_range: (job.salary_range as string) ?? null,
  salary_min: typeof job.salary_min === "number" ? job.salary_min : null,
  salary_max: typeof job.salary_max === "number" ? job.salary_max : null,
  salary_currency: (job.salary_currency as string) ?? null,
  skills: Array.isArray(job.skills) ? (job.skills as string[]).map(String) : [],
  openings: typeof job.openings === "number" ? job.openings : null,
  application_deadline: (job.application_deadline as string) ?? null,
  external_apply_url: (job.external_apply_url as string) ?? null,
  published_at: (job.published_at as string) ?? null,
  public_slug: (job.public_slug as string) ?? null,
});

export default defineTool({
  name: "get_job",
  title: "Get job details",
  description: "Fetch the full details of one job listing by its id or public slug.",
  inputSchema: {
    id: z.string().trim().min(1).optional().describe("The job id (UUID)."),
    job_id: z.string().trim().min(1).optional().describe("Alias for id — the job id (UUID)."),
    slug: z.string().trim().min(1).optional().describe("The job's public slug."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id, job_id, slug }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const jobId = id ?? job_id;
    if (!jobId && !slug) {
      return { content: [{ type: "text", text: "Provide either id or slug." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let request = supabase.from("jobs").select("*").limit(1);
    request = jobId ? request.eq("id", jobId) : request.eq("public_slug", slug!);

    const { data, error } = await request.maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Job not found." }], isError: true };

    const job = toJobDetail(data as Record<string, unknown>);
    return {
      content: [{ type: "text", text: JSON.stringify(job, null, 2) }],
      structuredContent: { job },
    };
  },
});
