import { useEffect, useState } from 'react';

const readValue = <T,>(key: string, fallback: T): T => {
  try {
    const raw = sessionStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
};

/** useState that keeps its value across a page refresh (stored in sessionStorage). */
export function useRefreshSafeState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => readValue(key, initial));
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage full or unavailable — the value just won't survive a refresh */
    }
  }, [key, value]);
  return [value, setValue] as const;
}

interface StoredCrop {
  id: string;
  name: string;
  type: string;
  dataUrl: string;
}

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsDataURL(file);
  });

/** Shrinks very large photos so they fit into sessionStorage (max side 1600px). */
const compactDataUrl = (file: File): Promise<string | null> =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.naturalWidth * scale);
      canvas.height = Math.round(image.naturalHeight * scale);
      const ctx = canvas.getContext('2d');
      URL.revokeObjectURL(url);
      if (!ctx) return resolve(null);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    image.src = url;
  });

/**
 * Keeps the crop screen alive across a page refresh: the picked image is
 * stored as a data URL and rebuilt into a File on the next load.
 */
export function useCropPersistence(storageKey: string) {
  const [cropId, setCropId] = useRefreshSafeState<string | null>(storageKey, null);
  const [cropFile, setCropFile] = useState<File | null>(null);

  // Rebuild the picked image after a refresh.
  useEffect(() => {
    let cancelled = false;
    if (!cropId) {
      setCropFile(null);
      return;
    }
    try {
      const raw = sessionStorage.getItem(`${storageKey}:file`);
      const stored = raw ? (JSON.parse(raw) as StoredCrop) : null;
      if (!stored?.dataUrl) return;
      fetch(stored.dataUrl)
        .then((res) => res.blob())
        .then((blob) => {
          if (cancelled) return;
          setCropFile(new File([blob], stored.name, { type: stored.type || blob.type }));
        })
        .catch(() => setCropId(null));
    } catch {
      setCropId(null);
    }
    return () => {
      cancelled = true;
    };
  }, [cropId, storageKey, setCropId]);

  const openCrop = async (id: string, file: File) => {
    setCropFile(file);
    setCropId(id);
    try {
      const store = (dataUrl: string, name: string, type: string) =>
        sessionStorage.setItem(`${storageKey}:file`, JSON.stringify({ id, name, type, dataUrl }));
      let stored = false;
      try {
        store(await fileToDataUrl(file), file.name, file.type);
        stored = true;
      } catch {
        /* too large for storage — try a smaller copy below */
      }
      if (!stored) {
        const compact = await compactDataUrl(file);
        if (compact) store(compact, `${file.name.replace(/\.[^.]+$/, '')}.png`, 'image/png');
      }
    } catch {
      /* storage unavailable — a refresh will simply return to the template */
    }
  };

  const closeCrop = () => {
    setCropId(null);
    setCropFile(null);
    try {
      sessionStorage.removeItem(`${storageKey}:file`);
    } catch {
      /* ignore */
    }
  };

  return { cropId, cropFile, openCrop, closeCrop };
}
