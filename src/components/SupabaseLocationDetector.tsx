import React, { useEffect, useState } from 'react';
import { Navigation, Loader2, AlertCircle, MapPin, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useSupabaseLocationDetection } from '@/hooks/useSupabaseLocationDetection';

interface LocationFormData {
  fullAddress: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface SupabaseLocationDetectorProps {
  type: 'profile' | 'company' | 'referral';
  autoDetect?: boolean;
  autoSave?: boolean;
  hideSaveButton?: boolean;
  className?: string;
  onLocationSaved?: (location: {
    city: string;
    state: string;
    country: string;
    latitude?: number;
    longitude?: number;
    fullAddress?: string;
    postcode?: string;
  }) => void;
  onValidationChange?: (isValid: boolean) => void;
  onFormDataChange?: (formData: LocationFormData) => void;
  /** Seed the editable address boxes (e.g. restored draft after a refresh). */
  initialValues?: Partial<LocationFormData>;
}

const SupabaseLocationDetector: React.FC<SupabaseLocationDetectorProps> = ({
  type,
  autoDetect = false,
  autoSave = true,
  hideSaveButton = false,
  className = "",
  onLocationSaved,
  onValidationChange,
  onFormDataChange,
  initialValues
}) => {
  const {
    geoLocation,
    fullAddress,
    error,
    state,
    permissionState,
    hasAutoDetected,
    savedLocation,
    isLoading,
    hasValidSavedLocation,
    detectExactLocation,
    checkPermissionAndAutoDetect,
    saveLocation,
    saveManualLocation,
    cleanup,
    clearAndRefreshLocation,
    canDetectLocation,
    getNextDetectionTime
  } = useSupabaseLocationDetection({ 
    type, 
    autoSave,
    onLocationSaved 
  });

  const [localError, setLocalError] = useState<string>('');
  const [editForm, setEditForm] = useState({
    fullAddress: initialValues?.fullAddress || '',
    city: initialValues?.city || '',
    state: initialValues?.state || '',
    postalCode: initialValues?.postalCode || '',
    country: initialValues?.country || ''
  });
  const [isSavingManual, setIsSavingManual] = useState(false);

  // Sync edit form with saved location (never blank out something already typed)
  useEffect(() => {
    if (savedLocation) {
      setEditForm(prev => ({
        fullAddress: savedLocation.fullAddress || prev.fullAddress,
        city: savedLocation.city || prev.city,
        state: savedLocation.state || prev.state,
        postalCode: savedLocation.postcode || prev.postalCode,
        country: savedLocation.country || prev.country
      }));
    }
  }, [savedLocation]);

  // Auto-detect only if no saved location exists
  useEffect(() => {
    if (autoDetect && !hasAutoDetected && !hasValidSavedLocation) {
      console.log('🚀 Auto-detecting location (no saved location found)...');
      checkPermissionAndAutoDetect();
    }
  }, [autoDetect, hasAutoDetected, hasValidSavedLocation, checkPermissionAndAutoDetect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Call onLocationSaved when savedLocation is loaded from database
  useEffect(() => {
    if (hasValidSavedLocation && savedLocation && onLocationSaved) {
      console.log('📍 [SupabaseLocationDetector] Previously saved location loaded:', savedLocation);
      console.log('📮 [SupabaseLocationDetector] Postal code in saved location:', savedLocation.postcode || '(EMPTY)');
      onLocationSaved(savedLocation);
    }
  }, [hasValidSavedLocation, savedLocation, onLocationSaved]);

  // Check if all required fields are filled
  const isFormValid = editForm.fullAddress.trim() !== '' && 
                      editForm.city.trim() !== '' && 
                      editForm.state.trim() !== '' && 
                      editForm.postalCode.trim() !== '' && 
                      editForm.country.trim() !== '';

  // Notify parent about validation status
  useEffect(() => {
    if (onValidationChange) {
      onValidationChange(isFormValid);
    }
  }, [isFormValid, onValidationChange]);

  // Notify parent about form data changes
  useEffect(() => {
    if (onFormDataChange) {
      onFormDataChange(editForm);
    }
  }, [editForm, onFormDataChange]);

  const handleSaveManual = async () => {
    if (!isFormValid) {
      setLocalError('Please fill all address fields');
      return;
    }
    
    setIsSavingManual(true);
    setLocalError('');
    
    try {
      await saveManualLocation({
        city: editForm.city.trim(),
        state: editForm.state.trim(),
        country: editForm.country.trim(),
        fullAddress: editForm.fullAddress.trim(),
        postcode: editForm.postalCode.trim()
      });
    } catch (err) {
      console.error('Failed to save manual location:', err);
      setLocalError('Failed to save location');
    } finally {
      setIsSavingManual(false);
    }
  };

  const isDetecting = state === 'detecting-geo' || isLoading;
  const hasSavedData = savedLocation && (savedLocation.city || savedLocation.fullAddress);
  const canDetect = canDetectLocation();
  const nextDetection = getNextDetectionTime();

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Always show editable form */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullAddress" className="text-sm font-medium flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            Full Address <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="fullAddress"
            placeholder="Enter your complete address..."
            value={editForm.fullAddress}
            onChange={(e) => setEditForm(prev => ({ ...prev, fullAddress: e.target.value }))}
            className="min-h-[80px] resize-none"
            required
          />
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="city" className="text-sm font-medium">City <span className="text-destructive">*</span></Label>
            <Input
              id="city"
              placeholder="City"
              value={editForm.city}
              onChange={(e) => setEditForm(prev => ({ ...prev, city: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state" className="text-sm font-medium">State <span className="text-destructive">*</span></Label>
            <Input
              id="state"
              placeholder="State"
              value={editForm.state}
              onChange={(e) => setEditForm(prev => ({ ...prev, state: e.target.value }))}
              required
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="postalCode" className="text-sm font-medium">Postal Code <span className="text-destructive">*</span></Label>
            <Input
              id="postalCode"
              placeholder="Postal Code"
              value={editForm.postalCode}
              onChange={(e) => setEditForm(prev => ({ ...prev, postalCode: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="country" className="text-sm font-medium">Country <span className="text-destructive">*</span></Label>
            <Input
              id="country"
              placeholder="Country"
              value={editForm.country}
              onChange={(e) => setEditForm(prev => ({ ...prev, country: e.target.value }))}
              required
            />
          </div>
        </div>
        
        {/* Save Button - only show when hideSaveButton is false */}
        {!hideSaveButton && (
          <Button
            variant="default"
            size="sm"
            onClick={handleSaveManual}
            disabled={isSavingManual || isLoading}
            className="w-full"
          >
            {isSavingManual || isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Location
              </>
            )}
          </Button>
        )}
      </div>

      {/* Auto-detect button - always available */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => detectExactLocation()}
        disabled={isDetecting}
        className="w-full"
      >
        <Navigation className="w-4 h-4 mr-2" />
        {isDetecting ? 'Detecting...' : 'Auto-detect Location'}
      </Button>

      {/* Errors */}
      {(error || localError) && (
        <div className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {localError || error}
        </div>
      )}
    </div>
  );
};

export default SupabaseLocationDetector;