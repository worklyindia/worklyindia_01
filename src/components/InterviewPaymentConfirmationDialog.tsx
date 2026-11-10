import React, { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { PaymentPageHeader } from "@/components/PaymentPageHeader";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CreditCard, Loader2, Calendar, Clock, Users } from "lucide-react";
import { payWithRazorpay } from "@/lib/razorpayJobPayment";
import { useInterviewPricing } from "@/hooks/useInterviewPricing";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface InterviewPaymentConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  interviewData: {
    jobTitle: string;
    candidateNames: string[];
    scheduledAt: string;
    scheduledEndAt?: string;
    mode: string;
    locationUrl?: string;
    notes?: string;
    videoPlatform?: string | null;
    youtubeStreamKey?: string | null;
    youtubeStreamUrl?: string | null;
  };
  applicants: Array<{ applicantId: string; jobId: string }>;
  onSuccess?: () => void;
}

export const InterviewPaymentConfirmationDialog: React.FC<InterviewPaymentConfirmationDialogProps> = ({
  open,
  onOpenChange,
  interviewData,
  applicants,
  onSuccess
}) => {
  const [processing, setProcessing] = useState(false);
  const { pointsPerInterview, pointsPerMinute, calculateInterviewCost } = useInterviewPricing();

  const totalCandidates = applicants.length;
  
  // Calculate duration in minutes
  const scheduledDate = new Date(interviewData.scheduledAt);
  const scheduledEndDate = interviewData.scheduledEndAt 
    ? new Date(interviewData.scheduledEndAt) 
    : scheduledDate;
  const durationMs = scheduledEndDate.getTime() - scheduledDate.getTime();
  const durationMinutes = Math.max(1, Math.ceil(durationMs / 60000));

  // Get detailed pricing breakdown with mode
  const pricingBreakdown = calculateInterviewCost(
    totalCandidates, 
    durationMinutes,
    interviewData.mode
  );
  
  const totalPoints = pricingBreakdown.total;

  const handleConfirmPayment = async () => {
    setProcessing(true);
    try {
      const result = await payWithRazorpay({
        purpose: 'interview',
        description: `Interview scheduling (${totalCandidates})`,
        interview: {
          applicants,
          scheduledAt: interviewData.scheduledAt,
          scheduledEndAt: interviewData.scheduledEndAt,
          mode: interviewData.mode,
          locationUrl: interviewData.locationUrl,
          notes: interviewData.notes,
          videoPlatform: interviewData.videoPlatform,
          youtubeStreamKey: interviewData.youtubeStreamKey,
          youtubeStreamUrl: interviewData.youtubeStreamUrl,
        },
      });
      if (result.cancelled) return;
      if (!result.success) throw new Error(result.error || 'Payment failed');
      toast.success(`Payment successful — ${result.data?.scheduled_count ?? totalCandidates} interview(s) scheduled`);
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Interview payment error:', error);
      toast.error(error.message || "An error occurred while scheduling");
    } finally {
      setProcessing(false);
    }
  };

  const getModeLabel = () => {
    switch (interviewData.mode) {
      case 'online': return 'Online (Video Call)';
      case 'phone': return 'Phone Call';
      case 'in_person': return 'In Person';
      
      case 'videosdk_iframe': return 'VideoSDK Meeting';
      case '100ms_iframe': return '100ms Meeting';
      default: return interviewData.mode;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent fullPage hideClose className="z-[60]">
        <PaymentPageHeader
          onBack={() => onOpenChange(false)}
          subtitle="Interview scheduling"
        />

        <div className="space-y-4">
          {/* Job Details */}
          <div className="bg-muted/30 rounded-lg p-3">
            <h4 className="font-medium text-sm text-foreground mb-1">Job Position:</h4>
            <p className="text-sm text-muted-foreground">{interviewData.jobTitle}</p>
          </div>

          {/* Candidates */}
          <div className="bg-muted/30 rounded-lg p-3">
            <h4 className="font-medium text-sm text-foreground mb-2 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Candidates ({totalCandidates}):
            </h4>
            <div className="space-y-1 text-sm text-muted-foreground">
              {interviewData.candidateNames.map((name, index) => (
                <div key={index}>• {name}</div>
              ))}
            </div>
          </div>

          {/* Interview Details */}
          <div className="bg-muted/30 rounded-lg p-3">
            <h4 className="font-medium text-sm text-foreground mb-2">Interview Details:</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date:</span>
                <span>{format(scheduledDate, "PPP")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Time:</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {format(scheduledDate, "p")}
                  {interviewData.scheduledEndAt && ` - ${format(new Date(interviewData.scheduledEndAt), "p")}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mode:</span>
                <span>{getModeLabel()}</span>
              </div>
              {interviewData.locationUrl && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Location:</span>
                  <span className="text-xs truncate max-w-[200px]">{interviewData.locationUrl}</span>
                </div>
              )}
            </div>
          </div>

          {/* Payment Details */}
          <div className="bg-muted/30 rounded-lg p-3">
            <h4 className="font-medium text-sm text-foreground mb-2 flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Payment Details
            </h4>
            
            <div className="space-y-2 text-sm mb-3">
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground font-medium">Cost per Interview:</span>
                <span className="font-semibold text-lg">₹{pointsPerInterview}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground font-medium">Number of Interviews:</span>
                <span className="font-semibold text-lg">{totalCandidates}</span>
              </div>
              {pricingBreakdown.durationCharge > 0 && (
                <div className="flex justify-between items-center py-1">
                  <span className="text-muted-foreground">Duration Charge:</span>
                  <span>{durationMinutes} min × ₹{pointsPerMinute} = ₹{pricingBreakdown.durationCharge}</span>
                </div>
              )}
              
              <div className="h-px bg-border my-2"></div>
              <div className="flex justify-between items-center font-bold text-primary bg-primary/5 p-3 rounded-lg">
                <span className="text-base">Total Cost:</span>
                <span className="text-xl">₹{totalPoints}</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">Secure payment via Razorpay</p>
          </div>

          {/* Auto-termination warning for Daily.co */}
          {interviewData.mode === 'dailyco' && interviewData.scheduledEndAt && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <h4 className="font-medium text-sm text-amber-800 dark:text-amber-400 mb-1 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                ⏱️ Meeting Time Limit:
              </h4>
              <p className="text-xs text-amber-700 dark:text-amber-500">
                Meeting will automatically end at <strong>{format(new Date(interviewData.scheduledEndAt), "p")}</strong>.
                Daily.co will terminate the session to prevent overages. Users will be ejected from the meeting.
              </p>
            </div>
          )}

          {/* Benefits reminder */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
            <h4 className="font-medium text-sm text-primary mb-1">📅 What happens next:</h4>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              <li>• Interviews will be scheduled immediately</li>
              <li>• Candidates will receive notifications</li>
              <li>• You'll see all interviews in your dashboard</li>
              <li>• Your Razorpay receipt is saved in payment history</li>
            </ul>
          </div>

          {/* Action buttons */}
          <div className="flex space-x-3 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={processing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmPayment}
              disabled={processing}
              className="flex-1"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                `Pay ₹${totalPoints} & Schedule`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
