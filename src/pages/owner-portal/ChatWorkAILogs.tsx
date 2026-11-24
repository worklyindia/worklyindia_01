import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Bot, RefreshCw, Search, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

type LogRow = {
  id: string;
  user_id: string;
  audience: string;
  message_id: string;
  role: 'user' | 'assistant';
  content: string;
  model: string | null;
  status: string;
  created_at: string;
};

export default function ChatWorkAILogs() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<LogRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error('Please sign in as the owner.');
      const { data: admin, error: adminError } = await supabase
        .from('admin_users').select('role').eq('user_id', authData.user.id).maybeSingle();
      if (adminError || admin?.role !== 'owner') {
        setAuthorized(false);
        throw new Error('Owner access is required to view ChatWork AI logs.');
      }
      setAuthorized(true);
      const { data, error } = await supabase
        .from('ai_chat_conversation_logs')
        .select('id,user_id,audience,message_id,role,content,model,status,created_at')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      setRows((data || []) as LogRow[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load AI logs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadLogs(); }, [loadLogs]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      row.content.toLowerCase().includes(query) ||
      row.user_id.toLowerCase().includes(query) ||
      row.audience.toLowerCase().includes(query)
    );
  }, [rows, search]);

  return (
    <div className="container mx-auto max-w-5xl space-y-5 px-4 py-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/owner-portal')} aria-label="Back to Owner Portal">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold">ChatWork AI Logs</h1>
          <p className="text-sm text-muted-foreground">User messages and AI replies from the ChatWork app</p>
        </div>
        <Button variant="outline" size="icon" onClick={() => void loadLogs()} disabled={loading} aria-label="Refresh logs">
          <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Logged messages</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{rows.length}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">User messages</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{rows.filter((r) => r.role === 'user').length}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">AI replies</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{rows.filter((r) => r.role === 'assistant').length}</CardContent></Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search message, user ID or chat type..." className="pl-9" />
      </div>

      {!authorized && !loading ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Owner access is required.</CardContent></Card>
      ) : loading ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading conversation logs...</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">No ChatWork AI messages found. New messages will appear here after they are sent and answered.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => (
            <Card key={row.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  {row.role === 'user' ? <UserRound className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  <Badge variant={row.role === 'user' ? 'secondary' : 'default'}>{row.role === 'user' ? 'User' : 'ChatWork AI'}</Badge>
                  <Badge variant="outline">{row.audience}</Badge>
                  <span className="ml-auto text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString()}</span>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm">{row.content}</p>
                <div className="text-xs text-muted-foreground">User ID: {row.user_id} · Status: {row.status}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
