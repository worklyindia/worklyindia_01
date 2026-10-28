// Remaining GoDaddy API surface (A -> Z) that is not covered by godaddyHandler.ts.
//
// Covered here: Abuse, Aftermarket, Agreements, Countries, Orders, Shoppers,
// Subscriptions, TLDs, Domains v2 (details, notifications, maintenances,
// actions, redeem, renew, transfer-in) and purchase validation.
//
// Every handler returns plain JSON; the shared client keeps the GoDaddy
// credential server-side. Unknown actions return the NOT_HANDLED symbol so the
// caller can continue its own dispatch.

import { godaddy } from "./godaddyClient.ts";

export const NOT_HANDLED = Symbol("godaddy_extras_not_handled");

type Payload = Record<string, unknown>;

class ExtrasInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtrasInputError";
  }
}

const str = (v: unknown, field: string, max = 200): string => {
  const s = String(v ?? "").trim();
  if (!s) throw new ExtrasInputError(`${field} is required.`);
  if (s.length > max) throw new ExtrasInputError(`${field} is too long.`);
  return s;
};

const optStr = (v: unknown, max = 500): string | undefined => {
  const s = String(v ?? "").trim();
  if (!s) return undefined;
  return s.slice(0, max);
};

const num = (v: unknown, def: number, min: number, max: number): number => {
  const n = Number(v ?? def);
  if (!Number.isFinite(n)) return def;
  return Math.min(Math.max(Math.trunc(n), min), max);
};

const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const domainOf = (v: unknown): string => {
  const d = String(v ?? "").trim().toLowerCase();
  if (!DOMAIN_RE.test(d)) throw new ExtrasInputError("Please enter a valid domain name, e.g. example.com");
  return d;
};

/** GoDaddy customer (shopper) id — from the request, or the account default. */
const customerOf = (p: Payload): string => {
  const fromBody = optStr(p.customerId, 60);
  const fromEnv = Deno.env.get("GODADDY_CUSTOMER_ID")?.trim();
  const id = fromBody || fromEnv;
  if (!id) {
    throw new ExtrasInputError(
      "A GoDaddy customer ID is required for this action. Add GODADDY_CUSTOMER_ID or pass customerId.",
    );
  }
  return id;
};

const shopperOf = (p: Payload): string | undefined => optStr(p.shopperId, 60);

