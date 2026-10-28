import { useState } from 'react';
import { X, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Message {
  id: string;
  imageUrl?: string;
  timestamp: string;
}

interface MediaGalleryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: Message[];
}

export default function MediaGallery({ open, onOpenChange, messages }: MediaGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  
  const mediaMessages = messages.filter(msg => msg.imageUrl);

  const handleDownload = (imageUrl: string, index: number) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `media-${index + 1}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrevious = () => {
    if (selectedIndex !== null && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }
  };

  const handleNext = () => {
    if (selectedIndex !== null && selectedIndex < mediaMessages.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Media Gallery ({mediaMessages.length} items)</DialogTitle>
          </DialogHeader>
          
          {mediaMessages.length > 0 ? (
            <ScrollArea className="h-[500px]">
              <div className="grid grid-cols-3 gap-2">
                {mediaMessages.map((message, index) => (
                  <button
                    key={message.id}
                    onClick={() => setSelectedIndex(index)}
                    className="relative aspect-square rounded-lg overflow-hidden hover:opacity-80 transition-opacity group"
                  >
                    <img
                      src={message.imageUrl}
                      alt={`Media ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {message.timestamp}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No media shared yet
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Full Screen Image Viewer */}
      {selectedIndex !== null && (
        <div className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedIndex(null)}
            className="absolute top-4 right-4 text-white hover:bg-white/20"
          >
            <X className="h-6 w-6" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevious}
            disabled={selectedIndex === 0}
            className="absolute left-4 text-white hover:bg-white/20 disabled:opacity-30"
          >
            <ChevronLeft className="h-8 w-8" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleNext}
            disabled={selectedIndex === mediaMessages.length - 1}
            className="absolute right-4 text-white hover:bg-white/20 disabled:opacity-30"
          >
            <ChevronRight className="h-8 w-8" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDownload(mediaMessages[selectedIndex].imageUrl!, selectedIndex)}
            className="absolute bottom-4 right-4 text-white hover:bg-white/20"
          >
            <Download className="h-6 w-6" />
          </Button>

          <div className="max-w-[90vw] max-h-[90vh]">
            <img
              src={mediaMessages[selectedIndex].imageUrl}
              alt={`Media ${selectedIndex + 1}`}
              className="max-w-full max-h-full object-contain"
            />
          </div>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-3 py-1 rounded-full">
            {selectedIndex + 1} / {mediaMessages.length}
          </div>
        </div>
      )}
    </>
  );
}
