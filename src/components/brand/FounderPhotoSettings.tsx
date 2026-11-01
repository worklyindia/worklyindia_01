import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ImageCropDialog } from './ImageCropDialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { uploadBrandAsset } from '@/lib/brandAssetStorage';
import { cleanupBrandAsset } from '@/utils/storageCleanup';
import { DEFAULT_FOUNDER_PHOTO, FOUNDER_NAME, FOUNDER_PHOTO_KEY } from '@/lib/founderProfile.mjs';
import { toast } from 'sonner';

export default function FounderPhotoSettings() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const { data: photo } = useQuery({
    queryKey: ['app-setting', FOUNDER_PHOTO_KEY],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('setting_value').eq('setting_key', FOUNDER_PHOTO_KEY).maybeSingle();
      if (error) throw error;
      return data?.setting_value || DEFAULT_FOUNDER_PHOTO;
    },
  });

  const save = async (cropped: File): Promise<boolean> => {
    setSaving(true);
    let uploaded: string | undefined;
    let committed = false;
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('Please sign in again to update your photo.');
      // Preserve native crop dimensions and original pixels; no compression/upscaling.
      uploaded = await uploadBrandAsset(cropped, FOUNDER_PHOTO_KEY);
      const { error } = await supabase.from('app_settings').upsert({
        setting_key: FOUNDER_PHOTO_KEY,
        setting_value: uploaded,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'setting_key' });
      if (error) throw error;
      committed = true;
      queryClient.setQueryData(['app-setting', FOUNDER_PHOTO_KEY], uploaded);
      if (photo && photo !== DEFAULT_FOUNDER_PHOTO && photo !== uploaded) {
        await cleanupBrandAsset(photo).catch(() => undefined);
      }
      toast.success('Founder photo updated & saved');
      return true;
    } catch (error) {
      if (uploaded && !committed) await cleanupBrandAsset(uploaded).catch(() => undefined);
      toast.error(error instanceof Error ? error.message : 'Could not save founder photo. Please try again.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="border-y border-border py-6" aria-labelledby="founder-photo-label">
      <h2 id="founder-photo-label" className="text-xl font-semibold text-foreground">Founder & CEO Photo</h2>
      <p className="mt-1 text-sm text-muted-foreground">{FOUNDER_NAME}</p>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
        <img src={photo || DEFAULT_FOUNDER_PHOTO} alt={`${FOUNDER_NAME}, Founder & CEO`} width={160} height={200} className="w-40 aspect-[4/5] shrink-0 rounded-lg object-cover" />
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor="founder-photo">Update founder photo</Label>
          <Input id="founder-photo" type="file" accept="image/jpeg,image/png,image/webp" disabled={saving} onChange={(event) => {
            const selected = event.target.files?.[0];
            if (selected) setFile(selected);
            event.target.value = '';
          }} />
          <p className="text-xs text-muted-foreground">PNG, JPG or WebP · Up to 10 MB · Original crop resolution</p>
        </div>
      </div>
      <ImageCropDialog open={file !== null} imageFile={file} onOpenChange={(open) => { if (!open && !saving) setFile(null); }} onCropComplete={save} aspectRatio={4 / 5} preservePixels title="Crop Founder Photo" />
    </section>
  );
}