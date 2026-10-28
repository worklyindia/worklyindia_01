import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useYouTubeGrowth } from '@/hooks/useYouTubeGrowth';

/**
 * Invisible handler: completes the YouTube OAuth code exchange that lands back on
 * /ai-assistant and forwards the user to the YouTube Studio page.
 */
export default function YouTubeOAuthBridge() {
  const navigate = useNavigate();
  const { connection, connecting } = useYouTubeGrowth();

  useEffect(() => {
    if (connection && !connecting && sessionStorage.getItem('yt_return_studio')) {
      sessionStorage.removeItem('yt_return_studio');
      navigate('/ai-assistant', { replace: true });
    }
  }, [connection, connecting, navigate]);

  return null;
}
