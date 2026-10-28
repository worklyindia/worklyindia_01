import { Download, FileText, FileSpreadsheet, FileCode, File, Image } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { forceDownloadFile } from "@/utils/forceDownload";


interface ChatFilePreviewProps {
  url: string;
  fileName: string;
  isOutgoing?: boolean;
}

const FILE_ICONS: Record<string, { icon: typeof FileText; color: string }> = {
  pdf: { icon: FileText, color: "text-red-500" },
  html: { icon: FileCode, color: "text-orange-500" },
  csv: { icon: FileSpreadsheet, color: "text-green-600" },
  json: { icon: FileCode, color: "text-yellow-600" },
  txt: { icon: FileText, color: "text-blue-500" },
  md: { icon: FileText, color: "text-purple-500" },
  py: { icon: FileCode, color: "text-blue-400" },
  js: { icon: FileCode, color: "text-yellow-500" },
  ts: { icon: FileCode, color: "text-blue-600" },
  java: { icon: FileCode, color: "text-red-400" },
  css: { icon: FileCode, color: "text-pink-500" },
  xml: { icon: FileCode, color: "text-teal-500" },
  yaml: { icon: FileCode, color: "text-indigo-500" },
  sql: { icon: FileCode, color: "text-cyan-600" },
  sh: { icon: FileCode, color: "text-gray-600" },
  png: { icon: Image, color: "text-emerald-500" },
  jpg: { icon: Image, color: "text-emerald-500" },
  jpeg: { icon: Image, color: "text-emerald-500" },
};

export function ChatFilePreview({ url, fileName, isOutgoing = false }: ChatFilePreviewProps) {
  const [downloading, setDownloading] = useState(false);
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const fileInfo = FILE_ICONS[ext] || { icon: File, color: "text-gray-500" };
  const IconComponent = fileInfo.icon;
  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDownloading(true);
    try {
      const ok = await forceDownloadFile(url, fileName);
      if (ok) {
        toast.success(`Downloading: ${fileName}`);
      } else {
        toast.error('Download nahi ho paya', {
          description: 'File link expire ho sakta hai. AI se attachment dobara maangiye.',
        });
      }
    } finally {
      setDownloading(false);
    }
  };


  const shortName = fileName.length > 22
    ? `${fileName.slice(0, 18)}...${ext ? `.${ext}` : ''}`
    : fileName;

  return (
    <div className={`flex items-center gap-2.5 p-2.5 rounded-xl my-1.5 min-w-[240px] max-w-[300px] ${
      isOutgoing ? 'bg-black/10' : 'bg-gray-50 border border-gray-100'
    }`}>
      {/* File icon */}
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
        isOutgoing ? 'bg-white/20' : 'bg-white shadow-sm'
      }`}>
        <IconComponent className={`h-5 w-5 ${fileInfo.color}`} />
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate">{shortName}</p>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{ext} file</p>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1 shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleDownload}
          disabled={downloading}
          className={`h-7 w-7 rounded-full ${
            downloading
              ? 'bg-gray-200 animate-pulse'
              : 'bg-[#25D366]/10 hover:bg-[#25D366]/20'
          }`}
          title={`Download ${fileName}`}
          aria-label={`Download ${fileName}`}
        >
          <Download className={`h-3.5 w-3.5 ${downloading ? 'text-gray-400' : 'text-[#25D366]'}`} />
        </Button>
      </div>
    </div>
  );
}
