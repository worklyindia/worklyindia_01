import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchJobsTool from "./tools/search-jobs";
import getJobTool from "./tools/get-job";
import listMyApplicationsTool from "./tools/list-my-applications";
import getMyProfileTool from "./tools/get-my-profile";

// Direct Supabase host for the OAuth issuer (never the proxy URL).
const projectRef = "jubwzelupbntbetpajqb";

export default defineMcp({
  name: "remix-of-remix-of-remix-of-easy-deployer",
  title: "Remix of Remix of Remix of Easy Deployer",
  version: "0.1.0",
  instructions:
    "Tools for this job portal. Use `search_jobs` to find published job listings, `get_job` for the full details of one listing, `list_my_applications` for the signed-in user's own applications, and `get_my_profile` for their job seeker profile.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
    // The app's own AI chat calls this server with the signed-in user's
    // Supabase session token (no OAuth client_id claim). External MCP clients
    // still go through the full OAuth 2.1 flow; tokens are verified either way.
    requireOAuthClientClaim: false,
  }),
  tools: [searchJobsTool, getJobTool, listMyApplicationsTool, getMyProfileTool],
});
