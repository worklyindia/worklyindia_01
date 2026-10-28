import { goBack } from '@/lib/goBack';
import { useWidgetBackHandler } from '@/lib/worklyChatReturn';
const inWidget = typeof window !== 'undefined' && window.parent !== window;
import { markFilePickerOpen } from '@/lib/filePickerGuard';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowUp, Check, ChevronDown, Download, FileText, Image as ImageIcon, Inbox, ListChecks, Mail, Mic, Paperclip, RefreshCw, Search, Send, Loader2, Pencil, Plus, Trash2, Video, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ComposerWaveform } from '@/components/ai-chat/ComposerWaveform';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { deleteSupportMail, getSupportThread, getSupportAttachment, listSupportMail, replySupportMail, setSupportMailScope, sendSupportMail, type SupportMail, type SupportAttachment, type MailboxStatus, type MailProvider } from '@/hooks/useSupportMailChat';
import { EmailContent, SenderAvatar, previewText } from '@/components/owner-portal/EmailContent';
import { PdfPagePreview } from '@/components/owner-portal/PdfPagePreview';
import { useStackedComposer } from '@/hooks/useStackedComposer';
import { useBrandAssets } from '@/hooks/useBrandAssets';
import { connectGmail } from '@/hooks/useUserGmail';
import { connectOutlook } from '@/hooks/useUserOutlook';
import { DomainMailboxDialog } from '@/components/owner/TemplateMailboxCards';
import CustomEmailCard from '@/components/social/CustomEmailCard';

const labels: Record<MailProvider, string> = { domain: 'Domain Email', outlook: 'Outlook', gmail: 'Gmail' };
const dateLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\b(am|pm)\b/gi, x => x.toUpperCase());
};
const mailKey = (m: SupportMail) => `${m.provider}:${m.id}`;
const mailTime = (value: string) => { const t = Date.parse(value || ''); return Number.isNaN(t) ? 0 : t; };
let OPEN_MAIL_CACHE = 'owner-support-open-mail';
const PAGE_SIZE = 20;
const readOpenMail = (provider: string | null, id: string | null) => {
  if (!provider || !id) return null;
  try {
    const value = JSON.parse(sessionStorage.getItem(OPEN_MAIL_CACHE) || 'null') as { selected?: SupportMail; thread?: SupportMail[] } | null;
    return value?.selected?.provider === provider && value.selected.id === id ? { selected: value.selected, thread: value.thread || [] } : null;
  } catch { return null; }
};
const address = (s: string) => s.match(/<([^>]+)>/)?.[1] || s;
const senderName = (s: string) => s.replace(/<[^>]+>/g, '').replace(/^"|"$/g, '').trim() || address(s);
const mailboxFallbackName = (email: string) => (email.split('@')[0] || email).replace(/[._-]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()).trim();
const displayName = (value: string, mailbox: string, messages: SupportMail[]) => {
  const email = address(value).trim();
  const explicit = senderName(value);
  if (explicit && explicit.toLowerCase() !== email.toLowerCase() && explicit.toLowerCase() !== 'email') return explicit;
  const matching = messages.flatMap(m => [m.from, m.to]).find(part => address(part).trim().toLowerCase() === email.toLowerCase() && ![email.toLowerCase(), 'email'].includes(senderName(part).toLowerCase()));
  if (matching) return senderName(matching);
  if (email.toLowerCase() === address(mailbox).trim().toLowerCase()) return mailboxFallbackName(email);
  // This contact's name is shown in the supplied conversation screenshot; bare SMTP addresses contain no display name.
  if (email.toLowerCase() === 'gohilvishal7600@gmail.com') return 'Gohil Vishal';
  const [localPart, host = ''] = email.toLowerCase().split('@');
  if (/^(?:no-?reply|notifications?|support|hello|team|info)$/.test(localPart || '') && host) {
    const brand = host.split('.')[0]?.replace(/[-_]+/g, ' ').trim();
    if (brand) return brand.replace(/\b\w/g, letter => letter.toUpperCase());
  }
  return email;
};
const recipientLabel = (value: string, mailbox: string, messages: SupportMail[]) => {
  const email = address(value).trim();
  const name = displayName(value, mailbox, messages);
  return name && name.toLowerCase() !== email.toLowerCase() ? `${name} <${email}>` : email;
};

const isPreviewable = (mimeType: string) => mimeType.startsWith('image/') || mimeType.startsWith('video/') || mimeType === 'application/pdf';

