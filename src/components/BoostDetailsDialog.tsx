import React, { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useJobBoostDetails } from "@/hooks/useJobBoostDetails";
import { Zap, Clock, Calendar, TrendingUp, Star, ChevronDown } from "lucide-react";
import { format } from "date-fns";

interface BoostDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobTitle: string;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const BoostDetailsDialog: React.FC<BoostDetailsDialogProps> = ({
  open,
  onOpenChange,
  jobId,
  jobTitle
}) => {
  const { boostDetails, loading, error } = useJobBoostDetails(jobId);
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  // Live countdown timer
  useEffect(() => {
    if (!boostDetails?.boost_end_date) return;

    const updateCountdown = () => {
      const now = new Date().getTime();
      const endTime = new Date(boostDetails.boost_end_date).getTime();
      const difference = endTime - now;

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeRemaining({ days, hours, minutes, seconds });
      } else {
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [boostDetails?.boost_end_date]);

  const getBoostIcon = (level: number) => {
    switch (level) {
      case 1: return <Zap className="w-4 h-4 text-yellow-500" />;
      case 2: return <TrendingUp className="w-4 h-4 text-orange-500" />;
      case 3: return <Star className="w-4 h-4 text-red-500" />;
      default: return <Zap className="w-4 h-4 text-primary" />;
    }
  };

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), 'MMMM dd, hh:mm a');
  };

  if (loading) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto [&>button]:hidden">
          <SheetHeader>
            <SheetTitle className="text-left text-lg font-medium">Loading...</SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            <div className="h-6 w-48 bg-muted/50 rounded animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 w-full bg-muted/50 rounded animate-pulse" />
              <div className="h-4 w-3/4 bg-muted/50 rounded animate-pulse" />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  if (error || !boostDetails) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto [&>button]:hidden">
          <SheetHeader>
            <SheetTitle className="text-left text-lg font-medium">No Active Boost</SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">This job doesn't have an active boost package.</p>
            <Button onClick={() => onOpenChange(false)} className="w-full">
              Close
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto [&>button]:hidden">
        <SheetHeader>
          <div className="flex items-start justify-between mb-4">
            <SheetTitle className="text-left text-lg font-medium flex items-center gap-2">
              {getBoostIcon(boostDetails.boost_level)}
              Boost Details: {jobTitle}
            </SheetTitle>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="h-8 w-8 -mr-2">
              <ChevronDown className="h-5 w-5" />
            </Button>
          </div>
        </SheetHeader>

        <div className="space-y-4">
          {/* Package Info */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-lg">{boostDetails.package_name}</h4>
                <Badge variant="secondary" className="bg-primary/10 text-primary">
                  Level {boostDetails.boost_level}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>Amount Paid: <span className="font-medium text-foreground">₹{boostDetails.amount_paid.toLocaleString()}</span></p>
                <p>Duration: <span className="font-medium text-foreground">{boostDetails.boost_days} days</span></p>
              </div>
            </CardContent>
          </Card>

          {/* Timing Details */}
          <Card>
            <CardContent className="p-4">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Boost Timeline
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Started:</span>
                  <span className="font-medium">{formatDateTime(boostDetails.boost_start_date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ends:</span>
                  <span className="font-medium">{formatDateTime(boostDetails.boost_end_date)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Live Countdown */}
          <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-4">
              <h4 className="font-semibold mb-3 flex items-center gap-2 text-primary">
                <Clock className="w-4 h-4" />
                Time Remaining
              </h4>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-background/80 rounded-lg p-2">
                  <div className="text-2xl font-bold text-primary">{timeRemaining.days}</div>
                  <div className="text-xs text-muted-foreground">Days</div>
                </div>
                <div className="bg-background/80 rounded-lg p-2">
                  <div className="text-2xl font-bold text-primary">{timeRemaining.hours}</div>
                  <div className="text-xs text-muted-foreground">Hours</div>
                </div>
                <div className="bg-background/80 rounded-lg p-2">
                  <div className="text-2xl font-bold text-primary">{timeRemaining.minutes}</div>
                  <div className="text-xs text-muted-foreground">Minutes</div>
                </div>
                <div className="bg-background/80 rounded-lg p-2">
                  <div className="text-2xl font-bold text-primary">{timeRemaining.seconds}</div>
                  <div className="text-xs text-muted-foreground">Seconds</div>
                </div>
              </div>
              
              {timeRemaining.days === 0 && timeRemaining.hours === 0 && timeRemaining.minutes === 0 && timeRemaining.seconds === 0 && (
                <div className="mt-3 text-center">
                  <Badge variant="outline" className="text-red-600 border-red-600">
                    Boost Expired
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Close Button */}
          <div className="flex justify-end pt-2">
            <Button onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
              Close
            </Button>
          </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  };
  
  export default BoostDetailsDialog;