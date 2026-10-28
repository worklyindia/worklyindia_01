import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface CompanyFilterPillsProps {
  industries: string[];
  industryCounts: Record<string, number>;
  selectedIndustry: string;
  onSelectIndustry: (industry: string) => void;
  totalCount: number;
}

const CompanyFilterPills = ({
  industries,
  industryCounts,
  selectedIndustry,
  onSelectIndustry,
  totalCount,
}: CompanyFilterPillsProps) => {
  const isSelected = (industry: string) => {
    if (industry === 'All Industries') {
      return !selectedIndustry || selectedIndustry === 'All Industries';
    }
    return selectedIndustry === industry;
  };

  return (
    <ScrollArea className="w-full whitespace-nowrap">
      <div className="flex gap-2 pb-2">
        <Badge
          variant={isSelected('All Industries') ? 'default' : 'outline'}
          className="cursor-pointer hover:bg-primary/80 transition-colors px-4 py-2 text-sm"
          onClick={() => onSelectIndustry('All Industries')}
        >
          All ({totalCount})
        </Badge>
        
        {industries.map((industry) => (
          <Badge
            key={industry}
            variant={isSelected(industry) ? 'default' : 'outline'}
            className="cursor-pointer hover:bg-primary/80 transition-colors px-4 py-2 text-sm whitespace-nowrap"
            onClick={() => onSelectIndustry(industry)}
          >
            {industry} ({industryCounts[industry] || 0})
          </Badge>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
};

export default CompanyFilterPills;
