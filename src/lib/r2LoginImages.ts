import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { notifyAuthImageUpdate } from './authImageUpdates';

export async function mutateLoginImage(action: 'r2-save-login-image' | 'r2-remove-login-image' | 'r2-migrate-login-images', settingKey?: string, file?: File) {
  const dataUrl = file ? await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Unable to read image'));
    reader.readAsDataURL(file);
  }) : undefined;
  const { data, error } = await supabase.functions.invoke('egress-optimizer', { body: { action, settingKey, file: dataUrl } });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      throw new Error(body?.error || error.message);
    }
    throw error;
  }
  if (!data?.ok) throw new Error(data?.error || 'Image could not be saved');
  notifyAuthImageUpdate();
  return data as { ok: true; changed: number; warnings: string[] };
}