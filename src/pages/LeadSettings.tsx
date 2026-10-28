import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ArrowLeft,
  Settings as SettingsIcon, 
  Users, 
  Bell, 
  Shield, 
  Eye,
  Download,
  Trash2,
  Moon,
  Sun,
  Globe,
  Mail,
  Smartphone,
  Lock,
  CreditCard,
  LogOut,
  Filter,
  Search,
  Target,
  TrendingUp,
  DollarSign,
  Wallet
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { LastLoginInfo } from "@/components/LastLoginInfo";
import { useAuth } from "@/contexts/AuthContext";

const LeadSettings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Lead Management Settings
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [hotLeadAlerts, setHotLeadAlerts] = useState(true);
  const [priceAlerts, setPriceAlerts] = useState(true);
  const [budgetLimit, setBudgetLimit] = useState("5000");
  const [autoPreview, setAutoPreview] = useState(false);
  const [bulkActions, setBulkActions] = useState(true);
  
  // Search & Filter Settings
  const [defaultLocation, setDefaultLocation] = useState("");
  const [preferredExperience, setPreferredExperience] = useState("");
  const [maxBudgetPerLead, setMaxBudgetPerLead] = useState("1000");
  const [saveSearches, setSaveSearches] = useState(true);
  
  // Privacy Settings
  const [profileVisibility, setProfileVisibility] = useState(true);
  const [activityTracking, setActivityTracking] = useState(true);
  const [dataSharing, setDataSharing] = useState(false);

  const leadPreferences = [
    {
      title: "Auto-refresh Lead List",
      description: "Automatically refresh leads every 30 seconds",
      enabled: autoRefresh,
      setter: setAutoRefresh
    },
    {
      title: "Hot Lead Notifications",
      description: "Get instant alerts for premium leads",
      enabled: hotLeadAlerts,
      setter: setHotLeadAlerts
    },
    {
      title: "Price Drop Alerts",
      description: "Notify when lead prices are reduced",
      enabled: priceAlerts,
      setter: setPriceAlerts
    },
    {
      title: "Auto Preview",
      description: "Show lead preview on hover",
      enabled: autoPreview,
      setter: setAutoPreview
    },
    {
      title: "Bulk Actions",
      description: "Enable multiple lead selection",
      enabled: bulkActions,
      setter: setBulkActions
    }
  ];

  const privacySettings = [
    {
      title: "Profile Visibility",
      description: "Allow leads to see your company profile",
      enabled: profileVisibility,
      setter: setProfileVisibility
    },
    {
      title: "Activity Tracking",
      description: "Track lead interaction analytics",
      enabled: activityTracking,
      setter: setActivityTracking
    },
    {
      title: "Data Sharing",
      description: "Share anonymized data for platform improvement",
      enabled: dataSharing,
      setter: setDataSharing
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="w-full px-3 sm:px-4 lg:px-6">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/all-leads")}
                className="text-slate-600 hover:text-slate-900 flex-shrink-0 text-xs sm:text-sm px-2 sm:px-3"
              >
                <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="hidden xs:inline">Back to Leads</span>
                <span className="xs:hidden">Back</span>
              </Button>
              <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <SettingsIcon className="w-3 h-3 sm:w-5 sm:h-5 text-purple-600" />
                </div>
                <div className="min-w-0 overflow-hidden">
                  <h1 className="text-sm sm:text-lg md:text-xl font-bold text-slate-900 truncate">Settings</h1>
                  <p className="text-[10px] sm:text-xs text-slate-500 leading-tight truncate">Configure lead management preferences</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
              <Button variant="ghost" size="sm" onClick={() => navigate('/lead-notification-settings')} className="text-slate-600 hover:text-slate-900 p-1 sm:p-2">
                <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs sm:text-sm font-medium">A</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        <Tabs defaultValue="preferences" className="w-full">
          <TabsList className="grid w-full grid-cols-5 h-auto p-1">
            <TabsTrigger value="preferences" className="text-xs sm:text-sm px-1 sm:px-3 py-2">Preferences</TabsTrigger>
            <TabsTrigger value="search-filters" className="text-xs sm:text-sm px-1 sm:px-3 py-2">Search</TabsTrigger>
            <TabsTrigger value="budget" className="text-xs sm:text-sm px-1 sm:px-3 py-2">Budget</TabsTrigger>
            <TabsTrigger value="privacy" className="text-xs sm:text-sm px-1 sm:px-3 py-2">Privacy</TabsTrigger>
            <TabsTrigger value="account" className="text-xs sm:text-sm px-1 sm:px-3 py-2">Account</TabsTrigger>
          </TabsList>

          <TabsContent value="preferences" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-6">Lead Management Preferences</h2>
              
              <div className="space-y-6">
                {leadPreferences.map((preference, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div className="space-y-1">
                      <h3 className="font-medium text-slate-900">{preference.title}</h3>
                      <p className="text-sm text-slate-600">{preference.description}</p>
                    </div>
                    <Switch 
                      checked={preference.enabled} 
                      onCheckedChange={preference.setter}
                    />
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-6">Display Settings</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-900 mb-2 block">Leads per page</label>
                  <Select defaultValue="12">
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="6">6 leads</SelectItem>
                      <SelectItem value="12">12 leads</SelectItem>
                      <SelectItem value="24">24 leads</SelectItem>
                      <SelectItem value="48">48 leads</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-slate-900 mb-2 block">Default sort order</label>
                  <Select defaultValue="newest">
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest first</SelectItem>
                      <SelectItem value="price-low">Price: Low to High</SelectItem>
                      <SelectItem value="price-high">Price: High to Low</SelectItem>
                      <SelectItem value="rating">Highest rated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="search-filters" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-6">Default Search Filters</h2>
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-900 mb-2 block">Preferred Location</label>
                    <Input
                      placeholder="e.g., Mumbai, Delhi, Bangalore"
                      value={defaultLocation}
                      onChange={(e) => setDefaultLocation(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-900 mb-2 block">Experience Range</label>
                    <Select value={preferredExperience} onValueChange={setPreferredExperience}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select experience" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0-1">0-1 years</SelectItem>
                        <SelectItem value="1-3">1-3 years</SelectItem>
                        <SelectItem value="3-5">3-5 years</SelectItem>
                        <SelectItem value="5-10">5-10 years</SelectItem>
                        <SelectItem value="10+">10+ years</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-slate-900 mb-2 block">Max Budget per Lead</label>
                  <Input
                    type="number"
                    placeholder="Enter maximum amount"
                    value={maxBudgetPerLead}
                    onChange={(e) => setMaxBudgetPerLead(e.target.value)}
                  />
                  <p className="text-xs text-slate-500 mt-1">Leads above this price will be filtered out</p>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div className="space-y-1">
                    <h3 className="font-medium text-slate-900">Save Search Preferences</h3>
                    <p className="text-sm text-slate-600">Remember your filter settings for next session</p>
                  </div>
                  <Switch 
                    checked={saveSearches} 
                    onCheckedChange={setSaveSearches}
                  />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-6">Quick Filter Presets</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button variant="outline" className="p-4 h-auto">
                  <div className="text-left">
                    <p className="font-medium">Fresh Graduates</p>
                    <p className="text-sm text-slate-600">0-1 years experience, ₹200-400</p>
                  </div>
                </Button>
                
                <Button variant="outline" className="p-4 h-auto">
                  <div className="text-left">
                    <p className="font-medium">Mid-Level</p>
                    <p className="text-sm text-slate-600">3-5 years experience, ₹400-700</p>
                  </div>
                </Button>
                
                <Button variant="outline" className="p-4 h-auto">
                  <div className="text-left">
                    <p className="font-medium">Senior Profiles</p>
                    <p className="text-sm text-slate-600">5+ years experience, ₹700+</p>
                  </div>
                </Button>
                
                <Button variant="outline" className="p-4 h-auto">
                  <div className="text-left">
                    <p className="font-medium">Budget Friendly</p>
                    <p className="text-sm text-slate-600">All experience, under ₹300</p>
                  </div>
                </Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="budget" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-6">Budget Controls</h2>
              
              <div className="space-y-6">
                <div>
                  <label className="text-sm font-medium text-slate-900 mb-2 block">Monthly Budget Limit</label>
                  <Input
                    type="number"
                    placeholder="Enter monthly limit"
                    value={budgetLimit}
                    onChange={(e) => setBudgetLimit(e.target.value)}
                  />
                  <p className="text-xs text-slate-500 mt-1">System will warn you when approaching this limit</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="p-4 border-2 border-green-200 bg-green-50">
                    <div className="flex items-center space-x-3">
                      <DollarSign className="w-8 h-8 text-green-600" />
                      <div>
                        <p className="text-sm text-slate-600">Current Month</p>
                        <p className="text-xl font-bold text-slate-900">₹2,340</p>
                      </div>
                    </div>
                  </Card>
                  
                  <Card className="p-4 border-2 border-blue-200 bg-blue-50">
                    <div className="flex items-center space-x-3">
                      <Target className="w-8 h-8 text-blue-600" />
                      <div>
                        <p className="text-sm text-slate-600">Budget Limit</p>
                        <p className="text-xl font-bold text-slate-900">₹{budgetLimit}</p>
                      </div>
                    </div>
                  </Card>
                  
                  <Card className="p-4 border-2 border-purple-200 bg-purple-50">
                    <div className="flex items-center space-x-3">
                      <TrendingUp className="w-8 h-8 text-purple-600" />
                      <div>
                        <p className="text-sm text-slate-600">Remaining</p>
                        <p className="text-xl font-bold text-slate-900">₹{parseInt(budgetLimit) - 2340}</p>
                      </div>
                    </div>
                  </Card>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium text-slate-900">Budget Alerts</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <span className="text-sm text-slate-700">Alert at 80% of budget</span>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <span className="text-sm text-slate-700">Block purchases at 100% of budget</span>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <span className="text-sm text-slate-700">Weekly budget summary email</span>
                      <Switch />
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="privacy" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-6">Privacy & Data Settings</h2>
              
              <div className="space-y-6">
                {privacySettings.map((setting, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div className="space-y-1">
                      <h3 className="font-medium text-slate-900">{setting.title}</h3>
                      <p className="text-sm text-slate-600">{setting.description}</p>
                    </div>
                    <Switch 
                      checked={setting.enabled} 
                      onCheckedChange={setting.setter}
                    />
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-6">Data Management</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Download className="w-5 h-5 text-blue-600" />
                    <div>
                      <h4 className="font-medium text-slate-900">Export Lead Data</h4>
                      <p className="text-sm text-slate-600">Download your purchased leads data</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Export
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Trash2 className="w-5 h-5 text-red-600" />
                    <div>
                      <h4 className="font-medium text-slate-900">Clear Search History</h4>
                      <p className="text-sm text-slate-600">Remove all saved searches and preferences</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="text-red-600 border-red-200">
                    Clear
                  </Button>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="account" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-6">Account Settings</h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Lock className="w-5 h-5 text-blue-600" />
                    <div>
                      <h4 className="font-medium text-slate-900">Change Password</h4>
                      <p className="text-sm text-slate-600">Update your account password</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Change
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Mail className="w-5 h-5 text-blue-600" />
                    <div>
                      <h4 className="font-medium text-slate-900">Email Preferences</h4>
                      <p className="text-sm text-slate-600">Configure email notifications</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Configure
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="p-6 border-red-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-6">Danger Zone</h3>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <LogOut className="w-5 h-5 text-red-600" />
                      <div>
                        <h4 className="font-medium text-slate-900">Sign Out</h4>
                        <p className="text-sm text-slate-600">Sign out from all devices</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="text-red-600 border-red-200">
                      Sign Out
                    </Button>
                  </div>
                  <div className="px-4">
                    <LastLoginInfo userId={user?.id} />
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default LeadSettings;