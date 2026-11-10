import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Search, 
  Filter, 
  Download, 
  Eye, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar,
  Briefcase,
  Star,
  ShoppingCart,
  TrendingUp,
  Users,
  DollarSign,
  Menu,
  Settings,
  Bell,
  BarChart3,
  UserCheck,
  Target,
  FileText,
  LogOut
} from "lucide-react";
import LottieSearchIcon from "@/components/LottieSearchIcon";

// Mock data for demonstration
const mockLeads = [
  {
    id: 1,
    name: "राहुल शर्मा",
    email: "r****@email.com",
    phone: "+91 98765 ****",
    position: "Software Developer",
    experience: "3 years",
    location: "Mumbai, Maharashtra",
    appliedDate: "2024-01-15",
    status: "Fresh",
    skills: ["React", "Node.js", "MongoDB"],
    expectedSalary: "₹8,00,000",
    currentCompany: "TCS",
    education: "B.Tech Computer Science",
    price: 500,
    rating: 4.5,
    verified: true,
    purchased: false,
    fullData: {
      email: "rahul.sharma@email.com",
      phone: "+91 98765 43210"
    }
  },
  {
    id: 2,
    name: "प्रिया पटेल",
    email: "p****@email.com", 
    phone: "+91 87654 ****",
    position: "Digital Marketing Manager",
    experience: "5 years",
    location: "Delhi, NCR",
    appliedDate: "2024-01-14",
    status: "Hot",
    skills: ["SEO", "SEM", "Social Media"],
    expectedSalary: "₹12,00,000",
    currentCompany: "Wipro",
    education: "MBA Marketing",
    price: 750,
    rating: 4.8,
    verified: true,
    purchased: false,
    fullData: {
      email: "priya.patel@email.com",
      phone: "+91 87654 32109"
    }
  },
  {
    id: 3,
    name: "अमित कुमार",
    email: "a****@email.com",
    phone: "+91 76543 ****",
    position: "Data Analyst", 
    experience: "2 years",
    location: "Bangalore, Karnataka",
    appliedDate: "2024-01-13",
    status: "Warm",
    skills: ["Python", "SQL", "Tableau"],
    expectedSalary: "₹6,00,000",
    currentCompany: "Infosys",
    education: "B.Sc Statistics",
    price: 400,
    rating: 4.2,
    verified: false,
    purchased: true,
    fullData: {
      email: "amit.kumar@email.com",
      phone: "+91 76543 21098"
    }
  }
];

