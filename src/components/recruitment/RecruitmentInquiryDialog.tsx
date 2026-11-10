import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface RecruitmentInquiryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inquiryType: 'demo' | 'contact_sales' | 'get_started' | 'case_study' | 'learn_more';
  title?: string;
  description?: string;
}

export const RecruitmentInquiryDialog = ({
  open,
  onOpenChange,
  inquiryType,
  title,
  description
}: RecruitmentInquiryDialogProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company_name: '',
    message: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('recruitment_inquiries')
        .insert({
          ...formData,
          inquiry_type: inquiryType,
          user_id: user?.id || null
        });

      if (error) throw error;

      toast.success("Inquiry submitted successfully!", {
        description: "Our team will contact you within 24 hours."
      });

      setFormData({
        name: '',
        email: '',
        phone: '',
        company_name: '',
        message: ''
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Error submitting inquiry:', error);
      toast.error("Failed to submit inquiry", {
        description: "Please try again later."
      });
    } finally {
      setLoading(false);
    }
  };

  const getTitleText = () => {
    if (title) return title;
    switch (inquiryType) {
      case 'demo': return 'Schedule a Demo';
      case 'contact_sales': return 'Contact Sales Team';
      case 'get_started': return 'Get Started with Recruitment Solutions';
      case 'case_study': return 'Request Case Studies';
      case 'learn_more': return 'Learn More About This Solution';
      default: return 'Contact Us';
    }
  };

  const getDescriptionText = () => {
    if (description) return description;
    switch (inquiryType) {
      case 'demo': return 'Schedule a personalized demo to see how our recruitment solutions can help your business.';
      case 'contact_sales': return 'Our sales team will get in touch with you to discuss your recruitment needs.';
      case 'get_started': return 'Fill out the form below and we\'ll help you get started with our recruitment solutions.';
      case 'case_study': return 'Get detailed case studies showing how we\'ve helped companies like yours.';
      case 'learn_more': return 'Tell us more about your needs and we\'ll provide detailed information.';
      default: return 'Fill out the form and we\'ll get back to you soon.';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{getTitleText()}</DialogTitle>
          <DialogDescription>{getDescriptionText()}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter your full name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="your.email@company.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+91 98765 43210"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company">Company Name</Label>
            <Input
              id="company"
              value={formData.company_name}
              onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
              placeholder="Your company name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message *</Label>
            <Textarea
              id="message"
              required
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Tell us about your recruitment needs..."
              rows={4}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Submit Inquiry
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
