import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader2, Play, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useDomainApi } from "@/hooks/useGoDaddy";
import { CANONICAL_DOMAIN } from '@/config/domainConfig';

type FieldKind = "text" | "textarea" | "list" | "bool" | "json";

interface Field {
  name: string;
  label: string;
  kind?: FieldKind;
  placeholder?: string;
}

interface Op {
  action: string;
  title: string;
  description: string;
  fields?: Field[];
  destructive?: boolean;
}

interface Group {
  id: string;
  title: string;
  ops: Op[];
}

const GROUPS: Group[] = [
  {
    id: "catalog",
    title: "Catalogue & legal",
    ops: [
      {
        action: "raw_currency_probe",
        title: "Currency probe (diagnostic)",
        description:
          "Shows the raw GoDaddy availability answer for one domain under different market/currency combinations, so you can confirm whether the account really replies in INR or only in USD.",
        fields: [{ name: "domain", label: "Domain", placeholder: CANONICAL_DOMAIN }],
      },
      { action: "tlds_list", title: "All supported TLDs", description: "Every extension GoDaddy can register for you." },

      {
        action: "legal_agreements",
        title: "Registry agreements",
        description: "Legal agreements a buyer must accept for a TLD.",
        fields: [
          { name: "tlds", label: "TLDs (comma separated)", kind: "list", placeholder: "com, in, co.in" },
          { name: "privacy", label: "Include privacy agreement", kind: "bool" },
        ],
      },
      {
        action: "countries_list",
        title: "Countries & regions",
        description: "Country list used for registrant contact forms.",
        fields: [{ name: "marketId", label: "Market", placeholder: "en-IN" }],
      },
      {
        action: "country_get",
        title: "Single country",
        description: "States or regions for one country code.",
        fields: [{ name: "countryKey", label: "Country code", placeholder: "IN" }],
      },
    ],
  },
  {
    id: "orders",
    title: "Orders & subscriptions",
    ops: [
      {
        action: "orders_list",
        title: "List orders",
        description: "Purchase history on the GoDaddy account.",
        fields: [
          { name: "domain", label: "Filter by domain (optional)", placeholder: "example.com" },
          { name: "limit", label: "Limit", placeholder: "50" },
        ],
      },
      {
        action: "order_get",
        title: "Order details",
        description: "Full line items and pricing for one order.",
        fields: [{ name: "orderId", label: "Order ID" }],
      },
      { action: "subscriptions_list", title: "List subscriptions", description: "Renewals, billing period and status." },
      { action: "subscriptions_product_groups", title: "Product groups", description: "Groups you can filter subscriptions by." },
      {
        action: "subscription_get",
        title: "Subscription details",
        description: "One subscription with billing details.",
        fields: [{ name: "subscriptionId", label: "Subscription ID" }],
      },
      {
        action: "subscription_update",
        title: "Toggle auto-renew",
        description: "Turn auto-renew on or off for a subscription.",
        fields: [
          { name: "subscriptionId", label: "Subscription ID" },
          { name: "renewAuto", label: "Auto-renew on", kind: "bool" },
        ],
      },
      {
        action: "subscription_cancel",
        title: "Cancel subscription",
        description: "Stops future renewals. Cannot be undone.",
        destructive: true,
        fields: [{ name: "subscriptionId", label: "Subscription ID" }],
      },
    ],
  },
  {
    id: "domainsv2",
    title: "Domains (v2 registry)",
    ops: [
      {
        action: "domain_details_v2",
        title: "Registry details",
        description: "Richer registry view than the classic domain record.",
        fields: [{ name: "domain", label: "Domain", placeholder: "example.com" }],
      },
      {
        action: "domain_actions_v2",
        title: "Pending registry actions",
        description: "Registrations, transfers and renewals still in flight.",
        fields: [{ name: "domain", label: "Domain" }],
      },
      {
        action: "domain_renew_v2",
        title: "Renew via registry",
        description: "Extend registration by a number of years.",
        fields: [
          { name: "domain", label: "Domain" },
          { name: "period", label: "Years", placeholder: "1" },
        ],
      },
      {
        action: "domain_redeem",
        title: "Redeem expired domain",
        description: "Restore a domain from the redemption grace period (extra fee).",
        destructive: true,
        fields: [{ name: "domain", label: "Domain" }],
      },
    ],
  },
  {
    id: "notify",
    title: "Notifications & maintenance",
    ops: [
      {
        action: "notifications_optin",
        title: "Opt in to notifications",
        description: "Subscribe to registry event notifications.",
        fields: [{ name: "types", label: "Types (comma separated)", kind: "list", placeholder: "domain-expiration" }],
      },
      { action: "notification_next", title: "Next notification", description: "Fetch the next unread registry notification." },
      {
        action: "notification_schema",
        title: "Notification schema",
        description: "Payload shape for one notification type.",
        fields: [{ name: "type", label: "Notification type" }],
      },
      {
        action: "notification_acknowledge",
        title: "Acknowledge notification",
        description: "Mark a notification as handled.",
        fields: [{ name: "notificationId", label: "Notification ID" }],
      },
      { action: "maintenances_list", title: "Registry maintenance windows", description: "Upcoming registry downtime." },
      {
        action: "maintenance_get",
        title: "Maintenance details",
        description: "One maintenance window in detail.",
        fields: [{ name: "maintenanceId", label: "Maintenance ID" }],
      },
    ],
  },
  {
    id: "shoppers",
    title: "Shopper sub-accounts",
    ops: [
      {
        action: "shopper_create_subaccount",
        title: "Create sub-account",
        description: "Register a customer as a GoDaddy shopper sub-account.",
        fields: [
          { name: "email", label: "Email" },
          { name: "nameFirst", label: "First name" },
          { name: "nameLast", label: "Last name" },
        ],
      },
      { action: "shopper_get", title: "Shopper details", description: "Read one shopper.", fields: [{ name: "shopperId", label: "Shopper ID" }] },
      { action: "shopper_status", title: "Shopper status", description: "Account status flags.", fields: [{ name: "shopperId", label: "Shopper ID" }] },
      {
        action: "shopper_update",
        title: "Update shopper",
        description: "Change name or email on a sub-account.",
        fields: [
          { name: "shopperId", label: "Shopper ID" },
          { name: "email", label: "Email" },
          { name: "nameFirst", label: "First name" },
          { name: "nameLast", label: "Last name" },
        ],
      },
      {
        action: "shopper_delete",
        title: "Delete sub-account",
        description: "Permanently removes the sub-account.",
        destructive: true,
        fields: [{ name: "shopperId", label: "Shopper ID" }],
      },
    ],
  },
  {
    id: "aftermarket",
    title: "Aftermarket & abuse",
    ops: [
      {
        action: "aftermarket_delete_listings",
        title: "Remove aftermarket listings",
        description: "Delist domains from the GoDaddy aftermarket.",
        destructive: true,
        fields: [{ name: "domains", label: "Domains (comma separated)", kind: "list" }],
      },
      {
        action: "abuse_list_tickets",
        title: "List abuse tickets",
        description: "Abuse reports filed from this account.",
        fields: [{ name: "type", label: "Type (optional)", placeholder: "PHISHING" }],
      },
      {
        action: "abuse_create_ticket",
        title: "Report abuse",
        description: "File a phishing, malware or spam report.",
        fields: [
          { name: "type", label: "Type", placeholder: "PHISHING" },
          { name: "source", label: "Source URL / domain / IP" },
          { name: "info", label: "Details (optional)" },
        ],
      },
      {
        action: "abuse_get_ticket",
        title: "Abuse ticket details",
        description: "Status of one abuse report.",
        fields: [{ name: "ticketId", label: "Ticket ID" }],
      },
      {
        action: "aftermarket_add_expiry_listings",
        title: "Add expiry listings",
        description: "List expiring domains on the aftermarket (JSON array of listings).",
        fields: [
          {
            name: "listings",
            label: "Listings (JSON array)",
            kind: "json",
            placeholder: '[{ "domain": "example.com", "expiresAt": "2026-12-01T00:00:00Z", "losingRegistrarId": 1 }]',
          },
        ],
      },
    ],
  },
  {
    id: "certificates",
    title: "SSL certificates",
    ops: [
      {
        action: "certificates_customer_list",
        title: "List certificates",
        description: "All SSL certificates on the customer account.",
        fields: [
          { name: "customerId", label: "Customer ID (optional)" },
          { name: "limit", label: "Limit", placeholder: "50" },
          { name: "offset", label: "Offset", placeholder: "0" },
        ],
      },
      {
        action: "certificates_acme_binding",
        title: "ACME account binding",
        description: "External account binding used for ACME issuance.",
        fields: [{ name: "customerId", label: "Customer ID (optional)" }],
      },
      {
        action: "certificate_callback_get",
        title: "Get callback URL",
        description: "Webhook URL GoDaddy notifies on certificate events.",
        fields: [{ name: "certificateId", label: "Certificate ID" }],
      },
      {
        action: "certificate_callback_set",
        title: "Set callback URL",
        description: "Must be an https:// endpoint.",
        fields: [
          { name: "certificateId", label: "Certificate ID" },
          { name: "callbackUrl", label: "Callback URL", placeholder: "https://example.com/hooks/ssl" },
        ],
      },
      {
        action: "certificate_callback_delete",
        title: "Remove callback URL",
        description: "Stops certificate event webhooks.",
        destructive: true,
        fields: [{ name: "certificateId", label: "Certificate ID" }],
      },
      {
        action: "certificate_site_seal",
        title: "Site seal",
        description: "Trust seal markup for your website.",
        fields: [
          { name: "certificateId", label: "Certificate ID" },
          { name: "theme", label: "Theme (optional)", placeholder: "LIGHT" },
          { name: "locale", label: "Locale (optional)", placeholder: "en-IN" },
        ],
      },
      {
        action: "certificate_email_history",
        title: "Certificate email history",
        description: "Emails GoDaddy sent about this certificate.",
        fields: [
          { name: "certificateId", label: "Certificate ID" },
          { name: "limit", label: "Limit", placeholder: "100" },
          { name: "offset", label: "Offset", placeholder: "0" },
        ],
      },
      {
        action: "certificate_email_resend",
        title: "Resend certificate email",
        description: "Leave the email ID blank to resend the latest one.",
        fields: [
          { name: "certificateId", label: "Certificate ID" },
          { name: "emailId", label: "Email ID (optional)" },
        ],
      },
      {
        action: "certificate_domain_verifications",
        title: "Domain verifications",
        description: "Verification status for the certificate's domains.",
        fields: [
          { name: "certificateId", label: "Certificate ID" },
          { name: "verifyDomain", label: "Domain (optional)", placeholder: "example.com" },
        ],
      },
      {
        action: "certificate_domain_verification_resend",
        title: "Resend verification email",
        description: "Re-sends the domain control validation email.",
        fields: [
          { name: "certificateId", label: "Certificate ID" },
          { name: "verifyDomain", label: "Domain", placeholder: "example.com" },
        ],
      },
      {
        action: "certificate_alternate_domain_add",
        title: "Add SAN domain",
        description: "Add an alternate (SAN) domain to a multi-domain certificate.",
        fields: [
          { name: "certificateId", label: "Certificate ID" },
          { name: "verifyDomain", label: "Domain to add", placeholder: "shop.example.com" },
        ],
      },
      {
        action: "certificate_alternate_domain_delete",
        title: "Remove SAN domain",
        description: "Removes an alternate domain from the certificate.",
        destructive: true,
        fields: [
          { name: "certificateId", label: "Certificate ID" },
          { name: "verifyDomain", label: "Domain to remove" },
        ],
      },
      {
        action: "certificate_list",
        title: "Certificates by customer",
        description: "Paged list of certificates on a GoDaddy customer account (v2).",
        fields: [
          { name: "customerId", label: "Customer ID" },
          { name: "limit", label: "Limit", placeholder: "50" },
          { name: "offset", label: "Offset", placeholder: "0" },
        ],
      },
      {
        action: "certificate_actions",
        title: "Certificate actions",
        description: "Issuance, re-issue and revoke history for one certificate.",
        fields: [{ name: "certificateId", label: "Certificate ID" }],
      },
      {
        action: "certificate_download",
        title: "Download certificate",
        description: "Returns the issued certificate chain, once the order is complete.",
        fields: [{ name: "certificateId", label: "Certificate ID" }],
      },
      {
        action: "certificate_validate",
        title: "Validate certificate order",
        description: "Dry-run an SSL order before paying for it.",
        fields: [
          { name: "productType", label: "Product type", placeholder: "DV_SSL" },
          { name: "csr", label: "CSR", kind: "textarea", placeholder: "-----BEGIN CERTIFICATE REQUEST-----" },
          { name: "period", label: "Years", placeholder: "1" },
          { name: "commonName", label: "Common name", placeholder: "example.com" },
        ],
      },
    ],
  },
  {
    id: "dnsadvanced",
    title: "DNS & host records (advanced)",
    ops: [
      {
        action: "get_host",
        title: "Get glue host",
        description: "Read one registered nameserver host for a domain.",
        fields: [
          { name: "domain", label: "Domain", placeholder: "example.com" },
          { name: "name", label: "Host name", placeholder: "ns1" },
        ],
      },
      {
        action: "add_records",
        title: "Add DNS records",
        description: "Append records to the zone without touching existing ones (max 100).",
        fields: [
          { name: "domain", label: "Domain" },
          {
            name: "records",
            label: "Records (JSON array)",
            kind: "json",
            placeholder: '[{ "type": "A", "name": "@", "data": "185.158.133.1", "ttl": 3600 }]',
          },
        ],
      },
      {
        action: "replace_all_records",
        title: "Replace the whole zone",
        description: "Overwrites every DNS record on the domain. Cannot be undone.",
        destructive: true,
        fields: [
          { name: "domain", label: "Domain" },
          {
            name: "records",
            label: "Records (JSON array)",
            kind: "json",
            placeholder: '[{ "type": "A", "name": "@", "data": "185.158.133.1", "ttl": 3600 }]',
          },
        ],
      },
    ],
  },
  {
    id: "validation",
    title: "Pre-purchase checks & sync",
    ops: [
      {
        action: "purchase_schema",
        title: "Purchase schema for a TLD",
        description: "Exact fields the registry demands before a purchase.",
        fields: [{ name: "tld", label: "TLD", placeholder: "com" }],
      },
      {
        action: "purchase_agreements",
        title: "Purchase agreements",
        description: "Agreements a buyer must accept, for registration or transfer.",
        fields: [
          { name: "tlds", label: "TLDs (comma separated)", placeholder: "com,in" },
          { name: "privacy", label: "Include privacy agreement", kind: "bool" },
          { name: "forTransfer", label: "For a transfer", kind: "bool" },
        ],
      },
      {
        action: "validate_contacts",
        title: "Validate contacts",
        description: "Check a registrant contact block against registry rules.",
        fields: [
          {
            name: "contacts",
            label: "Contacts payload (JSON)",
            kind: "json",
            placeholder: '{ "contactRegistrant": { "email": "you@example.com" } }',
          },
          { name: "marketId", label: "Market", placeholder: "en-IN" },
        ],
      },
      {
        action: "check_transfer",
        title: "Transfer eligibility",
        description: "Can this domain be transferred in right now, and at what price.",
        fields: [{ name: "domain", label: "Domain", placeholder: "example.com" }],
      },
      {
        action: "sync_domain",
        title: "Sync domain from GoDaddy",
        description: "Re-reads the live registrar record for a domain.",
        fields: [{ name: "domain", label: "Domain" }],
      },
      {
        action: "admin_retry_registration",
        title: "Retry a paid registration",
        description: "Admin only — re-runs registration for a paid order that failed.",
        destructive: true,
        fields: [{ name: "order_id", label: "Order ID" }],
      },
    ],
  },
  {
    id: "registration",
    title: "Registration & purchase (v2)",
    ops: [
      {
        action: "register_schema_v2",
        title: "Registration schema",
        description: "Fields the registry requires for a TLD.",
        fields: [
          { name: "tld", label: "TLD", placeholder: "com" },
          { name: "customerId", label: "Customer ID (optional)" },
        ],
      },
      {
        action: "register_validate_v2",
        title: "Validate registration",
        description: "Dry-run a registration payload before buying.",
        fields: [
          {
            name: "registration",
            label: "Registration payload (JSON)",
            kind: "json",
            placeholder: '{ "domain": "example.com", "period": 1, "consent": {} }',
          },
          { name: "customerId", label: "Customer ID (optional)" },
        ],
      },
      {
        action: "register_domain_v2",
        title: "Register domain",
        description: "Places a real registration order and charges the account.",
        destructive: true,
        fields: [
          {
            name: "registration",
            label: "Registration payload (JSON)",
            kind: "json",
            placeholder: '{ "domain": "example.com", "period": 1, "consent": {} }',
          },
          { name: "customerId", label: "Customer ID (optional)" },
        ],
      },
      {
        action: "purchase_validate",
        title: "Validate purchase (v1)",
        description: "Checks a v1 purchase payload without charging.",
        fields: [
          {
            name: "purchase",
            label: "Purchase payload (JSON)",
            kind: "json",
            placeholder: '{ "domain": "example.com", "period": 1 }',
          },
          { name: "shopperId", label: "Shopper ID (optional)" },
        ],
      },
    ],
  },
  {
    id: "transfers",
    title: "Transfers in & out",
    ops: [
      {
        action: "transfer_in_v2",
        title: "Start transfer in",
        description: "Begin moving a domain to this GoDaddy account.",
        fields: [
          { name: "domain", label: "Domain", placeholder: "example.com" },
          {
            name: "transfer",
            label: "Transfer payload (JSON)",
            kind: "json",
            placeholder: '{ "authCode": "ABC123", "period": 1, "consent": {} }',
          },
          { name: "customerId", label: "Customer ID (optional)" },
        ],
      },
      {
        action: "transfer_in_accept",
        title: "Accept transfer in",
        description: "Approve an inbound transfer with its auth code.",
        fields: [
          { name: "domain", label: "Domain" },
          { name: "authCode", label: "Authorization code" },
        ],
      },
      {
        action: "transfer_in_retry",
        title: "Retry transfer in",
        description: "Retry a failed inbound transfer.",
        fields: [{ name: "domain", label: "Domain" }],
      },
      {
        action: "transfer_in_restart",
        title: "Restart transfer in",
        description: "Start the inbound transfer over.",
        fields: [{ name: "domain", label: "Domain" }],
      },
      {
        action: "transfer_in_cancel",
        title: "Cancel transfer in",
        description: "Abandons the inbound transfer.",
        destructive: true,
        fields: [{ name: "domain", label: "Domain" }],
      },
      {
        action: "transfer_out_v2",
        title: "Request transfer out",
        description: "Flags the domain to leave this account.",
        destructive: true,
        fields: [{ name: "domain", label: "Domain" }],
      },
      {
        action: "transfer_out_accept",
        title: "Accept transfer out",
        description: "Approve the outbound transfer immediately.",
        destructive: true,
        fields: [{ name: "domain", label: "Domain" }],
      },
      {
        action: "transfer_out_reject",
        title: "Reject transfer out",
        description: "Deny the outbound transfer request.",
        fields: [
          { name: "domain", label: "Domain" },
          { name: "reason", label: "Reason (optional)" },
        ],
      },
    ],
  },
  {
    id: "ownership",
    title: "Nameservers, contacts, privacy & removal",
    ops: [
      {
        action: "nameservers_replace_v2",
        title: "Replace nameservers (v2)",
        description: "Point the domain at a different DNS provider. Needs at least two hostnames.",
        fields: [
          { name: "domain", label: "Domain" },
          {
            name: "nameservers",
            label: "Nameservers (comma separated)",
            kind: "list",
            placeholder: "ns1.example.com, ns2.example.com",
          },
          { name: "customerId", label: "Customer ID (optional)" },
        ],
      },
      {
        action: "contacts_update_v2",
        title: "Update registrant contacts",
        description: "Patch registrant, admin, tech or billing contacts.",
        fields: [
          { name: "domain", label: "Domain" },
          {
            name: "contacts",
            label: "Contacts payload (JSON)",
            kind: "json",
            placeholder: '{ "contactRegistrant": { "email": "you@example.com" } }',
          },
          { name: "customerId", label: "Customer ID (optional)" },
        ],
      },
      {
        action: "privacy_forwarding_v2",
        title: "Privacy email forwarding",
        description: "Forward or block email sent to the privacy address.",
        fields: [
          { name: "domain", label: "Domain" },
          { name: "emailForwarding", label: "Forward email", kind: "bool" },
          { name: "customerId", label: "Customer ID (optional)" },
        ],
      },
      {
        action: "domain_delete_v2",
        title: "Delete domain",
        description: "Removes the domain from the account. Cannot be undone.",
        destructive: true,
        fields: [
          { name: "domain", label: "Domain" },
          { name: "customerId", label: "Customer ID (optional)" },
        ],
      },
    ],
  },
];

