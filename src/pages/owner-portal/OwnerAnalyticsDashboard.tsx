import { useOwnerAnalytics } from "@/hooks/useOwnerAnalytics";
import { useJobLocationAnalytics } from "@/hooks/useJobLocationAnalytics";
import { StatCard } from "@/components/owner-portal/StatCard";
import { LocationDistributionTable } from "@/components/owner-portal/LocationDistributionTable";
import { JobLocationDistributionTable } from "@/components/owner-portal/JobLocationDistributionTable";
import { ActivityTimeline } from "@/components/owner-portal/ActivityTimeline";
import { FinancialBreakdown } from "@/components/owner-portal/FinancialBreakdown";
import { WebhookMonitoringCard } from "@/components/owner-portal/WebhookMonitoringCard";
import AITricksStats from "@/components/owner-portal/AITricksStats";
import AIActivityFeed from "@/components/owner-portal/AIActivityFeed";
import GoogleIndexingDashboard from "@/components/owner-portal/GoogleIndexingDashboard";
import GA4AnalyticsWidget from "@/components/owner-portal/GA4AnalyticsWidget";
import GoogleSheetsWidget from "@/components/owner-portal/GoogleSheetsWidget";
import InvoiceManagementWidget from "@/components/owner-portal/InvoiceManagementWidget";
import { Users, Building2, Wallet, TrendingUp, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

const OwnerAnalyticsDashboard = () => {
  const { overview, location, financial } = useOwnerAnalytics();
  const jobLocationData = useJobLocationAnalytics();

  if (overview.error || location.error || financial.error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to load analytics. Please ensure you have admin access.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Owner Analytics Dashboard</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Comprehensive overview of your platform's performance and user statistics
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Members"
          value={overview.data?.total_members || 0}
          icon={Users}
          description={`${overview.data?.active_members || 0} active members`}
          isLoading={overview.isLoading}
        />
        <StatCard
          title="Total Companies"
          value={overview.data?.total_companies || 0}
          icon={Building2}
          description={`${overview.data?.verified_companies || 0} verified`}
          isLoading={overview.isLoading}
        />
        <StatCard
          title="Total Wallet Balance"
          value={financial.data?.total_wallet_points?.toLocaleString() || "0"}
          icon={Wallet}
          description="All users combined"
          isLoading={financial.isLoading}
        />
        <StatCard
          title="Total Referral Balance"
          value={`₹${Number(financial.data?.total_referral_balance || 0).toLocaleString()}`}
          icon={TrendingUp}
          description="All referral earnings"
          isLoading={financial.isLoading}
        />
      </div>

      {/* Profile Completion */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Profile Completion Rate"
          value={`${overview.data?.profile_complete_percentage || 0}%`}
          icon={CheckCircle2}
          description="Users with complete profiles"
          isLoading={overview.isLoading}
        />
        <StatCard
          title="Active Companies"
          value={overview.data?.active_companies || 0}
          icon={Building2}
          description="Companies posting jobs"
          isLoading={overview.isLoading}
        />
        <StatCard
          title="Banned Companies"
          value={overview.data?.banned_companies || 0}
          icon={AlertTriangle}
          description="Requires attention"
          isLoading={overview.isLoading}
        />
      </div>

      {/* Financial Breakdown */}
      <FinancialBreakdown data={financial.data} isLoading={financial.isLoading} />

      {/* AI Tricks Analytics */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold mb-1">AI Content Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Performance metrics for AI-generated career tricks
          </p>
        </div>
        <AITricksStats />
      </div>

      {/* AI Activity Feed */}
      <div className="grid gap-4 md:grid-cols-2">
        <AIActivityFeed />
        <WebhookMonitoringCard />
      </div>

      {/* Google Cloud Integration Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold mb-1">Google Cloud Integration</h2>
          <p className="text-sm text-muted-foreground">
            GA4 Analytics, Google Sheets sync, and Invoice management
          </p>
        </div>
        
        {/* GA4 Analytics Widget - Full Width */}
        <GA4AnalyticsWidget />
        
        {/* Sheets & Invoices - Side by Side */}
        <div className="grid gap-4 md:grid-cols-2">
          <GoogleSheetsWidget />
          <InvoiceManagementWidget />
        </div>
      </div>

      {/* Google Indexing Dashboard */}
      <GoogleIndexingDashboard />

      {/* Activity Timeline */}
      <ActivityTimeline />

      {/* Geographic Distribution */}
      <LocationDistributionTable data={location.data} isLoading={location.isLoading} />

      {/* Job Geographic Distribution */}
      <JobLocationDistributionTable data={jobLocationData.data} isLoading={jobLocationData.isLoading} />
    </div>
  );
};

export default OwnerAnalyticsDashboard;
