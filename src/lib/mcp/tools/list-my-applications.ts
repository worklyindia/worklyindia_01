import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

const toApplication = (row: Record<string, unknown>) => {
  const job = (row.jobs ?? null) as Record<string, unknown> | null;
  return {
    id: String(row.id ?? ""),
    job_id: String(row.job_id ?? ""),
    status: (row.status as string) ?? null,
    applied_at: (row.applied_at as string) ?? null,
    reviewed_at: (row.reviewed_at as string) ?? null,
    application_source: (row.application_source as string) ?? null,
    job: job
      ? {
          title: (job.title as string) ?? null,
          location: (job.location as string) ?? null,
          job_type: (job.job_type as string) ?? null,
          public_slug: (job.public_slug as string) ?? null,
        }
      : null,
  };
};

export default defineTool({
  name: "list_my_applications",
  title: "List my job applications",
  description: "List the signed-in user's own job applications, newest first.",
  inputSchema: {
    status: z.string().trim().min(1).optional().describe("Only return applications with this status."),
    limit: z.number().int().min(1).max(50).default(20).describe("Maximum number of applications to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    let request = supabaseForUser(ctx)
      .from("job_applications")
      .select("id,job_id,status,applied_at,reviewed_at,application_source,jobs(title,location,job_type,public_slug)")
      .eq("applicant_id", ctx.getUserId()!)
      .order("applied_at", { ascending: false })
      .limit(limit ?? 20);

    if (status) request = request.eq("status", status);

    const { data, error } = await request;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const applications = (data ?? []).map((row) => toApplication(row as Record<string, unknown>));
    return {
      content: [
        {
          type: "text",
          text: applications.length ? JSON.stringify(applications, null, 2) : "No applications yet.",
        },
      ],
      structuredContent: { applications },
    };
  },
});
