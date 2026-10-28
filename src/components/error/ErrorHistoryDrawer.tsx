import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { History, Trash2, ChevronRight } from 'lucide-react';
import { useErrorHistory } from '@/hooks/useErrorHistory';
import { ErrorCategoryBadge } from './ErrorCategoryBadge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useState } from 'react';
import { ErrorDetailsPanel } from './ErrorDetailsPanel';
import { FormattedError } from '@/utils/errorFormatter';

export const ErrorHistoryDrawer = () => {
  const { history, clear } = useErrorHistory();
  const [selectedError, setSelectedError] = useState<FormattedError | null>(null);

  return (
    <>
      <Sheet>
        <SheetTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="flex-col h-auto py-3 gap-1"
          >
            <History className="w-4 h-4" />
            <span className="text-xs">History</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[80vh] z-[300]">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle>Error History</SheetTitle>
              {history.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clear}
                  className="gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear All
                </Button>
              )}
            </div>
          </SheetHeader>

          <ScrollArea className="h-full mt-4">
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <History className="w-12 h-12 mb-4 opacity-50" />
                <p>No error history</p>
              </div>
            ) : (
              <div className="space-y-3 pb-4">
                {history.map((error, index) => (
                  <div key={error.id}>
                    <button
                      onClick={() => setSelectedError(error)}
                      className="w-full p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-left"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <ErrorCategoryBadge category={error.category} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                              {error.category.title}
                            </div>
                            <div className="text-sm text-muted-foreground truncate">
                              {error.message}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {error.timeFormatted}
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      </div>
                    </button>
                    {index < history.length - 1 && <Separator className="my-3" />}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Error Details Sheet */}
      <Sheet open={!!selectedError} onOpenChange={() => setSelectedError(null)}>
        <SheetContent side="bottom" className="h-[80vh] z-[300]">
          {selectedError && (
            <>
              <SheetHeader>
                <SheetTitle>Error Details</SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                <ErrorCategoryBadge category={selectedError.category} />
              </div>
              <div className="mt-6">
                <ErrorDetailsPanel error={selectedError} />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
};
