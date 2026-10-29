import { ErrorCodeReference, WHATSAPP_ERRORS } from "@/components/docs/ErrorCodeReference";
import { useEffect, useState } from "react";
import CopyPageButton from "@/components/docs/CopyPageButton";
import { goBack } from "@/lib/goBack";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  FileText,
  Gauge,
  Image,
  Link2,
  Megaphone,
  MessageCircle,
  MessagesSquare,
  Send,
  Smartphone,
  UserRoundCog,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Sample = { title: string; description: string; code: string };

const API_URL = "https://jubwzelupbntbetpajqb.supabase.co/functions/v1/workly-india";

const sectionLinks = [
  { href: "#integrations", label: "Integrations", icon: Link2 },
  { href: "#multiple-numbers", label: "Multiple numbers", icon: Smartphone },
  { href: "#templates", label: "Templates", icon: FileText },
  { href: "#messages", label: "Messages & media", icon: Image },
  { href: "#interactive", label: "Replies, reactions & read", icon: Send },
  { href: "#webhooks", label: "Incoming messages", icon: MessagesSquare },
  { href: "#business-profile", label: "Business profile", icon: UserRoundCog },
  { href: "#onboarding", label: "Onboarding & Embedded Signup", icon: Users },
  { href: "#sub-accounts", label: "Connect WhatsApp for your users", icon: Users },
  { href: "#bulk", label: "Bulk / Campaign messaging", icon: Megaphone },
  { href: "#rate-limits", label: "Rate limits & tiers", icon: Gauge },
  { href: "#errors", label: "Troubleshooting", icon: AlertTriangle },
];

const samples: Sample[] = [
  {
    title: "Check connection & template approval",
    description: "Confirm your number is connected, then list templates. Only APPROVED templates can be sent.",
    code: "curl -X POST https://jubwzelupbntbetpajqb.supabase.co/functions/v1/workly-india \\\n  -H \"x-api-key: wfh_YOUR_API_KEY\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"action\":\"list_templates\",\"status\":\"APPROVED\"}'",
  },
  {
    title: "Create a template (submit for approval)",
    description: "Lowercase name, exact language code, and one example per variable. Meta reviews it (up to 48 hours).",
    code: "curl -X POST https://jubwzelupbntbetpajqb.supabase.co/functions/v1/workly-india \\\n  -H \"x-api-key: wfh_YOUR_API_KEY\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"action\":\"create_template\",\"name\":\"order_update\",\"language\":\"en_US\",\"category\":\"UTILITY\",\"components\":[{\"type\":\"BODY\",\"text\":\"Hello {{1}}, your order {{2}} is on its way. Reply here if you need help.\",\"example\":{\"body_text\":[[\"Alex\",\"A1234\"]]}}]}'",
  },
  {
    title: "Update a template",
    description: "Use the template id from list_templates. Editing resubmits it for Meta review.",
    code: "curl -X POST https://jubwzelupbntbetpajqb.supabase.co/functions/v1/workly-india \\\n  -H \"x-api-key: wfh_YOUR_API_KEY\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"action\":\"edit_template\",\"template_id\":\"META_TEMPLATE_ID\",\"components\":[{\"type\":\"BODY\",\"text\":\"Hello {{1}}, your order {{2}} has shipped. Contact us if you need help.\",\"example\":{\"body_text\":[[\"Alex\",\"A1234\"]]}}]}'",
  },
  {
    title: "Delete a template",
    description: "Removes the template from your WhatsApp Business account.",
    code: "curl -X POST https://jubwzelupbntbetpajqb.supabase.co/functions/v1/workly-india \\\n  -H \"x-api-key: wfh_YOUR_API_KEY\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"action\":\"delete_template\",\"name\":\"order_update\"}'",
  },
  {
    title: "Send an approved template",
    description: "Required to start a chat or message outside the 24-hour window. body_params fill {{1}}, {{2}} in order.",
    code: "curl -X POST https://jubwzelupbntbetpajqb.supabase.co/functions/v1/workly-india \\\n  -H \"x-api-key: wfh_YOUR_API_KEY\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"action\":\"send_template\",\"to\":\"919876543210\",\"template_name\":\"order_update\",\"language\":\"en_US\",\"body_params\":[\"Alex\",\"A1234\"]}'",
  },
  {
    title: "Send a text message",
    description: "Allowed within 24 hours of the customer's last message.",
    code: "curl -X POST https://jubwzelupbntbetpajqb.supabase.co/functions/v1/workly-india \\\n  -H \"x-api-key: wfh_YOUR_API_KEY\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"action\":\"send_text\",\"to\":\"919876543210\",\"text\":\"Your order is ready for collection.\"}'",
  },
  {
    title: "Send media",
    description: "Public HTTPS link to an image, video, audio or document. Check usage with {\"action\":\"usage\"}.",
    code: "curl -X POST https://jubwzelupbntbetpajqb.supabase.co/functions/v1/workly-india \\\n  -H \"x-api-key: wfh_YOUR_API_KEY\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"action\":\"send_media\",\"to\":\"919876543210\",\"media_type\":\"document\",\"media_url\":\"https://example.com/invoice.pdf\",\"caption\":\"Your invoice\",\"filename\":\"invoice.pdf\"}'",
  },
];

