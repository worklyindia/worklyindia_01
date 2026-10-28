import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCompetitionPrizes, useUpdateCompetitionPrize } from "@/hooks/useCompetitionPrizes";
import { Trophy, Medal, Award, Star, Save } from "lucide-react";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import { Skeleton } from "@/components/ui/skeleton";

const CompetitionPrizesManagement = () => {
  const { data: prizes, isLoading, refetch } = useCompetitionPrizes();
  const updatePrize = useUpdateCompetitionPrize();
  
  const [prize1, setPrize1] = useState("");
  const [prize2, setPrize2] = useState("");
  const [prize3, setPrize3] = useState("");

  // Initialize form values when prizes are loaded
  useEffect(() => {
    if (prizes && prizes.length > 0) {
      const p1 = prizes.find(p => p.rank === 1);
      const p2 = prizes.find(p => p.rank === 2);
      const p3 = prizes.find(p => p.rank === 3);
      
      if (p1) setPrize1(p1.prize_amount.toString());
      if (p2) setPrize2(p2.prize_amount.toString());
      if (p3) setPrize3(p3.prize_amount.toString());
    }
  }, [prizes]);

  const handleSave = async () => {
    try {
      const amount1 = parseFloat(prize1);
      const amount2 = parseFloat(prize2);
      const amount3 = parseFloat(prize3);

      if (isNaN(amount1) || isNaN(amount2) || isNaN(amount3)) {
        toast.error("Please enter valid numbers for all prizes");
        return;
      }

      if (amount1 <= 0 || amount2 <= 0 || amount3 <= 0) {
        toast.error("Prize amounts must be greater than 0");
        return;
      }

      // Update all prizes
      await Promise.all([
        updatePrize.mutateAsync({ rank: 1, prize_amount: amount1 }),
        updatePrize.mutateAsync({ rank: 2, prize_amount: amount2 }),
        updatePrize.mutateAsync({ rank: 3, prize_amount: amount3 }),
      ]);

      toast.success("All prizes updated successfully!");
      refetch();
    } catch (error) {
      console.error("Error updating prizes:", error);
      toast.error("Failed to update prizes");
    }
  };

  const formatPreview = (amount: string) => {
    const num = parseFloat(amount);
    return isNaN(num) ? "₹0" : `₹${num.toLocaleString('en-IN')}`;
  };

  return (
    <>
      <SEO 
        title="Competition Prizes Management - Owner Portal"
        description="Manage monthly referral competition prize amounts"
      />
      
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Trophy className="w-8 h-8 text-primary" />
              Competition Prizes Management
            </h1>
            <p className="text-muted-foreground mt-2">
              Configure prize amounts for the monthly referral competition
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Prize Configuration</CardTitle>
              <CardDescription>
                Set the prize amounts for the top 3 winners of each monthly cycle
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {/* 1st Place Prize */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-lg">
                      <Medal className="w-5 h-5 text-yellow-500" />
                      1st Place Prize
                    </Label>
                    <Input
                      type="number"
                      value={prize1}
                      onChange={(e) => setPrize1(e.target.value)}
                      placeholder="Enter amount"
                      className="text-lg"
                      min="1"
                      step="1"
                    />
                    <p className="text-sm text-muted-foreground">
                      Preview: <span className="font-semibold text-yellow-600">{formatPreview(prize1)}</span>
                    </p>
                  </div>

                  {/* 2nd Place Prize */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-lg">
                      <Award className="w-5 h-5 text-gray-500" />
                      2nd Place Prize
                    </Label>
                    <Input
                      type="number"
                      value={prize2}
                      onChange={(e) => setPrize2(e.target.value)}
                      placeholder="Enter amount"
                      className="text-lg"
                      min="1"
                      step="1"
                    />
                    <p className="text-sm text-muted-foreground">
                      Preview: <span className="font-semibold text-gray-600">{formatPreview(prize2)}</span>
                    </p>
                  </div>

                  {/* 3rd Place Prize */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-lg">
                      <Star className="w-5 h-5 text-amber-600" />
                      3rd Place Prize
                    </Label>
                    <Input
                      type="number"
                      value={prize3}
                      onChange={(e) => setPrize3(e.target.value)}
                      placeholder="Enter amount"
                      className="text-lg"
                      min="1"
                      step="1"
                    />
                    <p className="text-sm text-muted-foreground">
                      Preview: <span className="font-semibold text-amber-600">{formatPreview(prize3)}</span>
                    </p>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <Button 
                      onClick={handleSave} 
                      disabled={updatePrize.isPending}
                      className="flex-1"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {updatePrize.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Preview Section */}
          <Card>
            <CardHeader>
              <CardTitle>Live Preview</CardTitle>
              <CardDescription>
                How the prizes will appear on the competition page
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-w-md mx-auto">
                {/* 1st Place Preview */}
                <div className="flex items-center gap-3 text-lg">
                  <Medal className="w-7 h-7 text-yellow-500 shrink-0" />
                  <span className="font-semibold">1st Place</span>
                  <span className="font-bold text-yellow-600">{formatPreview(prize1)}</span>
                </div>

                {/* 2nd Place Preview */}
                <div className="flex items-center gap-3 text-lg">
                  <Award className="w-7 h-7 text-gray-500 shrink-0" />
                  <span className="font-semibold">2nd Place</span>
                  <span className="font-bold text-gray-600">{formatPreview(prize2)}</span>
                </div>

                {/* 3rd Place Preview */}
                <div className="flex items-center gap-3 text-lg">
                  <Star className="w-7 h-7 text-amber-600 shrink-0" />
                  <span className="font-semibold">3rd Place</span>
                  <span className="font-bold text-amber-600">{formatPreview(prize3)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Information Card */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-2">Important Notes:</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Prize amounts will be automatically credited to winners' referral wallets at the end of each month</li>
                <li>• Changes take effect immediately for the next cycle finalization</li>
                <li>• All amounts are in Indian Rupees (INR)</li>
                <li>• Winners are determined based on active referrals count</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default CompetitionPrizesManagement;
