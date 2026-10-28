import { useEffect, useRef, useState } from 'react';

interface AnimatedTabIndicatorProps {
  activeIndex: number;
  itemCount: number;
}

export const AnimatedTabIndicator = ({ activeIndex, itemCount }: AnimatedTabIndicatorProps) => {
  const [style, setStyle] = useState({ left: '0%', width: '0%' });

  useEffect(() => {
    const widthPercent = 100 / itemCount;
    const leftPercent = activeIndex * widthPercent;
    setStyle({
      left: `${leftPercent + widthPercent * 0.2}%`,
      width: `${widthPercent * 0.6}%`,
    });
  }, [activeIndex, itemCount]);

  return (
    <div
      className="absolute top-0 h-[3px] bg-gradient-to-r from-primary to-primary/70 rounded-b-full transition-all duration-300 ease-out"
      style={style}
    />
  );
};
