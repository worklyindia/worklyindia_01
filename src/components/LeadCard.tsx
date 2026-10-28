import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Mail, 
  Phone, 
  MapPin, 
  Briefcase, 
  Star, 
  Eye, 
  ShoppingCart,
  UserCheck 
} from "lucide-react";
import { Lead } from "@/types/leads";

interface LeadCardProps {
  lead: Lead;
  isPurchased: boolean;
  onPurchase: (leadId: number) => void;
}

const LeadCard = ({ lead, isPurchased, onPurchase }: LeadCardProps) => {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "hot": return "bg-red-500 text-white";
      case "warm": return "bg-orange-500 text-white"; 
      case "fresh": return "bg-green-500 text-white";
      default: return "bg-gray-500 text-white";
    }
  };

  return (
    <Card className="hover:shadow-lg transition-all duration-200 border-0 shadow-sm">
      <CardHeader className="pb-3 lg:pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2 lg:space-x-3 min-w-0 flex-1">
            <Avatar className="w-10 h-10 lg:w-12 lg:h-12 flex-shrink-0">
              <AvatarFallback className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm">
                {lead.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base lg:text-lg text-slate-900 truncate">{lead.name}</CardTitle>
              <CardDescription className="text-sm text-slate-600 truncate">{lead.position}</CardDescription>
            </div>
          </div>
          <Badge className={`${getStatusColor(lead.status)} text-xs flex-shrink-0 ml-2`}>
            {lead.status}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3 lg:space-y-4 p-4 lg:p-6">
        <div className="space-y-2 lg:space-y-3 text-sm">
          <div className="flex items-center space-x-2 lg:space-x-3">
            <Mail className="h-4 w-4 text-slate-400 flex-shrink-0" />
            <span className="truncate text-slate-700 flex-1 text-xs lg:text-sm">
              {isPurchased ? lead.fullData.email : lead.email}
            </span>
            {!isPurchased && (
              <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-600 flex-shrink-0">Hidden</Badge>
            )}
          </div>
          
          <div className="flex items-center space-x-2 lg:space-x-3">
            <Phone className="h-4 w-4 text-slate-400 flex-shrink-0" />
            <span className="text-slate-700 flex-1 text-xs lg:text-sm">
              {isPurchased ? lead.fullData.phone : lead.phone}
            </span>
            {!isPurchased && (
              <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-600 flex-shrink-0">Hidden</Badge>
            )}
          </div>
          
          <div className="flex items-center space-x-2 lg:space-x-3">
            <MapPin className="h-4 w-4 text-slate-400 flex-shrink-0" />
            <span className="text-slate-700 text-xs lg:text-sm truncate">{lead.location}</span>
          </div>
          
          <div className="flex items-center space-x-2 lg:space-x-3">
            <Briefcase className="h-4 w-4 text-slate-400 flex-shrink-0" />
            <span className="text-slate-700 text-xs lg:text-sm">{lead.experience} experience</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 lg:gap-2">
          {lead.skills.slice(0, 2).map((skill, index) => (
            <Badge key={index} variant="secondary" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200">
              {skill}
            </Badge>
          ))}
          {lead.skills.length > 2 && (
            <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-600">
              +{lead.skills.length - 2}
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="flex items-center space-x-1">
            <Star className="h-3 w-3 text-yellow-500 fill-current" />
            <span className="text-xs text-slate-600">{lead.rating}</span>
            {lead.verified && (
              <Badge variant="secondary" className="text-xs bg-green-50 text-green-700 border-green-200 ml-2">
                Verified
              </Badge>
            )}
          </div>
          <span className="text-sm font-medium text-indigo-600">₹{lead.price}</span>
        </div>

        <div className="flex gap-2 pt-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="flex-1 text-xs">
                <Eye className="h-3 w-3 mr-1" />
                View
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-3">
                  <Avatar className="w-12 h-12">
                    <AvatarFallback className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                      {lead.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <span className="text-xl">{lead.name}</span>
                    <p className="text-sm font-normal text-slate-600">{lead.position}</p>
                  </div>
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Experience</p>
                    <p className="text-sm text-slate-600">{lead.experience}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">Expected Salary</p>
                    <p className="text-sm text-slate-600">{lead.expectedSalary}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">Current Company</p>
                    <p className="text-sm text-slate-600">{lead.currentCompany}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">Education</p>
                    <p className="text-sm text-slate-600">{lead.education}</p>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">Skills</p>
                  <div className="flex flex-wrap gap-2">
                    {lead.skills.map((skill, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          {isPurchased ? (
            <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-xs">
              <UserCheck className="h-3 w-3 mr-1" />
              Purchased
            </Button>
          ) : (
            <Button 
              size="sm" 
              className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-xs"
              onClick={() => onPurchase(lead.id)}
            >
              <ShoppingCart className="h-3 w-3 mr-1" />
              Buy ₹{lead.price}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default LeadCard;