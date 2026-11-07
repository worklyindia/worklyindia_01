import React, { useEffect } from 'react';
import { Navigation, MapPin, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLocationDetection } from '@/hooks/useLocationDetection';

interface LocationDetectorPreciseProps {
  onLocationDetected?: (location: {
    city: string;
    state: string;
    country: string;
    latitude?: number;
    longitude?: number;
    fullAddress?: string;
  }) => void;
  autoDetect?: boolean;
  className?: string;
}

const LocationDetectorPrecise: React.FC<LocationDetectorPreciseProps> = ({
  onLocationDetected,
  autoDetect = false,
  className = ""
}) => {
  const {
    ipLocation,
    geoLocation,
    fullAddress,
    error,
    state,
    permissionState,
    hasAutoDetected,
    detectExactLocation,
    checkPermissionAndAutoDetect,
    cleanup
  } = useLocationDetection({ onLocationDetected: onLocationDetected || (() => {}) });

  // Auto-detect on component mount if enabled
  useEffect(() => {
    if (autoDetect && !hasAutoDetected) {
      console.log('🚀 Auto-detecting precise location on mount...');
      checkPermissionAndAutoDetect();
    }

    // Cleanup on unmount
    return () => {
      cleanup();
    };
  }, [autoDetect, hasAutoDetected, checkPermissionAndAutoDetect, cleanup]);

  const renderLocationStatus = () => {
    if (state === 'detecting-geo') {
      return (
        <div className="flex items-center space-x-2 text-primary">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Getting precise location...</span>
        </div>
      );
    }

    if (state === 'error' && error) {
      return (
        <div className="flex items-center space-x-2 text-destructive">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
      );
    }

    if (state === 'success' && (fullAddress || ipLocation)) {
      return (
        <div className="space-y-2">
          {fullAddress ? (
            <div className="flex items-center space-x-2 text-success">
              <Navigation className="w-4 h-4" />
              <span className="text-sm font-medium">Precise location:</span>
              <span className="text-sm">{fullAddress.formattedAddress}</span>
            </div>
          ) : ipLocation ? (
            <div className="flex items-center space-x-2 text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <span className="text-sm font-medium">Approximate location:</span>
              <span className="text-sm">{ipLocation.city}, {ipLocation.region}, {ipLocation.country}</span>
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <div className="text-muted-foreground text-sm">
        Click below to detect your precise location
      </div>
    );
  };

  const renderPermissionInfo = () => {
    if (!permissionState) return null;

    const getPermissionBadge = () => {
      switch (permissionState) {
        case 'granted':
          return <Badge variant="default" className="text-xs">Location Allowed</Badge>;
        case 'denied':
          return <Badge variant="destructive" className="text-xs">Location Blocked</Badge>;
        case 'prompt':
          return <Badge variant="secondary" className="text-xs">Permission Needed</Badge>;
        default:
          return <Badge variant="outline" className="text-xs">Unknown Status</Badge>;
      }
    };

    return (
      <div className="flex items-center space-x-2 mt-2">
        <span className="text-xs text-muted-foreground">Status:</span>
        {getPermissionBadge()}
      </div>
    );
  };

  const isDetecting = state === 'detecting-geo';

  return (
    <Card className={`p-4 ${className}`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Location Detection</h3>
          {fullAddress && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                detectExactLocation();
              }}
              disabled={isDetecting}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
        </div>

        {renderLocationStatus()}
        {renderPermissionInfo()}

        <div className="flex justify-center">
          <Button
            variant="default"
            size="sm"
            onClick={detectExactLocation}
            disabled={isDetecting}
            className="flex-1 max-w-xs"
          >
            <Navigation className="w-4 h-4 mr-2" />
            {state === 'detecting-geo' ? 'Detecting...' : 'Precise Location'}
          </Button>
        </div>

        {error && (
          <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
            <strong>Info:</strong> {error}
            {permissionState && ` | Permission: ${permissionState}`}
          </div>
        )}
      </div>
    </Card>
  );
};

export default LocationDetectorPrecise;