function AttachmentPreview({ file, url }: { file: SupportAttachment; url: string }) {
  if (file.mimeType.startsWith('image/')) return <a href={url} download={file.filename} className="block max-w-xs overflow-hidden rounded-md border"><img src={url} alt={file.filename} loading="lazy" className="max-h-72 w-full object-contain" /></a>;
  if (file.mimeType.startsWith('video/')) return <video src={url} controls playsInline preload="metadata" className="max-h-72 w-full max-w-sm rounded-md border bg-muted" />;
  return <div className="w-full max-w-sm overflow-hidden rounded-md border bg-muted">
    <div className="flex h-80 w-full items-center justify-center overflow-hidden bg-muted p-2"><PdfPagePreview url={url} filename={file.filename} /></div>
    <Button asChild variant="ghost" size="sm" className="w-full justify-between rounded-none"><a href={url} download={file.filename} target="_blank" rel="noreferrer"><span className="truncate">{file.filename}</span><Download className="h-4 w-4" /></a></Button>
  </div>;
}

/** Loads image, video and PDF attachments so previews stay visible after a page refresh. */
function ThreadAttachment({ file, load, onDownload, downloading }: { file: SupportAttachment; load: () => Promise<{ data: string; mimeType?: string; filename?: string }>; onDownload: () => void; downloading: boolean }) {
  const [url, setUrl] = useState(file.localUrl || '');
  const [loading, setLoading] = useState(false);
  const previewable = isPreviewable(file.mimeType);

  useEffect(() => {
    if (file.localUrl || !previewable) return;
    let active = true;
    let created = '';
    setLoading(true);
    load().then(result => {
      const binary = atob(result.data.replace(/-/g, '+').replace(/_/g, '/'));
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
      created = URL.createObjectURL(new Blob([bytes], { type: result.mimeType || file.mimeType }));
      if (active) setUrl(created); else URL.revokeObjectURL(created);
    }).catch(() => undefined).finally(() => { if (active) setLoading(false); });
    return () => { active = false; if (created) URL.revokeObjectURL(created); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.id]);

  if (url) return <div className="w-full"><AttachmentPreview file={file} url={url} /></div>;
  if (loading) return <div className="flex h-20 w-40 items-center justify-center rounded-md border bg-muted"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  return <Button variant="outline" size="sm" className="max-w-full gap-2" onClick={onDownload} disabled={downloading} title={`Download ${file.filename}`}><span className="truncate">{file.filename}</span>{downloading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Download className="h-4 w-4 shrink-0" />}</Button>;
}

function PickedFilePreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const isPdf = file.type === 'application/pdf';
  return <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-md border bg-muted">
    {file.type.startsWith('image/')
      ? <img src={url} alt={file.name} className="h-full w-full object-cover" />
      : file.type.startsWith('video/')
        ? <video src={url} muted playsInline className="h-full w-full object-cover" />
        : isPdf
          ? <div className="relative h-full w-full"><PdfPagePreview url={url} filename={file.name} compact /><span className="absolute inset-x-0 bottom-0 truncate bg-background/85 px-1 text-center text-[10px]">{file.name}</span></div>
          : <div className="flex h-full flex-col items-center justify-center gap-1 px-2"><FileText className="h-7 w-7 text-muted-foreground" /><span className="w-full truncate text-center text-[10px]">{file.name}</span></div>}
    <Button type="button" variant="secondary" size="icon" className="absolute right-1 top-1 h-6 w-6 rounded-full" aria-label={`Remove ${file.name}`} onClick={onRemove}><X className="h-3.5 w-3.5" /></Button>
  </div>;
}

