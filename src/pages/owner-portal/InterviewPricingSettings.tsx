import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Calendar, Users, TrendingUp, DollarSign, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useInterviewPricing } from "@/hooks/useInterviewPricing";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const InterviewPricingSettings = () => {
  const navigate = useNavigate();
  const { pricing, updatePricing, isUpdating, isLoading } = useInterviewPricing();
  
  const [pointsPerCandidate, setPointsPerCandidate] = useState<string>((pricing?.points_per_interview || 1).toString());
  const [pointsPerMinute, setPointsPerMinute] = useState<string>((pricing?.points_per_minute || 2).toString());
  const [minimumPoints, setMinimumPoints] = useState<string>((pricing?.minimum_points || 0).toString());
  const [enableDuration, setEnableDuration] = useState<boolean>(pricing?.enable_duration_pricing !== false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const candidatePoints = parseInt(pointsPerCandidate);
    const minutePoints = parseInt(pointsPerMinute);
    const minimum = parseInt(minimumPoints);
    
    if (candidatePoints > 0) {
      setShowConfirmDialog(true);
    }
  };

  const confirmUpdate = () => {
    const candidatePoints = parseInt(pointsPerCandidate);
    const minutePoints = parseInt(pointsPerMinute);
    const minimum = parseInt(minimumPoints);
    
    if (candidatePoints > 0) {
      updatePricing({
        points_per_interview: candidatePoints,
        points_per_minute: minutePoints,
        minimum_points: minimum,
        enable_duration_pricing: enableDuration,
      });
      setShowConfirmDialog(false);
    }
  };

  const calculateExample = (candidates: number, minutes: number, mode: string = 'dailyco') => {
    const candidateCharge = candidates * parseInt(pointsPerCandidate || "1");
    
    // Duration charge ONLY applies to Daily.co mode
    let durationCharge = 0;
    if (mode === 'dailyco' && enableDuration) {
      // Daily.co: Per-minute charge per candidate (individual video calls)
      durationCharge = minutes * parseInt(pointsPerMinute || "0") * candidates;
    }
    
    const subtotal = candidateCharge + durationCharge;
    const minimum = parseInt(minimumPoints || "0");
    return Math.max(subtotal, minimum);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/owner-portal")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Interview Pricing Settings</h1>
            <p className="text-muted-foreground">
              Manage pricing for interview scheduling
            </p>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Base Price</p>
                  <h3 className="text-2xl font-bold mt-1">₹{pricing?.points_per_interview || 1}</h3>
                  <p className="text-xs text-muted-foreground mt-1">per candidate</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Duration Rate</p>
                  <h3 className="text-2xl font-bold mt-1">₹{pricing?.points_per_minute || 2}</h3>
                  <p className="text-xs text-muted-foreground mt-1">per minute</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Minimum Charge</p>
                  <h3 className="text-2xl font-bold mt-1">₹{pricing?.minimum_points || 0}</h3>
                  <p className="text-xs text-muted-foreground mt-1">floor amount</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Statistics Cards (removed old cards 2 and 3) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        </div>

        {/* Pricing Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Pricing Configuration
            </CardTitle>
            <CardDescription>
              Configure base candidate pricing, duration-based charges, and minimum fees
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading pricing settings...
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Base Pricing */}
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Base Pricing
                  </h3>
                  <div className="space-y-2">
                    <Label htmlFor="candidate-points">Price Per Candidate (₹)</Label>
                    <Input
                      id="candidate-points"
                      type="number"
                      min="1"
                      value={pointsPerCandidate}
                      onChange={(e) => setPointsPerCandidate(e.target.value)}
                      placeholder="Enter ₹ per candidate"
                    />
                    <p className="text-sm text-muted-foreground">
                      Base charge for each candidate in the interview
                    </p>
                  </div>
                </div>

                {/* Duration Pricing */}
                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Duration-Based Pricing
                    </h3>
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="enable-duration" className="text-sm">Enable</Label>
                      <input
                        id="enable-duration"
                        type="checkbox"
                        checked={enableDuration}
                        onChange={(e) => setEnableDuration(e.target.checked)}
                        className="h-4 w-4"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minute-points">Price Per Minute (₹)</Label>
                    <Input
                      id="minute-points"
                      type="number"
                      min="0"
                      value={pointsPerMinute}
                      onChange={(e) => setPointsPerMinute(e.target.value)}
                      placeholder="Enter ₹ per minute"
                      disabled={!enableDuration}
                    />
                    <p className="text-sm text-muted-foreground">
                      Additional charge per minute of interview duration
                    </p>
                  </div>
                </div>

                {/* Minimum Charge */}
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Minimum Charge
                  </h3>
                  <div className="space-y-2">
                    <Label htmlFor="minimum-points">Minimum Price (₹)</Label>
                    <Input
                      id="minimum-points"
                      type="number"
                      min="0"
                      value={minimumPoints}
                      onChange={(e) => setMinimumPoints(e.target.value)}
                      placeholder="Enter minimum ₹ (0 for no minimum)"
                    />
                    <p className="text-sm text-muted-foreground">
                      Minimum amount to charge regardless of duration or candidates
                    </p>
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setPointsPerCandidate((pricing?.points_per_interview || 1).toString());
                      setPointsPerMinute((pricing?.points_per_minute || 2).toString());
                      setMinimumPoints((pricing?.minimum_points || 0).toString());
                      setEnableDuration(pricing?.enable_duration_pricing !== false);
                    }}
                  >
                    Reset
                  </Button>
                  <Button type="submit" disabled={isUpdating}>
                    {isUpdating ? "Updating..." : "Update Pricing"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Price Calculator */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Pricing Examples
            </CardTitle>
            <CardDescription>
              See how different scenarios will be charged
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Example 1: Daily.co - 1 candidate, 15 minutes */}
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="font-semibold">Daily.co: 1 Candidate, 15 Minutes</span>
                  </div>
                  <span className="text-lg font-bold text-primary">₹{calculateExample(1, 15, 'dailyco')}</span>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>Fixed: 1 × {pointsPerCandidate} = ₹{parseInt(pointsPerCandidate)}</div>
                  {enableDuration && <div>Duration: 15 min × {pointsPerMinute} × 1 = ₹{15 * parseInt(pointsPerMinute)}</div>}
                  <div className="font-semibold text-primary">Total: ₹{calculateExample(1, 15, 'dailyco')}</div>
                </div>
              </div>

              {/* Example 2: Daily.co - 10 candidates, 15 minutes */}
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="font-semibold">Daily.co: 10 Candidates, 15 Minutes</span>
                  </div>
                  <span className="text-lg font-bold text-primary">₹{calculateExample(10, 15, 'dailyco')}</span>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>Fixed: 10 × {pointsPerCandidate} = ₹{10 * parseInt(pointsPerCandidate)}</div>
                  {enableDuration && <div>Duration: 15 min × {pointsPerMinute} × 10 = ₹{15 * parseInt(pointsPerMinute) * 10}</div>}
                  <div className="font-semibold text-primary">Total: ₹{calculateExample(10, 15, 'dailyco')}</div>
                </div>
              </div>

              {/* Example 3: Phone - 10 candidates, 15 minutes */}
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="font-semibold">Phone: 10 Candidates, 15 Minutes</span>
                  </div>
                  <span className="text-lg font-bold text-primary">₹{calculateExample(10, 15, 'phone')}</span>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>Fixed: 10 × {pointsPerCandidate} = ₹{10 * parseInt(pointsPerCandidate)}</div>
                  <div>Duration: N/A (only for Daily.co)</div>
                  <div className="font-semibold text-primary">Total: ₹{calculateExample(10, 15, 'phone')}</div>
                </div>
              </div>

              {/* Example 4: In-person - 5 candidates, no duration */}
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="font-semibold">In-Person: 5 Candidates (No Duration)</span>
                  </div>
                  <span className="text-lg font-bold text-primary">₹{5 * parseInt(pointsPerCandidate)}</span>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>Fixed: 5 × {pointsPerCandidate} = ₹{5 * parseInt(pointsPerCandidate)}</div>
                  <div>Duration: N/A (in-person)</div>
                  <div className="font-semibold text-primary">Total: ₹{5 * parseInt(pointsPerCandidate)}</div>
                </div>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
              <p className="text-sm font-semibold text-primary">💡 Pricing Formulas:</p>
              <div className="text-xs text-muted-foreground space-y-1">
                <div><strong>Daily.co:</strong> {enableDuration 
                  ? `(Candidates × ${pointsPerCandidate}) + (Minutes × ${pointsPerMinute} × Candidates)` 
                  : `Candidates × ${pointsPerCandidate}`}
                </div>
                <div><strong>Phone/Online/In-Person:</strong> Candidates × {pointsPerCandidate} <span className="text-xs opacity-70">(no duration charge)</span></div>
                {parseInt(minimumPoints) > 0 && <div className="pt-1 border-t"><strong>Minimum:</strong> ₹{minimumPoints}</div>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="bg-primary/10 rounded-full p-2 mt-1">
                <span className="text-primary font-bold text-sm">1</span>
              </div>
              <div>
                <h4 className="font-semibold">Employer Schedules Interview</h4>
                <p className="text-sm text-muted-foreground">
                  When an employer schedules an interview, they pay the amount via Razorpay at checkout.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="bg-primary/10 rounded-full p-2 mt-1">
                <span className="text-primary font-bold text-sm">2</span>
              </div>
              <div>
                <h4 className="font-semibold">Razorpay Payment</h4>
                <p className="text-sm text-muted-foreground">
                  The configured price is charged per candidate. Multiple candidates = multiplied price.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="bg-primary/10 rounded-full p-2 mt-1">
                <span className="text-primary font-bold text-sm">3</span>
              </div>
              <div>
                <h4 className="font-semibold">History & Notifications</h4>
                <p className="text-sm text-muted-foreground">
                  The payment is recorded in payment history and the employer receives a notification.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Pricing Update</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>Are you sure you want to update the interview pricing settings?</p>
              <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                <div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Price per Candidate:</span>
                    <span className="font-semibold">₹{pointsPerCandidate}</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Price per Minute:</span>
                    <span className="font-semibold">{enableDuration ? `₹${pointsPerMinute}` : 'Disabled'}</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Minimum Charge:</span>
                    <span className="font-semibold">{parseInt(minimumPoints) > 0 ? `${minimumPoints} points` : 'None'}</span>
                  </div>
                </div>
                <div className="pt-2 border-t">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold">Example (1 candidate, 1 minute):</span>
                    <span className="font-bold text-primary">₹{calculateExample(1, 1)}</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                This will affect all future interview scheduling charges.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUpdate}>
              Confirm Update
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default InterviewPricingSettings;
