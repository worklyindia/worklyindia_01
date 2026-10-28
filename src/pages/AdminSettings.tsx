import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { 
  useSocialLinks, 
  useUpdateSocialLinks, 
  useContactInfo,
  useUpdateContactInfo,
  useMerchantInfo,
  useUpdateMerchantInfo,
  SocialLinks,
  ContactInfo,
  MerchantInfo 
} from "@/hooks/useSiteSettings";
import { Settings, Save, Instagram, Facebook, Youtube, Twitter, Send, Phone, Mail, Building2, Smartphone, Image, Linkedin, MessageCircle, ArrowLeft, Loader2 } from "lucide-react";
import { AuthImageSettings } from "@/components/admin/AuthImageSettings";
import { AdminAppSettingsPanel } from "@/components/admin/AdminAppSettingsPanel";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BRAND_CONFIG } from "@/config/brandConfig";

const AdminSettings = () => {
  const navigate = useNavigate();
  const { data: socialLinks, isLoading: socialLoading } = useSocialLinks();
  const { data: contactInfo, isLoading: contactLoading } = useContactInfo();
  const { data: merchantInfo, isLoading: merchantLoading } = useMerchantInfo();
  
  const updateSocialLinks = useUpdateSocialLinks();
  const updateContact = useUpdateContactInfo();
  const updateMerchant = useUpdateMerchantInfo();
  
  const [formData, setFormData] = useState<SocialLinks>({
    instagram: "",
    facebook: "",
    youtube: "",
    twitter: "",
    telegram: "",
    linkedin: "",
    whatsapp: "",
    instagram_handle: "",
    facebook_handle: "",
    youtube_handle: "",
    twitter_handle: "",
    telegram_handle: "",
    linkedin_handle: "",
    whatsapp_handle: "",
  });

  const [contactForm, setContactForm] = useState<ContactInfo>({
    phone: "",
    phone_hours: "",
    email: "",
    email_response: "",
    office_address: "",
    office_note: "",
    live_chat_available: true,
    live_chat_hours: "",
  });

  const [merchantForm, setMerchantForm] = useState<MerchantInfo>({
    legal_name: "",
    contact_number: "",
    email: "",
    registered_address: "",
    operational_address: "",
    founded_year: "",
    udyam_registration: "",
    iec_code: "",
    business_type: "",
  });

  // Check if user is authenticated
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please login to access admin settings");
        navigate("/");
      }
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    if (socialLinks) {
      setFormData(socialLinks);
    }
  }, [socialLinks]);

  useEffect(() => {
    if (contactInfo) {
      setContactForm(contactInfo);
    }
  }, [contactInfo]);

  useEffect(() => {
    if (merchantInfo) {
      setMerchantForm(merchantInfo);
    }
  }, [merchantInfo]);

  const handleChange = (field: keyof SocialLinks, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSocialLinks.mutate(formData);
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateContact.mutate(contactForm);
  };

  const handleMerchantSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMerchant.mutate(merchantForm);
  };

  const socialPlatforms = [
    { 
      name: "Instagram", 
      icon: Instagram, 
      color: "text-pink-600",
      urlField: "instagram" as keyof SocialLinks,
      handleField: "instagram_handle" as keyof SocialLinks,
      placeholder: "https://www.instagram.com/your_handle"
    },
    { 
      name: "Facebook", 
      icon: Facebook, 
      color: "text-blue-600",
      urlField: "facebook" as keyof SocialLinks,
      handleField: "facebook_handle" as keyof SocialLinks,
      placeholder: "https://www.facebook.com/your_page"
    },
    { 
      name: "YouTube", 
      icon: Youtube, 
      color: "text-red-600",
      urlField: "youtube" as keyof SocialLinks,
      handleField: "youtube_handle" as keyof SocialLinks,
      placeholder: "https://youtube.com/@your_channel"
    },
    { 
      name: "Twitter", 
      icon: Twitter, 
      color: "text-sky-600",
      urlField: "twitter" as keyof SocialLinks,
      handleField: "twitter_handle" as keyof SocialLinks,
      placeholder: "https://x.com/your_handle"
    },
    { 
      name: "Telegram", 
      icon: Send, 
      color: "text-blue-500",
      urlField: "telegram" as keyof SocialLinks,
      handleField: "telegram_handle" as keyof SocialLinks,
      placeholder: "https://t.me/your_channel"
    },
    { 
      name: "LinkedIn", 
      icon: Linkedin, 
      color: "text-[#0A66C2]",
      urlField: "linkedin" as keyof SocialLinks,
      handleField: "linkedin_handle" as keyof SocialLinks,
      placeholder: "https://www.linkedin.com/company/your_page"
    },
    { 
      name: "WhatsApp", 
      icon: MessageCircle, 
      color: "text-[#25D366]",
      urlField: "whatsapp" as keyof SocialLinks,
      handleField: "whatsapp_handle" as keyof SocialLinks,
      placeholder: "https://whatsapp.com/channel/your_channel"
    },
  ];

  const isLoading = socialLoading || contactLoading || merchantLoading;

  const pageHeader = (
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur">
      <button onClick={() => navigate(-1)} aria-label="Back" className="rounded-full p-2 hover:bg-muted">
        <ArrowLeft className="h-5 w-5" />
      </button>
      <div className="min-w-0">
        <h1 className="text-lg font-semibold leading-tight">Site Settings</h1>
        <p className="truncate text-xs text-muted-foreground">
          Contact, merchant details & social links
        </p>
      </div>
    </header>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        {pageHeader}
        <div className="flex justify-center px-4 py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {pageHeader}

      <main className="container mx-auto max-w-4xl px-4 py-5 pb-10">

        <Tabs defaultValue="contact" className="space-y-5">
          <TabsList className="grid h-auto w-full grid-cols-5 gap-1 p-1">
            <TabsTrigger value="contact" className="flex-col gap-1 px-1 py-2 text-[11px] sm:flex-row sm:text-sm">
              <Phone className="h-4 w-4 sm:mr-1.5" />
              Contact
            </TabsTrigger>
            <TabsTrigger value="merchant" className="flex-col gap-1 px-1 py-2 text-[11px] sm:flex-row sm:text-sm">
              <Building2 className="h-4 w-4 sm:mr-1.5" />
              Merchant
            </TabsTrigger>
            <TabsTrigger value="social" className="flex-col gap-1 px-1 py-2 text-[11px] sm:flex-row sm:text-sm">
              <Settings className="h-4 w-4 sm:mr-1.5" />
              Social
            </TabsTrigger>
            <TabsTrigger value="auth-images" className="flex-col gap-1 px-1 py-2 text-[11px] sm:flex-row sm:text-sm">
              <Image className="h-4 w-4 sm:mr-1.5" />
              Images
            </TabsTrigger>
            <TabsTrigger value="apps" className="flex-col gap-1 px-1 py-2 text-[11px] sm:flex-row sm:text-sm">
              <Smartphone className="h-4 w-4 sm:mr-1.5" />
              Apps
            </TabsTrigger>
          </TabsList>

          <TabsContent value="contact">
            <form onSubmit={handleContactSubmit}>
              <Card className="p-4 sm:p-6">
                <h2 className="text-xl font-semibold mb-6 flex items-center">
                  <Mail className="w-5 h-5 mr-2 text-primary" />
                  Contact Information
                </h2>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        value={contactForm.phone}
                        onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                        placeholder="+91 9904923067"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone_hours">Phone Hours</Label>
                      <Input
                        id="phone_hours"
                        value={contactForm.phone_hours}
                        onChange={(e) => setContactForm({ ...contactForm, phone_hours: e.target.value })}
                        placeholder="Mon-Fri, 9 AM - 6 PM"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={contactForm.email}
                        onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                        placeholder="support@example.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email_response">Email Response Time</Label>
                      <Input
                        id="email_response"
                        value={contactForm.email_response}
                        onChange={(e) => setContactForm({ ...contactForm, email_response: e.target.value })}
                        placeholder="24/7 Response"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="office_address">Office Address</Label>
                    <Textarea
                      id="office_address"
                      value={contactForm.office_address}
                      onChange={(e) => setContactForm({ ...contactForm, office_address: e.target.value })}
                      placeholder="Enter your office address"
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label htmlFor="office_note">Office Visit Note</Label>
                    <Input
                      id="office_note"
                      value={contactForm.office_note}
                      onChange={(e) => setContactForm({ ...contactForm, office_note: e.target.value })}
                      placeholder="By Appointment"
                    />
                  </div>

                  <div className="flex items-center justify-between border rounded-lg p-4">
                    <div className="space-y-0.5">
                      <Label htmlFor="live_chat">Live Chat Support</Label>
                      <p className="text-sm text-muted-foreground">
                        Enable 24/7 live chat
                      </p>
                    </div>
                    <Switch
                      id="live_chat"
                      checked={contactForm.live_chat_available}
                      onCheckedChange={(checked) => setContactForm({ ...contactForm, live_chat_available: checked })}
                    />
                  </div>

                  {contactForm.live_chat_available && (
                    <div>
                      <Label htmlFor="live_chat_hours">Live Chat Hours</Label>
                      <Input
                        id="live_chat_hours"
                        value={contactForm.live_chat_hours}
                        onChange={(e) => setContactForm({ ...contactForm, live_chat_hours: e.target.value })}
                        placeholder="24/7 Support"
                      />
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-3">
                    {([
                      ["hours_weekdays", "Monday - Friday Hours", "9:00 AM - 6:00 PM"],
                      ["hours_saturday", "Saturday Hours", "10:00 AM - 4:00 PM"],
                      ["hours_sunday", "Sunday Hours", "Closed"],
                    ] as const).map(([key, label, ph]) => (
                      <div key={key}>
                        <Label htmlFor={key}>{label}</Label>
                        <Input
                          id={key}
                          value={contactForm[key] ?? ""}
                          onChange={(e) => setContactForm({ ...contactForm, [key]: e.target.value })}
                          placeholder={ph}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <Button type="submit" disabled={updateContact.isPending} className="flex-1">
                    <Save className="w-4 h-4 mr-2" />
                    {updateContact.isPending ? "Saving..." : "Save Contact Info"}
                  </Button>
                </div>
              </Card>
            </form>
          </TabsContent>

          <TabsContent value="merchant">
            <form onSubmit={handleMerchantSubmit}>
              <Card className="p-4 sm:p-6">
                <h2 className="text-xl font-semibold mb-6 flex items-center">
                  <Building2 className="w-5 h-5 mr-2 text-primary" />
                  Merchant Information
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="legal_name">Legal Entity Name</Label>
                    <Input
                      id="legal_name"
                      value={merchantForm.legal_name}
                      onChange={(e) => setMerchantForm({ ...merchantForm, legal_name: e.target.value })}
                      placeholder="VISHALBHAI MULJIBHAI GOHIL"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="founded_year">Founded Year</Label>
                      <Input
                        id="founded_year"
                        value={merchantForm.founded_year || ""}
                        onChange={(e) => setMerchantForm({ ...merchantForm, founded_year: e.target.value })}
                        placeholder="2025"
                      />
                    </div>
                    <div>
                      <Label htmlFor="business_type">Business Type</Label>
                      <Input
                        id="business_type"
                        value={merchantForm.business_type || ""}
                        onChange={(e) => setMerchantForm({ ...merchantForm, business_type: e.target.value })}
                        placeholder={`${BRAND_CONFIG.name} – Remote Jobs Platform`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="udyam_registration">UDYAM Registration</Label>
                      <Input
                        id="udyam_registration"
                        value={merchantForm.udyam_registration || ""}
                        onChange={(e) => setMerchantForm({ ...merchantForm, udyam_registration: e.target.value })}
                        placeholder="UDYAM-GJ-18-0022888"
                      />
                    </div>
                    <div>
                      <Label htmlFor="iec_code">IEC Code</Label>
                      <Input
                        id="iec_code"
                        value={merchantForm.iec_code || ""}
                        onChange={(e) => setMerchantForm({ ...merchantForm, iec_code: e.target.value })}
                        placeholder="EBGPG4522J"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="contact_number">Contact Number</Label>
                      <Input
                        id="contact_number"
                        value={merchantForm.contact_number}
                        onChange={(e) => setMerchantForm({ ...merchantForm, contact_number: e.target.value })}
                        placeholder="+91 9904923067"
                      />
                    </div>
                    <div>
                      <Label htmlFor="merchant_email">Official Email</Label>
                      <Input
                        id="merchant_email"
                        type="email"
                        value={merchantForm.email}
                        onChange={(e) => setMerchantForm({ ...merchantForm, email: e.target.value })}
                        placeholder="business@example.com"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="registered_address">Registered Address (Headquarters)</Label>
                    <Textarea
                      id="registered_address"
                      value={merchantForm.registered_address}
                      onChange={(e) => setMerchantForm({ ...merchantForm, registered_address: e.target.value })}
                      placeholder="Panchasar, Gujarat, India"
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label htmlFor="operational_address">Operational Address</Label>
                    <Textarea
                      id="operational_address"
                      value={merchantForm.operational_address}
                      onChange={(e) => setMerchantForm({ ...merchantForm, operational_address: e.target.value })}
                      placeholder="Enter operational address"
                      rows={3}
                    />
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <Button type="submit" disabled={updateMerchant.isPending} className="flex-1">
                    <Save className="w-4 h-4 mr-2" />
                    {updateMerchant.isPending ? "Saving..." : "Save Merchant Info"}
                  </Button>
                </div>
              </Card>
            </form>
          </TabsContent>

          <TabsContent value="social">
            <form onSubmit={handleSubmit}>
              <Card className="p-4 sm:p-6">
                <h2 className="text-xl font-semibold mb-6 flex items-center">
                  <Settings className="w-5 h-5 mr-2 text-primary" />
                  Social Media Links
                </h2>
                
                <div className="space-y-6">
                  {socialPlatforms.map((platform) => (
                    <div key={platform.name} className="border border-border/50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <platform.icon className={`w-5 h-5 ${platform.color}`} />
                        <h3 className="font-medium text-foreground">{platform.name}</h3>
                      </div>
                      
                      <div className="space-y-3">
                        <div>
                          <Label htmlFor={platform.urlField}>URL</Label>
                          <Input
                            id={platform.urlField}
                            type="url"
                            placeholder={platform.placeholder}
                            value={formData[platform.urlField]}
                            onChange={(e) => handleChange(platform.urlField, e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor={platform.handleField}>Display Handle/Name</Label>
                          <Input
                            id={platform.handleField}
                            type="text"
                            placeholder={`e.g., @your_handle or Your Page Name`}
                            value={formData[platform.handleField]}
                            onChange={(e) => handleChange(platform.handleField, e.target.value)}
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex gap-3">
                  <Button type="submit" disabled={updateSocialLinks.isPending} className="flex-1">
                    <Save className="w-4 h-4 mr-2" />
                    {updateSocialLinks.isPending ? "Saving..." : "Save Social Links"}
                  </Button>
                </div>
              </Card>
            </form>
          </TabsContent>
          <TabsContent value="auth-images">
            <AuthImageSettings />
          </TabsContent>
          <TabsContent value="apps">
            <AdminAppSettingsPanel />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminSettings;
