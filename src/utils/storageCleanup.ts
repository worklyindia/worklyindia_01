import { supabase } from '@/integrations/supabase/client';
import { deleteR2Media, extractR2MediaKey } from '@/lib/r2Media';

/**
 * Storage buckets used in the application
 */
export const STORAGE_BUCKETS = {
  PROFILE_PHOTOS: 'profile-photos',
  JOB_IMAGES: 'job-images',
  WHATSAPP_MEDIA: 'whatsapp-media',
  PUBLIC_ASSETS: 'public-assets',
  BRAND_ASSETS: 'brand-assets',
  TEMP_DOWNLOADS: 'temp-downloads',
} as const;

/**
 * Extract file path from a Supabase storage public URL
 * @param publicUrl - Full public URL from Supabase storage
 * @param bucket - The bucket name
 * @returns The file path within the bucket, or null if invalid
 */
export const extractStoragePath = (publicUrl: string | null | undefined, bucket: string): string | null => {
  if (!publicUrl) return null;
  
  try {
    const urlWithoutQuery = publicUrl.split('?')[0];
    // Match pattern: /storage/v1/object/public/{bucket}/{path}
    const regex = new RegExp(`/storage/v1/object/public/${bucket}/(.+)$`);
    const match = urlWithoutQuery.match(regex);
    
    if (match && match[1]) {
      // Decode URI components in case of special characters
      return decodeURIComponent(match[1]);
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting storage path:', error);
    return null;
  }
};

/**
 * Delete a file from Supabase storage
 * @param bucket - The storage bucket name
 * @param filePath - Path to the file within the bucket
 * @returns True if deletion was successful or file didn't exist, false on error
 */
export const deleteFromStorage = async (
  bucket: string,
  filePath: string
): Promise<boolean> => {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath]);
    
    if (error) {
      // Ignore "not found" errors - file might already be deleted
      if (error.message?.includes('not found') || error.message?.includes('Not Found')) {
        console.log(`File already deleted or not found: ${bucket}/${filePath}`);
        return true;
      }
      console.error(`Error deleting from ${bucket}:`, error);
      return false;
    }
    
    console.log(`Successfully deleted: ${bucket}/${filePath}`);
    return true;
  } catch (error) {
    console.error(`Error deleting from ${bucket}:`, error);
    return false;
  }
};

/**
 * Delete a file from storage using its public URL
 * @param publicUrl - Full public URL from Supabase storage
 * @param bucket - The bucket name
 * @returns True if deletion was successful, false otherwise
 */
export const deleteByPublicUrl = async (
  publicUrl: string | null | undefined,
  bucket: string
): Promise<boolean> => {
  if (extractR2MediaKey(publicUrl)) {
    await deleteR2Media([publicUrl]);
    return true;
  }
  const filePath = extractStoragePath(publicUrl, bucket);
  
  if (!filePath) {
    console.log('No valid file path found in URL:', publicUrl);
    return true; // No file to delete
  }
  
  return deleteFromStorage(bucket, filePath);
};

/**
 * Delete multiple files from storage by their public URLs
 * @param publicUrls - Array of public URLs
 * @param bucket - The bucket name
 * @returns Number of successfully deleted files
 */
export const deleteMultipleByUrls = async (
  publicUrls: (string | null | undefined)[],
  bucket: string
): Promise<number> => {
  const r2Urls = publicUrls.filter((u) => extractR2MediaKey(u));
  if (r2Urls.length) await deleteR2Media(r2Urls);
  const paths = publicUrls
    .map(url => extractStoragePath(url, bucket))
    .filter((path): path is string => path !== null);
  
  if (paths.length === 0) return r2Urls.length;
  
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .remove(paths);
    
    if (error) {
      console.error(`Error batch deleting from ${bucket}:`, error);
      return 0;
    }
    
    console.log(`Successfully deleted ${data?.length || 0} files from ${bucket}`);
    return data?.length || 0;
  } catch (error) {
    console.error(`Error batch deleting from ${bucket}:`, error);
    return 0;
  }
};

/**
 * Delete all files in a folder/prefix from storage
 * @param bucket - The bucket name
 * @param folderPath - Folder path within the bucket (e.g., "user-id/")
 * @returns Number of successfully deleted files
 */
export const deleteFolder = async (
  bucket: string,
  folderPath: string
): Promise<number> => {
  try {
    // List all files in the folder
    const { data: files, error: listError } = await supabase.storage
      .from(bucket)
      .list(folderPath);
    
    if (listError) {
      console.error(`Error listing files in ${bucket}/${folderPath}:`, listError);
      return 0;
    }
    
    if (!files || files.length === 0) {
      console.log(`No files found in ${bucket}/${folderPath}`);
      return 0;
    }
    
    // Create full paths for deletion
    const filePaths = files.map(file => `${folderPath}${file.name}`);
    
    const { data, error } = await supabase.storage
      .from(bucket)
      .remove(filePaths);
    
    if (error) {
      console.error(`Error deleting folder ${bucket}/${folderPath}:`, error);
      return 0;
    }
    
    console.log(`Successfully deleted ${data?.length || 0} files from ${bucket}/${folderPath}`);
    return data?.length || 0;
  } catch (error) {
    console.error(`Error deleting folder ${bucket}/${folderPath}:`, error);
    return 0;
  }
};

