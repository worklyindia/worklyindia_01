import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { FileText, FileType2, ClipboardCopy, Printer, Loader2, FileCode2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { downloadDocument, copyPlainText, printPlainText, downloadPlainText, DocKind } from '@/lib/documentDownload';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: DocKind;
  template: string;
  data: unknown;
  filename: string;
  plainText: string;
  docLabel: string;
};

type BusyId = 'pdf' | 'docx' | 'txt' | 'copy' | 'print';

export const FormatSheet: React.FC<Props> = ({ open, onOpenChange, kind, template, data, filename, plainText, docLabel }) => {
  const { toast } = useToast();
  const [busy, setBusy] = useState<null | BusyId>(null);

  const run = async (which: 'pdf' | 'docx') => {
    setBusy(which);
    try {
      await downloadDocument({ kind, format: which, template, data, filename });
      toast({ title: `${which.toUpperCase()} downloaded` });
      onOpenChange(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Download failed', description: e?.message || 'Please try again' });
    } finally {
      setBusy(null);
    }
  };

  const doTxt = () => {
    setBusy('txt');
    try {
      downloadPlainText(filename, plainText);
      toast({ title: 'TXT downloaded' });
      onOpenChange(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Download failed', description: e?.message || 'Please try again' });
    } finally {
      setBusy(null);
    }
  };

  const doCopy = async () => {
    setBusy('copy');
    try {
      await copyPlainText(plainText);
      toast({ title: 'Copied to clipboard' });
      onOpenChange(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Copy failed', description: e?.message || 'Please try again' });
    } finally {
      setBusy(null);
    }
  };

  const doPrint = () => {
    setBusy('print');
    try {
      printPlainText(filename, plainText, { kind, template, data });
      onOpenChange(false);
    } finally {
      setBusy(null);
    }
  };

  const Item: React.FC<{
    id: BusyId;
    icon: React.ReactNode;
    title: string;
    desc: string;
    onClick: () => void;
  }> = ({ id, icon, title, desc, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={busy !== null}
      className="w-full flex items-center gap-3 rounded-2xl border bg-card p-4 text-left hover:bg-muted transition disabled:opacity-60"
    >
      <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        {busy === id ? <Loader2 className="w-5 h-5 text-primary animate-spin" /> : icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </button>
  );

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader className="text-left">
          <SheetTitle>Download {docLabel}</SheetTitle>
          <SheetDescription>Choose a file format.</SheetDescription>
        </SheetHeader>

        <div className="mt-4 grid grid-cols-1 gap-3">
          <Item id="pdf" icon={<FileText className="w-5 h-5 text-primary" />} title="PDF" desc="A4, 1 page, matches your template" onClick={() => run('pdf')} />
          <Item id="docx" icon={<FileType2 className="w-5 h-5 text-primary" />} title="DOCX" desc="Editable Microsoft Word file" onClick={() => run('docx')} />
          <Item id="txt" icon={<FileCode2 className="w-5 h-5 text-primary" />} title="TXT" desc="Plain text file, works everywhere" onClick={doTxt} />
          <Item id="copy" icon={<ClipboardCopy className="w-5 h-5 text-primary" />} title="Copy Text" desc="Plain text to paste anywhere" onClick={doCopy} />
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default FormatSheet;

