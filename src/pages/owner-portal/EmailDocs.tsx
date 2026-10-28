import { ChannelOnboardingDocs } from "@/components/docs/ChannelOnboardingDocs";
import { ErrorCodeReference, EMAIL_ERRORS } from "@/components/docs/ErrorCodeReference";
import { useEffect, useState } from "react";
import CopyPageButton from "@/components/docs/CopyPageButton";
import { goBack } from "@/lib/goBack";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, KeyRound, Mail, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { SampleBlock, SectionHeading } from "./WhatsAppDocs";

type Sample = { title: string; description: string; code: string };

const API_URL = "https://jubwzelupbntbetpajqb.supabase.co/functions/v1/email-api";

const workflyApiSamples: Sample[] = [
  {
    title: "Check API status",
    description: "See which mailbox is connected and will be used as the sender.",
    code: `curl -X POST ${API_URL} \\
  -H "x-api-key: wfh_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"action":"status"}'

// → { "success": true, "connected": true, "accounts": [{ "provider": "gmail", "email": "you@gmail.com" }] }`,
  },
  {
    title: "Send an email",
    description: "The email is sent from your own Gmail, Outlook or Domain email connected on the Workly India AI Connect page. Separate several recipients with commas. Optional provider: gmail | outlook | domain.",
    code: `curl -X POST ${API_URL} \\
  -H "x-api-key: wfh_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"action":"send_email","to":"candidate@example.com","subject":"Interview scheduled","text":"Hi Rahul, your interview is on Monday at 10 AM."}'

// → { "success": true, "sent": true, "provider": "gmail", "to": "candidate@example.com" }`,
  },
  {
    title: "Read the inbox",
    description: "List emails from your connected mailbox. Optional: offset, limit (max 50), unread_only.",
    code: `curl -X POST ${API_URL} \\
  -H "x-api-key: wfh_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"action":"list_inbox","limit":20,"unread_only":true}'

// → { "success": true, "items": [{ "id": "...", "provider": "gmail", "from": "...", "subject": "...", "text": "...", "date": "...", "unread": true, "has_attachments": false, "attachments": [] }], "has_more": false }`,
  },
  {
    title: "Open a conversation",
    description: "Read all messages of one email thread, including full HTML bodies.",
    code: `curl -X POST ${API_URL} \\
  -H "x-api-key: wfh_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"action":"get_thread","provider":"gmail","id":"MESSAGE_ID"}'

// → { "success": true, "items": [{ "id": "...", "from": "...", "subject": "...", "text": "...", "html": "<p>...</p>", ... }] }`,
  },
  {
    title: "Reply to an email",
    description: "Reply inside an existing conversation. Optional files: up to 5 attachments as base64 ({ name, mimeType, data }).",
    code: `curl -X POST ${API_URL} \\
  -H "x-api-key: wfh_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"action":"reply","provider":"gmail","id":"MESSAGE_ID","text":"Thanks, we received your application."}'

// → { "success": true, "sent": true, "provider": "gmail", "reply_to": "MESSAGE_ID" }`,
  },
  {
    title: "Download an attachment",
    description: "Get one attachment as base64. You need the email id, the message id and the attachment id from the inbox or thread.",
    code: `curl -X POST ${API_URL} \\
  -H "x-api-key: wfh_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"action":"get_attachment","provider":"gmail","id":"EMAIL_ID","message_id":"MESSAGE_ID","attachment_id":"ATTACHMENT_ID"}'

// → { "success": true, "filename": "resume.pdf", "mime_type": "application/pdf", "data_base64": "JVBERi0x..." }`,
  },
  {
    title: "Delete emails",
    description: "Delete up to 50 emails at once from your connected mailbox.",
    code: `curl -X POST ${API_URL} \\
  -H "x-api-key: wfh_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"action":"delete","provider":"gmail","ids":["EMAIL_ID_1","EMAIL_ID_2"]}'

// → { "success": true, "deleted": 2 }`,
  },
  {
    title: "Check usage",
    description: "See how many emails you sent this month through the API.",
    code: `curl -X POST ${API_URL} \\
  -H "x-api-key: wfh_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"action":"usage"}'

// → { "success": true, "plan": "unlimited", "sent_this_month": 42 }`,
  },
  {
    title: "Node.js — send from your website server",
    description: "Keep the API key in a server environment variable, never in browser code.",
    code: `const res = await fetch("${API_URL}", {
  method: "POST",
  headers: { "x-api-key": process.env.WORKLY_API_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ action: "send_email", to: "candidate@example.com", subject: "Hello", text: "Hi!" }),
});
const data = await res.json(); // { success: true, sent: true }`,
  },
  {
    title: "Receive new emails on your website (webhook)",
    description: "Add a webhook in Developer Portal → Webhooks and tick All Gmail, All Outlook or All domain email events (then pick which mailboxes). Events arrive as email.received. New emails arriving in your connected mailbox reach your website within about 1 hour, signed with your webhook secret (X-Webhook-Signature = HMAC-SHA256 of the body).",
    code: `POST https://yourwebsite.com/webhooks/workly
X-Webhook-Event: email.received
X-Webhook-Signature: 5f2b...

{
  "event": "email.received",
  "created_at": "2026-10-01T10:00:00.000Z",
  "data": {
    "id": "18c2f...", "provider": "gmail", "mailbox": "you@gmail.com",
    "from": "Rahul <rahul@example.com>", "to": "you@gmail.com",
    "subject": "Job application", "text": "Hello, I want to apply...",
    "date": "2026-10-01T09:59:12.000Z", "unread": true,
    "has_attachments": true, "attachments": [{ "id": "ANGj...", "filename": "resume.pdf", "mime_type": "application/pdf", "size": 120334 }]
  }
}

// Node.js — verify the signature
import crypto from "crypto";
const expected = crypto.createHmac("sha256", process.env.WEBHOOK_SECRET).update(rawBody).digest("hex");
if (expected !== req.headers["x-webhook-signature"]) return res.status(401).end();`,
  },
];

