import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { 
  ThumbsUp, FileText, Clock, Calendar, 
  CheckCircle, XCircle, HelpCircle, Phone, ChevronDown, ChevronUp
} from "lucide-react";

interface QuickRepliesProps {
  onSelect: (message: string) => void;
  disabled?: boolean;
}

const QUICK_REPLIES = [
  {
    id: 'thanks',
    label: 'Thank You',
    message: 'Thank you for reaching out! We appreciate your interest.',
    icon: ThumbsUp,
    category: 'general'
  },
  {
    id: 'resume',
    label: 'Send Resume',
    message: 'Please share your updated resume for this position.',
    icon: FileText,
    category: 'jobseeker'
  },
  {
    id: 'call_schedule',
    label: 'Schedule Call',
    message: 'When would be a good time for a quick call? Please share your availability.',
    icon: Calendar,
    category: 'general'
  },
  {
    id: 'call_now',
    label: 'Call Now',
    message: 'I am available for a call right now. Please call me at your convenience.',
    icon: Phone,
    category: 'general'
  },
  {
    id: 'wait',
    label: 'Please Wait',
    message: 'Please wait while we review your application. We will get back to you shortly.',
    icon: Clock,
    category: 'jobseeker'
  },
  {
    id: 'shortlisted',
    label: 'Shortlisted',
    message: 'Congratulations! Your profile has been shortlisted. Our team will contact you soon for the next steps.',
    icon: CheckCircle,
    category: 'jobseeker'
  },
  {
    id: 'not_selected',
    label: 'Not Selected',
    message: 'Thank you for your application. Unfortunately, we have decided to proceed with other candidates. We wish you the best in your job search.',
    icon: XCircle,
    category: 'jobseeker'
  },
  {
    id: 'more_info',
    label: 'More Info',
    message: 'Could you please provide more details about your query?',
    icon: HelpCircle,
    category: 'general'
  },
  {
    id: 'interview_confirm',
    label: 'Interview Confirm',
    message: 'Your interview has been scheduled. Please confirm your availability by replying YES.',
    icon: Calendar,
    category: 'jobseeker'
  },
  {
    id: 'documents',
    label: 'Documents Needed',
    message: 'Please share the following documents:\n- Aadhar Card\n- PAN Card\n- Last 3 months payslips\n- Education certificates',
    icon: FileText,
    category: 'jobseeker'
  }
];

export function QuickReplies({ onSelect, disabled }: QuickRepliesProps) {
  const [expanded, setExpanded] = useState(false);

  const displayedReplies = expanded ? QUICK_REPLIES : QUICK_REPLIES.slice(0, 5);

  return (
    <div className="bg-[#111B21] border-t border-[#222D34] px-2 py-2">
      <div className="flex items-center gap-2 mb-2 px-1">
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-xs h-6 ml-auto text-[#00A884] hover:text-[#00A884] hover:bg-[#202C33] p-1"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3 mr-1" />
              Less
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3 mr-1" />
              More
            </>
          )}
        </Button>
      </div>
      
      <ScrollArea className="w-full">
        <div className="flex gap-2 pb-1">
          {displayedReplies.map((reply) => (
            <Button
              key={reply.id}
              variant="outline"
              size="sm"
              className="flex-shrink-0 h-8 text-xs gap-1.5 bg-[#202C33] border-[#374045] text-[#E9EDEF] hover:bg-[#2A3942] hover:text-white hover:border-[#00A884] rounded-full px-3"
              onClick={() => onSelect(reply.message)}
              disabled={disabled}
            >
              <reply.icon className="h-3.5 w-3.5 text-[#00A884]" />
              {reply.label}
            </Button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="bg-[#202C33]" />
      </ScrollArea>
    </div>
  );
}
