
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { MapPin, Shield, Trash2, RefreshCw } from 'lucide-react';
import { useLocationDetection } from '@/hooks/useLocationDetection';

const LOCATION_PERMISSION_KEY = 'wfh-location-permission';
const LOCATION_PROMPT_SHOWN_KEY = 'wfh-location-prompt-shown';
const AUTO_IP_DETECTION_KEY = 'wfh-auto-ip-detection';

const LocationPrivacySettings = () => {
  const [autoIPDetection, setAutoIPDetection] = useState(true);
  const [currentPermission, setCurrentPermission] = useState<string>('');
  const [promptShown, setPromptShown] = useState(false);

  const handleLocationDetected = React.useCallback((location: any) => {
    // Handle location detection in settings
  }, []);

  const { detectExactLocation, detectIPLocation, state } = useLocationDetection({
    onLocationDetected: handleLocationDetected
  });

  useEffect(() => {
    // Load current settings
    const savedPermission = localStorage.getItem(LOCATION_PERMISSION_KEY) || 'none';
    const savedPromptShown = localStorage.getItem(LOCATION_PROMPT_SHOWN_KEY) === 'true';
    const savedAutoIP = localStorage.getItem(AUTO_IP_DETECTION_KEY) !== 'false';

    setCurrentPermission(savedPermission);
    setPromptShown(savedPromptShown);
    setAutoIPDetection(savedAutoIP);
  }, []);

  const handleAutoIPToggle = (enabled: boolean) => {
    setAutoIPDetection(enabled);
    localStorage.setItem(AUTO_IP_DETECTION_KEY, enabled.toString());
  };

  const clearLocationData = () => {
    localStorage.removeItem(LOCATION_PERMISSION_KEY);
    localStorage.removeItem(LOCATION_PROMPT_SHOWN_KEY);
    setCurrentPermission('none');
    setPromptShown(false);
  };

  const getPermissionBadge = () => {
    switch (currentPermission) {
      case 'granted':
        return <Badge variant="default">Precise Location Allowed</Badge>;
      case 'denied':
        return <Badge variant="destructive">Precise Location Blocked</Badge>;
      default:
        return <Badge variant="secondary">Not Set</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Location & Privacy Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Permission Status */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Current Permission Status</h4>
              <p className="text-sm text-muted-foreground">
                Your current location access permission
              </p>
            </div>
            {getPermissionBadge()}
          </div>

          {/* Auto IP Detection Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Automatic IP-based Location</h4>
              <p className="text-sm text-muted-foreground">
                Automatically detect approximate location using your IP address
              </p>
            </div>
            <Switch
              checked={autoIPDetection}
              onCheckedChange={handleAutoIPToggle}
            />
          </div>

          {/* Manual Location Detection */}
          <div className="space-y-2">
            <h4 className="font-medium">Manual Location Detection</h4>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={detectIPLocation}
                disabled={state.includes('detecting')}
              >
                <MapPin className="w-4 h-4 mr-2" />
                Detect via IP
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={detectExactLocation}
                disabled={state.includes('detecting')}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Get Precise Location
              </Button>
            </div>
          </div>

          {/* Clear Location Data */}
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-destructive">Clear Location Data</h4>
                <p className="text-sm text-muted-foreground">
                  Remove all stored location preferences and permissions
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={clearLocationData}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Privacy Information */}
      <Card>
        <CardHeader>
          <CardTitle>How We Handle Your Location</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="space-y-2">
            <h5 className="font-medium text-foreground">What We Collect:</h5>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>IP-based location: City, state, country (approximate)</li>
              <li>GPS location: Precise coordinates (only when you allow)</li>
              <li>Your permission preferences (stored locally)</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h5 className="font-medium text-foreground">What We Don't Do:</h5>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Store your precise coordinates on our servers</li>
              <li>Track your location continuously</li>
              <li>Share location data with third parties</li>
              <li>Use location for advertising targeting</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h5 className="font-medium text-foreground">External Services:</h5>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>geojs.io:</strong> IP-based location detection</li>
              <li><strong>OpenStreetMap:</strong> Address lookup from coordinates</li>
              <li>Both services have their own privacy policies</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LocationPrivacySettings;
