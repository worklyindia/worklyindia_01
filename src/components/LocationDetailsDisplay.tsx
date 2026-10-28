import React from 'react';
import { MapPin, Globe } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface LocationDetailsDisplayProps {
  city?: string;
  state?: string;
  country?: string;
  fullAddress?: string;
  postcode?: string;
  className?: string;
}

// Helper function to validate postal code
const isValidPostcode = (postcode: any): boolean => {
  if (!postcode) return false;
  
  const postcodeStr = String(postcode).trim();
  
  if (postcodeStr === '' || 
      postcodeStr === 'undefined' || 
      postcodeStr === 'null' || 
      postcodeStr === '[object Object]' ||
      postcodeStr.toLowerCase().includes('object') ||
      postcodeStr.toLowerCase().includes('throttled') ||
      postcodeStr.toLowerCase().includes('geocode.xyz') ||
      postcodeStr.toLowerCase().includes('see ')) {
    return false;
  }
  
  return true;
};

const LocationDetailsDisplay: React.FC<LocationDetailsDisplayProps> = ({
  city,
  state,
  country,
  fullAddress,
  postcode,
  className = ""
}) => {
  if (!city && !state && !country && !fullAddress) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Full Address */}
      {fullAddress && (
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Full Address</p>
            <p className="text-sm font-medium text-foreground">{fullAddress}</p>
          </div>
        </div>
      )}

      {/* Location badges */}
      <div className="flex flex-wrap gap-2">
        {country && (
          <Badge variant="secondary" className="text-xs">
            <Globe className="w-3 h-3 mr-1" />
            {country}
          </Badge>
        )}
        {state && (
          <Badge variant="secondary" className="text-xs">
            {state}
          </Badge>
        )}
        {city && (
          <Badge variant="secondary" className="text-xs">
            {city}
          </Badge>
        )}
        {isValidPostcode(postcode) && (
          <Badge variant="secondary" className="text-xs">
            📮 {String(postcode).trim()}
          </Badge>
        )}
      </div>
    </div>
  );
};

export default LocationDetailsDisplay;
