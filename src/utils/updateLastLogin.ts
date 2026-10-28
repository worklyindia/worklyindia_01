import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_FUNCTIONS_URL } from '@/constants/supabase';
import { getDeviceInfo, getFingerprintComponents } from '@/utils/deviceInfo';
import { getAudioFingerprint, getAdditionalSignals, detectIncognitoMode, detectAdBlocker } from '@/utils/advancedDeviceDetection';

/**
 * Updates the user's last login timestamp and IP address
 * Called after successful authentication (password, OAuth, etc.)
 */
export const updateLastLogin = async (): Promise<void> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      console.warn('⚠️ No session found for last login update');
      return;
    }

    const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/update-last-login`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Failed to update last login:', errorData);
      return;
    }

    const result = await response.json();
    console.log('✅ Last login updated:', result);

    // Increment login count
    try {
      await supabase.rpc('increment_login_count', { p_user_id: session.user.id });
      console.log('✅ Login count incremented');
    } catch (countErr) {
      console.error('❌ Failed to increment login count:', countErr);
    }

    // Save device info to Supabase on every login
    try {
      const deviceInfo = getDeviceInfo();
      const components = getFingerprintComponents();
      
      // Collect advanced device signals for better duplicate detection
      const [audioFingerprint, isIncognito, hasAdBlocker] = await Promise.all([
        getAudioFingerprint().catch(() => 'N/A'),
        detectIncognitoMode().catch(() => false),
        detectAdBlocker().catch(() => false),
      ]);
      const additionalSignals = getAdditionalSignals();
      
      await fetch(`${SUPABASE_FUNCTIONS_URL}/get-ip-info`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4',
        },
        body: JSON.stringify({
          device_info: deviceInfo,
          fingerprint_components: components,
          advanced_signals: {
            audio_fingerprint: audioFingerprint,
            is_incognito: isIncognito,
            has_ad_blocker: hasAdBlocker,
            ...additionalSignals,
          },
        }),
      });
      console.log('✅ Device info saved on login (with advanced signals)');
    } catch (deviceErr) {
      console.error('⚠️ Failed to save device info (non-critical):', deviceErr);
    }
  } catch (error) {
    console.error('❌ Error updating last login:', error);
    // Non-critical error - don't throw
  }
};
