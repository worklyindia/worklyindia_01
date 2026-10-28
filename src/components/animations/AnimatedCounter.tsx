import { useEffect, useRef, useState } from 'react';

interface AnimatedCounterProps {
  value: string; // e.g. "50+", "2K+", "15,000+"
  className?: string;
  duration?: number;
}

const AnimatedCounter = ({ value, className = '', duration = 1500 }: AnimatedCounterProps) => {
  const [display, setDisplay] = useState('0');
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          animateValue();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

  const animateValue = () => {
    // Extract numeric part and suffix
    const match = value.match(/^([\d,]+)(.*)/);
    if (!match) {
      setDisplay(value);
      return;
    }

    const numericStr = match[1].replace(/,/g, '');
    const suffix = match[2]; // e.g. "+", "K+", etc.
    const target = parseInt(numericStr, 10);
    
    if (isNaN(target)) {
      setDisplay(value);
      return;
    }

    const startTime = performance.now();
    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * target);
      
      setDisplay(current.toLocaleString() + suffix);
      
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  };

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  );
};

export default AnimatedCounter;