const LeadManagement = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedLead, setSelectedLead] = useState(null);
  const [purchasedLeads, setPurchasedLeads] = useState<number[]>([3]); // Lead ID 3 is already purchased

  const filteredLeads = mockLeads.filter(lead => {
    const matchesSearch = lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         lead.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         lead.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === "all" || lead.status.toLowerCase() === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "hot": return "bg-red-500 text-white";
      case "warm": return "bg-orange-500 text-white"; 
      case "fresh": return "bg-green-500 text-white";
      default: return "bg-gray-500 text-white";
    }
  };

  const handlePurchaseLead = (leadId: number) => {
    setPurchasedLeads(prev => [...prev, leadId]);
  };

  const isLeadPurchased = (leadId: number) => {
    return purchasedLeads.includes(leadId);
  };

  const stats = [
    {
      title: "Total Leads",
      value: "1,247",
      icon: Users,
      change: "+12% from last month",
      color: "text-indigo-600",
      bgColor: "bg-indigo-50"
    },
    {
      title: "Revenue This Month",
      value: "₹2,45,000",
      icon: DollarSign,
      change: "+15% from last month",
      color: "text-green-600",
      bgColor: "bg-green-50"
    },
    {
      title: "Conversion Rate",
      value: "23.5%",
      icon: Target,
      change: "+3% from last month", 
      color: "text-purple-600",
      bgColor: "bg-purple-50"
    }
  ];

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
      {/* Modern Dashboard Header */}
      <header className="bg-white shadow-sm border-b border-slate-200 flex-shrink-0 z-30">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900">LeadFlow Pro</h1>
                  <p className="text-xs text-slate-500">Lead Management System</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900">
                <Bell className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900">
                <Settings className="h-5 w-5" />
              </Button>
              <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">A</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout with Sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Navigation - Hidden on mobile */}
        <aside className="hidden lg:block w-64 bg-white shadow-sm border-r border-slate-200 flex-shrink-0 overflow-y-auto">
          <nav className="p-4">
            <div className="space-y-2">
              <Button 
                variant="ghost" 
                className="w-full justify-start text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                onClick={() => navigate('/all-leads')}
              >
                <Users className="mr-3 h-5 w-5" />
                All Leads
              </Button>
              <Button 
                variant="ghost" 
                className="w-full justify-start text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                onClick={() => navigate('/purchased-leads')}
              >
                <UserCheck className="mr-3 h-5 w-5" />
                Purchased
              </Button>
              <Button variant="ghost" className="w-full justify-start text-slate-600 hover:text-slate-900 hover:bg-slate-50">
                <FileText className="mr-3 h-5 w-5" />
                Reports
              </Button>
            </div>
            
            <div className="mt-8 pt-8 border-t border-slate-200">
              <Button variant="ghost" className="w-full justify-start text-slate-600 hover:text-slate-900 hover:bg-slate-50">
                <Settings className="mr-3 h-5 w-5" />
                Settings
              </Button>
              <Button variant="ghost" className="w-full justify-start text-slate-600 hover:text-slate-900 hover:bg-slate-50">
                <LogOut className="mr-3 h-5 w-5" />
                Logout
              </Button>
            </div>
          </nav>
        </aside>

        {/* Main Content with Proper Scroll */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          <div className="p-4 sm:p-6 lg:p-8">
          {/* Page Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">Lead Management Dashboard</h2>
            <p className="text-slate-600">Monitor and manage your lead pipeline effectively</p>
          </div>

          {/* Mobile Navigation Tabs - Visible only on mobile */}
          <div className="lg:hidden mb-6">
            <div className="flex overflow-x-auto scrollbar-hide bg-white rounded-lg shadow-sm border border-slate-200">
              <Button 
                variant="ghost" 
                className="flex-shrink-0 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-none first:rounded-l-lg"
                onClick={() => navigate('/all-leads')}
              >
                <Users className="mr-2 h-4 w-4" />
                All Leads
              </Button>
              <Button 
                variant="ghost" 
                className="flex-shrink-0 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-none last:rounded-r-lg"
                onClick={() => navigate('/purchased-leads')}
              >
                <UserCheck className="mr-2 h-4 w-4" />
                Purchased
              </Button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8">
            {stats.map((stat, index) => (
              <Card key={index} className="bg-white shadow-sm hover:shadow-md transition-shadow border-0">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm text-slate-600 font-medium">{stat.title}</p>
                      <p className="text-2xl font-bold text-slate-900 mt-2">{stat.value}</p>
                      <p className={`text-sm ${stat.color} mt-1 font-medium`}>{stat.change}</p>
                    </div>
                    <div className={`${stat.bgColor} p-3 rounded-lg`}>
                      <stat.icon className={`h-6 w-6 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Main Content Tabs */}
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-6">
              <Tabs defaultValue="leads" className="space-y-6">
                <div className="flex items-center justify-center">
                  <TabsList className="bg-slate-100">
                    <TabsTrigger value="leads" className="data-[state=active]:bg-white">All Leads</TabsTrigger>
                    <TabsTrigger value="analytics" className="data-[state=active]:bg-white">Analytics</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="leads" className="space-y-4 lg:space-y-6">
                  {/* Search and Filter */}
                  <div className="flex flex-col gap-3 lg:flex-row lg:gap-4">
                    <div className="relative flex-1">
                      <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none"><LottieSearchIcon size={16} /></div>
                      <Input
                        placeholder="Search leads..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 h-10"
                      />
                    </div>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="w-full lg:w-48 border-slate-200 h-10">
                        <Filter className="h-4 w-4 mr-2 text-slate-400" />
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="hot">Hot</SelectItem>
                        <SelectItem value="warm">Warm</SelectItem>
                        <SelectItem value="fresh">Fresh</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Leads Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
                    {filteredLeads.map((lead) => {
                      const isPurchased = isLeadPurchased(lead.id);
                      return (
                        <Card key={lead.id} className="hover:shadow-lg transition-all duration-200 border-0 shadow-sm">
                          <CardHeader className="pb-3 lg:pb-4">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center space-x-2 lg:space-x-3 min-w-0 flex-1">
                                <Avatar className="w-10 h-10 lg:w-12 lg:h-12 flex-shrink-0">
                                  <AvatarImage src={`/api/placeholder/48/48`} />
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
                                <Badge variant="secondary" className="text-xs bg-indigo-50 text-indigo-700">
                                  +{lead.skills.length - 2}
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center justify-between pt-3 lg:pt-4 border-t border-slate-100">
                              <div className="text-lg lg:text-xl font-bold text-indigo-600">
                                ₹{lead.price}
                              </div>
                              <div className="flex items-center space-x-1 lg:space-x-2">
                                <Star className="h-3 w-3 lg:h-4 lg:w-4 text-yellow-500 fill-current" />
                                <span className="text-xs lg:text-sm text-slate-700 font-medium">{lead.rating}</span>
                                {lead.verified && (
                                  <Badge variant="outline" className="text-xs border-green-200 text-green-700 bg-green-50 hidden lg:inline-flex">
                                    Verified
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col lg:flex-row space-y-2 lg:space-y-0 lg:space-x-3 pt-2">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="outline" size="sm" className="flex-1 text-xs lg:text-sm h-8 lg:h-9" disabled={!isPurchased}>
                                    <Eye className="h-3 w-3 lg:h-4 lg:w-4 mr-1 lg:mr-2" />
                                    View
                                  </Button>
                                </DialogTrigger>
                                {isPurchased && (
                                  <DialogContent className="max-w-sm lg:max-w-2xl mx-4">
                                    <DialogHeader>
                                      <DialogTitle className="text-lg lg:text-xl">{lead.name} - Complete Profile</DialogTitle>
                                      <DialogDescription>
                                        Detailed information about this lead
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        <div>
                                          <h4 className="font-semibold mb-2">Contact Information</h4>
                                          <div className="space-y-1 text-sm">
                                            <p><strong>Email:</strong> {lead.fullData.email}</p>
                                            <p><strong>Phone:</strong> {lead.fullData.phone}</p>
                                            <p><strong>Location:</strong> {lead.location}</p>
                                          </div>
                                        </div>
                                        <div>
                                          <h4 className="font-semibold mb-2">Professional Details</h4>
                                          <div className="space-y-1 text-sm">
                                            <p><strong>Position:</strong> {lead.position}</p>
                                            <p><strong>Experience:</strong> {lead.experience}</p>
                                            <p><strong>Current Company:</strong> {lead.currentCompany}</p>
                                            <p><strong>Expected Salary:</strong> {lead.expectedSalary}</p>
                                          </div>
                                        </div>
                                      </div>
                                      <div>
                                        <h4 className="font-semibold mb-2">Skills</h4>
                                        <div className="flex flex-wrap gap-2">
                                          {lead.skills.map((skill, index) => (
                                            <Badge key={index} variant="secondary">{skill}</Badge>
                                          ))}
                                        </div>
                                      </div>
                                      <div>
                                        <h4 className="font-semibold mb-2">Education</h4>
                                        <p className="text-sm">{lead.education}</p>
                                      </div>
                                    </div>
                                  </DialogContent>
                                )}
                              </Dialog>
                              <Button 
                                size="sm" 
                                className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-xs lg:text-sm h-8 lg:h-9"
                                disabled={isPurchased}
                                onClick={() => handlePurchaseLead(lead.id)}
                              >
                                <ShoppingCart className="h-3 w-3 lg:h-4 lg:w-4 mr-1 lg:mr-2" />
                                {isPurchased ? "Purchased" : "Buy"}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </TabsContent>

                <TabsContent value="analytics">
                  <div className="text-center py-12">
                    <BarChart3 className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">Analytics Dashboard</h3>
                    <p className="text-slate-600">Comprehensive analytics and reporting tools coming soon</p>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default LeadManagement;