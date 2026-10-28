import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import { TeamRole } from "@/hooks/useTeamManagement";
import LottieSearchIcon from "@/components/LottieSearchIcon";

interface TeamFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  roleFilter: string;
  onRoleFilterChange: (value: string) => void;
  roles: TeamRole[];
}

export function TeamFilters({ 
  searchQuery, 
  onSearchChange, 
  roleFilter, 
  onRoleFilterChange,
  roles 
}: TeamFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"><LottieSearchIcon size={16} /></div>
        <Input
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      
      <Select value={roleFilter} onValueChange={onRoleFilterChange}>
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="Filter by role" />
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
  );
}
