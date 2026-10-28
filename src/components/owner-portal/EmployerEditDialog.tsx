import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Shield } from "lucide-react";
import { toast } from "sonner";
import { useEmployerManagement } from "@/hooks/useEmployerManagement";

interface EmployerEditDialogProps {
  employer: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

export function EmployerEditDialog({ employer, open, onOpenChange, onSave }: EmployerEditDialogProps) {
  const { updateEmployerProfile, updateEmployerVerification } = useEmployerManagement();
  const [formData, setFormData] = useState({
    company_name: "",
    email: "",
    phone: "",
    location: "",
    industry: "",
    company_size: "",
    website: "",
    description: ""
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (employer) {
      setFormData({
        company_name: employer.company_name || "",
        email: employer.email || "",
        phone: employer.phone || "",
        location: employer.location || "",
        industry: employer.industry || "",
        company_size: employer.company_size || "",
        website: employer.website || "",
        description: employer.description || ""
      });
    }
  }, [employer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.company_name.trim()) {
      toast.error("Company name is required");
      return;
    }

    setLoading(true);
    try {
      await updateEmployerProfile(employer.user_id, formData);
      toast.success("Company profile updated successfully");
      onSave();
    } catch (error) {
      console.error("Error updating employer:", error);
      toast.error("Failed to update company profile");
    } finally {
      setLoading(false);
    }
  };

  const toggleVerification = async () => {
    setLoading(true);
    try {
      await updateEmployerVerification(
        employer.user_id, 
        !employer.is_verified, 
        employer.is_verified ? undefined : 'gold'
      );
      toast.success(`Company ${!employer.is_verified ? 'verified' : 'unverified'} successfully`);
      onSave();
    } catch (error) {
      console.error("Error updating verification:", error);
      toast.error("Failed to update verification status");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Edit Company Profile
            <div className="flex items-center gap-2">
              {employer?.is_verified ? (
                <Badge variant="default" className="text-green-700 border-green-700">
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  Verified
                </Badge>
              ) : (
                <Badge variant="outline" className="text-gray-600">
                  <Shield className="w-3 h-3 mr-1" />
                  Not Verified
                </Badge>
              )}
              <Button
                type="button"
                variant={employer?.is_verified ? "outline" : "default"}
                size="sm"
                onClick={toggleVerification}
                disabled={loading}
              >
                {employer?.is_verified ? "Unverify" : "Verify"}
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name *</Label>
              <Input
                id="company_name"
                value={formData.company_name}
                onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Select
                value={formData.industry}
                onValueChange={(value) => setFormData(prev => ({ ...prev, industry: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IT">Information Technology</SelectItem>
                  <SelectItem value="Finance">Finance & Banking</SelectItem>
                  <SelectItem value="Healthcare">Healthcare</SelectItem>
                  <SelectItem value="Education">Education</SelectItem>
                  <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                  <SelectItem value="Retail">Retail & E-commerce</SelectItem>
                  <SelectItem value="Consulting">Consulting</SelectItem>
                  <SelectItem value="Real Estate">Real Estate</SelectItem>
                  <SelectItem value="Automotive">Automotive</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_size">Company Size</Label>
              <Select
                value={formData.company_size}
                onValueChange={(value) => setFormData(prev => ({ ...prev, company_size: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select company size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1-10">1-10 employees</SelectItem>
                  <SelectItem value="11-50">11-50 employees</SelectItem>
                  <SelectItem value="51-200">51-200 employees</SelectItem>
                  <SelectItem value="201-1000">201-1000 employees</SelectItem>
                  <SelectItem value="1000+">1000+ employees</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              type="url"
              value={formData.website}
              onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
              placeholder="https://example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Company Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={4}
              placeholder="Brief description about the company..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}