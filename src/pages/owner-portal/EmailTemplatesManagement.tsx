import { withJobAlertSample as withJobAlertOnly } from '@/config/jobAlertSample';
import { withPromoSample } from '@/config/resumePromoGallery';
const withJobAlertSample = (v: Record<string, string>, c: 'email' | 'telegram') => withPromoSample(withJobAlertOnly(v, c), c);
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { SOCIAL_PLATFORMS, SOCIAL_LABELS, DEFAULT_SOCIAL_ICONS, SOCIAL_ICON_QUERY_KEY } from '@/lib/emailSocialIcons';
import { replaceSavedMedia } from '@/lib/savedMediaReplacement';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ImageCropDialog } from '@/components/brand/ImageCropDialog';
import { TemplateChannelPreview } from '@/components/owner-portal/TemplateChannelPreview';
import { EmailBodyBuilder, type EmailBodyBuilderRef } from '@/components/owner-portal/EmailBodyBuilder';
import TemplateMailboxCards from '@/components/owner/TemplateMailboxCards';
import { uploadToR2 } from '@/lib/r2Media';
import { useSocialLinks } from '@/hooks/useSocialLinks';
import { uploadBrandAsset } from '@/lib/brandAssetStorage';
import { cleanupBrandAsset } from '@/utils/storageCleanup';
import { useRefreshSafeState, useCropPersistence } from '@/hooks/useTemplatePageState';
import { useDeferredStorageCleanup } from '@/hooks/useDeferredStorageCleanup';
import { useDirtyState, useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';
import { escapeTemplateAttribute, renderEmailTemplateHtml } from '@/lib/templateFormatting';
import { emailButtonHtml, toEmailDocumentHtml } from '@/lib/emailBuilder';
import { emailTestError } from '@/lib/emailTestError';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ArrowLeft, ChevronRight, Mail, Save, Send, Settings, Trash2, Upload } from 'lucide-react';
import {
  ALL_PUSH_TEMPLATES,
  groupsForChannel,
  applyVariables,
  sampleValuesFor,
  variablesFor,
  emailDefaultsFor,
  type PushTemplateDef,
} from '@/config/pushTemplateCatalog';

/**
 * The call-to-action button is part of the message itself: it is authored inside
 * the message editor as a normal button, so the old separate `button_text` /
 * `button_url` columns are no longer edited here. Legacy rows that still have
 * them are merged into the message once on load.
 */
interface Template {
  event_type: string;
  /** True only when a row for this event exists in the database. */
  saved: boolean;
  enabled: boolean;
  subject: string;
  body: string;
  image_url: string | null;
}

type SocialPlatform = typeof SOCIAL_PLATFORMS[number];
type EmailAssetField = `email_social_icon_${SocialPlatform}` | 'email_header_image' | 'email_header_mascot_url' | 'whatsapp_notification_icon';
const DEFAULT_EMAIL_HEADER_IMAGE = 'https://jubwzelupbntbetpajqb.supabase.co/storage/v1/object/public/brand-assets/site/1769cddb-7244-4b4b-a86f-e0ca3bc028db/email_header_image-1790185045198.png';

const WEBSITE_URL = 'https://worklyindia.devs.surf';

const EMAIL_ASSET_FIELDS: EmailAssetField[] = [
  ...SOCIAL_PLATFORMS.map((platform) => `email_social_icon_${platform}` as EmailAssetField),
  'email_header_image',
  'email_header_mascot_url',
  'whatsapp_notification_icon',
];

