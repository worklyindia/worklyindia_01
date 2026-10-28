import { Users } from "lucide-react";
import { SampleBlock, SectionHeading } from "@/pages/owner-portal/WhatsAppDocs";

const SUB_API = "https://jubwzelupbntbetpajqb.supabase.co/functions/v1/workly-india";

type Kind = "instagram" | "facebook" | "email";

const META: Record<Kind, { name: string; channels: string; button: string; sendUrl: string; send: string; reply: string }> = {
  instagram: {
    name: "Instagram", channels: '"instagram"', button: "Connect Instagram", sendUrl: SUB_API,
    send: `{"platform":"instagram","action":"send_text","external_id":"user_123","to":"1789000111","text":"Hello"}`,
    reply: `{ "success": true, "message_id": "aWdf...", "sub_account_id": "5f1c..." }`,
  },
  facebook: {
    name: "Facebook Page", channels: '"facebook"', button: "Connect Facebook Page", sendUrl: SUB_API,
    send: `{"platform":"facebook","action":"send_text","external_id":"user_123","to":"2456000111","text":"Hello"}`,
    reply: `{ "success": true, "message_id": "m_...", "sub_account_id": "5f1c..." }`,
  },
  email: {
    name: "Email (Gmail, Outlook, Domain email)", channels: '"gmail", "outlook" or "domain_email"', button: "Connect Email", sendUrl: "https://jubwzelupbntbetpajqb.supabase.co/functions/v1/email-api",
    send: `{"action":"send_email","external_id":"user_123","to":"customer@example.com","subject":"Order update","text":"Your order is ready"}`,
    reply: `{ "success": true, "message_id": "...", "from": "rahul@gmail.com", "sub_account_id": "5f1c..." }`,
  },
};

export function ChannelOnboardingDocs({ kind, copied, onCopy }: { kind: Kind; copied: string | null; onCopy: (code: string, title: string) => void }) {
  const m = META[kind];
  const ch = kind === "email" ? "gmail" : kind;
  const samples = [
    {
      title: "1. Create a sub-account for your user",
      description: "Call once per user of your website. external_id is your own user ID; calling again with the same external_id returns the same sub-account. The same sub-account can connect WhatsApp, Instagram, Facebook and email.",
      code: `curl -X POST ${SUB_API} \\
  -H "x-api-key: wfh_YOUR_API_KEY" -H "Content-Type: application/json" \\
  -d '{"action":"create_sub_account","external_id":"user_123","name":"Rahul Traders"}'

# { "success": true, "created": true,
#   "sub_account": { "sub_account_id": "5f1c...", "external_id": "user_123", "status": "pending" } }`,
    },
    {
      title: `2. Get a connect link and show your ${m.button} button`,
      description: `Set channel to ${m.channels}. The link opens a Workly India page where your user signs in and allows access. It works once and expires after 1 hour, so create it when the user clicks your button. return_url must be https.`,
      code: `// Your server (Node.js / Express)
app.post("/connect-${kind}", async (req, res) => {
  const r = await fetch("${SUB_API}", {
    method: "POST",
    headers: { "x-api-key": process.env.WORKLY_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "create_connect_link",
      channel: "${ch}",
      external_id: req.user.id,
      return_url: "https://your-site.com/${kind}/done",
    }),
  });
  const { connect_url } = await r.json();
  res.redirect(connect_url);
});

// After connecting, the user returns to:
// https://your-site.com/${kind}/done?status=connected&sub_account_id=...&external_id=user_123
// status can also be "failed" (with error=...) or "cancelled".`,
    },
    {
      title: "3. Check what your user connected",
      description: "channels lists every connected account of this user.",
      code: `curl -X POST ${SUB_API} \\
  -H "x-api-key: wfh_YOUR_API_KEY" -H "Content-Type: application/json" \\
  -d '{"action":"get_sub_account","external_id":"user_123"}'

# { "success": true, "sub_account": { "status": "connected",
#   "channels": [ { "channel": "${ch}", ${kind === "email" ? '"email": "rahul@gmail.com"' : '"account_id": "6f1c...", "name": "Rahul Traders"'} } ] } }`,
    },
    {
      title: "4. Work as your user",
      description: "Add sub_account_id or external_id to any action on this page. Without it, your own connected account is used.",
      code: `curl -X POST ${m.sendUrl} \\
  -H "x-api-key: wfh_YOUR_API_KEY" -H "Content-Type: application/json" \\
  -d '${m.send}'

# ${m.reply}`,
    },
    {
      title: "5. Disconnect or delete",
      description: "Disconnect removes only this channel. Delete removes the sub-account and every connected account.",
      code: `# Disconnect only ${m.name}
-d '{"action":"disconnect_sub_account","external_id":"user_123","channel":"${ch}"}'

# Delete the user completely
-d '{"action":"delete_sub_account","external_id":"user_123"}'`,
    },
  ];
  return (
    <section id="onboarding" className="scroll-mt-20 border-b border-border py-8">
      <SectionHeading icon={Users} title={`Onboarding: connect ${m.name} for your users`} />
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Offer {m.name} as a service on your own website. Put a <strong className="text-foreground">{m.button}</strong> button on your site; each of your users connects their own account, and you work with it using your same <code>wfh_</code> key. Sub-account calls go to <code className="break-all">{SUB_API}</code>.</p>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
        <li>Each user's accounts, chats and messages stay separate. Sub-accounts are visible only to your key; other developers get "Sub-account not found".</li>
        <li>All sub-account calls count against your own API quota and appear in your API Logs.</li>
        <li>Login tokens stay on Workly India servers. You never see or store them.</li>
        <li>Webhooks: you receive <code>{ch}.sub_account.connected</code>, <code>.failed</code> and <code>.disconnected</code> events, plus your users' incoming messages tagged with <code>sub_account_id</code>.</li>
      </ul>
      {samples.map((s) => <SampleBlock key={s.title} sample={s} copied={copied} onCopy={onCopy} />)}
    </section>
  );
}
