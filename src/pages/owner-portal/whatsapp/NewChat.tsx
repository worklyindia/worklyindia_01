import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Search, User, Building2, Phone, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import LottieSearchIcon from "@/components/LottieSearchIcon";

interface Contact {
  id: string;
  name: string;
  phone: string;
  type: 'jobseeker' | 'employer';
  avatar?: string;
  subtitle?: string;
}

export default function NewChat() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "jobseekers" | "employers">("all");

  // Fetch existing conversation phones
  const { data: existingPhones = [] } = useQuery({
    queryKey: ['existing-conversation-phones'],
    queryFn: async () => {
      const { data } = await supabase
        .from('whatsapp_conversations')
        .select('phone_number');
      return data?.map(c => c.phone_number) || [];
    },
  });

  // Fetch job seekers
  const { data: jobSeekers = [], isLoading: loadingJobSeekers } = useQuery({
    queryKey: ['new-chat-jobseekers', searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('user_id, full_name, phone, whatsapp_number, profile_image_url, current_position')
        .or('whatsapp_number.neq.,phone.neq.');
      
      if (searchQuery) {
        query = query.or(`full_name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,whatsapp_number.ilike.%${searchQuery}%`);
      }
      
      const { data } = await query.limit(50);
      return (data || []).filter(p => (p.whatsapp_number?.trim() || p.phone?.trim())).map(p => ({
        id: p.user_id,
        name: p.full_name || 'Job Seeker',
        phone: p.whatsapp_number?.trim() || p.phone?.trim() || '',
        type: 'jobseeker' as const,
        avatar: p.profile_image_url || undefined,
        subtitle: p.current_position || 'Job Seeker'
      }));
    },
  });

  // Fetch employers
  const { data: employers = [], isLoading: loadingEmployers } = useQuery({
    queryKey: ['new-chat-employers', searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('companies')
        .select('id, company_name, phone, whatsapp_number, logo_url, industry')
        .or('whatsapp_number.neq.,phone.neq.');
      
      if (searchQuery) {
        query = query.or(`company_name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,whatsapp_number.ilike.%${searchQuery}%`);
      }
      
      const { data } = await query.limit(50);
      return (data || []).filter(c => (c.whatsapp_number?.trim() || c.phone?.trim())).map(c => ({
        id: c.id,
        name: c.company_name || 'Employer',
        phone: c.whatsapp_number?.trim() || c.phone?.trim() || '',
        type: 'employer' as const,
        avatar: c.logo_url || undefined,
        subtitle: c.industry || 'Employer'
      }));
    },
  });

  // Combine and filter contacts
  const allContacts = [...jobSeekers, ...employers];
  const filteredContacts = activeTab === 'all' 
    ? allContacts 
    : activeTab === 'jobseekers' 
      ? jobSeekers 
      : employers;

  const isLoading = loadingJobSeekers || loadingEmployers;

  // Normalize phone number for comparison
  const normalizePhone = (phone: string) => phone.replace(/\D/g, '').slice(-10);

  // Check if conversation exists
  const isExistingConversation = (phone: string) => {
    const normalizedPhone = normalizePhone(phone);
    return existingPhones.some(p => normalizePhone(p) === normalizedPhone);
  };

  // Start chat with selected contact
  const handleSelectContact = (contact: Contact) => {
    const phone = normalizePhone(contact.phone);
    if (phone.length >= 10) {
      const fullPhone = phone.startsWith('91') ? phone : `91${phone}`;
      navigate(`/owner-portal/whatsapp/chat/${encodeURIComponent(fullPhone)}`);
    } else {
      toast.error("Invalid phone number");
    }
  };

  // Start chat with manual phone number
  const handleManualStart = () => {
    const phone = normalizePhone(manualPhone);
    if (phone.length >= 10) {
      const fullPhone = phone.startsWith('91') ? phone : `91${phone}`;
      navigate(`/owner-portal/whatsapp/chat/${encodeURIComponent(fullPhone)}`);
    } else {
      toast.error("Enter a valid 10-digit phone number");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header - WhatsApp Style */}
      <div className="bg-whatsapp-green px-3 py-3 flex items-center gap-3 sticky top-0 z-10">
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-white hover:bg-whatsapp-green-dark h-10 w-10"
          onClick={() => navigate("/owner-portal/whatsapp/chat")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-white">New Chat</h1>
          <p className="text-xs text-white/80">Select contact or enter number</p>
        </div>
      </div>

      {/* Search Input */}
      <div className="px-3 py-3 bg-background border-b border-border">
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"><LottieSearchIcon size={16} /></div>
          <Input
            placeholder="Search name or phone"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-muted border-0 text-foreground placeholder:text-muted-foreground rounded-lg h-10"
          />
        </div>
      </div>

      {/* Manual Phone Entry */}
      <div className="px-3 py-3 bg-background border-b border-border">
        <p className="text-xs text-muted-foreground mb-2">Or enter phone number manually</p>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="+91 Enter phone number"
              value={manualPhone}
              onChange={(e) => setManualPhone(e.target.value)}
              className="pl-10 bg-muted border-0 text-foreground placeholder:text-muted-foreground rounded-lg h-10"
              type="tel"
            />
          </div>
          <Button 
            className="bg-whatsapp-green hover:bg-whatsapp-green-dark text-white h-10 px-4"
            onClick={handleManualStart}
            disabled={!manualPhone}
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-3 py-2 bg-background border-b border-border">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="grid w-full grid-cols-3 h-9 bg-muted">
            <TabsTrigger value="all" className="text-xs data-[state=active]:bg-whatsapp-green data-[state=active]:text-white">
              All ({allContacts.length})
            </TabsTrigger>
            <TabsTrigger value="jobseekers" className="text-xs data-[state=active]:bg-whatsapp-green data-[state=active]:text-white">
              <User className="h-3 w-3 mr-1" />
              Job Seekers
            </TabsTrigger>
            <TabsTrigger value="employers" className="text-xs data-[state=active]:bg-whatsapp-green data-[state=active]:text-white">
              <Building2 className="h-3 w-3 mr-1" />
              Employers
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Contact List */}
      <div 
        className="flex-1 overflow-y-auto bg-background"
        style={{ 
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 'max(20px, env(safe-area-inset-bottom))'
        }}
      >
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin h-8 w-8 border-2 border-whatsapp-green border-t-transparent rounded-full mx-auto mb-3"></div>
            <p className="text-muted-foreground">Loading contacts...</p>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="p-8 text-center">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              {searchQuery ? 'No contacts found' : 'No contacts available'}
            </p>
          </div>
        ) : (
          filteredContacts.map((contact) => {
            const exists = isExistingConversation(contact.phone);
            return (
              <div
                key={`${contact.type}-${contact.id}`}
                onClick={() => handleSelectContact(contact)}
                className="flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-muted active:bg-muted/80 transition-colors border-b border-border"
              >
                <Avatar className="h-12 w-12 flex-shrink-0">
                  {contact.avatar && (
                    <AvatarImage src={contact.avatar} alt={contact.name} className="object-cover" />
                  )}
                  <AvatarFallback className={`text-white text-lg ${contact.type === 'employer' ? 'bg-blue-500' : 'bg-whatsapp-green'}`}>
                    {contact.name[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground truncate">{contact.name}</p>
                    {exists && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                        Existing
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-sm text-muted-foreground">{contact.phone}</span>
                    <Badge 
                      variant="outline" 
                      className={`text-[10px] h-4 px-1.5 ${
                        contact.type === 'employer' 
                          ? 'border-blue-300 text-blue-600' 
                          : 'border-green-300 text-green-600'
                      }`}
                    >
                      {contact.type === 'employer' ? (
                        <><Building2 className="h-2.5 w-2.5 mr-0.5" /> Employer</>
                      ) : (
                        <><User className="h-2.5 w-2.5 mr-0.5" /> Job Seeker</>
                      )}
                    </Badge>
                  </div>
                  {contact.subtitle && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{contact.subtitle}</p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
