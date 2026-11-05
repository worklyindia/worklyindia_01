import { useRef, useEffect, useState, ReactNode } from 'react';

interface ParallaxSectionProps {
  children: ReactNode;
  className?: string;
  speed?: number; // 0.1 = subtle, 0.5 = strong
  direction?: 'up' | 'down';
  fadeIn?: boolean;
}

const ParallaxSection = ({ children, className = '', speed = 0.15, direction = 'up', fadeIn = true }: ParallaxSectionProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState({ transform: 'translateY(0px)', opacity: fadeIn ? 0 : 1 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Use IntersectionObserver for initial visibility
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && fadeIn) {
          setStyle(prev => ({ ...prev, opacity: 1 }));
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; measure(); });
    };
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const windowH = window.innerHeight;
      const centerY = rect.top + rect.height / 2;
      const fromCenter = (centerY - windowH / 2) / windowH;
      const offset = fromCenter * speed * 100 * (direction === 'up' ? 1 : -1);
      
      setStyle(prev => ({
        ...prev,
        transform: `translateY(${offset}px)`,
      }));
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, [speed, direction, fadeIn]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...style,
        transition: 'opacity 0.8s ease-out, transform 0.1s linear',
        willChange: 'transform, opacity',
      }}
    >
      {children}
    </div>
  );
};

export default ParallaxSection;
