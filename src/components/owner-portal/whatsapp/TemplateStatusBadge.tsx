import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle, Clock, XCircle } from "lucide-react";

interface TemplateStatusBadgeProps {
  status: string;
  rejectionReason?: string | null;
}

export function TemplateStatusBadge({ status, rejectionReason }: TemplateStatusBadgeProps) {
  const normalizedStatus = (status || "PENDING").toUpperCase();

  if (normalizedStatus === "APPROVED") {
    return (
      <Badge className="bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/20">
        <CheckCircle className="mr-1 h-3 w-3" />
        Approved
      </Badge>
    );
  }

  if (normalizedStatus === "REJECTED") {
    if (rejectionReason) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="destructive" className="cursor-help">
                <XCircle className="mr-1 h-3 w-3" />
                Rejected
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-sm">{rejectionReason}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    return (
      <Badge variant="destructive">
        <XCircle className="mr-1 h-3 w-3" />
        Rejected
      </Badge>
    );
  }

  // PENDING
  return (
    <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 hover:bg-yellow-500/20">
      <Clock className="mr-1 h-3 w-3" />
      Pending
    </Badge>
  );
}
