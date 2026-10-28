import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Download, Filter } from "lucide-react";
import { useSupabaseDownload } from "@/hooks/useSupabaseDownload";
import { format } from "date-fns";
import LottieSearchIcon from "@/components/LottieSearchIcon";

export default function UserPayments() {
  const [searchTerm, setSearchTerm] = useState("");
  const [paymentType, setPaymentType] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: allPayments, isLoading } = useQuery({
    queryKey: ["ownerAllPayments", paymentType, statusFilter],
    queryFn: async () => {
      const payments: any[] = [];

      // Fetch all job payments
      const { data: jobPayments } = await supabase
        .from("job_payments")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);

      if (jobPayments) {
        // Fetch user details separately
        const userIds = [...new Set(jobPayments.map(p => p.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);

        const { data: authUsers } = await supabase.auth.admin.listUsers();
        
        const profilesMap = new Map<string, string>();
        profiles?.forEach(p => {
          if (p.user_id && p.full_name) profilesMap.set(p.user_id, p.full_name);
        });
        
        const emailsMap = new Map<string, string>();
        authUsers?.users?.forEach((u: any) => {
          if (u.id && u.email) emailsMap.set(u.id, u.email);
        });

        payments.push(
          ...jobPayments.map((p) => ({
            ...p,
            type: "job_payment",
            user_name: profilesMap.get(p.user_id) || "Unknown",
            user_email: emailsMap.get(p.user_id) || "",
          }))
        );
      }

      // Fetch all guest transactions
      const { data: guestTxns } = await supabase
        .from("guest_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);

      if (guestTxns) {
        payments.push(
          ...guestTxns.map((t) => ({
            ...t,
            type: "guest_transaction",
            user_name: "Guest",
            user_email: t.email,
            points_spent: t.points_amount,
          }))
        );
      }

      // Fetch all boost payments
      const { data: boosts } = await supabase
        .from("job_boosts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);

      if (boosts) {
        const userIds = [...new Set(boosts.map(b => b.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);
        
        const { data: authUsers } = await supabase.auth.admin.listUsers();
        
        const profilesMap = new Map<string, string>();
        profiles?.forEach(p => {
          if (p.user_id && p.full_name) profilesMap.set(p.user_id, p.full_name);
        });
        
        const emailsMap = new Map<string, string>();
        authUsers?.users?.forEach((u: any) => {
          if (u.id && u.email) emailsMap.set(u.id, u.email);
        });

        payments.push(
          ...boosts.map((b) => ({
            ...b,
            type: "boost",
            user_name: profilesMap.get(b.user_id) || "Unknown",
            user_email: emailsMap.get(b.user_id) || "",
            description: "Job Boost",
          }))
        );
      }

      // Fetch all verification purchases
      const { data: verifications } = await supabase
        .from("verification_purchases")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);

      if (verifications) {
        const userIds = [...new Set(verifications.map(v => v.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);

        const { data: authUsers } = await supabase.auth.admin.listUsers();
        
        const profilesMap = new Map<string, string>();
        profiles?.forEach(p => {
          if (p.user_id && p.full_name) profilesMap.set(p.user_id, p.full_name);
        });
        
        const emailsMap = new Map<string, string>();
        authUsers?.users?.forEach((u: any) => {
          if (u.id && u.email) emailsMap.set(u.id, u.email);
        });

        payments.push(
          ...verifications.map((v) => ({
            ...v,
            type: "verification",
            user_name: profilesMap.get(v.user_id) || "Unknown",
            user_email: emailsMap.get(v.user_id) || "",
            description: "Verification",
          }))
        );
      }

      return payments.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
  });

  const filteredPayments = allPayments?.filter((payment) => {
    const matchesSearch =
      searchTerm === "" ||
      payment.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.id?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = paymentType === "all" || payment.type === paymentType;
    const matchesStatus = statusFilter === "all" || payment.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      completed: "default",
      success: "default",
      active: "default",
      pending: "secondary",
      failed: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      job_payment: "bg-blue-500/10 text-blue-500",
      guest_transaction: "bg-purple-500/10 text-purple-500",
      boost: "bg-orange-500/10 text-orange-500",
      verification: "bg-green-500/10 text-green-500",
    };
    return <Badge className={`${colors[type] || ""} text-xs whitespace-nowrap`}>{type.replace("_", " ")}</Badge>;
  };

  const { downloadCSV, isDownloading } = useSupabaseDownload();

  const exportToCSV = async () => {
    if (!filteredPayments) return;

    const csvData = filteredPayments.map(p => ({
      Date: format(new Date(p.created_at), "yyyy-MM-dd HH:mm:ss"),
      User: p.user_name,
      Email: p.user_email,
      Type: p.type,
      Description: p.description || "-",
      Amount: p.amount_paid || p.amount || 0,
      Points: p.points_spent || 0,
      Status: p.status
    }));

    await downloadCSV(`payments-${format(new Date(), "yyyy-MM-dd")}`, csvData);
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">User Payments</h1>
          <p className="text-sm md:text-base text-muted-foreground">View and manage all user payment transactions</p>
        </div>
        <Button onClick={exportToCSV} variant="outline" size="sm" className="w-full sm:w-auto" disabled={isDownloading}>
          <Download className="mr-2 h-4 w-4" />
          {isDownloading ? "Exporting..." : "Export CSV"}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg md:text-xl">Payment Filters</CardTitle>
          <CardDescription className="text-xs md:text-sm">Filter and search payment transactions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"><LottieSearchIcon size={16} /></div>
              <Input
                placeholder="Search by name, email, or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={paymentType} onValueChange={setPaymentType}>
              <SelectTrigger>
                <SelectValue placeholder="Payment Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="job_payment">Job Payments</SelectItem>
                <SelectItem value="guest_transaction">Guest Transactions</SelectItem>
                <SelectItem value="boost">Boost Payments</SelectItem>
                <SelectItem value="verification">Verification Payments</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg md:text-xl">
            Payment Transactions ({filteredPayments?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs md:text-sm whitespace-nowrap">Date</TableHead>
                <TableHead className="text-xs md:text-sm whitespace-nowrap">User</TableHead>
                <TableHead className="text-xs md:text-sm whitespace-nowrap">Type</TableHead>
                <TableHead className="text-xs md:text-sm whitespace-nowrap hidden md:table-cell">Description</TableHead>
                <TableHead className="text-xs md:text-sm text-right whitespace-nowrap">Amount</TableHead>
                <TableHead className="text-xs md:text-sm text-right whitespace-nowrap hidden sm:table-cell">Points</TableHead>
                <TableHead className="text-xs md:text-sm whitespace-nowrap">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredPayments?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">
                    No payments found
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments?.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="text-xs md:text-sm whitespace-nowrap">
                      <div className="flex flex-col">
                        <span>{format(new Date(payment.created_at), "dd MMMM yy")}</span>
                        <span className="text-xs text-muted-foreground">{format(new Date(payment.created_at), "HH:mm")}</span>
                      </div>
                    </TableCell>
                    <TableCell className="min-w-[120px]">
                      <div>
                        <div className="font-medium text-xs md:text-sm truncate max-w-[150px]">{payment.user_name}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[150px]">{payment.user_email}</div>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{getTypeBadge(payment.type)}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs md:text-sm hidden md:table-cell">{payment.description || "-"}</TableCell>
                    <TableCell className="text-right font-medium text-xs md:text-sm whitespace-nowrap">
                      ₹{payment.amount_paid || payment.amount || 0}
                    </TableCell>
                    <TableCell className="text-right text-xs md:text-sm whitespace-nowrap hidden sm:table-cell">{payment.points_spent || 0}</TableCell>
                    <TableCell className="whitespace-nowrap">{getStatusBadge(payment.status)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
