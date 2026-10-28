import { useEffect, useState } from "react";
import { Building } from "lucide-react";
import { storageImageUrl, normalizeImageUrl } from "@/utils/imageUrl";
import { cn } from "@/lib/utils";

interface CompanyLogoProps {
  src?: string | null;
  alt?: string;
  size?: number;
  className?: string;
  iconClassName?: string;
}

/**
 * Renders a company / employer logo with a graceful fallback.
 * - Tries the wsrv.nl proxied URL first (small + fast).
 * - Falls back to the direct normalized URL if the proxy fails.
 * - Falls back to a Building icon if both fail or no URL is provided.
 */
const CompanyLogo = ({
  src,
  alt = "Company logo",
  size = 96,
  className,
  iconClassName,
}: CompanyLogoProps) => {
  const proxied = storageImageUrl(src, size);
  const direct = normalizeImageUrl(src);
  const [current, setCurrent] = useState<string | null>(proxied || direct);
  const [triedDirect, setTriedDirect] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setCurrent(proxied || direct);
    setTriedDirect(false);
    setFailed(false);
  }, [proxied, direct]);

  if (!current || failed) {
    return (
      <Building className={cn("w-6 h-6 text-primary", iconClassName)} />
    );
  }

  return (
    <img
      loading="lazy"
      decoding="async"
      src={current}
      alt={alt}
      referrerPolicy="no-referrer"
      className={cn("w-full h-full object-cover", className)}
      onError={() => {
        if (!triedDirect && direct && direct !== current) {
          setTriedDirect(true);
          setCurrent(direct);
        } else {
          setFailed(true);
        }
      }}
    />
  );
};

export default CompanyLogo;