import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { TeamRole } from "@/hooks/useTeamManagement";
import { Search, Filter, X } from "lucide-react";
import LottieSearchIcon from "@/components/LottieSearchIcon";

interface AdvancedTeamFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  roleFilter: string;
  onRoleFilterChange: (value: string) => void;
  lastActiveFilter: string;
  onLastActiveFilterChange: (value: string) => void;
  permissionFilter: string;
  onPermissionFilterChange: (value: string) => void;
  roles: TeamRole[];
  onClearFilters: () => void;
}

const permissionOptions = [
  { value: "all", label: "All Permissions" },
  { value: "users_management.view", label: "Can View Users" },
  { value: "users_management.edit", label: "Can Edit Users" },
  { value: "employers_management.verify", label: "Can Verify Employers" },
  { value: "financial.approve_withdrawals", label: "Can Approve Withdrawals" },
  { value: "team_management.invite", label: "Can Invite Team Members" },
  { value: "team_management.edit_roles", label: "Can Edit Roles" },
  { value: "content.publish", label: "Can Publish Content" },
  { value: "analytics.export", label: "Can Export Analytics" },
];

const lastActiveOptions = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Active Today" },
  { value: "week", label: "Active This Week" },
  { value: "month", label: "Active This Month" },
  { value: "inactive", label: "Inactive 30+ Days" },
];

export function AdvancedTeamFilters({
  searchQuery,
  onSearchChange,
  roleFilter,
  onRoleFilterChange,
  lastActiveFilter,
  onLastActiveFilterChange,
  permissionFilter,
  onPermissionFilterChange,
  roles,
  onClearFilters
}: AdvancedTeamFiltersProps) {
  const activeFiltersCount = [
    roleFilter !== "all",
    lastActiveFilter !== "all",
    permissionFilter !== "all",
    searchQuery.length > 0
  ].filter(Boolean).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"><LottieSearchIcon size={16} /></div>
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 min-h-[44px]"
          />
        </div>

        {/* Advanced Filters Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2 min-h-[44px] w-full sm:w-auto">
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Advanced Filters</span>
              <span className="sm:hidden">Filters</span>
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">Filter Options</h4>
                {activeFiltersCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClearFilters}
                    className="h-8 text-xs"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Clear All
                  </Button>
                )}
              </div>

              {/* Role Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Role</label>
                <Select value={roleFilter} onValueChange={onRoleFilterChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.role_name} className="capitalize">
                        {role.role_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Last Active Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Last Active</label>
                <Select value={lastActiveFilter} onValueChange={onLastActiveFilterChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {lastActiveOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Permission Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Has Permission</label>
                <Select value={permissionFilter} onValueChange={onPermissionFilterChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {permissionOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Active Filters Display */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-muted-foreground">Active filters:</span>
          {roleFilter !== "all" && (
            <Badge variant="secondary" className="gap-1">
              Role: {roleFilter}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => onRoleFilterChange("all")}
              />
            </Badge>
          )}
          {lastActiveFilter !== "all" && (
            <Badge variant="secondary" className="gap-1">
              Activity: {lastActiveOptions.find(o => o.value === lastActiveFilter)?.label}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => onLastActiveFilterChange("all")}
              />
            </Badge>
          )}
          {permissionFilter !== "all" && (
            <Badge variant="secondary" className="gap-1">
              Permission: {permissionOptions.find(o => o.value === permissionFilter)?.label}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => onPermissionFilterChange("all")}
              />
            </Badge>
          )}
          {searchQuery && (
            <Badge variant="secondary" className="gap-1">
              Search: "{searchQuery}"
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => onSearchChange("")}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
