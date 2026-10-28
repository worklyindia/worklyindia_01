import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';

interface JobImage {
  id: string;
  image_url: string;
  image_type: 'uploaded' | 'ai_generated';
  size_category: 'banner' | 'square' | 'social';
  sort_order: number;
}

interface JobImageGalleryProps {
  images: JobImage[];
  jobTitle?: string;
  companyName?: string;
}

export const JobImageGallery = ({ images, jobTitle, companyName }: JobImageGalleryProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: 'start' },
    [Autoplay({ delay: 3000, stopOnInteraction: false, stopOnMouseEnter: true })]
  );
  const [thumbnailRef, thumbnailApi] = useEmblaCarousel({ 
    containScroll: 'keepSnaps',
    dragFree: true 
  });

  // Sync thumbnail selection with main carousel
  useEffect(() => {
    if (!emblaApi) return;
    
    const onSelect = () => {
      setSelectedIndex(emblaApi.selectedScrollSnap());
      if (thumbnailApi) {
        thumbnailApi.scrollTo(emblaApi.selectedScrollSnap());
      }
    };
    
    emblaApi.on('select', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, thumbnailApi]);

  const scrollToIndex = (index: number) => {
    emblaApi?.scrollTo(index);
    setSelectedIndex(index);
  };

  const handleImageClick = (index: number) => {
    setSelectedIndex(index);
    setShowFullscreen(true);
  };

  if (!images || images.length === 0) {
    return null;
  }

  // Sort images by sort_order
  const sortedImages = [...images].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-3">
      {/* Main Image Carousel */}
      <div className="relative rounded-xl overflow-hidden">
        <div ref={emblaRef} className="overflow-hidden">
          <div className="flex">
            {sortedImages.map((image, index) => (
              <div
                key={image.id}
                className="flex-[0_0_100%] min-w-0 relative aspect-video cursor-pointer"
                onClick={() => handleImageClick(index)}
              >
                <img
                  src={image.image_url}
                  alt={`${jobTitle || 'Job'}${companyName ? ` at ${companyName}` : ''} - Remote Job India`}
                  className="w-full h-full object-cover"
                  loading={index === 0 ? 'eager' : 'lazy'}
                  decoding="async"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Thumbnail Strip */}
      {sortedImages.length > 1 && (
        <div ref={thumbnailRef} className="overflow-hidden">
          <div className="flex gap-2">
            {sortedImages.map((image, index) => (
              <button
                key={image.id}
                onClick={() => scrollToIndex(index)}
                className={`flex-[0_0_80px] min-w-0 aspect-video rounded-md overflow-hidden border-2 transition-all ${
                  selectedIndex === index 
                    ? 'border-primary ring-2 ring-primary/30' 
                    : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <img
                  src={image.image_url}
                  alt={`Thumbnail ${index + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Fullscreen Dialog */}
      <Dialog open={showFullscreen} onOpenChange={setShowFullscreen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none" hideClose>
          <div className="relative w-full h-full flex items-center justify-center">
            
            <img
              src={sortedImages[selectedIndex]?.image_url}
              alt={`${jobTitle || 'Job'}${companyName ? ` at ${companyName}` : ''} - Remote Job India`}
              className="max-w-full max-h-[90vh] object-contain"
              decoding="async"
            />
            
            {sortedImages.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 text-white rounded-full"
                  onClick={() => {
                    const newIndex = selectedIndex === 0 ? sortedImages.length - 1 : selectedIndex - 1;
                    setSelectedIndex(newIndex);
                    emblaApi?.scrollTo(newIndex);
                  }}
                >
                  <ChevronLeft className="h-8 w-8" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 text-white rounded-full"
                  onClick={() => {
                    const newIndex = selectedIndex === sortedImages.length - 1 ? 0 : selectedIndex + 1;
                    setSelectedIndex(newIndex);
                    emblaApi?.scrollTo(newIndex);
                  }}
                >
                  <ChevronRight className="h-8 w-8" />
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