const multiSamples: Sample[] = [
  {
    title: "List your connected numbers",
    description: "Returns every number connected to your account with its phone_number_id. Pass \"from\" to choose any connected number.",
    code: `curl -X POST ${API_URL} \\\n  -H "x-api-key: wfh_YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"action":"list_numbers"}'\n\n# Response\n{"success":true,"numbers":[\n  {"phone_number_id":"111111111111111","phone":"+91 98765 43210","verified_name":"Sales"},\n  {"phone_number_id":"222222222222222","phone":"+91 91234 56789","verified_name":"Support"}\n]}`,
  },
  {
    title: "Send from a specific number (curl)",
    description: "Add \"from\" to any action — send_text, send_template, send_media, list/create/edit/delete template, status. Use the phone_number_id or the number itself.",
    code: `curl -X POST ${API_URL} \\\n  -H "x-api-key: wfh_YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"action":"send_template","from":"222222222222222","to":"919876543210","template_name":"order_update","language":"en_US","body_params":["Alex","A1234"]}'`,
  },
  {
    title: "JavaScript / Node.js",
    description: "Run on your server only.",
    code: `const API = "${API_URL}";\n\nasync function wa(body) {\n  const res = await fetch(API, {\n    method: "POST",\n    headers: { "x-api-key": process.env.WORKLY_API_KEY, "Content-Type": "application/json" },\n    body: JSON.stringify(body),\n  });\n  const data = await res.json();\n  if (!data.success) throw new Error(data.error);\n  return data;\n}\n\nconst { numbers } = await wa({ action: "list_numbers" });\nconst support = numbers.find((n) => n.verified_name === "Support");\n\nawait wa({ action: "send_text", from: support.phone_number_id, to: "919876543210", text: "Hi from Support" });\nawait wa({ action: "send_text", from: numbers[0].phone_number_id, to: "919876543210", text: "Hi from Sales" });`,
  },
  {
    title: "Python",
    description: "Same request with the requests library.",
    code: `import os, requests\n\nAPI = "${API_URL}"\nHEADERS = {"x-api-key": os.environ["WORKLY_API_KEY"], "Content-Type": "application/json"}\n\ndef wa(body):\n    data = requests.post(API, json=body, headers=HEADERS, timeout=30).json()\n    if not data.get("success"):\n        raise RuntimeError(data.get("error"))\n    return data\n\nnumbers = wa({"action": "list_numbers"})["numbers"]\nfor n in numbers:\n    wa({"action": "send_text", "from": n["phone_number_id"], "to": "919876543210", "text": f"Hello from {n['verified_name']}"})`,
  },
  {
    title: "PHP",
    description: "cURL example.",
    code: `<?php\n$ch = curl_init("${API_URL}");\ncurl_setopt_array($ch, [\n  CURLOPT_POST => true,\n  CURLOPT_RETURNTRANSFER => true,\n  CURLOPT_HTTPHEADER => ["x-api-key: " . getenv("WORKLY_API_KEY"), "Content-Type: application/json"],\n  CURLOPT_POSTFIELDS => json_encode(["action" => "send_text", "from" => "222222222222222", "to" => "919876543210", "text" => "Hello"]),\n]);\necho curl_exec($ch);`,
  },
];

const req = (body: string) => `curl -X POST ${API_URL} \\\n  -H "x-api-key: wfh_YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '${body}'`;

const onboardingSamples: Sample[] = [
  {
    title: "Embedded Signup — connect a WhatsApp number",
    description: "Every business connects its own number with the Facebook (Meta) connect button — no manual tokens. Open Employer → WhatsApp → Number and click 'Connect with Facebook'.",
    code: `What happens behind the button:
1. Facebook login opens with the app's Embedded Signup configuration
2. Business picks (or creates) a WhatsApp Business account and adds a number
3. Meta returns a code + waba_id + phone_number_id to the app
4. The app exchanges the code for a token, subscribes the app to the
   WhatsApp account, registers the number, and stores everything
   under that business — server-side only

Result: the number shows as Connected with its quality rating,
and all API calls for that business use it automatically.`,
  },
  {
    title: "Onboard many businesses (multi-customer)",
    description: "Each customer/business has its own company profile and its own connected number(s). Onboarding a new customer is always the same two steps: create their account, then they connect WhatsApp with Embedded Signup. Their messages, templates and chats stay fully separate from every other business.",
    code: `Per business:
- Own company profile  → own API key (wfh_...)
- Own WhatsApp number(s) via Embedded Signup
- Own templates, chats, campaigns and usage quota

One business can also connect several numbers
(Employer → WhatsApp → Number → "Add another number"):

${req('{"action":"list_numbers"}')}

# { "success": true, "numbers": [
#   { "phone_number_id": "1111", "phone": "+91 98xxxxxx01", "verified_name": "Your Business", "quality_rating": "GREEN" },
#   { "phone_number_id": "2222", "phone": "+91 98xxxxxx02", "verified_name": "Your Business", "quality_rating": "GREEN" } ]}`,
  },
];

