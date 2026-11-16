import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AudioLines, Mic, MicOff, PhoneOff, ShieldCheck, Volume2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import VerificationBadge from '@/components/VerificationBadge';
import { useAIChatSettings } from '@/hooks/useAIChatSettings';
import { getWorklyAndroidBridge } from '@/lib/nativeAppBridge';
import { supabase } from '@/integrations/supabase/client';
import {
  isBrowserLocalVoiceAvailable,
  startBrowserLocalRecognition,
  stopBrowserLocalRecognition,
  speakBrowserLocalReply,
  stopBrowserLocalReply,
} from '@/lib/browserOfflineVoice';

type CallState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

export default function AIVoiceCall() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: settings } = useAIChatSettings();
  const [callState, setCallState] = useState<CallState>('idle');
  const [lastReply, setLastReply] = useState('');
  const [lastTranscript, setLastTranscript] = useState('');
  const [muted, setMuted] = useState(false);
  const [nativeAvailable, setNativeAvailable] = useState(false);
  const [isNativeApp] = useState(() => !!getWorklyAndroidBridge());
  const activeRef = useRef(false);
  const aiName = settings?.name || 'Workly India AI';
  const showBadge = settings?.verification_enabled;
  const badgeColor = (settings?.verification_color || 'blue') as 'gold' | 'blue' | 'green' | 'silver';
  const bridge = getWorklyAndroidBridge();
  const startRecognition = useCallback((language = 'auto') => {
    if (bridge) return bridge.startOnDeviceVoiceRecognition?.(language) ?? false;
    void startBrowserLocalRecognition(navigator.language || 'en-US').catch((error) => {
      window.dispatchEvent(new CustomEvent('workly-voice-error', {
        detail: { message: error instanceof Error ? error.message : 'Local browser speech recognition failed.' },
      }));
    });
    return true;
  }, [bridge]);
  const stopRecognition = useCallback(() => {
    if (bridge) bridge.stopOnDeviceVoiceRecognition?.();
    else stopBrowserLocalRecognition();
  }, [bridge]);
  const speakReply = useCallback((text: string, language: string) => {
    if (bridge) return bridge.speakVoiceReply?.(text, language) ?? false;
    return speakBrowserLocalReply(text, language === 'und' ? (navigator.language || 'en-US') : language);
  }, [bridge]);
  const stopReply = useCallback(() => {
    if (bridge) bridge.stopVoiceReply?.();
    else stopBrowserLocalReply();
  }, [bridge]);
  const recognitionAvailable = useCallback(() => {
    return bridge ? !!bridge.isOnDeviceVoiceRecognitionAvailable?.() : isBrowserLocalVoiceAvailable();
  }, [bridge]);

  const endCall = useCallback(() => {
    activeRef.current = false;
    stopRecognition();
    stopReply();
    setCallState('idle');
    setLastReply('');
    setLastTranscript('');
    setMuted(false);
  }, [stopRecognition, stopReply]);

