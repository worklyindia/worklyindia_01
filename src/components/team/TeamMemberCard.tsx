import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeFeedbackButton } from "@/components/NativeFeedbackButton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Crown, Shield, Flag, Headset, DollarSign, FileText, Eye } from "lucide-react";
import { TeamMember } from "@/hooks/useTeamManagement";
import { formatDateWithSeconds } from "@/utils/dateFormatUtils";
import { PermissionViewer } from "./PermissionViewer";

interface TeamMemberCardProps {
  member: TeamMember;
  onEdit: (member: TeamMember) => void;
  onRemove: (member: TeamMember) => void;
  onChangeRole?: (member: TeamMember) => void;
  isSuperAdmin: boolean;
  isSelected?: boolean;
  onSelectToggle?: (memberId: string) => void;
}

const roleConfig: Record<string, { icon: any; color: string; label: string }> = {
  owner: { icon: Crown, color: "bg-yellow-500", label: "Owner" },
  admin: { icon: Shield, color: "bg-blue-500", label: "Admin" },
  moderator: { icon: Flag, color: "bg-green-500", label: "Moderator" },
  support: { icon: Headset, color: "bg-purple-500", label: "Support" },
  finance_manager: { icon: DollarSign, color: "bg-orange-500", label: "Finance Manager" },
  content_manager: { icon: FileText, color: "bg-orange-400", label: "Content Manager" },
};

export function TeamMemberCard({ 
  member, 
  onEdit, 
  onRemove, 
  onChangeRole,
  isSuperAdmin,
  isSelected = false,
  onSelectToggle
}: TeamMemberCardProps) {
  const [showPermissions, setShowPermissions] = useState(false);
  
  const config = roleConfig[member.role] || { icon: Shield, color: "bg-gray-500", label: member.role };
  const Icon = config.icon;
  const initials = member.full_name
    ? member.full_name.split(' ').map(n => n[0]).join('').toUpperCase()
    : member.email[0].toUpperCase();

  const isEmailMissing = member.email === 'Email not available' || !member.email || member.email.includes('@') === false;

  return (
    <Card className="p-3 md:p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2 md:gap-3 flex-1 min-w-0">
          <Avatar className="h-10 w-10 md:h-12 md:w-12 shrink-0">
            <AvatarFallback className={`${config.color} text-white`}>
              {initials}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="font-semibold text-sm truncate">
                {member.full_name || member.email}
              </h3>
              <Badge variant="secondary" className="flex items-center gap-1 shrink-0 text-xs">
                <Icon className="h-3 w-3" />
                <span className="hidden sm:inline">{config.label}</span>
              </Badge>
            </div>
            
            {isEmailMissing ? (
              <p className="text-xs sm:text-sm text-muted-foreground truncate mb-1">
                Email not available
              </p>
            ) : (
              <a 
                href={`mailto:${member.email}`}
                className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 truncate mb-1 block hover:underline"
                title={member.email}
              >
                {member.email}
              </a>
            )}
            
            <div className="space-y-1">
              {member.phone && (
                <a 
                  href={`tel:${member.phone}`}
                  className="text-[10px] sm:text-xs text-blue-600 hover:text-blue-800 hover:underline block"
                >
                  {member.phone}
                </a>
              )}
              {member.location && (
                <div className="text-[10px] sm:text-xs text-muted-foreground">
                  {member.location}
                </div>
              )}
            </div>
            
            {member.last_sign_in_at && (
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                Last active: {formatDateWithSeconds(member.last_sign_in_at)}
              </p>
            )}
            
            {isSuperAdmin && onSelectToggle && (
              <div className="mt-2 flex items-center gap-2">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onSelectToggle(member.user_id)}
                />
                <span className="text-xs text-muted-foreground">Select member</span>
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <NativeFeedbackButton
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => setShowPermissions(true)}
                        feedbackType="tap"
                      >
                        <Eye className="h-4 w-4" />
                      </NativeFeedbackButton>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>View Permissions</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <Badge variant="secondary" className="flex items-center gap-1 shrink-0 text-xs ml-auto">
                  <Icon className="h-3 w-3" />
                  <span>{config.label}</span>
                </Badge>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <PermissionViewer
        member={member}
        open={showPermissions}
        onClose={() => setShowPermissions(false)}
      />
    </Card>
  );
}
