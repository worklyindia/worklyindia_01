import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Star, Clock, CheckCircle, X, Crown } from "lucide-react";
import { useEmployerAuth } from "@/contexts/EmployerAuthContext";
import { supabase } from "@/integrations/supabase/client";
import VerificationBadgeDialog from "./VerificationBadgeDialog";
import VerificationBadge from "./VerificationBadge";
import { useVerificationPackages } from "@/hooks/useVerificationPackages";
import { useToast } from "@/hooks/use-toast";

const VerificationSection = () => {
  const { user, company, updateCompany, refreshCompany } = useEmployerAuth();
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const { packages } = useVerificationPackages();
  const { toast } = useToast();

  // NO REAL-TIME SUBSCRIPTION - This was causing page refresh during Razorpay payment

  // Check if company is currently verified and not expired
  const isVerified = company?.is_verified && 
    company?.verified_plan_end && 
    new Date(company.verified_plan_end) > new Date();

  // Check if this is a lifetime verified account (year >= 2099 means lifetime)
  // No email-based check - lifetime is determined purely by verified_plan_end date
  const isLifetimeVerified = company?.is_verified && 
    company?.verified_plan_end &&
    new Date(company.verified_plan_end).getFullYear() >= 2099;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getDaysLeft = (endDate: string) => {
    const now = new Date();
    const end = new Date(endDate);
    
    // Return "Never expires" for lifetime verification
    if (end.getFullYear() >= 2099) {
      return "Never expires";
    }
    
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const handlePurchaseSuccess = async () => {
    // Properly refresh company data from database - NO page reload needed
    setShowPurchaseDialog(false);
    
    // Fetch fresh company data to get updated verification status
    await refreshCompany();
    
    toast({
      title: "✅ Verification Activated",
      description: "Your company is now verified!",
      duration: 3000,
    });
  };

  const handleCancelVerification = async () => {
    setLoading(true);
    
    try {
      const { error } = await supabase
        .from('companies')
        .update({
          is_verified: false,
          verified_plan_start: null,
          verified_plan_end: null,
          badge_color: null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user?.id);

      if (error) throw error;

      setShowCancelDialog(false);
      
      // Simply refresh company data - NO page reload needed
      await updateCompany({});
      
      toast({
        title: "✅ Verification Cancelled",
        description: "Your company verification has been removed.",
        duration: 3000,
      });

      // Send push notification (non-blocking)
      supabase.functions.invoke('email-api', {
        body: {
          action: 'send_push',
          user_id: user?.id,
          audience: 'employer',
          skip_rephrase: true,
          title: '❌ Verification Cancelled',
          message: 'Your company verification has been successfully cancelled.',
          action_url: '/employer-portal'
        }
      }).catch(() => {});
      
    } catch (error) {
      console.error('Error cancelling verification:', error);
      toast({
        title: "❌ Cancellation Failed",
        description: "Failed to cancel verification. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!company) {
    return null;
  }

  return (
    <Card className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-yellow-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5 text-orange-500" />
          Verification Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isVerified ? (
          // Verified State
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-green-500" />
              <div className="flex items-center gap-2">
                {isLifetimeVerified ? (
                  <>
                    <Crown className="h-5 w-5 text-yellow-500" />
                    <span className="font-semibold text-green-700">Lifetime Verified Company</span>
                    <VerificationBadge color={company.badge_color as 'gold' | 'blue' | 'green' | 'silver'} size={20} />
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-green-700">Verified Company</span>
                    <VerificationBadge color={company.badge_color as 'gold' | 'blue' | 'green' | 'silver'} size={20} />
                  </>
                )}
              </div>
            </div>
            
            <div className="bg-white/70 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Plan Active Until:</span>
                <span className="text-sm text-muted-foreground">
                  {isLifetimeVerified ? "Forever" : formatDate(company.verified_plan_end!)}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Status:</span>
                {isLifetimeVerified ? (
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                    ✨ Never expires
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    {getDaysLeft(company.verified_plan_end!)} days
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-2 text-sm text-green-700">
                <CheckCircle className="h-4 w-4" />
                <span>Your company badge is visible on all job postings</span>
              </div>
            </div>
            
            {/* Cancel Verification Option - Hide for lifetime verified */}
            {!isLifetimeVerified && (
              <Button 
                variant="destructive" 
                onClick={() => setShowCancelDialog(true)}
                className="w-full"
                disabled={loading}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel Verification
              </Button>
            )}
            
            {isLifetimeVerified && (
              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-yellow-700">
                  <Crown className="h-4 w-4" />
                  <span>You have lifetime verification access!</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          // Not Verified State
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Clock className="h-6 w-6 text-orange-500" />
              <span className="font-semibold text-orange-700">Not Verified</span>
            </div>
            
            <div className="bg-white/70 rounded-lg p-4 space-y-3">
              <h4 className="font-semibold text-lg mb-2">Get Verified Today!</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Stand out with a verified badge</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Increase candidate trust and applications</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Premium visibility for your company</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Multiple verification packages available</span>
                </div>
              </div>
            </div>
            
            <Button 
              onClick={() => setShowPurchaseDialog(true)}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
              size="lg"
            >
              <Star className="h-4 w-4 mr-2" />
              Get Verified Now
            </Button>
          </div>
        )}
        
        {!isLifetimeVerified && (
          <VerificationBadgeDialog
            open={showPurchaseDialog}
            onOpenChange={setShowPurchaseDialog}
            onSuccess={handlePurchaseSuccess}
          />
        )}

        {/* Cancel Verification Confirmation Dialog */}
        <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel Verification?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to cancel your company verification? 
                <br /><br />
                <strong>⚠️ Important:</strong> No refund will be provided for this action. Your verification badge will be removed immediately and you will lose all verification benefits.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleCancelVerification}
                disabled={loading}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {loading ? "Removing..." : "Confirm Cancel"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};

export default VerificationSection;