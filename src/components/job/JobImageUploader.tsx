import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
  Upload, 
  X, 
  ImagePlus, 
  Sparkles, 
  Crop as CropIcon,
  Info,
  GripVertical,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { uploadToR2 } from "@/lib/r2Media";
import { ImageCropDialogEnhanced } from "./ImageCropDialogEnhanced";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cleanupJobImage } from "@/utils/storageCleanup";

export interface JobImage {
  id?: string;
  url: string;
  type: 'uploaded' | 'ai_generated';
  sizeCategory: 'banner' | 'square' | 'social';
  width?: number;
  height?: number;
  sortOrder: number;
  file?: File;
}

interface JobImageUploaderProps {
  jobId?: string;
  images: JobImage[];
  onImagesChange: (images: JobImage[]) => void;
  maxImages?: number;
  disabled?: boolean;
  jobContext?: {
    title?: string;
    category?: string;
    jobType?: string;
    companyName?: string;
  };
}

const SIZE_PRESETS = {
  banner: { width: 1920, height: 1080, label: 'Banner', aspect: 16/9, description: 'Best for job listing headers' },
  square: { width: 1080, height: 1080, label: 'Square', aspect: 1, description: 'Perfect for social media posts' },
  social: { width: 1200, height: 630, label: 'Social Media', aspect: 1.91, description: 'Optimized for Facebook/LinkedIn' }
};

export const JobImageUploader = ({
  jobId,
  images,
  onImagesChange,
  maxImages = 10,
  disabled = false,
  jobContext
}: JobImageUploaderProps) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedSizeCategory, setSelectedSizeCategory] = useState<'banner' | 'square' | 'social'>('banner');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error("Invalid file type. Please use JPG, PNG, or WebP.");
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large. Maximum size is 10MB.");
      return;
    }

    setSelectedFile(file);
    setShowCropDialog(true);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCropComplete = async (croppedFile: File, sizeCategory: 'banner' | 'square' | 'social') => {
    if (!user) {
      toast.error("Please login to upload images");
      return;
    }

    if (images.length >= maxImages) {
      toast.error(`Maximum ${maxImages} images allowed`);
      return;
    }

    setUploading(true);
    try {
      // Original HD crop (PNG) goes to Cloudflare as-is — no WebP/shrinking.
      const { url: publicUrl } = await uploadToR2(croppedFile, 'jobs');

      const newImage: JobImage = {
        url: publicUrl,
        type: 'uploaded',
        sizeCategory,
        width: SIZE_PRESETS[sizeCategory].width,
        height: SIZE_PRESETS[sizeCategory].height,
        sortOrder: images.length
      };

      onImagesChange([...images, newImage]);
      toast.success("Image uploaded successfully!");
      setShowCropDialog(false);
      setSelectedFile(null);
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error("Failed to upload image: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = async (index: number) => {
    const imageToRemove = images[index];
    
    // Delete from storage if it's an uploaded image (not AI generated URL from external source)
    if (imageToRemove?.url) {
      await cleanupJobImage(imageToRemove.url);
    }
    
    const newImages = images.filter((_, i) => i !== index);
    // Update sort orders
    newImages.forEach((img, i) => img.sortOrder = i);
    onImagesChange(newImages);
    toast.success("Image removed");
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newImages = [...images];
    const [removed] = newImages.splice(draggedIndex, 1);
    newImages.splice(index, 0, removed);
    newImages.forEach((img, i) => img.sortOrder = i);
    
    onImagesChange(newImages);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div className="space-y-4">
      {/* Uploaded images - horizontal scroll */}
      {images.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
          {images.map((image, index) => (
            <Card
              key={image.id || index}
              className={`relative group flex-shrink-0 w-36 overflow-hidden cursor-move ${
                draggedIndex === index ? 'opacity-50' : ''
              }`}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
            >
              <div className="aspect-video relative">
                <img
                  src={image.url}
                  alt={`Job image ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleRemoveImage(index)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <GripVertical className="h-3 w-3 text-white" />
                </div>
                {image.type === 'ai_generated' && (
                  <Badge 
                    variant="default"
                    className="absolute bottom-1 left-1 text-[9px] h-4 px-1"
                  >
                    <Sparkles className="h-2 w-2 mr-0.5" /> AI
                  </Badge>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Upload buttons - compact inline */}
      <div className="flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading || images.length >= maxImages}
          className="flex-1"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <ImagePlus className="h-4 w-4 mr-1.5" />
          )}
          <span className="text-xs">Upload</span>
        </Button>

      </div>

      {/* Crop Dialog */}
      <ImageCropDialogEnhanced
        open={showCropDialog}
        onOpenChange={setShowCropDialog}
        imageFile={selectedFile}
        onCropComplete={handleCropComplete}
        isUploading={uploading}
      />

    </div>
  );
};
