import { FileText, Download, File, FileSpreadsheet, FileImage, FileArchive } from "lucide-react";

interface WhatsAppDocumentPreviewProps {
  url: string;
  fileName?: string;
  fileSize?: string;
  isOutgoing?: boolean;
}

export function WhatsAppDocumentPreview({ 
  url, 
  fileName = "Document", 
  fileSize,
  isOutgoing = false 
}: WhatsAppDocumentPreviewProps) {
  
  const getFileExtension = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    return ext;
  };

  const getFileIcon = (name: string) => {
    const ext = getFileExtension(name);
    
    switch (ext) {
      case 'pdf':
        return <FileText className="h-8 w-8 text-red-500" />;
      case 'doc':
      case 'docx':
        return <FileText className="h-8 w-8 text-blue-500" />;
      case 'xls':
      case 'xlsx':
        return <FileSpreadsheet className="h-8 w-8 text-green-600" />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return <FileImage className="h-8 w-8 text-purple-500" />;
      case 'zip':
      case 'rar':
      case '7z':
        return <FileArchive className="h-8 w-8 text-amber-600" />;
      default:
        return <File className="h-8 w-8 text-gray-500" />;
    }
  };

  const getFileTypeLabel = (name: string) => {
    const ext = getFileExtension(name).toUpperCase();
    if (!ext) return 'FILE';
    return ext;
  };

  const formatFileName = (name: string) => {
    if (name.length > 25) {
      const ext = getFileExtension(name);
      const nameWithoutExt = name.slice(0, -(ext.length + 1));
      return `${nameWithoutExt.slice(0, 20)}...${ext ? `.${ext}` : ''}`;
    }
    return name;
  };

  return (
    <a 
      href={url} 
      target="_blank" 
      rel="noopener noreferrer"
      className="flex w-[280px] max-w-full items-center gap-3 rounded-lg bg-transparent py-2 text-foreground"
    >
      {/* File Icon with Type Badge */}
      <div className="relative flex-shrink-0">
        <div className="h-12 w-12 flex items-center justify-center">
          {getFileIcon(fileName)}
        </div>
        <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 text-[8px] font-bold text-muted-foreground">
          {getFileTypeLabel(fileName)}
        </span>
      </div>

      {/* File Info */}
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium text-foreground">
          {formatFileName(fileName)}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {fileSize || 'Document'} • Tap to open
        </p>
      </div>

      {/* Download Icon */}
      <div className="h-8 w-8 flex items-center justify-center flex-shrink-0">
        <Download className="h-4 w-4 text-muted-foreground" />
      </div>
    </a>
  );
}
