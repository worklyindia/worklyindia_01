import React from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { MapPin, Briefcase } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { useLocationJobCounts } from "@/hooks/useLocationJobCounts";
import { StandardSheetHeader } from "@/components/StandardSheetHeader";

interface UserLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserLocationDialog({ open, onOpenChange }: UserLocationDialogProps) {
  const { profile } = useAuth();

  // Extract city, state, country from profile
  const city = (profile as any)?.city || null;
  const state = (profile as any)?.state || null;
  const country = (profile as any)?.country || null;

  // Get real-time job counts
  const { cityCount, stateCount, countryCount, loading } = useLocationJobCounts({
    city,
    state,
    country
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="h-auto max-h-[80vh] overflow-y-auto rounded-t-3xl p-6 [&>button]:hidden"
      >
        <StandardSheetHeader 
          title="📍 Your Location"
          onClose={() => onOpenChange(false)}
        />

        <div className="space-y-4 py-4">
          {/* Job Counts Header */}
          <div className="flex items-center gap-2 pb-2">
            <Briefcase className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm font-medium">Available Jobs</p>
          </div>

          <div className="space-y-3">
            {/* City with job count */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-primary/5 hover:bg-primary/10 transition-all duration-200 border-2 border-transparent hover:border-primary/20">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">City</label>
                <span className="text-sm font-semibold">{city || "Not set"}</span>
              </div>
              {loading ? (
                <div className="w-16 h-7 bg-primary/10 animate-pulse rounded-lg" />
              ) : (
                <Badge variant="secondary" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-sm px-3 py-1 shadow-sm">
                  {cityCount} jobs
                </Badge>
              )}
            </div>

            {/* State with job count */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-success/5 hover:bg-success/10 transition-all duration-200 border-2 border-transparent hover:border-success/20">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">State</label>
                <span className="text-sm font-semibold">{state || "Not set"}</span>
              </div>
              {loading ? (
                <div className="w-16 h-7 bg-success/10 animate-pulse rounded-lg" />
              ) : (
                <Badge variant="secondary" className="bg-success/90 text-white hover:bg-success font-bold text-sm px-3 py-1 shadow-sm">
                  {stateCount} jobs
                </Badge>
              )}
            </div>

            {/* Country with job count */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all duration-200 border-2 border-transparent hover:border-blue-200 dark:hover:border-blue-800">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Country</label>
                <span className="text-sm font-semibold">{country || "Not set"}</span>
              </div>
              {loading ? (
                <div className="w-16 h-7 bg-blue-100 dark:bg-blue-900/50 animate-pulse rounded-lg" />
              ) : (
                <Badge variant="secondary" className="bg-blue-600 text-white border-0 font-bold text-sm px-3 py-1 shadow-sm dark:bg-blue-500">
                  {countryCount} jobs
                </Badge>
              )}
            </div>
          </div>

          <div className="p-3 bg-muted/30 rounded-lg border border-border/50">
            <p className="text-xs text-muted-foreground text-center">
              💡 This information is from your profile. To update, go to your profile settings.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
