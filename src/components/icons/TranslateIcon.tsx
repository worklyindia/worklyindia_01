interface TranslateIconProps {
  size?: number;
  className?: string;
  animated?: boolean;
}

export default function TranslateIcon({ size = 20, className = "", animated = false }: TranslateIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} ${animated ? 'animate-spin' : 'transition-transform duration-200'}`}
    >
      {/* Google Translate inspired design */}
      {/* Left "A" character */}
      <path
        d="M4 18L7 10L10 18M5.5 15H8.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Right character (文/Chinese) */}
      <path
        d="M14 6H20M17 6V18M14 12H20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Swap arrows */}
      <path
        d="M11 8L13 6L11 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
      <path
        d="M13 16L11 18L13 20"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
    </svg>
  );
}
