import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FilterCounts } from "@/hooks/useCompaniesData";

interface CompanySubFiltersProps {
  selectedFilter: 'all' | 'trending' | 'verified';
  onSelectFilter: (filter: 'all' | 'trending' | 'verified') => void;
  counts: FilterCounts;
}

const CompanySubFilters = ({ selectedFilter, onSelectFilter, counts }: CompanySubFiltersProps) => {
  return (
    <Tabs value={selectedFilter} onValueChange={(value) => onSelectFilter(value as 'all' | 'trending' | 'verified')}>
      <TabsList className="grid w-full grid-cols-3 max-w-md">
        <TabsTrigger value="all" className="text-sm">
          All ({counts.all})
        </TabsTrigger>
        <TabsTrigger value="trending" className="text-sm">
          Trending ({counts.trending})
        </TabsTrigger>
        <TabsTrigger value="verified" className="text-sm">
          Verified ({counts.verified})
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
};

export default CompanySubFilters;
