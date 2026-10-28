import { confirmDialog } from '@/lib/confirmDialog';
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, Copy, Check, Phone, Mail } from "lucide-react";
import { useWithdrawalRequests } from "@/hooks/useWithdrawalRequests";
import { useAdminStatus } from "@/hooks/useAdminStatus";
import { format } from "date-fns";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import LottieSearchIcon from "@/components/LottieSearchIcon";

const ReferralWithdrawals = () => {
  const { isAdmin } = useAdminStatus();
  const { withdrawalRequests, isLoading, processSuccess, processFailure, isProcessingSuccess, isProcessingFailure } = useWithdrawalRequests(undefined, isAdmin);

  const [searchQuery, setSearchQuery] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [failureDialogOpen, setFailureDialogOpen] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<string | null>(null);
  const [failureReason, setFailureReason] = useState("");
  const [activeTab, setActiveTab] = useState<"pending" | "success" | "failed">("pending");

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSuccess = async (withdrawalId: string) => {
    if (await confirmDialog("Are you sure you want to mark this withdrawal as successful?")) {
      processSuccess(withdrawalId);
    }
  };

  const handleFailure = (withdrawalId: string) => {
    setSelectedWithdrawal(withdrawalId);
    setFailureDialogOpen(true);
  };

  const confirmFailure = () => {
    if (selectedWithdrawal && failureReason.trim()) {
      processFailure({ withdrawalId: selectedWithdrawal, reason: failureReason });
      setFailureDialogOpen(false);
      setSelectedWithdrawal(null);
      setFailureReason("");
    }
  };

  const filteredRequests = withdrawalRequests?.filter((request) => {
    const matchesSearch = request.withdrawal_id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = request.status === activeTab;
    return matchesSearch && matchesTab;
  });

  if (!isAdmin) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">Access Denied. Admin privileges required.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Withdrawal Requests</h1>
        <p className="text-sm text-muted-foreground">Manage referral wallet withdrawal requests</p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <LottieSearchIcon size={16} />
            <Input
              placeholder="Search by Withdrawal ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-md text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending">New</TabsTrigger>
          <TabsTrigger value="success">Success</TabsTrigger>
          <TabsTrigger value="failed">Failed</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-3 mt-4">
          {isLoading ? (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  <span className="ml-2 text-sm">Loading requests...</span>
                </div>
              </CardContent>
            </Card>
          ) : filteredRequests && filteredRequests.length > 0 ? (
            filteredRequests.map((request) => (
              <Card key={request.id} className="overflow-hidden">
                <CardHeader className="pb-2 px-4 pt-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base font-mono">{request.withdrawal_id}</CardTitle>
                        {request.payment_settings?.mobile && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleCopy(request.payment_settings.mobile, `header-mobile-${request.id}`)}
                            title={`Mobile: ${request.payment_settings.mobile}`}
                          >
                            {copiedField === `header-mobile-${request.id}` ? (
                              <Check className="h-3.5 w-3.5 text-green-600" />
                            ) : (
                              <Phone className="h-3.5 w-3.5 text-primary" />
                            )}
                          </Button>
                        )}
                        {request.payment_settings?.email && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleCopy(request.payment_settings.email, `header-email-${request.id}`)}
                            title={`Email: ${request.payment_settings.email}`}
                          >
                            {copiedField === `header-email-${request.id}` ? (
                              <Check className="h-3.5 w-3.5 text-green-600" />
                            ) : (
                              <Mail className="h-3.5 w-3.5 text-primary" />
                            )}
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>📅 {format(new Date(request.created_at), "dd MMMM yyyy")}</span>
                        <span>🕐 {format(new Date(request.created_at), "h:mm a")}</span>
                      </div>
                    </div>
                    <Badge
                      variant={
                        request.status === "success"
                          ? "default"
                          : request.status === "failed"
                          ? "destructive"
                          : "secondary"
                      }
                      className="capitalize text-xs"
                    >
                      {request.status === "pending" ? "new" : request.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 px-4 pb-3">
                  {/* Amount */}
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground mb-0.5">Amount</p>
                    <p className="text-2xl font-bold">₹{request.amount}</p>
                  </div>

                  {/* Payment Details */}
                  {request.payment_settings && (
                    <div className="space-y-2">
                      <p className="font-semibold text-sm">Payment Details</p>
                      <div className="grid gap-1.5">
                      {request.payment_settings.name && (
                        <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                          <div>
                            <p className="text-xs text-muted-foreground">Name</p>
                            <p className="font-medium text-sm">{request.payment_settings.name}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleCopy(request.payment_settings.name, `name-${request.id}`)}
                          >
                            {copiedField === `name-${request.id}` ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      )}

                      {request.payment_settings.bank_name && (
                        <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                          <div>
                            <p className="text-xs text-muted-foreground">Bank Name</p>
                            <p className="font-medium text-sm">{request.payment_settings.bank_name}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleCopy(request.payment_settings.bank_name, `bank-${request.id}`)}
                          >
                            {copiedField === `bank-${request.id}` ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      )}

                      {request.payment_settings.account_number && (
                        <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                          <div>
                            <p className="text-xs text-muted-foreground">Account Number</p>
                            <p className="font-medium text-sm">{request.payment_settings.account_number}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleCopy(request.payment_settings.account_number, `account-${request.id}`)}
                          >
                            {copiedField === `account-${request.id}` ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      )}

                      {request.payment_settings.ifsc_code && (
                        <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                          <div>
                            <p className="text-xs text-muted-foreground">IFSC Code</p>
                            <p className="font-medium text-sm">{request.payment_settings.ifsc_code}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleCopy(request.payment_settings.ifsc_code, `ifsc-${request.id}`)}
                          >
                            {copiedField === `ifsc-${request.id}` ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      )}

                      {request.payment_settings.upi_id && (
                        <div className="flex items-center justify-between p-2 rounded bg-muted/50">
                          <div>
                            <p className="text-xs text-muted-foreground">UPI ID</p>
                            <p className="font-medium text-sm">{request.payment_settings.upi_id}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleCopy(request.payment_settings.upi_id, `upi-${request.id}`)}
                          >
                            {copiedField === `upi-${request.id}` ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  )}

                  {/* Action Buttons - Only show for pending */}
                  {request.status === "pending" && (
                    <div className="flex gap-2 pt-1">
                      <Button
                        onClick={() => handleSuccess(request.withdrawal_id)}
                        disabled={isProcessingSuccess}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-sm h-9"
                      >
                        {isProcessingSuccess ? "Processing..." : "Success"}
                      </Button>
                      <Button
                        onClick={() => handleFailure(request.withdrawal_id)}
                        disabled={isProcessingFailure}
                        variant="destructive"
                        className="flex-1 text-sm h-9"
                      >
                        {isProcessingFailure ? "Processing..." : "Failed"}
                      </Button>
                    </div>
                  )}

                  {/* Show processed info */}
                  {request.status !== "pending" && request.processed_at && (
                    <div className="text-xs text-muted-foreground border-t pt-2">
                      Processed on {format(new Date(request.processed_at), "dd MMMM yyyy 'at' h:mm a")}
                      {request.failure_reason && (
                        <p className="mt-1 text-destructive">Reason: {request.failure_reason}</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-4">
                <p className="text-center text-sm text-muted-foreground">No withdrawal requests found</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Failure Reason Dialog */}
      <Dialog open={failureDialogOpen} onOpenChange={setFailureDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Withdrawal as Failed</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Failure Reason *</Label>
              <Textarea
                id="reason"
                placeholder="Enter reason for failure..."
                value={failureReason}
                onChange={(e) => setFailureReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setFailureDialogOpen(false);
                setFailureReason("");
                setSelectedWithdrawal(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmFailure}
              disabled={!failureReason.trim()}
            >
              Confirm Failure
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReferralWithdrawals;
