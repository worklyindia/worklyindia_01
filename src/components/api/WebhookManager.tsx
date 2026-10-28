import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useWebhookManager, WebhookEndpoint } from "@/hooks/useWebhookManager";
import { toast } from "sonner";
import { Plus, Trash2, TestTube, Activity, Copy, CheckCircle, AlertCircle, Loader2, Pencil, ScrollText, ArrowLeft, Download } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { formatDateWithSeconds } from "@/utils/dateFormatUtils";
import { WebhookEventPicker } from "./WebhookEventPicker";
import { downloadWebhookSecretPdf, type WebhookSecretDocument } from "@/lib/webhookSecretPdf";


export const WebhookManager = () => {
  const navigate = useNavigate();
  const { webhooks, isLoading, registerWebhook, updateWebhook, deleteWebhook, testWebhook } = useWebhookManager();
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookEndpoint | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleteWebhookId, setDeleteWebhookId] = useState<string | null>(null);
  const [newWebhookSecret, setNewWebhookSecret] = useState<string>("");
  const [secretDoc, setSecretDoc] = useState<WebhookSecretDocument | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const [formData, setFormData] = useState({
    url: "",
    description: "",
    events: [] as string[],
  });

  const handleEventToggle = (eventId: string) => {
    setFormData(prev => ({
      ...prev,
      events: prev.events.includes(eventId)
        ? prev.events.filter(e => e !== eventId)
        : [...prev.events, eventId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.url.trim()) {
      toast.error("Please enter a webhook URL");
      return;
    }

    if (!formData.url.startsWith("https://")) {
      toast.error("Webhook URL must use HTTPS");
      return;
    }

    if (formData.events.length === 0) {
      toast.error("Please select at least one event");
      return;
    }

    try {
      new URL(formData.url);
    } catch {
      toast.error("Please enter a valid URL");
      return;
    }

    let result: WebhookEndpoint;
    try {
      result = await registerWebhook.mutateAsync(formData);
    } catch {
      return; // endpoint test failed — keep form open, error toast shown
    }

    if (result.secret) {
      const secretDoc = { url: result.url, secret: result.secret, events: result.events, description: result.description };
      setSecretDoc(secretDoc);
      setNewWebhookSecret(result.secret);
      setShowSecretModal(true);
      try { downloadWebhookSecretPdf(secretDoc); } catch { /* button remains */ }
    }
    
    setShowAddModal(false);
    setFormData({ url: "", description: "", events: [] });
  };

  const handleDelete = async () => {
    if (!deleteWebhookId) return;
    await deleteWebhook.mutateAsync(deleteWebhookId);
    setDeleteWebhookId(null);
  };

  const handleEditWebhook = (webhook: WebhookEndpoint) => {
    setEditingWebhook(webhook);
    setFormData({
      url: webhook.url,
      description: webhook.description || "",
      events: webhook.events,
    });
    setShowEditModal(true);
  };

  const handleUpdateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWebhook) return;
    if (formData.events.length === 0) { toast.error("Please select at least one event"); return; }
    try {
      await updateWebhook.mutateAsync({ id: editingWebhook.id, url: formData.url.trim(), description: formData.description, events: formData.events });
    } catch { return; }
    setShowEditModal(false);
    setEditingWebhook(null);
    setFormData({ url: "", description: "", events: [] });
  };


  const handleTest = async (webhookId: string) => {
    try {
      await testWebhook.mutateAsync(webhookId);
    } catch {
      // error toast handled in hook
    }
  };

  const handleCopySecret = () => {
    navigator.clipboard.writeText(newWebhookSecret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
    toast.success("Secret copied to clipboard");
  };

  const handleCopyWebhookScript = () => {
    const script = `// Node.js Webhook Handler with Signature Verification
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return signature === expectedSignature;
}

// Express.js webhook endpoint example
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const secret = process.env.WEBHOOK_SECRET; // Your webhook secret
  
  if (!verifyWebhookSignature(req.body, signature, secret)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Process webhook event
  const { event, payload } = req.body;
  console.log('Webhook received:', event, payload);
  
  res.json({ success: true });
});`;
    
    navigator.clipboard.writeText(script);
    toast.success("Webhook script copied to clipboard");
  };

  return (
    <div className="space-y-6">
      {/* Add Webhook Section */}
      <div>
        <div className="mb-4">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
              <Activity className="w-4 h-4 md:w-5 md:h-5" />
              <span className="hidden sm:inline">Webhook Management</span>
              <span className="sm:hidden">Webhooks</span>
            </CardTitle>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" onClick={() => navigate("/developers/workbook-logs")} size="sm" className="gap-1 px-2 text-xs md:text-sm">
                <ScrollText className="h-3.5 w-3.5 md:h-4 md:w-4" />
                Logs
              </Button>
              <Button onClick={() => setShowAddModal(true)} size="sm" className="gap-1 px-2 text-xs md:text-sm">
                <Plus className="h-3.5 w-3.5 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Add Webhook</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </div>
          </div>
        </div>
        <div>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : webhooks && webhooks.length > 0 ? (
            <div className="divide-y divide-border">
              {webhooks.map((webhook) => (
                <div key={webhook.id} className="space-y-3 py-4 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between gap-3">
                        <span className={`text-sm font-medium ${webhook.is_active ? "text-primary" : "text-muted-foreground"}`}>
                          Workbook {webhook.is_active ? "On" : "Off"}
                        </span>
                        <Switch
                          checked={webhook.is_active}
                          disabled={updateWebhook.isPending}
                          onCheckedChange={(checked) => updateWebhook.mutate({ id: webhook.id, is_active: checked })}
                          aria-label="Turn workbook on or off"
                        />
                      </div>
                      <code className="block w-full break-all rounded bg-muted px-3 py-2 font-mono text-xs">
                        {webhook.url}
                      </code>

                      {/* Action Buttons */}
                      <div className="flex flex-nowrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTest(webhook.id)}
                          disabled={testWebhook.isPending}
                          className="flex-1 gap-1 px-2 whitespace-nowrap"
                        >
                          <TestTube className="w-3.5 h-3.5 shrink-0" />
                          Test
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditWebhook(webhook)}
                          className="flex-1 gap-1 px-2 whitespace-nowrap"
                        >
                          <Pencil className="w-3.5 h-3.5 shrink-0" />
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeleteWebhookId(webhook.id)}
                          disabled={deleteWebhook.isPending}
                          className="flex-1 gap-1 px-2 whitespace-nowrap"
                        >
                          <Trash2 className="w-3.5 h-3.5 shrink-0" />
                          Delete
                        </Button>
                      </div>

                      {/* Timestamp */}
                      <p className="text-xs text-muted-foreground">
                        {formatDateWithSeconds(webhook.created_at)}
                      </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>No webhooks configured yet.</p>
              <p className="text-sm">Click "Add Webhook" to get started.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Webhook Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="flex flex-col max-sm:inset-0 max-sm:left-0 max-sm:top-0 max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0 sm:max-h-[85vh] overflow-hidden [&>button:last-child]:hidden">
          <div className="-mx-6 -mt-6 flex shrink-0 items-center gap-2 border-b px-3 py-3 sm:-mt-6">
            <Button type="button" variant="ghost" size="icon" onClick={() => setShowAddModal(false)} aria-label="Back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <DialogTitle className="text-lg">Add Workbook</DialogTitle>
          </div>
          <DialogDescription className="sr-only">Add Workbook</DialogDescription>
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4">
            <div>
              <Label htmlFor="url">Webhook URL *</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://your-domain.com/webhook"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                required
              />
              <p className="text-xs text-muted-foreground mt-1">Must use HTTPS. We send a test request first — the workbook is created only if your URL responds 2xx.</p>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Production webhook endpoint"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              <Label className="mb-3 block">Events to Subscribe *</Label>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1">
                <WebhookEventPicker value={formData.events} onChange={(events) => setFormData((prev) => ({ ...prev, events }))} />
              </div>
            </div>

            <DialogFooter className="shrink-0 flex-row gap-2 border-t pt-3 [&>button]:flex-1 sm:[&>button]:flex-none">
              <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={registerWebhook.isPending}>
                {registerWebhook.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {registerWebhook.isPending ? "Testing URL..." : "Create Workbook"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Webhook Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="flex flex-col max-sm:inset-0 max-sm:left-0 max-sm:top-0 max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0 sm:max-h-[85vh] overflow-hidden [&>button:last-child]:hidden">
          <div className="-mx-6 -mt-6 flex shrink-0 items-center gap-2 border-b px-3 py-3 sm:-mt-6">
            <Button type="button" variant="ghost" size="icon" onClick={() => setShowEditModal(false)} aria-label="Back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <DialogTitle className="text-lg">Edit Workbook</DialogTitle>
          </div>
          <DialogDescription className="sr-only">Edit Workbook</DialogDescription>
          <form onSubmit={handleUpdateWebhook} className="flex min-h-0 flex-1 flex-col gap-4">
            <div>
              <Label htmlFor="edit-url">Webhook URL *</Label>
              <Input
                id="edit-url"
                type="url"
                placeholder="https://your-domain.com/webhook"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                placeholder="Production webhook endpoint"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              <Label className="mb-3 block">Events to Subscribe *</Label>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1">
                <WebhookEventPicker idPrefix="edit-" value={formData.events} onChange={(events) => setFormData((prev) => ({ ...prev, events }))} />
              </div>
            </div>

            <DialogFooter className="shrink-0 flex-row gap-2 border-t pt-3 [&>button]:flex-1 sm:[&>button]:flex-none">
              <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateWebhook.isPending}>
                {updateWebhook.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Update Workbook
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Webhook Secret Modal */}
      <Dialog open={showSecretModal} onOpenChange={setShowSecretModal}>
        <DialogContent className="max-sm:inset-0 max-sm:left-0 max-sm:top-0 max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0 sm:max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Webhook Secret
            </DialogTitle>
            <DialogDescription>
              Save your webhook secret securely. You won't be able to see it again!
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-800">
                Store this secret in a secure location. You'll need it to verify webhook signatures.
              </p>
            </div>
            <div>
              <Label>Webhook Secret</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={newWebhookSecret}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopySecret}
                  className="shrink-0"
                >
                  {copiedSecret ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-row gap-2 [&>button]:flex-1">
            <Button variant="outline" onClick={() => secretDoc && downloadWebhookSecretPdf(secretDoc)} disabled={!secretDoc}>
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
            <Button onClick={() => setShowSecretModal(false)}>
              I've Saved It
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteWebhookId} onOpenChange={(open) => !open && setDeleteWebhookId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Webhook</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this webhook? This action cannot be undone and you will stop receiving events at this endpoint.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Webhook
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};
