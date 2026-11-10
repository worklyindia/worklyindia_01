import { useState, useRef, useEffect } from 'react';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholder?: string;
  width?: number;
  height?: number;
  priority?: boolean;
  srcSet?: string;
  sizes?: string;
  showSkeleton?: boolean;
}

const LazyImage = ({ 
  src, 
  alt, 
  className = "", 
  placeholder = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PC9zdmc+",
  width,
  height,
  priority = false,
  srcSet,
  sizes,
  showSkeleton = false
}: LazyImageProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // For priority images, load immediately
    if (priority) {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '50px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [priority]);

  // PROPERLY SIZE IMAGES FIX: Ensure optimized src is used as fallback
  const optimizedSrc = isInView ? src : placeholder;
  const shouldShowSrcSet = isInView && srcSet;

  // CLS FIX: Use inline styles to reserve exact space
  const containerStyle: React.CSSProperties = width && height ? {
    width: `${width}px`,
    height: `${height}px`,
    aspectRatio: `${width} / ${height}`,
  } : {};

  return (
    <div className="relative inline-block" style={containerStyle}>
      {/* Colorful Skeleton Loader */}
      {showSkeleton && !isLoaded && (
        <div 
          className="absolute inset-0 rounded-full overflow-hidden animate-pulse"
          style={{
            width: width ? `${width}px` : '100%',
            height: height ? `${height}px` : 'auto'
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/40 via-secondary/40 to-accent/40 animate-shimmer" 
            style={{
              backgroundSize: '200% 200%',
              animation: 'shimmer 1.5s infinite'
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 via-transparent to-secondary/20 animate-pulse" />
        </div>
      )}
      
      <img
        ref={imgRef}
        src={optimizedSrc}
        srcSet={shouldShowSrcSet ? srcSet : undefined}
        sizes={shouldShowSrcSet ? sizes : undefined}
        alt={alt}
        className={`transition-all duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'} ${className} ${showSkeleton && !isLoaded ? 'invisible' : 'visible'}`}
        width={width}
        height={height}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        onLoad={() => setIsLoaded(true)}
        style={{ 
          contentVisibility: 'auto',
          maxWidth: width ? `${width}px` : '100%',
          maxHeight: height ? `${height}px` : 'auto',
          aspectRatio: width && height ? `${width} / ${height}` : undefined,
        }}
      />
    </div>
  );
};

export default LazyImage;