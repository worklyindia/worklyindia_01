import LottieLocationIcon from "@/components/LottieLocationIcon";
import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { MapPin, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import LocationDetailsDialog from './LocationDetailsDialog';
import { useLocationJobCounts } from '@/hooks/useLocationJobCounts';

interface LocationChipProps {
  className?: string;
}

const LocationChip: React.FC<LocationChipProps> = ({ className = "" }) => {
  const [locationInfo, setLocationInfo] = useState<{
    city: string;
    state: string;
    country: string;
    isPrecise: boolean;
    fullAddress?: string;
    latitude?: number;
    longitude?: number;
    ip?: string;
    postcode?: string;
  } | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Listen for location updates
    const handleLocationUpdate = (event: CustomEvent) => {
      const { city, state, country, latitude, longitude, fullAddress, ip, postcode } = event.detail;
      const newLocationInfo = {
        city,
        state,
        country,
        isPrecise: !!latitude,
        fullAddress,
        latitude,
        longitude,
        ip,
        postcode
      };
      
      setLocationInfo(newLocationInfo);
      
      // Save to session storage for persistence
      sessionStorage.setItem('recent-location', JSON.stringify(newLocationInfo));
      
      // Stop refreshing when new location is detected
      setIsRefreshing(false);
    };

    // Listen for custom location events
    window.addEventListener('location-detected', handleLocationUpdate as EventListener);

    // Check if location is already stored
    const savedPermission = localStorage.getItem('wfh-location-permission');
    if (savedPermission === 'granted') {
      // Try to get from session storage or recent detection
      const recentLocation = sessionStorage.getItem('recent-location');
      if (recentLocation) {
        try {
          const parsed = JSON.parse(recentLocation);
          setLocationInfo({
            city: parsed.city,
            state: parsed.state,
            country: parsed.country,
            isPrecise: !!parsed.latitude,
            fullAddress: parsed.fullAddress,
            latitude: parsed.latitude,
            longitude: parsed.longitude,
            ip: parsed.ip,
            postcode: parsed.postcode
          });
        } catch (e) {
          // Ignore parsing errors
        }
      }
    }

    return () => {
      window.removeEventListener('location-detected', handleLocationUpdate as EventListener);
    };
  }, []);

  if (!locationInfo && !isRefreshing) {
    return null;
  }

  // Get job counts based on current location
  const { cityCount, stateCount, countryCount, loading: countsLoading } = useLocationJobCounts({
    city: locationInfo?.city || null,
    state: locationInfo?.state || null,
    country: locationInfo?.country || null
  });

  // Display location text with proper fallbacks
  const displayText = isRefreshing 
    ? 'Updating...'
    : locationInfo?.city 
      ? locationInfo.city
      : locationInfo?.country || 'Location';

  const handleClick = () => {
    setIsDialogOpen(true);
  };

  const handleSearchJobs = () => {
    setIsDialogOpen(false);
    navigate('/jobs');
  };

  const handleRefreshLocation = () => {
    setIsDialogOpen(false);
    setIsRefreshing(true);
    // Clear current location data to show refreshing state
    setLocationInfo(null);
    
    // For location refresh, we want to force a new detection
    // Clear any cached location data first
    sessionStorage.removeItem('recent-location');
    
    // Trigger location refresh
    window.dispatchEvent(new CustomEvent('refresh-location'));
    
    // Reset refreshing state after 15 seconds (fallback)
    setTimeout(() => {
      setIsRefreshing(false);
    }, 15000);
  };

  return (
    <>
      <div 
        className={cn("flex items-center gap-2 min-h-[44px] cursor-pointer group", className)}
        onClick={handleClick}
      >
        {locationInfo?.isPrecise ? (
          <Navigation className="w-4 h-4 text-success transition-colors group-hover:text-success-glow flex-shrink-0" />
        ) : (
          <LottieLocationIcon size={18} className="flex-shrink-0" />
        )}
        
        <div className="hidden sm:flex items-center gap-2">
          <span className="text-xs sm:text-sm text-foreground font-medium truncate max-w-[120px]" title={displayText}>
            {displayText}
          </span>
          
          {/* Always show counts or loading state when location is available */}
          {locationInfo && (
            countsLoading ? (
              <div className="flex items-center gap-1">
                <div className="w-8 h-5 bg-primary/10 animate-pulse rounded" />
                <div className="w-8 h-5 bg-success/10 animate-pulse rounded" />
                <div className="w-8 h-5 bg-accent/10 animate-pulse rounded" />
              </div>
            ) : (
              <div className="flex items-center gap-1" title={`${cityCount} jobs in ${locationInfo.city || 'city'}, ${stateCount} jobs in ${locationInfo.state || 'state'}, ${countryCount} jobs in ${locationInfo.country || 'country'}`}>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 h-5 bg-primary/10 text-primary hover:bg-primary/20 font-semibold border border-primary/20">
                  {cityCount}
                </Badge>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 h-5 bg-success/10 text-success hover:bg-success/20 font-semibold border border-success/20">
                  {stateCount}
                </Badge>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 h-5 bg-blue-50 text-blue-700 font-semibold border border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                  {countryCount}
                </Badge>
              </div>
            )
          )}
        </div>
        
        {/* Mobile view - show only total count */}
        <div className="flex sm:hidden items-center gap-1">
          {locationInfo && (
            countsLoading ? (
              <div className="w-10 h-5 bg-primary/10 animate-pulse rounded" />
            ) : (
              <Badge variant="secondary" className="text-[10px] px-2 py-0.5 h-5 bg-blue-50 text-blue-700 font-semibold border border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800" title="Jobs in your country">
                {countryCount}
              </Badge>
            )
          )}
        </div>
      </div>

      {(locationInfo || isRefreshing) && (
        <LocationDetailsDialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          locationInfo={locationInfo}
          jobCounts={{ cityCount, stateCount, countryCount }}
          onSearchJobs={handleSearchJobs}
          onRefreshLocation={handleRefreshLocation}
        />
      )}
    </>
  );
};

export default LocationChip;
