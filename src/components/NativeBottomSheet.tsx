import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNativeFeel } from '@/hooks/useNativeFeel';

interface NativeBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  height?: 'auto' | 'half' | 'full';
}

export const NativeBottomSheet = ({
  isOpen,
  onClose,
  title,
  children,
  height = 'auto',
}: NativeBottomSheetProps) => {
  const { tapFeedback, swipeFeedback } = useNativeFeel();

  // Lock background scroll when sheet is open
  useEffect(() => {
    if (isOpen) {
      swipeFeedback();
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, swipeFeedback]);

  const handleClose = () => {
    tapFeedback();
    onClose();
  };

  const getHeightClass = () => {
    switch (height) {
      case 'half':
        return 'max-h-[50vh]';
      case 'full':
        return 'h-[calc(100vh-env(safe-area-inset-top)-20px)]';
      default:
        return 'max-h-[80vh]';
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Backdrop - solid background to prevent bleed-through */}
      <div
        className={`fixed inset-0 bg-black/70 backdrop-blur-md z-[100] transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
        onTouchMove={(e) => e.preventDefault()}
        style={{ touchAction: 'none' }}
      />

      {/* Bottom Sheet - solid background to prevent any bleed-through */}
      <div
        className={`fixed bottom-0 left-0 right-0 bg-background border-t border-border rounded-t-3xl shadow-2xl z-[101] transition-transform duration-300 ease-out flex flex-col ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        } ${getHeightClass()}`}
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 bg-muted rounded-full" />
        </div>

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-6 py-3 border-b border-border">
             <h3 className="text-lg font-semibold">{title}</h3>
             <Button
               variant="ghost"
               size="icon"
                aria-label="Close payment details"
               className="w-8 h-8 rounded-full active:scale-95 transition-transform"
               onClick={handleClose}
             >
               <ChevronDown className="w-5 h-5" />
             </Button>
           </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto native-scrolling px-6 py-4 pb-24 flex-1 min-h-0">
          {children}
        </div>
      </div>
    </>,
    document.body
  );
};
