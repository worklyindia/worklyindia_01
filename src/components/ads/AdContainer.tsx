import { ReactNode, useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';

interface AdContainerProps {
  children: ReactNode;
  className?: string;
  label?: string;
  centered?: boolean;
}

const AdContainer = ({ 
  children, 
  className = '', 
  label = 'Advertisement',
  centered = true 
}: AdContainerProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Lazy load ads when container is in viewport
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '100px' }
    );

    const container = document.getElementById('ad-container');
    if (container) {
      observer.observe(container);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div 
      id="ad-container"
      className={`ad-container my-6 ${centered ? 'flex justify-center' : ''} ${className}`}
    >
      <Card className="bg-muted/30 border-dashed border-muted-foreground/20 p-4 w-full max-w-[350px]">
        <div className="text-center mb-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">
            {label}
          </span>
        </div>
        <div className={centered ? 'flex justify-center' : ''}>
          {isVisible && children}
        </div>
      </Card>
    </div>
  );
};

export default AdContainer;