const subAccountSamples: Sample[] = [
  {
    title: "1. Create a sub-account for your user",
    description: "Call once per user of your website. external_id is your own user ID; calling again with the same external_id returns the existing sub-account.",
    code: `curl -X POST ${API_URL} \\
  -H "x-api-key: wfh_YOUR_API_KEY" -H "Content-Type: application/json" \\
  -d '{"action":"create_sub_account","external_id":"user_123","name":"Rahul Traders"}'

# { "success": true, "created": true,
#   "sub_account": { "sub_account_id": "5f1c...", "external_id": "user_123", "status": "pending", "numbers": [] } }`,
  },
  {
    title: "2. Get a connect link and show your Connect WhatsApp button",
    description: "The link opens a Workly India page with Connect with Facebook. It works once and expires after 1 hour, so create it when the user clicks your button. return_url must be https.",
    code: `// Your server (Node.js / Express)
app.post("/connect-whatsapp", async (req, res) => {
  const r = await fetch("${API_URL}", {
    method: "POST",
    headers: { "x-api-key": process.env.WORKLY_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "create_connect_link",
      external_id: req.user.id,
      return_url: "https://your-site.com/whatsapp/done",
    }),
  });
  const { connect_url } = await r.json();
  res.redirect(connect_url);
});

// After connecting, the user returns to:
// https://your-site.com/whatsapp/done?status=connected&sub_account_id=...&external_id=user_123&phone_number_id=...
// status can also be "failed" (with error=...) or "cancelled".`,
  },
  {
    title: "3. Send messages as your user",
    description: "Add sub_account_id or external_id to any action (send_template, send_text, send_media, list_numbers, list_templates, create_template, get_profile...). Without it, your own number is used.",
    code: `curl -X POST ${API_URL} \\
  -H "x-api-key: wfh_YOUR_API_KEY" -H "Content-Type: application/json" \\
  -d '{"action":"send_template","external_id":"user_123","to":"919876543210",
       "template_name":"order_update","language":"en_US","body_params":["A1234"]}'

# { "success": true, "message_id": "wamid...", "from": "1111", "sub_account_id": "5f1c..." }`,
  },
  {
    title: "Python example",
    description: "The same flow with requests.",
    code: `import os, requests
API = "${API_URL}"
H = {"x-api-key": os.environ["WORKLY_API_KEY"]}

requests.post(API, headers=H, json={"action": "create_sub_account", "external_id": "user_123", "name": "Rahul Traders"})
link = requests.post(API, headers=H, json={"action": "create_connect_link", "external_id": "user_123",
                                            "return_url": "https://your-site.com/whatsapp/done"}).json()["connect_url"]
# redirect the user to link ... later:
requests.post(API, headers=H, json={"action": "send_text", "external_id": "user_123", "to": "919876543210", "text": "Hello!"})`,
  },
  {
    title: "Manage sub-accounts",
    description: "List (paginated, up to 100 per page), get one, disconnect a number, or delete a sub-account. You can also see them in Developer menu → Sub-accounts.",
    code: `{"action":"list_sub_accounts","page":1,"per_page":50,"status":"connected","search":"rahul"}
{"action":"get_sub_account","external_id":"user_123"}
{"action":"disconnect_sub_account","external_id":"user_123","phone_number_id":"1111"}
{"action":"delete_sub_account","external_id":"user_123"}`,
  },
  {
    title: "Webhook events",
    description: "Your registered webhooks receive these, signed with your secret. Incoming messages and statuses for a user's number include sub_account_id and external_id.",
    code: `whatsapp.sub_account.connected  { sub_account_id, external_id, phone_number_id, phone, verified_name }
whatsapp.sub_account.failed     { sub_account_id, external_id, error }
whatsapp.message.received       { ..., sub_account_id, external_id }
whatsapp.message.status         { ..., sub_account_id, external_id }`,
  },
];

const bulkSamples: Sample[] = [
  {
    title: "How bulk sending works",
    description: "A campaign = one approved template sent to many contacts. There is one send_template call per recipient: read your contact list (CSV, sheet or database) and call the API once per number with a small delay. Recipients who have not messaged you in 24 hours must get a template; free-form text works only inside the 24-hour window.",
    code: `CSV file (contacts.csv):
phone,name
919876543210,Rahul
919123456789,Priya

For each row → one API call:
POST ${API_URL}
{ "action": "send_template", "to": "<phone>", "template_name": "...", "language": "en_US", "body_params": ["<name>"] }`,
  },
  {
    title: "Bulk send with JavaScript (CSV upload)",
    description: "Reads a CSV file, then sends the template to every row with a 1 second gap so Meta rate limits are respected.",
    code: `import fs from "fs";

const API = "${API_URL}";
const KEY = process.env.WORKLY_API_KEY;

async function sendTemplate(to, name) {
  const r = await fetch(API, {
    method: "POST",
    headers: { "x-api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "send_template", to,
      template_name: "offer_october", language: "en_US", // exact approved language code
      body_params: [name],
    }),
  });
  const j = await r.json();
  if (!j.success) throw new Error(\`\${to}: \${j.error}\`);
  return j;
}

const rows = fs.readFileSync("contacts.csv", "utf8").trim().split("\\n").slice(1);
for (const line of rows) {
  const [phone, name] = line.split(",");
  try { await sendTemplate(phone.trim(), name.trim()); console.log("sent", phone); }
  catch (e) { console.error("failed", e.message); }
  await new Promise((r) => setTimeout(r, 1000)); // 1 msg / second
}`,
  },
  {
    title: "Bulk send with Python (CSV upload)",
    description: "Same flow with requests and the csv module.",
    code: `import csv, os, time, requests

API = "${API_URL}"
H = {"x-api-key": os.environ["WORKLY_API_KEY"]}

def send_template(to, name):
    j = requests.post(API, json={
        "action": "send_template", "to": to,
        "template_name": "offer_october", "language": "en_US",  # exact approved language code
        "body_params": [name],
    }, headers=H).json()
    if not j.get("success"):
        raise Exception(f"{to}: {j.get('error')}")
    return j

with open("contacts.csv") as f:
    for row in csv.DictReader(f):
        try:
            send_template(row["phone"].strip(), row["name"].strip())
            print("sent", row["phone"])
        except Exception as e:
            print("failed", e)
        time.sleep(1)  # 1 msg / second`,
  },
  {
    title: "Check the result of each send",
    description: "Every call returns success plus the WhatsApp message id. Keep a log of failed numbers and retry them later — do not retry instantly in a tight loop.",
    code: `# Success
{ "success": true, "message_id": "wamid.HBgM..." }

# Failure — save the number and retry after some time
{ "success": false, "error": "Template is not approved by Meta yet", "meta_code": 132001 }`,
  },
];

const bulkRules = [
  ["Approved templates only", "Bulk messages to users who have not messaged you in 24 hours must use a Meta-approved template. Free-form text works only inside the 24-hour window."],
  ["Pace your sends", "Keep about 1 message per second per number. Daily tier limits are explained in Rate limits & messaging tiers below."],
  ["Exact language code", "Use the exact language code the template was approved with (for example en_US, not en). A different code fails with template not found."],
  ["Phone format", "Digits only, with country code and no +: 919876543210."],
  ["Opt-out", "Stop messaging any user who asks to stop, or Meta will lower your quality rating and may restrict the number."],
];