export async function handleGodaddyExtras(
  action: string,
  p: Payload,
): Promise<unknown | typeof NOT_HANDLED> {
  switch (action) {
    // ---------------- Abuse ----------------
    case "abuse_list_tickets": {
      const tickets = await godaddy({
        path: "/v1/abuse/tickets",
        query: {
          type: optStr(p.type, 40),
          closed: p.closed === true ? true : p.closed === false ? false : undefined,
          sourceDomainOrIp: optStr(p.sourceDomainOrIp, 253),
          target: optStr(p.target, 253),
          createdStart: optStr(p.createdStart, 40),
          createdEnd: optStr(p.createdEnd, 40),
          limit: num(p.limit, 100, 1, 100),
          offset: num(p.offset, 0, 0, 100000),
          sort: optStr(p.sort, 40),
        },
      });
      return { tickets };
    }

    case "abuse_create_ticket": {
      const ticket = await godaddy({
        path: "/v1/abuse/tickets",
        method: "POST",
        body: {
          type: str(p.type, "Abuse type", 40).toUpperCase(),
          source: str(p.source, "Source (domain, URL or IP)", 253),
          intentional: p.intentional === true,
          info: optStr(p.info, 2000),
          infoUrl: optStr(p.infoUrl, 500),
        },
      });
      return { ticket };
    }

    case "abuse_get_ticket": {
      const id = str(p.ticketId, "Ticket ID", 60);
      const ticket = await godaddy({ path: `/v1/abuse/tickets/${encodeURIComponent(id)}` });
      return { ticket };
    }

    // ---------------- Aftermarket ----------------
    case "aftermarket_add_expiry_listings": {
      const listings = Array.isArray(p.listings) ? p.listings : [];
      if (!listings.length) throw new ExtrasInputError("At least one expiry listing is required.");
      if (listings.length > 100) throw new ExtrasInputError("Maximum 100 listings per request.");
      const result = await godaddy({
        path: "/v1/aftermarket/listings/expiry",
        method: "POST",
        body: listings,
      });
      return { result };
    }

    case "aftermarket_delete_listings": {
      const domains = (Array.isArray(p.domains) ? p.domains : []).map(domainOf);
      if (!domains.length) throw new ExtrasInputError("Select at least one domain to remove.");
      const result = await godaddy({
        path: "/v1/aftermarket/listings",
        method: "DELETE",
        query: { domains: domains.join(",") },
      });
      return { result, removed: domains };
    }

    // ---------------- Agreements ----------------
    case "legal_agreements": {
      const tlds = (Array.isArray(p.tlds) ? p.tlds : [p.tlds])
        .map((t) => String(t ?? "").trim().replace(/^\./, "").toLowerCase())
        .filter(Boolean);
      if (!tlds.length) throw new ExtrasInputError("At least one TLD is required, e.g. com");
      const agreements = await godaddy({
        path: "/v1/agreements",
        query: {
          tlds: tlds.join(","),
          privacy: p.privacy === true,
          forTransfer: p.forTransfer === true ? true : undefined,
        },
        shopperId: shopperOf(p),
      });
      return { agreements };
    }

    // ---------------- Countries ----------------
    case "countries_list": {
      const countries = await godaddy({
        path: "/v1/countries",
        query: {
          marketId: optStr(p.marketId, 20) ?? "en-IN",
          regionTypeId: p.regionTypeId === undefined ? undefined : num(p.regionTypeId, 0, 0, 999999),
          regionName: optStr(p.regionName, 100),
          sort: optStr(p.sort, 40),
          order: optStr(p.order, 10),
        },
      });
      return { countries };
    }

    case "country_get": {
      const key = str(p.countryKey, "Country code", 2).toUpperCase();
      const country = await godaddy({
        path: `/v1/countries/${encodeURIComponent(key)}`,
        query: { marketId: optStr(p.marketId, 20) ?? "en-IN", sort: optStr(p.sort, 40), order: optStr(p.order, 10) },
      });
      return { country };
    }

    // ---------------- TLDs ----------------
    case "tlds_list": {
      const tlds = await godaddy({ path: "/v1/domains/tlds" });
      return { tlds };
    }

    // ---------------- Orders ----------------
    case "orders_list": {
      const orders = await godaddy({
        path: "/v1/orders",
        query: {
          periodStart: optStr(p.periodStart, 40),
          periodEnd: optStr(p.periodEnd, 40),
          domain: optStr(p.domain, 253),
          productGroupId: p.productGroupId === undefined ? undefined : num(p.productGroupId, 0, 0, 999999),
          paymentProfileId: p.paymentProfileId === undefined ? undefined : num(p.paymentProfileId, 0, 0, 99999999),
          parentOrderId: optStr(p.parentOrderId, 60),
          offset: num(p.offset, 0, 0, 100000),
          limit: num(p.limit, 50, 1, 100),
          sort: optStr(p.sort, 40),
        },
        shopperId: shopperOf(p),
      });
      return { orders };
    }

    case "order_get": {
      const id = str(p.orderId, "Order ID", 60);
      const order = await godaddy({
        path: `/v1/orders/${encodeURIComponent(id)}`,
        shopperId: shopperOf(p),
      });
      return { order };
    }

    // ---------------- Shoppers (sub-accounts) ----------------
    case "shopper_create_subaccount": {
      const shopper = await godaddy({
        path: "/v1/shoppers/subaccount",
        method: "POST",
        body: {
          email: str(p.email, "Email", 120),
          nameFirst: str(p.nameFirst, "First name", 60),
          nameLast: str(p.nameLast, "Last name", 60),
          password: optStr(p.password, 100),
          externalId: p.externalId === undefined ? undefined : num(p.externalId, 0, 0, 2147483647),
          marketId: optStr(p.marketId, 20) ?? "en-IN",
        },
      });
      return { shopper };
    }

    case "shopper_get": {
      const id = str(p.shopperId, "Shopper ID", 60);
      const shopper = await godaddy({
        path: `/v1/shoppers/${encodeURIComponent(id)}`,
        query: { includes: optStr(p.includes, 100) },
      });
      return { shopper };
    }

    case "shopper_update": {
      const id = str(p.shopperId, "Shopper ID", 60);
      const body: Payload = {};
      for (const field of ["email", "nameFirst", "nameLast", "externalId", "marketId"]) {
        if (p[field] !== undefined) body[field] = p[field];
      }
      if (!Object.keys(body).length) throw new ExtrasInputError("Nothing to update.");
      await godaddy({ path: `/v1/shoppers/${encodeURIComponent(id)}`, method: "POST", body });
      return { updated: true, shopperId: id };
    }

    case "shopper_status": {
      const id = str(p.shopperId, "Shopper ID", 60);
      const status = await godaddy({ path: `/v1/shoppers/${encodeURIComponent(id)}/status` });
      return { status };
    }

    case "shopper_delete": {
      const id = str(p.shopperId, "Shopper ID", 60);
      if (p.confirm !== true) throw new ExtrasInputError("Please confirm before deleting this sub-account.");
      await godaddy({
        path: `/v1/shoppers/${encodeURIComponent(id)}`,
        method: "DELETE",
        query: { auditClientIp: optStr(p.auditClientIp, 45) ?? "127.0.0.1" },
      });
      return { deleted: true, shopperId: id };
    }

    // ---------------- Subscriptions ----------------
    case "subscriptions_list": {
      const subscriptions = await godaddy({
        path: "/v1/subscriptions",
        query: {
          productGroupKeys: optStr(p.productGroupKeys, 200),
          includes: optStr(p.includes, 100),
          offset: num(p.offset, 0, 0, 100000),
          limit: num(p.limit, 50, 1, 100),
          sort: optStr(p.sort, 40),
        },
        shopperId: shopperOf(p),
      });
      return { subscriptions };
    }

    case "subscriptions_product_groups": {
      const productGroups = await godaddy({ path: "/v1/subscriptions/productGroups", shopperId: shopperOf(p) });
      return { productGroups };
    }

    case "subscription_get": {
      const id = str(p.subscriptionId, "Subscription ID", 60);
      const subscription = await godaddy({
        path: `/v1/subscriptions/${encodeURIComponent(id)}`,
        shopperId: shopperOf(p),
      });
      return { subscription };
    }

    case "subscription_update": {
      const id = str(p.subscriptionId, "Subscription ID", 60);
      const body: Payload = {};
      if (p.renewAuto !== undefined) body.renewAuto = p.renewAuto === true;
      if (p.paymentProfileId !== undefined) body.paymentProfileId = num(p.paymentProfileId, 0, 0, 99999999);
      if (!Object.keys(body).length) throw new ExtrasInputError("Nothing to update.");
      await godaddy({
        path: `/v1/subscriptions/${encodeURIComponent(id)}`,
        method: "PATCH",
        body,
        shopperId: shopperOf(p),
      });
      return { updated: true, subscriptionId: id };
    }

    case "subscription_cancel": {
      const id = str(p.subscriptionId, "Subscription ID", 60);
      if (p.confirm !== true) throw new ExtrasInputError("Please confirm before cancelling this subscription.");
      await godaddy({
        path: `/v1/subscriptions/${encodeURIComponent(id)}`,
        method: "DELETE",
        shopperId: shopperOf(p),
      });
      return { cancelled: true, subscriptionId: id };
    }

    // ---------------- Domains v2 ----------------
    case "domain_details_v2": {
      const domain = domainOf(p.domain);
      const details = await godaddy({
        path: `/v2/customers/${encodeURIComponent(customerOf(p))}/domains/${encodeURIComponent(domain)}`,
        query: { includes: optStr(p.includes, 100) },
      });
      return { details };
    }

    case "domain_actions_v2": {
      const domain = domainOf(p.domain);
      const actions = await godaddy({
        path: `/v2/customers/${encodeURIComponent(customerOf(p))}/domains/${encodeURIComponent(domain)}/actions`,
        query: { includes: optStr(p.includes, 100) },
      });
      return { actions };
    }

    case "domain_redeem": {
      const domain = domainOf(p.domain);
      if (p.confirm !== true) throw new ExtrasInputError("Please confirm before redeeming this domain.");
      await godaddy({
        path: `/v2/customers/${encodeURIComponent(customerOf(p))}/domains/${encodeURIComponent(domain)}/redeem`,
        method: "POST",
        body: p.purchase ?? {},
      });
      return { redeemed: true, domain };
    }

    case "domain_renew_v2": {
      const domain = domainOf(p.domain);
      await godaddy({
        path: `/v2/customers/${encodeURIComponent(customerOf(p))}/domains/${encodeURIComponent(domain)}/renew`,
        method: "POST",
        body: { period: num(p.period, 1, 1, 10) },
      });
      return { renewed: true, domain };
    }

    // ---------------- Domain notifications (v2) ----------------
    case "notifications_optin": {
      const types = (Array.isArray(p.types) ? p.types : [])
        .map((t) => String(t ?? "").trim())
        .filter(Boolean);
      if (!types.length) throw new ExtrasInputError("Select at least one notification type.");
      await godaddy({
        path: `/v2/customers/${encodeURIComponent(customerOf(p))}/domains/notifications/optIn`,
        method: "POST",
        query: { types: types.join(",") },
      });
      return { optedIn: true, types };
    }

    case "notification_next": {
      const notification = await godaddy({
        path: `/v2/customers/${encodeURIComponent(customerOf(p))}/domains/notifications`,
        query: { types: optStr(p.types, 200) },
      });
      return { notification };
    }

    case "notification_schema": {
      const type = str(p.type, "Notification type", 60);
      const schema = await godaddy({
        path: `/v2/customers/${encodeURIComponent(customerOf(p))}/domains/notifications/schemas/${encodeURIComponent(type)}`,
      });
      return { schema };
    }

    case "notification_acknowledge": {
      const id = str(p.notificationId, "Notification ID", 80);
      await godaddy({
        path: `/v2/customers/${encodeURIComponent(customerOf(p))}/domains/notifications/${encodeURIComponent(id)}/acknowledge`,
        method: "POST",
      });
      return { acknowledged: true, notificationId: id };
    }

    // ---------------- Registry maintenances (v2) ----------------
    case "maintenances_list": {
      const maintenances = await godaddy({
        path: `/v2/customers/${encodeURIComponent(customerOf(p))}/domains/maintenances`,
        query: {
          start: optStr(p.start, 40),
          end: optStr(p.end, 40),
          limit: num(p.limit, 50, 1, 100),
          offset: num(p.offset, 0, 0, 100000),
          sort: optStr(p.sort, 40),
        },
      });
      return { maintenances };
    }

    case "maintenance_get": {
      const id = str(p.maintenanceId, "Maintenance ID", 80);
      const maintenance = await godaddy({
        path: `/v2/customers/${encodeURIComponent(customerOf(p))}/domains/maintenances/${encodeURIComponent(id)}`,
      });
      return { maintenance };
    }

    // ---------------- Purchase validation ----------------
    case "purchase_validate": {
      const purchase = (p.purchase ?? {}) as Payload;
      if (!purchase || typeof purchase !== "object" || !purchase.domain) {
        throw new ExtrasInputError("A purchase payload with a domain is required.");
      }
      await godaddy({
        path: "/v1/domains/purchase/validate",
        method: "POST",
        body: purchase,
        shopperId: shopperOf(p),
      });
      return { valid: true };
    }

    // ---------------- Certificates: callbacks, seal, emails, verification ----------------
    case "certificate_callback_get": {
      const id = str(p.certificateId, "Certificate ID", 80);
      const callback = await godaddy({ path: `/v1/certificates/${encodeURIComponent(id)}/callback` });
      return { callback };
    }

    case "certificate_callback_set": {
      const id = str(p.certificateId, "Certificate ID", 80);
      const callbackUrl = str(p.callbackUrl, "Callback URL", 500);
      if (!/^https:\/\//i.test(callbackUrl)) {
        throw new ExtrasInputError("The callback URL must start with https://");
      }
      await godaddy({
        path: `/v1/certificates/${encodeURIComponent(id)}/callback`,
        method: "PUT",
        query: { callbackUrl },
      });
      return { saved: true, callbackUrl };
    }

    case "certificate_callback_delete": {
      const id = str(p.certificateId, "Certificate ID", 80);
      await godaddy({
        path: `/v1/certificates/${encodeURIComponent(id)}/callback`,
        method: "DELETE",
      });
      return { deleted: true };
    }

    case "certificate_site_seal": {
      const id = str(p.certificateId, "Certificate ID", 80);
      const siteSeal = await godaddy({
        path: `/v1/certificates/${encodeURIComponent(id)}/siteSeal`,
        query: { theme: optStr(p.theme, 20), locale: optStr(p.locale, 10) },
      });
      return { siteSeal };
    }

    case "certificate_email_history": {
      const id = str(p.certificateId, "Certificate ID", 80);
      const history = await godaddy({
        path: `/v1/certificates/${encodeURIComponent(id)}/email/history`,
        query: { limit: num(p.limit, 100, 1, 500), offset: num(p.offset, 0, 0, 100000) },
      });
      return { history };
    }

    case "certificate_email_resend": {
      const id = str(p.certificateId, "Certificate ID", 80);
      const emailId = optStr(p.emailId, 60);
      const path = emailId
        ? `/v1/certificates/${encodeURIComponent(id)}/email/${encodeURIComponent(emailId)}/resend`
        : `/v1/certificates/${encodeURIComponent(id)}/email/resend`;
      await godaddy({ path, method: "POST" });
      return { resent: true };
    }

    case "certificate_domain_verifications": {
      const id = str(p.certificateId, "Certificate ID", 80);
      const domain = optStr(p.verifyDomain, 253);
      const path = domain
        ? `/v1/certificates/${encodeURIComponent(id)}/domainVerifications/${encodeURIComponent(domain)}`
        : `/v1/certificates/${encodeURIComponent(id)}/domainVerifications`;
      const verifications = await godaddy({ path });
      return { verifications };
    }

    case "certificate_domain_verification_resend": {
      const id = str(p.certificateId, "Certificate ID", 80);
      const domain = domainOf(p.verifyDomain);
      await godaddy({
        path: `/v1/certificates/${encodeURIComponent(id)}/domainVerifications/${encodeURIComponent(domain)}/email/resend`,
        method: "POST",
      });
      return { resent: true, domain };
    }

    case "certificates_customer_list": {
      const certificates = await godaddy({
        path: `/v2/customers/${encodeURIComponent(customerOf(p))}/certificates`,
        query: {
          offset: num(p.offset, 0, 0, 100000),
          limit: num(p.limit, 50, 1, 1000),
},
      });
      return { certificates };
    }

    case "certificates_acme_binding": {
      const binding = await godaddy({
        path: `/v2/customers/${encodeURIComponent(customerOf(p))}/certificates/acme/externalAccountBinding`,
      });
      return { binding };
    }

    // ---------------- Domains v2: register, transfer-in / out, contacts, privacy ----------------
    case "register_schema_v2": {
      const tld = str(p.tld, "TLD", 40).replace(/^\./, "").toLowerCase();
      const schema = await godaddy({
        path: `/v2/customers/${encodeURIComponent(customerOf(p))}/domains/register/schema/${encodeURIComponent(tld)}`,
      });
      return { schema };
    }

    case "register_validate_v2": {
      const payload = (p.registration ?? {}) as Payload;
      if (!payload || typeof payload !== "object" || !payload.domain) {
        throw new ExtrasInputError("A registration payload with a domain is required.");
      }
      await godaddy({
        path: `/v2/customers/${encodeURIComponent(customerOf(p))}/domains/register/validate`,
        method: "POST",
        body: payload,
      });
      return { valid: true };
    }

    case "register_domain_v2": {
      const payload = (p.registration ?? {}) as Payload;
      if (!payload || typeof payload !== "object" || !payload.domain) {
        throw new ExtrasInputError("A registration payload with a domain is required.");
      }
      const order = await godaddy({
        path: `/v2/customers/${encodeURIComponent(customerOf(p))}/domains/register`,
        method: "POST",
        body: payload,
      });
      return { order };
    }

    case "transfer_in_v2": {
      const payload = (p.transfer ?? {}) as Payload;
      const order = await godaddy({
        path: `/v2/customers/${encodeURIComponent(customerOf(p))}/domains/${encodeURIComponent(domainOf(p.domain))}/transferIn`,
        method: "POST",
        body: payload,
      });
      return { order };
    }

    case "transfer_in_accept":
    case "transfer_in_cancel":
    case "transfer_in_restart":
    case "transfer_in_retry": {
      const step = action.replace("transfer_in_", "");
      const body = step === "accept" ? { authCode: str(p.authCode, "Authorization code", 100) } : undefined;
      await godaddy({
        path: `/v2/customers/${encodeURIComponent(customerOf(p))}/domains/${encodeURIComponent(domainOf(p.domain))}/transferIn/${step}`,
        method: "POST",
        body,
      });
      return { ok: true, step };
    }

    case "transfer_out_v2":
    case "transfer_out_accept":
    case "transfer_out_reject": {
      const suffix = action === "transfer_out_v2" ? "" : `/${action.replace("transfer_out_", "")}`;
      await godaddy({
        path: `/v2/customers/${encodeURIComponent(customerOf(p))}/domains/${encodeURIComponent(domainOf(p.domain))}/transferOut${suffix}`,
        method: "POST",
        body: action === "transfer_out_reject" ? { reason: optStr(p.reason, 200) } : undefined,
      });
      return { ok: true };
    }

    case "contacts_update_v2": {
      const contacts = (p.contacts ?? {}) as Payload;
      if (!contacts || typeof contacts !== "object" || !Object.keys(contacts).length) {
        throw new ExtrasInputError("Contact details are required.");
      }
      await godaddy({
        path: `/v2/customers/${encodeURIComponent(customerOf(p))}/domains/${encodeURIComponent(domainOf(p.domain))}/contacts`,
        method: "PATCH",
        body: contacts,
      });
      return { updated: true };
    }

    case "privacy_forwarding_v2": {
      await godaddy({
        path: `/v2/customers/${encodeURIComponent(customerOf(p))}/domains/${encodeURIComponent(domainOf(p.domain))}/privacy/forwarding`,
        method: "PATCH",
        body: { emailForwarding: p.emailForwarding === true },
      });
      return { updated: true, emailForwarding: p.emailForwarding === true };
    }

    case "domain_delete_v2": {
      if (p.confirm !== true) throw new ExtrasInputError("Please confirm before deleting this domain.");
      await godaddy({
        path: `/v2/customers/${encodeURIComponent(customerOf(p))}/domains/${encodeURIComponent(domainOf(p.domain))}`,
        method: "DELETE",
      });
      return { deleted: true };
    }

    // ---------------- Certificates: alternate (SAN) domains ----------------
    case "certificate_alternate_domain_add": {
      const id = str(p.certificateId, "Certificate ID", 80);
      const domain = domainOf(p.verifyDomain);
      await godaddy({
        path: `/v1/certificates/${encodeURIComponent(id)}/alternateDomains`,
        method: "POST",
        body: { subjectAlternativeNames: [domain] },
      });
      return { added: true, domain };
    }

    case "certificate_alternate_domain_delete": {
      const id = str(p.certificateId, "Certificate ID", 80);
      const domain = domainOf(p.verifyDomain);
      if (p.confirm !== true) throw new ExtrasInputError("Please confirm before removing this domain.");
      await godaddy({
        path: `/v1/certificates/${encodeURIComponent(id)}/alternateDomains/${encodeURIComponent(domain)}`,
        method: "DELETE",
      });
      return { removed: true, domain };
    }

    // ---------------- Domains v2: nameservers ----------------
    case "nameservers_replace_v2": {
      const nameservers = (Array.isArray(p.nameservers) ? p.nameservers : [])
        .map((n) => String(n ?? "").trim().toLowerCase())
        .filter(Boolean);
      if (nameservers.length < 2) throw new ExtrasInputError("Please provide at least two nameservers.");
      if (nameservers.length > 13) throw new ExtrasInputError("Maximum 13 nameservers allowed.");
      for (const ns of nameservers) {
        if (!DOMAIN_RE.test(ns)) throw new ExtrasInputError(`"${ns}" is not a valid nameserver hostname.`);
      }
      await godaddy({
        path: `/v2/customers/${encodeURIComponent(customerOf(p))}/domains/${encodeURIComponent(domainOf(p.domain))}/nameServers`,
        method: "PUT",
        body: { nameServers: nameservers },
      });
      return { updated: true, nameservers };
    }

    default:
      return NOT_HANDLED;
  }
}
