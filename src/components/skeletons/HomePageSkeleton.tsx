import { ShimmerSkeleton } from '@/components/ui/shimmer-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

export const HomePageSkeleton = () => {
  return (
    <div className="min-h-screen bg-background animate-fade-in">
      {/* Header Skeleton */}
      <header className="h-14 border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 h-full flex items-center justify-between">
          <ShimmerSkeleton className="h-8 w-32 rounded" />
          <div className="flex gap-2">
            <ShimmerSkeleton className="h-8 w-20 rounded" />
            <ShimmerSkeleton className="h-8 w-20 rounded" />
          </div>
        </div>
      </header>

      {/* Hero Section Skeleton */}
      <section className="relative py-12 md:py-20 lg:py-24 overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-background">
        <div className="container mx-auto px-4 lg:px-6 xl:px-8 max-w-7xl">
          <div className="text-center space-y-6">
            {/* Title Shimmer Lines */}
            <div className="space-y-3 max-w-4xl mx-auto">
              <ShimmerSkeleton className="h-12 md:h-16 w-full rounded-lg" />
              <ShimmerSkeleton className="h-12 md:h-16 w-3/4 mx-auto rounded-lg" />
              <ShimmerSkeleton className="h-12 md:h-16 w-5/6 mx-auto rounded-lg" />
            </div>
            
            {/* Description */}
            <div className="space-y-2 max-w-2xl mx-auto mt-6">
              <ShimmerSkeleton className="h-6 w-full rounded" />
              <ShimmerSkeleton className="h-6 w-4/5 mx-auto rounded" />
            </div>
            
            {/* Search Bar */}
            <div className="max-w-2xl mx-auto mt-8">
              <ShimmerSkeleton className="h-14 w-full rounded-xl" />
            </div>
            
            {/* CTA Buttons */}
            <div className="flex justify-center gap-4 mt-8">
              <ShimmerSkeleton className="h-12 w-40 rounded-xl" />
              <ShimmerSkeleton className="h-12 w-40 rounded-xl" />
            </div>
          </div>
        </div>
      </section>

      {/* Job Cards Section Skeleton */}
      <section className="py-8 sm:py-12">
        <div className="container mx-auto px-4 lg:px-6 xl:px-8 max-w-7xl">
          {/* Section Header */}
          <div className="flex justify-between items-center mb-8">
            <div className="space-y-2">
              <ShimmerSkeleton className="h-8 w-48 rounded" />
              <ShimmerSkeleton className="h-5 w-64 rounded" />
            </div>
            <ShimmerSkeleton className="h-10 w-32 rounded-lg" />
          </div>
          
          {/* Job Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <JobCardShimmer key={i} delay={i * 0.1} />
            ))}
          </div>
        </div>
      </section>

      {/* Second Section */}
      <section className="py-8 sm:py-12 bg-muted/20">
        <div className="container mx-auto px-4 lg:px-6 xl:px-8 max-w-7xl">
          <div className="flex justify-between items-center mb-8">
            <div className="space-y-2">
              <ShimmerSkeleton className="h-8 w-48 rounded" />
              <ShimmerSkeleton className="h-5 w-64 rounded" />
            </div>
            <ShimmerSkeleton className="h-10 w-32 rounded-lg" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[1, 2, 3].map((i) => (
              <JobCardShimmer key={i} delay={i * 0.1} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

const JobCardShimmer = ({ delay = 0 }: { delay?: number }) => (
  <div 
    className="border border-border rounded-lg p-4 space-y-3 bg-card animate-fade-in"
    style={{ animationDelay: `${delay}s` }}
  >
    {/* Header */}
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 space-y-2">
        <ShimmerSkeleton className="h-5 w-3/4 rounded" />
        <ShimmerSkeleton className="h-4 w-1/2 rounded" />
      </div>
      <ShimmerSkeleton className="h-10 w-10 rounded-lg flex-shrink-0" />
    </div>
    
    {/* Description */}
    <div className="space-y-2">
      <ShimmerSkeleton className="h-4 w-full rounded" />
      <ShimmerSkeleton className="h-4 w-5/6 rounded" />
    </div>
    
    {/* Tags */}
    <div className="flex gap-2">
      <ShimmerSkeleton className="h-6 w-20 rounded-full" />
      <ShimmerSkeleton className="h-6 w-24 rounded-full" />
      <ShimmerSkeleton className="h-6 w-16 rounded-full" />
    </div>
    
    {/* Footer */}
    <div className="flex justify-between items-center pt-2">
      <ShimmerSkeleton className="h-4 w-24 rounded" />
      <ShimmerSkeleton className="h-9 w-28 rounded-lg" />
    </div>
  </div>
);
