import { useEffect, useRef, useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

const CursorFollower = () => {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [isVisible, setIsVisible] = useState(false);
  const mousePos = useRef({ x: -100, y: -100 });
  const dotPos = useRef({ x: -100, y: -100 });
  const ringPos = useRef({ x: -100, y: -100 });
  const rafId = useRef<number>(0);
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    if (isMobile) return;

    const onMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
      if (!isVisible) setIsVisible(true);
    };

    const onMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('a, button, [role="button"], input, textarea, select, [data-cursor-hover]')) {
        setIsHovering(true);
      } else {
        setIsHovering(false);
      }
    };

    const onMouseLeave = () => {
      setIsVisible(false);
    };

    const animate = () => {
      // Dot follows closely
      dotPos.current.x += (mousePos.current.x - dotPos.current.x) * 0.35;
      dotPos.current.y += (mousePos.current.y - dotPos.current.y) * 0.35;
      
      // Ring follows with delay
      ringPos.current.x += (mousePos.current.x - ringPos.current.x) * 0.15;
      ringPos.current.y += (mousePos.current.y - ringPos.current.y) * 0.15;

      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${dotPos.current.x}px, ${dotPos.current.y}px) translate(-50%, -50%)`;
      }
      if (ringRef.current) {
        ringRef.current.style.transform = `translate(${ringPos.current.x}px, ${ringPos.current.y}px) translate(-50%, -50%) scale(${isHovering ? 1.8 : 1})`;
      }

      rafId.current = requestAnimationFrame(animate);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseover', onMouseOver);
    document.addEventListener('mouseleave', onMouseLeave);
    rafId.current = requestAnimationFrame(animate);

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseover', onMouseOver);
      document.removeEventListener('mouseleave', onMouseLeave);
      cancelAnimationFrame(rafId.current);
    };
  }, [isMobile, isVisible, isHovering]);

  if (isMobile) return null;

  return (
    <>
      {/* Inner dot */}
      <div
        ref={dotRef}
        className="fixed top-0 left-0 pointer-events-none z-[9999] mix-blend-difference"
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: 'hsl(var(--primary))',
          opacity: isVisible ? 1 : 0,
          transition: 'opacity 0.3s, width 0.3s, height 0.3s',
          willChange: 'transform',
        }}
      />
      {/* Outer ring */}
      <div
        ref={ringRef}
        className="fixed top-0 left-0 pointer-events-none z-[9999] mix-blend-difference"
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: '2px solid hsl(var(--primary) / 0.5)',
          opacity: isVisible ? 0.7 : 0,
          transition: 'opacity 0.3s',
          willChange: 'transform',
        }}
      />
    </>
  );
};

export default CursorFollower;
