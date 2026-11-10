import { cn } from "@/lib/utils";

interface AIChipIconProps {
  className?: string;
  strokeWidth?: number;
}

/**
 * Custom "AI chip" icon in lucide outline style — a large rounded square labeled "AI"
 * with eight circuit stubs radiating to nodes, matching the user's reference image.
 * The chip body fills half the 24px viewBox so it reads clearly at tile size.
 */
export function AIChipIcon({ className, strokeWidth = 2 }: AIChipIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(className)}
      aria-hidden="true"
    >
      {/* AI chip body */}
      <rect x="6" y="6" width="12" height="12" rx="2.6" />
      {/* Center label */}
      <text
        x="12"
        y="14.3"
        textAnchor="middle"
        fontSize="6.5"
        fontWeight="700"
        fill="currentColor"
        stroke="none"
        fontFamily="system-ui, sans-serif"
      >
        AI
      </text>
      {/* Circuit stubs with end nodes */}
      <line x1="9.5" y1="6" x2="9.5" y2="3.9" />
      <circle cx="9.5" cy="2.7" r="1.05" />
      <line x1="14.5" y1="6" x2="14.5" y2="3.9" />
      <circle cx="14.5" cy="2.7" r="1.05" />
      <line x1="9.5" y1="18" x2="9.5" y2="20.1" />
      <circle cx="9.5" cy="21.3" r="1.05" />
      <line x1="14.5" y1="18" x2="14.5" y2="20.1" />
      <circle cx="14.5" cy="21.3" r="1.05" />
      <line x1="6" y1="9.5" x2="3.9" y2="9.5" />
      <circle cx="2.7" cy="9.5" r="1.05" />
      <line x1="6" y1="14.5" x2="3.9" y2="14.5" />
      <circle cx="2.7" cy="14.5" r="1.05" />
      <line x1="18" y1="9.5" x2="20.1" y2="9.5" />
      <circle cx="21.3" cy="9.5" r="1.05" />
      <line x1="18" y1="14.5" x2="20.1" y2="14.5" />
      <circle cx="21.3" cy="14.5" r="1.05" />
    </svg>
  );
}

export default AIChipIcon;
