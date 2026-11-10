import { useEffect, useRef, useState } from "react";

interface TransparentLogoImageProps {
  src: string;
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
  onError?: () => void;
}

/**
 * Removes only near-black pixels connected to an image edge. This fixes logos
 * that were uploaded as JPEGs after their transparent background was flattened,
 * without erasing dark details enclosed inside the logo itself.
 */
const removeEdgeBackground = (image: HTMLImageElement): string => {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return image.src;

  context.drawImage(image, 0, 0);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  const width = canvas.width;
  const height = canvas.height;
  const visited = new Uint8Array(width * height);
  const queue: number[] = [];

  const isBackground = (pixel: number) => {
    const offset = pixel * 4;
    return Math.max(data[offset], data[offset + 1], data[offset + 2]) <= 52;
  };

  const enqueue = (pixel: number) => {
    if (visited[pixel] || !isBackground(pixel)) return;
    visited[pixel] = 1;
    queue.push(pixel);
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const pixel = queue[cursor];
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    const offset = pixel * 4;
    const brightness = Math.max(data[offset], data[offset + 1], data[offset + 2]);
    data[offset + 3] = brightness <= 20 ? 0 : Math.round(((brightness - 20) / 32) * 255);

    if (x > 0) enqueue(pixel - 1);
    if (x + 1 < width) enqueue(pixel + 1);
    if (y > 0) enqueue(pixel - width);
    if (y + 1 < height) enqueue(pixel + width);
  }

  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
};

export const TransparentLogoImage = ({
  src,
  alt,
  className,
  loading = "lazy",
  onError,
}: TransparentLogoImageProps) => {
  const [processedSrc, setProcessedSrc] = useState(src);
  const requestRef = useRef(0);

  useEffect(() => {
    const request = requestRef.current + 1;
    requestRef.current = request;
    setProcessedSrc(src);

    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const transparentSrc = removeEdgeBackground(image);
        if (requestRef.current === request) setProcessedSrc(transparentSrc);
      } catch {
        // Keep the original visible if its host does not permit canvas access.
      }
    };
    image.onerror = onError;
    image.src = src;

    return () => {
      requestRef.current += 1;
    };
  }, [src, onError]);

  return (
    <img
      src={processedSrc}
      alt={alt}
      className={`${className ?? ""} pointer-events-none select-none`}
      loading={loading}
      decoding="async"
      draggable={false}
      onContextMenu={(event) => event.preventDefault()}
      onError={onError}
    />
  );
};