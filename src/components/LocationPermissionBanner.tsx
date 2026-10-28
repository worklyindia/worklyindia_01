import { useState, useEffect } from 'react';
import { Navigation, X, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useUserLocation } from '@/contexts/UserLocationContext';

export const LocationPermissionBanner = () => {
  const { location, detectLocation, isDetecting } = useUserLocation();
  const [isDismissed, setIsDismissed] = useState(false);

  // Show banner if location not granted and not dismissed
  const shouldShow = !isDismissed && !location.latitude && !location.longitude;

  // Auto-hide after location is detected
  useEffect(() => {
    if (location.latitude && location.longitude) {
      setIsDismissed(true);
    }
  }, [location.latitude, location.longitude]);

  if (!shouldShow) return null;

  const requestLocation = () => {
    console.log('📍 Requesting GPS location permission...');
    detectLocation();
  };

  return (
    <div className="fixed bottom-20 left-0 right-0 z-40 px-4 sm:px-6 animate-slide-up">
      <Card className="mx-auto max-w-2xl bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20 shadow-lg">
        <div className="p-4 flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <MapPin className="w-5 h-5 text-primary" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground mb-1">
              See Jobs Near You
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              Allow location access to see distance in KM for each job
            </p>
            
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                onClick={requestLocation}
                disabled={isDetecting}
                className="text-xs"
              >
                <Navigation className="w-3 h-3 mr-1" />
                {isDetecting ? 'Requesting...' : 'Allow Location'}
              </Button>
              
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsDismissed(true)}
                className="text-xs"
              >
                Not Now
              </Button>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            className="flex-shrink-0 h-6 w-6"
            onClick={() => setIsDismissed(true)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
};