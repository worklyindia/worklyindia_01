import { Check, CheckCheck, Clock, AlertCircle } from "lucide-react";

export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

interface MessageStatusIconProps {
  status: MessageStatus | string;
  className?: string;
}

export function MessageStatusIcon({ status, className = "" }: MessageStatusIconProps) {
  const normalizedStatus = status.toLowerCase() as MessageStatus;
  
  switch (normalizedStatus) {
    case 'read':
      return (
        <CheckCheck 
          className={`h-[14px] w-[14px] text-[#53BDEB] ${className}`} 
          strokeWidth={2.5}
        />
      );
    case 'delivered':
      return (
        <CheckCheck 
          className={`h-[14px] w-[14px] text-[#8696A0] ${className}`} 
          strokeWidth={2.5}
        />
      );
    case 'sent':
      return (
        <Check 
          className={`h-[14px] w-[14px] text-[#8696A0] ${className}`} 
          strokeWidth={2.5}
        />
      );
    case 'failed':
      return (
        <AlertCircle 
          className={`h-[14px] w-[14px] text-red-500 ${className}`} 
          strokeWidth={2}
        />
      );
    case 'pending':
    default:
      return (
        <Clock 
          className={`h-[14px] w-[14px] text-[#8696A0] ${className}`} 
          strokeWidth={2}
        />
      );
  }
}
