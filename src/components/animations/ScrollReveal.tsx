import { useRef, useEffect, useState, ReactNode, CSSProperties } from 'react';

type AnimationType = 'fade-up' | 'fade-down' | 'fade-left' | 'fade-right' | 'zoom-in' | 'zoom-out' | 'flip-up' | 'slide-up' | 'slide-left' | 'slide-right' | 'rotate-in';

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  type?: AnimationType;
  delay?: number;
  duration?: number;
  distance?: number;
  once?: boolean;
  threshold?: number;
  stagger?: number; // For staggered children
  index?: number;   // Child index for stagger calc
}

const getInitialStyle = (type: AnimationType, distance: number): CSSProperties => {
  const base: CSSProperties = { opacity: 0, willChange: 'opacity, transform' };
  
  switch (type) {
    case 'fade-up':
      return { ...base, transform: `translateY(${distance}px)` };
    case 'fade-down':
      return { ...base, transform: `translateY(-${distance}px)` };
    case 'fade-left':
      return { ...base, transform: `translateX(${distance}px)` };
    case 'fade-right':
      return { ...base, transform: `translateX(-${distance}px)` };
    case 'zoom-in':
      return { ...base, transform: 'scale(0.85)' };
    case 'zoom-out':
      return { ...base, transform: 'scale(1.15)' };
    case 'flip-up':
      return { ...base, transform: 'perspective(800px) rotateX(15deg) translateY(20px)' };
    case 'slide-up':
      return { ...base, transform: `translateY(${distance * 1.5}px)`, opacity: 0 };
    case 'slide-left':
      return { ...base, transform: `translateX(${distance * 2}px)` };
    case 'slide-right':
      return { ...base, transform: `translateX(-${distance * 2}px)` };
    case 'rotate-in':
      return { ...base, transform: 'rotate(-5deg) scale(0.9)' };
    default:
      return { ...base, transform: `translateY(${distance}px)` };
  }
};

const getVisibleStyle = (): CSSProperties => ({
  opacity: 1,
  transform: 'translateY(0) translateX(0) scale(1) rotate(0deg)',
  willChange: 'auto',
});

const ScrollReveal = ({
  children,
  className = '',
  type = 'fade-up',
  delay = 0,
  duration = 600,
  distance = 30,
  once = true,
  threshold = 0.15,
  stagger = 0,
  index = 0,
}: ScrollRevealProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  const totalDelay = delay + (stagger * index);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin: '0px 0px -40px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [once, threshold]);

  const style: CSSProperties = isVisible
    ? {
        ...getVisibleStyle(),
        transition: `opacity ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${totalDelay}ms, transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${totalDelay}ms`,
      }
    : {
        ...getInitialStyle(type, distance),
        transition: `opacity ${duration * 0.5}ms ease-in, transform ${duration * 0.5}ms ease-in`,
      };

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
};

export default ScrollReveal;
