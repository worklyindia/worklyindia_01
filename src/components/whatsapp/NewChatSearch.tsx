import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, User, Building2, Phone, MessageSquarePlus, Loader2 } from "lucide-react";
import LottieSearchIcon from "@/components/LottieSearchIcon";

interface Contact {
  id: string;
  name: string;
  phone: string;
  type: 'jobseeker' | 'employer';
  avatar?: string;
  subtitle?: string;
}

interface NewChatSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartChat: (phone: string, name: string, type: string, userId?: string) => void;
  existingPhones: string[];
}

export function NewChatSearch({ open, onOpenChange, onStartChat, existingPhones }: NewChatSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  // Fetch job seekers
  const { data: jobseekers = [], isLoading: loadingJobseekers } = useQuery({
    queryKey: ['contacts-jobseekers', searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('user_id, full_name, phone, whatsapp_number, profile_image_url, current_position')
        .or('whatsapp_number.neq.,phone.neq.')
        .limit(50);

      if (searchQuery) {
        query = query.or(`full_name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,whatsapp_number.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).filter(p => (p.whatsapp_number?.trim() || p.phone?.trim())).map((p): Contact => ({
        id: p.user_id,
        name: p.full_name || 'Unknown',
        phone: p.whatsapp_number?.trim() || p.phone?.trim() || '',
        type: 'jobseeker',
        avatar: p.profile_image_url || undefined,
        subtitle: p.current_position || 'Job Seeker'
      }));
    },
    enabled: open,
  });

  // Fetch employers
  const { data: employers = [], isLoading: loadingEmployers } = useQuery({
    queryKey: ['contacts-employers', searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('companies')
        .select('user_id, company_name, phone, whatsapp_number, logo_url, industry')
        .or('whatsapp_number.neq.,phone.neq.')
        .limit(50);

      if (searchQuery) {
        query = query.or(`company_name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,whatsapp_number.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || [])
        .filter(c => (c.whatsapp_number?.trim() || c.phone?.trim()))
        .map((c): Contact => ({
          id: c.user_id,
          name: c.company_name || 'Unknown Company',
          phone: c.whatsapp_number?.trim() || c.phone?.trim() || '',
          type: 'employer',
          avatar: c.logo_url || undefined,
          subtitle: c.industry || 'Employer'
        }));
    },
    enabled: open,
  });

  const allContacts = [...jobseekers, ...employers];
  const filteredContacts = activeTab === 'all' 
    ? allContacts 
    : allContacts.filter(c => c.type === activeTab);

  const isLoading = loadingJobseekers || loadingEmployers;

  const normalizePhone = (phone: string): string => {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
    if (cleaned.length === 10) cleaned = '91' + cleaned;
    return cleaned;
  };

  const isExistingConversation = (phone: string): boolean => {
    const normalized = normalizePhone(phone);
    return existingPhones.some(p => normalizePhone(p) === normalized);
  };

  const handleSelectContact = (contact: Contact) => {
    onStartChat(contact.phone, contact.name, contact.type, contact.id);
    onOpenChange(false);
    setSearchQuery("");
  };

  const handleManualStart = () => {
    if (!manualPhone.trim()) return;
    const normalized = normalizePhone(manualPhone);
    onStartChat(normalized, '', 'unknown');
    onOpenChange(false);
    setManualPhone("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquarePlus className="h-5 w-5" />
            New Chat
          </DialogTitle>
        </DialogHeader>

        {/* Search Input */}
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"><LottieSearchIcon size={16} /></div>
          <Input
            placeholder="Search by name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Manual Phone Input */}
        <div className="flex gap-2">
          <Input
            placeholder="Or enter phone number..."
            value={manualPhone}
            onChange={(e) => setManualPhone(e.target.value)}
            className="flex-1"
          />
          <Button 
            onClick={handleManualStart}
            disabled={!manualPhone.trim()}
            size="sm"
          >
            <Phone className="h-4 w-4 mr-1" />
            Start
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="jobseeker">Job Seekers</TabsTrigger>
            <TabsTrigger value="employer">Employers</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="flex-1 mt-4">
            <ScrollArea className="h-[300px]">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No contacts found</p>
                  <p className="text-xs mt-1">Try searching or enter a phone number</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredContacts.map((contact) => {
                    const hasExisting = isExistingConversation(contact.phone);
                    return (
                      <div
                        key={`${contact.type}-${contact.id}`}
                        onClick={() => handleSelectContact(contact)}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={contact.avatar} />
                          <AvatarFallback className={contact.type === 'employer' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}>
                            {contact.type === 'employer' ? <Building2 className="h-5 w-5" /> : <User className="h-5 w-5" />}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{contact.name}</p>
                            {hasExisting && (
                              <Badge variant="outline" className="text-xs">
                                Existing
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{contact.phone}</span>
                            <span>•</span>
                            <span className="truncate">{contact.subtitle}</span>
                          </div>
                        </div>
                        <Badge variant={contact.type === 'employer' ? 'default' : 'secondary'} className="text-xs capitalize">
                          {contact.type === 'employer' ? 'Employer' : 'Seeker'}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
