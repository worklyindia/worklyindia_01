import { useState, useEffect } from 'react';

interface UsePageLoadingStateOptions {
  minimumLoadingTime?: number;
  isLoading: boolean;
}

export const usePageLoadingState = ({ 
  minimumLoadingTime = 500, 
  isLoading 
}: UsePageLoadingStateOptions) => {
  const [showLoading, setShowLoading] = useState(true);
  const [loadingStartTime] = useState(Date.now());

  useEffect(() => {
    if (!isLoading) {
      const elapsedTime = Date.now() - loadingStartTime;
      const remainingTime = Math.max(0, minimumLoadingTime - elapsedTime);

      const timer = setTimeout(() => {
        setShowLoading(false);
      }, remainingTime);

      return () => clearTimeout(timer);
    }
  }, [isLoading, loadingStartTime, minimumLoadingTime]);

  return showLoading && isLoading;
};
