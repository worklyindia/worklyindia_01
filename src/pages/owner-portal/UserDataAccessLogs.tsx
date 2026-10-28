import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { useAIDataAccessLogs, type AIAccessFilters, type AIDataAccessLog } from "@/hooks/useAIDataAccessLogs";
import { 
  FileText, 
  Search, 
  Download, 
  ArrowLeft,
  RefreshCw,
  Phone,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Eye,
  Clock,
  User,
  Building
} from "lucide-react";
import { format } from "date-fns";
import LottieSearchIcon from "@/components/LottieSearchIcon";

const UserDataAccessLogs = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<AIAccessFilters>({
    aiType: 'all',
    searchTerm: '',
    accessType: ''
  });
  
  const { data, isLoading, refetch } = useAIDataAccessLogs(filters, page, 50);

  const handleSearch = (value: string) => {
    setFilters(prev => ({ ...prev, searchTerm: value }));
    setPage(1);
  };

  const handleAITypeChange = (value: string) => {
    setFilters(prev => ({ 
      ...prev, 
      aiType: value as 'all' | 'whatsapp_ai' | 'career_chat_ai' 
    }));
    setPage(1);
  };

  const handleAccessTypeChange = (value: string) => {
    setFilters(prev => ({ ...prev, accessType: value === 'all' ? '' : value }));
    setPage(1);
  };

  const exportToCSV = () => {
    if (!data?.logs) return;
    
    const headers = ['Timestamp', 'AI Type', 'Access Type', 'User Identifier', 'Matched User', 'User Type', 'Response Time (ms)'];
    const rows = data.logs.map(log => [
      format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
      log.ai_type,
      log.access_type,
      log.user_identifier,
      log.matched_user_name || '-',
      log.matched_user_type || '-',
      log.response_time_ms || '-'
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-access-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const getAITypeIcon = (aiType: string) => {
    return aiType === 'whatsapp_ai' ? (
      <Phone className="h-4 w-4 text-green-500" />
    ) : (
      <MessageSquare className="h-4 w-4 text-blue-500" />
    );
  };

  const getAITypeBadge = (aiType: string) => {
    return aiType === 'whatsapp_ai' ? (
      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
        <Phone className="h-3 w-3 mr-1" />
        WhatsApp
      </Badge>
    ) : (
      <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200">
        <MessageSquare className="h-3 w-3 mr-1" />
        Career Chat
      </Badge>
    );
  };

  const getUserTypeBadge = (userType: string | null) => {
    if (!userType) return null;
    
    if (userType === 'both') {
      return (
        <div className="flex gap-1">
          <Badge variant="secondary" className="text-xs">
            <User className="h-3 w-3 mr-1" />
            User
          </Badge>
          <Badge variant="secondary" className="text-xs">
            <Building className="h-3 w-3 mr-1" />
            Employer
          </Badge>
        </div>
      );
    }
    
    return userType === 'website_user' ? (
      <Badge variant="secondary" className="text-xs">
        <User className="h-3 w-3 mr-1" />
        Website User
      </Badge>
    ) : (
      <Badge variant="secondary" className="text-xs">
        <Building className="h-3 w-3 mr-1" />
        Employer
      </Badge>
    );
  };

  const DataDetailsDialog = ({ log }: { log: AIDataAccessLog }) => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Eye className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Access Log Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">AI Type</p>
              <div className="mt-1">{getAITypeBadge(log.ai_type)}</div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Access Type</p>
              <Badge variant="outline" className="mt-1">{log.access_type}</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">User Identifier</p>
              <p className="font-mono text-sm mt-1">{log.user_identifier}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Matched User</p>
              <p className="text-sm mt-1">{log.matched_user_name || 'Not matched'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">User Type</p>
              <div className="mt-1">{getUserTypeBadge(log.matched_user_type) || '-'}</div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Response Time</p>
              <p className="text-sm mt-1 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {log.response_time_ms ? `${log.response_time_ms}ms` : '-'}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-sm text-muted-foreground">Timestamp</p>
              <p className="text-sm mt-1">{format(new Date(log.created_at), 'PPpp')}</p>
            </div>
          </div>
          
          {log.data_accessed && Object.keys(log.data_accessed).length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Data Accessed</p>
              <pre className="bg-muted p-4 rounded-lg text-xs overflow-auto max-h-[200px]">
                {JSON.stringify(log.data_accessed, null, 2)}
              </pre>
            </div>
          )}
          
          {log.request_metadata && Object.keys(log.request_metadata).length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Request Metadata</p>
              <pre className="bg-muted p-4 rounded-lg text-xs overflow-auto max-h-[200px]">
                {JSON.stringify(log.request_metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border/10">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 sm:justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <Button 
                variant="ghost" 
                size="icon"
                className="shrink-0"
                onClick={() => navigate('/owner-portal')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
                  <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" />
                  <span className="truncate">User Data Access Logs</span>
                </h1>
                <p className="text-muted-foreground text-xs sm:text-sm hidden sm:block">Complete history of AI data access</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <Button variant="outline" size="icon" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="sm:h-10" onClick={exportToCSV}>
                <Download className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Export CSV</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Filters */}
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex flex-col gap-3 sm:gap-4">
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"><LottieSearchIcon size={16} /></div>
                <Input
                  placeholder="Search by phone or user name..."
                  className="pl-10"
                  value={filters.searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                <Select value={filters.aiType || 'all'} onValueChange={handleAITypeChange}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="AI Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All AI Types</SelectItem>
                    <SelectItem value="whatsapp_ai">WhatsApp AI</SelectItem>
                    <SelectItem value="career_chat_ai">Career Chat AI</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filters.accessType || 'all'} onValueChange={handleAccessTypeChange}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Access Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Access Types</SelectItem>
                    <SelectItem value="website_user">Website User</SelectItem>
                    <SelectItem value="employer">Employer</SelectItem>
                    <SelectItem value="profile">Profile</SelectItem>
                    <SelectItem value="applications">Applications</SelectItem>
                    <SelectItem value="wallet">Wallet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 sm:pb-6">
            <CardTitle className="text-base sm:text-lg">Access Logs</CardTitle>
            {data && (
              <Badge variant="secondary" className="text-xs sm:text-sm">
                {data.totalCount.toLocaleString()} logs
              </Badge>
            )}
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <div className="overflow-x-auto -mx-2 sm:mx-0">
              <ScrollArea className="h-[500px] sm:h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap text-xs sm:text-sm">Time</TableHead>
                      <TableHead className="whitespace-nowrap text-xs sm:text-sm">AI Type</TableHead>
                      <TableHead className="whitespace-nowrap text-xs sm:text-sm hidden sm:table-cell">Access</TableHead>
                      <TableHead className="whitespace-nowrap text-xs sm:text-sm">User</TableHead>
                      <TableHead className="whitespace-nowrap text-xs sm:text-sm hidden md:table-cell">Matched</TableHead>
                      <TableHead className="whitespace-nowrap text-xs sm:text-sm hidden lg:table-cell">Type</TableHead>
                      <TableHead className="whitespace-nowrap text-xs sm:text-sm hidden sm:table-cell">Time</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      [...Array(10)].map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-16 sm:w-32" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-16 sm:w-24" /></TableCell>
                          <TableCell className="hidden sm:table-cell"><Skeleton className="h-6 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-20 sm:w-28" /></TableCell>
                          <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell className="hidden lg:table-cell"><Skeleton className="h-6 w-20" /></TableCell>
                          <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                        </TableRow>
                      ))
                    ) : data?.logs && data.logs.length > 0 ? (
                      data.logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                            {format(new Date(log.created_at), 'MMMM dd, HH:mm')}
                          </TableCell>
                          <TableCell>{getAITypeBadge(log.ai_type)}</TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <Badge variant="outline" className="text-xs">{log.access_type}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs sm:text-sm max-w-[100px] sm:max-w-[150px] truncate">
                            {log.user_identifier}
                          </TableCell>
                          <TableCell className="hidden md:table-cell max-w-[150px] truncate text-sm">
                            {log.matched_user_name || '-'}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">{getUserTypeBadge(log.matched_user_type)}</TableCell>
                          <TableCell className="hidden sm:table-cell text-xs sm:text-sm text-muted-foreground">
                            {log.response_time_ms ? `${log.response_time_ms}ms` : '-'}
                          </TableCell>
                          <TableCell>
                            <DataDetailsDialog log={log} />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No access logs found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>

            {/* Pagination */}
            {data && data.totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mt-4 pt-4 border-t">
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Page {page} of {data.totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Previous</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                    disabled={page === data.totalPages}
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UserDataAccessLogs;
