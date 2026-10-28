import { Card } from "@/components/ui/card";
import { ShimmerSkeleton } from "@/components/ui/shimmer-skeleton";

const CompanyCardSkeleton = () => {
  return (
    <Card className="p-6 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 border border-border/50">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <ShimmerSkeleton className="w-12 h-12 rounded-xl" />
          <div className="space-y-2">
            <ShimmerSkeleton className="h-4 w-32" />
            <ShimmerSkeleton className="h-3 w-24" />
          </div>
        </div>
        <ShimmerSkeleton className="w-4 h-4" />
      </div>

      {/* Description */}
      <div className="space-y-2 mb-4">
        <ShimmerSkeleton className="h-3 w-full" />
        <ShimmerSkeleton className="h-3 w-3/4" />
      </div>

      {/* Details */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between">
          <ShimmerSkeleton className="h-3 w-24" />
          <ShimmerSkeleton className="h-3 w-20" />
        </div>
        <div className="flex items-center justify-between">
          <ShimmerSkeleton className="h-3 w-20" />
          <ShimmerSkeleton className="h-3 w-24" />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <ShimmerSkeleton className="h-6 w-24 rounded-full" />
        <ShimmerSkeleton className="h-8 w-28 rounded-md" />
      </div>
    </Card>
  );
};

export default CompanyCardSkeleton;