const multiAccountSamples: Sample[] = [
  {
    title: "List all connected accounts",
    description: "Returns every Gmail, Outlook and Domain email account connected on AI Connect.",
    code: `curl -X POST ${API_URL} \\
  -H "x-api-key: wfh_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"action":"list_accounts"}'

// → { "success": true, "accounts": [
//     { "provider": "gmail",   "email": "sales@gmail.com"  },
//     { "provider": "gmail",   "email": "hr@gmail.com" },
//     { "provider": "outlook", "email": "team@outlook.com"  },
//     { "provider": "domain",  "email": "jobs@yourcompany.in"  } ] }`,
  },
  {
    title: "Send from a specific account",
    description: "Pass account with the exact email address you want to send from. The type (gmail / outlook / domain) is detected automatically. With several accounts connected, account is required (400 otherwise).",
    code: `curl -X POST ${API_URL} \\
  -H "x-api-key: wfh_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"action":"send_email","account":"hr@gmail.com","to":"candidate@example.com","subject":"Interview scheduled","text":"Hi Rahul, your interview is on Monday at 10 AM."}'

// → { "success": true, "sent": true, "provider": "gmail", "from": "hr@gmail.com", "to": "candidate@example.com" }`,
  },
  {
    title: "Read, reply, attachments and delete for one account",
    description: "Add account to list_inbox, get_thread, reply, get_attachment or delete to work with that mailbox only. list_inbox also accepts provider to show only Gmail, Outlook or Domain emails.",
    code: `// Inbox of one account
{"action":"list_inbox","account":"jobs@yourcompany.in","limit":20}

// Reply from the same account the email arrived in
{"action":"reply","provider":"domain","account":"jobs@yourcompany.in","id":"MESSAGE_ID","text":"Thanks, we received your application."}

// Unknown account → 404 { "success": false, "error": "Account x@y.com is not connected in AI Connect" }`,
  },
  {
    title: "Node.js — choose the sender per email",
    description: "Use a different account for each kind of email, for example HR mails from hr@ and sales mails from sales@.",
    code: `async function sendFrom(account, to, subject, text) {
  const res = await fetch("${API_URL}", {
    method: "POST",
    headers: { "x-api-key": process.env.WORKLY_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "send_email", account, to, subject, text }),
  });
  return res.json();
}

await sendFrom("hr@gmail.com", "candidate@example.com", "Interview", "Monday 10 AM");
await sendFrom("sales@yourcompany.in", "client@example.com", "Quote", "Please find our quote.");`,
  },
];

