import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { format } from "date-fns";
import { 
  Search, 
  Filter, 
  RefreshCw, 
  MessageSquare, 
  Clock, 
  User, 
  Mail, 
  Phone, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Eye,
  ArrowLeft
} from "lucide-react";
import { Link } from "react-router-dom";
import LottieSearchIcon from "@/components/LottieSearchIcon";

interface SupportTicket {
  id: string;
  ticket_number: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  user_phone: string | null;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  conversation_context: any;
  ai_attempted_solutions: any;
  assigned_to: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
}

const statusColors: Record<string, string> = {
  open: "bg-yellow-500/20 text-yellow-600 border-yellow-500/30",
  in_progress: "bg-blue-500/20 text-blue-600 border-blue-500/30",
  resolved: "bg-green-500/20 text-green-600 border-green-500/30",
  closed: "bg-muted text-muted-foreground border-muted",
};

const priorityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-yellow-500/20 text-yellow-600",
  high: "bg-orange-500/20 text-orange-600",
  urgent: "bg-destructive/20 text-destructive",
};

export default function SupportTicketsManagement() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [newStatus, setNewStatus] = useState("");

  const { data: tickets, isLoading, refetch } = useQuery({
    queryKey: ['support-tickets', statusFilter, priorityFilter],
    queryFn: async () => {
      let query = supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      if (priorityFilter !== 'all') {
        query = query.eq('priority', priorityFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as SupportTicket[];
    },
  });

  const updateTicketMutation = useMutation({
    mutationFn: async ({ id, status, resolution_notes }: { id: string; status: string; resolution_notes?: string }) => {
      const updateData: any = { status, updated_at: new Date().toISOString() };
      if (status === 'resolved' || status === 'closed') {
        updateData.resolved_at = new Date().toISOString();
        if (resolution_notes) {
          updateData.resolution_notes = resolution_notes;
        }
      }
      const { error } = await supabase
        .from('support_tickets')
        .update(updateData)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ticket updated successfully!");
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      setSelectedTicket(null);
      setResolutionNotes("");
      setNewStatus("");
    },
    onError: (error) => {
      toast.error(`Failed to update ticket: ${error.message}`);
    },
  });

  const filteredTickets = tickets?.filter(ticket => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      ticket.ticket_number?.toLowerCase().includes(search) ||
      ticket.title?.toLowerCase().includes(search) ||
      ticket.user_name?.toLowerCase().includes(search) ||
      ticket.user_email?.toLowerCase().includes(search) ||
      ticket.description?.toLowerCase().includes(search)
    );
  });

  const stats = {
    total: tickets?.length || 0,
    open: tickets?.filter(t => t.status === 'open').length || 0,
    inProgress: tickets?.filter(t => t.status === 'in_progress').length || 0,
    resolved: tickets?.filter(t => t.status === 'resolved').length || 0,
  };

  const handleUpdateStatus = () => {
    if (!selectedTicket || !newStatus) return;
    updateTicketMutation.mutate({
      id: selectedTicket.id,
      status: newStatus,
      resolution_notes: resolutionNotes || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/owner-portal">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Support Tickets</h1>
              <p className="text-muted-foreground">Manage user support tickets from AI Career Chat</p>
            </div>
          </div>
          <Button onClick={() => refetch()} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">Total Tickets</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-500/10 rounded-lg">
                  <AlertCircle className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.open}</p>
                  <p className="text-sm text-muted-foreground">Open</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <Clock className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.inProgress}</p>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.resolved}</p>
                  <p className="text-sm text-muted-foreground">Resolved</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none"><LottieSearchIcon size={16} /></div>
                <Input
                  placeholder="Search by ticket number, title, name, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tickets Table */}
        <Card>
          <CardHeader>
            <CardTitle>Tickets ({filteredTickets?.length || 0})</CardTitle>
            <CardDescription>Click on a ticket to view details and update status</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-10">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">Loading tickets...</p>
              </div>
            ) : filteredTickets?.length === 0 ? (
              <div className="text-center py-10">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">No tickets found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTickets?.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm text-primary font-semibold">
                            {ticket.ticket_number}
                          </span>
                          <Badge variant="outline" className={statusColors[ticket.status]}>
                            {ticket.status.replace('_', ' ')}
                          </Badge>
                          <Badge variant="outline" className={priorityColors[ticket.priority]}>
                            {ticket.priority}
                          </Badge>
                        </div>
                        <h4 className="font-medium truncate">{ticket.title}</h4>
                        <p className="text-sm text-muted-foreground truncate">{ticket.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          {ticket.user_name && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" /> {ticket.user_name}
                            </span>
                          )}
                          {ticket.user_email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" /> {ticket.user_email}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {format(new Date(ticket.created_at), 'dd MMMM yyyy, HH:mm')}
                          </span>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ticket Detail Dialog */}
        <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="font-mono text-primary">{selectedTicket?.ticket_number}</span>
                <Badge variant="outline" className={statusColors[selectedTicket?.status || 'open']}>
                  {selectedTicket?.status?.replace('_', ' ')}
                </Badge>
              </DialogTitle>
              <DialogDescription>{selectedTicket?.title}</DialogDescription>
            </DialogHeader>

            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-6 pr-4">
                {/* User Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">User Name</label>
                    <p className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {selectedTicket?.user_name || 'Anonymous'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Email</label>
                    <p className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      {selectedTicket?.user_email || 'Not provided'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Phone</label>
                    <p className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      {selectedTicket?.user_phone || 'Not provided'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Category</label>
                    <p>{selectedTicket?.category}</p>
                  </div>
                </div>

                <Separator />

                {/* Description */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                    {selectedTicket?.description}
                  </p>
                </div>

                {/* AI Attempted Solutions */}
                {selectedTicket?.ai_attempted_solutions && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">AI Attempted Solutions</label>
                    <div className="bg-muted p-3 rounded-lg space-y-2">
                      {Array.isArray(selectedTicket.ai_attempted_solutions) ? (
                        selectedTicket.ai_attempted_solutions.map((solution: string, idx: number) => (
                          <p key={idx} className="text-sm text-muted-foreground">
                            {idx + 1}. {solution}
                          </p>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {JSON.stringify(selectedTicket.ai_attempted_solutions)}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Conversation Context */}
                {selectedTicket?.conversation_context && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Conversation Context</label>
                    <div className="bg-muted p-3 rounded-lg max-h-40 overflow-y-auto">
                      <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                        {JSON.stringify(selectedTicket.conversation_context, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                <Separator />

                {/* Update Status */}
                <div className="space-y-4">
                  <label className="text-sm font-medium">Update Status</label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select new status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>

                  {(newStatus === 'resolved' || newStatus === 'closed') && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Resolution Notes</label>
                      <Textarea
                        placeholder="Add notes about how the issue was resolved..."
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                        rows={3}
                      />
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedTicket(null)}>
                Cancel
              </Button>
              <Button 
                onClick={handleUpdateStatus} 
                disabled={!newStatus || updateTicketMutation.isPending}
              >
                {updateTicketMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Ticket'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
