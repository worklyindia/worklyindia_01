import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed } from "lucide-react"
import { format } from "date-fns"

export type CallStatus = 'initiated' | 'ringing' | 'connected' | 'completed' | 'missed' | 'failed' | 'busy' | 'no_answer'
export type CallType = 'outbound' | 'inbound'

interface CallMessageProps {
  callType: CallType
  status: CallStatus
  durationSeconds?: number | null
  createdAt: string
  isOwn: boolean
}

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const getCallIcon = (callType: CallType, status: CallStatus, isOwn: boolean) => {
  const iconClass = "w-4 h-4"
  
  if (status === 'missed' || status === 'no_answer') {
    return <PhoneMissed className={`${iconClass} text-red-500`} />
  }
  if (callType === 'inbound') {
    return <PhoneIncoming className={`${iconClass} ${isOwn ? 'text-[#53bdeb]' : 'text-[#25D366]'}`} />
  }
  if (callType === 'outbound') {
    return <PhoneOutgoing className={`${iconClass} ${isOwn ? 'text-[#53bdeb]' : 'text-[#25D366]'}`} />
  }
  return <Phone className={iconClass} />
}

const getCallLabel = (callType: CallType, status: CallStatus, durationSeconds?: number | null): string => {
  const isInbound = callType === 'inbound';
  
  switch (status) {
    case 'initiated':
      return isInbound ? 'Incoming call...' : 'Calling...'
    case 'ringing':
      return isInbound ? 'Incoming call...' : 'Ringing...'
    case 'connected':
      return 'On call...'
    case 'completed':
      if (durationSeconds && durationSeconds > 0) {
        return `${isInbound ? 'Incoming' : 'Outgoing'} voice call • ${formatDuration(durationSeconds)}`
      }
      return `${isInbound ? 'Incoming' : 'Outgoing'} voice call`
    case 'missed':
      return isInbound ? 'Missed voice call' : 'No answer'
    case 'failed':
      return 'Call failed'
    case 'busy':
      return 'Line busy'
    case 'no_answer':
      return isInbound ? 'Missed voice call' : 'No answer'
    default:
      return `${isInbound ? 'Incoming' : 'Outgoing'} voice call`
  }
}

const formatTime12Hour = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).toLowerCase();
};

export function CallMessage({ callType, status, durationSeconds, createdAt, isOwn }: CallMessageProps) {
  const icon = getCallIcon(callType, status, isOwn)
  const label = getCallLabel(callType, status, durationSeconds)
  const isMissedOrFailed = status === 'missed' || status === 'no_answer' || status === 'failed' || status === 'busy'
  const isInProgress = status === 'initiated' || status === 'ringing' || status === 'connected'

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-200`}>
      <div 
        className={`max-w-[85%] md:max-w-[65%] rounded-lg px-3 py-2 shadow-sm ${
          isOwn 
            ? 'bg-[#005c4b] text-white rounded-tr-none' 
            : 'bg-[#202c33] text-white rounded-tl-none'
        }`}
      >
        <div className="flex items-center gap-2">
          <div className="flex-shrink-0">
            {icon}
          </div>
          <div className="flex flex-col min-w-0">
            <span className={`text-sm font-medium ${
              isMissedOrFailed ? 'text-red-400' : isInProgress ? 'text-[#53bdeb]' : ''
            }`}>
              {label}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-end gap-1 mt-1">
          <span className="text-[10px] text-white/60">
            {formatTime12Hour(createdAt)}
          </span>
        </div>
      </div>
    </div>
  )
}
