import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const ApplicationCardSkeleton = () => (
  <Card className="hover:shadow-md transition-shadow">
    <CardContent className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-4 sm:space-y-0">
        <div className="flex-1 space-y-3">
          <div className="flex items-start justify-between">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="flex items-center space-x-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="flex items-center space-x-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-36" />
            </div>
          </div>
          
          <Skeleton className="h-5 w-28" />
        </div>
        
        <div className="flex space-x-2 sm:ml-4">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
    </CardContent>
  </Card>
);

export default ApplicationCardSkeleton;
