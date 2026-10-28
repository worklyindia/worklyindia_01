import { useState, useRef, useCallback, useEffect } from "react";
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { RotateCw, ZoomIn, Crop as CropIcon, Loader2, Image as ImageIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

interface ImageCropDialogEnhancedProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageFile: File | null;
  onCropComplete: (croppedFile: File, sizeCategory: 'banner' | 'square' | 'social') => void;
  isUploading?: boolean;
}

const SIZE_PRESETS = {
  banner: { 
    width: 1920, 
    height: 1080, 
    label: 'Banner', 
    aspect: 16/9, 
    description: 'Job listing headers (1920×1080)',
    icon: '🖼️'
  },
  square: { 
    width: 1080, 
    height: 1080, 
    label: 'Square', 
    aspect: 1, 
    description: 'Social media posts (1080×1080)',
    icon: '⬜'
  },
  social: { 
    width: 1200, 
    height: 630, 
    label: 'Social Media', 
    aspect: 1.91, 
    description: 'Facebook/LinkedIn (1200×630)',
    icon: '📱'
  }
};

export const ImageCropDialogEnhanced = ({
  open,
  onOpenChange,
  imageFile,
  onCropComplete,
  isUploading = false
}: ImageCropDialogEnhancedProps) => {
  const [imageSrc, setImageSrc] = useState<string>("");
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const sizeCategory = 'banner' as const; // Always use banner size
  const imgRef = useRef<HTMLImageElement>(null);

  // Load image when file changes. Object URLs keep memory low on phones —
  // base64 data URLs of large photos can make the browser reload the page.
  useEffect(() => {
    if (!imageFile || !open) return;
    const url = URL.createObjectURL(imageFile);
    setImageSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile, open]);

  // Update crop when size category changes
  useEffect(() => {
    if (imgRef.current && imageSrc) {
      const { width, height } = imgRef.current;
      const preset = SIZE_PRESETS[sizeCategory];
      const cropWidthInPercent = Math.min(80, (400 / width) * 100);

      const newCrop = makeAspectCrop(
        {
          unit: '%',
          width: cropWidthInPercent,
        },
        preset.aspect,
        width,
        height
      );
      const centeredCrop = centerCrop(newCrop, width, height);
      setCrop(centeredCrop);
    }
  }, [sizeCategory, imageSrc]);

  const handleCropComplete = useCallback(() => {
    if (!completedCrop || !imgRef.current) return;

    const canvas = document.createElement("canvas");
    const image = imgRef.current;
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    // Use target dimensions from preset
    const preset = SIZE_PRESETS[sizeCategory];
    canvas.width = preset.width;
    canvas.height = preset.height;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    // Enable high-quality image rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Calculate source dimensions
    const srcX = completedCrop.x * scaleX;
    const srcY = completedCrop.y * scaleY;
    const srcWidth = completedCrop.width * scaleX;
    const srcHeight = completedCrop.height * scaleY;

    ctx.drawImage(
      image,
      srcX,
      srcY,
      srcWidth,
      srcHeight,
      0,
      0,
      preset.width,
      preset.height
    );

    canvas.toBlob((blob) => {
      if (!blob) return;
      const croppedFile = new File([blob], imageFile?.name || `cropped-${sizeCategory}.png`, {
        type: "image/png",
      });
      onCropComplete(croppedFile, sizeCategory);
      resetState();
    }, "image/png", 1.0);
  }, [completedCrop, imageFile, onCropComplete, sizeCategory]);

  const resetState = () => {
    setImageSrc("");
    setCrop(undefined);
    setCompletedCrop(undefined);
    setZoom(100);
    setRotation(0);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const preset = SIZE_PRESETS[sizeCategory];
    const cropWidthInPercent = Math.min(80, (400 / width) * 100);

    const newCrop = makeAspectCrop(
      {
        unit: '%',
        width: cropWidthInPercent,
      },
      preset.aspect,
      width,
      height
    );
    const centeredCrop = centerCrop(newCrop, width, height);
    setCrop(centeredCrop);
  }, [sizeCategory]);

  const handleClose = () => {
    onOpenChange(false);
    resetState();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CropIcon className="w-5 h-5" />
            Crop Image
          </DialogTitle>
          <DialogDescription>
            Crop your image for job listing (Banner: 1920×1080)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Size Info */}
          <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-2">
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              Output: <span className="font-medium">1920×1080px</span> (Banner 16:9)
            </span>
          </div>

          {/* Crop Area */}
          {imageSrc && (
            <div className="flex justify-center bg-muted/20 rounded-lg p-4 min-h-[300px]">
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={SIZE_PRESETS[sizeCategory].aspect}
              >
                <img
                  ref={imgRef}
                  src={imageSrc}
                  alt="Crop preview"
                  style={{
                    transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                    maxHeight: "400px",
                    maxWidth: "100%",
                  }}
                  className="transition-transform"
                  onLoad={onImageLoad}
                />
              </ReactCrop>
            </div>
          )}

          {/* Controls */}
          <div className="grid grid-cols-2 gap-4">
            {/* Zoom Control */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                <ZoomIn className="w-4 h-4" />
                Zoom: {zoom}%
              </Label>
              <Slider
                value={[zoom]}
                onValueChange={(value) => setZoom(value[0])}
                min={50}
                max={200}
                step={10}
                className="w-full"
              />
            </div>

            {/* Rotate Button */}
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                onClick={handleRotate}
                className="w-full"
              >
                <RotateCw className="w-4 h-4 mr-2" />
                Rotate 90°
              </Button>
            </div>
          </div>

          {/* Output Preview Info */}
          <div className="bg-muted/50 rounded-lg p-3 flex items-center gap-3">
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
            <div className="text-sm">
              <span className="font-medium">Output: </span>
              <span className="text-muted-foreground">
                {SIZE_PRESETS[sizeCategory].width}×{SIZE_PRESETS[sizeCategory].height}px 
                ({SIZE_PRESETS[sizeCategory].description})
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button type="button" onClick={handleCropComplete} disabled={!completedCrop || isUploading}>
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <CropIcon className="w-4 h-4 mr-2" />
                Crop & Upload
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
