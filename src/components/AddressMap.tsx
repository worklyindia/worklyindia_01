interface AddressMapProps {
  address?: string | null;
  title?: string;
  className?: string;
}

/** Embedded map for an address; tapping anywhere on it opens Google Maps. */
const AddressMap = ({ address, title = "Location", className = "" }: AddressMapProps) => {
  const value = (address || "").trim();
  if (!value || /^remote$/i.test(value)) return null;
  const q = encodeURIComponent(value);
  return (
    <a
      href={`https://www.google.com/maps/search/?api=1&query=${q}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open ${value} in Google Maps`}
      className={`relative block w-full overflow-hidden rounded-lg border border-border bg-card h-56 md:h-72 ${className}`}
    >
      {/* Shift the iframe up to hide Google's built-in "Open in Maps" button */}
      <iframe
        title={`${title}: ${value}`}
        src={`https://maps.google.com/maps?q=${q}&z=14&output=embed`}
        className="pointer-events-none absolute left-0 w-full border-0"
        style={{ top: -56, height: "calc(100% + 56px)" }}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        tabIndex={-1}
      />
    </a>
  );
};

export default AddressMap;
