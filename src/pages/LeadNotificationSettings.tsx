import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft,
  Bell,
  Users,
  Mail,
  Smartphone,
  Clock,
  TrendingUp,
  DollarSign,
  CheckCircle,
  AlertCircle,
  Settings,
  Wallet
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const LeadNotificationSettings = () => {
  const navigate = useNavigate();
  
  // Notification settings state
  const [newLeadAlerts, setNewLeadAlerts] = useState(true);
  const [leadStatusUpdates, setLeadStatusUpdates] = useState(true);
  const [purchaseConfirmations, setPurchaseConfirmations] = useState(true);
  const [dailyReports, setDailyReports] = useState(false);
  const [weeklyAnalytics, setWeeklyAnalytics] = useState(true);
  const [priceDropAlerts, setPriceDropAlerts] = useState(true);
  const [hotLeadAlerts, setHotLeadAlerts] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);

  const leadNotificationTypes = [
    {
      title: "New Lead Alerts",
      description: "Get notified when new leads match your criteria",
      icon: Users,
      enabled: newLeadAlerts,
      setter: setNewLeadAlerts,
      category: "leads"
    },
    {
      title: "Hot Lead Alerts",
      description: "Priority notifications for high-value leads",
      icon: TrendingUp,
      enabled: hotLeadAlerts,
      setter: setHotLeadAlerts,
      category: "leads"
    },
    {
      title: "Lead Status Updates",
      description: "Updates when lead status changes",
      icon: CheckCircle,
      enabled: leadStatusUpdates,
      setter: setLeadStatusUpdates,
      category: "updates"
    },
    {
      title: "Purchase Confirmations",
      description: "Confirmation when lead purchases are completed",
      icon: DollarSign,
      enabled: purchaseConfirmations,
      setter: setPurchaseConfirmations,
      category: "transactions"
    },
    {
      title: "Price Drop Alerts",
      description: "Get notified when lead prices are reduced",
      icon: AlertCircle,
      enabled: priceDropAlerts,
      setter: setPriceDropAlerts,
      category: "pricing"
    }
  ];

  const reportNotifications = [
    {
      title: "Daily Lead Reports",
      description: "Summary of daily lead activity",
      icon: Clock,
      enabled: dailyReports,
      setter: setDailyReports
    },
    {
      title: "Weekly Analytics",
      description: "Weekly performance and insights report",
      icon: TrendingUp,
      enabled: weeklyAnalytics,
      setter: setWeeklyAnalytics
    }
  ];

  const communicationChannels = [
    {
      title: "Email Notifications",
      description: "Receive notifications via email",
      icon: Mail,
      enabled: emailNotifications,
      setter: setEmailNotifications,
      status: "Active"
    },
    {
      title: "Push Notifications",
      description: "Browser and mobile app notifications",
      icon: Smartphone,
      enabled: pushNotifications,
      setter: setPushNotifications,
      status: "Active"
    },
    {
      title: "SMS Notifications",
      description: "Important alerts via SMS",
      icon: Smartphone,
      enabled: smsNotifications,
      setter: setSmsNotifications,
      status: "Setup Required"
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
                <span className="hidden xs:inline">Back</span>
              </Button>
              <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Bell className="w-3 h-3 sm:w-5 sm:h-5 text-blue-600" />
                </div>
                <div className="min-w-0 overflow-hidden">
                  <h1 className="text-sm sm:text-lg md:text-xl font-bold text-slate-900 truncate">Notification Settings</h1>
                  <p className="text-[10px] sm:text-xs text-slate-500 leading-tight truncate">Manage lead alerts and updates</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
              <Button variant="ghost" size="sm" onClick={() => navigate('/lead-settings')} className="text-slate-600 hover:text-slate-900 p-1 sm:p-2">
                <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs sm:text-sm font-medium">A</span>
              </div>
            </div>
          </div>
        </div>
      </header>
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <div className="flex items-center space-x-4">
              <Bell className="w-8 h-8" />
              <div>
                <p className="text-blue-100 text-sm">Active Alerts</p>
                <p className="text-2xl font-bold">12</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-6 bg-gradient-to-r from-green-500 to-green-600 text-white">
            <div className="flex items-center space-x-4">
              <Mail className="w-8 h-8" />
              <div>
                <p className="text-green-100 text-sm">Today's Notifications</p>
                <p className="text-2xl font-bold">8</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-6 bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <div className="flex items-center space-x-4">
              <TrendingUp className="w-8 h-8" />
              <div>
                <p className="text-purple-100 text-sm">Response Rate</p>
                <p className="text-2xl font-bold">94%</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-8">
          {/* Lead Notification Types */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-6">Lead Notification Types</h2>
            
            <div className="space-y-6">
              {leadNotificationTypes.map((notification, index) => {
                const IconComponent = notification.icon;
                return (
                  <div key={index} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-sm">
                        <IconComponent className="w-6 h-6 text-slate-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-slate-900">{notification.title}</h3>
                        <p className="text-sm text-slate-600">{notification.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Badge variant={notification.enabled ? "default" : "secondary"} className="text-xs">
                        {notification.enabled ? "Active" : "Inactive"}
                      </Badge>
                      <Switch 
                        checked={notification.enabled} 
                        onCheckedChange={notification.setter}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Report Notifications */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-6">Report Notifications</h2>
            
            <div className="space-y-6">
              {reportNotifications.map((notification, index) => {
                const IconComponent = notification.icon;
                return (
                  <div key={index} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-sm">
                        <IconComponent className="w-6 h-6 text-slate-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-slate-900">{notification.title}</h3>
                        <p className="text-sm text-slate-600">{notification.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Badge variant={notification.enabled ? "default" : "secondary"} className="text-xs">
                        {notification.enabled ? "Active" : "Inactive"}
                      </Badge>
                      <Switch 
                        checked={notification.enabled} 
                        onCheckedChange={notification.setter}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Communication Channels */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-6">Communication Channels</h2>
            
            <div className="space-y-6">
              {communicationChannels.map((channel, index) => {
                const IconComponent = channel.icon;
                return (
                  <div key={index} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-sm">
                        <IconComponent className="w-6 h-6 text-slate-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-slate-900">{channel.title}</h3>
                        <p className="text-sm text-slate-600">{channel.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Badge 
                        variant={channel.status === "Active" ? "default" : "secondary"} 
                        className="text-xs"
                      >
                        {channel.status}
                      </Badge>
                      <Switch 
                        checked={channel.enabled} 
                        onCheckedChange={channel.setter}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Quick Actions */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-6">Quick Actions</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button className="bg-green-600 hover:bg-green-700 p-4 h-auto">
                <div className="text-left">
                  <p className="font-medium">Enable All Lead Alerts</p>
                  <p className="text-sm opacity-90">Turn on all lead notifications</p>
                </div>
              </Button>
              
              <Button variant="outline" className="p-4 h-auto">
                <div className="text-left">
                  <p className="font-medium">Test Notifications</p>
                  <p className="text-sm text-slate-600">Send a test notification</p>
                </div>
              </Button>
              
              <Button variant="outline" className="p-4 h-auto">
                <div className="text-left">
                  <p className="font-medium">Notification History</p>
                  <p className="text-sm text-slate-600">View past notifications</p>
                </div>
              </Button>
              
              <Button variant="outline" className="p-4 h-auto text-red-600 border-red-200">
                <div className="text-left">
                  <p className="font-medium">Disable All</p>
                  <p className="text-sm text-red-500">Turn off all notifications</p>
                </div>
              </Button>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default LeadNotificationSettings;