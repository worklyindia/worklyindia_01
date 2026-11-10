import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Shield, FileText, Send, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";
import SEO from "@/components/SEO";
import PageHeader from "@/components/PageHeader";
import BottomNavigation from "@/components/BottomNavigation";
import { useContactInfo } from "@/hooks/useContactInfo";

const ReportJobScam = () => {
  const navigate = useNavigate();
  const { data: fraudContact } = useContactInfo('fraud');
  const [reportType, setReportType] = useState("");
  const [jobId, setJobId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [reporterName, setReporterName] = useState("");
  const [reporterEmail, setReporterEmail] = useState("");
  const [reporterPhone, setReporterPhone] = useState("");
  const [description, setDescription] = useState("");
  const [evidence, setEvidence] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!agreeToTerms) {
      toast({
        title: "Terms Required",
        description: "Please agree to the terms and conditions before submitting.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    toast({
      title: "Report Submitted Successfully",
      description: "Your report has been received. We'll investigate and take appropriate action within 24-48 hours.",
    });
    
    setIsSubmitting(false);
    
    // Reset form
    setReportType("");
    setJobId("");
    setCompanyName("");
    setReporterName("");
    setReporterEmail("");
    setReporterPhone("");
    setDescription("");
    setEvidence("");
    setIsAnonymous(false);
    setAgreeToTerms(false);
  };

  return (
    <>
      <SEO 
        title="Report Job Scam - Workly India"
        description="Report fraudulent job postings, scams, and suspicious activities. Help us maintain a safe and trustworthy job platform for everyone."
        keywords="report job scam, fraud reporting, fake jobs, job safety, scam prevention, Workly India security"
      />
      
      <div className="min-h-screen bg-background">
        <PageHeader title="Report Job Scam" />
        
        <main className="container mx-auto px-4 py-6 pb-24 md:pb-8 max-w-4xl">
          {/* Header Section */}
          <div className="text-center mb-12">
            <Badge variant="secondary" className="mb-4">Security</Badge>
            <h1 className="text-4xl font-bold text-foreground mb-4">
              Report Job Scam
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Help us maintain a safe and trustworthy platform by reporting suspicious job postings, scams, or fraudulent activities.
            </p>
          </div>

          {/* Introduction */}
          <Card className="p-6 bg-gradient-to-br from-white to-gray-50 border border-border/50 mb-8">
            <div className="prose prose-sm max-w-none text-muted-foreground space-y-4">
              <p>
                <strong>Report Fraudulent Job Postings</strong>
              </p>
              <p>
                Help us maintain a safe and trustworthy platform by reporting suspicious job postings, 
                scams, or fraudulent activities. Your report helps protect other job seekers from potential fraud.
              </p>
              <div className="mt-4 p-4 bg-destructive/5 rounded-lg border border-destructive/20">
                <p className="text-sm text-destructive font-medium">
                  <AlertTriangle className="w-4 h-4 inline mr-2" />
                  All reports are investigated within 24-48 hours
                </p>
              </div>
            </div>
          </Card>

          <div className="space-y-8">

            {/* Common Scam Types */}
            <Card className="p-6">
              <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-primary" />
                Common Job Scam Types
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                  <h4 className="font-medium text-foreground mb-2 text-destructive">Payment Scams</h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• Asking for registration fees</li>
                    <li>• Demanding security deposits</li>
                    <li>• Requesting money for training</li>
                    <li>• Processing fee demands</li>
                  </ul>
                </div>
                
                <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                  <h4 className="font-medium text-foreground mb-2 text-destructive">Identity Theft</h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• Requesting bank details</li>
                    <li>• Asking for Aadhaar/PAN copies</li>
                    <li>• Demanding passport details</li>
                    <li>• Seeking personal documents</li>
                  </ul>
                </div>
                
                <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                  <h4 className="font-medium text-foreground mb-2 text-destructive">Fake Companies</h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• Non-existent company addresses</li>
                    <li>• Fake contact information</li>
                    <li>• Impersonating legitimate companies</li>
                    <li>• No proper registration details</li>
                  </ul>
                </div>
                
                <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                  <h4 className="font-medium text-foreground mb-2 text-destructive">Workly India Scams</h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• Unrealistic salary promises</li>
                    <li>• No clear job description</li>
                    <li>• Pyramid/MLM schemes</li>
                    <li>• Data entry scams</li>
                  </ul>
                </div>
              </div>
            </Card>

            {/* Report Form */}
            <Card className="p-6">
              <h3 className="text-xl font-semibold text-foreground mb-6 flex items-center">
                <Send className="w-5 h-5 mr-2 text-primary" />
                Submit Report
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Report Type */}
                <div>
                  <Label htmlFor="reportType">Type of Report *</Label>
                  <Select value={reportType} onValueChange={setReportType} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select report type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fake-job">Fake Job Posting</SelectItem>
                      <SelectItem value="payment-scam">Payment/Fee Scam</SelectItem>
                      <SelectItem value="identity-theft">Identity Theft Attempt</SelectItem>
                      <SelectItem value="fake-company">Fake Company</SelectItem>
                      <SelectItem value="pyramid-scheme">Pyramid/MLM Scheme</SelectItem>
                      <SelectItem value="inappropriate-content">Inappropriate Content</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Job/Company Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="jobId">Job ID (if applicable)</Label>
                    <Input
                      id="jobId"
                      value={jobId}
                      onChange={(e) => setJobId(e.target.value)}
                      placeholder="Enter job ID"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="companyName">Company Name *</Label>
                    <Input
                      id="companyName"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Enter company name"
                      required
                    />
                  </div>
                </div>

                {/* Reporter Details */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="anonymous"
                      checked={isAnonymous}
                      onCheckedChange={(checked) => setIsAnonymous(checked === true)}
                    />
                    <Label htmlFor="anonymous" className="text-sm">
                      Submit this report anonymously
                    </Label>
                  </div>
                  
                  {!isAnonymous && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="reporterName">Your Name *</Label>
                        <Input
                          id="reporterName"
                          value={reporterName}
                          onChange={(e) => setReporterName(e.target.value)}
                          placeholder="Your full name"
                          required={!isAnonymous}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="reporterEmail">Your Email *</Label>
                        <Input
                          id="reporterEmail"
                          type="email"
                          value={reporterEmail}
                          onChange={(e) => setReporterEmail(e.target.value)}
                          placeholder="your.email@example.com"
                          required={!isAnonymous}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="reporterPhone">Your Phone</Label>
                        <Input
                          id="reporterPhone"
                          value={reporterPhone}
                          onChange={(e) => setReporterPhone(e.target.value)}
                          placeholder="Your phone number"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Description */}
                <div>
                  <Label htmlFor="description">Detailed Description *</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Please provide detailed information about the scam or fraudulent activity..."
                    className="min-h-32"
                    required
                  />
                </div>

                {/* Evidence */}
                <div>
                  <Label htmlFor="evidence">Evidence/Supporting Information</Label>
                  <Textarea
                    id="evidence"
                    value={evidence}
                    onChange={(e) => setEvidence(e.target.value)}
                    placeholder="Provide any supporting evidence like screenshots descriptions, email content, phone numbers, etc."
                    className="min-h-24"
                  />
                </div>

                {/* Terms Agreement */}
                <div className="flex items-start space-x-2">
                  <Checkbox 
                    id="terms"
                    checked={agreeToTerms}
                    onCheckedChange={(checked) => setAgreeToTerms(checked === true)}
                    required
                  />
                  <Label htmlFor="terms" className="text-sm leading-relaxed">
                    I confirm that the information provided is true to the best of my knowledge and 
                    I agree to the terms and conditions of this reporting system. I understand that 
                    false reporting may result in legal action.
                  </Label>
                </div>

                {/* Submit Button */}
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>Submitting Report...</>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Submit Report
                    </>
                  )}
                </Button>
              </form>
            </Card>

            {/* After Reporting */}
            <Card className="p-6">
              <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center">
                <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
                What Happens After Reporting?
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium">1</div>
                    <div>
                      <h4 className="font-medium text-foreground">Immediate Review</h4>
                      <p className="text-sm text-muted-foreground">Our security team reviews your report within 2 hours</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium">2</div>
                    <div>
                      <h4 className="font-medium text-foreground">Investigation</h4>
                      <p className="text-sm text-muted-foreground">Detailed investigation conducted within 24-48 hours</p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium">3</div>
                    <div>
                      <h4 className="font-medium text-foreground">Action Taken</h4>
                      <p className="text-sm text-muted-foreground">Suspicious accounts/jobs are suspended or removed</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium">4</div>
                    <div>
                      <h4 className="font-medium text-foreground">Follow-up</h4>
                      <p className="text-sm text-muted-foreground">You receive an update on the action taken (if not anonymous)</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Emergency Contact */}
            <Card className="p-6 bg-destructive/5 border-destructive/20">
              <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center text-destructive">
                <AlertTriangle className="w-5 h-5 mr-2" />
                Emergency Contact
              </h3>
              <p className="text-muted-foreground mb-4">
                If you're currently being scammed or have lost money to a fraudulent job posting, 
                please contact us immediately:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-card rounded-lg">
                  <h4 className="font-medium text-foreground mb-2">24/7 Fraud Helpline</h4>
                  <p className="text-sm text-muted-foreground">Phone: <a href={`tel:${fraudContact?.phone || '+919904923067-FRAUD-HELP'}`} className="text-primary hover:underline">{fraudContact?.phone || '+91 9904923067-FRAUD-HELP'}</a></p>
                  <p className="text-sm text-muted-foreground">Email: <a href={`mailto:${fraudContact?.email || 'worklyindia@outlook.com'}`} className="text-primary hover:underline">{fraudContact?.email || 'worklyindia@outlook.com'}</a></p>
                </div>
                
                <div className="p-4 bg-card rounded-lg">
                  <h4 className="font-medium text-foreground mb-2">Cybercrime Portal</h4>
                  <p className="text-sm text-muted-foreground">Report to: {fraudContact?.additional_info?.cybercrime_portal || 'cybercrime.gov.in'}</p>
                  <p className="text-sm text-muted-foreground">Police Helpline: {fraudContact?.additional_info?.police_helpline || '1930'}</p>
                </div>
              </div>
            </Card>
          </div>
        </main>
        
        <BottomNavigation />
      </div>
    </>
  );
};

export default ReportJobScam;