const limitRules = [
  ["Three scopes are checked on every send", "Your API key as a whole, each sub-account, and each phone number each have their own counter. The first scope to reach its cap blocks the send — exactly how Meta enforces limits."],
  ["24-hour messaging tier", "Each number has a Meta messaging tier: 250, 2,000, 10,000, 100,000 or Unlimited business-initiated conversations per 24 hours. New numbers start at 250; Meta lifts it to 2,000 after business verification, then raises it automatically (10,000, 100,000, Unlimited) as quality and unique-customer volume grow. The limit is shared by every number in your business portfolio. The window is rolling — it resets 24 hours after the first message of the current window."],
  ["Burst limit", "At most 20 messages per second per scope. If you burst faster, the API tells you to retry after 1 second."],
  ["Quality-based throttling", "If Meta drops a number's quality rating to YELLOW, its limit is automatically halved; RED quarters it (minimum 50). When Meta restores GREEN, the full limit applies again — no action needed from you."],
  ["Check your usage anytime", "Call {\"action\":\"status\"} — the whatsapp_limits field shows your tier, used_24h, remaining_24h and resets_at, so you never need to contact support to know where you stand."],
  ["When a limit is hit", "The send returns success:false with error, limit, used, remaining, resets_at and retry_after_seconds. Queue the message and retry after retry_after_seconds — do not retry in a tight loop."],
];

const interactiveSamples: Sample[] = [
  { title: "Reply to a message (quote)", description: "reply_to = the message_id you received in the webhook or got back from a send.", code: req('{"action":"send_text","to":"919876543210","text":"Yes, the interview is at 10 AM.","reply_to":"wamid.HBgMOTE5ODc2NTQzMjEw..."}') + `\n\n# Response\n{"success":true,"message_id":"wamid.HBgM...NEW","to":"919876543210","from":"111111111111111"}` },
  { title: "Reply with a file", description: "reply_to works the same on send_media and send_template.", code: req('{"action":"send_media","to":"919876543210","media_type":"document","media_url":"https://example.com/offer.pdf","filename":"offer.pdf","reply_to":"wamid.HBgM..."}') },
  { title: "React with an emoji", description: "One emoji per message. Sending a new emoji replaces the old one.", code: req('{"action":"send_reaction","to":"919876543210","message_id":"wamid.HBgM...","emoji":"👍"}') },
  { title: "Remove a reaction", description: "Send an empty emoji.", code: req('{"action":"send_reaction","to":"919876543210","message_id":"wamid.HBgM...","emoji":""}') },
  { title: "Mark as read + show typing", description: "Use the incoming message_id. typing is optional.", code: req('{"action":"mark_read","message_id":"wamid.HBgM...","typing":true}') },
  { title: "Incoming reply / reaction (webhook body)", description: "What your webhook receives when a customer replies to or reacts on your message.", code: `// Customer replied (quoted) to your message\n{"event":"whatsapp.message.received","data":{"phone_number_id":"111111111111111","from":"919876543210","name":"Rahul","type":"text","text":"Is it remote?","message_id":"wamid.IN1","context":{"id":"wamid.YOUR_MSG"}}}\n\n// Customer reacted\n{"event":"whatsapp.message.received","data":{"phone_number_id":"111111111111111","from":"919876543210","type":"reaction","reaction":{"message_id":"wamid.YOUR_MSG","emoji":"❤️"}}}` },
  { title: "JavaScript — auto reply + react", description: "Inside your webhook handler, on your server.", code: `app.post("/workly-webhook", async (req, res) => {\n  res.sendStatus(200); // answer fast\n  const { event, data } = req.body;\n  if (event !== "whatsapp.message.received" || data.type !== "text") return;\n  await wa({ action: "mark_read", message_id: data.message_id, from: data.phone_number_id, typing: true });\n  await wa({ action: "send_reaction", to: data.from, message_id: data.message_id, emoji: "👍", from: data.phone_number_id });\n  await wa({ action: "send_text", to: data.from, text: "Thanks! We will get back soon.", reply_to: data.message_id, from: data.phone_number_id });\n});` },
];

