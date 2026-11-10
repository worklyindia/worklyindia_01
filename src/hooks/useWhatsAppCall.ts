import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CallState {
  isCallScreenOpen: boolean;
  isCallActive: boolean;
  callType: 'voice' | 'video' | null;
}

interface UseWhatsAppCallReturn {
  callState: CallState;
  initiateCall: (phoneNumber: string, type?: 'voice' | 'video') => void;
  endCall: () => void;
  closeCallScreen: () => void;
  openWhatsAppCall: (phoneNumber: string) => void;
  openNativeCall: (phoneNumber: string) => void;
}

export const useWhatsAppCall = (): UseWhatsAppCallReturn => {
  const [callState, setCallState] = useState<CallState>({
    isCallScreenOpen: false,
    isCallActive: false,
    callType: null
  });

  const initiateCall = useCallback((phoneNumber: string, type: 'voice' | 'video' = 'voice') => {
    setCallState({
      isCallScreenOpen: true,
      isCallActive: true,
      callType: type
    });
  }, []);

  const endCall = useCallback(() => {
    setCallState(prev => ({
      ...prev,
      isCallActive: false
    }));
  }, []);

  const closeCallScreen = useCallback(() => {
    setCallState({
      isCallScreenOpen: false,
      isCallActive: false,
      callType: null
    });
  }, []);

  // Open WhatsApp app to make call
  const openWhatsAppCall = useCallback((phoneNumber: string) => {
    const formattedNumber = phoneNumber.replace(/\D/g, '');
    window.open(`https://wa.me/${formattedNumber}`, '_blank');
    toast.success("Opening WhatsApp...");
  }, []);

  // Make native phone call
  const openNativeCall = useCallback((phoneNumber: string) => {
    const formattedNumber = phoneNumber.replace(/\D/g, '');
    window.location.href = `tel:+${formattedNumber}`;
  }, []);

  return {
    callState,
    initiateCall,
    endCall,
    closeCallScreen,
    openWhatsAppCall,
    openNativeCall
  };
};
