import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Navigation, Search, RefreshCw, Briefcase } from 'lucide-react';
import LottieSearchIcon from "@/components/LottieSearchIcon";

interface LocationInfo {
  city: string;
  state: string;
  country: string;
  isPrecise: boolean;
  fullAddress?: string;
  latitude?: number;
  longitude?: number;
  ip?: string;
  postcode?: string;
}

interface JobCounts {
  cityCount: number;
  stateCount: number;
  countryCount: number;
}

interface LocationDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  locationInfo: LocationInfo | null;
  jobCounts: JobCounts;
  onSearchJobs: () => void;
  onRefreshLocation: () => void;
}

const LocationDetailsDialog: React.FC<LocationDetailsDialogProps> = ({
  isOpen,
  onClose,
  locationInfo,
  jobCounts,
  onSearchJobs,
  onRefreshLocation
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {locationInfo?.isPrecise ? (
              <Navigation className="w-5 h-5 text-success" />
            ) : (
              <MapPin className="w-5 h-5 text-success" />
            )}
            Location Details
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {locationInfo ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Current Location</p>
                <div className="space-y-1">
                  {locationInfo.city && (
                    <p className="font-medium text-sm">
                      <span className="text-muted-foreground">City:</span> {locationInfo.city}
                    </p>
                  )}
                  {locationInfo.state && (
                    <p className="font-medium text-sm">
                      <span className="text-muted-foreground">State:</span> {locationInfo.state}
                    </p>
                  )}
                  {locationInfo.country && (
                    <p className="font-medium text-sm">
                      <span className="text-muted-foreground">Country:</span> {locationInfo.country}
                    </p>
                  )}
                </div>
              </div>
              
              {/* Job Counts Section */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <Briefcase className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm font-medium">Available Jobs</p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <span className="text-sm">In {locationInfo.city}</span>
                    </div>
                    <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                      {jobCounts.cityCount} jobs
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between p-2 rounded-lg bg-success/5 hover:bg-success/10 transition-colors">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-success" />
                      <span className="text-sm">In {locationInfo.state}</span>
                    </div>
                    <Badge variant="secondary" className="bg-success/10 text-success hover:bg-success/20">
                      {jobCounts.stateCount} jobs
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400" />
                      <span className="text-sm">In {locationInfo.country}</span>
                    </div>
                    <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                      {jobCounts.countryCount} jobs
                    </Badge>
                  </div>
                </div>
              </div>
              
              {locationInfo.fullAddress && (
                <div>
                  <p className="text-sm text-muted-foreground">Full Address</p>
                  <p className="text-sm">{locationInfo.fullAddress}</p>
                </div>
              )}
              
              <div className="flex items-center gap-2 text-sm">
                <span className={`px-2 py-1 rounded-full text-xs ${
                  locationInfo.isPrecise 
                    ? 'bg-success/20 text-success' 
                    : 'bg-warning/20 text-warning'
                }`}>
                  {locationInfo.isPrecise ? 'Precise Location' : 'Approximate Location'}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground">Updating location...</p>
            </div>
          )}
          
          <div className="flex gap-2 pt-4">
            <Button onClick={onSearchJobs} className="flex-1">
              <span className="mr-2 inline-flex"><LottieSearchIcon size={16} /></span>
              Search Jobs Here
            </Button>
            <Button variant="outline" onClick={onRefreshLocation}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LocationDetailsDialog;