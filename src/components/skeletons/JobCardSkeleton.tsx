import { ShimmerSkeleton } from '@/components/ui/shimmer-skeleton';

export const JobCardSkeleton = () => {
  return (
    <div className="border border-border rounded-lg p-4 space-y-3 bg-card">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <ShimmerSkeleton className="h-5 w-3/4" />
          <ShimmerSkeleton className="h-4 w-1/2" />
        </div>
        <ShimmerSkeleton className="h-8 w-8 rounded-full" />
      </div>
      
      <div className="space-y-2">
        <ShimmerSkeleton className="h-4 w-full" />
        <ShimmerSkeleton className="h-4 w-5/6" />
      </div>
      
      <div className="flex gap-2">
        <ShimmerSkeleton className="h-6 w-20 rounded-full" />
        <ShimmerSkeleton className="h-6 w-24 rounded-full" />
        <ShimmerSkeleton className="h-6 w-16 rounded-full" />
      </div>
      
      <div className="flex justify-between items-center pt-2">
        <ShimmerSkeleton className="h-4 w-24" />
        <ShimmerSkeleton className="h-9 w-24" />
      </div>
    </div>
  );
};

export const JobListSkeleton = ({ count = 5 }: { count?: number }) => {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <JobCardSkeleton key={i} />
      ))}
    </div>
  );
};
