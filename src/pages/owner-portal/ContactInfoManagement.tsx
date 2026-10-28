import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Phone, MapPin, AlertCircle, Save } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ContactInfo {
  id: string;
  info_type: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  additional_info: any;
}

const ContactInfoManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingType, setEditingType] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<ContactInfo>>({});

  const { data: contactInfos, isLoading } = useQuery({
    queryKey: ["contact-information"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_information")
        .select("*")
        .order("info_type");
      
      if (error) throw error;
      return data as ContactInfo[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<ContactInfo>) => {
      const { error } = await supabase
        .from("contact_information")
        .update({
          email: data.email,
          phone: data.phone,
          address: data.address,
          additional_info: data.additional_info,
        })
        .eq("id", data.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-information"] });
      toast({
        title: "Success",
        description: "Contact information updated successfully",
      });
      setEditingType(null);
      setFormData({});
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleEdit = (info: ContactInfo) => {
    setEditingType(info.info_type);
    setFormData({
      ...info,
      additional_info: typeof info.additional_info === 'object' 
        ? JSON.stringify(info.additional_info, null, 2) 
        : info.additional_info
    });
  };

  const handleCancel = () => {
    setEditingType(null);
    setFormData({});
  };

  const handleSave = () => {
    if (formData.id) {
      const dataToSave = {
        ...formData,
        additional_info: typeof formData.additional_info === 'string' && formData.additional_info
          ? JSON.parse(formData.additional_info)
          : formData.additional_info
      };
      updateMutation.mutate(dataToSave);
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      general: "General Contact",
      legal: "Legal Contact",
      support: "Support Contact",
      fraud: "Fraud Reporting",
    };
    return labels[type] || type;
  };

  const getTypeDescription = (type: string) => {
    const descriptions: Record<string, string> = {
      general: "Used in Contact Us page and footer",
      legal: "Used in Terms & Conditions, Privacy Policy, Refund & Cancellation",
      support: "Used in Help & Support sections",
      fraud: "Used in Report Job Scam page",
    };
    return descriptions[type] || "";
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Contact Information Management</h1>
        <p className="text-muted-foreground">
          Update contact details that appear across all pages (Terms, Privacy Policy, Contact Us, etc.)
        </p>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Changes here will automatically reflect on all pages including Terms & Conditions, Privacy Policy, 
          Refund & Cancellation, Disclaimer, Report Job Scam, and Points Policy.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6">
        {contactInfos?.map((info) => (
          <Card key={info.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{getTypeLabel(info.info_type)}</span>
                {editingType === info.info_type ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancel}
                      disabled={updateMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={updateMutation.isPending}
                    >
                      {updateMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Save
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(info)}
                  >
                    Edit
                  </Button>
                )}
              </CardTitle>
              <CardDescription>{getTypeDescription(info.info_type)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {editingType === info.info_type ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor={`email-${info.info_type}`} className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Email
                    </Label>
                    <Input
                      id={`email-${info.info_type}`}
                      type="email"
                      value={formData.email || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      placeholder="contact@example.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`phone-${info.info_type}`} className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      Phone
                    </Label>
                    <Input
                      id={`phone-${info.info_type}`}
                      type="tel"
                      value={formData.phone || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      placeholder="+91 1234567890"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`address-${info.info_type}`} className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Address
                    </Label>
                    <Textarea
                      id={`address-${info.info_type}`}
                      value={formData.address || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, address: e.target.value })
                      }
                      placeholder="Enter full address"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`additional-${info.info_type}`}>
                      Additional Information (Optional)
                    </Label>
                    <Textarea
                      id={`additional-${info.info_type}`}
                      value={formData.additional_info || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, additional_info: e.target.value })
                      }
                      placeholder="Any additional details"
                      rows={2}
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  {info.email && (
                    <div className="flex items-start gap-2">
                      <Mail className="w-4 h-4 mt-1 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Email</p>
                        <p className="text-sm text-muted-foreground">{info.email}</p>
                      </div>
                    </div>
                  )}
                  {info.phone && (
                    <div className="flex items-start gap-2">
                      <Phone className="w-4 h-4 mt-1 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Phone</p>
                        <p className="text-sm text-muted-foreground">{info.phone}</p>
                      </div>
                    </div>
                  )}
                  {info.address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 mt-1 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Address</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-line">
                          {info.address}
                        </p>
                      </div>
                    </div>
                  )}
                  {info.additional_info && (
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 mt-1 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Additional Info</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-line">
                          {typeof info.additional_info === 'object' 
                            ? JSON.stringify(info.additional_info, null, 2)
                            : info.additional_info}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ContactInfoManagement;
