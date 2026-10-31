import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AddressMapProps {
  address?: string | null;
  title?: string;
  className?: string;
}

/** Shows an embedded map for an address plus a "Get Directions" button. */
const AddressMap = ({ address, title = "Location", className = "" }: AddressMapProps) => {
  const value = (address || "").trim();
  if (!value || /^remote$/i.test(value)) return null;
  const q = encodeURIComponent(value);
  return (
    <div className={`w-full overflow-hidden rounded-lg border border-border bg-card ${className}`}>
      <iframe
        title={`${title}: ${value}`}
        src={`https://maps.google.com/maps?q=${q}&z=14&output=embed`}
        className="block h-56 w-full border-0 md:h-72"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
      <div className="flex items-center justify-between gap-2 p-3">
        <div className="flex min-w-0 items-start gap-2 text-sm text-muted-foreground">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span className="break-words">{value}</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0"
          onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${q}`, "_blank", "noopener")}
        >
          Directions
        </Button>
      </div>
    </div>
  );
};

export default AddressMap;
