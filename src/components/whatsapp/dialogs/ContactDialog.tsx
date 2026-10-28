import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Search, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import LottieSearchIcon from "@/components/LottieSearchIcon";

interface ContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (contact: { name: string; phone: string; email?: string }) => void;
}

interface DeviceContact {
  name: string;
  phone: string;
  email?: string;
}

export function ContactDialog({ open, onOpenChange, onSubmit }: ContactDialogProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [deviceContacts, setDeviceContacts] = useState<DeviceContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [contactsLoaded, setContactsLoaded] = useState(false);

  const isContactPickerSupported = 'contacts' in navigator && 'ContactsManager' in window;

  const requestDeviceContacts = async () => {
    if (!isContactPickerSupported) {
      toast.error("Contact access not supported on this device/browser");
      setShowManualEntry(true);
      return;
    }

    setLoading(true);
    try {
      const props = ['name', 'tel', 'email'];
      const opts = { multiple: true };
      
      // @ts-ignore - Contact Picker API
      const contacts = await navigator.contacts.select(props, opts);
      
      if (contacts && contacts.length > 0) {
        const formattedContacts: DeviceContact[] = contacts.map((contact: any) => ({
          name: contact.name?.[0] || 'Unknown',
          phone: contact.tel?.[0] || '',
          email: contact.email?.[0] || undefined
        })).filter((c: DeviceContact) => c.phone);
        
        setDeviceContacts(formattedContacts);
        setContactsLoaded(true);
        
        if (formattedContacts.length === 0) {
          toast.info("No contacts with phone numbers found");
          setShowManualEntry(true);
        }
      } else {
        toast.info("No contacts selected");
      }
    } catch (error: any) {
      console.error('Contact picker error:', error);
      if (error.name === 'SecurityError') {
        toast.error("Contact permission denied");
      } else if (error.name === 'InvalidStateError') {
        toast.error("Contact picker already open");
      } else {
        toast.error("Failed to access contacts");
      }
      setShowManualEntry(true);
    } finally {
      setLoading(false);
    }
  };

  const handleContactSelect = (contact: DeviceContact) => {
    onSubmit(contact);
    resetState();
    onOpenChange(false);
  };

  const handleManualSubmit = () => {
    if (name.trim() && phone.trim()) {
      onSubmit({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
      });
      resetState();
      onOpenChange(false);
    }
  };

  const resetState = () => {
    setName("");
    setPhone("");
    setEmail("");
    setShowManualEntry(false);
    setDeviceContacts([]);
    setSearchQuery("");
    setContactsLoaded(false);
  };

  const filteredContacts = deviceContacts.filter(contact =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.phone.includes(searchQuery)
  );

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetState();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Contact</DialogTitle>
        </DialogHeader>
        
        {!showManualEntry && !contactsLoaded ? (
          <div className="space-y-4">
            <Button
              onClick={requestDeviceContacts}
              className="w-full h-16 flex items-center justify-center gap-3"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Users className="h-5 w-5" />
              )}
              {loading ? "Loading Contacts..." : "Select from Device Contacts"}
            </Button>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>
            
            <Button
              variant="outline"
              onClick={() => setShowManualEntry(true)}
              className="w-full h-12 flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Enter Contact Manually
            </Button>
          </div>
        ) : contactsLoaded && deviceContacts.length > 0 ? (
          <div className="space-y-3">
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"><LottieSearchIcon size={16} /></div>
              <Input
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {filteredContacts.map((contact, index) => (
                  <button
                    key={index}
                    onClick={() => handleContactSelect(contact)}
                    className="w-full p-3 flex items-center gap-3 rounded-lg hover:bg-muted transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-primary font-medium">
                        {contact.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{contact.name}</p>
                      <p className="text-sm text-muted-foreground">{contact.phone}</p>
                    </div>
                  </button>
                ))}
                {filteredContacts.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">No contacts found</p>
                )}
              </div>
            </ScrollArea>
            
            <Button
              variant="outline"
              onClick={() => setShowManualEntry(true)}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Enter Manually
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground">Name</label>
              <Input
                placeholder="Contact name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Phone Number</label>
              <Input
                type="tel"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Email (Optional)</label>
              <Input
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              {!contactsLoaded && isContactPickerSupported && (
                <Button variant="outline" onClick={() => setShowManualEntry(false)} className="flex-1">
                  Back
                </Button>
              )}
              <Button onClick={handleManualSubmit} className="flex-1">
                Share Contact
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
