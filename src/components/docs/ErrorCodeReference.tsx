import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export type ErrorEntry = { code: string; title: string; cause: string; fix: string };

const AUTH: ErrorEntry[] = [
  { code: "401", title: "Missing or invalid x-api-key header", cause: "No x-api-key header, or it does not start with wfh_.", fix: "Send your key in the x-api-key header from your server." },
  { code: "401", title: "Invalid or inactive API key", cause: "The key was deleted, regenerated or switched off.", fix: "Copy the current key from Developer Portal → API Keys." },
  { code: "401", title: "API key expired", cause: "The key passed its expiry date.", fix: "Create a new key in Developer Portal → API Keys." },
  { code: "402", title: "API subscription is not active", cause: "No active API plan on the key owner's account.", fix: "Activate or renew the plan in Developer Portal → API Subscription." },
  { code: "429", title: "API call limit reached", cause: "Your monthly API calls are used up (response includes used and limit).", fix: "Wait for the monthly refresh, buy more calls, or enable Auto-Top-Up." },
  { code: "500", title: "Internal server error", cause: "Unexpected server problem; the message explains what failed.", fix: "Retry after a few seconds. If it repeats, check API Call History for the logged error." },
];

export const WHATSAPP_ERRORS: ErrorEntry[] = [
  ...AUTH,
  { code: "400", title: "Invalid request", cause: "A field is missing or has the wrong type; see details.", fix: "Fix the fields listed in details and resend." },
  { code: "403", title: "No company profile", cause: "The key's account has no company profile.", fix: "Create the company profile in the Employer portal first." },
  { code: "404", title: "Number not connected", cause: "from does not match any of your numbers.", fix: "Call list_numbers and use one of the returned values." },
  { code: "404", title: "Sub-account not found", cause: "sub_account_id or external_id does not exist on your key.", fix: "Call list_sub_accounts and use a returned id." },
  { code: "409", title: "WhatsApp not connected", cause: "The number is not connected or verified.", fix: "Connect and verify the number on the employer WhatsApp page." },
  { code: "429", title: "WhatsApp limit reached (tier_limit)", cause: "24-hour tier limit or per-second burst limit hit for the key, sub-account or number.", fix: "Wait for retry_after_seconds / resets_at, then retry. Queue messages instead of retrying instantly." },
  { code: "502", title: "Meta unavailable", cause: "Temporary WhatsApp outage.", fix: "Retry after a short wait." },
  { code: "meta_code 131047", title: "24-hour window expired", cause: "The customer has not messaged you in the last 24 hours.", fix: "Send an approved template instead of text, media, reply or reaction." },
  { code: "meta_code 131026", title: "Message undeliverable", cause: "Recipient isn't on WhatsApp, or the number/country code is wrong.", fix: "Check the number in international format without + or spaces." },
  { code: "meta_code 131051", title: "Unsupported message type", cause: "The message type is not supported.", fix: "Use text, image, video, audio, document, template, reaction or location." },
  { code: "meta_code 131052", title: "Media download error", cause: "The media URL could not be downloaded.", fix: "Use a public HTTPS link that opens without login." },
  { code: "meta_code 131053", title: "Media upload error", cause: "File type or size is not accepted.", fix: "Check the allowed file types and size limits." },
  { code: "meta_code 131056", title: "Too many messages to same user", cause: "Pair rate limit for the same recipient.", fix: "Slow down and retry later." },
  { code: "meta_code 131009", title: "Invalid parameter", cause: "Often a wrong reply_to/message_id or a non-public media URL.", fix: "Check ids and media links." },
  { code: "meta_code 131008", title: "Required parameter missing", cause: "A required field is empty.", fix: "Add the missing field." },
  { code: "meta_code 131031", title: "Account locked", cause: "Meta locked the business account for policy reasons.", fix: "Check Meta Business Support for the reason." },
  { code: "meta_code 131042", title: "Payment issue", cause: "No valid payment method on the Meta business account.", fix: "Add a payment method in Meta Business Manager." },
  { code: "meta_code 132000", title: "Parameter count mismatch", cause: "body_params count differs from the template's {{n}} variables.", fix: "Send exactly one value per variable." },
  { code: "meta_code 132001", title: "Template not found", cause: "Wrong name/language, or not APPROVED on this number's account.", fix: "Call list_templates and copy name and language exactly." },
  { code: "meta_code 132005", title: "Template text too long", cause: "Filled variables made the message too long.", fix: "Shorten the variable values." },
  { code: "meta_code 132007", title: "Template policy violation", cause: "Template content breaks WhatsApp rules.", fix: "Edit and resubmit the template." },
  { code: "meta_code 132012", title: "Parameter format mismatch", cause: "A variable has the wrong format (e.g. header media).", fix: "Match each parameter type to the template." },
  { code: "meta_code 132015", title: "Template paused", cause: "Low quality paused the template.", fix: "Use another template or wait for it to resume." },
  { code: "meta_code 132016", title: "Template disabled", cause: "Template permanently disabled for quality.", fix: "Create a new template." },
  { code: "meta_code 133010", title: "Phone number not registered", cause: "The sending number isn't registered on Cloud API.", fix: "Reconnect the number on the WhatsApp page." },
  { code: "meta_code 190", title: "Access token expired", cause: "The WhatsApp connection token is no longer valid.", fix: "Reconnect WhatsApp on the employer WhatsApp page." },
  { code: "meta_code 130429", title: "Throughput limit reached", cause: "Too many messages per second.", fix: "Send in smaller batches with a delay." },
  { code: "meta_code 131048", title: "Spam rate limit", cause: "Many users blocked or reported your messages.", fix: "Improve message quality; send only to opted-in users." },
  { code: "meta_code 368", title: "Temporarily blocked for policy", cause: "Policy violation on the account.", fix: "Check Meta Business Support." },
];

