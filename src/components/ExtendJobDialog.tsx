import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { PaymentPageHeader } from '@/components/PaymentPageHeader';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, addMonths } from 'date-fns';
import { payWithRazorpay } from '@/lib/razorpayJobPayment';
import { packagePrice, visiblePackages } from '@/lib/jobPostingPackages';

interface ExtendJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: {
    id: string;
    title: string;
    created_at: string;
    expires_at?: string;
  };
  onSuccess?: () => void;
}

interface DurationPackage {
  months: number;
  points: number;
  price?: number;
  is_default?: boolean;
}

export const ExtendJobDialog: React.FC<ExtendJobDialogProps> = ({
  open,
  onOpenChange,
  job,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [durationPackages, setDurationPackages] = useState<DurationPackage[]>([]);
  const [selectedDuration, setSelectedDuration] = useState<number>(1);

  useEffect(() => {
    if (open) {
      fetchJobPostingSettings();
    }
  }, [open]);

  const fetchJobPostingSettings = async () => {
    try {
      console.log('🔄 Fetching job posting settings for extension...');
      const { data, error } = await supabase
        .from('job_posting_settings')
        .select('duration_packages, points_required_per_job')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (data?.duration_packages && Array.isArray(data.duration_packages)) {
        console.log('✅ Using duration packages from database:', data.duration_packages);
        const packages = visiblePackages<DurationPackage>(data.duration_packages);
        setDurationPackages(packages);
        
        // Set default selected duration
        const defaultPackage = packages.find(pkg => pkg.is_default);
        if (defaultPackage) {
          setSelectedDuration(defaultPackage.months);
        }
      } else if (data?.points_required_per_job) {
        // Fallback to calculating packages based on base cost
        const basePoints = data.points_required_per_job;
        console.log('⚠️ Using fallback packages with base points:', basePoints);
        setDurationPackages([
          { months: 1, points: basePoints, is_default: true },
          { months: 2, points: basePoints * 2 },
          { months: 3, points: basePoints * 3 },
          { months: 6, points: basePoints * 6 },
          { months: 12, points: basePoints * 12 }
        ]);
      } else {
        console.log('⚠️ No settings found, using default packages');
        setDurationPackages([
          { months: 1, points: 50, is_default: true },
          { months: 2, points: 100 },
          { months: 3, points: 150 },
          { months: 6, points: 300 },
          { months: 12, points: 600 }
        ]);
      }
    } catch (error) {
      console.error('❌ Failed to fetch job posting settings:', error);
      toast.error('Failed to load pricing information');
    }
  };

  const getCurrentExpiryDate = () => {
    if (job.expires_at) {
      return new Date(job.expires_at);
    }
    // Fallback: assume 1 month from creation
    return addMonths(new Date(job.created_at), 1);
  };

  const getNewExpiryDate = () => {
    const currentExpiry = getCurrentExpiryDate();
    return addMonths(currentExpiry, selectedDuration);
  };

  const getCurrentPackage = () => {
    return durationPackages.find(pkg => pkg.months === selectedDuration) || durationPackages[0];
  };

  const handleExtendJob = async () => {
    const currentPackage = getCurrentPackage();
    if (!currentPackage) {
      toast.error('No extension package selected');
      return;
    }

    setLoading(true);
    try {
      const result = await payWithRazorpay({
        purpose: 'job_extension',
        job_id: job.id,
        months: selectedDuration,
        description: `Extend "${job.title}" by ${selectedDuration} month(s)`,
      });
      if (result.cancelled) return;
      if (!result.success) throw new Error(result.error || 'Payment failed');
      const newExpiryDate = new Date(result.data?.new_expiry_date || getNewExpiryDate());
      toast.success(`Job extended successfully! New expiry date: ${format(newExpiryDate, 'dd MMMM yyyy')}`);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('❌ Error extending job:', error);
      const errorMessage = error.message || 'Failed to extend job. Please try again.';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (durationPackages.length === 0) {
    return null;
  }

  const currentPackage = getCurrentPackage();
  const currentExpiry = getCurrentExpiryDate();
  const newExpiry = getNewExpiryDate();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent fullPage className="[&>button]:hidden">
        <PaymentPageHeader
          onBack={() => onOpenChange(false)}
          subtitle={`Extend job duration · ${job.title}`}
        />

        <div className="space-y-4">
          {/* Job Info */}
          <div className="bg-muted/50 p-3 rounded-lg">
            <h3 className="font-medium text-sm">{job.title}</h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <Clock className="h-3 w-3" />
              Current expiry: {format(currentExpiry, 'dd MMMM yyyy')}
            </div>
          </div>

          {/* Duration Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Extension Duration</label>
            <Select 
              value={selectedDuration.toString()} 
              onValueChange={(value) => setSelectedDuration(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {durationPackages.map((pkg) => (
                  <SelectItem key={pkg.months} value={pkg.months.toString()}>
                    {pkg.months} Month{pkg.months > 1 ? 's' : ''} - ₹{packagePrice(pkg)}
                    {pkg.is_default && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        Recommended
                      </Badge>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Pricing Summary */}
          <Card>
            <CardContent className="p-3 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span>Extension Duration:</span>
                <span className="font-medium">{selectedDuration} Month{selectedDuration > 1 ? 's' : ''}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>New Expiry Date:</span>
                <span className="font-medium text-primary">
                  {format(newExpiry, 'dd MMMM yyyy')}
                </span>
              </div>
              <div className="border-t pt-3">
                <div className="flex justify-between items-center text-sm">
                  <span>Amount to pay:</span>
                  <span className="font-semibold">₹{currentPackage ? packagePrice(currentPackage) : 0}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Secure payment via Razorpay</p>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handleExtendJob}
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                'Processing payment...'
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Pay ₹{currentPackage ? packagePrice(currentPackage) : 0} &amp; Extend
                </>
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};