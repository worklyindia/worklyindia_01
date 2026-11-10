import { ReactNode } from 'react';

interface GlowingBorderProps {
  children: ReactNode;
  className?: string;
}

const GlowingBorder = ({ children, className = '' }: GlowingBorderProps) => {
  return (
    <div className={`relative group ${className}`}>
      {/* Animated glow border */}
      <div 
        className="absolute -inset-[1px] rounded-[inherit] opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm"
        style={{
          background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--secondary)), hsl(var(--primary)))',
          backgroundSize: '200% 200%',
          animation: 'gradient-shift 3s ease infinite',
        }}
      />
      <div className="relative rounded-[inherit] bg-card">
        {children}
      </div>
    </div>
  );
};

export default GlowingBorder;