export const socialErrors = (name: string): ErrorEntry[] => [
  ...AUTH,
  { code: "400", title: "Invalid request", cause: "A field is missing or wrong; see details.", fix: "Fix the fields listed in details." },
  { code: "400", title: "Several accounts are connected", cause: `More than one ${name} account is connected and no account was sent.`, fix: "Call list_accounts and pass account." },
  { code: "404", title: "Account not connected", cause: "The account value does not match a connected account.", fix: "Call list_accounts and use a returned value." },
  { code: "404", title: "Sub-account not found", cause: "sub_account_id or external_id does not exist.", fix: "Use an id from your sub-account list." },
  { code: "409", title: `${name} is not connected`, cause: `No ${name} account connected on AI Connect.`, fix: `Connect ${name} on the AI Connect page.` },
  { code: "409", title: "Account token missing", cause: "The connection lost its token.", fix: `Reconnect ${name} on the AI Connect page.` },
  { code: "502", title: "Meta unavailable", cause: "Temporary Meta outage.", fix: "Retry after a short wait." },
  { code: "meta_code 10 / 551", title: "Permission or recipient restriction", cause: "Missing app permission, recipient unavailable, or outside the messaging window.", fix: "Read the full Meta message; check permissions and the 24-hour window." },
  { code: "meta_code 100", title: "Invalid parameter", cause: "Wrong to / conversation_id / comment_id, or non-public media URL.", fix: "Use ids from list calls and public media links." },
  { code: "meta_code 190", title: "Token expired", cause: "The connection token expired or was revoked.", fix: `Reconnect ${name} on the AI Connect page.` },
  { code: "meta_code 200", title: "Permission denied", cause: "The app lacks the needed permission for this action.", fix: `Reconnect ${name} and accept all requested permissions.` },
  { code: "meta_code 4 / 17 / 32 / 613", title: "Rate limit", cause: "Too many calls in a short time.", fix: "Wait a few minutes and retry with fewer calls." },
  { code: "meta_code 2018278", title: "Outside 24-hour window", cause: "The person has not messaged in the last 24 hours.", fix: "Wait for the person to message you first." },
  { code: "meta_code 2534022", title: "Message window closed", cause: "Messaging is only allowed inside the allowed window.", fix: "Reply after the person messages again." },
];

export const EMAIL_ERRORS: ErrorEntry[] = [
  ...AUTH,
  { code: "400", title: "Invalid request", cause: "Missing or wrong field (to, subject, body, message_id…).", fix: "Fix the field named in the message." },
  { code: "400", title: "Mailbox rejected the action", cause: "Gmail, Outlook or the domain mailbox refused (message explains why).", fix: "Read the message; check recipient address, attachment size and mailbox permissions." },
  { code: "404", title: "Account is not connected in AI Connect", cause: "The account email you sent isn't connected.", fix: "Use an email from list_accounts, or connect it on AI Connect." },
  { code: "409", title: "mailbox_not_connected", cause: "No Gmail, Outlook or Domain email connected.", fix: "Connect a mailbox on the AI Connect page." },
  { code: "409", title: "Mailbox reconnect needed", cause: "Mailbox access expired or was revoked.", fix: "Reconnect the mailbox on the AI Connect page." },
];

