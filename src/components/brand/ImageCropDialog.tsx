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
import { RotateCw, ZoomIn, Crop as CropIcon } from "lucide-react";

/**
 * Some "transparent" downloads contain a white/grey checkerboard baked into
 * the pixels. When that pattern clearly fills the image edge, remove only the
 * connected light-neutral edge area. Enclosed white artwork remains intact.
 */
const removeBakedTransparencyGrid = (canvas: HTMLCanvasElement) => {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context || canvas.width < 2 || canvas.height < 2) return;
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = image;
  const width = canvas.width;
  const height = canvas.height;
  const isLightNeutral = (pixel: number) => {
    const offset = pixel * 4;
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    return data[offset + 3] > 0 && Math.min(red, green, blue) >= 165 && Math.max(red, green, blue) - Math.min(red, green, blue) <= 24;
  };

  // Fit mode can surround the original square with transparent padding. Find
  // the visible artwork bounds first, then inspect that boundary instead of
  // the outer canvas edge so an embedded checkerboard is still removable.
  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] === 0) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) return;

  let neutralEdgePixels = 0;
  let edgePixels = 0;
  for (let x = left; x <= right; x += 1) {
    edgePixels += 2;
    if (isLightNeutral(top * width + x)) neutralEdgePixels += 1;
    if (isLightNeutral(bottom * width + x)) neutralEdgePixels += 1;
  }
  for (let y = top + 1; y < bottom; y += 1) {
    edgePixels += 2;
    if (isLightNeutral(y * width + left)) neutralEdgePixels += 1;
    if (isLightNeutral(y * width + right)) neutralEdgePixels += 1;
  }
  if (neutralEdgePixels / edgePixels < 0.72) return;

  const visited = new Uint8Array(width * height);
  const queue: number[] = [];
  const enqueue = (pixel: number) => {
    if (pixel < 0 || pixel >= width * height || visited[pixel] || !isLightNeutral(pixel)) return;
    visited[pixel] = 1;
    queue.push(pixel);
  };
  for (let x = left; x <= right; x += 1) {
    enqueue(top * width + x);
    enqueue(bottom * width + x);
  }
  for (let y = top; y <= bottom; y += 1) {
    enqueue(y * width + left);
    enqueue(y * width + right);
  }
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const pixel = queue[cursor];
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    data[pixel * 4 + 3] = 0;
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) enqueue(ny * width + nx);
      }
    }
  }
  context.putImageData(image, 0, 0);
};

interface ImageCropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageFile: File | null;
  onCropComplete: (croppedFile: File) => boolean | void | Promise<boolean | void>;
  aspectRatio?: number; // undefined for free crop, 1 for square, 1.91 for OG image
  title?: string;
  outputSize?: { width: number; height: number }; // exact output dimensions
  allowOriginal?: boolean;
  hideHeader?: boolean;
  preservePixels?: boolean;
  circularCrop?: boolean;
}

