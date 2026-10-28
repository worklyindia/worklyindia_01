import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Plus, Camera, Image as ImageIcon, FileText, ChevronDown } from "lucide-react";
import { toast } from "sonner";

type MediaType = 'image' | 'document' | 'audio' | 'video';
interface WhatsAppAttachmentMenuProps {
  onMediaSelect: (file: File, type: MediaType) => void;
  onTextMessage?: (message: string) => void;
  disabled?: boolean;
  recipientPhone?: string;
  hideJob?: boolean;
}

export function WhatsAppAttachmentMenu({ onMediaSelect, disabled }: WhatsAppAttachmentMenuProps) {
  const [open, setOpen] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) {
      toast.error("File too large. Maximum size is 16MB.");
      return;
    }
    const type: MediaType = file.type.startsWith('image/') ? 'image'
      : file.type.startsWith('video/') ? 'video'
      : file.type.startsWith('audio/') ? 'audio' : 'document';
    onMediaSelect(file, type);
    setOpen(false);
  };
  const options = [
    { label: 'Camera', Icon: Camera, tile: 'chat-attachment-camera', input: cameraInputRef },
    { label: 'Photos', Icon: ImageIcon, tile: 'chat-attachment-photos', input: galleryInputRef },
    { label: 'Files', Icon: FileText, tile: 'chat-attachment-files', input: documentInputRef },
  ];
  return <>
    <input ref={galleryInputRef} aria-label="Select photos" type="file" accept="image/*,video/*" className="hidden" onChange={handleFileSelect} />
    <input ref={cameraInputRef} aria-label="Take photo" type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
    <input ref={documentInputRef} aria-label="Select file" type="file" className="hidden" onChange={handleFileSelect} />
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild><Button variant="ghost" size="icon" aria-label="Add attachment" disabled={disabled}
        className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-muted"><Plus className="h-6 w-6" /></Button></SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl border-0 bg-background px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 [&>button]:hidden">
        <SheetTitle className="sr-only">Attach</SheetTitle>
        <div className="flex justify-center pb-1">
          <Button variant="ghost" size="icon" aria-label="Close attachments" onClick={() => setOpen(false)} className="h-9 w-14 rounded-full text-muted-foreground hover:bg-muted"><ChevronDown className="h-6 w-6" strokeWidth={2.4} /></Button>
        </div>
        <div className="grid grid-cols-3 gap-3 px-2 pb-2">
          {options.map(({ label, Icon, tile, input }) => <Button key={label} variant="ghost" disabled={disabled}
            onClick={() => { setOpen(false); input.current?.click(); }}
            className="flex h-auto min-w-0 flex-col items-center gap-2 px-2 py-4 hover:bg-transparent active:scale-95">
            <span className={`chat-attachment-tile flex h-16 w-16 items-center justify-center rounded-[1.35rem] shadow-lg ${tile}`}><Icon className="h-8 w-8 drop-shadow" strokeWidth={1.9} /></span>
            <span className="text-sm font-medium text-foreground">{label}</span>
          </Button>)}
        </div>
      </SheetContent>
    </Sheet>
  </>;
}
