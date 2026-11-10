import { useState } from "react";
import { Lightbulb, CheckCircle, AlertCircle, Shield, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface JobTipsDialogProps {
  className?: string;
}

const JobTipsDialog = ({ className = "" }: JobTipsDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const applicationTips = [
    "Read the job description carefully and tailor your application",
    "Highlight relevant skills and experience in your resume",
    "Write a personalized cover letter for each application",
    "Follow up politely after submitting your application",
    "Prepare for common interview questions",
    "Research the company before applying"
  ];

  const safetyTips = [
    "Never pay money for job applications or interviews",
    "Verify company details and legitimacy before applying",
    "Be cautious of jobs promising unrealistic salaries",
    "Don't share personal documents in initial conversations",
    "Meet in public places for face-to-face interviews",
    "Trust your instincts if something feels wrong"
  ];

  const successTips = [
    "Keep your profile updated with latest skills",
    "Apply to jobs that match your experience level",
    "Follow up professionally after interviews",
    "Build a strong professional network",
    "Continuously learn new skills in your field",
    "Be patient and persistent in your job search"
  ];

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className={`bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700 ${className}`}>
          <Lightbulb className="w-4 h-4 mr-2" />
          Tips
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto [&>button]:hidden">
        <SheetHeader>
          <div className="flex items-start justify-between mb-4">
            <SheetTitle className="text-left text-lg font-medium">Job Application Tips</SheetTitle>
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
        
        <Tabs defaultValue="application" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="application">Application</TabsTrigger>
            <TabsTrigger value="safety">Safety</TabsTrigger>
            <TabsTrigger value="success">Success</TabsTrigger>
          </TabsList>
          
          <TabsContent value="application" className="space-y-4">
            <div className="flex items-center space-x-2 mb-4">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <h3 className="font-medium">Application Tips</h3>
            </div>
            <div className="space-y-3">
              {applicationTips.map((tip, index) => (
                <div key={index} className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2 shrink-0" />
                  <p className="text-sm text-muted-foreground">{tip}</p>
                </div>
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="safety" className="space-y-4">
            <div className="flex items-center space-x-2 mb-4">
              <Shield className="w-5 h-5 text-red-600" />
              <h3 className="font-medium">Safety Tips</h3>
            </div>
            <div className="space-y-3">
              {safetyTips.map((tip, index) => (
                <div key={index} className="flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-1 shrink-0" />
                  <p className="text-sm text-muted-foreground">{tip}</p>
                </div>
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="success" className="space-y-4">
            <div className="flex items-center space-x-2 mb-4">
              <Lightbulb className="w-5 h-5 text-blue-600" />
              <h3 className="font-medium">Success Tips</h3>
            </div>
            <div className="space-y-3">
              {successTips.map((tip, index) => (
                <div key={index} className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 shrink-0" />
                  <p className="text-sm text-muted-foreground">{tip}</p>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};

export default JobTipsDialog;