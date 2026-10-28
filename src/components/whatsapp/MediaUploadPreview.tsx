import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, FileText, Music, Loader2 } from "lucide-react";

interface MediaUploadPreviewProps {
  file: File;
  type: 'image' | 'document' | 'audio' | 'video';
  onCancel: () => void;
  sending?: boolean;
}

export function MediaUploadPreview({ file, type, onCancel, sending }: MediaUploadPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string>();
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const size = file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <div className="mb-2 flex min-w-0 flex-nowrap gap-2 overflow-x-auto px-1 pt-2 pb-1" aria-label="Selected attachments">
      <div className="relative h-28 w-24 shrink-0" aria-label="Selected attachment">
        <div className="flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-lg bg-muted text-foreground">
          {previewUrl && type === 'image' ? <img src={previewUrl} alt={file.name} className="h-full w-full object-contain" />
            : previewUrl && type === 'video' ? <video src={previewUrl} muted preload="metadata" className="h-full w-full object-contain" />
            : <><div className="mb-1 text-primary">{type === 'audio' ? <Music className="h-7 w-7" /> : <FileText className="h-7 w-7" />}</div>
              <p className="line-clamp-2 w-full break-all px-2 text-center text-xs font-medium" title={file.name}>{file.name}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{size}</p></>}
        </div>
        <Button variant="destructive" size="icon" aria-label="Remove attachment" title="Remove attachment" onClick={onCancel} disabled={sending} className="absolute -right-1 -top-1 h-6 w-6 rounded-full">
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}