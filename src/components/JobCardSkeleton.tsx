import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ShimmerSkeleton } from "@/components/ui/shimmer-skeleton";

const JobCardSkeleton = () => (
  <Card className="hover:shadow-lg transition-shadow duration-300">
    <CardHeader className="pb-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <ShimmerSkeleton className="h-6 w-3/4" />
          <ShimmerSkeleton className="h-4 w-1/2" />
        </div>
        <ShimmerSkeleton className="h-12 w-12 rounded-lg" />
      </div>
    </CardHeader>
    <CardContent className="space-y-3">
      <div className="flex items-center space-x-2">
        <ShimmerSkeleton className="h-4 w-4" />
        <ShimmerSkeleton className="h-4 w-32" />
      </div>
      <div className="flex items-center space-x-2">
        <ShimmerSkeleton className="h-4 w-4" />
        <ShimmerSkeleton className="h-4 w-24" />
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        <ShimmerSkeleton className="h-6 w-16 rounded-full" />
        <ShimmerSkeleton className="h-6 w-20 rounded-full" />
        <ShimmerSkeleton className="h-6 w-18 rounded-full" />
      </div>
      <div className="flex justify-between items-center mt-4">
        <ShimmerSkeleton className="h-5 w-24" />
        <ShimmerSkeleton className="h-9 w-28" />
      </div>
    </CardContent>
  </Card>
);

export default JobCardSkeleton;
