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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Check, Send } from "lucide-react";
import LottieSearchIcon from "@/components/LottieSearchIcon";

interface Contact {
  id: string;
  name: string;
  phoneNumber: string;
  avatarUrl?: string;
}

interface ForwardMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: Contact[];
  messageCount: number;
  onForward: (contactIds: string[]) => void;
  isForwarding?: boolean;
}

export function ForwardMessageDialog({
  open,
  onOpenChange,
  contacts,
  messageCount,
  onForward,
  isForwarding = false
}: ForwardMessageDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.phoneNumber.includes(searchQuery)
  );

  const toggleContact = (contactId: string) => {
    setSelectedContacts(prev =>
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleForward = () => {
    if (selectedContacts.length > 0) {
      onForward(selectedContacts);
      setSelectedContacts([]);
      setSearchQuery("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-whatsapp-panel border-whatsapp-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">
            Forward {messageCount === 1 ? 'message' : `${messageCount} messages`}
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"><LottieSearchIcon size={16} /></div>
          <Input
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-whatsapp-bg border-0 text-white placeholder:text-whatsapp-secondary"
          />
        </div>

        {/* Contacts List */}
        <ScrollArea className="h-[300px]">
          <div className="space-y-1">
            {filteredContacts.map((contact) => {
              const isSelected = selectedContacts.includes(contact.id);
              return (
                <div
                  key={contact.id}
                  onClick={() => toggleContact(contact.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    isSelected ? 'bg-whatsapp-green/20' : 'hover:bg-whatsapp-hover'
                  }`}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={contact.avatarUrl} />
                    <AvatarFallback className="bg-whatsapp-green text-white">
                      {contact.name[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{contact.name}</p>
                    <p className="text-whatsapp-secondary text-sm">{contact.phoneNumber}</p>
                  </div>
                  {isSelected && (
                    <div className="h-6 w-6 rounded-full bg-whatsapp-green flex items-center justify-center">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>
              );
            })}
            {filteredContacts.length === 0 && (
              <p className="text-center text-whatsapp-secondary py-8">
                No contacts found
              </p>
            )}
          </div>
        </ScrollArea>

        {/* Forward Button */}
        {selectedContacts.length > 0 && (
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleForward}
              disabled={isForwarding}
              className="bg-whatsapp-green hover:bg-whatsapp-green-dark text-white gap-2"
            >
              <Send className="h-4 w-4" />
              Forward to {selectedContacts.length} {selectedContacts.length === 1 ? 'contact' : 'contacts'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
