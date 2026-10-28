import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

const toProfile = (row: Record<string, unknown>) => ({
  full_name: (row.full_name as string) ?? null,
  email: (row.email as string) ?? null,
  bio: (row.bio as string) ?? null,
  current_position: (row.current_position as string) ?? null,
  company: (row.company as string) ?? null,
  industry: (row.industry as string) ?? null,
  experience_years: typeof row.experience_years === "number" ? row.experience_years : null,
  education: (row.education as string) ?? null,
  skills: Array.isArray(row.skills) ? (row.skills as string[]).map(String) : [],
  languages: Array.isArray(row.languages) ? (row.languages as string[]).map(String) : [],
  location: (row.location as string) ?? null,
  city: (row.city as string) ?? null,
  state: (row.state as string) ?? null,
  country: (row.country as string) ?? null,
  preferred_location: (row.preferred_location as string) ?? null,
  job_type: (row.job_type as string) ?? null,
  is_profile_complete: row.is_profile_complete === true,
});

export default defineTool({
  name: "get_my_profile",
  title: "Get my profile",
  description: "Fetch the signed-in user's own job seeker profile.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const { data, error } = await supabaseForUser(ctx)
      .from("profiles")
      .select("*")
      .eq("user_id", ctx.getUserId()!)
      .maybeSingle();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "No profile found for this account." }], isError: true };

    const profile = toProfile(data as Record<string, unknown>);
    return {
      content: [{ type: "text", text: JSON.stringify(profile, null, 2) }],
      structuredContent: { profile },
    };
  },
});
