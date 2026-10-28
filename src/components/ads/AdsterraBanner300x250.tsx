import { useEffect, useRef } from 'react';
import { audioManager } from '@/services/GlobalAudioManager';

interface AdsterraBanner300x250Props {
  className?: string;
}

const AdsterraBanner300x250 = ({ className = '' }: AdsterraBanner300x250Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptLoadedRef = useRef(false);

  useEffect(() => {
    // Prevent duplicate script loading
    if (scriptLoadedRef.current) return;

    // Create config script
    const configScript = document.createElement('script');
    configScript.type = 'text/javascript';
    configScript.text = `
      atOptions = {
        'key' : 'a03427950f81ee4960172d41db1bdaf1',
        'format' : 'iframe',
        'height' : 250,
        'width' : 300,
        'params' : {}
      };
    `;

    // Create invoke script
    const invokeScript = document.createElement('script');
    invokeScript.type = 'text/javascript';
    invokeScript.src = '//lightingshovestature.com/a03427950f81ee4960172d41db1bdaf1/invoke.js';
    
    invokeScript.onload = () => {
      scriptLoadedRef.current = true;
      // Mute any audio from ads when video is playing
      if (audioManager.isPlayingVideo()) {
        muteAdAudio();
      }
    };

    invokeScript.onerror = () => {
      console.warn('Adsterra banner 300x250 failed to load');
    };

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

    if (containerRef.current) {
      containerRef.current.appendChild(configScript);
      containerRef.current.appendChild(invokeScript);
    }

    return () => {
      scriptLoadedRef.current = false;
    };
  }, []);

  return (
    <div 
      className={`adsterra-banner-300x250 flex justify-center items-center ${className}`}
      ref={containerRef}
    />
  );
};

export default AdsterraBanner300x250;
