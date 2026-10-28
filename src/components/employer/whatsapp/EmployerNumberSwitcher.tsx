import { ChatAccountAvatar, useChatAccountProfile } from "@/components/social/ChatAccountProfile";
import { confirmDialog } from '@/lib/confirmDialog';
import { useState } from "react";
import { Check, ChevronDown, Loader2, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import EmployerWhatsAppConnectCard from "./EmployerWhatsAppConnectCard";
import { employerWhatsAppAction, type EmployerWhatsAppAccount } from "./useEmployerWhatsApp";
import { setSelectedNumber } from "./selectedNumber";

interface Props {
  accounts: EmployerWhatsAppAccount[];
  current: EmployerWhatsAppAccount | null;
  reload: () => Promise<void> | void;
  bordered?: boolean;
  /** Switching only: hides add/disconnect actions from the menu. */
  switchOnly?: boolean;
}

function NumberAccountPhoto({ account }: { account: EmployerWhatsAppAccount }) {
  const profile = useChatAccountProfile("whatsapp", account.phone_number_id);
  return <ChatAccountAvatar platform="whatsapp" picture={profile.picture} name={account.verified_name || account.business_name} />;
}

/** Lets an employer switch between connected WhatsApp numbers, add another, set default or remove one. */
export default function EmployerNumberSwitcher({ accounts, current, reload, bordered = true, switchOnly = false }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast.success(ok); await reload(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const label = (a: EmployerWhatsAppAccount) => a.verified_name || a.business_name || a.display_phone || a.phone_number_id || "Number";

  return (
    <div className={`flex w-full items-center bg-card px-3 py-2 ${bordered ? "border-b border-border" : ""}`}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="min-w-0 w-full justify-between gap-2" disabled={busy}>
            <span className="min-w-0 flex-1 truncate text-left">{current ? `${label(current)} · ${current.display_phone ?? ""}` : "Select number"}</span>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" sideOffset={6} collisionPadding={8} className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:max-w-sm">
          <DropdownMenuLabel>Your WhatsApp numbers</DropdownMenuLabel>
          {accounts.map((a) => (
            <DropdownMenuItem key={a.phone_number_id} onSelect={() => setSelectedNumber(a.phone_number_id ?? null)} className="flex items-center gap-2">
              <Check className={`h-4 w-4 ${a.phone_number_id === current?.phone_number_id ? "opacity-100" : "opacity-0"}`} />
              <NumberAccountPhoto account={a} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{label(a)}</div>
                <div className="truncate text-xs text-muted-foreground">{a.display_phone}</div>
              </div>
              {(a.is_default || accounts.length === 1) && <Badge variant="secondary" className="text-[10px]">Default</Badge>}
            </DropdownMenuItem>
          ))}
          {(!switchOnly || (current && !current.is_default && accounts.length > 1)) && <DropdownMenuSeparator />}
          {current && !current.is_default && accounts.length > 1 && (
            <DropdownMenuItem onSelect={() => run(() => employerWhatsAppAction({ action: "set_default", phone_number_id: current.phone_number_id }), "Default number updated")}>
              <Star className="mr-2 h-4 w-4" /> Make this the default
            </DropdownMenuItem>
          )}
          {!switchOnly && (
            <DropdownMenuItem onSelect={() => setAddOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add another number
            </DropdownMenuItem>
          )}
          {!switchOnly && current && accounts.length > 1 && (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={async () => {
                if (!await confirmDialog(`Disconnect ${current.display_phone ?? "this number"}?`)) return;
                void run(async () => {
                  await employerWhatsAppAction({ action: "disconnect", phone_number_id: current.phone_number_id });
                  setSelectedNumber(null);
                }, "Number disconnected");
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Disconnect this number
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {!switchOnly && (
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-w-lg p-0">
            <DialogHeader className="px-4 pt-4"><DialogTitle>Add another WhatsApp number</DialogTitle></DialogHeader>
            <div className="p-2">
              <EmployerWhatsAppConnectCard onConnected={() => { setAddOpen(false); void reload(); }} />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
