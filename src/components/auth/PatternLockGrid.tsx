import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { getPlatformSync } from '@/utils/platformDetection';

interface PatternLockGridProps {
  onPatternComplete: (pattern: string) => void;
  onPatternChange?: (pattern: string) => void;
  disabled?: boolean;
  error?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

interface Point {
  x: number;
  y: number;
}

const DOT_POSITIONS = [
  { row: 0, col: 0 }, // 0
  { row: 0, col: 1 }, // 1
  { row: 0, col: 2 }, // 2
  { row: 1, col: 0 }, // 3
  { row: 1, col: 1 }, // 4
  { row: 1, col: 2 }, // 5
  { row: 2, col: 0 }, // 6
  { row: 2, col: 1 }, // 7
  { row: 2, col: 2 }, // 8
];

export const PatternLockGrid: React.FC<PatternLockGridProps> = ({
  onPatternComplete,
  onPatternChange,
  disabled = false,
  error = false,
  size = 'md',
}) => {
  const [selectedDots, setSelectedDots] = useState<number[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<Point | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const dotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const platform = getPlatformSync();

  const sizeConfig = {
    xs: { grid: 'w-40 h-40', dot: 'w-3 h-3', dotActive: 'w-5 h-5', gap: 'gap-6' },
    sm: { grid: 'w-48 h-48', dot: 'w-4 h-4', dotActive: 'w-6 h-6', gap: 'gap-7' },
    md: { grid: 'w-64 h-64', dot: 'w-5 h-5', dotActive: 'w-7 h-7', gap: 'gap-10' },
    lg: { grid: 'w-80 h-80', dot: 'w-6 h-6', dotActive: 'w-8 h-8', gap: 'gap-12' },
  };

  const config = sizeConfig[size];

  const triggerHaptic = useCallback(async () => {
    if (platform.isNative) {
      try {
        await Haptics.impact({ style: ImpactStyle.Light });
      } catch (e) {
        // Haptics not available
      }
    }
  }, [platform.isNative]);

  const getDotCenter = (dotIndex: number): Point | null => {
    const dot = dotRefs.current[dotIndex];
    const grid = gridRef.current;
    if (!dot || !grid) return null;

    const gridRect = grid.getBoundingClientRect();
    const dotRect = dot.getBoundingClientRect();

    return {
      x: dotRect.left - gridRect.left + dotRect.width / 2,
      y: dotRect.top - gridRect.top + dotRect.height / 2,
    };
  };

  const getPositionFromEvent = (e: React.TouchEvent | React.MouseEvent): Point | null => {
    const grid = gridRef.current;
    if (!grid) return null;

    const gridRect = grid.getBoundingClientRect();
    let clientX: number, clientY: number;

    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - gridRect.left,
      y: clientY - gridRect.top,
    };
  };

  const getDotAtPosition = (position: Point): number | null => {
    const threshold = size === 'sm' ? 24 : size === 'md' ? 28 : 32;

    for (let i = 0; i < 9; i++) {
      const center = getDotCenter(i);
      if (!center) continue;

      const distance = Math.sqrt(
        Math.pow(position.x - center.x, 2) + Math.pow(position.y - center.y, 2)
      );

      if (distance < threshold) {
        return i;
      }
    }
    return null;
  };

  const handleStart = (e: React.TouchEvent | React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();

    setIsDrawing(true);
    setSelectedDots([]);
    setCurrentPosition(null);

    const position = getPositionFromEvent(e);
    if (!position) return;

    setCurrentPosition(position);
    const dot = getDotAtPosition(position);
    if (dot !== null) {
      setSelectedDots([dot]);
      triggerHaptic();
      onPatternChange?.(dot.toString());
    }
  };

  const handleMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();

    const position = getPositionFromEvent(e);
    if (!position) return;

    setCurrentPosition(position);
    const dot = getDotAtPosition(position);

    if (dot !== null && !selectedDots.includes(dot)) {
      const newDots = [...selectedDots, dot];
      setSelectedDots(newDots);
      triggerHaptic();
      onPatternChange?.(newDots.join(','));
    }
  };

  const handleEnd = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    setCurrentPosition(null);

    if (selectedDots.length > 0) {
      onPatternComplete(selectedDots.join(','));
    }
  };

  // Reset pattern when error changes
  useEffect(() => {
    if (error) {
      const timeout = setTimeout(() => {
        setSelectedDots([]);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [error]);

  const renderLines = () => {
    if (selectedDots.length < 2) return null;

    const lines: React.ReactNode[] = [];

    for (let i = 0; i < selectedDots.length - 1; i++) {
      const start = getDotCenter(selectedDots[i]);
      const end = getDotCenter(selectedDots[i + 1]);
      if (!start || !end) continue;

      lines.push(
        <line
          key={`line-${i}`}
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          stroke={error ? 'hsl(var(--destructive))' : 'hsl(25 95% 53%)'}
          strokeWidth="3"
          strokeLinecap="round"
          className="transition-all duration-150"
        />
      );
    }

    // Draw line to current position while drawing
    if (isDrawing && currentPosition && selectedDots.length > 0) {
      const lastDot = getDotCenter(selectedDots[selectedDots.length - 1]);
      if (lastDot) {
        lines.push(
          <line
            key="current-line"
            x1={lastDot.x}
            y1={lastDot.y}
            x2={currentPosition.x}
            y2={currentPosition.y}
            stroke="hsl(25 95% 53% / 0.5)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="4 4"
          />
        );
      }
    }

    return lines;
  };

  return (
    <div
      ref={gridRef}
      className={`relative ${config.grid} select-none touch-none`}
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
      onMouseDown={handleStart}
      onMouseMove={handleMove}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
    >
      {/* SVG for lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
        {renderLines()}
      </svg>

      {/* Grid of dots */}
      <div className={`grid grid-cols-3 ${config.gap} h-full items-center justify-items-center`}>
        {DOT_POSITIONS.map((_, index) => {
          const isSelected = selectedDots.includes(index);
          const selectionOrder = selectedDots.indexOf(index);

          return (
            <div
              key={index}
              ref={(el) => (dotRefs.current[index] = el)}
              className={`
                rounded-full transition-all duration-150 z-20
                ${isSelected ? config.dotActive : config.dot}
                ${error
                  ? 'bg-destructive'
                  : isSelected
                    ? 'bg-orange-500 shadow-lg shadow-orange-500/40'
                    : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                }
                ${disabled ? 'opacity-50' : ''}
              `}
              style={{
                transform: isSelected ? 'scale(1.2)' : 'scale(1)',
              }}
            >
              {/* Inner dot for selected state */}
              {isSelected && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div 
                    className={`rounded-full bg-white/90 ${size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5'}`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pattern indicator */}
      {selectedDots.length > 0 && !isDrawing && (
        <div className="absolute -bottom-8 left-0 right-0 flex justify-center gap-1">
          {selectedDots.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full ${error ? 'bg-destructive' : 'bg-orange-500'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
