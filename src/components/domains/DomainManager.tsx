import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  RefreshCw,
  Plus,
  Trash2,
  Save,
  AlertTriangle,
  Server,
  Link2,
  UserRound,
  ArrowLeftRight,
  Globe,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { callDomainApi } from "@/hooks/useGoDaddy";
import type { OwnedDomain } from "./MyDomains";

const RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV", "CAA"] as const;
type RecordType = (typeof RECORD_TYPES)[number];

interface DnsRecord {
  type: RecordType;
  name: string;
  data: string;
  ttl?: number;
  priority?: number;
  service?: string;
  protocol?: string;
  port?: number;
  weight?: number;
}

const emptyRecord: DnsRecord = { type: "A", name: "@", data: "", ttl: 3600 };

interface Props {
  domain: OwnedDomain;
  onBack: () => void;
}

const DomainManager = ({ domain, onBack }: Props) => {
  const name = domain.domain;

  // ---------- details ----------
  const [details, setDetails] = useState<any>(domain);
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadDetails = useCallback(async () => {
    setLoadingDetails(true);
    setDetailsError(null);
    try {
      const res = await callDomainApi<{ details: any }>("get_domain", { domain: name });
      setDetails(res.details ?? {});
    } catch (e: any) {
      setDetailsError(e?.message || "Could not load domain details.");
    } finally {
      setLoadingDetails(false);
    }
  }, [name]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  const patchDomain = async (body: Record<string, unknown>, successMsg: string) => {
    setSaving(true);
    try {
      await callDomainApi("update_domain", { domain: name, ...body });
      toast.success(successMsg);
      loadDetails();
    } catch (e: any) {
      toast.error(e?.message || "Update failed.");
    } finally {
      setSaving(false);
    }
  };

  // ---------- DNS ----------
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [dnsLoading, setDnsLoading] = useState(false);
  const [dnsError, setDnsError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DnsRecord>(emptyRecord);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DnsRecord | null>(null);

  const loadRecords = useCallback(async () => {
    setDnsLoading(true);
    setDnsError(null);
    try {
      const res = await callDomainApi<{ records: DnsRecord[] }>("list_records", { domain: name });
      setRecords(Array.isArray(res.records) ? res.records : []);
    } catch (e: any) {
      setDnsError(e?.message || "Could not load DNS records.");
    } finally {
      setDnsLoading(false);
    }
  }, [name]);

  const saveRecord = async () => {
    if (!draft.data.trim()) {
      toast.error("Please enter a value for the record.");
      return;
    }
    try {
      const sameGroup = records.filter(
        (r) => r.type === draft.type && r.name === draft.name && `${r.type}|${r.name}|${r.data}` !== editingKey,
      );
      const payload = [...sameGroup, draft].map((r) => ({
        data: r.data,
        ttl: r.ttl ?? 3600,
        ...(r.type === "MX" ? { priority: r.priority ?? 10 } : {}),
        ...(r.type === "SRV"
          ? {
              priority: r.priority ?? 1,
              weight: r.weight ?? 1,
              port: r.port ?? 443,
              service: r.service ?? "",
              protocol: r.protocol ?? "",
            }
          : {}),
      }));

      await callDomainApi("replace_records", {
        domain: name,
        type: draft.type,
        name: draft.name,
        records: payload,
      });
      toast.success(editingKey ? "DNS record updated." : "DNS record added.");
      setDraft(emptyRecord);
      setEditingKey(null);
      loadRecords();
    } catch (e: any) {
      toast.error(e?.message || "Could not save the DNS record.");
    }
  };

  const confirmDeleteRecord = async () => {
    if (!pendingDelete) return;
    const rec = pendingDelete;
    setPendingDelete(null);
    try {
      const remaining = records.filter(
        (r) => r.type === rec.type && r.name === rec.name && r.data !== rec.data,
      );
      if (remaining.length > 0) {
        await callDomainApi("replace_records", {
          domain: name,
          type: rec.type,
          name: rec.name,
          records: remaining.map((r) => ({ data: r.data, ttl: r.ttl ?? 3600, ...(r.priority !== undefined ? { priority: r.priority } : {}) })),
        });
      } else {
        await callDomainApi("delete_records", { domain: name, type: rec.type, name: rec.name, confirm: true });
      }
      toast.success("DNS record deleted.");
      loadRecords();
    } catch (e: any) {
      toast.error(e?.message || "Could not delete the DNS record.");
    }
  };

  // ---------- nameservers ----------
  const [nsText, setNsText] = useState("");
  const [hostName, setHostName] = useState("");
  const [hostIps, setHostIps] = useState("");
  const [hostBusy, setHostBusy] = useState(false);

  const [nsConfirm, setNsConfirm] = useState(false);
  useEffect(() => {
    if (details?.nameServers) setNsText((details.nameServers as string[]).join("\n"));
  }, [details?.nameServers]);

  const saveNameservers = async () => {
    const list = nsText.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    setNsConfirm(false);
    try {
      await callDomainApi("update_nameservers", { domain: name, nameServers: list });
      toast.success("Nameservers updated. Propagation can take up to 48 hours.");
      loadDetails();
    } catch (e: any) {
      toast.error(e?.message || "Could not update nameservers.");
    }
  };

  // ---------- contact ----------
  const [contact, setContact] = useState({
    nameFirst: "",
    nameLast: "",
    email: "",
    phone: "",
    address1: "",
    city: "",
    state: "",
    postalCode: "",
    country: "IN",
    organization: "",
  });

  useEffect(() => {
    const c = details?.contactRegistrant;
    if (c) {
      setContact({
        nameFirst: c.nameFirst || "",
        nameLast: c.nameLast || "",
        email: c.email || "",
        phone: c.phone || "",
        address1: c.addressMailing?.address1 || "",
        city: c.addressMailing?.city || "",
        state: c.addressMailing?.state || "",
        postalCode: c.addressMailing?.postalCode || "",
        country: c.addressMailing?.country || "IN",
        organization: c.organization || "",
      });
    }
  }, [details?.contactRegistrant]);

  const saveContact = async () => {
    const required = ["nameFirst", "nameLast", "email", "phone", "address1", "city", "state", "postalCode", "country"] as const;
    for (const field of required) {
      if (!contact[field]?.trim()) {
        toast.error("Please fill in all required contact fields.");
        return;
      }
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    try {
      await callDomainApi("update_contacts", {
        domain: name,
        contacts: {
          contactRegistrant: {
            nameFirst: contact.nameFirst,
            nameLast: contact.nameLast,
            email: contact.email,
            phone: contact.phone,
            organization: contact.organization || undefined,
            addressMailing: {
              address1: contact.address1,
              city: contact.city,
              state: contact.state,
              postalCode: contact.postalCode,
              country: contact.country,
            },
          },
        },
      });
      toast.success("Contact information updated.");
    } catch (e: any) {
      toast.error(e?.message || "Could not update contact information.");
    }
  };

  // ---------- SSL ----------
  const [ssl, setSsl] = useState<any | null>(null);
  const [sslLoading, setSslLoading] = useState(false);
  const [sslError, setSslError] = useState<string | null>(null);

  const loadSsl = useCallback(async () => {
    setSslLoading(true);
    setSslError(null);
    try {
      const res = await callDomainApi<{ ssl: any }>("ssl_status", { domain: name });
      setSsl(res?.ssl ?? null);
    } catch (e: any) {
      setSslError(e?.message || "The SSL status could not be checked.");
    } finally {
      setSslLoading(false);
    }
  }, [name]);

  // ---------- paid SSL certificates (GoDaddy Certificates API) ----------
  const [certId, setCertId] = useState("");
  const [certBusy, setCertBusy] = useState(false);
  const [certInfo, setCertInfo] = useState<any | null>(null);
  const [csr, setCsr] = useState("");
  const [certProduct, setCertProduct] = useState("DV_SSL");
  const [certPeriod, setCertPeriod] = useState("1");
  const [certConsent, setCertConsent] = useState(false);
  const [revokeReason, setRevokeReason] = useState("CESSATION_OF_OPERATION");
  const [certCancelOpen, setCertCancelOpen] = useState(false);
  const [certRevokeOpen, setCertRevokeOpen] = useState(false);

  const certCall = async (action: string, payload: Record<string, unknown>, successMsg: string) => {
    setCertBusy(true);
    try {
      const res = await callDomainApi<any>(action, payload);
      toast.success(successMsg);
      return res;
    } catch (e: any) {
      toast.error(e?.message || "That certificate action failed.");
      return null;
    } finally {
      setCertBusy(false);
    }
  };

  const purchaseCertificate = async () => {
    if (!csr.trim()) return toast.error("Paste the CSR generated on your server.");
    if (!certConsent) return toast.error("Please accept the certificate terms first.");
    const res = await certCall(
      "certificate_purchase",
      {
        csr: csr.trim(),
        productType: certProduct,
        period: Number(certPeriod),
        commonName: name,
        consent: true,
      },
      "Certificate order placed.",
    );
    const newId = res?.order?.certificateId ?? res?.order?.certificate_id;
    if (newId) setCertId(String(newId));
  };

  const loadCertificate = async () => {
    if (!certId.trim()) return toast.error("Enter a certificate ID.");
    const res = await certCall("certificate_get", { certificateId: certId.trim() }, "Certificate loaded.");
    setCertInfo(res?.certificate ?? null);
  };

  const reissueCertificate = async () => {
    if (!certId.trim()) return toast.error("Enter a certificate ID.");
    if (!csr.trim()) return toast.error("A new CSR is required to re-issue.");
    await certCall(
      "certificate_reissue",
      { certificateId: certId.trim(), csr: csr.trim(), commonName: name },
      "Re-issue requested.",
    );
  };

  const renewCertificate = async () => {
    if (!certId.trim()) return toast.error("Enter a certificate ID.");
    if (!csr.trim()) return toast.error("A CSR is required to renew.");
    await certCall(
      "certificate_renew",
      { certificateId: certId.trim(), csr: csr.trim(), period: Number(certPeriod) },
      "Renewal requested.",
    );
  };

  const cancelCertificate = async () => {
    setCertCancelOpen(false);
    await certCall("certificate_cancel", { certificateId: certId.trim(), confirm: true }, "Certificate cancelled.");
  };

  const revokeCertificate = async () => {
    setCertRevokeOpen(false);
    await certCall(
      "certificate_revoke",
      { certificateId: certId.trim(), confirm: true, reason: revokeReason },
      "Certificate revoked.",
    );
  };

  // ---------- paid WHOIS privacy (Full Domain Protection) ----------
  const [privacyAgreements, setPrivacyAgreements] = useState<any[]>([]);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [privacyRemoveOpen, setPrivacyRemoveOpen] = useState(false);
  const [privacyConfirmText, setPrivacyConfirmText] = useState("");

  const loadPrivacyAgreements = useCallback(async () => {
    setPrivacyBusy(true);
    try {
      const res = await callDomainApi<{ agreements: any }>("privacy_agreements", { domain: name });
      const list = Array.isArray(res.agreements) ? res.agreements : res.agreements?.agreements ?? [];
      setPrivacyAgreements(Array.isArray(list) ? list : []);
    } catch (e: any) {
      toast.error(e?.message || "The privacy agreement could not be loaded.");
    } finally {
      setPrivacyBusy(false);
    }
  }, [name]);

  const purchasePrivacy = async () => {
    if (!privacyAccepted || !privacyAgreements.length) {
      toast.error("Please read and accept the privacy agreement first.");
      return;
    }
    setPrivacyBusy(true);
    try {
      await callDomainApi("privacy_purchase", {
        domain: name,
        consent: {
          agreementKeys: privacyAgreements.map((a: any) => a?.agreementKey).filter(Boolean),
          agreedBy: "customer",
          agreedAt: new Date().toISOString(),
        },
      });
      toast.success("WHOIS privacy purchased for this domain.");
      setPrivacyAccepted(false);
      loadDetails();
    } catch (e: any) {
      toast.error(e?.message || "The privacy purchase could not be completed.");
    } finally {
      setPrivacyBusy(false);
    }
  };

  const removePrivacy = async () => {
    setPrivacyRemoveOpen(false);
    setPrivacyBusy(true);
    try {
      await callDomainApi("privacy_delete", { domain: name, confirmDomain: name });
      toast.success("WHOIS privacy removed.");
      setPrivacyConfirmText("");
      loadDetails();
    } catch (e: any) {
      toast.error(e?.message || "WHOIS privacy could not be removed.");
    } finally {
      setPrivacyBusy(false);
    }
  };


  // ---------- renewal / pending actions / verification ----------
  const [renewPeriod, setRenewPeriod] = useState("1");
  const [renewBusy, setRenewBusy] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);
  const [pendingActions, setPendingActions] = useState<{ type: string; status?: string }[]>([]);
  const [actionsLoading, setActionsLoading] = useState(false);

  const loadActions = useCallback(async () => {
    setActionsLoading(true);
    try {
      const res = await callDomainApi<{ actions: any }>("list_actions", { domain: name });
      const list = Array.isArray(res.actions) ? res.actions : res.actions?.actions ?? [];
      setPendingActions(
        (Array.isArray(list) ? list : [])
          .map((a: any) => ({ type: String(a?.type ?? "").toUpperCase(), status: a?.status }))
          .filter((a) => a.type),
      );
    } catch {
      setPendingActions([]);
    } finally {
      setActionsLoading(false);
    }
  }, [name]);

  useEffect(() => {
    loadActions();
  }, [loadActions]);

  const runRenew = async () => {
    setRenewOpen(false);
    setRenewBusy(true);
    try {
      await callDomainApi("renew_domain", {
        domain: name,
        period: Number(renewPeriod),
        confirmDomain: name,
      });
      toast.success(`Renewal for ${renewPeriod} year(s) submitted.`);
      loadDetails();
    } catch (e: any) {
      toast.error(e?.message || "The domain could not be renewed.");
    } finally {
      setRenewBusy(false);
    }
  };

  const cancelAction = async (type: string) => {
    try {
      await callDomainApi("cancel_action", { domain: name, type });
      toast.success("Pending action cancelled.");
      loadActions();
    } catch (e: any) {
      toast.error(e?.message || "That action could not be cancelled.");
    }
  };

  const verifyRegistrantEmail = async () => {
    try {
      await callDomainApi("verify_registrant_email", { domain: name });
      toast.success("Verification email sent to the registrant address.");
    } catch (e: any) {
      toast.error(e?.message || "The verification email could not be sent.");
    }
  };

  // ---------- transfer out ----------
  const [outBusy, setOutBusy] = useState(false);

  const resendTransferEmail = async () => {
    setOutBusy(true);
    try {
      await callDomainApi("resend_transfer_email", { domain: name });
      toast.success("Authorization code emailed to the registrant address.");
    } catch (e: any) {
      toast.error(e?.message || "The email could not be sent.");
    } finally {
      setOutBusy(false);
    }
  };

  const startTransferOut = async () => {
    setOutBusy(true);
    try {
      await callDomainApi("transfer_out", { domain: name, confirmDomain: name });
      toast.success("Transfer out approved. Your new registrar will complete it.");
      loadActions();
    } catch (e: any) {
      toast.error(e?.message || "Transfer out could not be started.");
    } finally {
      setOutBusy(false);
    }
  };

  // ---------- forwarding ----------
  const [forwardUrl, setForwardUrl] = useState("");
  const [forwardSub, setForwardSub] = useState("");
  const [forwardType, setForwardType] = useState("REDIRECT");
  const [forwardLoading, setForwardLoading] = useState(false);
  const [forwardExists, setForwardExists] = useState(false);
  const [forwardDeleteOpen, setForwardDeleteOpen] = useState(false);


  const loadForwarding = useCallback(async () => {
    setForwardLoading(true);
    try {
      const res = await callDomainApi<{ forwards: any }>("get_forwarding", { domain: name });
      const first = Array.isArray(res.forwards) ? res.forwards[0] : res.forwards;
      if (first?.url) {
        setForwardUrl(first.url);
        setForwardType(first.type || "REDIRECT");
        setForwardExists(true);
      } else {
        setForwardExists(false);
      }
    } catch {
      setForwardExists(false);
    } finally {
      setForwardLoading(false);
    }
  }, [name]);

  const saveForwarding = async () => {
    try {
      await callDomainApi("update_forwarding", { domain: name, subdomain: forwardSub.trim(), url: forwardUrl, type: forwardType });
      toast.success("Forwarding saved.");
      loadForwarding();
    } catch (e: any) {
      toast.error(e?.message || "Could not save forwarding.");
    }
  };

  const removeForwarding = async () => {
    setForwardDeleteOpen(false);
    try {
      await callDomainApi("delete_forwarding", { domain: name, subdomain: forwardSub.trim(), confirm: true });
      toast.success("Forwarding removed.");
      setForwardUrl("");
      setForwardExists(false);
    } catch (e: any) {
      toast.error(e?.message || "Could not remove forwarding.");
    }
  };

  // ---------- transfer + delete ----------
  const [authCode, setAuthCode] = useState("");
  const [transferConfirmText, setTransferConfirmText] = useState("");
  const [transferOpen, setTransferOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const runTransfer = async () => {
    setTransferOpen(false);
    try {
      await callDomainApi("transfer_in", {
        domain: name,
        authCode,
        confirmDomain: transferConfirmText.trim().toLowerCase(),
      });
      toast.success("Transfer request submitted.");
      setAuthCode("");
      setTransferConfirmText("");
    } catch (e: any) {
      toast.error(e?.message || "Transfer could not be started.");
    }
  };

  const saveHost = async (action: "create_host" | "update_host" | "delete_host") => {
    const host = hostName.trim().toLowerCase();
    if (!host) {
      toast.error("Enter a host name, e.g. ns1." + name);
      return;
    }
    const ipAddresses = hostIps
      .split(/\r?\n|,/)
      .map((v) => v.trim())
      .filter(Boolean);
    if (action !== "delete_host" && !ipAddresses.length) {
      toast.error("Enter at least one IP address.");
      return;
    }

    setHostBusy(true);
    try {
      await callDomainApi(action, { domain: name, name: host, ipAddresses });
      toast.success(
        action === "delete_host" ? "Host record deleted." : action === "create_host" ? "Host record created." : "Host record updated.",
      );
      if (action === "delete_host") setHostIps("");
    } catch (e: any) {
      toast.error(e?.message || "The host record could not be saved.");
    } finally {
      setHostBusy(false);
    }
  };

  const runDelete = async () => {

    setDeleteOpen(false);
    try {
      await callDomainApi("cancel_domain", {
        domain: name,
        confirmDomain: deleteConfirmText.trim().toLowerCase(),
      });
      toast.success("Domain cancellation submitted.");
      onBack();
    } catch (e: any) {
      toast.error(e?.message || "The domain could not be cancelled.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="px-2">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Domain manager</span>
          </div>
          {details?.status && <Badge>{details.status}</Badge>}
        </div>
        <h2 className="min-w-0 truncate text-xl font-bold">{name}</h2>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <div className="pb-1">
          <TabsList className="grid h-auto w-full grid-cols-3 gap-1">
            <TabsTrigger className="w-full text-xs sm:text-sm" value="overview">Overview</TabsTrigger>
            <TabsTrigger className="w-full text-xs sm:text-sm" value="dns" onClick={() => !records.length && loadRecords()}>DNS Records</TabsTrigger>
            <TabsTrigger className="w-full text-xs sm:text-sm" value="nameservers">Nameservers</TabsTrigger>
            <TabsTrigger className="w-full text-xs sm:text-sm" value="hosts">Hosts</TabsTrigger>
            <TabsTrigger className="w-full text-xs sm:text-sm" value="contact">Contact</TabsTrigger>
            <TabsTrigger className="w-full text-xs sm:text-sm" value="forwarding" onClick={loadForwarding}>Forwarding</TabsTrigger>
            <TabsTrigger className="w-full text-xs sm:text-sm" value="ssl" onClick={() => !ssl && loadSsl()}>SSL</TabsTrigger>
            <TabsTrigger className="w-full text-xs sm:text-sm" value="transfer">Transfer</TabsTrigger>
            <TabsTrigger className="w-full text-xs sm:text-sm" value="danger">Danger zone</TabsTrigger>
          </TabsList>
        </div>

        {/* -------- Overview -------- */}
        <TabsContent value="overview" className="mt-4 space-y-3">
          {loadingDetails ? (
            <Skeleton className="h-48 w-full rounded-lg" />
          ) : detailsError ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
                <p className="text-sm text-muted-foreground">{detailsError}</p>
                <Button variant="outline" onClick={loadDetails}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Retry
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="space-y-4 p-4">
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="font-medium">{details?.status || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Expires</p>
                    <p className="font-medium">
                      {details?.expires ? new Date(details.expires).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Created</p>
                    <p className="font-medium">
                      {details?.createdAt ? new Date(details.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : "—"}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 border-t border-border pt-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label className="text-sm">Auto-renew</Label>
                      <p className="text-xs text-muted-foreground">Renew this domain automatically before expiry.</p>
                    </div>
                    <Switch
                      checked={!!details?.renewAuto}
                      disabled={saving}
                      onCheckedChange={(v) => patchDomain({ renewAuto: v }, `Auto-renew turned ${v ? "on" : "off"}.`)}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label className="text-sm">Transfer lock</Label>
                      <p className="text-xs text-muted-foreground">Protects the domain from unauthorised transfers.</p>
                    </div>
                    <Switch
                      checked={!!details?.locked}
                      disabled={saving}
                      onCheckedChange={(v) => patchDomain({ locked: v }, `Transfer lock ${v ? "enabled" : "disabled"}.`)}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label className="text-sm">Show my details in WHOIS</Label>
                      <p className="text-xs text-muted-foreground">
                        Turn this off to keep your contact details private in public WHOIS lookups.
                      </p>
                    </div>
                    <Switch
                      checked={!!details?.exposeWhois}
                      disabled={saving}
                      onCheckedChange={(v) => patchDomain({ exposeWhois: v }, `WHOIS details ${v ? "shown" : "hidden"}.`)}
                    />
                  </div>
                </div>

                {/* Renewal */}
                <div className="space-y-3 border-t border-border pt-3">
                  <div>
                    <Label className="text-sm">Renew this domain</Label>
                    <p className="text-xs text-muted-foreground">
                      Extends the registration period using your saved payment method.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Select value={renewPeriod} onValueChange={setRenewPeriod}>
                      <SelectTrigger className="h-11 sm:w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 5, 10].map((y) => (
                          <SelectItem key={y} value={String(y)}>{y} year{y > 1 ? "s" : ""}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button className="h-11 sm:w-auto" onClick={() => setRenewOpen(true)} disabled={renewBusy}>
                      <RefreshCw className="mr-2 h-4 w-4" /> Renew now
                    </Button>
                    <Button variant="outline" className="h-11 sm:w-auto" onClick={verifyRegistrantEmail}>
                      <UserRound className="mr-2 h-4 w-4" /> Resend email verification
                    </Button>
                  </div>
                </div>

                {/* Pending actions */}
                <div className="space-y-2 border-t border-border pt-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <Label className="text-sm">Pending actions</Label>
                                          </div>
                    <Button variant="ghost" size="sm" onClick={loadActions} disabled={actionsLoading}>
                      <RefreshCw className={`h-4 w-4 ${actionsLoading ? "animate-spin" : ""}`} />
                    </Button>
                  </div>
                  {pendingActions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No pending actions.</p>
                  ) : (
                    pendingActions.map((a, i) => (
                      <div key={`${a.type}-${i}`} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{a.type}</p>
                          <p className="text-xs text-muted-foreground">{a.status || "PENDING"}</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => cancelAction(a.type)}>
                          Cancel
                        </Button>
                      </div>
                    ))
                  )}
                </div>

              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* -------- DNS -------- */}
        <TabsContent value="dns" className="mt-4 space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{editingKey ? "Edit record" : "Add record"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <Label className="text-xs">Type</Label>
                  <Select value={draft.type} onValueChange={(v) => setDraft({ ...draft, type: v as RecordType })}>
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RECORD_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Name / host</Label>
                  <Input className="h-11" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="@ or www" />
                </div>
                <div>
                  <Label className="text-xs">TTL (seconds)</Label>
                  <Input className="h-11" type="number" value={draft.ttl ?? 3600} onChange={(e) => setDraft({ ...draft, ttl: Number(e.target.value) })} />
                </div>
              </div>

              <div>
                <Label className="text-xs">Value</Label>
                <Input className="h-11" value={draft.data} onChange={(e) => setDraft({ ...draft, data: e.target.value })} placeholder="192.0.2.1" />
              </div>

              {draft.type === "MX" && (
                <div>
                  <Label className="text-xs">Priority</Label>
                  <Input className="h-11" type="number" value={draft.priority ?? 10} onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })} />
                </div>
              )}

              {draft.type === "SRV" && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <Label className="text-xs">Service</Label>
                    <Input className="h-11" value={draft.service ?? ""} onChange={(e) => setDraft({ ...draft, service: e.target.value })} placeholder="_sip" />
                  </div>
                  <div>
                    <Label className="text-xs">Protocol</Label>
                    <Input className="h-11" value={draft.protocol ?? ""} onChange={(e) => setDraft({ ...draft, protocol: e.target.value })} placeholder="_tcp" />
                  </div>
                  <div>
                    <Label className="text-xs">Port</Label>
                    <Input className="h-11" type="number" value={draft.port ?? 443} onChange={(e) => setDraft({ ...draft, port: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label className="text-xs">Weight</Label>
                    <Input className="h-11" type="number" value={draft.weight ?? 1} onChange={(e) => setDraft({ ...draft, weight: Number(e.target.value) })} />
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button className="h-11" onClick={saveRecord}>
                  {editingKey ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                  {editingKey ? "Save changes" : "Add record"}
                </Button>
                {editingKey && (
                  <Button variant="outline" className="h-11" onClick={() => { setEditingKey(null); setDraft(emptyRecord); }}>
                    Cancel
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base">Current records</CardTitle>
              <Button variant="outline" size="sm" onClick={loadRecords}>
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {dnsLoading ? (
                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)
              ) : dnsError ? (
                <div className="flex flex-col items-center gap-3 p-4 text-center">
                  <p className="text-sm text-muted-foreground">{dnsError}</p>
                  <Button variant="outline" onClick={loadRecords}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Retry
                  </Button>
                </div>
              ) : records.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">No DNS records to show yet.</p>
              ) : (
                records.map((r, i) => (
                  <div key={`${r.type}-${r.name}-${r.data}-${i}`} className="rounded-lg border border-border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{r.type}</Badge>
                      <span className="font-medium">{r.name}</span>
                      {r.type === "MX" && (
                        <Badge variant="secondary">Priority {r.priority ?? 10}</Badge>
                      )}
                      <span className="ml-auto text-xs text-muted-foreground">TTL {r.ttl ?? 3600}</span>
                    </div>
                    <p className="mt-1 break-all text-sm text-muted-foreground">{r.data}</p>
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setDraft({ ...r, ttl: r.ttl ?? 3600 });
                          setEditingKey(`${r.type}|${r.name}|${r.data}`);
                        }}
                      >
                        Edit
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setPendingDelete(r)}>
                        <Trash2 className="mr-1 h-3 w-3" /> Delete
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* -------- Nameservers -------- */}
        <TabsContent value="nameservers" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Server className="h-4 w-4" /> Nameservers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">One nameserver per line. At least two are required.</p>
              <Textarea rows={5} value={nsText} onChange={(e) => setNsText(e.target.value)} placeholder={"ns1.example.com\nns2.example.com"} />
              <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Changing nameservers can take up to 48 hours to propagate and may temporarily interrupt your website and email.</span>
              </div>
              <Button className="h-11 w-full sm:w-auto" onClick={() => setNsConfirm(true)}>
                <Save className="mr-2 h-4 w-4" /> Update nameservers
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* -------- Hosts (glue records) -------- */}
        <TabsContent value="hosts" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Server className="h-4 w-4" /> Host (glue) records
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Register your own nameserver hostnames, e.g. <b>ns1.{name}</b>, and point them at IP addresses.
              </p>
              <div className="space-y-2">
                <Label className="text-xs">Host name</Label>
                <Input
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  placeholder={`ns1.${name}`}
                  className="h-11"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">IP addresses (one per line)</Label>
                <Textarea
                  rows={3}
                  value={hostIps}
                  onChange={(e) => setHostIps(e.target.value)}
                  placeholder={"203.0.113.10\n203.0.113.11"}
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button className="h-11 sm:w-auto" onClick={() => saveHost("create_host")} disabled={hostBusy}>
                  <Save className="mr-2 h-4 w-4" /> Create host
                </Button>
                <Button variant="outline" className="h-11 sm:w-auto" onClick={() => saveHost("update_host")} disabled={hostBusy}>
                  <Save className="mr-2 h-4 w-4" /> Update host
                </Button>
                <Button variant="destructive" className="h-11 sm:w-auto" onClick={() => saveHost("delete_host")} disabled={hostBusy}>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete host
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>


        <TabsContent value="contact" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <UserRound className="h-4 w-4" /> Registrant contact
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {([
                  ["nameFirst", "First name"],
                  ["nameLast", "Last name"],
                  ["organization", "Organisation (optional)"],
                  ["email", "Email"],
                  ["phone", "Phone (e.g. +91.9876543210)"],
                  ["address1", "Address"],
                  ["city", "City"],
                  ["state", "State"],
                  ["postalCode", "Postal code"],
                  ["country", "Country code (e.g. IN)"],
                ] as const).map(([key, label]) => (
                  <div key={key}>
                    <Label className="text-xs">{label}</Label>
                    <Input
                      className="h-11"
                      value={(contact as any)[key]}
                      onChange={(e) => setContact({ ...contact, [key]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
              <Button className="h-11 w-full sm:w-auto" onClick={saveContact}>
                <Save className="mr-2 h-4 w-4" /> Save contact
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* -------- Forwarding -------- */}
        <TabsContent value="forwarding" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Link2 className="h-4 w-4" /> URL forwarding
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {forwardLoading ? (
                <Skeleton className="h-24 w-full rounded-lg" />
              ) : (
                <>
                  <div>
                    <Label className="text-xs">Subdomain (leave blank for the root domain)</Label>
                    <Input
                      className="h-11"
                      value={forwardSub}
                      onChange={(e) => setForwardSub(e.target.value)}
                      placeholder={`www  →  www.${name}`}
                      autoCapitalize="none"
                      autoCorrect="off"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Destination URL</Label>
                    <Input
                      className="h-11"
                      value={forwardUrl}
                      onChange={(e) => setForwardUrl(e.target.value)}
                      placeholder="https://www.example.com"
                      inputMode="url"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Forward type</Label>
                    <Select value={forwardType} onValueChange={setForwardType}>
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="REDIRECT">Redirect (visitors see the destination URL)</SelectItem>
                        <SelectItem value="MASKED">Masked (your domain stays in the address bar)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button className="h-11" onClick={saveForwarding}>
                      <Save className="mr-2 h-4 w-4" /> Save forwarding
                    </Button>
                    {forwardExists && (
                      <Button variant="destructive" className="h-11" onClick={() => setForwardDeleteOpen(true)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Remove forwarding
                      </Button>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* -------- Transfer -------- */}
        {/* -------- SSL -------- */}
        <TabsContent value="ssl" className="mt-4 space-y-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-base">SSL certificate</CardTitle>
              <Button variant="ghost" size="sm" onClick={loadSsl} disabled={sslLoading}>
                <RefreshCw className={`h-4 w-4 ${sslLoading ? "animate-spin" : ""}`} />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {sslLoading && !ssl ? (
                <Skeleton className="h-32 w-full rounded-lg" />
              ) : sslError ? (
                <div className="space-y-3 text-center">
                  <p className="text-sm text-muted-foreground">{sslError}</p>
                  <Button variant="outline" onClick={loadSsl}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Retry
                  </Button>
                </div>
              ) : !ssl ? (
                <Button variant="outline" onClick={loadSsl}>
                  <ShieldCheck className="mr-2 h-4 w-4" /> Check SSL status
                </Button>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <ShieldCheck
                      className={`h-5 w-5 ${
                        ssl.state === "active"
                          ? "text-emerald-600"
                          : ssl.state === "expiring"
                            ? "text-amber-600"
                            : "text-destructive"
                      }`}
                    />
                    <Badge variant={ssl.state === "active" ? "default" : "secondary"}>
                      {ssl.state === "active"
                        ? "Active & trusted"
                        : ssl.state === "expiring"
                          ? "Expiring soon"
                          : ssl.state === "expired"
                            ? "Expired"
                            : ssl.state === "issued"
                              ? "Certificate issued, site not responding"
                              : "No certificate found"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Host</p>
                      <p className="font-medium break-all">{ssl.host}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">HTTPS</p>
                      <p className="font-medium">{ssl.https_ok ? "Responding" : "Not responding"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Issuer</p>
                      <p className="font-medium break-all">{ssl.certificate?.issuer || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Issued on</p>
                      <p className="font-medium">
                        {ssl.certificate?.valid_from
                          ? new Date(ssl.certificate.valid_from).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Expires</p>
                      <p className="font-medium">
                        {ssl.certificate?.valid_to
                          ? new Date(ssl.certificate.valid_to).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Days left</p>
                      <p className="font-medium">
                        {typeof ssl.certificate?.days_remaining === "number"
                          ? ssl.certificate.days_remaining
                          : "—"}
                      </p>
                    </div>
                  </div>

                  {ssl.error ? (
                    <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                      {ssl.error}
                    </div>
                  ) : null}

                  <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                    <p className="mb-1 font-medium text-foreground">Renewal</p>
                    <p>{ssl.auto_renew_note}</p>
                    <p className="mt-1">
                      If the certificate is expired or missing, point the domain at your host and re-issue the
                      certificate there. DNS changes can be made in the DNS Records tab.
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* -------- Paid SSL certificate -------- */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4" /> Paid SSL certificate
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Buy, re-issue, renew, cancel or revoke an SSL certificate. Paste the CSR generated on the server that
                will host the certificate.
              </p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Certificate product</Label>
                  <Select value={certProduct} onValueChange={setCertProduct}>
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DV_SSL">Domain validated (DV)</SelectItem>
                      <SelectItem value="DV_WILDCARD_SSL">DV wildcard</SelectItem>
                      <SelectItem value="OV_SSL">Organisation validated (OV)</SelectItem>
                      <SelectItem value="OV_WILDCARD_SSL">OV wildcard</SelectItem>
                      <SelectItem value="EV_SSL">Extended validation (EV)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Term (years)</Label>
                  <Select value={certPeriod} onValueChange={setCertPeriod}>
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["1", "2", "3"].map((y) => (
                        <SelectItem key={y} value={y}>
                          {y} year{y === "1" ? "" : "s"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs">Certificate signing request (CSR)</Label>
                <Textarea
                  rows={5}
                  className="font-mono text-[11px]"
                  placeholder="-----BEGIN CERTIFICATE REQUEST-----"
                  value={csr}
                  onChange={(e) => setCsr(e.target.value)}
                />
              </div>

              <label className="flex items-start gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-primary"
                  checked={certConsent}
                  onChange={(e) => setCertConsent(e.target.checked)}
                />
                <span>
                  I accept the certificate subscriber terms and authorise the purchase for {name}. Certificates are
                  non-refundable once issued.
                </span>
              </label>

              <Button className="h-11 w-full sm:w-auto" onClick={purchaseCertificate} disabled={certBusy || !certConsent}>
                Buy certificate
              </Button>

              <div className="space-y-3 border-t border-border pt-3">
                <Label className="text-xs">Existing certificate ID</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    className="h-11"
                    value={certId}
                    onChange={(e) => setCertId(e.target.value)}
                    placeholder="Certificate ID"
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                  <Button variant="outline" className="h-11" onClick={loadCertificate} disabled={certBusy}>
                    Load
                  </Button>
                </div>

                {certInfo ? (
                  <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/40 p-3 text-xs sm:grid-cols-3">
                    <div>
                      <p className="text-muted-foreground">Status</p>
                      <p className="font-medium">{certInfo.status || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Common name</p>
                      <p className="break-all font-medium">{certInfo.commonName || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Valid until</p>
                      <p className="font-medium">
                        {certInfo.validEnd ? new Date(certInfo.validEnd).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : "—"}
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className="h-11" onClick={reissueCertificate} disabled={certBusy || !certId.trim()}>
                    Re-issue
                  </Button>
                  <Button variant="outline" className="h-11" onClick={renewCertificate} disabled={certBusy || !certId.trim()}>
                    Renew
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11"
                    onClick={() => setCertCancelOpen(true)}
                    disabled={certBusy || !certId.trim()}
                  >
                    Cancel order
                  </Button>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <Label className="text-xs">Revocation reason</Label>
                    <Select value={revokeReason} onValueChange={setRevokeReason}>
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CESSATION_OF_OPERATION">Cessation of operation</SelectItem>
                        <SelectItem value="AFFILIATION_CHANGED">Affiliation changed</SelectItem>
                        <SelectItem value="KEY_COMPROMISE">Key compromise</SelectItem>
                        <SelectItem value="PRIVILEGE_WITHDRAWN">Privilege withdrawn</SelectItem>
                        <SelectItem value="SUPERSEDED">Superseded</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="destructive"
                    className="h-11"
                    onClick={() => setCertRevokeOpen(true)}
                    disabled={certBusy || !certId.trim()}
                  >
                    Revoke certificate
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* -------- Paid WHOIS privacy -------- */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4" /> WHOIS privacy (Full Domain Protection)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Paid privacy replaces your personal details in the public WHOIS record with proxy details. Current
                state: <span className="font-medium text-foreground">{details?.privacy || details?.exposeWhois === false ? "Protected" : "Not enabled"}</span>
              </p>

              {privacyAgreements.length === 0 ? (
                <Button variant="outline" className="h-11 w-full sm:w-auto" onClick={loadPrivacyAgreements} disabled={privacyBusy}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${privacyBusy ? "animate-spin" : ""}`} /> View privacy agreement
                </Button>
              ) : (
                <>
                  <div className="max-h-48 space-y-3 overflow-y-auto rounded-lg border border-border bg-muted/40 p-3 text-xs">
                    {privacyAgreements.map((a: any, i: number) => (
                      <div key={a?.agreementKey ?? i}>
                        <p className="font-medium text-foreground">{a?.title || a?.agreementKey}</p>
                        {a?.url ? (
                          <a href={a.url} target="_blank" rel="noreferrer" className="text-primary underline">
                            Open full agreement
                          </a>
                        ) : null}
                        {a?.content ? (
                          <div
                            className="mt-1 text-muted-foreground [&_a]:underline"
                            dangerouslySetInnerHTML={{ __html: String(a.content) }}
                          />
                        ) : null}
                      </div>
                    ))}
                  </div>

                  <label className="flex items-start gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-primary"
                      checked={privacyAccepted}
                      onChange={(e) => setPrivacyAccepted(e.target.checked)}
                    />
                    <span>I have read and accept the privacy agreement(s) above for {name}.</span>
                  </label>

                  <Button className="h-11 w-full sm:w-auto" onClick={purchasePrivacy} disabled={privacyBusy || !privacyAccepted}>
                    Buy WHOIS privacy
                  </Button>
                </>
              )}

              <div className="space-y-2 border-t border-border pt-3">
                <Label className="text-xs">
                  Remove privacy — type <span className="font-mono">{name}</span> to confirm
                </Label>
                <Input className="h-11" value={privacyConfirmText} onChange={(e) => setPrivacyConfirmText(e.target.value)} />
                <Button
                  variant="destructive"
                  className="h-11 w-full sm:w-auto"
                  disabled={privacyBusy || privacyConfirmText.trim().toLowerCase() !== name.toLowerCase()}
                  onClick={() => setPrivacyRemoveOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Remove WHOIS privacy
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>


        <TabsContent value="transfer" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ArrowLeftRight className="h-4 w-4" /> Domain transfer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                You need the authorization (EPP) code from the current registrar, and the domain must be unlocked there.
              </p>
              <div>
                <Label className="text-xs">Authorization (EPP) code</Label>
                <Input className="h-11" value={authCode} onChange={(e) => setAuthCode(e.target.value)} autoComplete="off" />
              </div>
              <div>
                <Label className="text-xs">Type <span className="font-mono">{name}</span> to confirm</Label>
                <Input className="h-11" value={transferConfirmText} onChange={(e) => setTransferConfirmText(e.target.value)} />
              </div>
              <Button
                className="h-11 w-full sm:w-auto"
                disabled={!authCode.trim() || transferConfirmText.trim().toLowerCase() !== name.toLowerCase()}
                onClick={() => setTransferOpen(true)}
              >
                Start transfer
              </Button>

              <div className="space-y-3 border-t border-border pt-3">
                <p className="text-sm font-medium">Transfer this domain away</p>
                <p className="text-xs text-muted-foreground">
                  Send the authorization code to the registrant email, then approve the transfer at your new registrar.
                  The domain must be unlocked first.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button variant="outline" className="h-11 sm:w-auto" onClick={resendTransferEmail} disabled={outBusy}>
                    Email authorization code
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 sm:w-auto"
                    disabled={outBusy || transferConfirmText.trim().toLowerCase() !== name.toLowerCase()}
                    onClick={startTransferOut}
                  >
                    Approve transfer out
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Type the domain name in the confirmation box above to enable “Approve transfer out”.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* -------- Danger zone -------- */}
        <TabsContent value="danger" className="mt-4">
          <Card className="border-destructive/40">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base text-destructive">
                <AlertTriangle className="h-4 w-4" /> Cancel / delete domain
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Cancelling a domain removes it from your account. This can be irreversible and the name may become
                available for anyone else to register.
              </p>
              <div>
                <Label className="text-xs">Type <span className="font-mono">{name}</span> to confirm</Label>
                <Input className="h-11" value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} />
              </div>
              <Button
                variant="destructive"
                className="h-11 w-full sm:w-auto"
                disabled={deleteConfirmText.trim().toLowerCase() !== name.toLowerCase()}
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Cancel this domain
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* -------- confirmations -------- */}
      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this DNS record?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.type} record for “{pendingDelete?.name}” will be removed. Services using it may stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteRecord}>Delete record</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={nsConfirm} onOpenChange={setNsConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update nameservers?</AlertDialogTitle>
            <AlertDialogDescription>
              DNS propagation can take up to 48 hours. Your website and email may be unavailable during this time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={saveNameservers}>Update</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={forwardDeleteOpen} onOpenChange={setForwardDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove URL forwarding?</AlertDialogTitle>
            <AlertDialogDescription>Visitors will no longer be redirected to your destination URL.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={removeForwarding}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={transferOpen} onOpenChange={setTransferOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start the domain transfer?</AlertDialogTitle>
            <AlertDialogDescription>
The transfer for {name} can take several days and usually cannot be cancelled once started.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runTransfer}>Yes, transfer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={renewOpen} onOpenChange={setRenewOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Renew {name} for {renewPeriod} year(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Your saved payment method will be charged. Renewals cannot be refunded once processed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not now</AlertDialogCancel>
            <AlertDialogAction onClick={runRenew}>Renew domain</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This is irreversible. The domain will be removed from your account and you may lose the name permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep domain</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={runDelete}>
              Yes, cancel domain
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={certCancelOpen} onOpenChange={setCertCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this certificate order?</AlertDialogTitle>
            <AlertDialogDescription>
              Certificate {certId || "—"} will be cancelled before issuance. You can only cancel an order that has not
              been issued yet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep order</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={cancelCertificate}
            >
              Yes, cancel order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={certRevokeOpen} onOpenChange={setCertRevokeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this certificate?</AlertDialogTitle>
            <AlertDialogDescription>
              Certificate {certId || "—"} will stop being trusted immediately and visitors will see security warnings
              until a new certificate is installed. Reason: {revokeReason.replace(/_/g, " ").toLowerCase()}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep certificate</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={revokeCertificate}
            >
              Yes, revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={privacyRemoveOpen} onOpenChange={setPrivacyRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove WHOIS privacy from {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Your registrant name, address, email and phone number become publicly visible in WHOIS. This ends the paid
              privacy subscription for this domain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep privacy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={removePrivacy}
            >
              Yes, remove privacy
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>

  );
};

export default DomainManager;