export default function EmailChat({ scope = 'support' }: { scope?: 'support' | 'personal' } = {}) {
  setSupportMailScope(scope);
  OPEN_MAIL_CACHE = scope === 'personal' ? 'employer-personal-open-mail' : 'owner-support-open-mail';
  const personal = scope === 'personal';
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedProvider = searchParams.get('provider');
  const requestedMail = searchParams.get('mail');
  const restoredMail = useMemo(() => readOpenMail(requestedProvider, requestedMail), [requestedMail, requestedProvider]);
  const { toast } = useToast();
  const [items, setItems] = useState<SupportMail[]>([]);
  const [mailboxes, setMailboxes] = useState<MailboxStatus[]>([]);
  const brand = useBrandAssets();
  const brandLogo: string | undefined = brand?.logo_url || brand?.favicon_url;
  const ownLogoFor = (from: string, mailbox: string) => { const a = address(from || '').trim().toLowerCase(); return a && (a === address(mailbox || '').trim().toLowerCase() || mailboxes.some(x => address(x.mailbox || '').trim().toLowerCase() === a)) ? brandLogo : undefined; };
  const [selected, setSelected] = useState<SupportMail | null>(() => restoredMail?.selected || null);
  const [thread, setThread] = useState<SupportMail[]>(() => restoredMail?.thread || []);
  const [filter, setFilter] = useState<MailProvider | 'all'>('all');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [listening, setListening] = useState(false);
  const recogRef = useRef<any>(null);
  const toggleDictation = () => {
    if (listening) { recogRef.current?.stop(); return; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = navigator.language || 'en-IN';
    r.interimResults = false;
    r.onresult = (e: any) => { const t = Array.from(e.results).map((x: any) => x[0].transcript).join(' '); setDraft(d => (d ? d + ' ' : '') + t); };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recogRef.current = r; r.start(); setListening(true);
  };
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [openMobileThread, setOpenMobileThread] = useState(() => Boolean(restoredMail?.selected));
  const [composing, setComposing] = useState(false);
  useWidgetBackHandler(() => { if (composing) { setComposing(false); setOpenMobileThread(false); return true; } if (selected || openMobileThread) { setSelected(null); setOpenMobileThread(false); setThread([]); return true; } return false; });
  const [composeProvider, setComposeProvider] = useState<MailProvider>('gmail');
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [downloading, setDownloading] = useState('');
  const replyInputRef = useRef<HTMLTextAreaElement>(null);
  const { mirrorRef: composerMirrorRef, expanded: composerExpanded } = useStackedComposer(draft, { inputRef: replyInputRef, inlineControlsWidth: 88 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});
  const [picked, setPicked] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const longPress = useRef<number | null>(null);
  const suppressOpen = useRef('');
  const selecting = selectionMode || picked.length > 0;
  const togglePick = (key: string) => setPicked(old => old.includes(key) ? old.filter(k => k !== key) : [...old, key]);
  const addFiles = (list: FileList | null) => { const next = Array.from(list || []); if (next.length) setFiles(old => [...old, ...next].slice(0, 5)); };

  const downloadFile = async (message: SupportMail, file: SupportAttachment) => {
    if (!selected) return;
    const key = `${message.id}:${file.id}`;
    setDownloading(key);
    try {
      const result = await getSupportAttachment(selected.provider, selected.id, message.id, file.id);
      const binary = atob(result.data.replace(/-/g, '+').replace(/_/g, '/'));
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: result.mimeType || 'application/octet-stream' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename || 'attachment';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      toast({ title: 'Download failed', description: e instanceof Error ? e.message : 'Please try again', variant: 'destructive' });
    } finally { setDownloading(''); }
  };

  useEffect(() => {
    const input = replyInputRef.current;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 128)}px`;
  }, [draft, selected, openMobileThread]);

  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await listSupportMail(0, PAGE_SIZE);
      setItems(data.items);
      setMailboxes(data.mailboxes);
      setHasMore(data.hasMore);
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load support email'); }
    finally { setLoading(false); }
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || !hasMore) return;
    setLoadingMore(true);
    try {
      const data = await listSupportMail(items.length, PAGE_SIZE);
      setItems(old => {
        const seen = new Set(old.map(mailKey));
        return [...old, ...data.items.filter(m => !seen.has(mailKey(m)))];
      });
      setHasMore(data.hasMore);
    } catch { /* keep existing list; next scroll retries */ }
    finally { setLoadingMore(false); }
  }, [hasMore, items.length, loading, loadingMore]);

  useEffect(() => {
    const root = listScrollRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) void loadMore();
    }, { root, rootMargin: '200px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  useEffect(() => { void refresh(); }, [refresh]);
  const selectMail = useCallback(async (mail: SupportMail, updateUrl = true) => {
    setComposing(false);
    setSelected(mail);
    setThread([]);
    setDraft('');
    setThreadLoading(true);
    setOpenMobileThread(true);
    sessionStorage.setItem(OPEN_MAIL_CACHE, JSON.stringify({ selected: mail, thread: [] }));
    if (updateUrl) setSearchParams({ provider: mail.provider, mail: mail.id }, { replace: true });
    try {
      const result = await getSupportThread(mail.provider, mail.id);
      setThread(result.items);
      sessionStorage.setItem(OPEN_MAIL_CACHE, JSON.stringify({ selected: mail, thread: result.items }));
      setItems(old => old.map(m => mailKey(m) === mailKey(mail) ? { ...m, unread: false } : m));
    } catch (e) {
      toast({ title: 'Could not open email', description: e instanceof Error ? e.message : 'Please try again', variant: 'destructive' });
    } finally { setThreadLoading(false); }
  }, [setSearchParams, toast]);

  useEffect(() => {
    if (loading || selected || !requestedProvider || !requestedMail) return;
    const match = items.find(mail => mail.provider === requestedProvider && mail.id === requestedMail);
    if (match) void selectMail(match, false);
  }, [items, loading, requestedMail, requestedProvider, selectMail, selected]);

  const visible = useMemo(() => items.filter(m => (filter === 'all' || m.provider === filter) &&
    `${m.from} ${m.subject} ${m.body} ${m.mailbox}`.toLowerCase().includes(query.toLowerCase().trim()))
    .sort((a, b) => mailTime(b.date) - mailTime(a.date)), [items, filter, query]);
  const connectedProviders = useMemo(() => mailboxes.filter(mailbox => mailbox.connected), [mailboxes]);
  const inboxOptions = useMemo<(MailProvider | 'all')[]>(() => connectedProviders.length > 1 ? ['all', ...connectedProviders.map(mailbox => mailbox.provider)] : connectedProviders.map(mailbox => mailbox.provider), [connectedProviders]);
  const headerFilter = filter === 'all' && connectedProviders.length === 1 ? connectedProviders[0]?.provider : filter;

  const [connecting, setConnecting] = useState(false);
  const [domainOpen, setDomainOpen] = useState(false);
  const startConnect = async (provider: MailProvider) => {
    if (provider === 'domain') { setDomainOpen(true); return; }
    setConnecting(true);
    try {
      const sc = personal ? undefined : 'support';
      if (provider === 'gmail') await connectGmail(sc); else await connectOutlook(sc);
      toast({ title: `${labels[provider]} connected` });
      refresh();
    } catch (e) {
      toast({ title: 'Connection failed', description: e instanceof Error ? e.message : 'Please try again.', variant: 'destructive' });
    } finally { setConnecting(false); }
  };
  const filterDisconnected = filter !== 'all' && !loading && !connectedProviders.some(m => m.provider === filter);

  const deletePicked = async () => {
    if (!picked.length || deleting) return;
    const chosen = items.filter(m => picked.includes(mailKey(m)));
    setDeleting(true);
    try {
      const groups = new Map<MailProvider, string[]>();
      chosen.forEach(m => groups.set(m.provider, [...(groups.get(m.provider) || []), m.id]));
      for (const [provider, ids] of groups) await deleteSupportMail(provider, ids);
      setItems(old => old.filter(m => !picked.includes(mailKey(m))));
      if (selected && picked.includes(mailKey(selected))) { setSelected(null); setThread([]); setOpenMobileThread(false); }
      setPicked([]);
      setSelectionMode(false);
      toast({ title: `${chosen.length} email${chosen.length > 1 ? 's' : ''} deleted` });
      void refresh(true);
    } catch (e) {
      toast({ title: 'Could not delete', description: e instanceof Error ? e.message : 'Please try again', variant: 'destructive' });
    } finally { setDeleting(false); }
  };


  const sendReply = async () => {
    if (!selected || (!draft.trim() && !files.length) || sending) return;
    if (files.reduce((n, f) => n + f.size, 0) > 10 * 1024 * 1024) { toast({ title: 'Files too large', description: 'Keep attachments under 10 MB in total', variant: 'destructive' }); return; }
    setSending(true);
    try {
      const text = draft.trim();
      const payload = await Promise.all(files.map(f => new Promise<{ name: string; mimeType: string; data: string }>((res, rej) => { const r = new FileReader(); r.onload = () => res({ name: f.name, mimeType: f.type || 'application/octet-stream', data: String(r.result).split(',')[1] || '' }); r.onerror = () => rej(new Error(`Could not read ${f.name}`)); r.readAsDataURL(f); })));
      await replySupportMail(selected.provider, selected.id, text, payload);
      setDraft('');
      const localFiles = payload.map((file, index) => ({
        id: `local-${index}`,
        filename: file.name,
        mimeType: file.mimeType,
        size: files[index]?.size || 0,
        localUrl: `data:${file.mimeType};base64,${file.data}`,
      }));
      setFiles([]);
      toast({ title: 'Reply sent' });
      // Domain SMTP servers do not always save outgoing mail to Sent; show a local confirmation.
      setThread(old => [...old, { ...selected, id: `sent-${Date.now()}`, from: selected.mailbox, to: address(selected.from), body: text, html: undefined, attachments: localFiles, date: new Date().toISOString(), unread: false, hasAttachments: payload.length > 0 }]);
      void refresh(true);
    } catch (e) {
      toast({ title: 'Reply not sent', description: e instanceof Error ? e.message : 'Please try again', variant: 'destructive' });
    } finally { setSending(false); }
  };

  const sendNew = async () => {
    if (!composeTo.trim() || !composeSubject.trim() || !draft.trim() || sending) return;
    setSending(true);
    try {
      await sendSupportMail(composeProvider, composeTo.trim(), composeSubject.trim(), draft.trim());
      setComposing(false);
      setOpenMobileThread(false);
      setDraft('');
      setComposeTo('');
      setComposeSubject('');
      toast({ title: 'Email sent' });
      void refresh(true);
    } catch (e) {
      toast({ title: 'Email not sent', description: e instanceof Error ? e.message : 'Please try again', variant: 'destructive' });
    } finally { setSending(false); }
  };

  if (composing) return <div className="fixed inset-0 z-[60] flex flex-col bg-background">
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={e => { e.preventDefault(); void sendNew(); }}>
      <header className="flex shrink-0 items-center gap-2 border-b px-3 py-2 sm:px-6">
        <Button type="button" variant="ghost" size="icon" aria-label="Close compose" onClick={() => { setComposing(false); setOpenMobileThread(false); }}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold">Compose</h1>
        <Button type="submit" size="sm" disabled={sending || !mailboxes.some(m => m.connected) || !composeTo.trim() || !composeSubject.trim() || !draft.trim()}><Send className="mr-2 h-4 w-4" />{sending ? 'Sending…' : 'Send'}</Button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <label className="flex min-h-14 shrink-0 items-center gap-3 border-b px-4 text-sm text-muted-foreground sm:px-6">From
          <select className="min-w-0 flex-1 bg-background text-foreground outline-none" aria-label="Send from mailbox" value={mailboxes.some(m => m.connected && m.provider === composeProvider) ? composeProvider : ''} onChange={e => setComposeProvider(e.target.value as MailProvider)}>
            {!mailboxes.some(m => m.connected) && <option value="">No mailbox connected</option>}
            {mailboxes.filter(m => m.connected).map(m => <option key={m.provider} value={m.provider}>{labels[m.provider]} · {m.mailbox}</option>)}
          </select>
        </label>
        <label className="flex min-h-14 shrink-0 items-center gap-3 border-b px-4 text-sm text-muted-foreground sm:px-6">To<Input type="email" required aria-label="Recipient" className="h-10 min-w-0 flex-1 border-0 shadow-none focus-visible:ring-0" value={composeTo} onChange={e => setComposeTo(e.target.value)} /></label>
        <label className="flex min-h-14 shrink-0 items-center gap-3 border-b px-4 text-sm text-muted-foreground sm:px-6">Subject<Input required maxLength={300} aria-label="Subject" className="h-10 min-w-0 flex-1 border-0 shadow-none focus-visible:ring-0" value={composeSubject} onChange={e => setComposeSubject(e.target.value)} /></label>
        <Textarea aria-label="Email message" required maxLength={20000} placeholder="Write your email…" className="min-h-[240px] flex-1 resize-none rounded-none border-0 px-4 py-5 shadow-none focus-visible:ring-0 sm:px-6" value={draft} onChange={e => setDraft(e.target.value)} />
      </div>
    </form>
  </div>;

  return <div className="fixed inset-0 z-50 mx-auto flex w-full max-w-7xl flex-col overflow-hidden bg-background md:relative md:z-auto md:h-[100dvh] md:border-x">
    <header className={`${selected ? 'hidden' : 'flex'} shrink-0 items-center justify-between gap-2 border-b px-3 py-3 sm:px-5`}>
      {selecting ? <>
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Cancel selection" onClick={() => { setPicked([]); setSelectionMode(false); }}><X className="h-5 w-5" /></Button>
          <span className="text-sm font-semibold">{picked.length} selected</span>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="icon" aria-label="Select all emails" onClick={() => setPicked(picked.length === visible.length ? [] : visible.map(mailKey))}><Check className="h-5 w-5" /></Button>
          <Button variant="ghost" size="icon" aria-label="Delete selected emails" onClick={() => void deletePicked()} disabled={deleting}>{deleting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Trash2 className="h-5 w-5 text-destructive" />}</Button>
        </div>
      </> : <>
      <div className="flex min-w-0 items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Back" onClick={() => (inWidget ? window.parent.postMessage({ type: 'workly-chat:close' }, '*') : goBack(navigate, personal ? '/employer-portal' : '/owner-portal'))}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="truncate text-xl font-semibold text-primary">Workly Email</h1>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button variant="ghost" size="icon" aria-label="Compose email" onClick={() => { const connected = mailboxes.find(m => m.provider === filter && m.connected) || mailboxes.find(m => m.connected); if (connected) setComposeProvider(connected.provider); setDraft(''); setComposing(true); setOpenMobileThread(true); }}><Pencil className="h-4 w-4" /></Button>
         <Button variant="ghost" size="icon" aria-label="Select emails" onClick={() => setSelectionMode(true)}><ListChecks className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" aria-label="Refresh inbox" onClick={() => void refresh()} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></Button>
      </div>
      </>}
    </header>
    {!selecting && !selected && <div role="tablist" aria-label="Email inbox" className="grid shrink-0 grid-cols-4 border-b bg-background">
      {(['all', 'gmail', 'outlook', 'domain'] as const).map(p => <Button key={p} role="tab" variant="ghost" aria-selected={filter === p} onClick={() => { setFilter(p); setOpenMobileThread(false); }} className={`h-auto rounded-none border-b-2 px-1 py-3 text-xs font-medium sm:text-sm ${filter === p ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>{p === 'all' ? 'All' : labels[p]}</Button>)}
    </div>}
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <aside className={`${openMobileThread ? 'hidden md:flex' : 'flex'} min-h-0 w-full flex-col border-r md:w-[350px] lg:w-[400px]`}>
        <div className="border-b p-3">
          <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="h-10 rounded-full bg-muted/50 pl-9" placeholder="Search in emails" value={query} onChange={e => setQuery(e.target.value)} aria-label="Search in emails" /></div>
        </div>
        <div ref={listScrollRef} className="min-h-0 flex-1 overflow-y-auto">
          {error && <p role="alert" className="m-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          {mailboxes.filter(m => m.error).map(m => <p key={m.provider} className="mx-3 mt-2 text-xs text-amber-700">{labels[m.provider]}: {m.error}</p>)}
          {filterDisconnected && <div className="flex flex-col items-center gap-3 px-6 py-14 text-center"><div className="rounded-full bg-primary/10 p-4"><Mail className="h-8 w-8 text-primary" /></div><p className="text-base font-semibold">{labels[filter]} is not connected</p><p className="text-sm text-muted-foreground">Connect your {labels[filter]} account to read and reply to emails here.</p>{filter === 'domain' && personal ? <div className="w-full max-w-sm text-left"><CustomEmailCard variant="connect" onOpenSettings={() => refresh()} /></div> : <Button disabled={connecting} onClick={() => startConnect(filter as MailProvider)}>{connecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Connect {labels[filter]}</Button>}</div>}
          {!personal && <DomainMailboxDialog open={domainOpen} scope="support" onOpenChange={setDomainOpen} onConnected={() => { setDomainOpen(false); refresh(); }} />}
          {loading && <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading mail…</div>}
          {!loading && !filterDisconnected && !visible.length && !error && <div className="flex flex-col items-center gap-2 px-5 py-12 text-center text-muted-foreground"><Inbox className="h-9 w-9" /><p className="text-sm">{mailboxes.some(m => m.connected) ? 'No emails found in this inbox.' : (personal ? 'No email connected yet.' : 'No support mailbox connected yet.')}</p><Button variant="outline" size="sm" onClick={() => navigate(personal ? '/ai-assistant/connect' : '/owner-portal/customer-service')}>Manage mailboxes</Button></div>}
           {!loading && visible.map(m => { const key = mailKey(m); const chosen = picked.includes(key); return <Button key={key} variant="ghost"
             onContextMenu={e => { e.preventDefault(); togglePick(key); }}
             onPointerDown={() => { longPress.current = window.setTimeout(() => { longPress.current = null; suppressOpen.current = key; setSelectionMode(true); togglePick(key); }, 450); }}
             onPointerUp={() => { if (longPress.current) { window.clearTimeout(longPress.current); longPress.current = null; } }}
             onPointerLeave={() => { if (longPress.current) { window.clearTimeout(longPress.current); longPress.current = null; } }}
             onPointerCancel={() => { if (longPress.current) { window.clearTimeout(longPress.current); longPress.current = null; } }}
             onClick={() => { if (suppressOpen.current === key) { suppressOpen.current = ''; return; } if (selecting) { togglePick(key); return; } void selectMail(m); }}
             className={`h-auto w-full justify-start gap-3 rounded-none border-b px-4 py-3 text-left font-normal hover:bg-muted/60 ${chosen ? 'bg-primary/10' : selected && mailKey(selected) === key ? 'bg-primary/5' : ''}`}>
               {chosen
                 ? <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-5 w-5" /></span>
                 : <SenderAvatar from={m.from || ''} ownLogo={ownLogoFor(m.from, m.mailbox)} name={displayName(m.from || '?', m.mailbox, items)} />}
            <span className="min-w-0 flex-1 space-y-0.5">
               <span className="flex items-center gap-2"><span className={`min-w-0 flex-1 truncate text-sm ${m.unread ? 'font-bold' : 'font-medium'}`}>{displayName(m.from || 'Unknown sender', m.mailbox, items)}</span><span className="shrink-0 text-[11px] text-muted-foreground">{dateLabel(m.date)}</span>{m.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}</span>
              <span className={`block truncate text-sm ${m.unread ? 'font-semibold' : ''}`}>{m.subject || '(no subject)'}</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground"><span className="min-w-0 flex-1 truncate">{previewText(m.body)}</span>{m.hasAttachments && <Paperclip className="h-3.5 w-3.5 shrink-0" />}</span>
            </span>
           </Button>; })}
           {!loading && visible.length > 0 && <div ref={sentinelRef} className="h-1" aria-hidden />}
           {loadingMore && <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading older emails…</div>}
         </div>
      </aside>
      <main className={`${openMobileThread ? 'flex' : 'hidden md:flex'} min-h-0 min-w-0 flex-1 flex-col`}>
        {!selected ? <div className="hidden h-full flex-col items-center justify-center gap-2 text-muted-foreground md:flex"><Mail className="h-10 w-10" /><p>Select an email to read and reply</p></div> : <>
           <div className="flex shrink-0 items-center gap-1 border-b px-2 py-2 sm:px-4">
              <Button variant="ghost" size="icon" className="shrink-0" aria-label="Back to inbox" onClick={() => { setSelected(null); setOpenMobileThread(false); setThread([]); sessionStorage.removeItem(OPEN_MAIL_CACHE); setSearchParams({}, { replace: true }); }}><ArrowLeft className="h-5 w-5" /></Button>
             <h1 className="min-w-0 flex-1 break-words pr-2 text-base font-semibold leading-snug sm:text-lg">{thread[0]?.subject || selected.subject || '(no subject)'}</h1>
           </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-3 pb-5 sm:p-5">
            {threadLoading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>}
            {!threadLoading && !thread.length && <p className="text-center text-sm text-muted-foreground">Could not load conversation. Choose the email again to retry.</p>}
             {thread.map(m => {
               const key = mailKey(m);
                const detailsOpen = true;
               return <article key={key} className="min-w-0 border-b pb-5 last:border-0">
                   <div className="flex items-start gap-3"><SenderAvatar from={m.from || ''} ownLogo={ownLogoFor(m.from, m.mailbox)} name={displayName(m.from || '?', m.mailbox, thread)} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><span className="min-w-0 break-words text-sm font-semibold">{displayName(m.from, m.mailbox, thread)}</span><time className="shrink-0 pt-0.5 text-xs text-muted-foreground">{dateLabel(m.date)}</time></div>{detailsOpen && <div className="mt-1"><p className="break-all text-xs text-muted-foreground">From: {address(m.from)}</p><p className="break-all text-xs text-muted-foreground">To: {recipientLabel(m.to || m.mailbox, m.mailbox, thread)}</p></div>}</div></div>
               <EmailContent html={m.html} body={m.body} title={`Email from ${senderName(m.from)}`} />
                {!!m.attachments?.length && <div className="mt-4 flex flex-wrap gap-2">{m.attachments.map(file => <ThreadAttachment
                  key={file.id}
                  file={file}
                  load={() => getSupportAttachment(selected.provider, selected.id, m.id, file.id)}
                  onDownload={() => void downloadFile(m, file)}
                  downloading={downloading === `${m.id}:${file.id}`}
                />)}</div>}
               {m.hasAttachments && !m.attachments?.length && <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground"><Paperclip className="h-3 w-3" />Attachments unavailable</p>}
             </article>; })}
          </div>
           <form className="shrink-0 bg-transparent px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-5" onSubmit={e => { e.preventDefault(); void sendReply(); }}>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
              <input ref={photoInputRef} type="file" multiple accept="image/*" className="hidden" onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
              <input ref={videoInputRef} type="file" multiple accept="video/*" className="hidden" onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
              <input ref={pdfInputRef} type="file" multiple accept="application/pdf,.pdf" className="hidden" onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
                {!!files.length && <div className="mb-2 flex gap-2 overflow-x-auto pb-1">{files.map((file, index) => <PickedFilePreview key={`${file.name}-${file.lastModified}`} file={file} onRemove={() => setFiles(old => old.filter((_, itemIndex) => itemIndex !== index))} />)}</div>}
                <div className={`relative flex flex-wrap items-center gap-1 rounded-[28px] border border-border bg-card px-2 py-1.5 shadow-md transition-all duration-150 focus-within:ring-1 focus-within:ring-ring ${composerExpanded && !listening ? 'rounded-[24px] px-3 py-2.5' : ''}`}>
                <textarea ref={composerMirrorRef} aria-hidden tabIndex={-1} readOnly rows={1} className="pointer-events-none absolute left-0 top-0 -z-10 block h-5 resize-none overflow-hidden border-0 bg-transparent px-1 py-0 text-sm leading-5 opacity-0" />
                {listening ? (
                  <>
                    <button type="button" onClick={toggleDictation} aria-label="Cancel voice typing" className="order-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-muted transition-colors">
                      <X className="h-6 w-6" strokeWidth={2.2} />
                    </button>
                    <div className="order-2 flex min-w-0 flex-1 items-center">
                      <ComposerWaveform stream={null} active={listening} />
                    </div>
                  </>
                ) : (
                  <>
                    <Sheet open={attachOpen} onOpenChange={setAttachOpen}>
                      <SheetTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" className={`h-9 w-8 shrink-0 rounded-full text-foreground hover:bg-muted ${composerExpanded ? 'order-2' : 'order-1'}`} aria-label="Attach photo or file" title="Attach photo or file" disabled={sending || files.length >= 5}><Plus className="h-5 w-5" strokeWidth={2} /></Button>
                      </SheetTrigger>
                      <SheetContent side="bottom" className="rounded-t-3xl border-0 bg-background px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 [&>button]:hidden">
                        <SheetTitle className="sr-only">Attach</SheetTitle>
                        <div className="flex items-center justify-center pb-1 pt-0">
                          <button type="button" onClick={() => setAttachOpen(false)} aria-label="Close" className="flex h-9 w-14 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-muted active:scale-95"><ChevronDown className="h-6 w-6" strokeWidth={2.4} /></button>
                        </div>
                        <div className="grid grid-cols-4 gap-3 px-2 pb-2">
                          {[
                            { key: 'photos', label: 'Photos', icon: <ImageIcon className="h-7 w-7 text-white drop-shadow" strokeWidth={1.9} />, tile: 'bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500', pick: () => photoInputRef.current?.click() },
                            { key: 'videos', label: 'Videos', icon: <Video className="h-7 w-7 text-white drop-shadow" strokeWidth={1.9} />, tile: 'bg-gradient-to-br from-pink-500 via-rose-500 to-orange-400', pick: () => videoInputRef.current?.click() },
                            { key: 'pdf', label: 'PDF', icon: <FileText className="h-7 w-7 text-white drop-shadow" strokeWidth={1.9} />, tile: 'bg-gradient-to-br from-red-500 via-rose-500 to-amber-500', pick: () => pdfInputRef.current?.click() },
                            { key: 'files', label: 'Files', icon: <Paperclip className="h-7 w-7 text-white drop-shadow" strokeWidth={1.9} />, tile: 'bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-500', pick: () => fileInputRef.current?.click() },
                          ].map(item => <button key={item.key} type="button" onClick={() => { markFilePickerOpen(); setAttachOpen(false); item.pick(); }} className="flex flex-col items-center gap-2 rounded-2xl px-1 py-4 transition-all active:scale-95">
                            <span className={`flex h-14 w-14 items-center justify-center rounded-[1.25rem] shadow-lg ring-1 ring-white/25 ${item.tile}`}>{item.icon}</span>
                            <span className="text-xs font-medium text-foreground">{item.label}</span>
                          </button>)}
                        </div>
                      </SheetContent>
                    </Sheet>
                    <textarea ref={replyInputRef} id="email-reply" aria-label={`Reply to ${address(selected.from)}`} rows={1} value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void sendReply(); } }} placeholder="Reply…" maxLength={20000} className={`block max-h-32 resize-none overflow-hidden overscroll-contain border-0 bg-transparent px-1 py-0 text-sm leading-5 text-foreground shadow-none placeholder:text-muted-foreground focus:outline-none ${composerExpanded ? 'order-1 mb-1 w-full basis-full' : 'order-2 min-w-0 flex-1'}`} disabled={sending || threadLoading || !thread.length} />
                  </>
                )}
                <div className="order-3 ml-auto flex shrink-0 items-center">
                {listening ? (
                  <button type="button" onClick={toggleDictation} aria-label="Stop voice typing" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 shadow-md transition-colors">
                    <span className="h-3.5 w-3.5 rounded-[3px] bg-white" />
                  </button>
                ) : (draft.trim() || files.length || sending) ? (
                  <button type="submit" aria-label={sending ? 'Sending reply' : 'Send reply'} title="Send reply" disabled={sending || threadLoading || !thread.length} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-md bg-[#0A84FF] hover:bg-[#0a76e0] text-white disabled:opacity-40 transition-colors">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-[22px] w-[22px]" strokeWidth={2.5} />}
                  </button>
                ) : (
                  <button type="button" onClick={toggleDictation} aria-label="Voice typing" title="Voice typing" disabled={threadLoading || !thread.length} className="flex h-9 w-8 shrink-0 items-center justify-center rounded-full text-foreground disabled:opacity-50 hover:bg-muted transition-colors">
                    <Mic className="h-[22px] w-[22px]" strokeWidth={2} />
                  </button>
                )}
                </div>
              </div>
            </form>
        </>}
      </main>
    </div>
  </div>;
}