import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, ReceiptText } from "lucide-react";
import { callDomainMarket, formatMoney } from "@/hooks/useDomainMarket";

interface DomainOrder {
  id: string;
  domain: string;
  tld: string;
  status: string;
  status_reason: string | null;
  registration_status: string | null;
  customer_price: number;
  currency: string;
  renewal_price: number | null;
  created_at: string;
}

const statusClass = (status: string) => {
  switch (status) {
    case "registered":
      return "bg-emerald-600 hover:bg-emerald-600";
    case "paid":
      return "bg-blue-600 hover:bg-blue-600";
    case "failed":
      return "bg-destructive hover:bg-destructive";
    case "registration_pending":
    case "payment_pending":
      return "bg-amber-500 hover:bg-amber-500";
    default:
      return "bg-secondary";
  }
};

const statusLabel = (status: string) => status.replace(/_/g, " ");

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("en-IN", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

/** The signed-in user's domain orders, with live status refresh. */
const MyOrders = () => {
  const [orders, setOrders] = useState<DomainOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await callDomainMarket<{ orders: DomainOrder[] }>("my_orders");
      setOrders(res.orders ?? []);
    } catch (e: any) {
      setErrorMsg(e?.message || "Could not load your orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refreshStatus = async (orderId: string) => {
    setRefreshingId(orderId);
    try {
      const res = await callDomainMarket<{ order: DomainOrder }>("order_status", { order_id: orderId });
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...res.order } : o)));
    } catch {
      /* keep last known status */
    } finally {
      setRefreshingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (errorMsg) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
          <p className="text-sm text-muted-foreground">{errorMsg}</p>
          <Button variant="outline" onClick={load}>
            <RefreshCw className="mr-2 h-4 w-4" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!orders.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
          <ReceiptText className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No domain orders yet. Search for a domain and it will show up here after checkout.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((o) => (
        <Card key={o.id}>
          <CardContent className="space-y-2 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 truncate font-semibold">{o.domain}</span>
              <Badge className={statusClass(o.status)}>{statusLabel(o.status)}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-3">
              <div>
                <p className="font-medium text-foreground">Amount</p>
                <p>{formatMoney(o.customer_price, o.currency)}</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Renewal</p>
                <p>{o.renewal_price ? `${formatMoney(o.renewal_price, o.currency)}/yr` : "—"}</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Placed</p>
                <p>{formatDate(o.created_at)}</p>
              </div>
            </div>
            {o.status_reason ? (
              <p className="text-xs text-muted-foreground">Note: {o.status_reason.replace(/_/g, " ")}</p>
            ) : null}
            {["registration_pending", "paid"].includes(o.status) && (
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                disabled={refreshingId === o.id}
                onClick={() => refreshStatus(o.id)}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${refreshingId === o.id ? "animate-spin" : ""}`} />
                Check registration status
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default MyOrders;
