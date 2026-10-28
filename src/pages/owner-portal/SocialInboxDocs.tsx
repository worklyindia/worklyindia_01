import { ChannelOnboardingDocs } from "@/components/docs/ChannelOnboardingDocs";
import { ErrorCodeReference, socialErrors } from "@/components/docs/ErrorCodeReference";
import { useEffect, useState } from "react";
import CopyPageButton from "@/components/docs/CopyPageButton";
import { goBack } from "@/lib/goBack";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ChevronRight, ExternalLink, Image, Inbox, Link2, MessageCircle, MessagesSquare, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { SampleBlock, SectionHeading } from "./WhatsAppDocs";

type Platform = "instagram" | "facebook";
const API_URL = "https://jubwzelupbntbetpajqb.supabase.co/functions/v1/workly-india";

const sectionLinks = [
  { href: "#integrations", label: "Integrations", icon: Link2 },
  { href: "#accounts", label: "Multiple accounts", icon: Users },
  { href: "#onboarding", label: "Onboarding for your users", icon: Users },
  { href: "#inbox", label: "Inbox & conversations", icon: Inbox },
  { href: "#messages", label: "Send messages & media", icon: Send },
  { href: "#comments", label: "Posts & comments", icon: Image },
  { href: "#webhooks", label: "Incoming messages", icon: MessagesSquare },
  { href: "#build", label: "Build your inbox", icon: MessageCircle },
  { href: "#errors", label: "Troubleshooting", icon: AlertTriangle },
];

