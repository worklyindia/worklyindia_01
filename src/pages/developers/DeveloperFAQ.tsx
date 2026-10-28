import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { goBack } from "@/lib/goBack";

type QA = { q: string; a: string };
const FAQ: { group: string; items: QA[] }[] = [
  { group: "Getting started", items: [
    { q: "What is the Workly India Developer Portal?", a: "It lets you use Workly India services — WhatsApp, Instagram, Facebook Messenger, Email, Jobs and Sign in with Workly — from your own website or app through one API key." },
    { q: "How do I get started?", a: "Complete Developer Onboarding, activate an API subscription, create your API key in the Developer Portal, then follow the docs for the service you want." },
    { q: "Where do I find my API key?", a: "Open the Developer Portal home. Your key starts with wfh_. Only one key can exist at a time; delete the old key before creating a new one." },
    { q: "How do I send the API key?", a: "Send it in the x-api-key header from your server. Never put the key in browser or mobile app code, because anyone could copy it." },
    { q: "Is there a test or sandbox mode?", a: "There is no separate sandbox. Use your own number, account or mailbox for testing; test calls count like normal calls." },
  ]},
  { group: "Subscription, calls and payments", items: [
    { q: "What happens when my subscription is inactive?", a: "Every API request returns 402 \"API subscription is not active\". Renew from Developer Portal → Subscription." },
    { q: "How are API calls counted?", a: "Every request that reaches a service counts as one call, including requests that fail validation. You can see each one in API Logs." },
    { q: "Do unused calls carry forward?", a: "Yes. Unused calls carry forward to the next month. Free monthly calls are added only while your subscription is active." },
    { q: "What happens when my calls run out?", a: "Requests return 429 until the monthly refresh, a top-up purchase, or Auto-Top-Up adds more calls." },
    { q: "What is Auto-Top-Up?", a: "You authorize a Razorpay payment once; when remaining calls drop low, calls are topped up automatically. You can cancel it anytime with typed confirmation." },
    { q: "How do I pay and where are my invoices?", a: "All payments go through Razorpay. Open Payment History to see each payment and download its Razorpay invoice." },
  ]},
  { group: "WhatsApp", items: [
    { q: "How do I connect my WhatsApp number?", a: "Open the WhatsApp option in the Developer menu and connect your WhatsApp Business number through the Facebook connect flow." },
    { q: "Can I use several WhatsApp numbers?", a: "Yes. Add from (phone_number_id or the number) to any send request to choose the sender. Without it, your default number is used." },
    { q: "Why can't I send a normal text message?", a: "WhatsApp allows free-form messages only within 24 hours of the customer's last message (error 131047). Outside that window, send an approved template." },
    { q: "Why is my template not found?", a: "Use the exact template name and language from list_templates, and make sure it is APPROVED on the same number's account." },
    { q: "What are WhatsApp messaging limits?", a: "Each number has a 24-hour tier limit that rises automatically with good quality. When reached you get 429 with resets_at and retry_after_seconds. Check WhatsApp Limits in the Developer menu." },
  ]},
  { group: "Instagram, Facebook and Email", items: [
    { q: "How do I connect Instagram or a Facebook Page?", a: "Connect it on the AI Connect page. Your API key then works with accounts connected to your own Workly account." },
    { q: "I have several accounts connected. Which one is used?", a: "With one account it is used automatically. With several, pass account in each request, or you get 400 \"Several accounts are connected\"." },
    { q: "Which mailbox sends my emails?", a: "Your own connected Gmail, Outlook or Domain email. There is no shared Workly sender; without a mailbox you get 409 mailbox_not_connected." },
    { q: "How do I receive new messages and emails?", a: "Add a webhook in the Developer Portal and choose the events you want. Each webhook delivery is signed with your endpoint secret." },
  ]},
  { group: "Offering services to your own users", items: [
    { q: "Can my customers connect their own WhatsApp, Instagram, Facebook or Email?", a: "Yes. Create a sub-account per customer, get a one-time connect link, and show a Connect button on your website. Details are in each service's Onboarding section." },
    { q: "Can other developers see my sub-accounts?", a: "No. Sub-accounts are visible only to your API key. Other keys get \"Sub-account not found\"." },
    { q: "Do I see my customers' login tokens?", a: "No. Tokens stay on Workly India servers. You only use sub_account_id or external_id." },
    { q: "How long does a connect link work?", a: "It works once and expires after 1 hour, so create it when your customer clicks your button." },
  ]},
  { group: "Webhooks", items: [
    { q: "How do I verify a webhook is from Workly India?", a: "Each request is signed with your endpoint's secret. Check the signature on your server before trusting the data." },
    { q: "Why was my webhook disabled?", a: "A webhook is disabled automatically if it only fails for 24 hours. Fix your endpoint, then turn it back on in the Developer Portal." },
    { q: "Is a test request sent when I add a webhook?", a: "Yes. A signed test POST is sent before saving; your endpoint must reply with a 2xx status." },
  ]},
  { group: "Errors and support", items: [
    { q: "How do I find what an error means?", a: "Every docs page has a Troubleshooting section with a searchable list of every error code, the reason and the fix." },
    { q: "Where can I see the error of a past request?", a: "Open API Logs in the Developer menu. Every charged call is logged with its status and error message." },
    { q: "Can the Developer AI Chat help?", a: "Yes. Open AI Chat in the Developer menu; it can explain errors and, when you ask, check your own API and workbook logs." },
    { q: "My API key was leaked. What should I do?", a: "Delete the key immediately in the Developer Portal and create a new one, then update it on your server." },
  ]},
];

export default function DeveloperFAQ() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return FAQ;
    return FAQ.map((g) => ({ ...g, items: g.items.filter((i) => `${i.q} ${i.a}`.toLowerCase().includes(t)) })).filter((g) => g.items.length);
  }, [q]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-3 backdrop-blur sm:px-4">
        <Button variant="ghost" size="icon" onClick={() => goBack(navigate, "/developers")} aria-label="Back to Developer Portal">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Developer FAQ</h1>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6">
        <p className="text-sm leading-6 text-muted-foreground">Answers to common questions about the Workly India Developer Portal and APIs.</p>
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search questions" className="pl-9" aria-label="Search FAQ" />
        </div>
        {groups.length === 0 && <p className="mt-6 text-sm text-muted-foreground">No matching question. Try the Developer AI Chat.</p>}
        {groups.map((g) => (
          <section key={g.group} className="mt-8">
            <h2 className="font-semibold">{g.group}</h2>
            <Accordion type="multiple" className="mt-2">
              {g.items.map((i) => (
                <AccordionItem key={i.q} value={i.q}>
                  <AccordionTrigger className="text-left text-sm">{i.q}</AccordionTrigger>
                  <AccordionContent className="text-sm leading-6 text-muted-foreground">{i.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        ))}
      </main>
    </div>
  );
}
