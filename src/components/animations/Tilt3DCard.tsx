import { useRef, useState, ReactNode } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

interface Tilt3DCardProps {
  children: ReactNode;
  className?: string;
  maxTilt?: number;
  glareEnabled?: boolean;
  scale?: number;
}

const Tilt3DCard = ({ children, className = '', maxTilt = 15, glareEnabled = true, scale = 1.02 }: Tilt3DCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [transform, setTransform] = useState('perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)');
  const [glareStyle, setGlareStyle] = useState({ opacity: 0, background: '' });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isMobile || !cardRef.current) return;
    
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const rotateX = ((y - centerY) / centerY) * -maxTilt;
    const rotateY = ((x - centerX) / centerX) * maxTilt;
    
    setTransform(`perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`);
    
    if (glareEnabled) {
      const angle = Math.atan2(y - centerY, x - centerX) * (180 / Math.PI) + 180;
      setGlareStyle({
        opacity: 0.15,
        background: `linear-gradient(${angle}deg, hsl(var(--primary) / 0.3) 0%, transparent 80%)`,
      });
    }
  };

  const handleMouseLeave = () => {
    setTransform('perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)');
    setGlareStyle({ opacity: 0, background: '' });
  };

  return (
    <div
      ref={cardRef}
      className={`relative overflow-hidden ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform,
        transition: 'transform 0.15s ease-out',
        transformStyle: 'preserve-3d',
        willChange: 'transform',
      }}
    >
      {children}
      {glareEnabled && (
        <div
          className="absolute inset-0 pointer-events-none rounded-[inherit] z-10"
          style={{
            opacity: glareStyle.opacity,
            background: glareStyle.background,
            transition: 'opacity 0.3s',
          }}
        />
      )}
    </div>
  );
};

export default Tilt3DCard;