const WhatsAppDocs = () => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const section = window.location.hash.slice(1);
    if (section) window.requestAnimationFrame(() => document.getElementById(section)?.scrollIntoView());
  }, []);

  const copy = async (code: string, title: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(title);
      window.setTimeout(() => setCopied(null), 2000);
      toast.success("Copied");
    } catch {
      toast.error("Could not copy the example");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-3 backdrop-blur sm:px-4">
        <Button variant="ghost" size="icon" onClick={() => goBack(navigate, "/developers")} aria-label="Back to Developer Portal">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">WhatsApp Docs</h1>
        <CopyPageButton title={"WhatsApp Docs"} />
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-semibold">WhatsApp Business integration guide</h2>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Everything developers need to connect a business number, integrate a website, send approved messages, receive events, and manage the Meta business profile.
        </p>

        <nav aria-label="Documentation sections" className="mt-6 grid grid-cols-1 gap-2 border-y border-border py-4 min-[420px]:grid-cols-2 lg:grid-cols-4">
          {sectionLinks.map(({ href, label, icon: Icon }) => (
            <a
              key={href}
              className="group flex min-h-11 items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              href={href}
            >
              <Icon className="h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 leading-5">{label}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </a>
          ))}
        </nav>

        <section id="integrations" className="scroll-mt-20 border-b border-border py-8">
          <SectionHeading icon={Link2} title="Integrations" />
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Integrate your website or automation tool with one secure endpoint after connecting your WhatsApp Business number.</p>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-muted-foreground">
            <li>Use a WhatsApp Business account and a phone number you control. Complete Meta's business, email, phone, and display-name checks when requested.</li>
            <li>Open <strong className="text-foreground">WhatsApp → Number</strong> in your employer account and connect the number through Meta.</li>
            <li>Open <strong className="text-foreground">Developer Portal → Generate New Key</strong>. Store the <code>wfh_</code> key only on your server.</li>
            <li>Create a message template and wait for Meta to mark it <strong className="text-foreground">APPROVED</strong>. Review often completes within 24 hours but can take longer; only the returned Meta status confirms approval.</li>
            <li>Send an approved template to your own phone, then reply from WhatsApp to open the 24-hour customer-service window.</li>
            <li>Add your server URL under <strong className="text-foreground">Developer Portal → Webhooks</strong> and subscribe to WhatsApp message and delivery events.</li>
          </ol>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">For your own Meta app, WhatsApp setup uses <code>whatsapp_business_management</code> and <code>whatsapp_business_messaging</code>; business onboarding may also require <code>business_management</code>. Access for other businesses depends on Meta App Review, advanced access and any required business verification. Obtain the recipient's opt-in before business-initiated messaging and honor opt-outs. Examples use dummy IDs and numbers; replace them with your own connection data and keep real credentials private.</p>
          <Button variant="outline" className="mt-5 w-full justify-between gap-2 sm:w-auto sm:justify-center" onClick={() => navigate("/employer/workly-chat")}>
            <span>Open WhatsApp</span><ExternalLink className="h-4 w-4 shrink-0" />
          </Button>
          <div className="mt-6 space-y-2 border-l-2 border-primary pl-4 text-sm leading-6 text-muted-foreground">
            <p><strong className="text-foreground">Endpoint:</strong> <code className="break-all">POST {API_URL}</code></p>
            <p><strong className="text-foreground">Header:</strong> <code>x-api-key: wfh_YOUR_API_KEY</code></p>
            <p><strong className="text-foreground">Phone format:</strong> E.164 digits only, including country code and without <code>+</code>.</p>
          </div>
          <h4 className="mt-7 font-semibold">Where to use the API</h4>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
            <li><strong className="text-foreground">Your website's server / backend</strong> (Node, PHP, Python, etc.): call the REST endpoint with your <code>x-api-key</code> header.</li>
            <li><strong className="text-foreground">CRM, ERP, Zapier, Make, n8n:</strong> use an HTTP request step with the same URL, header and JSON body.</li>
            <li><strong className="text-foreground">Real-time incoming messages and delivery status:</strong> add a webhook in Developer Portal with the WhatsApp events.</li>
            <li><strong className="text-foreground">Never</strong> put your API key in browser JavaScript or a mobile app — keep it on your server.</li>
          </ul>
          <SampleBlock sample={{ title: "Check connection and monthly usage", description: "Run these before sending. Add from when you need to inspect a particular connected number.", code: `${req('{"action":"status"}')}

${req('{"action":"usage"}')}` }} copied={copied} onCopy={copy} />
        </section>

        <section id="multiple-numbers" className="scroll-mt-20 border-b border-border py-8">
          <SectionHeading icon={Smartphone} title="Multiple WhatsApp numbers" />
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
            <li>Connect as many numbers as you need from <strong className="text-foreground">WhatsApp → Number → Add another number</strong>. One API key works for all of them.</li>
            <li>Call <code>list_numbers</code> to get each number's <code>phone_number_id</code>.</li>
            <li>Add <code>"from"</code> (phone_number_id or the number) to any request to choose the sender. If only one is connected it is used automatically; with several, the request returns 400 until you pass <code>"from"</code>.</li>
            <li>Templates belong to the WhatsApp Business account of the chosen number — if your numbers are in different accounts, create the template for each one.</li>
            <li>Successful sends return <code>"from"</code>; incoming-message webhooks include <code>phone_number_id</code> so you know which number received the message.</li>
            <li>Unknown <code>"from"</code> returns <code>404</code> with the message <em>Number is not connected to your account</em>.</li>
          </ul>
          {multiSamples.map((sample) => <SampleBlock key={sample.title} sample={sample} copied={copied} onCopy={copy} />)}
        </section>

        <section id="templates" className="scroll-mt-20 border-b border-border py-8">
          <SectionHeading icon={FileText} title="Templates" />
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Use UTILITY for transactional updates, MARKETING for promotions, and AUTHENTICATION for one-time codes. Meta may reject a template if variable examples are missing or the message has too little text around its variables. Editing an approved template can trigger a new review.</p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
            <li>Names use lowercase letters, numbers, and underscores. Language codes must match exactly, such as <code>en_US</code>.</li>
            <li>Headers can contain text, image, video, or document content; bodies can use positional variables such as <code>{'{{1}}'}</code>.</li>
            <li>Every variable needs a realistic example. Check <code>status</code> and <code>rejected_reason</code> before sending.</li>
            <li>Templates are shared at WhatsApp Business Account level. Deleting one affects every number using that account.</li>
          </ul>
          <div className="mt-5 space-y-7">
            {samples.slice(0, 5).map((sample) => (
              <div key={sample.title}><SampleBlock sample={sample} copied={copied} onCopy={copy} /></div>
            ))}
          </div>
        </section>

        <section id="messages" className="scroll-mt-20 border-b border-border py-8">
          <SectionHeading icon={Image} title="Messages & media" />
          <p className="mt-2 text-sm leading-6 text-muted-foreground">The 24-hour customer-service window starts or refreshes when the customer sends a message, not when your business sends a template. Outside that window, use an approved template with the exact language and parameters. Template approval does not replace recipient opt-in or guarantee delivery. Meta charges depend on category, destination and current pricing; Workly API quota is separate from Meta messaging charges.</p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
            <li>Supported media types are <code>image</code>, <code>video</code>, <code>audio</code>, and <code>document</code>.</li>
            <li>The media URL must be a public HTTPS link that Meta can download. Documents can include a <code>filename</code>.</li>
            <li>Captions work with images, videos, and documents; audio messages do not accept captions.</li>
            <li>Successful sends return a <code>message_id</code>. Save it to match later sent, delivered, read, or failed events.</li>
          </ul>
          <div className="mt-5 space-y-7">
            {samples.slice(5).map((sample) => (
              <div key={sample.title}><SampleBlock sample={sample} copied={copied} onCopy={copy} /></div>
            ))}
          </div>
        </section>

        <section id="interactive" className="scroll-mt-20 border-b border-border py-8">
          <SectionHeading icon={Send} title="Replies, reactions & read receipts" />
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
            <li>Every successful send returns <code>message_id</code> (a <code>wamid.…</code> id). Incoming webhooks also include <code>message_id</code>. Save it — replies and reactions point to it.</li>
            <li><strong className="text-foreground">Reply / quote:</strong> add <code>"reply_to":"wamid…"</code> to <code>send_text</code>, <code>send_media</code> or <code>send_template</code>. The customer sees your message with the original quoted above it.</li>
            <li><strong className="text-foreground">Reaction:</strong> <code>send_reaction</code> with <code>message_id</code> and one <code>emoji</code>. Send <code>"emoji":""</code> to remove your reaction. Reactions are allowed only within 30 days of the original message and do not trigger a notification sound.</li>
            <li><strong className="text-foreground">Read + typing:</strong> <code>mark_read</code> shows blue ticks to the customer; add <code>"typing":true</code> to show "typing…" for up to 25 seconds or until you reply.</li>
            <li>Free-form replies and reactions work only within the 24-hour customer window; outside it send an approved template.</li>
            <li>All of these also accept <code>"from"</code> to pick which of your numbers sends.</li>
          </ul>
          {interactiveSamples.map((sample) => <SampleBlock key={sample.title} sample={sample} copied={copied} onCopy={copy} />)}
        </section>

        <section id="webhooks" className="scroll-mt-20 border-b border-border py-8">
          <SectionHeading icon={MessagesSquare} title="Incoming messages & delivery status" />
          <p className="mt-3 text-sm leading-6 text-muted-foreground">There are two separate webhook connections: Meta sends events to Workly's configured Meta receiver; Workly forwards subscribed developer events to your server URL saved in Developer Portal → Webhooks. Do not put your developer endpoint into Meta's callback settings or replace Workly's receiver. Your server verifies Workly's X-Webhook-Signature, not Meta's upstream signature. Read stored employer conversations in WhatsApp Chat.</p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Add a webhook in Developer Portal → Webhooks and select <code>whatsapp.message.received</code> and/or <code>whatsapp.message.status</code> (or <code>whatsapp.*</code> for all). Each POST has headers <code>X-Webhook-Event</code> and <code>X-Webhook-Signature</code> (HMAC-SHA256 hex of the raw body using your endpoint secret). Reply with HTTP 200 within 8 seconds; slow requests are dropped and not retried.</p>
          <SampleBlock sample={{ title: "Webhook payloads", description: "data.phone_number_id tells you which of your numbers received the event. context is set when the customer quoted one of your messages; reaction is set for emoji reactions (empty emoji = removed).", code: `// Incoming text\n{"event":"whatsapp.message.received","created_at":"2026-10-01T12:00:00Z","data":{\n  "phone_number_id":"111111111111111","from":"919876543210","name":"Rahul",\n  "type":"text","text":"Hi","message_id":"wamid.IN1","timestamp":"1790855000",\n  "media_url":null,"context":null,"raw":{...}}}\n\n// type can be: text, image, video, audio, document, sticker, location, contacts, button, interactive, reaction\n\n// Delivery status (sent | delivered | read | failed)\n{"event":"whatsapp.message.status","created_at":"...","data":{\n  "phone_number_id":"111111111111111","message_id":"wamid.OUT1","status":"read",\n  "recipient":"919876543210","timestamp":"1790855100","errors":null}}` }} copied={copied} onCopy={copy} />
          <SampleBlock sample={{ title: "Verify the signature (Node.js)", description: "Use the raw request body, not re-serialized JSON.", code: `import crypto from "crypto";\napp.post("/workly-webhook", express.raw({ type: "application/json" }), (req, res) => {\n  const expected = crypto.createHmac("sha256", process.env.WORKLY_WEBHOOK_SECRET).update(req.body).digest("hex");\n  const got = req.get("X-Webhook-Signature") || "";\n  if (got.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected))) return res.sendStatus(401);\n  res.sendStatus(200);\n  const { event, data } = JSON.parse(req.body.toString());\n  // handle event...\n});` }} copied={copied} onCopy={copy} />
          <div className="mt-7 rounded-md border border-border bg-muted/50 p-4">
            <h4 className="font-semibold">Reliable webhook handling (do not lose events)</h4>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Responses slower than 8 seconds are dropped and never retried, so your endpoint must only verify, save and acknowledge. Do all real work later from a durable queue.</p>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
              <li><strong className="text-foreground">Verify, persist, then reply 200:</strong> check X-Webhook-Signature, insert the raw event into a database table, and return 200 immediately (target under 1 second).</li>
              <li><strong className="text-foreground">Deduplicate:</strong> use a unique key such as <code>message_id</code> + <code>event</code> + status so a repeated delivery is ignored safely (idempotent processing).</li>
              <li><strong className="text-foreground">Process from a queue:</strong> a separate worker (or queue such as SQS, RabbitMQ, Redis/BullMQ, Cloud Tasks) picks pending rows, handles them and marks them done.</li>
              <li><strong className="text-foreground">Retry with backoff:</strong> failed rows get attempts+1 and a next_attempt_at (1 min, 5 min, 30 min…). After about 8 attempts move them to a dead-letter state for manual review.</li>
              <li><strong className="text-foreground">Recover missed events:</strong> if your server was down, reconcile from the API — call <code>status</code>, re-read message state, and use WhatsApp Chat history to backfill messages you never stored.</li>
              <li><strong className="text-foreground">Monitor:</strong> alert on growing pending/dead-letter counts and on non-200 responses. Webhooks that fail for 24 hours are auto-disabled.</li>
            </ol>
          </div>
          <SampleBlock sample={{ title: "Durable webhook receiver + worker (Node.js + Postgres)", description: "Endpoint stores the event and answers fast; the worker processes, retries with backoff, and dead-letters after repeated failures.", code: `-- Table\ncreate table webhook_events (\n  id bigserial primary key,\n  dedupe_key text unique not null,\n  event text not null,\n  payload jsonb not null,\n  status text not null default 'pending', -- pending | done | dead\n  attempts int not null default 0,\n  next_attempt_at timestamptz not null default now(),\n  last_error text,\n  received_at timestamptz not null default now()\n);\n\n// Receiver: verify -> persist -> 200\napp.post("/workly-webhook", express.raw({ type: "application/json" }), async (req, res) => {\n  if (!validSignature(req)) return res.sendStatus(401);\n  const body = JSON.parse(req.body.toString());\n  const d = body.data || {};\n  const key = [body.event, d.message_id, d.status || ""].join(":");\n  await db.query(\n    "insert into webhook_events (dedupe_key, event, payload) values ($1,$2,$3) on conflict (dedupe_key) do nothing",\n    [key, body.event, body]\n  );\n  res.sendStatus(200); // well under 8 seconds\n});\n\n// Worker: run every few seconds\nasync function work() {\n  const { rows } = await db.query(\n    "update webhook_events set attempts = attempts + 1 where id in (select id from webhook_events where status='pending' and next_attempt_at <= now() order by id limit 20 for update skip locked) returning *"\n  );\n  for (const ev of rows) {\n    try {\n      await handleEvent(ev.payload); // your business logic, must be idempotent\n      await db.query("update webhook_events set status='done' where id=$1", [ev.id]);\n    } catch (e) {\n      const dead = ev.attempts >= 8;\n      const delayMin = Math.min(2 ** ev.attempts, 360);\n      await db.query(\n        "update webhook_events set status=$2, last_error=$3, next_attempt_at=now() + ($4 || ' minutes')::interval where id=$1",\n        [ev.id, dead ? "dead" : "pending", String(e.message || e), delayMin]\n      );\n    }\n  }\n}\nsetInterval(work, 5000);` }} copied={copied} onCopy={copy} />
        </section>

        <section id="business-profile" className="scroll-mt-20 border-b border-border py-8">
          <SectionHeading icon={UserRoundCog} title="WhatsApp Business profile" />
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Use these API actions from your website's server to read or update the customer-facing profile for any connected number.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ["Profile picture", "JPG or PNG, under 5 MB, at least 192 × 192 pixels."],
              ["About", "Required short status shown beneath the business name; up to 139 characters."],
              ["Description", "Explain what the business does in up to 512 characters."],
              ["Contact details", "Address, contact email, and up to two full website links."],
              ["Business category", "Choose the Meta category that best represents the business."],
              ["Account health", "Review display-name status, verification, quality rating, messaging limit, and throughput."],
            ].map(([title, description]) => (
              <div key={title} className="rounded-md border border-border bg-card p-4">
                <h4 className="text-sm font-semibold text-foreground">{title}</h4>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
          <ul className="mt-5 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
            <li>Call <code>get_profile</code> first. Add <code>from</code> to select a number; if only one is connected it is used automatically; with several, the request returns 400 until you pass <code>from</code>.</li>
            <li><code>update_profile</code> requires <code>about</code>. Omitted optional text fields are cleared, so send the complete profile you want to keep.</li>
            <li>Profile pictures must be JPG or PNG, under 5 MB and at least 192 × 192 pixels. Send one as a base64 data URL in <code>profile_picture</code>.</li>
            <li>Never expose the <code>wfh_</code> key in browser code. Your website form must submit to your own server, which then calls this API.</li>
          </ul>
          <SampleBlock sample={{ title: "Read the business profile", description: "Returns the editable fields plus Meta-controlled number, display-name, quality, verification, messaging-limit and throughput details.", code: req('{"action":"get_profile","from":"111111111111111"}') }} copied={copied} onCopy={copy} />
          <SampleBlock sample={{ title: "Update the business profile", description: "Send the complete profile from your website's server. websites accepts up to two full URLs.", code: req('{"action":"update_profile","from":"111111111111111","about":"Official customer support","description":"Orders, delivery and customer support","address":"Mumbai, Maharashtra","email":"support@example.com","websites":["https://example.com","https://jobs.example.com"],"vertical":"PROF_SERVICES"}') }} copied={copied} onCopy={copy} />
          <SampleBlock sample={{ title: "Website form handler (Node.js)", description: "Your browser submits to this private server route; only the server sends the Workly India API key.", code: `app.post("/api/whatsapp/profile", async (req, res) => {
  const response = await fetch("${API_URL}", {
    method: "POST",
    headers: {
      "x-api-key": process.env.WORKLY_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "update_profile", ...req.body }),
  });
  const result = await response.json();
  res.status(response.status).json(result);
});` }} copied={copied} onCopy={copy} />
        </section>

        <section id="onboarding" className="scroll-mt-20 border-b border-border py-8">
          <SectionHeading icon={Users} title="Onboarding & Embedded Signup" />
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Onboard many businesses, each with its own WhatsApp number connected through Embedded Signup. All calls are POST to one URL with the business's <code>wfh_</code> key in the <code>x-api-key</code> header.</p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
            <li><strong className="text-foreground">Embedded Signup first:</strong> a business can send only after its number is connected through the Facebook connect flow. Manual tokens are a backup, not the default.</li>
            <li><strong className="text-foreground">One business = one key:</strong> each business uses its own <code>wfh_</code> API key. Keys never see another business's numbers, templates or chats.</li>
            <li>Add <code>from</code> (phone_number_id or the number digits) to any send call to choose the sender; without it, the business's default number is used.</li>
          </ul>
          {onboardingSamples.map((sample) => <SampleBlock key={sample.title} sample={sample} copied={copied} onCopy={copy} />)}
        </section>

        <section id="sub-accounts" className="scroll-mt-20 border-b border-border py-8">
          <SectionHeading icon={Users} title="Connect WhatsApp for your users" />
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Have your own users? Put a Connect WhatsApp button on your website. Each user connects their own WhatsApp Business number, and you send from it with your same <code>wfh_</code> key. Each user's number, templates and chats stay separate.</p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
            <li>Sub-accounts are visible only to your key. Other developers get "Sub-account not found".</li>
            <li>All sub-account calls count against your own API quota and appear in your API Logs.</li>
            <li>Meta tokens stay on Workly India servers. You never see or store them.</li>
            <li><strong className="text-foreground">Meta requirement:</strong> connecting many outside businesses needs Workly India to be a verified Meta Tech Provider. Until that approval is complete, Meta may limit who can finish the connect step.</li>
          </ul>
          {subAccountSamples.map((sample) => <SampleBlock key={sample.title} sample={sample} copied={copied} onCopy={copy} />)}
        </section>

        <section id="bulk" className="scroll-mt-20 border-b border-border py-8">
          <SectionHeading icon={Megaphone} title="Bulk / Campaign messaging" />
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Send one approved template to many contacts by looping over your CSV list and calling the API once per number.</p>
          {bulkSamples.map((sample) => <SampleBlock key={sample.title} sample={sample} copied={copied} onCopy={copy} />)}
          <div className="mt-7 rounded-md border border-border bg-muted/50 p-4">
            <h4 className="font-semibold">Rules to avoid blocks</h4>
            <div className="mt-3 space-y-2">
              {bulkRules.map(([t, d]) => (
                <div key={t} className="text-sm leading-6"><span className="font-medium text-foreground">{t}:</span> <span className="text-muted-foreground">{d}</span></div>
              ))}
            </div>
          </div>
        </section>

        <section id="rate-limits" className="scroll-mt-20 py-8">
          <SectionHeading icon={Gauge} title="Rate limits & messaging tiers" />
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Workly India enforces the same tiered limits Meta does, so one customer's heavy or low-quality sending can never slow down or block anyone else on the platform. Limits are enforced per API key, per sub-account, and per phone number.</p>
          <div className="mt-3 space-y-2">
            {limitRules.map(([t, d]) => (
              <div key={t} className="text-sm leading-6"><span className="font-medium text-foreground">{t}:</span> <span className="text-muted-foreground">{d}</span></div>
            ))}
          </div>
          <SampleBlock sample={{ title: "See your current limit status", description: "The status action always returns your live 24-hour usage for the number.", code: `${req('{"action":"status"}')}\n\n# Response (excerpt)\n{\n  "success": true,\n  "connected": true,\n  "quality_rating": "GREEN",\n  "whatsapp_limits": {\n    "tier": "TIER_2K",\n    "limit_24h": 2000,\n    "used_24h": 132,\n    "remaining_24h": 1868,\n    "resets_at": "2026-10-09T12:00:00.000Z"\n  }\n}` }} copied={copied} onCopy={copy} />
          <SampleBlock sample={{ title: "Full overview: account + all sub-accounts", description: "One call returns your API-key usage, every number on your own account, and every sub-account with its numbers — each with tier, used, remaining and reset time. The same data is shown on the WhatsApp Limits page in the Developer Portal.", code: `${req('{"action":"limits_overview"}')}\n\n# Response (excerpt)\n{\n  "success": true,\n  "api_key": { "used_24h": 412, "resets_at": "2026-10-09T12:00:00.000Z" },\n  "account": {\n    "numbers": [\n      { "phone": "+919876543210", "quality_rating": "GREEN", "tier": "TIER_2K",\n        "limit_24h": 2000, "used_24h": 132, "remaining_24h": 1868,\n        "resets_at": "2026-10-09T12:00:00.000Z" }\n    ]\n  },\n  "sub_accounts": [\n    { "sub_account_id": "uuid", "external_id": "customer-42", "status": "connected",\n      "used_24h": 280, "resets_at": "2026-10-09T09:30:00.000Z",\n      "numbers": [\n        { "phone": "+919123456780", "quality_rating": "YELLOW", "tier": "TIER_250",\n          "limit_24h": 125, "used_24h": 100, "remaining_24h": 25,\n          "resets_at": "2026-10-09T09:30:00.000Z" }\n      ]\n    }\n  ]\n}` }} copied={copied} onCopy={copy} />
          <SampleBlock sample={{ title: "Response when a limit is reached", description: "HTTP 429. Read retry_after_seconds and queue the message instead of retrying immediately.", code: `{\n  "success": false,\n  "error": "WhatsApp 24-hour messaging limit reached for this number. The limit resets on a rolling window and rises automatically with a good quality rating, just like Meta tiers.",\n  "reason": "tier_limit",\n  "scope": "phone_number",\n  "used": 250,\n  "limit": 250,\n  "remaining": 0,\n  "resets_at": "2026-10-09T12:00:00.000Z",\n  "retry_after_seconds": 3600\n}` }} copied={copied} onCopy={copy} />
        </section>

        <section id="errors" className="scroll-mt-20 py-8">
          <SectionHeading icon={AlertTriangle} title="Troubleshooting" />
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Every response is JSON. Success: <code>{'{"success":true,...}'}</code>. Failure: <code>{'{"success":false,"error":"...","meta_code":131047}'}</code> (<code>meta_code</code> only for WhatsApp errors).</p>
          <ErrorCodeReference errors={WHATSAPP_ERRORS} />
        </section>
      </main>
    </div>
  );
};

export function SampleBlock({ sample, copied, onCopy }: { sample: Sample; copied: string | null; onCopy: (code: string, title: string) => void }) {
  return (
    <div className="mt-5 min-w-0">
      <div className="flex items-start gap-2"><Badge variant="secondary" className="mt-0.5 shrink-0">Action</Badge><h4 className="min-w-0 font-medium leading-6">{sample.title}</h4></div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{sample.description}</p>
      <div className="mt-3 min-w-0 overflow-hidden rounded-md border border-border bg-muted">
        <div className="flex h-10 items-center justify-between border-b border-border px-3">
          <span className="text-xs font-medium text-muted-foreground">Code example</span>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={`Copy ${sample.title} example`} title={`Copy ${sample.title} example`} onClick={() => onCopy(sample.code, sample.title)}>
            {copied === sample.title ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        <pre className="max-w-full overflow-x-auto p-4 text-xs leading-5 text-foreground"><code>{sample.code}</code></pre>
      </div>
    </div>
  );
}

export function SectionHeading({ icon: Icon, title }: { icon: typeof Link2; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <h3 className="text-xl font-semibold leading-tight">{title}</h3>
    </div>
  );
}

export default WhatsAppDocs;
