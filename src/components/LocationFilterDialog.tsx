import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { MapPin, User, Globe } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserLocation } from "@/contexts/UserLocationContext";
import { StandardSheetHeader } from "@/components/StandardSheetHeader";

interface LocationFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLocationSelect: (level: 'city' | 'state' | 'country') => void;
  currentLevel: 'city' | 'state' | 'country';
}

const LocationFilterDialog = ({
  open,
  onOpenChange,
  onLocationSelect,
  currentLevel
}: LocationFilterDialogProps) => {
  const { profile } = useAuth();
  const { location } = useUserLocation();

  // Use profile location as primary source, fallback to detected location
  const derivedCity = (profile as any)?.city || location.city;
  const derivedState = (profile as any)?.state || location.state;
  const derivedCountry = (profile as any)?.country || location.country;

  const locationOptions = [
    {
      id: 'city' as const,
      icon: MapPin,
      label: derivedCity || 'City',
      description: 'Jobs in your city'
    },
    {
      id: 'state' as const,
      icon: User,
      label: derivedState || 'State',
      description: 'Jobs in your state'
    },
    {
      id: 'country' as const,
      icon: Globe,
      label: derivedCountry || 'Country',
      description: 'Jobs in your country'
    }
  ];

  const handleSelect = (level: 'city' | 'state' | 'country') => {
    onLocationSelect(level);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="h-auto max-h-[80vh] overflow-y-auto rounded-t-3xl p-6 [&>button]:hidden"
      >
        <StandardSheetHeader 
          title="Select Location Filter" 
          onClose={() => onOpenChange(false)}
        />
        
        <div className="space-y-3 py-4">
          {locationOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = currentLevel === option.id;
            
            return (
              <Button
                key={option.id}
                variant={isSelected ? "default" : "outline"}
                className={`w-full justify-start h-auto py-4 px-4 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
                  isSelected ? 'border-2 border-primary shadow-lg' : 'border-2'
                }`}
                onClick={() => handleSelect(option.id)}
              >
                <div className="flex items-center gap-3 w-full">
                  <div className={`p-2.5 rounded-xl ${
                    isSelected 
                      ? 'bg-primary-foreground/10 shadow-sm' 
                      : 'bg-muted'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-bold text-base">{option.label}</div>
                    <div className={`text-xs ${
                      isSelected 
                        ? 'text-primary-foreground/70' 
                        : 'text-muted-foreground'
                    }`}>
                      {option.description}
                    </div>
                  </div>
                  {isSelected && (
                    <div className="w-3 h-3 rounded-full bg-primary-foreground shadow-sm" />
                  )}
                </div>
              </Button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default LocationFilterDialog;
