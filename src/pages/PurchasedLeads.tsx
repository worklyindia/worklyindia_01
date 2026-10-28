import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Search, 
  Eye, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar,
  Briefcase,
  Star,
  Download,
  TrendingUp,
  Users,
  DollarSign,
  Bell,
  Settings,
  BarChart3,
  UserCheck,
  ArrowLeft,
  Wallet,
  CheckCircle,
  Copy
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import LottieSearchIcon from "@/components/LottieSearchIcon";

const mockPurchasedLeads = [
  {
    id: 3,
    name: "अमित कुमार",
    email: "amit.kumar@email.com",
    phone: "+91 76543 21098",
    position: "Data Analyst", 
    experience: "2 years",
    location: "Bangalore, Karnataka",
    appliedDate: "2024-01-13",
    purchasedDate: "2024-01-18",
    status: "Purchased",
    skills: ["Python", "SQL", "Tableau"],
    expectedSalary: "₹6,00,000",
    currentCompany: "Infosys",
    education: "B.Sc Statistics",
    price: 400,
    rating: 4.2,
    verified: false,
    purchased: true
  },
  {
    id: 6,
    name: "रीता सिंह",
    email: "rita.singh@email.com",
    phone: "+91 95432 10987",
    position: "UX Designer",
    experience: "4 years",
    location: "Gurgaon, Haryana",
    appliedDate: "2024-01-12",
    purchasedDate: "2024-01-17",
    status: "Purchased",
    skills: ["Figma", "Adobe XD", "User Research"],
    expectedSalary: "₹10,00,000",
    currentCompany: "Zomato",
    education: "B.Des Visual Communication",
    price: 650,
    rating: 4.6,
    verified: true,
    purchased: true
  }
];

