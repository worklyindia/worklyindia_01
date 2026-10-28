import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ProgressiveImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholderSrc?: string;
  width?: number;
  height?: number;
}

export const ProgressiveImage = ({
  src,
  alt,
  className,
  placeholderSrc,
  width,
  height,
}: ProgressiveImageProps) => {
  const [imgSrc, setImgSrc] = useState(placeholderSrc || src);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const img = new Image();
    img.src = src;
    
    img.onload = () => {
      setImgSrc(src);
      setIsLoading(false);
    };

    img.onerror = () => {
      setIsLoading(false);
    };
  }, [src]);

  return (
    <div className={cn('relative overflow-hidden', className)}>
      <img
        src={imgSrc}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        className={cn(
          'transition-opacity duration-300',
          isLoading ? 'opacity-50 blur-sm' : 'opacity-100'
        )}
      />
      {isLoading && (
        <div className="absolute inset-0 bg-muted/20 animate-pulse" />
      )}
    </div>
  );
};
