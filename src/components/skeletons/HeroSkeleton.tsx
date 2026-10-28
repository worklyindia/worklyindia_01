import { ShimmerSkeleton } from '@/components/ui/shimmer-skeleton';

export const HeroSkeleton = () => {
  return (
    <section className="relative py-12 md:py-20 lg:py-24 overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-background">
      <div className="container mx-auto px-4 lg:px-6 xl:px-8 max-w-7xl">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left Content */}
          <div className="space-y-6">
            <ShimmerSkeleton className="h-12 w-3/4 rounded-lg" />
            <ShimmerSkeleton className="h-12 w-full rounded-lg" />
            <ShimmerSkeleton className="h-6 w-5/6 mt-4 rounded" />
            <ShimmerSkeleton className="h-6 w-4/6 rounded" />
            
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <ShimmerSkeleton className="h-12 w-40 rounded-xl" />
              <ShimmerSkeleton className="h-12 w-40 rounded-xl" />
            </div>
          </div>
          
          {/* Right Content */}
          <div className="relative">
            <ShimmerSkeleton className="h-64 md:h-96 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </section>
  );
};