const EmailDocs = () => {
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

  const Steps = ({ items }: { items: React.ReactNode[] }) => (
    <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-muted-foreground">
      {items.map((it, i) => <li key={i}>{it}</li>)}
    </ol>
  );
  const B = ({ children }: { children: React.ReactNode }) => <strong className="text-foreground">{children}</strong>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-3 backdrop-blur sm:px-4">
        <Button variant="ghost" size="icon" onClick={() => goBack(navigate, "/developers")} aria-label="Back to Developer Portal">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Email Docs</h1>
        <CopyPageButton title={"Email Docs"} />
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Mail className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-semibold">Workly India Email API</h2>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Full email service for your website through the Workly India API — connect Gmail, Outlook or Domain email once on the AI Connect page, then send, read, reply, download attachments and delete with one API key.
        </p>

        <section id="workly-api" className="scroll-mt-20 py-8">
          <SectionHeading icon={KeyRound} title="Complete email service through your connected mailbox" />
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Works like the WhatsApp API: one API key, and your website gets the full email service through the Workly India API using the Gmail, Outlook or Domain email you connected on the AI Connect page. If nothing is connected, calls return an error. Usage is metered on your API subscription.
          </p>
          <Steps items={[
            <>In the <B>Developer Portal</B>, activate an API subscription and create an <B>API key</B> (starts with <code>wfh_</code>).</>,
            <>Connect your <B>Gmail, Outlook or Domain email</B> on the <B>AI Connect</B> page.</>,
            <>Call the API from your server with the header <code>x-api-key</code> (examples below).</>,
            <>To get new emails on your website, add a <B>webhook</B> and tick <B>All Gmail / Outlook / domain email events</B>, then choose the mailboxes.</>,
          ]} />
          <p className="mt-4 break-all text-sm text-muted-foreground">Endpoint: <code className="text-foreground">POST {API_URL}</code></p>
          {workflyApiSamples.map((s) => <SampleBlock key={s.title} sample={s} copied={copied} onCopy={copy} />)}
          <ErrorCodeReference errors={EMAIL_ERRORS} />
        </section>

        <section id="multiple-accounts" className="scroll-mt-20 border-t border-border py-8">
          <SectionHeading icon={Users} title="Multiple Gmail, Outlook and Domain email accounts" />
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            You can connect several accounts of each type and choose the account each email is sent from, using the same API key.
          </p>
          <h4 className="mt-5 font-medium">How to connect more accounts</h4>
          <Steps items={[
            <>Open <B>AI Connect</B> and connect your first <B>Gmail</B>, <B>Outlook</B> or <B>Domain Email</B> account.</>,
            <>Tap <B>Settings</B> on that card, open the account menu at the top and choose <B>Add another Gmail / Outlook / Domain email account</B>.</>,
            <><B>Gmail / Outlook:</B> sign in with the other Google or Microsoft account. <B>Domain Email:</B> enter the email, password and mail server (Hostinger, GoDaddy, Zoho, cPanel, Google Workspace and others are pre-filled).</>,
            <>Switch accounts from the same menu. Any connected account can be used by passing its email as <code>account</code>.</>,
            <>Each account keeps its own AI auto-reply settings. <B>Remove this account</B> appears only when 2 or more accounts are connected.</>,
          ]} />
          <h4 className="mt-6 font-medium">Choosing the sender in the API</h4>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
            <li><code>account</code> — the exact email address to use. Works on every action.</li>
            <li><code>provider</code> — <code>gmail</code>, <code>outlook</code> or <code>domain</code>. Optional; <code>account</code> picks the exact mailbox.</li>
            <li>No <code>account</code> — works only when exactly one mailbox is connected.</li>
            <li>Webhook <code>email.received</code> events include <code>mailbox</code>, so you know which account received each email.</li>
          </ul>
          {multiAccountSamples.map((s) => <SampleBlock key={s.title} sample={s} copied={copied} onCopy={copy} />)}
        </section>

        <ChannelOnboardingDocs kind="email" copied={copied} onCopy={copy} />
      </main>
    </div>
  );
};

export default EmailDocs;