export const ImageCropDialog = ({
  open,
  onOpenChange,
  imageFile,
  onCropComplete,
  aspectRatio,
  title = "Crop Image",
  outputSize,
  allowOriginal = false,
  hideHeader = false,
  preservePixels = false,
  circularCrop = false,
}: ImageCropDialogProps) => {
  const [imageSrc, setImageSrc] = useState<string>("");
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Load image when file changes.
  // Use an object URL instead of a base64 data URL: a 5MB photo becomes a ~7MB
  // string in memory, which on low-end phones can make the browser discard and
  // reload the page right after picking an image.
  useEffect(() => {
    if (!imageFile || !open) return;
    const url = URL.createObjectURL(imageFile);
    setImageSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile, open]);

  // Shared upload step — always PNG so a transparent logo stays transparent.
  const uploadCanvas = useCallback(
    (canvas: HTMLCanvasElement) => {
      if (circularCrop) {
        const context = canvas.getContext('2d');
        if (!context) return;
        context.save();
        context.globalCompositeOperation = 'destination-in';
        context.beginPath();
        context.arc(canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) / 2, 0, Math.PI * 2);
        context.fill();
        context.restore();
      }
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const originalName = imageFile?.name.replace(/\.[^.]+$/, "") || "cropped";
        const outFile = new File([blob], `${originalName}.png`, { type: "image/png" });
        setIsUploading(true);
        try {
          const uploaded = await onCropComplete(outFile);
          if (uploaded !== false) {
            onOpenChange(false);
            resetState();
          }
        } finally {
          setIsUploading(false);
        }
      }, "image/png", 1.0);
    },
    [imageFile, onCropComplete, onOpenChange, circularCrop],
  );

  // Keep the whole picture and pad it to the exact target size with transparent
  // space — nothing gets cut off and no white box is baked in.
  const handleFitUpload = useCallback(() => {
    const image = imgRef.current;
    if (!image) return;
    const target = outputSize ?? {
      width: image.naturalWidth,
      height: image.naturalHeight,
    };
    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, target.width, target.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    const scale = Math.min(
      target.width / image.naturalWidth,
      target.height / image.naturalHeight,
    );
    const w = image.naturalWidth * scale;
    const h = image.naturalHeight * scale;
    ctx.drawImage(image, (target.width - w) / 2, (target.height - h) / 2, w, h);
    if (!preservePixels) removeBakedTransparencyGrid(canvas);
    uploadCanvas(canvas);
  }, [outputSize, uploadCanvas, preservePixels]);

  const handleCropComplete = useCallback(() => {
    if (!completedCrop || !imgRef.current) return;

    const canvas = document.createElement("canvas");
    const image = imgRef.current;
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    // Use scaled dimensions to preserve original image quality
    const scaledWidth = completedCrop.width * scaleX;
    const scaledHeight = completedCrop.height * scaleY;

    canvas.width = scaledWidth;
    canvas.height = scaledHeight;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    // Enable high-quality image rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    // Start fully transparent so PNG logos keep their see-through background.
    ctx.clearRect(0, 0, scaledWidth, scaledHeight);

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      scaledWidth,
      scaledHeight,
      0,
      0,
      scaledWidth,
      scaledHeight
    );

    // If outputSize is specified, resize to exact dimensions
    let finalCanvas = canvas;
    if (outputSize) {
      finalCanvas = document.createElement("canvas");
      finalCanvas.width = outputSize.width;
      finalCanvas.height = outputSize.height;
      const finalCtx = finalCanvas.getContext("2d");
      if (!finalCtx) return;
      finalCtx.imageSmoothingEnabled = true;
      finalCtx.imageSmoothingQuality = "high";
      finalCtx.clearRect(0, 0, outputSize.width, outputSize.height);
      finalCtx.drawImage(canvas, 0, 0, outputSize.width, outputSize.height);
    }

    if (!preservePixels) removeBakedTransparencyGrid(finalCanvas);
    uploadCanvas(finalCanvas);
  }, [completedCrop, outputSize, uploadCanvas, preservePixels]);

  const resetState = () => {
    setImageSrc("");
    setCrop(undefined);
    setCompletedCrop(undefined);
    setZoom(100);
    setRotation(0);
    setIsUploading(false);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const cropWidthInPercent = Math.min(80, (400 / width) * 100);

    const newCrop = makeAspectCrop(
      {
        unit: '%',
        width: cropWidthInPercent,
      },
      aspectRatio || width / height,
      width,
      height
    );
    const centeredCrop = centerCrop(newCrop, width, height);
    setCrop(centeredCrop);
    setCompletedCrop({ unit: 'px', x: centeredCrop.x * width / 100, y: centeredCrop.y * height / 100, width: centeredCrop.width * width / 100, height: centeredCrop.height * height / 100 });
  }, [aspectRatio]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (isUploading) return;
    onOpenChange(nextOpen);
    if (!nextOpen) resetState();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent hideClose={hideHeader} className="w-screen max-w-none h-[100dvh] max-h-[100dvh] rounded-none border-0 overflow-y-auto p-4 sm:p-6 flex flex-col">
        {!hideHeader && (
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CropIcon className="w-5 h-5" />
              {title}
            </DialogTitle>
            <DialogDescription>
              {circularCrop ? "Crop to circle" : aspectRatio === 1
                ? "Crop to square (1:1 aspect ratio)"
                : aspectRatio === 1.91
                ? "Crop for social media (1.91:1 aspect ratio - 1200x630px)"
                : "Drag to select the area you want to keep"}
              {outputSize
                ? ` — saved as ${outputSize.width}×${outputSize.height}px PNG. Use “Fit full image” to keep the whole picture (transparent background stays transparent).`
                : ""}
            </DialogDescription>
          </DialogHeader>
        )}

        <div className="space-y-4">
          {/* Crop Area */}
          {imageSrc && (
            <div className="flex justify-center bg-muted/20 rounded-lg p-4 min-h-[300px]">
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={aspectRatio}
                circularCrop={circularCrop}
              >
                <img
                  ref={imgRef}
                  src={imageSrc}
                  alt="Crop preview"
                  style={{
                    transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                    maxHeight: "500px",
                    maxWidth: "100%",
                  }}
                  className="transition-transform"
                  onLoad={onImageLoad}
                />
              </ReactCrop>
            </div>
          )}

          {/* Controls */}
          <div className="space-y-4">
            {/* Zoom Control */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
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
            <Button
              type="button"
              variant="outline"
              onClick={handleRotate}
              disabled={isUploading}
              className="w-full"
            >
              <RotateCw className="w-4 h-4 mr-2" />
              Rotate 90°
            </Button>
          </div>
        </div>

        <DialogFooter className="mt-auto sm:justify-stretch">
          <div className="grid w-full grid-cols-3 gap-2">
            <Button
              type="button"
              onClick={handleCropComplete}
              disabled={!completedCrop || isUploading}
              className="w-full min-w-0 px-2 text-xs sm:text-sm"
            >
              <span className="truncate">{isUploading ? "Uploading…" : "Crop & Upload"}</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleFitUpload}
              disabled={!imageSrc || isUploading}
              className="w-full min-w-0 px-2 text-xs sm:text-sm"
            >
              <span className="truncate">{isUploading ? "Uploading…" : "Fit full image"}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isUploading}
              className="w-full min-w-0 px-2 text-xs sm:text-sm"
            >
              <span className="truncate">Cancel</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
