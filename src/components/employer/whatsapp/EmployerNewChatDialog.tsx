import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MessageSquarePlus, Phone } from "lucide-react";

interface EmployerNewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartChat: (phone: string, name: string, type: string, userId?: string) => void;
}

function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) cleaned = cleaned.substring(1);
  if (cleaned.length === 10) cleaned = "91" + cleaned;
  return cleaned;
}

export function EmployerNewChatDialog({ open, onOpenChange, onStartChat }: EmployerNewChatDialogProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const normalized = normalizePhone(phone);
  const canStart = normalized.length >= 10;

  const handleStart = () => {
    if (!canStart) return;
    onStartChat(normalized, name.trim(), "unknown");
    onOpenChange(false);
    setName("");
    setPhone("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquarePlus className="h-5 w-5" />
            New Chat
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-chat-name">Name</Label>
            <Input
              id="new-chat-name"
              placeholder="Contact name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-chat-phone">WhatsApp number</Label>
            <Input
              id="new-chat-phone"
              inputMode="tel"
              placeholder="e.g. 9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleStart(); }}
            />
            {phone.trim() && (
              <p className="text-xs text-muted-foreground">Will start chat with +{normalized}</p>
            )}
          </div>
          <Button className="w-full h-11" onClick={handleStart} disabled={!canStart}>
            <Phone className="mr-2 h-4 w-4" />
            Start chat
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default EmployerNewChatDialog;
