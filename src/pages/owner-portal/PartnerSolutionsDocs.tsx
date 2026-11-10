import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ChevronRight, Code2, Handshake, KeyRound, ListChecks, Mail, ShieldCheck, Users, Workflow } from "lucide-react";
import CopyPageButton from "@/components/docs/CopyPageButton";
import { goBack } from "@/lib/goBack";
import { Button } from "@/components/ui/button";
import { SampleBlock, SectionHeading } from "./WhatsAppDocs";
import { useState } from "react";
import { toast } from "sonner";

const sectionLinks = [
  { href: "#overview", label: "What is it", icon: Handshake },
  { href: "#roles", label: "Partner roles", icon: Users },
  { href: "#requirements", label: "Requirements", icon: ListChecks },
  { href: "#join", label: "Join Workly India", icon: KeyRound },
  { href: "#review", label: "Review & approval", icon: ListChecks },
  { href: "#responsibilities", label: "Workly India’s role", icon: Users },
  { href: "#rejection", label: "Rejection reasons", icon: AlertTriangle },
  { href: "#signup", label: "Signup on your website", icon: Code2 },
  { href: "#permissions", label: "Permissions", icon: ShieldCheck },
  { href: "#lifecycle", label: "Status & deactivation", icon: Workflow },
  { href: "#errors", label: "Troubleshooting", icon: AlertTriangle },
  { href: "#sources", label: "Meta references", icon: Code2 },
  { href: "#contact", label: "Contact us", icon: Mail },
];

const signupSample = `<!-- 1. Load the Facebook JavaScript SDK -->
<script async defer crossorigin="anonymous" src="https://connect.facebook.net/en_US/sdk.js"></script>
<script>
  window.fbAsyncInit = () => FB.init({ appId: "YOUR_APP_ID", version: "YOUR_SUPPORTED_GRAPH_VERSION", xfbml: true });

  // 2. Listen for the signup result (WABA id + phone number id)
  window.addEventListener("message", (event) => {
    if (!["https://www.facebook.com", "https://web.facebook.com"].includes(event.origin)) return;
    if (typeof event.data !== "string") return;
    try {
      const data = JSON.parse(event.data);
      if (data.type === "WA_EMBEDDED_SIGNUP" && data.event === "FINISH") {
        console.log("WABA:", data.data.waba_id, "Phone:", data.data.phone_number_id);
      }
    } catch {}
  });

  // 3. Open Embedded Signup with the Workly India partner solution id
  function launchSignup() {
    FB.login((res) => {
      if (res.authResponse?.code) {
        // Send this one-time code to YOUR server and exchange it for a token there
        // Implement this authenticated endpoint with CSRF protection on your server.
        fetch("/api/whatsapp/onboard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: res.authResponse.code })
        }).then((response) => {
          if (!response.ok) throw new Error("Onboarding failed");
        }).catch(console.error);
      }
    }, {
      config_id: "YOUR_CONFIG_ID",
      response_type: "code",
      override_default_response_type: true,
      extras: { setup: { solutionID: "YOUR_ACTIVE_SOLUTION_ID" }, featureType: "", sessionInfoVersion: "3" },
    });
  }
</script>
<button onclick="launchSignup()">Connect WhatsApp</button>`;

const reviewSample = `# Run on the invited partner's server, with its authorized token.
# Replace YOUR_SUPPORTED_GRAPH_VERSION and YOUR_SOLUTION_ID.
curl -G "https://graph.facebook.com/YOUR_SUPPORTED_GRAPH_VERSION/YOUR_SOLUTION_ID" \\
  --data-urlencode 'fields=name,owner_permissions,partners{partner_permissions,partner_app}' \\
  -H "Authorization: Bearer $META_ACCESS_TOKEN"

# Only after checking the app identities and agreed permissions:
curl -X POST "https://graph.facebook.com/YOUR_SUPPORTED_GRAPH_VERSION/YOUR_SOLUTION_ID/accept" \\
  -H "Authorization: Bearer $META_ACCESS_TOKEN"

# Alternatively, decline an incorrect pending request (do not run both):
# POST /YOUR_SOLUTION_ID/reject
# Successful accept/reject response: { "success": true }`;

