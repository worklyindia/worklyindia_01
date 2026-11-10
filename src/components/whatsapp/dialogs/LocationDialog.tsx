import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin, Navigation } from "lucide-react";
import { toast } from "sonner";

interface LocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (location: { latitude: number; longitude: number; address?: string }) => void;
}

export function LocationDialog({ open, onOpenChange, onSubmit }: LocationDialogProps) {
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const getCurrentLocation = async () => {
    setLoading(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });
      
      const { latitude, longitude } = position.coords;
      setCoords({ latitude, longitude });
      toast.success("Location detected!");
    } catch (error) {
      toast.error("Could not get location. Please enable location services.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (coords) {
      onSubmit({
        ...coords,
        address: address.trim() || undefined,
      });
      setCoords(null);
      setAddress("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Location</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Button
            variant="outline"
            onClick={getCurrentLocation}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Navigation className="h-4 w-4 mr-2" />
            )}
            Get Current Location
          </Button>

          {coords && (
            <div className="p-3 bg-muted rounded-lg flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              <span className="text-sm">
                {coords.latitude.toFixed(6)}, {coords.longitude.toFixed(6)}
              </span>
            </div>
          )}

          <div>
            <label className="text-sm text-muted-foreground">Address Label (Optional)</label>
            <Input
              placeholder="Home, Office, etc."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <Button onClick={handleSubmit} disabled={!coords} className="w-full">
            Send Location
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
