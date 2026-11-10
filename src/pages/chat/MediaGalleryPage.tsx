import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, X, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { chatStorage } from '@/lib/chatStorage';

interface Message {
  id: string;
  imageUrl?: string;
  timestamp: string;
}

export default function MediaGalleryPage() {
  const navigate = useNavigate();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    const storedMessages = chatStorage.loadMessages();
    setMessages(storedMessages);
  }, []);

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
      <div className="flex flex-col h-screen bg-background">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#075E54] shadow-md">
          <div className="flex items-center gap-3 px-4 py-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/ai-assistant')}
              className="shrink-0 text-white hover:bg-white/10"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <h1 className="font-semibold text-white text-lg">
              Media Gallery ({mediaMessages.length} items)
            </h1>
          </div>
        </div>

        {/* Media Grid */}
        {mediaMessages.length > 0 ? (
          <ScrollArea className="flex-1">
            <div className="p-4 grid grid-cols-3 gap-2">
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
          <div className="flex-1 flex items-center justify-center text-center px-4 text-muted-foreground">
            No media shared yet
          </div>
        )}
      </div>

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
