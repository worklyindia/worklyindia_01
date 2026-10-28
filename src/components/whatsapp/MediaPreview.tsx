import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Image as ImageIcon, Download, X, Play, File } from "lucide-react";

interface MediaPreviewProps {
  url: string;
  type: 'image' | 'video' | 'document' | 'audio';
  fileName?: string;
}

export function MediaPreview({ url, type, fileName }: MediaPreviewProps) {
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [videoDuration, setVideoDuration] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Get video duration when metadata loads
  useEffect(() => {
    if (type === 'video' && videoRef.current) {
      const handleMetadata = () => {
        if (videoRef.current) {
          const duration = videoRef.current.duration;
          const mins = Math.floor(duration / 60);
          const secs = Math.floor(duration % 60);
          setVideoDuration(`${mins}:${secs.toString().padStart(2, '0')}`);
        }
      };
      videoRef.current.addEventListener('loadedmetadata', handleMetadata);
      return () => {
        videoRef.current?.removeEventListener('loadedmetadata', handleMetadata);
      };
    }
  }, [type]);

  const renderThumbnail = () => {
    switch (type) {
      case 'image':
        return (
          <div 
            className="relative cursor-pointer group"
            onClick={() => setShowFullscreen(true)}
          >
            <img loading="lazy" decoding="async" 
              src={url} 
              alt="Media" 
              className="block w-[280px] max-w-full max-h-[280px] rounded-lg object-contain"
            />
          </div>
        );
      
      case 'video':
        return (
          <div 
            className="relative cursor-pointer group rounded-lg overflow-hidden bg-transparent"
            onClick={() => setShowFullscreen(true)}
          >
            <video 
              ref={videoRef}
              src={url} 
              className="block w-[280px] max-w-full max-h-[280px] object-contain"
              preload="metadata"
            />
            {/* Dark Overlay with Play Button */}
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <div className="h-14 w-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                <Play className="h-7 w-7 text-gray-800 fill-current ml-1" />
              </div>
            </div>
            
            {/* Duration + HD Badge at Bottom Left */}
            <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
              <span className="bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-semibold">
                HD
              </span>
              {videoDuration && (
                <span className="bg-black/70 text-white text-xs px-1.5 py-0.5 rounded font-medium">
                  {videoDuration}
                </span>
              )}
            </div>
          </div>
        );
      
      case 'audio':
        return (
          <div className="bg-transparent py-2 max-w-[250px]">
            <audio controls src={url} className="w-full h-8" />
          </div>
        );
      
      case 'document':
        return (
          <a 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 py-2 bg-transparent max-w-[200px]"
          >
            <FileText className="h-8 w-8 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{fileName || 'Document'}</p>
              <p className="text-xs text-muted-foreground">Tap to open</p>
            </div>
            <Download className="h-4 w-4 text-muted-foreground" />
          </a>
        );
      
      default:
        return (
          <a 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 py-2 bg-transparent"
          >
            <File className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm">View attachment</span>
          </a>
        );
    }
  };

  return (
    <>
      {renderThumbnail()}

      {/* Fullscreen Modal for images/videos */}
      <Dialog open={showFullscreen} onOpenChange={setShowFullscreen}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70 text-white"
            onClick={() => setShowFullscreen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
          
          {type === 'image' && (
            <img loading="lazy" decoding="async" 
              src={url} 
              alt="Full size" 
              className="w-full h-full object-contain"
            />
          )}
          
          {type === 'video' && (
            <video 
              src={url} 
              controls 
              autoPlay 
              className="w-full h-full object-contain"
            />
          )}

          <div className="absolute bottom-4 right-4">
            <Button asChild variant="secondary">
              <a href={url} download target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4 mr-2" />
                Download
              </a>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function MediaTypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'image':
      return <ImageIcon className="h-4 w-4" />;
    case 'video':
      return <Play className="h-4 w-4" />;
    case 'document':
      return <FileText className="h-4 w-4" />;
    default:
      return <File className="h-4 w-4" />;
  }
}