export default function SocialInboxDocs({ platform }: { platform: Platform }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState<string | null>(null);
  const ig = platform === "instagram";
  const Name = ig ? "Instagram" : "Facebook";
  const acct = ig ? "@yourbrand" : "123456789012345";
  const req = (body: Record<string, unknown>) =>
    `curl -X POST ${API_URL} \\\n  -H "x-api-key: wfh_YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify({ platform, ...body })}'`;
  const s = (title: string, description: string, code: string) => ({ title, description, code });

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
  const Block = ({ sample }: { sample: ReturnType<typeof s> }) => <SampleBlock sample={sample} copied={copied} onCopy={copy} />;
  const list = (items: React.ReactNode[]) => (
    <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
  );

  const nodeInbox = `// server.js — your own ${Name} inbox backend (Express)
import express from "express";
const app = express();
app.use(express.json());

const API = "${API_URL}";
async function workly(body) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "x-api-key": process.env.WORKLY_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ platform: "${platform}", ...body }),
  });
  const data = await res.json();
  if (!data.success) throw Object.assign(new Error(data.error), { status: res.status });
  return data;
}

// 1. Left side: list of chats
app.get("/api/inbox", async (req, res) => {
  res.json(await workly({ action: "list_conversations", limit: 25, after: req.query.after }));
});

// 2. Open a chat: messages
app.get("/api/inbox/:id", async (req, res) => {
  res.json(await workly({ action: "get_messages", conversation_id: req.params.id, limit: 50 }));
});

// 3. Reply box
app.post("/api/inbox/send", async (req, res) => {
  const { to, text, reply_to } = req.body;
  await workly({ action: "mark_read", to });
  res.json(await workly({ action: "send_text", to, text, reply_to }));
});

app.listen(3000);`;

  const reactUi = `// InboxPage.jsx — calls YOUR server only (never the API key in the browser)
import { useEffect, useState } from "react";

export default function InboxPage() {
  const [chats, setChats] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  useEffect(() => { fetch("/api/inbox").then(r => r.json()).then(d => setChats(d.conversations)); }, []);
  const open = async (c) => {
    setActive(c);
    const d = await fetch("/api/inbox/" + c.conversation_id).then(r => r.json());
    setMessages(d.messages.reverse());
  };
  const send = async () => {
    await fetch("/api/inbox/send", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: active.customer.id, text }) });
    setMessages(m => [...m, { message_id: Date.now(), text, direction: "outgoing" }]);
    setText("");
  };

  return (
    <div style={{ display: "flex" }}>
      <aside>{chats.map(c => <button key={c.conversation_id} onClick={() => open(c)}>
        {c.customer?.name} — {c.last_message?.text}</button>)}</aside>
      <main>
        {messages.map(m => <p key={m.message_id} align={m.direction === "outgoing" ? "right" : "left"}>{m.text}</p>)}
        {active && <><input value={text} onChange={e => setText(e.target.value)} /><button onClick={send}>Send</button></>}
      </main>
    </div>
  );
}`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-3 backdrop-blur sm:px-4">
        <Button variant="ghost" size="icon" onClick={() => goBack(navigate, "/developers")} aria-label="Back to Developer Portal">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">{Name} Docs</h1>
        <CopyPageButton title={`${Name} Docs`} />
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-semibold">{Name} inbox API guide</h2>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Build your own {Name} inbox on your website: list chats, read messages, reply with text or media, answer comments and receive new messages in real time.
        </p>

        <nav aria-label="Documentation sections" className="mt-6 grid grid-cols-1 gap-2 border-y border-border py-4 min-[420px]:grid-cols-2 lg:grid-cols-4">
          {sectionLinks.map(({ href, label, icon: Icon }) => (
            <a key={href} href={href} className="group flex min-h-11 items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Icon className="h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 leading-5">{label}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </a>
          ))}
        </nav>

        <section id="integrations" className="scroll-mt-20 border-b border-border py-8">
          <SectionHeading icon={Link2} title="Integrations" />
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-muted-foreground">
            {ig ? <li>Use an Instagram <strong className="text-foreground">Professional</strong> (Business or Creator) account. In the Instagram app turn on <strong className="text-foreground">Settings → Messages → Allow access to messages</strong>.</li>
              : <li>Use a Facebook <strong className="text-foreground">Page</strong> where you are an admin. Personal profiles cannot use the API.</li>}
            <li>Open <strong className="text-foreground">AI Connect → {Name}</strong> in your account and connect it.</li>
            <li>Open <strong className="text-foreground">Developer Portal → Generate New Key</strong>. Store the <code>wfh_</code> key only on your server.</li>
            <li>Add your server URL under <strong className="text-foreground">Developer Portal → Webhooks</strong> and subscribe to <code>{platform}.*</code> events.</li>
            <li>Send <code>"platform":"{platform}"</code> in every request body.</li>
          </ol>
          <div className="mt-6 space-y-2 border-l-2 border-primary pl-4 text-sm leading-6 text-muted-foreground">
            <p><strong className="text-foreground">Endpoint:</strong> <code className="break-all">POST {API_URL}</code></p>
            <p><strong className="text-foreground">Header:</strong> <code>x-api-key: wfh_YOUR_API_KEY</code></p>
            <p><strong className="text-foreground">Body:</strong> <code>{`{"platform":"${platform}","action":"..."}`}</code></p>
          </div>
          <div className="mt-5 space-y-3 text-sm leading-6 text-muted-foreground">
            <p><strong className="text-foreground">Meta login and permissions:</strong> {ig ? "Direct Instagram Login supports Professional accounts without requiring a linked Facebook Page. The Facebook Login connection path instead needs a linked Page. Direct-login permissions include instagram_business_basic, instagram_business_manage_messages and instagram_business_manage_comments." : "Facebook Login needs access to the selected Page, including pages_show_list, pages_read_engagement, pages_manage_metadata, pages_messaging and pages_manage_engagement for the relevant inbox and comment operations."}</p>
            <p>When operating your own Meta app, development mode is for app roles and test accounts. Access for other businesses depends on Meta's App Review, permission access level and any required business verification. Connecting an account does not automatically approve permissions or bypass messaging policy.</p>
            <p>All account names, IDs, API keys and media links in the examples are placeholders, not connected accounts. Replace them with values returned by your own API responses. Never send a real API key or access token to an AI assistant.</p>
          </div>
          {list([
            <><strong className="text-foreground">Your website's server</strong> (Node, PHP, Python…) calls the API. Your web page talks only to your server.</>,
            <><strong className="text-foreground">CRM, Zapier, Make, n8n:</strong> use an HTTP request step with the same URL, header and JSON.</>,
            <><strong className="text-foreground">Never</strong> put the API key in browser JavaScript or a mobile app.</>,
          ])}
          <Block sample={s("Check connection and usage", "Run these first.", `${req({ action: "status" })}\n\n${req({ action: "usage" })}`)} />
        </section>

        <section id="accounts" className="scroll-mt-20 border-b border-border py-8">
          <SectionHeading icon={Users} title={`Multiple ${Name} accounts`} />
          {list([
            <>Connect more from <strong className="text-foreground">AI Connect → {Name} → Add account</strong>. Your developer API key accesses accounts connected to the same Workly user only; each Meta account has its own connection and access token. It cannot access another user's accounts.</>,
            <>Call <code>list_accounts</code> to get each account. Add <code>"account"</code> to any request with the <code>account_id</code>, {ig ? <>the <code>ig_user_id</code> or the <code>@username</code></> : <>the <code>page_id</code></>}.</>,
            <>If only one is connected it is used automatically; with several, the request returns 400 until you pass <code>"account"</code>. An unknown account returns <code>404</code>.</>,
          ])}
          <Block sample={s("List connected accounts", "Use account_id, page_id, ig_user_id or username as account in any request.", `${req({ action: "list_accounts" })}\n\n# Response\n{"success":true,"platform":"${platform}","accounts":[\n  {"account_id":"6f1c…","page_id":"${ig ? "1789…" : "123456789012345"}","ig_user_id":${ig ? '"1784…"' : "null"},"name":"Your Brand","username":${ig ? '"yourbrand"' : "null"}}\n]}`)} />
          <Block sample={s("Use a specific account", "Works with every action.", req({ action: "list_conversations", account: acct }))} />
        </section>

        <ChannelOnboardingDocs kind={platform === "instagram" ? "instagram" : "facebook"} copied={copied} onCopy={copy} />

        <section id="inbox" className="scroll-mt-20 border-b border-border py-8">
          <SectionHeading icon={Inbox} title="Inbox & conversations" />
          {list([
            <><code>list_conversations</code> returns chats newest first with the customer, unread count and last message.</>,
            <><code>get_messages</code> returns messages of one chat (newest first). <code>direction</code> is <code>incoming</code> or <code>outgoing</code>.</>,
            <>Use <code>limit</code> (1-100) and pass the returned <code>next</code> as <code>after</code> to load more.</>,
          ])}
          <Block sample={s("List conversations", "Use customer.id as \"to\" when you reply.", `${req({ action: "list_conversations", limit: 25 })}\n\n# Response\n{"success":true,"conversations":[{\n  "conversation_id":"aWdfZAG…","updated_time":"2026-10-02T12:00:00+0000","unread_count":1,\n  "customer":{"id":"${ig ? "1789000111" : "6543210987"}","name":"Rahul","username":${ig ? '"rahul_k"' : "null"}},\n  "last_message":{"message_id":"m_ABC","text":"Is the job remote?","created_time":"…"}\n}],"next":"QVFIU…"}`)} />
          <Block sample={s("Read messages of a chat", "Load older messages with after.", `${req({ action: "get_messages", conversation_id: "aWdfZAG...", limit: 50 })}\n\n# Response\n{"success":true,"messages":[\n  {"message_id":"m_ABC","text":"Is the job remote?","direction":"incoming","from":{"id":"1789000111","name":"Rahul"},"attachments":[],"created_time":"…"}\n],"next":null}`)} />
        </section>

        <section id="messages" className="scroll-mt-20 border-b border-border py-8">
          <SectionHeading icon={Send} title="Send messages & media" />
          {list([
            <>Standard automated replies are allowed within <strong className="text-foreground">24 hours</strong> of the customer's last message. This API does not expose a HUMAN_AGENT tag or an exemption for automated follow-ups. A permitted private reply to a comment is a separate flow; it does not grant unrestricted messaging.</>,
            <><code>to</code> is the customer id from the inbox or webhook (not a phone number or username).</>,
            <>Text up to 1000 characters. Media must be a public HTTPS link: <code>image</code>, <code>video</code>, <code>audio</code>{ig ? "" : <>, <code>file</code></>}.</>,
            <><code>reply_to</code> quotes a message. <code>mark_read</code> shows "Seen"; add <code>"typing":true</code> to show typing.</>,
          ])}
          <Block sample={s("Send a text reply", "Returns message_id.", `${req({ action: "send_text", to: "1789000111", text: "Yes, it is fully remote." })}\n\n# Response\n{"success":true,"message_id":"m_XYZ","to":"1789000111"}`)} />
          <Block sample={s("Quote a message", "reply_to = the message_id you received.", req({ action: "send_text", to: "1789000111", text: "Here are the details", reply_to: "m_ABC" }))} />
          <Block sample={s("Send an image", "Public HTTPS link.", req({ action: "send_media", to: "1789000111", media_type: "image", media_url: "https://example.com/offer.jpg" }))} />
          <Block sample={s("Mark as seen + typing", "Use before replying.", req({ action: "mark_read", to: "1789000111", typing: true }))} />
        </section>

        <section id="comments" className="scroll-mt-20 border-b border-border py-8">
          <SectionHeading icon={Image} title="Posts & comments" />
          {list([
            <><code>list_posts</code> lists your {ig ? "posts and reels" : "Page posts"}; <code>list_comments</code> lists comments with replies.</>,
            <><code>reply_comment</code> replies publicly under the comment.</>,
            <><code>private_reply</code> sends a private message to the person who commented (once per comment, within 7 days).</>,
            <>After a private reply, wait for the customer to respond before sending follow-up messages; their response opens the normal 24-hour window. Instagram Live comment replies have a separate limit: reply while the broadcast is live. Meta enforces eligibility and may reject an expired or unsupported comment.</>,
          ])}
          <Block sample={s("List posts", "post_id is used for comments.", req({ action: "list_posts", limit: 10 }))} />
          <Block sample={s("List comments of a post", "Each comment includes replies.", req({ action: "list_comments", post_id: "17890000000000000" }))} />
          <Block sample={s("Reply to a comment", "Public reply.", req({ action: "reply_comment", comment_id: "17900000000000000", text: "Thanks! Check your inbox." }))} />
          <Block sample={s("Private reply to a comment", "Opens a private chat with the commenter.", req({ action: "private_reply", comment_id: "17900000000000000", text: "Hi! Here is the link you asked for." }))} />
        </section>

        <section id="webhooks" className="scroll-mt-20 border-b border-border py-8">
          <SectionHeading icon={MessagesSquare} title="Incoming messages (webhooks)" />
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Add a webhook in Developer Portal → Webhooks and select <code>{platform}.message.received</code>, <code>{platform}.comment.received</code> or <code>{platform}.*</code>. Each POST has <code>X-Webhook-Event</code> and <code>X-Webhook-Signature</code> (HMAC-SHA256 hex of the raw body with your endpoint secret). Reply with HTTP 200 within 8 seconds.</p>
          <Block sample={s("Webhook payloads", "data.account_id tells you which account received it. Reply using data.from as \"to\".", `// New message\n{"event":"${platform}.message.received","created_at":"2026-10-02T12:00:00Z","data":{\n  "account_id":"6f1c…","page_id":"…","ig_user_id":${ig ? '"1784…"' : "null"},\n  "from":"1789000111","name":null,"text":"Hi","message_id":"m_ABC"}}\n\n// New comment\n{"event":"${platform}.comment.received","created_at":"…","data":{\n  "account_id":"6f1c…","from":"1789000111","name":"${ig ? "@rahul_k" : "Rahul"}","text":"Price?",\n  "comment_id":"17900000000000000","post_id":"17890000000000000"}}`)} />
          <Block sample={s("Verify the signature (Node.js)", "Use the raw body.", `import crypto from "crypto";\napp.post("/workly-webhook", express.raw({ type: "application/json" }), (req, res) => {\n  const expected = crypto.createHmac("sha256", process.env.WORKLY_WEBHOOK_SECRET).update(req.body).digest("hex");\n  const got = req.get("X-Webhook-Signature") || "";\n  if (got.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected))) return res.sendStatus(401);\n  res.sendStatus(200);\n  const { event, data } = JSON.parse(req.body.toString());\n  if (event === "${platform}.message.received") {\n    // save data to your database and push it to your open inbox page (WebSocket / SSE)\n  }\n});`)} />
        </section>

        <section id="build" className="scroll-mt-20 border-b border-border py-8">
          <SectionHeading icon={MessageCircle} title={`Build your own ${Name} inbox`} />
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
            <li>Your server exposes 3 routes: chat list, messages, send.</li>
            <li>Your page shows chats on the left and messages on the right, calling only your server.</li>
            <li>The webhook saves new messages and refreshes the open chat in real time.</li>
          </ol>
          <Block sample={s("Server (Node.js / Express)", "Keeps the API key private.", nodeInbox)} />
          <Block sample={s("Inbox page (React)", "Simple chat list + chat window.", reactUi)} />
          <Block sample={s("PHP", "Same call with cURL.", `<?php\n$ch = curl_init("${API_URL}");\ncurl_setopt_array($ch, [\n  CURLOPT_POST => true,\n  CURLOPT_RETURNTRANSFER => true,\n  CURLOPT_HTTPHEADER => ["x-api-key: " . getenv("WORKLY_API_KEY"), "Content-Type: application/json"],\n  CURLOPT_POSTFIELDS => json_encode(["platform" => "${platform}", "action" => "send_text", "to" => "1789000111", "text" => "Hello"]),\n]);\necho curl_exec($ch);`)} />
          <Block sample={s("Python", "requests library.", `import os, requests\nAPI = "${API_URL}"\nH = {"x-api-key": os.environ["WORKLY_API_KEY"]}\n\ndef workly(body):\n    d = requests.post(API, json={"platform": "${platform}", **body}, headers=H, timeout=30).json()\n    if not d.get("success"): raise RuntimeError(d.get("error"))\n    return d\n\nfor c in workly({"action": "list_conversations"})["conversations"]:\n    print(c["customer"], c["last_message"])`)} />
        </section>

        <section id="errors" className="scroll-mt-20 py-8">
          <SectionHeading icon={AlertTriangle} title="Troubleshooting" />
          <ErrorCodeReference errors={socialErrors(Name)} intro={<>Failure responses look like <code>{'{"success":false,"error":"...","meta_code":100}'}</code>.</>} />
        </section>
      </main>
    </div>
  );
}
