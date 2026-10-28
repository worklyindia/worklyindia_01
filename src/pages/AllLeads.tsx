import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Search, 
  Filter, 
  Users,
  DollarSign,
  Bell,
  Settings,
  BarChart3,
  ArrowLeft,
  Coins,
  ShoppingBag
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLeads } from "@/hooks/useLeads";
import LeadCard from "@/components/LeadCard";
import LottieSearchIcon from "@/components/LottieSearchIcon";

const AllLeads = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showPoints, setShowPoints] = useState(false);
  
  // Use the custom hook for leads management
  const { leads, loading, isLeadPurchased, purchaseLead } = useLeads();

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         lead.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         lead.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === "all" || lead.status.toLowerCase() === filterStatus;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200 flex-shrink-0 z-30">
        <div className="w-full px-3 sm:px-4 lg:px-6">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
              <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Users className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">All Leads</h1>
                  <p className="text-xs text-slate-500 hidden sm:block">Manage all candidate leads</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate('/purchased-leads')}
                className="text-slate-700 hover:text-slate-900 border-slate-300 mr-2"
              >
                <ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>

              <Button variant="ghost" size="sm" onClick={() => navigate('/lead-notification-settings')} className="text-slate-600 hover:text-slate-900 p-1 sm:p-2">
                <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/lead-settings')} className="text-slate-600 hover:text-slate-900 p-1 sm:p-2">
                <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs sm:text-sm font-medium">A</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
        <div className="p-4 sm:p-6 lg:p-8">
          {/* Search and Filter */}
          <div className="flex flex-col gap-3 lg:flex-row lg:gap-4 mb-6">
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
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="text-slate-500">Loading leads...</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
              {filteredLeads.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  isPurchased={isLeadPurchased(lead.id)}
                  onPurchase={purchaseLead}
                />
              ))}
            </div>
          )}
          
          {!loading && filteredLeads.length === 0 && (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-slate-400" />
              <h3 className="mt-2 text-sm font-medium text-slate-900">No leads found</h3>
              <p className="mt-1 text-sm text-slate-500">
                Try adjusting your search or filter criteria.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AllLeads;