const PartnerSolutionsDocs = () => {
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
      toast.error("Could not copy");
    }
  };

  const B = ({ children }: { children: React.ReactNode }) => <strong className="text-foreground">{children}</strong>;
  const Steps = ({ items }: { items: React.ReactNode[] }) => (
    <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-muted-foreground">
      {items.map((it, i) => <li key={i}>{it}</li>)}
    </ol>
  );
  const List = ({ items }: { items: React.ReactNode[] }) => (
    <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
      {items.map((it, i) => <li key={i}>{it}</li>)}
    </ul>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-3 backdrop-blur sm:px-4">
        <Button variant="ghost" size="icon" onClick={() => goBack(navigate, "/developers")} aria-label="Back to Developer Portal">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Partner Solutions</h1>
        <CopyPageButton title={"Workly India Partner Solutions"} />
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Handshake className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-semibold">Become a Workly India Partner</h2>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Partner with Workly India through Meta's WhatsApp Partner Solutions (Multi-Partner Solutions) and onboard your own customers to WhatsApp messaging directly from your website.
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

        <section id="overview" className="scroll-mt-20 border-b border-border py-8">
          <SectionHeading icon={Handshake} title="What are Partner Solutions?" />
          <List items={[
            <>A <B>Multi-Partner Solution</B> lets eligible Solution Partners and Tech Providers jointly manage customer WhatsApp assets (WhatsApp Business Accounts and phone numbers). It is an asset-sharing arrangement in Meta, not an automatic partnership certification.</>,
            <><B>Jointly onboard customers:</B> both partners can host Meta's <B>Embedded Signup</B> flow on their own website, so customers connect WhatsApp without leaving your site.</>,
            <><B>Configure permissions:</B> the solution decides which partner gets which permission (for example, who can send messages) on every customer account onboarded through it.</>,
            <>Each solution has a <B>Solution ID</B>. You pass this ID to Embedded Signup so new customers are automatically shared with both partners.</>,
          ]} />
        </section>

        <section id="roles" className="scroll-mt-20 border-b border-border py-8">
          <SectionHeading icon={Users} title="Partner roles" />
          <List items={[
            <><B>Solution owner</B> — the business that creates the solution in its Meta app and sends the request.</>,
            <><B>Invited partner</B> — the business that accepts or declines the request. Either eligible partner can initiate; “solution owner” is not the same as the owner of the customer's business.</>,
            <><B>Tech Provider</B> — builds software (CRM, inbox, bots) on top of the WhatsApp Cloud API for its customers.</>,
            <><B>Solution Partner</B> — a Meta-approved partner that can also handle billing (credit line) and support for customers.</>,
            <><B>Tech Partner</B> — a Tech Provider upgraded through Meta's partner programme. These Meta programme roles are separate from who creates the solution.</>,
            <><B>Workly India status:</B> this guide does not establish that Workly India is a Meta-approved Solution Partner or holds a credit line. Confirm its eligible business, app and programme role with the team before setup.</>,
          ]} />
        </section>

        <section id="requirements" className="scroll-mt-20 border-b border-border py-8">
          <SectionHeading icon={ListChecks} title="Requirements" />
          <List items={[
            <>An eligible <B>approved Solution Partner, onboarded Tech Provider or upgraded Tech Partner</B>, following Meta's requirements for the intended usage. Supply your business verification status; the applicable verification and access requirements must be checked in Meta.</>,
            <>A <B>Meta developer app</B> with WhatsApp configured and access to the correct company business portfolio. Use the same app for the solution and its API access tokens.</>,
            <><B>Facebook Login for Business</B> configured, with valid OAuth redirect URIs and allowed domains for the JavaScript SDK.</>,
            <>Apps accessing onboarded customer data need App Review approval for <code>whatsapp_business_management</code> and <code>whatsapp_business_messaging</code>. Check the reference for the exact token and permission requirements of each API; the embedded solution-creation flow additionally uses <code>manage_app_solution</code>.</>,
            <>Configure verified webhooks for <code>account_update</code> and <code>partner_solutions</code>, and securely process customer-onboarding and solution-status events.</>,
            <>A public website with privacy policy and terms pages.</>,
          ]} />
        </section>

        <section id="join" className="scroll-mt-20 border-b border-border py-8">
          <SectionHeading icon={KeyRound} title="How to join as a Workly India partner" />
          <Steps items={[
            <>Send us your request through <B>Contact us</B> below. Include your company name, website, <B>Meta Business ID</B> and <B>Meta App ID</B>.</>,
            <>Ask Workly India to confirm eligibility and agree the solution name, creator, <B>messaging app</B>, signup host, customer support, data responsibilities, billing and any contract. Obtain the verified Workly India <B>App ID</B> directly from the team.</>,
            <>Subscribe to the solution and onboarding webhooks. In Meta: <B>App Dashboard → WhatsApp → Partner Solutions → Create a partner solution</B>, enter the agreed name and partner App ID, choose <B>Only me</B> or <B>Only my partner</B> for messaging, then send the request. Either eligible partner can create it.</>,
            <>The invited partner reviews the actual app identities and permissions and accepts in Meta. The dashboard changes from <B>Pending</B> to <B>Active</B>; the creation webhook uses <code>INITIATED</code>. A Contact Us submission alone does not activate a solution.</>,
            <>Copy the <B>Solution ID</B> and add it to Embedded Signup on your website.</>,
          ]} />
          <SampleBlock sample={{ title: "Review and accept a pending solution", description: "Server-side example for the invited partner. Check Meta’s endpoint reference and your app’s supported Graph version; never put access tokens in website code.", code: reviewSample }} copied={copied} onCopy={copy} />
        </section>

        <section id="review" className="scroll-mt-20 border-b border-border py-8">
          <SectionHeading icon={ListChecks} title="What is reviewed, and when is approval given?" />
          <p className="mt-4 text-sm leading-6 text-muted-foreground">The checklist below is suggested preparation for a Workly India review, not a published eligibility policy. Workly India's team must confirm its actual criteria, commercial terms and decision.</p>
          <List items={[
            <><B>Company identity:</B> company name, working website, business contact, Meta Business ID, App ID, ownership and current business verification / partner eligibility.</>,
            <><B>Customer use case:</B> what your product does, which businesses you onboard, how you obtain messaging consent, honour opt-outs and avoid prohibited activity or unsolicited messaging.</>,
            <><B>Technical readiness:</B> required App Review access, HTTPS signup domains, redirect configuration, secure token storage, webhook signature verification and a test onboarding demonstration.</>,
            <><B>Agreement and permissions:</B> matching app identities, one agreed messaging app, data access, support contacts, billing responsibilities and any service / privacy agreement.</>,
            <><B>Approval point:</B> if Workly India is the invited partner, it accepts only after its team is satisfied with the review and Meta request. If Workly India creates the solution, your authorised administrator must accept instead. Customer onboarding requires an <B>Active</B> solution and all applicable Meta prerequisites.</>,
            <><B>No fixed deadline:</B> no confirmed Workly India approval turnaround or guaranteed approval is available in this guide. Ask the team for an estimate after submitting complete details. Workly India cannot grant Meta business verification, App Review, display-name or template approval.</>,
          ]} />
        </section>

        <section id="responsibilities" className="scroll-mt-20 border-b border-border py-8">
          <SectionHeading icon={Users} title="What role would Workly India have?" />
          <List items={[
            <><B>Partner coordination:</B> subject to agreement, review your request, confirm its app identity and solution settings, and create or accept the partnership in Meta.</>,
            <><B>If Workly India's app has MESSAGING:</B> its authorised app handles messaging; your website must use the agreed service integration. The Solution ID is not an API key and does not give your app independent send permission.</>,
            <><B>If your app has MESSAGING:</B> your authorised app handles sends and receives; Workly India only performs the management / support tasks allowed by the granted permissions and agreement.</>,
            <><B>Billing:</B> Meta's standard solution flow uses the associated Solution Partner's credit line, shared after onboarding. Only an eligible Solution Partner can provide that credit line; <code>MANAGE_BILLING</code> is needed for sharing it. Do not assume Workly India funds messaging or offers free usage. Confirm the actual billing partner, rates, invoices and payment terms first.</>,
            <><B>Your responsibilities:</B> operate your website and customer support as agreed, protect tokens and customer data, obtain consent, respect Meta policies and pay agreed charges. Customers retain control of their assets and consent.</>,
            <><B>Meta's responsibilities:</B> operate the WhatsApp platform and decide platform eligibility, App Review, templates, policy enforcement and messaging limits. Partnership acceptance does not override those decisions.</>,
          ]} />
        </section>

        <section id="rejection" className="scroll-mt-20 border-b border-border py-8">
          <SectionHeading icon={AlertTriangle} title="Why might a request be declined or delayed?" />
          <p className="mt-4 text-sm leading-6 text-muted-foreground">These are possible review concerns, not confirmed Workly India rejection rules. The team should provide the actual reason and any next steps for your request.</p>
          <List items={[
            <>Missing, inconsistent or unverifiable company details, App ID, Business ID or authority to represent the company.</>,
            <>Meta eligibility / required permissions are not ready, the app or business is restricted, or the proposed use case conflicts with WhatsApp policies.</>,
            <>Unsolicited messaging, inadequate opt-in / opt-out handling, misleading business identity or an unclear customer use case.</>,
            <>Unsafe token handling, missing webhook verification, broken onboarding, or unclear privacy and customer-data safeguards.</>,
            <>Wrong partner app, incorrect permissions or disagreement about who sends messages, handles support or pays messaging charges.</>,
            <>Commercial, service-capacity or contract terms cannot be agreed. More information may be requested rather than an immediate rejection.</>,
            <><B>After a decline:</B> the dashboard shows <B>Inactive</B>. Ask for the reason, correct the issues and coordinate a new request where appropriate. A previously accepted solution cannot simply be declined; use the deactivation process instead.</>,
          ]} />
        </section>

        <section id="signup" className="scroll-mt-20 border-b border-border py-8">
          <SectionHeading icon={Workflow} title="Use it on your website" />
          <Steps items={[
            <>Your customer clicks <B>Connect WhatsApp</B> on your website.</>,
            <>Meta's Embedded Signup popup opens. The customer logs in with Facebook, picks or creates a business and verifies a phone number.</>,
            <>Because the <B>solutionID</B> is passed, the new WhatsApp account is shared with <B>both you and Workly India</B> with the agreed permissions.</>,
            <>The responsible partner's server exchanges the one-time <code>code</code> for a business token and verifies the customer / WABA association. Process <code>account_update</code>, subscribe the authorised app to WABA webhooks, complete phone registration and have the Solution Partner share billing access as required.</>,
            <>Test an inbound message, an allowed outbound message, delivery events and customer separation. Messaging goes through the <B>one app with MESSAGING permission</B>; both apps do not automatically receive independent messaging rights.</>,
          ]} />
          <SampleBlock sample={{ title: "Embedded Signup with a Solution ID", description: "Illustrative launch flow, not a complete integration. Replace all placeholders, use your supported Graph version and active Solution ID, and implement the authenticated onboarding endpoint. Never exchange codes or expose app secrets in the browser.", code: signupSample }} copied={copied} onCopy={copy} />
        </section>

        <section id="permissions" className="scroll-mt-20 border-b border-border py-8">
          <SectionHeading icon={ShieldCheck} title="Permissions" />
          <List items={[
            <><B>MESSAGING</B> — send and receive messages on the customer's numbers. Only one partner can hold it, and at least one must.</>,
            <>Both partners can view the customer's WhatsApp account and its phone numbers.</>,
            <>Management access depends on the assigned tasks, such as <code>MANAGE_TEMPLATES</code>, <code>MANAGE_PHONE</code>, <code>VIEW_INSIGHTS</code> and billing tasks. Review the actual solution permission lists before acceptance; access is not unrestricted.</>,
            <>Customers authorise both partners during signup and can revoke business integration / asset access in Meta. Stop using revoked access and follow the agreed data deletion process.</>,
            <>Meta's guide lists an onboarding cap for Tech Providers in a solution of <B>200 new-to-platform customers in a rolling week</B>. Check current Meta limits for your programme; this is not a messaging quota or a Workly India subscription allowance.</>,
          ]} />
        </section>

        <section id="lifecycle" className="scroll-mt-20 border-b border-border py-8">
          <SectionHeading icon={Workflow} title="Solution status, changes and deactivation" />
          <List items={[
            <><B>Draft:</B> saved but not sent. <B>Pending:</B> awaiting the invited partner's decision. Neither can onboard customers.</>,
            <><B>Active:</B> accepted and usable for signup. <B>Inactive:</B> declined. <B>Deactivated:</B> no longer usable for signup.</>,
            <><B>Pending deactivation:</B> the other partner must accept or reject the deactivation request. Meta says onboarding remains possible until deactivation is accepted; coordinate both websites to avoid new connections during shutdown.</>,
            <>The creator can edit the <B>solution name</B> for Active, Draft or Inactive solutions. Pending and Deactivated solutions cannot be edited. Messaging permissions are not a name edit; coordinate a new solution if the agreed access must change. The owner requests deactivation of an Active solution and the invited partner accepts or rejects it.</>,
            <>Listen for <code>partner_solutions</code> status events and <code>account_update</code> customer onboarding events. Keep your customer-to-WABA mapping and correct Solution ID per partner; never onboard a customer to the wrong solution.</>,
            <>Onboarding events include <code>PARTNER_ADDED</code>, the WABA ID, customer business ID and solution ID. If webhooks are missed, Meta's client WhatsApp Business Accounts API can be used as a paginated reconciliation fallback. Meta also provides solution, partner and customer business-token lookup endpoints; use only server-side, authorised access.</>,
            <>Deactivation stops new signup; do not assume it automatically deletes existing customers, tokens or unpaid charges. Agree customer migration, revoked access, data retention and billing closeout separately using Meta's supported procedures.</>,
          ]} />
        </section>

        <section id="errors" className="scroll-mt-20 border-b border-border py-8">
          <SectionHeading icon={AlertTriangle} title="Troubleshooting" />
          <List items={[
            <><B>Pending / INITIATED</B> — the invited partner has not accepted. Confirm the recipient App ID, request details and dashboard notifications; contact the team with the Solution ID.</>,
            <><B>Signup popup closes with no code</B> — check your config ID, allowed domains and that your website uses HTTPS.</>,
            <><B>Permission error on Graph API</B> — your app is missing App Review approval or the system user lacks access to the app.</>,
            <><B>Customer not shared with Workly India</B> — the <code>solutionID</code> was missing from <code>extras.setup</code>.</>,
            <><B>Signup refuses the solution</B> — confirm it is Active, the ID belongs to the intended partnership and onboarding eligibility / limits are satisfied.</>,
            <><B>Messages or billing fail after signup</B> — check the messaging app assignment, business token / asset access, phone registration, webhook subscriptions, credit-line sharing and Meta's returned error. Do not send credentials to support.</>,
          ]} />
        </section>

        <section id="sources" className="scroll-mt-20 border-b border-border py-8">
          <SectionHeading icon={Code2} title="Meta documentation and scope" />
          <p className="mt-4 text-sm leading-6 text-muted-foreground">This is a Workly India implementation guide, not a complete copy of Meta's documentation or a claim of Meta endorsement. Setup, acceptance, permissions, signup, billing, onboarding limits and lifecycle were checked against Meta's official Multi-Partner Solutions guide. Meta's current endpoint references and your app's supported Graph version take precedence. Workly India's review checklist and possible rejection reasons are preparation guidance, not confirmed company policies.</p>
          <ul className="mt-4 space-y-3 text-sm">
            {[
              ["Meta: become a WhatsApp partner", "https://whatsappbusiness.com/partners/become-a-partner/"],
              ["Meta: Multi-Partner Solutions", "https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/multi-partner-solutions"],
              ["Meta: Embedded Signup overview", "https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview"],
              ["Meta: embedded solution creation", "https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/multi-partner-solution-embedded-creation"],
              ["Meta: share and revoke credit lines", "https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/share-and-revoke-credit-lines"],
              ["Meta: client WhatsApp Business Accounts API", "https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/business/client_whatsapp_business_accounts"],
            ].map(([label, href]) => <li key={href}><a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">{label}</a></li>)}
          </ul>
        </section>

        <section id="contact" className="scroll-mt-20 py-8">
          <SectionHeading icon={Mail} title="Contact us to join" />
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Send your company name, website, business contact, Meta Business ID, App ID, verification / App Review status, customer use case and preferred messaging / billing arrangement. Ask the team to confirm Workly India's Meta role, review criteria, required documents and estimated decision time. Never send passwords, access tokens or app secrets.
          </p>
          <Button className="mt-4 w-full" onClick={() => navigate("/contact-us?subject=" + encodeURIComponent("Partner Solutions request"))}>
            <Mail className="mr-2 h-4 w-4" /> Contact us
          </Button>
        </section>
      </main>
    </div>
  );
};

export default PartnerSolutionsDocs;
