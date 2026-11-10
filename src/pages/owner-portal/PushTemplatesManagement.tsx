import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ImageCropDialog } from '@/components/brand/ImageCropDialog';
import { TemplateChannelPreview } from '@/components/owner-portal/TemplateChannelPreview';
import { uploadImage } from '@/lib/mediaCdn';
import { useRefreshSafeState, useCropPersistence } from '@/hooks/useTemplatePageState';
import { useDeferredStorageCleanup } from '@/hooks/useDeferredStorageCleanup';
import { useDirtyState, useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';
import { ArrowLeft, Bell, ChevronRight, ImagePlus, Save, Send, Trash2 } from 'lucide-react';
import {
  ALL_PUSH_TEMPLATES,
  groupsForChannel,
  applyVariables,
  sampleValuesFor,
  variablesFor,
  type PushTemplateDef,
} from '@/config/pushTemplateCatalog';

interface Template {
  event_type: string;
  /** True only when a row for this event exists in the database. */
  saved: boolean;
  enabled: boolean;
  title: string;
  body: string;
  button_text: string;
  button_url: string;
  image_url: string | null;
}

const fromDef = (def: PushTemplateDef): Template => ({
  event_type: def.key,
  saved: false,
  enabled: true,
  title: def.defaults.title,
  body: def.defaults.body,
  button_text: def.defaults.button_text,
  button_url: def.defaults.button_url,
  image_url: null,
});

const buildInitial = (): Record<string, Template> =>
  Object.fromEntries(ALL_PUSH_TEMPLATES.map((def) => [def.key, fromDef(def)]));

export default function PushTemplatesManagement() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Record<string, Template>>(buildInitial);
  const [loading, setLoading] = useState(true);
  const [savingEvent, setSavingEvent] = useState<string | null>(null);
  const [testingEvent, setTestingEvent] = useState<string | null>(null);
  const { cropId: cropEvent, cropFile: selectedFile, openCrop, closeCrop } = useCropPersistence('wly-push-crop');
  const [audience, setAudience] = useRefreshSafeState<'job_seeker' | 'employer'>('wly-push-audience', 'job_seeker');
  const [selectedTemplate, setSelectedTemplate] = useRefreshSafeState<string | null>('wly-push-template', null);
  const bodyRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('push_lifecycle_templates').select('*');
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
          title: row.title ?? next[key].title,
          body: row.body ?? next[key].body,
          button_text: row.button_text ?? next[key].button_text,
          button_url: row.button_url ?? next[key].button_url,
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
    const el = bodyRefs.current[event];
    const current = templates[event]?.body ?? '';
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    const next = current.slice(0, start) + token + current.slice(end);
    patch(event, { body: next.slice(0, 600) });
    requestAnimationFrame(() => {
      el?.focus();
      const caret = start + token.length;
      el?.setSelectionRange(caret, caret);
    });
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
      const extension = croppedFile.type === 'image/gif' ? 'gif' : croppedFile.type === 'image/webp' ? 'webp' : 'png';
      // The previous picture stays online until the template is saved, so an
      // abandoned edit can never leave the saved template pointing at a
      // file that no longer exists.
      queueDeletion(templates[event]?.image_url, event);
      const { url } = await uploadImage(croppedFile, {
        folder: 'brand-assets/push-templates',
        fileName: `${Date.now()}-${event}.${extension}`,
      });
      patch(event, { image_url: `${url}?t=${Date.now()}` });
      toast.success('Image added. Save the template to keep this change.');
      closeCrop();
    } catch (error) {
      console.error('Push template image upload failed:', error);
      toast.error('The image could not be uploaded. Please try again.');
    }
  };

  const save = async (event: string) => {
    const t = templates[event];
    if (!t.title.trim() || !t.body.trim()) {
      toast.error('Title and message are required.');
      return;
    }
    setSavingEvent(event);
    const { error } = await supabase.from('push_lifecycle_templates').upsert(
      {
        event_type: event,
        enabled: t.enabled,
        title: t.title.trim(),
        body: t.body.trim(),
        button_text: t.button_text?.trim() || null,
        button_url: t.button_url?.trim() || '/',
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


  /** Turns an edge-function failure into a readable reason for the owner. */
  const describeInvokeFailure = async (error: unknown, data: Record<string, unknown> | null): Promise<string> => {
    if (typeof data?.error === 'string' && data.error) return data.error;
    if (typeof data?.reason === 'string' && data.reason) return data.reason;
    if (error && typeof error === 'object' && 'context' in error) {
      try {
        const raw = (await (error as { context?: Response }).context?.text()) ?? '';
        const parsed = JSON.parse(raw);
        if (typeof parsed?.error === 'string') return parsed.error;
        return String(raw).slice(0, 200);
      } catch {
        /* fall through */
      }
    }
    if (error instanceof Error) return error.message;
    return 'Unknown error';
  };

  const sendTest = async (event: string) => {
    setTestingEvent(event);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (authError || !userId) {
        toast.error('Please sign in again before sending a test.');
        return;
      }
      // Send the owner test to every active FCM registration for this account.
      // Do not use getCurrentPlayerId(): that returns only this browser token.
      const { data: devices, error: devicesError } = await supabase
        .from('push_subscriptions')
        .select('fcm_token, platform')
        .eq('user_id', userId)
        .eq('enabled', true);
      if (devicesError) {
        console.error('Could not load registered push devices:', devicesError);
        toast.error('Could not load registered devices. Please try again.');
        return;
      }
      const uniqueTokens = [...new Set((devices ?? [])
        .map((device) => device.fcm_token)
        .filter((token): token is string => typeof token === 'string' && token.length > 0))];
      if (uniqueTokens.length === 0) {
        toast.error('No active notification devices are registered for this account.');
        return;
      }
      const def = ALL_PUSH_TEMPLATES.find((d) => d.key === event);
      const results = await Promise.all(uniqueTokens.map(async (token) => {
        const { data, error } = await supabase.functions.invoke('email-api', {
          body: {
            action: 'send_lifecycle_push',
            event,
            token,
            test: true,
            variables: def ? sampleValuesFor(def) : {},
          },
        });
        return { success: !error && data?.success === true, data, error };
      }));
      const sent = results.filter((result) => result.success).length;
      const failed = results.length - sent;
      if (sent === results.length) {
        toast.success(`Test notification accepted for all ${sent} registered device(s).`);
      } else if (sent > 0) {
        console.error('Some registered push devices rejected the test:', results);
        toast.warning(`Test accepted for ${sent} device(s); ${failed} device(s) failed. Check console details.`);
      } else {
        console.error('All registered push devices rejected the test:', results);
        const reason = results.map((result) => result.data?.error || result.error?.message).filter(Boolean).join('; ');
        toast.error(`Test failed for all ${failed} device(s). ${reason}`);
      }
    } catch (error) {
      console.error('Push template test failed:', error);
      toast.error('Test notification could not be sent. Please try again.');
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
              <p className="text-sm font-medium">Notification enabled</p>
              <p className="text-xs text-muted-foreground">Turn this off to stop sending this notification.</p>
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
          <Label>Title</Label>
          <Input
            value={t.title}
            maxLength={60}
            onChange={(e) => patch(event, { title: e.target.value })}
            placeholder={def.defaults.title}
          />
        </div>

        <div className="space-y-2">
          <Label>Message</Label>
          <Textarea
            ref={(el) => { bodyRefs.current[event] = el; }}
            value={t.body}
            maxLength={600}
            rows={7}
            onChange={(e) => patch(event, { body: e.target.value })}
            placeholder={def.defaults.body}
          />
          <p className="text-xs text-muted-foreground">
            Tap a field to insert it. Real data is filled in automatically when the push is sent.
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
          <Label>Mobile notification preview</Label>
          <TemplateChannelPreview
            channel="push"
            title={applyVariables(t.title, sampleValuesFor(def)) || t.title}
            body={applyVariables(t.body, sampleValuesFor(def)) || t.body}
            buttonText={t.button_text}
            imageUrl={t.image_url}
          />
        </div>


        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Button text</Label>
            <Input
              value={t.button_text}
              maxLength={20}
              onChange={(e) => patch(event, { button_text: e.target.value })}
              placeholder={def.defaults.button_text}
            />
          </div>
          <div className="space-y-2">
            <Label>Button link</Label>
            <Input
              value={t.button_url}
              onChange={(e) => patch(event, { button_url: e.target.value })}
              placeholder={def.defaults.button_url}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Notification image (1024 × 512)</Label>
          {t.image_url ? (
            <div className="relative w-full max-w-sm">
              <div className="flex min-h-32 items-center justify-center p-2">
                <img src={t.image_url} alt={`${def.label} preview`} className="max-h-64 w-full object-contain" />
              </div>
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8"
                onClick={() => {
                  queueDeletion(templates[event]?.image_url, event);
                  patch(event, { image_url: null });
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No image added yet.</p>
          )}
          <input
            type="file"
            accept="image/*"
            id={`push-image-${event}`}
            className="hidden"
            onChange={(e) => handleFileSelect(event, e)}
          />
        </div>

        <div className="space-y-1">
          <Button
            type="button"
            variant="outline"
            className="w-full min-w-0 px-2 text-xs sm:text-sm"
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

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className="w-full min-w-0 px-2 text-xs sm:text-sm"
            onClick={() => document.getElementById(`push-image-${event}`)?.click()}
          >
            <ImagePlus className="w-4 h-4 mr-1 shrink-0" />
            <span className="truncate">{t.image_url ? 'Change image' : 'Upload image'}</span>
          </Button>
          <Button
            className="w-full min-w-0 px-2 text-xs sm:text-sm"
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
              aria-label="Back to push templates"
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
          title="Crop notification image"
          hideHeader
        />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/owner-portal')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Push Templates</h1>
          <p className="text-sm text-muted-foreground">
            Update the title, message, button and image of every push notification here.
          </p>
        </div>
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
          {groupsForChannel('push', audience).map((group) => (
            <Card key={group.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Bell className="w-5 h-5 text-primary" />
                  {group.label}
                </CardTitle>
                <CardDescription>{group.events.length} notifications</CardDescription>
              </CardHeader>
              <CardContent className="px-3 pb-3 sm:px-6 sm:pb-6">
                <div className="divide-y">
                  {group.events.map((def) => (
                    <Button key={def.key} type="button" variant="ghost" className="h-auto w-full justify-start rounded-none px-1 py-4 text-left hover:bg-muted/50" onClick={() => setSelectedTemplate(def.key)}>
                      <div className="min-w-0 flex-1 whitespace-normal">
                        <p className="font-medium">{def.label}</p>
                        <p className="mt-1 text-xs font-normal text-muted-foreground">{def.description}</p>
                        {templates[def.key]?.saved && <p className={`mt-1 text-xs font-medium ${templates[def.key].enabled ? 'text-primary' : 'text-muted-foreground'}`}>{templates[def.key].enabled ? 'Active' : 'Off'}</p>}
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
        title="Crop notification image"
        allowOriginal
        hideHeader
      />
    </div>
  );
}
