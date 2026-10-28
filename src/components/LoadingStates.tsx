import { Skeleton } from "@/components/ui/skeleton";

/**
 * Reusable loading skeletons for consistent UX
 */

export const CardSkeleton = () => (
  <div className="border rounded-lg p-4 space-y-3 bg-background">
    <div className="flex justify-between items-start">
      <div className="space-y-2 flex-1">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <Skeleton className="h-10 w-10 rounded-full" />
    </div>
    <Skeleton className="h-4 w-full" />
    <div className="flex justify-between">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-20" />
    </div>
  </div>
);

export const ListSkeleton = ({ count = 5 }: { count?: number }) => (
  <div className="space-y-4">
    {Array.from({ length: count }).map((_, i) => (
      <CardSkeleton key={i} />
    ))}
  </div>
);

export const ProfileSkeleton = () => (
  <div className="space-y-6 p-4">
    <div className="flex items-center gap-4">
      <Skeleton className="h-20 w-20 rounded-full" />
      <div className="space-y-2 flex-1">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
    <div className="space-y-3">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-5/6" />
    </div>
  </div>
);

export const FormSkeleton = () => (
  <div className="space-y-4 p-4">
    <div className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-10 w-full" />
    </div>
    <div className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-10 w-full" />
    </div>
    <div className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-32 w-full" />
    </div>
    <Skeleton className="h-10 w-full" />
  </div>
);

export const TableSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="space-y-2">
    <div className="flex gap-4 p-4 border-b">
      <Skeleton className="h-4 w-1/4" />
      <Skeleton className="h-4 w-1/4" />
      <Skeleton className="h-4 w-1/4" />
      <Skeleton className="h-4 w-1/4" />
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex gap-4 p-4 border-b">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
      </div>
    ))}
  </div>
);

export const StatsSkeleton = () => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="border rounded-lg p-4 space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-3 w-24" />
      </div>
    ))}
  </div>
);