const OpCard = ({ op }: { op: Op }) => {
  const { run } = useDomainApi();
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<unknown>(null);

  const setValue = (name: string, value: string | boolean) =>
    setValues((v) => ({ ...v, [name]: value }));

  const execute = async () => {
    const payload: Record<string, unknown> = {};
    for (const field of op.fields ?? []) {
      const raw = values[field.name];
      if (field.kind === "bool") {
        payload[field.name] = raw === true;
        continue;
      }
      const text = String(raw ?? "").trim();
      if (!text) continue;
      if (field.kind === "json") {
        try {
          payload[field.name] = JSON.parse(text);
        } catch {
          toast.error(`${field.label} must be valid JSON.`);
          return;
        }
        continue;
      }
      payload[field.name] = field.kind === "list"
        ? text.split(",").map((s) => s.trim()).filter(Boolean)
        : text;
    }
    if (op.destructive) payload.confirm = true;

    setBusy(true);
    setResult(null);
    try {
      const data = await run(op.action, payload);
      setResult(data);
      toast.success(`${op.title} completed`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "That request could not be completed.";
      setResult({ error: message });
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {op.title}
          {op.destructive && (
            <Badge variant="destructive" className="gap-1 text-[10px]">
              <ShieldAlert className="h-3 w-3" /> Careful
            </Badge>
          )}
        </CardTitle>
        <CardDescription>{op.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {(op.fields ?? []).map((field) => (
          <div key={field.name} className="space-y-1.5">
            <Label htmlFor={`${op.action}-${field.name}`} className="text-xs">
              {field.label}
            </Label>
            {field.kind === "bool" ? (
              <div className="flex items-center gap-2">
                <input
                  id={`${op.action}-${field.name}`}
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={values[field.name] === true}
                  onChange={(e) => setValue(field.name, e.target.checked)}
                />
                <span className="text-xs text-muted-foreground">Enabled</span>
              </div>
            ) : field.kind === "json" || field.kind === "textarea" ? (
              <Textarea
                id={`${op.action}-${field.name}`}
                rows={4}
                className="font-mono text-xs"
                value={String(values[field.name] ?? "")}
                placeholder={field.placeholder}
                onChange={(e) => setValue(field.name, e.target.value)}
              />
            ) : (
              <Input
                id={`${op.action}-${field.name}`}
                value={String(values[field.name] ?? "")}
                placeholder={field.placeholder}
                onChange={(e) => setValue(field.name, e.target.value)}
              />
            )}
          </div>
        ))}

        <Button
          size="sm"
          variant={op.destructive ? "destructive" : "default"}
          onClick={execute}
          disabled={busy}
          className="gap-2"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Run
        </Button>

        {result !== null && (
          <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </CardContent>
    </Card>
  );
};

const GoDaddyAdvanced = () => (
  <div className="space-y-4">
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Advanced GoDaddy tools</CardTitle>
        <CardDescription>
          Everything the GoDaddy API offers beyond search, DNS and checkout — orders, subscriptions,
          registry actions, notifications, shopper sub-accounts, aftermarket and abuse reporting.
          Requests run server-side, so your API credentials never reach the browser.
        </CardDescription>
      </CardHeader>
    </Card>

    <Accordion type="single" collapsible className="w-full">
      {GROUPS.map((group) => (
        <AccordionItem key={group.id} value={group.id}>
          <AccordionTrigger className="text-sm font-semibold">{group.title}</AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {group.ops.map((op) => (
                <OpCard key={op.action} op={op} />
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  </div>
);

export default GoDaddyAdvanced;