const PurchasedLeads = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLead, setSelectedLead] = useState(null);
  const [showWallet, setShowWallet] = useState(false);

  const filteredLeads = mockPurchasedLeads.filter(lead => {
    return lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           lead.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
           lead.location.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${type} copied to clipboard`,
    });
  };

  const exportLeads = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Name,Email,Phone,Position,Experience,Location,Company,Expected Salary,Rating\n"
      + filteredLeads.map(lead => 
          `${lead.name},${lead.email},${lead.phone},${lead.position},${lead.experience},${lead.location},${lead.currentCompany},${lead.expectedSalary},${lead.rating}`
        ).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "purchased_leads.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Export Complete",
      description: "Purchased leads exported successfully",
    });
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200 flex-shrink-0 z-30">
        <div className="w-full px-3 sm:px-4 lg:px-6">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/lead-management')}
                className="text-slate-600 hover:text-slate-900 p-1 sm:p-2"
              >
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <UserCheck className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">Purchased Leads</h1>
                  <p className="text-xs text-slate-500 hidden sm:block">Your owned candidate leads</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={exportLeads}
                className="hidden md:flex text-slate-600 hover:text-slate-900 p-1 sm:p-2"
              >
                <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                Export
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/lead-notification-settings')} className="text-slate-600 hover:text-slate-900 p-1 sm:p-2">
                <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/lead-settings')} className="text-slate-600 hover:text-slate-900 p-1 sm:p-2">
                <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs sm:text-sm font-medium">A</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
        <div className="p-4 sm:p-6 lg:p-8">
          {/* Purchased Leads Stats Banner */}
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-6 mb-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">✓ Purchased Leads</h2>
                <p className="text-green-100 mt-1">Complete contact information available</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold">{filteredLeads.length}</p>
                <p className="text-green-100 text-sm">Owned Leads</p>
              </div>
            </div>
          </div>

          {/* Search and Export */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none"><LottieSearchIcon size={16} /></div>
              <Input
                placeholder="Search purchased leads..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-slate-200 focus:border-green-500 focus:ring-green-500 h-10"
              />
            </div>
            <Button 
              variant="outline" 
              onClick={exportLeads}
              className="sm:hidden"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>

          {/* Purchased Leads Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
            {filteredLeads.map((lead) => (
              <Card key={lead.id} className="hover:shadow-lg transition-all duration-200 border-0 shadow-sm border-l-4 border-l-green-500">
                <CardHeader className="pb-3 lg:pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2 lg:space-x-3 min-w-0 flex-1">
                      <Avatar className="w-10 h-10 lg:w-12 lg:h-12 flex-shrink-0">
                        <AvatarImage src={`/api/placeholder/48/48`} />
                        <AvatarFallback className="bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm">
                          {lead.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-base lg:text-lg text-slate-900 truncate flex items-center">
                          {lead.name}
                          <CheckCircle className="h-4 w-4 text-green-500 ml-2" />
                        </CardTitle>
                        <CardDescription className="text-sm text-slate-600 truncate">{lead.position}</CardDescription>
                      </div>
                    </div>
                    <Badge className="bg-green-500 text-white text-xs flex-shrink-0 ml-2">
                      OWNED
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 lg:space-y-4 p-4 lg:p-6">
                  <div className="space-y-2 lg:space-y-3 text-sm">
                    <div className="flex items-center space-x-2 lg:space-x-3">
                      <Mail className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      <span className="truncate text-slate-700 flex-1 text-xs lg:text-sm">
                        {lead.email}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="p-1 h-6 w-6 hover:bg-slate-100"
                        onClick={() => copyToClipboard(lead.email, "Email")}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex items-center space-x-2 lg:space-x-3">
                      <Phone className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      <span className="text-slate-700 flex-1 text-xs lg:text-sm">
                        {lead.phone}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="p-1 h-6 w-6 hover:bg-slate-100"
                        onClick={() => copyToClipboard(lead.phone, "Phone")}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex items-center space-x-2 lg:space-x-3">
                      <MapPin className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      <span className="text-slate-700 text-xs lg:text-sm truncate">{lead.location}</span>
                    </div>
                    <div className="flex items-center space-x-2 lg:space-x-3">
                      <Briefcase className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      <span className="text-slate-700 text-xs lg:text-sm">{lead.experience} experience</span>
                    </div>
                    <div className="flex items-center space-x-2 lg:space-x-3">
                      <Calendar className="h-4 w-4 text-slate-400 flex-shrink-0" />
                      <span className="text-slate-700 text-xs lg:text-sm">Purchased: {lead.purchasedDate}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 lg:gap-2">
                    {lead.skills.slice(0, 3).map((skill, index) => (
                      <Badge key={index} variant="secondary" className="text-xs bg-green-50 text-green-700 border-green-200">
                        {skill}
                      </Badge>
                    ))}
                    {lead.skills.length > 3 && (
                      <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-600">
                        +{lead.skills.length - 3}
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
                    <span className="text-sm font-medium text-green-600">₹{lead.price} Paid</span>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => setSelectedLead(lead)}>
                          <Eye className="h-3 w-3 mr-1" />
                          View Details
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        {selectedLead && (
                          <>
                            <DialogHeader>
                              <DialogTitle className="flex items-center space-x-3">
                                <Avatar className="w-12 h-12">
                                  <AvatarFallback className="bg-gradient-to-r from-green-500 to-emerald-600 text-white">
                                    {selectedLead.name.split(' ').map(n => n[0]).join('')}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <span className="text-xl flex items-center">
                                    {selectedLead.name}
                                    <CheckCircle className="h-5 w-5 text-green-500 ml-2" />
                                  </span>
                                  <p className="text-sm font-normal text-slate-600">{selectedLead.position}</p>
                                </div>
                              </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 pt-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-sm font-medium text-slate-900">Email</p>
                                  <p className="text-sm text-slate-600">{selectedLead.email}</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-slate-900">Phone</p>
                                  <p className="text-sm text-slate-600">{selectedLead.phone}</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-slate-900">Current Company</p>
                                  <p className="text-sm text-slate-600">{selectedLead.currentCompany}</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-slate-900">Expected Salary</p>
                                  <p className="text-sm text-slate-600">{selectedLead.expectedSalary}</p>
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </DialogContent>
                    </Dialog>
                    
                    <Button 
                      size="sm" 
                      className="flex-1 bg-green-600 hover:bg-green-700 text-xs"
                      onClick={() => window.open(`mailto:${lead.email}`)}
                    >
                      <Mail className="h-3 w-3 mr-1" />
                      Contact
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default PurchasedLeads;