/**
 * Clean up profile photo storage when changing/deleting photos
 */
export const cleanupProfilePhoto = async (oldPhotoUrl: string | null | undefined): Promise<boolean> => {
  return deleteByPublicUrl(oldPhotoUrl, STORAGE_BUCKETS.PROFILE_PHOTOS);
};

/**
 * Clean up job image storage
 */
export const cleanupJobImage = async (imageUrl: string | null | undefined): Promise<boolean> => {
  return deleteByPublicUrl(imageUrl, STORAGE_BUCKETS.JOB_IMAGES);
};

/**
 * Clean up multiple job images
 */
export const cleanupJobImages = async (imageUrls: (string | null | undefined)[]): Promise<number> => {
  return deleteMultipleByUrls(imageUrls, STORAGE_BUCKETS.JOB_IMAGES);
};

/**
 * Clean up banner image storage
 */
export const cleanupBannerImage = async (imageUrl: string | null | undefined): Promise<boolean> => {
  return deleteByPublicUrl(imageUrl, STORAGE_BUCKETS.PUBLIC_ASSETS);
};

/**
 * Clean up WhatsApp media storage
 */
export const cleanupWhatsAppMedia = async (mediaUrl: string | null | undefined): Promise<boolean> => {
  return deleteByPublicUrl(mediaUrl, STORAGE_BUCKETS.WHATSAPP_MEDIA);
};

/**
 * Clean up brand asset storage (brand-assets bucket)
 */
export const cleanupBrandAsset = async (imageUrl: string | null | undefined): Promise<boolean> => {
  return deleteByPublicUrl(imageUrl, STORAGE_BUCKETS.BRAND_ASSETS);
};

/**
 * Clean up all user-related storage on account deletion
 * @param userId - The user's ID
 */
export const cleanupUserStorage = async (userId: string): Promise<void> => {
  console.log(`Cleaning up storage for user: ${userId}`);
  
  // Delete profile photos folder
  await deleteFolder(STORAGE_BUCKETS.PROFILE_PHOTOS, `${userId}/`);
  
  // Delete job images folder
  await deleteFolder(STORAGE_BUCKETS.JOB_IMAGES, `${userId}/`);
  
  console.log(`Storage cleanup complete for user: ${userId}`);
};

// ---------------------------------------------------------------------------
// Generic helpers (bucket auto-detected from the URL)
// ---------------------------------------------------------------------------

/**
 * Parse any Supabase Storage public URL into { bucket, path }.
 * Returns null for CDN/external URLs (nothing for us to delete there).
 */
export const parseStorageUrl = (
  url: string | null | undefined,
): { bucket: string; path: string } | null => {
  if (!url) return null;
  try {
    const clean = url.split('?')[0];
    const match = clean.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/);
    if (!match) return null;
    return { bucket: match[1], path: decodeURIComponent(match[2]) };
  } catch {
    return null;
  }
};

/** Delete a stored file from its public URL, whichever bucket it lives in. */
export const deleteStorageUrl = async (url: string | null | undefined): Promise<boolean> => {
  if (extractR2MediaKey(url)) {
    await deleteR2Media([url]);
    return true;
  }
  const parsed = parseStorageUrl(url);
  if (!parsed) return true; // external/CDN url — nothing stored on our side
  return deleteFromStorage(parsed.bucket, parsed.path);
};

/**
 * Delete every file inside a folder that is older than `maxAgeHours`.
 * Used to keep temporary AI-chat uploads from piling up.
 */
export const deleteOlderThan = async (
  bucket: string,
  folderPath: string,
  maxAgeHours = 24,
): Promise<number> => {
  try {
    const { data: files, error } = await supabase.storage.from(bucket).list(folderPath, { limit: 1000 });
    if (error || !files?.length) return 0;

    const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000;
    const stale = files
      .filter((f) => {
        const stamp = (f as { updated_at?: string; created_at?: string }).updated_at
          || (f as { created_at?: string }).created_at;
        return stamp ? new Date(stamp).getTime() < cutoff : false;
      })
      .map((f) => `${folderPath.replace(/\/+$/, '')}/${f.name}`);

    if (stale.length === 0) return 0;
    const { data, error: delError } = await supabase.storage.from(bucket).remove(stale);
    if (delError) return 0;
    return data?.length || 0;
  } catch {
    return 0;
  }
};

/**
 * AI chat temp files (PDFs / images sent to the assistant) must not survive
 * the day. Removes anything in the signed-in user's AI-chat folders that is
 * older than 24 hours. Safe to call on every AI chat page load.
 */
export const cleanupAiChatTempFiles = async (maxAgeHours = 24): Promise<number> => {
  try {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) return 0;

    const targets: Array<[string, string]> = [
      [STORAGE_BUCKETS.TEMP_DOWNLOADS, `ai-chat/${userId}/`],
      [STORAGE_BUCKETS.PROFILE_PHOTOS, `${userId}/pdf-extracts/`],
    ];

    let removed = 0;
    for (const [bucket, folder] of targets) {
      removed += await deleteOlderThan(bucket, folder, maxAgeHours);
    }
    return removed;
  } catch {
    return 0;
  }
};
