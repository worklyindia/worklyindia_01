import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, Upload, X } from 'lucide-react';
import { toast } from 'sonner';

interface WhatsAppWallpaperPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentWallpaper: string;
  customWallpaperUrl: string | null;
  onSelectWallpaper: (wallpaper: string, customUrl?: string) => void;
}

const PREDEFINED_WALLPAPERS = [
  { id: 'default', name: 'WhatsApp Default', color: '#0B141A', pattern: true },
  { id: 'light-green', name: 'Light Green', color: '#DCE3D9' },
  { id: 'dark-green', name: 'Dark Green', color: '#0B3D2E' },
  { id: 'teal', name: 'Teal', color: '#075E54' },
  { id: 'navy', name: 'Navy Blue', color: '#1A2332' },
  { id: 'purple', name: 'Purple', color: '#4A1A4A' },
  { id: 'burgundy', name: 'Burgundy', color: '#6B1E3F' },
  { id: 'charcoal', name: 'Charcoal', color: '#2C3E50' },
  { id: 'forest', name: 'Forest', color: '#1A4D2E' },
  { id: 'midnight', name: 'Midnight', color: '#0D1418' },
  { id: 'gradient-green', name: 'Green Gradient', gradient: 'linear-gradient(135deg, #56ab2f 0%, #a8e063 100%)' },
  { id: 'gradient-blue', name: 'Blue Gradient', gradient: 'linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)' },
  { id: 'gradient-purple', name: 'Purple Gradient', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { id: 'gradient-sunset', name: 'Sunset', gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { id: 'gradient-ocean', name: 'Ocean', gradient: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)' },
  { id: 'gradient-warm', name: 'Warm', gradient: 'linear-gradient(135deg, #f2994a 0%, #f2c94c 100%)' },
];

export function WhatsAppWallpaperPicker({ 
  open, 
  onOpenChange, 
  currentWallpaper,
  customWallpaperUrl,
  onSelectWallpaper 
}: WhatsAppWallpaperPickerProps) {
  const [selectedWallpaper, setSelectedWallpaper] = useState(currentWallpaper);
  const [tempCustomUrl, setTempCustomUrl] = useState<string | null>(customWallpaperUrl);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setTempCustomUrl(reader.result as string);
      setSelectedWallpaper('custom');
    };
    reader.readAsDataURL(file);
  };

  const handleApply = () => {
    if (selectedWallpaper === 'custom' && tempCustomUrl) {
      onSelectWallpaper('custom', tempCustomUrl);
    } else {
      onSelectWallpaper(selectedWallpaper);
    }
    onOpenChange(false);
    toast.success('Wallpaper updated!');
  };

  const getWallpaperStyle = (wp: typeof PREDEFINED_WALLPAPERS[0]) => {
    if (wp.gradient) return { background: wp.gradient };
    if (wp.pattern) {
      return {
        backgroundColor: wp.color,
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23182229' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
      };
    }
    return { backgroundColor: wp.color };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-whatsapp-panel border-whatsapp-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Choose Wallpaper</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-80 pr-4">
          <div className="grid grid-cols-3 gap-3">
            {/* Custom Upload */}
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div 
                className={`aspect-[3/4] rounded-lg border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                  selectedWallpaper === 'custom' 
                    ? 'border-whatsapp-green bg-whatsapp-green/10' 
                    : 'border-dashed border-whatsapp-border hover:border-whatsapp-green/50'
                }`}
                style={tempCustomUrl ? { 
                  backgroundImage: `url(${tempCustomUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                } : undefined}
              >
                {!tempCustomUrl && (
                  <>
                    <Upload className="h-6 w-6 text-whatsapp-secondary" />
                    <span className="text-xs text-whatsapp-secondary">Upload</span>
                  </>
                )}
                {selectedWallpaper === 'custom' && tempCustomUrl && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg">
                    <Check className="h-6 w-6 text-whatsapp-green" />
                  </div>
                )}
              </div>
            </label>

            {/* Predefined Wallpapers */}
            {PREDEFINED_WALLPAPERS.map((wp) => (
              <button
                key={wp.id}
                onClick={() => {
                  setSelectedWallpaper(wp.id);
                  setTempCustomUrl(null);
                }}
                className={`aspect-[3/4] rounded-lg border-2 transition-all relative ${
                  selectedWallpaper === wp.id 
                    ? 'border-whatsapp-green' 
                    : 'border-transparent hover:border-whatsapp-green/50'
                }`}
                style={getWallpaperStyle(wp)}
              >
                {selectedWallpaper === wp.id && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg">
                    <Check className="h-6 w-6 text-whatsapp-green" />
                  </div>
                )}
                <span className="absolute bottom-1 left-1 right-1 text-[10px] text-white/80 text-center truncate bg-black/30 rounded px-1">
                  {wp.name}
                </span>
              </button>
            ))}
          </div>
        </ScrollArea>

        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 border-whatsapp-border text-whatsapp-secondary hover:bg-whatsapp-hover"
          >
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            className="flex-1 bg-whatsapp-green hover:bg-whatsapp-green-dark text-white"
          >
            Apply
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