export const JOBS_ERRORS: ErrorEntry[] = [
  ...AUTH.filter((e) => e.code !== "429"),
  { code: "401", title: "API key is required", cause: "No x-api-key header.", fix: "Send your key in x-api-key." },
  { code: "429", title: "API call limit reached", cause: "Monthly API calls are used up.", fix: "Wait for refresh, buy more calls or enable Auto-Top-Up." },
  { code: "400", title: "Invalid action or method", cause: "Unknown action or wrong HTTP method.", fix: "Use an action and method shown in these docs." },
  { code: "400", title: "Title must be between 5-30 characters", cause: "Job title too short or too long.", fix: "Use a 5–30 character title." },
  { code: "400", title: "Location is required", cause: "Location is empty.", fix: "Send a location." },
  { code: "400", title: "Invalid job_type", cause: "job_type isn't an allowed value.", fix: "Use one of the job types listed in these docs." },
  { code: "400", title: "API user must have a company profile", cause: "The key's account has no company.", fix: "Create the company profile first." },
  { code: "400", title: "Job posting is currently disabled", cause: "Posting is switched off on the platform.", fix: "Try again later." },
  { code: "400", title: "No active pricing package", cause: "No package available for the chosen duration.", fix: "Choose another duration or try later." },
  { code: "400", title: "Duration must be 30, 90, or 180 days", cause: "Unsupported duration.", fix: "Send 30, 90 or 180." },
  { code: "400", title: "Job ID is required", cause: "job_id missing for update/delete/detail.", fix: "Send job_id." },
  { code: "400", title: "You do not have permission to edit/delete this job", cause: "The job belongs to another company.", fix: "Use a job id from your own job list." },
  { code: "402", title: "Wallet payments have been removed", cause: "boost and extend actions are no longer available by API.", fix: "Boost or extend from the Employer portal with Razorpay." },
  { code: "404", title: "Job not found", cause: "The job id doesn't exist or was deleted.", fix: "Get a valid id from the job list." },
];

export const OAUTH_ERRORS: ErrorEntry[] = [
  { code: "redirect_uri mismatch", title: "Redirect URI not registered", cause: "The redirect_uri differs from the registered one.", fix: "Match it exactly, including https, path and trailing slash." },
  { code: "invalid_request", title: "Missing or bad parameter", cause: "A required parameter (client_id, response_type, code_challenge…) is missing.", fix: "Send every parameter shown in the authorize example." },
  { code: "invalid_grant", title: "Code invalid", cause: "Code already used, expired, or wrong code_verifier.", fix: "Start sign-in again and exchange the code once, quickly." },
  { code: "invalid_client", title: "Client authentication failed", cause: "Wrong client_id/secret, or a public client sent a secret.", fix: "Check credentials in Developer Portal → OAuth Apps." },
  { code: "unauthorized_client", title: "Client not allowed", cause: "The app isn't allowed this grant type.", fix: "Use authorization_code with PKCE." },
  { code: "unsupported_grant_type", title: "Grant type not supported", cause: "grant_type isn't authorization_code or refresh_token.", fix: "Use a supported grant_type." },
  { code: "invalid_scope", title: "Unknown scope", cause: "A requested scope isn't supported.", fix: "Request only the scopes listed in these docs." },
  { code: "access_denied", title: "User denied", cause: "The user pressed Deny.", fix: "Show a friendly message and let them try again." },
  { code: "invalid_token (401)", title: "Access token invalid", cause: "Token expired or revoked.", fix: "Use the refresh token to get a new one, or sign in again." },
  { code: "Consent page 404", title: "Consent page not found", cause: "Site URL wrong or app not published.", fix: "Check the Site URL and publish the app." },
  { code: "Login loop", title: "Endless login loop", cause: "Browser blocks cookies.", fix: "Open the authorize link in the same browser tab and allow cookies." },
];

export function ErrorCodeReference({ errors, intro }: { errors: ErrorEntry[]; intro?: React.ReactNode }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return errors;
    return errors.filter((e) => `${e.code} ${e.title} ${e.cause} ${e.fix}`.toLowerCase().includes(t));
  }, [q, errors]);
  return (
    <div className="mt-4">
      {intro && <p className="mb-3 text-sm leading-6 text-muted-foreground">{intro}</p>}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search error code or message (e.g. 429, 131047, expired)" className="pl-9" aria-label="Search error codes" />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{list.length} of {errors.length} errors</p>
      <dl className="mt-3 space-y-3 text-sm leading-6">
        {list.map((e, i) => (
          <div key={`${e.code}-${e.title}-${i}`} className="rounded-md border border-border p-3">
            <dt className="font-medium"><code className="mr-2 rounded bg-muted px-1.5 py-0.5 text-xs">{e.code}</code>{e.title}</dt>
            <dd className="mt-1 text-muted-foreground"><span className="font-medium text-foreground">Why: </span>{e.cause}</dd>
            <dd className="text-muted-foreground"><span className="font-medium text-foreground">Fix: </span>{e.fix}</dd>
          </div>
        ))}
        {list.length === 0 && <p className="text-sm text-muted-foreground">No matching error. Copy the full error message and check API Call History.</p>}
      </dl>
    </div>
  );
}
