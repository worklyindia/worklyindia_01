import { useEffect, useRef } from 'react';
import { audioManager } from '@/services/GlobalAudioManager';

interface AdsterraNativeBannerProps {
  className?: string;
}

const AdsterraNativeBanner = ({ className = '' }: AdsterraNativeBannerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptLoadedRef = useRef(false);

  useEffect(() => {
    // Prevent duplicate script loading
    if (scriptLoadedRef.current) return;

    const script = document.createElement('script');
    script.async = true;
    script.setAttribute('data-cfasync', 'false');
    script.src = '//lightingshovestature.com/a827b444ebce9790bbee5070e4984662/invoke.js';
    
    script.onload = () => {
      scriptLoadedRef.current = true;
      // Mute any audio from ads when video is playing
      if (audioManager.isPlayingVideo()) {
        muteAdAudio();
      }
    };

    script.onerror = () => {
      console.warn('Adsterra native banner failed to load');
    };

    if (containerRef.current) {
      containerRef.current.appendChild(script);
    }

    return () => {
      scriptLoadedRef.current = false;
    };
  }, []);

  const muteAdAudio = () => {
    // Mute any audio elements within the ad container
    if (containerRef.current) {
      const audios = containerRef.current.querySelectorAll('audio, video');
      audios.forEach((element: any) => {
        element.muted = true;
        element.volume = 0;
      });
    }
  };

  return (
    <div className={`adsterra-native-banner ${className}`} ref={containerRef}>
      <div id="container-a827b444ebce9790bbee5070e4984662"></div>
    </div>
  );
};

export default AdsterraNativeBanner;