const absoluteUrl = (url: string): string => {
  const value = (url || '/').trim();
  if (/^https?:\/\//i.test(value)) return value;
  return `${WEBSITE_URL}${value.startsWith('/') ? value : `/${value}`}`;
};

const inlineButton = (text: string | null | undefined, url: string | null | undefined) => {
  if (!text?.trim()) return '';
  return emailButtonHtml({
    text: text.trim(),
    url: absoluteUrl(url || '/'),
    backgroundColor: '#2563eb',
    textColor: '#ffffff',
    fontSize: 16,
    paddingX: 22,
    paddingY: 12,
    radius: 8,
    alignment: 'center',
  });
};

const fromDef = (def: PushTemplateDef): Template => {
  const d = emailDefaultsFor(def);
  return {
    event_type: def.key,
    saved: false,
    enabled: true,
    subject: d.title,
    body: `${toEmailDocumentHtml(d.body)}${inlineButton(d.button_text, d.button_url)}`,
    image_url: null,
  };
};

const buildInitial = (): Record<string, Template> =>
  Object.fromEntries(ALL_PUSH_TEMPLATES.map((def) => [def.key, fromDef(def)]));

const removeSocialIconBackground = async (file: File): Promise<File> => {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return file;
  context.drawImage(bitmap, 0, 0);
  bitmap.close();

  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = image;
  const width = canvas.width;
  const height = canvas.height;
  const visited = new Uint8Array(width * height);
  const queue: number[] = [];
  const isLightNeutral = (pixel: number) => {
    const offset = pixel * 4;
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    return Math.min(red, green, blue) >= 180 && Math.max(red, green, blue) - Math.min(red, green, blue) <= 30;
  };
  const enqueue = (pixel: number) => {
    if (visited[pixel] || !isLightNeutral(pixel)) return;
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
    data[pixel * 4 + 3] = 0;
    if (x > 0) enqueue(pixel - 1);
    if (x + 1 < width) enqueue(pixel + 1);
    if (y > 0) enqueue(pixel - width);
    if (y + 1 < height) enqueue(pixel + width);
  }
  context.putImageData(image, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  return blob ? new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.png`, { type: 'image/png' }) : file;
};

export default function EmailTemplatesManagement() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { socialLinks } = useSocialLinks();
  const [templates, setTemplates] = useState<Record<string, Template>>(buildInitial);
  const [loading, setLoading] = useState(true);
  const [savingEvent, setSavingEvent] = useState<string | null>(null);
  const [testingEvent, setTestingEvent] = useState<string | null>(null);
  const { cropId: cropEvent, cropFile: selectedFile, openCrop, closeCrop } = useCropPersistence('wly-email-crop');
  const [brandingOpen, setBrandingOpen] = useRefreshSafeState('wly-email-branding', false);
  const [emailAssets, setEmailAssets] = useState<Partial<Record<EmailAssetField, string>>>({});
  const [websiteBrand, setWebsiteBrand] = useState({
    name: 'Workly India',
    tagline: 'Find.Work.Grow',
    primaryColor: '#3B5CE4',
    secondaryColor: '#0DB17E',
  });
  const { cropId: assetCropField, cropFile: assetCropFile, openCrop: openAssetCrop, closeCrop: closeAssetCrop } = useCropPersistence('wly-email-asset-crop');
  const [uploadingAsset, setUploadingAsset] = useState<EmailAssetField | null>(null);
  const [audience, setAudience] = useRefreshSafeState<'job_seeker' | 'employer'>('wly-email-audience', 'job_seeker');
  const [selectedTemplate, setSelectedTemplate] = useRefreshSafeState<string | null>('wly-email-template', null);
  const bodyRefs = useRef<Record<string, EmailBodyBuilderRef | null>>({});
  const [uploadingBodyImage, setUploadingBodyImage] = useState(false);

  useEffect(() => {
    void load();
    void loadEmailAssets();
  }, []);

  const loadEmailAssets = async () => {
    const [settingsResult, brandResult] = await Promise.all([
      supabase.from('app_settings').select('setting_key, setting_value').in('setting_key', EMAIL_ASSET_FIELDS),
      supabase.rpc('get_brand_assets'),
    ]);
    if (!settingsResult.error) {
      const next: Partial<Record<EmailAssetField, string>> = {};
      settingsResult.data?.forEach((row) => {
        if (EMAIL_ASSET_FIELDS.includes(row.setting_key as EmailAssetField) && row.setting_value) {
          next[row.setting_key as EmailAssetField] = row.setting_value;
        }
      });
      setEmailAssets(next);
    }
    const assets = brandResult.data && typeof brandResult.data === 'object'
      ? brandResult.data as Record<string, unknown>
      : {};
    setWebsiteBrand({
      name: typeof assets.brand_name === 'string' ? assets.brand_name : 'Workly India',
      tagline: typeof assets.brand_tagline === 'string' ? assets.brand_tagline : 'Find.Work.Grow',
      primaryColor: typeof assets.primary_color === 'string' ? assets.primary_color : '#3B5CE4',
      secondaryColor: typeof assets.secondary_color === 'string' ? assets.secondary_color : '#0DB17E',
    });
  };


  const selectEmailAsset = (field: EmailAssetField, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Please select an image file.');
    if (file.size > 5 * 1024 * 1024) return toast.error('The image must be smaller than 5 MB.');
    void openAssetCrop(field, file);
  };

  const selectHeaderImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Please select an image file.');
    if (file.size > 1024 * 1024) return toast.error('Header image must be smaller than 1 MB. Transparent PNG works best.');
    void saveEmailAsset(file, 'email_header_image');
  };

  const saveEmailAsset = async (croppedFile: File, directField?: EmailAssetField): Promise<boolean> => {
    const field = (directField || assetCropField) as EmailAssetField;
    if (!field) return false;
    setUploadingAsset(field);
    try {
      const uploadFile = field.startsWith('email_social_icon_')
        ? await removeSocialIconBackground(croppedFile)
        : croppedFile;
      const { data: auth } = await supabase.auth.getUser();
      const result = await replaceSavedMedia({
        oldUrl: emailAssets[field],
        upload: () => uploadBrandAsset(uploadFile, field),
        save: async (url) => {
          const { error } = await supabase.from('app_settings').upsert({
            setting_key: field, setting_value: url,
            description: field === 'email_header_image' ? 'Email header image' : 'Email social icon',
            updated_by: auth.user?.id || null, updated_at: new Date().toISOString(),
          }, { onConflict: 'setting_key' });
          if (error) throw error;
        },
        cleanup: cleanupBrandAsset,
      });
      setEmailAssets(current => ({ ...current, [field]: result.url }));
      queryClient.setQueryData<Record<string, string>>(SOCIAL_ICON_QUERY_KEY, current => ({ ...current, [field]: result.url }));
      void queryClient.invalidateQueries({ queryKey: SOCIAL_ICON_QUERY_KEY });
      if (result.cleanupPending) toast.warning('Image saved, but the old file could not be deleted.');
      else toast.success('Email image updated.');
      if (!directField) closeAssetCrop();
      return true;
    } catch (error) {
      console.error('Email branding upload failed:', error);
      toast.error('Email image could not be saved.');
      return false;
    } finally {
      setUploadingAsset(null);
    }
  };

  const removeEmailAsset = async (field: EmailAssetField) => {
    setUploadingAsset(field);
    try {
      const result = await replaceSavedMedia({
        oldUrl: emailAssets[field],
        save: async (url) => {
          const { error } = await supabase.from('app_settings').upsert({
            setting_key: field, setting_value: url, updated_at: new Date().toISOString(),
          }, { onConflict: 'setting_key' });
          if (error) throw error;
        },
        cleanup: cleanupBrandAsset,
      });
      setEmailAssets(current => ({ ...current, [field]: '' }));
      queryClient.setQueryData<Record<string, string>>(SOCIAL_ICON_QUERY_KEY, current => ({ ...current, [field]: '' }));
      void queryClient.invalidateQueries({ queryKey: SOCIAL_ICON_QUERY_KEY });
      if (result.cleanupPending) toast.warning('Image removed, but the stored file could not be deleted.');
      else toast.success(field === 'email_header_image' ? 'Default header image will be used.' : 'Default HD icon will be used.');
    } catch {
      toast.error('Image could not be removed.');
    } finally {
      setUploadingAsset(null);
    }
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('email_lifecycle_templates').select('*');
    if (error) {
      toast.error('Templates could not be loaded. Please refresh the page.');
    } else {
      const next = buildInitial();
      (data || []).forEach((row) => {
        const key = row.event_type as string;
        if (!next[key]) return;
        next[key] = {
          event_type: key,
          saved: true,
          enabled: row.enabled === true,
          subject: row.subject || next[key].subject,
          body: `${toEmailDocumentHtml(row.body || next[key].body)}${inlineButton(row.button_text, row.button_url)}`,
          image_url: row.image_url ?? null,
        };
      });
      setTemplates(next);
    }
    setLoading(false);
  };

  const { queueDeletion, flushDeletions } = useDeferredStorageCleanup();
  const { isDirty, markDirty, markClean } = useDirtyState();
  const { confirmDiscard } = useUnsavedChangesWarning(isDirty);

  const patch = (event: string, changes: Partial<Template>) => {
    markDirty();
    setTemplates((prev) => ({ ...prev, [event]: { ...prev[event], ...changes } }));
  };

  const insertVariable = (event: string, key: string) => {
    const token = `{{${key}}}`;
    bodyRefs.current[event]?.insertVariable(token);
  };

  const uploadBodyImage = async (event: string, file: File): Promise<string> => {
    if (!file.type.startsWith('image/')) throw new Error('Please select an image file.');
    if (file.size > 10 * 1024 * 1024) throw new Error('The image must be smaller than 10 MB.');
    setUploadingBodyImage(true);
    try {
      // GIFs are uploaded untouched so the animation keeps playing.
      const isGif = file.type === 'image/gif';
      // Original bytes go to Cloudflare — no shrinking or WebP conversion.
      const { url } = await uploadToR2(file, 'template-email');
      toast.success(isGif ? 'GIF uploaded and added to the message.' : 'Image uploaded and added to the message.');
      return `${url}?t=${Date.now()}`;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The image could not be uploaded.');
      throw error;
    } finally {
      setUploadingBodyImage(false);
    }
  };

  /** A picture removed from the message is deleted only after a successful save. */
  const deleteBodyImage = (url: string, event: string) => {
    queueDeletion(url, event);
  };

  const removeTemplateImage = async (event: string) => {
    // Only remember the picture for deletion: it stays online until the save
    // succeeds, so abandoning the edit cannot break the saved template.
    queueDeletion(templates[event]?.image_url, event);
    patch(event, { image_url: null });
    toast.success('Picture removed. Save the template to keep this change.');
  };

  const handleFileSelect = (event: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Please select an image file.');
    if (file.size > 5 * 1024 * 1024) return toast.error('The image must be smaller than 5 MB.');
    void openCrop(event, file);
  };

  const handleCropComplete = async (croppedFile: File) => {
    if (!cropEvent) return;
    const event = cropEvent;
    try {
      // The previous picture stays online until the template is saved, so an
      // abandoned edit can never leave the saved template pointing at a
      // file that no longer exists.
      queueDeletion(templates[event]?.image_url, event);
      const { url } = await uploadToR2(croppedFile, 'template-email');
      patch(event, { image_url: `${url}?t=${Date.now()}` });
      toast.success('Image added. Save the template to keep this change.');
      closeCrop();
    } catch (error) {
      console.error('Email template image upload failed:', error);
      toast.error('The image could not be uploaded. Please try again.');
    }
  };

  const save = async (event: string) => {
    const t = templates[event];
    if (!t.subject.trim() || !t.body.trim()) {
      toast.error('Subject and message are required.');
      return;
    }
    setSavingEvent(event);
    const { error } = await supabase.from('email_lifecycle_templates').upsert(
      {
        event_type: event,
        enabled: t.enabled,
        subject: t.subject.trim(),
        body: t.body.trim(),
        // The button now lives inside the message, so the old columns are cleared.
        button_text: null,
        button_url: '/',
        image_url: t.image_url,
      },
      { onConflict: 'event_type' },
    );
    setSavingEvent(null);
    if (error) {
      console.error(error);
      toast.error('Template could not be saved. Please try again.');
      return;
    }
    patch(event, { saved: true });
    markClean();
    void flushDeletions(event);
    toast.success('Template saved successfully.');
  };

  const getMyEmail = async (): Promise<string | null> => {
    const { data: auth, error } = await supabase.auth.getUser();
    if (error) throw new Error(error.message);
    return auth?.user?.email || null;
  };

  const buildHtml = (def: PushTemplateDef, t: Template) => {
    const values = withJobAlertSample(sampleValuesFor(def), 'email');
    const body = applyVariables(t.body, values) || t.body;
    const image = t.image_url
      ? `<p style="margin:0 0 20px;text-align:center;"><img src="${escapeTemplateAttribute(t.image_url)}" alt="" style="display:block;width:auto;max-width:100%;height:auto;margin:0 auto;border:0;" /></p>`
      : '';
    return `${image}${renderEmailTemplateHtml(body)}`;
  };

  const sendOne = async (def: PushTemplateDef, email: string) => {
    const t = templates[def.key];
    const values = withJobAlertSample(sampleValuesFor(def), 'email');
    const { data, error } = await supabase.functions.invoke('email-api/send-email', {
      body: {
        to: email,
        subject: applyVariables(t.subject, values) || t.subject,
        htmlContent: buildHtml(def, t),
        // This is the complete message body. The sender adds only shared
        // branding/footer, so delivered content matches the preview exactly.
        templateMode: 'complete',
        // Test email usi side ke mailbox set se jaata hai jo tab khula hai.
        audience: audience === 'employer' ? 'employer' : 'jobseeker',
      },
    });
    if (error) throw new Error(await emailTestError(error));
    if (!data?.success) throw new Error(await emailTestError(new Error(data?.error || 'Unknown error')));
  };

  const sendTest = async (event: string) => {
    setTestingEvent(event);
    try {
      const email = await getMyEmail();
      if (!email) {
        toast.error('No email address is available for your account.');
        return;
      }
      const def = ALL_PUSH_TEMPLATES.find((d) => d.key === event);
      if (!def) return;
      await sendOne(def, email);
      toast.success(`Test email sent to ${email}.`);
    } catch (error) {
      toast.error(`Test email could not be sent. ${error instanceof Error ? error.message : ''}`);
    } finally {
      setTestingEvent(null);
    }
  };

  const renderEditor = (def: PushTemplateDef) => {
    const event = def.key;
    const t = templates[event];
    return (
      <div className="space-y-4">
        {t.saved ? (
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Email enabled</p>
              <p className="text-xs text-muted-foreground">Turn this off to stop sending this email.</p>
            </div>
            <Switch checked={t.enabled} onCheckedChange={(v) => patch(event, { enabled: v })} />
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-3">
            <p className="text-sm font-medium">Save this template first</p>
            <p className="text-xs text-muted-foreground">
              The on / off option appears after saving.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label>Subject</Label>
          <Input
            value={t.subject}
            maxLength={120}
            onChange={(e) => patch(event, { subject: e.target.value })}
            placeholder={emailDefaultsFor(def).title}
          />
        </div>

        <div className="space-y-2">
          <Label>Message</Label>
          <EmailBodyBuilder
            ref={(el) => { bodyRefs.current[event] = el; }}
            value={t.body}
            onChange={(body) => patch(event, { body })}
            onUploadImage={(file) => uploadBodyImage(event, file)}
            uploading={uploadingBodyImage}
            onDeleteImage={(url) => deleteBodyImage(url, event)}
          />

          {t.image_url && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/20 p-3">
              <img src={t.image_url} alt="" className="h-12 w-12 rounded object-cover" />
              <Button type="button" size="sm" variant="outline" onClick={() => void removeTemplateImage(event)}>
                Remove picture
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Select a text block, then tap a field below. Real data is filled automatically when sent.
          </p>
          <div className="flex w-full gap-2 overflow-x-auto pb-2">
            {variablesFor(def).map((v) => (
              <Button
                key={v.key}
                type="button"
                size="sm"
                variant="secondary"
                className="h-7 shrink-0 whitespace-nowrap px-2 text-xs"
                onClick={() => insertVariable(event, v.key)}
              >
                {v.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Email app preview</Label>
          <TemplateChannelPreview
            channel="email"
            title={applyVariables(t.subject, withJobAlertSample(sampleValuesFor(def), 'email')) || t.subject}
            body={applyVariables(t.body, withJobAlertSample(sampleValuesFor(def), 'email')) || t.body}
            imageUrl={t.image_url}
            headerLogoUrl={emailAssets.email_header_image || emailAssets.email_header_mascot_url || DEFAULT_EMAIL_HEADER_IMAGE}
            socialIcons={SOCIAL_PLATFORMS.map((platform) => ({
              label: SOCIAL_LABELS[platform],
              imageUrl: emailAssets[`email_social_icon_${platform}`] || DEFAULT_SOCIAL_ICONS[platform],
              href: platform === 'whatsapp' && socialLinks.whatsapp && !/^https?:\/\//i.test(socialLinks.whatsapp)
                ? `https://wa.me/${socialLinks.whatsapp.replace(/\D/g, '')}`
                : socialLinks[platform],
            }))}
            isOtp={event === 'login_otp' || event.endsWith('_signup_otp') || event.endsWith('_2fa_otp')}
          />
        </div>

        <div className="space-y-1">
          <Button
            type="button"
            variant="outline"
            className="w-full min-w-0 px-2 text-sm"
            onClick={() => void sendTest(event)}
            disabled={testingEvent === event || !t.saved}
          >
            <Send className="w-4 h-4 mr-1 shrink-0" />
            <span className="truncate">{testingEvent === event ? 'Sending test...' : 'Send test to me'}</span>
          </Button>
          {!t.saved && (
            <p className="text-xs text-muted-foreground">
              Save the template first, then send yourself a test.
            </p>
          )}
        </div>

        <div>
          <Button
            className="w-full min-w-0 px-2 text-sm"
            onClick={() => save(event)}
            disabled={savingEvent === event}
          >
            <Save className="w-4 h-4 mr-1 shrink-0" />
            <span className="truncate">{savingEvent === event ? 'Saving...' : 'Save template'}</span>
          </Button>
        </div>
      </div>
    );
  };

  const selectedDef = selectedTemplate
    ? ALL_PUSH_TEMPLATES.find((definition) => definition.key === selectedTemplate)
    : undefined;

  if (selectedDef) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-4xl items-center gap-2 px-2 sm:px-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                void confirmDiscard().then((ok) => { if (ok) setSelectedTemplate(null); });
              }}
              aria-label="Back to email templates"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="min-w-0 flex-1 truncate text-base font-semibold sm:text-lg">{selectedDef.label}</h1>
          </div>
        </header>
        <main className="mx-auto max-w-4xl p-4 pb-8 sm:p-6">{renderEditor(selectedDef)}</main>
        <ImageCropDialog
          open={Boolean(cropEvent)}
          onOpenChange={(open) => {
            if (!open) {
              closeCrop();
            }
          }}
          imageFile={selectedFile}
          onCropComplete={handleCropComplete}
          aspectRatio={2}
          outputSize={{ width: 1024, height: 512 }}
          title="Crop email image"
          allowOriginal
          hideHeader
        />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/owner-portal')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">Email Templates</h1>
          <p className="text-sm text-muted-foreground">
            Update each email's subject, message, button and image here.
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={() => setBrandingOpen(true)} aria-label="Email branding settings">
          <Settings className="h-5 w-5" />
        </Button>
      </div>

      <Tabs value={audience} onValueChange={(value) => setAudience(value as 'job_seeker' | 'employer')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="job_seeker">Job seekers</TabsTrigger>
          <TabsTrigger value="employer">Employers</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="space-y-6">
          {groupsForChannel('email', audience).map((group) => (
            <Card key={group.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Mail className="w-5 h-5 text-primary" />
                  {group.label}
                </CardTitle>
                <CardDescription>{group.events.length} emails</CardDescription>
              </CardHeader>
              <CardContent className="px-3 pb-3 sm:px-6 sm:pb-6">
                <div className="divide-y">
                  {group.events.map((def) => (
                    <Button
                      key={def.key}
                      type="button"
                      variant="ghost"
                      className="h-auto w-full justify-start rounded-none px-1 py-4 text-left hover:bg-muted/50"
                      onClick={() => setSelectedTemplate(def.key)}
                    >
                      <div className="min-w-0 flex-1 whitespace-normal">
                        <p className="font-medium">{def.label}</p>
                        <p className="mt-1 text-xs font-normal text-muted-foreground">{def.description}</p>
                        {templates[def.key]?.saved && (
                          <p className={`mt-1 text-xs font-medium ${templates[def.key].enabled ? 'text-primary' : 'text-muted-foreground'}`}>
                            {templates[def.key].enabled ? 'Active' : 'Off'}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="ml-2 h-5 w-5 shrink-0 text-muted-foreground" />
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ImageCropDialog
        open={Boolean(cropEvent)}
        onOpenChange={(open) => {
          if (!open) {
            closeCrop();
          }
        }}
        imageFile={selectedFile}
        onCropComplete={handleCropComplete}
        aspectRatio={2}
        outputSize={{ width: 1024, height: 512 }}
        title="Crop email image"
        allowOriginal
        hideHeader
      />

      <Sheet open={brandingOpen} onOpenChange={setBrandingOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader className="pr-8 text-left">
            <SheetTitle>Email branding</SheetTitle>
            <SheetDescription>
              Header logo and social icons saved here appear automatically in every new email.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-7">
            <section className="space-y-3">
              <div>
                <Label>Sending mailboxes</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Separate from the AI Connect page. Job seeker and employer emails are sent from
                  Domain Email first; if that is not connected or fails, Outlook is used, then Gmail.
                </p>
              </div>
              <TemplateMailboxCards />
            </section>


            <section className="space-y-3">
              <div>
                <Label>Email header image</Label>
                <p className="mt-1 text-xs text-muted-foreground">Shown at the top of every email. Use a transparent PNG under 1 MB (about 600 px wide).</p>
              </div>
              <div className="border p-3">
                <div className="flex h-24 items-center justify-center">
                  <img src={emailAssets.email_header_image || emailAssets.email_header_mascot_url || DEFAULT_EMAIL_HEADER_IMAGE} alt="Email header" className="max-h-24 max-w-full object-contain" />
                </div>
                <input id="email-header-image" type="file" accept="image/png,image/webp,image/jpeg,image/gif" className="hidden" onChange={selectHeaderImage} />
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" disabled={Boolean(uploadingAsset)} onClick={() => document.getElementById('email-header-image')?.click()}>
                    <Upload className="h-4 w-4" />
                    {uploadingAsset === 'email_header_image' ? 'Uploading…' : 'Change header image'}
                  </Button>
                  <Button size="sm" variant="outline" disabled={!emailAssets.email_header_image || Boolean(uploadingAsset)} onClick={() => void removeEmailAsset('email_header_image')}>
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Use default header image</span>
                  </Button>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <div>
                <Label>WhatsApp notification logo</Label>
                <p className="mt-1 text-xs text-muted-foreground">Shown on phone notifications for new WhatsApp messages. Square PNG under 1 MB (512 × 512 works best).</p>
              </div>
              <div className="border p-3">
                <div className="flex h-24 items-center justify-center">
                  <img src={emailAssets.whatsapp_notification_icon || '/whatsapp-notification-icon.png'} alt="WhatsApp notification logo" className="h-20 w-20 object-contain" />
                </div>
                <input id="whatsapp-notification-icon" type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  if (!file.type.startsWith('image/')) return toast.error('Please select an image file.');
                  if (file.size > 1024 * 1024) return toast.error('Logo must be smaller than 1 MB.');
                  void saveEmailAsset(file, 'whatsapp_notification_icon');
                }} />
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" disabled={Boolean(uploadingAsset)} onClick={() => document.getElementById('whatsapp-notification-icon')?.click()}>
                    <Upload className="h-4 w-4" />
                    {uploadingAsset === 'whatsapp_notification_icon' ? 'Uploading…' : 'Change WhatsApp logo'}
                  </Button>
                  <Button size="sm" variant="outline" disabled={!emailAssets.whatsapp_notification_icon || Boolean(uploadingAsset)} onClick={() => void removeEmailAsset('whatsapp_notification_icon')}>
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Use default WhatsApp logo</span>
                  </Button>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <div>
                <Label>Social icons</Label>
                <p className="mt-1 text-xs text-muted-foreground">Used in emails and as the phone notification logo for new Instagram/Facebook messages — updating an icon here updates the push notification logo too. Square transparent PNG files work best. Each icon is cropped and saved at 256 × 256.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {SOCIAL_PLATFORMS.map((platform) => {
                  const field = `email_social_icon_${platform}` as EmailAssetField;
                  return (
                    <div key={platform} className="border p-3">
                      <div className="flex items-center gap-3">
                         <div className="flex h-12 w-12 items-center justify-center">
                           <img src={emailAssets[field] || DEFAULT_SOCIAL_ICONS[platform]} alt={`${SOCIAL_LABELS[platform]} icon`} className="h-10 w-10 object-contain" />
                        </div>
                        <span className="min-w-0 flex-1 text-sm font-medium">{SOCIAL_LABELS[platform]}</span>
                      </div>
                      <input id={`email-icon-${platform}`} type="file" accept="image/*" className="hidden" onChange={(event) => selectEmailAsset(field, event)} />
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1" disabled={Boolean(uploadingAsset)} onClick={() => document.getElementById(`email-icon-${platform}`)?.click()}>
                          <Upload className="h-4 w-4" />
                          <span className="sr-only">Upload {SOCIAL_LABELS[platform]} icon</span>
                        </Button>
                        <Button size="sm" variant="outline" disabled={!emailAssets[field] || Boolean(uploadingAsset)} onClick={() => void removeEmailAsset(field)}>
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Use default {SOCIAL_LABELS[platform]} icon</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </SheetContent>
      </Sheet>

      <ImageCropDialog
        open={Boolean(assetCropField)}
        onOpenChange={(open) => {
          if (!open) {
            closeAssetCrop();
          }
        }}
        imageFile={assetCropFile}
        onCropComplete={(file) => saveEmailAsset(file)}
        aspectRatio={assetCropField?.startsWith('email_social_icon_') ? 1 : undefined}
        outputSize={assetCropField?.startsWith('email_social_icon_') ? { width: 256, height: 256 } : undefined}
        title="Crop social icon"
        hideHeader
      />
    </div>
  );
}
