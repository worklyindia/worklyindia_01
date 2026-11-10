import { useState } from "react";
import { Flag, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";

interface ReportJobDialogProps {
  jobId: string;
  jobTitle: string;
  className?: string;
}

const ReportJobDialog = ({ jobId, jobTitle, className = "" }: ReportJobDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [reportType, setReportType] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reportTypes = [
    { id: "fraud", label: "Fraudulent job posting" },
    { id: "fake", label: "Fake company" },
    { id: "spam", label: "Spam/Irrelevant content" },
    { id: "inappropriate", label: "Inappropriate content" },
    { id: "misleading", label: "Misleading information" },
    { id: "other", label: "Other" }
  ];

  const handleSubmit = async () => {
    if (!reportType) {
      toast.error("Please select a report reason");
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Here you would typically send the report to your backend
      // For now, we'll just simulate a successful report
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast.success("Report submitted successfully");
      setIsOpen(false);
      setReportType("");
      setDescription("");
    } catch (error) {
      toast.error("Failed to submit report");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className={`bg-red-50 hover:bg-red-100 border-red-200 text-red-700 ${className}`}>
          <Flag className="w-4 h-4 mr-2" />
          Report
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto [&>button]:hidden">
        <SheetHeader>
          <div className="flex items-start justify-between mb-4">
            <SheetTitle className="text-left text-lg font-medium">Report Job</SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="h-8 w-8 -mr-2"
            >
              <ChevronDown className="h-5 w-5" />
            </Button>
          </div>
        </SheetHeader>
        
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Why are you reporting this job?</Label>
            <RadioGroup value={reportType} onValueChange={setReportType} className="mt-2">
              {reportTypes.map((type) => (
                <div key={type.id} className="flex items-center space-x-2">
                  <RadioGroupItem value={type.id} id={type.id} />
                  <Label htmlFor={type.id} className="text-sm">{type.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          
          <div>
            <Label htmlFor="description" className="text-sm font-medium">
              Additional details (optional)
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide any additional information about this report..."
              className="mt-1"
              rows={3}
            />
          </div>
          
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              onClick={() => setIsOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? "Submitting..." : "Submit Report"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ReportJobDialog;