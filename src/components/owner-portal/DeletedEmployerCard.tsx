import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NativeFeedbackButton } from "@/components/NativeFeedbackButton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  MapPin, 
  Mail, 
  Phone, 
  Building2, 
  Calendar, 
  RotateCcw,
  Clock
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import VerificationBadge from "@/components/VerificationBadge";
import { useToast } from "@/hooks/use-toast";
import { getCompanyDisplayLocation } from "@/utils/locationUtils";

interface DeletedEmployerCardProps {
  employer: {
    user_id: string;
    company_name: string;
    email: string;
    phone: string;
    location: string;
    industry: string;
    company_size: string;
    website: string;
    description: string;
    logo_url: string;
    is_verified: boolean;
    badge_color?: string;
    account_status_reason?: string;
    created_at: string;
  };
  onRecover: (userId: string) => Promise<void>;
}

const DeletedEmployerCard: React.FC<DeletedEmployerCardProps> = ({ 
  employer, 
  onRecover
}) => {
  const [isRecovering, setIsRecovering] = useState(false);
  const { toast } = useToast();

  const handleRecover = async () => {
    setIsRecovering(true);
    try {
      await onRecover(employer.user_id);
      toast({
        title: "Success",
        description: `${employer.company_name} has been recovered successfully`,
      });
    } catch (error: any) {
      console.error('Failed to recover company:', error);
      toast({
        title: "Error",
        description: error.message || `Failed to recover ${employer.company_name}. Please try again.`,
        variant: "destructive",
      });
    } finally {
      setIsRecovering(false);
    }
  };

  const fullAddress = getCompanyDisplayLocation(employer);

  return (
    <Card className="bg-gradient-to-br from-red-50 to-orange-50 border border-red-200 shadow-sm hover:shadow-md transition-all duration-200">
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          <Avatar className="h-12 w-12 border border-white shadow-sm flex-shrink-0 grayscale">
            <AvatarImage src={employer.logo_url} alt={employer.company_name} />
            <AvatarFallback className="bg-gradient-to-br from-gray-400 to-gray-600 text-white font-semibold text-xs">
              {employer.company_name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-1 min-w-0 flex-1">
                <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-1 truncate">
                  <span className="truncate">{employer.company_name}</span>
                  {employer.is_verified && (
                    <VerificationBadge 
                      color={employer.badge_color as 'gold' | 'blue' | 'green' | 'silver'} 
                      size={12} 
                      className="flex-shrink-0 grayscale"
                    />
                  )}
                </h3>
              </div>
              <Badge variant="destructive" className="text-xs px-1 py-0">
                Deleted
              </Badge>
            </div>

            <div className="space-y-1">
              <div className="flex items-center text-xs text-gray-600">
                <MapPin className="w-3 h-3 mr-1 text-gray-400 flex-shrink-0" />
                <span className="flex-1 truncate" title={fullAddress}>
                  {fullAddress || 'Location not specified'}
                </span>
              </div>

              <div className="flex items-center text-xs text-gray-600">
                <Mail className="w-3 h-3 mr-1 text-gray-400 flex-shrink-0" />
                <span className="truncate">{employer.email}</span>
              </div>

              {employer.phone && (
                <div className="flex items-center text-xs text-gray-600">
                  <Phone className="w-3 h-3 mr-1 text-gray-400 flex-shrink-0" />
                  <span className="truncate">{employer.phone}</span>
                </div>
              )}

              <div className="flex items-center text-xs text-gray-600">
                <Building2 className="w-3 h-3 mr-1 text-gray-400 flex-shrink-0" />
                <span className="truncate">{employer.industry || 'Industry not specified'}</span>
              </div>

              <div className="flex items-center text-xs text-red-600">
                <Clock className="w-3 h-3 mr-1 flex-shrink-0" />
                <span className="truncate">
                  Recently deleted
                </span>
              </div>

              {employer.account_status_reason && (
                <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200 mt-2">
                  <strong>Reason:</strong> {employer.account_status_reason}
                </div>
              )}
            </div>

            <div className="flex gap-1 pt-3">
              <NativeFeedbackButton 
                variant="default" 
                size="sm" 
                onClick={handleRecover}
                disabled={isRecovering}
                className="flex-1 text-xs h-7 px-2 bg-green-600 hover:bg-green-700"
                feedbackType="success"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                {isRecovering ? 'Recovering...' : 'Recover Company'}
              </NativeFeedbackButton>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DeletedEmployerCard;