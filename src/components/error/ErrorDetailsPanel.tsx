import { FormattedError } from '@/utils/errorFormatter';
import { Clock, Database, Globe, Smartphone, Code2, User } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface ErrorDetailsPanelProps {
  error: FormattedError;
}

export const ErrorDetailsPanel = ({ error }: ErrorDetailsPanelProps) => {
  return (
    <ScrollArea className="h-full max-h-[50vh]">
      <div className="space-y-3 p-2.5">
        {/* Basic Info */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Time:</span>
            <span className="font-medium">{error.timeFormatted}</span>
          </div>
          
          <div className="flex items-start gap-2 text-sm">
            <Code2 className="w-4 h-4 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <div className="text-muted-foreground mb-1">Error ID:</div>
              <code className="text-xs bg-muted px-2 py-1 rounded break-all">
                {error.id}
              </code>
            </div>
          </div>
        </div>

        <Separator />

        {/* Error Message */}
        <div className="space-y-2">
          <div className="font-medium text-sm">Message</div>
          <div className="bg-muted/50 p-3 rounded-lg text-sm">
            {error.message}
          </div>
        </div>

        {/* Category-Specific Details */}
        {error.category.category === 'database' && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-medium text-sm">
                <Database className="w-4 h-4" />
                <span>Database Details</span>
              </div>
              {error.category.details.table && (
                <DetailRow label="Table" value={error.category.details.table} />
              )}
              {error.category.details.operation && (
                <DetailRow label="Operation" value={error.category.details.operation} />
              )}
            </div>
          </>
        )}

        {error.category.category === 'network' && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-medium text-sm">
                <Globe className="w-4 h-4" />
                <span>Network Details</span>
              </div>
              {error.category.details.endpoint && (
                <DetailRow label="Endpoint" value={error.category.details.endpoint} mono />
              )}
              {error.category.details.statusCode && (
                <DetailRow label="Status Code" value={error.category.details.statusCode.toString()} />
              )}
            </div>
          </>
        )}

        {error.category.category === 'component' && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-medium text-sm">
                <Code2 className="w-4 h-4" />
                <span>Component Details</span>
              </div>
              {error.category.details.component && (
                <DetailRow label="Component" value={error.category.details.component} />
              )}
              {error.category.details.file && (
                <DetailRow label="File" value={error.category.details.file} mono />
              )}
              {error.category.details.line && (
                <DetailRow label="Line" value={error.category.details.line.toString()} />
              )}
            </div>
          </>
        )}

        {/* User Context */}
        {error.userContext && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-medium text-sm">
                <User className="w-4 h-4" />
                <span>User Context</span>
              </div>
              {error.userContext.email && (
                <DetailRow label="Email" value={error.userContext.email} />
              )}
              <DetailRow label="Platform" value={error.userContext.platform} />
              <DetailRow label="Viewport" value={error.userContext.viewport} />
            </div>
          </>
        )}

        {/* Browser Info */}
        <Separator />
        <div className="space-y-2">
          <div className="flex items-center gap-2 font-medium text-sm">
            <Smartphone className="w-4 h-4" />
            <span>Browser Info</span>
          </div>
          <DetailRow 
            label="Browser" 
            value={`${error.browserInfo.browser} ${error.browserInfo.version}`} 
          />
          <DetailRow label="OS" value={error.browserInfo.os} />
        </div>

        {/* Stack Trace */}
        {error.stack && process.env.NODE_ENV === 'development' && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="font-medium text-sm">Stack Trace</div>
              <pre className="bg-muted/50 p-3 rounded-lg text-xs overflow-x-auto">
                {error.stack}
              </pre>
            </div>
          </>
        )}
      </div>
    </ScrollArea>
  );
};

const DetailRow = ({ 
  label, 
  value, 
  mono = false 
}: { 
  label: string; 
  value: string; 
  mono?: boolean;
}) => (
  <div className="flex justify-between items-start gap-4 text-sm">
    <span className="text-muted-foreground">{label}:</span>
    <span className={`text-right ${mono ? 'font-mono text-xs' : 'font-medium'} break-all max-w-[60%]`}>
      {value}
    </span>
  </div>
);
