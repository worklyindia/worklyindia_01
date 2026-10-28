import { useState, useCallback, MouseEvent } from 'react';

interface Ripple {
  x: number;
  y: number;
  id: number;
}

export const useRipple = () => {
  const [ripples, setRipples] = useState<Ripple[]>([]);

  const createRipple = useCallback((e: MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();

    setRipples((prev) => [...prev, { x, y, id }]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 600);
  }, []);

  return { ripples, createRipple };
};

interface RippleContainerProps {
  ripples: Ripple[];
}

export const RippleContainer = ({ ripples }: RippleContainerProps) => (
  <>
    {ripples.map((ripple) => (
      <span
        key={ripple.id}
        className="absolute rounded-full bg-primary/20 pointer-events-none animate-ripple-expand"
        style={{
          left: ripple.x - 20,
          top: ripple.y - 20,
          width: 40,
          height: 40,
        }}
      />
    ))}
  </>
);
