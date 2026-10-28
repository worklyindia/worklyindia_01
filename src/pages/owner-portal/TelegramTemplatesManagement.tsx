import { withJobAlertSample as withJobAlertOnly } from '@/config/jobAlertSample';
import { withPromoSample } from '@/config/resumePromoGallery';
const withJobAlertSample = (v: Record<string, string>, c: 'email' | 'telegram') => withPromoSample(withJobAlertOnly(v, c), c);
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ImageCropDialog } from '@/components/brand/ImageCropDialog';
import { TemplateChannelPreview, type TelegramTemplateButton } from '@/components/owner-portal/TemplateChannelPreview';
import { TelegramBodyEditor, type TelegramBodyEditorRef } from '@/components/owner-portal/TelegramBodyEditor';
import { uploadToR2 } from '@/lib/r2Media';
import { useRefreshSafeState, useCropPersistence } from '@/hooks/useTemplatePageState';
import { useDeferredStorageCleanup } from '@/hooks/useDeferredStorageCleanup';
import { useDirtyState, useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';
import { escapeTemplateHtml, renderTelegramTemplateHtml } from '@/lib/templateFormatting';
import { ArrowDown, ArrowLeft, ArrowUp, ChevronRight, ImagePlus, Plus, Save, Send, Settings, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ALL_PUSH_TEMPLATES,
  groupsForChannel,
  applyVariables,
  sampleValuesFor,
  variablesFor,
  telegramDefaultsFor,

  type PushTemplateDef,
} from '@/config/pushTemplateCatalog';

type Audience = 'job_seeker' | 'employer';


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
  buttons: TelegramTemplateButton[];
}

const BUTTON_TYPES: readonly string[] = ['url', 'copy_text', 'web_app'];

/**
 * `buttons` is stored as untyped JSON, so rows coming back from the database are
 * normalised into `TelegramTemplateButton` before they reach the editor. Any
 * entry with an unknown shape or an unsupported button type is dropped rather
 * than rendered.
 */
const toTemplateButtons = (value: unknown): TelegramTemplateButton[] =>
  Array.isArray(value)
    ? value.flatMap((entry): TelegramTemplateButton[] => {
        if (typeof entry !== 'object' || entry === null) return [];
        const button = entry as Record<string, unknown>;
        if (typeof button.type !== 'string' || !BUTTON_TYPES.includes(button.type)) return [];
        return [
          {
            id: String(button.id ?? ''),
            text: String(button.text ?? ''),
            type: button.type as TelegramTemplateButton['type'],
            value: String(button.value ?? ''),
            row: Number(button.row ?? 0),
          },
        ];
      })
    : [];

const fromDef = (def: PushTemplateDef): Template => {
  const defaults = telegramDefaultsFor(def);
  return {
    event_type: def.key,
    saved: false,
    enabled: true,
    title: defaults.title,
    body: defaults.body,
    button_text: defaults.button_text,
    button_url: defaults.button_url,
    image_url: null,
    buttons: defaults.button_text ? [{ id: `legacy-${def.key}`, text: defaults.button_text, type: 'url', value: defaults.button_url, row: 0 }] : [],
  };
};


const buildInitial = (): Record<string, Template> =>
  Object.fromEntries(ALL_PUSH_TEMPLATES.map((def) => [def.key, fromDef(def)]));

/** Telegram buttons need a full https link, app links are stored as paths. */
const absoluteUrl = (url: string): string => {
  const value = (url || '/').trim();
  if (/^https?:\/\//i.test(value)) return value;
  return `${window.location.origin}${value.startsWith('/') ? value : `/${value}`}`;
};

export default function TelegramTemplatesManagement() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Record<string, Template>>(buildInitial);
  const [audience, setAudience] = useRefreshSafeState<Audience>('wly-telegram-audience', 'job_seeker');
  const [loading, setLoading] = useState(true);
  const [savingEvent, setSavingEvent] = useState<string | null>(null);
  const [testingEvent, setTestingEvent] = useState<string | null>(null);
  const { cropId: cropEvent, cropFile: selectedFile, openCrop, closeCrop } = useCropPersistence('wly-telegram-crop');
  const [selectedTemplate, setSelectedTemplate] = useRefreshSafeState<string | null>('wly-telegram-template', null);
  const bodyRefs = useRef<Record<string, TelegramBodyEditorRef | null>>({});

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('telegram_lifecycle_templates').select('*');
    if (error) {
      toast.error('Templates could not be loaded. Please refresh the page.');
    } else {
      const next = buildInitial();
      (data || []).forEach((row) => {
        const key = row.event_type as string;
        if (!next[key]) return;
        const savedButtons = toTemplateButtons(row.buttons);
        next[key] = {
          event_type: key,
          saved: true,
          enabled: row.enabled === true,
          title: row.title || next[key].title,
          body: row.body || next[key].body,
          button_text: row.button_text ?? next[key].button_text,
          button_url: row.button_url ?? next[key].button_url,
          image_url: row.image_url ?? null,
          buttons: savedButtons.length > 0
            ? savedButtons
            : row.button_text
              ? [{ id: `legacy-${key}`, text: row.button_text, type: 'url', value: row.button_url || '/', row: 0 }]
              : [],
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

  const addButton = (event: string) => {
    const current = templates[event]?.buttons || [];
    if (current.length >= 20) return toast.error('A template can have up to 20 buttons.');
    const lastRow = current.length ? Math.max(...current.map((button) => button.row)) : -1;
    patch(event, { buttons: [...current, { id: crypto.randomUUID(), text: '', type: 'url', value: '', row: lastRow + 1 }] });
  };

  const patchButton = (event: string, id: string, changes: Partial<TelegramTemplateButton>) => {
    patch(event, { buttons: templates[event].buttons.map((button) => button.id === id ? { ...button, ...changes } : button) });
  };

  const removeButton = (event: string, id: string) => {
    const kept = templates[event].buttons.filter((button) => button.id !== id);
    const rows = [...new Set(kept.map((button) => button.row))].sort((a, b) => a - b);
    patch(event, { buttons: kept.map((button) => ({ ...button, row: rows.indexOf(button.row) })) });
  };

  const moveButton = (event: string, id: string, direction: -1 | 1) => {
    const buttons = [...templates[event].buttons];
    const index = buttons.findIndex((button) => button.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= buttons.length) return;
    [buttons[index], buttons[target]] = [buttons[target], buttons[index]];
    patch(event, { buttons: buttons.map((button, buttonIndex) => ({ ...button, row: buttonIndex })) });
  };

  const setButtonRowMode = (event: string, id: string, sameRow: boolean) => {
    const buttons = templates[event].buttons;
    const index = buttons.findIndex((button) => button.id === id);
    if (index <= 0) return;
    const row = sameRow ? buttons[index - 1].row : Math.max(...buttons.slice(0, index).map((button) => button.row)) + 1;
    const updated = buttons.map((button, buttonIndex) => buttonIndex === index ? { ...button, row } : button);
    const rowCounts = updated.reduce<Record<number, number>>((counts, button) => ({ ...counts, [button.row]: (counts[button.row] || 0) + 1 }), {});
    if (rowCounts[row] > 2) return toast.error('Only two buttons can share one row.');
    patch(event, { buttons: updated });
  };

  const validateButtons = (buttons: TelegramTemplateButton[]): string | null => {
    for (const button of buttons) {
      if (!button.text.trim() || !button.value.trim()) return 'Complete the text and action for every button.';
      if (button.text.trim().length > 64) return 'Button text must be 64 characters or fewer.';
      if (button.type === 'web_app' && !/^https:\/\//i.test(button.value.trim())) return 'Web app buttons need a secure https:// link.';
      if (button.type === 'url' && !/^(https?:\/\/|tg:\/\/|\/)/i.test(button.value.trim())) return 'Open link buttons need a website, Telegram link, or app path.';
      if (button.type === 'copy_text' && button.value.trim().length > 256) return 'Copy text must be 256 characters or fewer.';
    }
    return null;
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
      const { url } = await uploadToR2(croppedFile, 'template-telegram');
      patch(event, { image_url: `${url}?t=${Date.now()}` });
      toast.success('Image added. Save the template to keep this change.');
      closeCrop();
    } catch (error) {
      console.error('Telegram template image upload failed:', error);
      toast.error('The image could not be uploaded. Please try again.');
    }
  };

  const save = async (event: string) => {
    const t = templates[event];
    if (!t.title.trim() || !t.body.trim()) {
      toast.error('Title and message are required.');
      return;
    }
    const buttonError = validateButtons(t.buttons);
    if (buttonError) return toast.error(buttonError);
    setSavingEvent(event);
    const { error } = await supabase.from('telegram_lifecycle_templates').upsert(
      {
        event_type: event,
        enabled: t.enabled,
        title: t.title.trim(),
        body: t.body.trim(),
        button_text: t.button_text?.trim() || null,
        button_url: t.button_url?.trim() || '/',
        image_url: t.image_url,
        buttons: t.buttons as unknown as Json,
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

  /** Finds the Telegram chat connected to the signed-in owner (profile, company or chat link). */
  const getMyChatId = async (): Promise<string | null> => {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (!userId) return null;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('telegram_chat_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (profile?.telegram_chat_id) return String(profile.telegram_chat_id);

    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('telegram_chat_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (companyError) throw new Error(companyError.message);
    if (company?.telegram_chat_id) return String(company.telegram_chat_id);

    const { data, error: conversationError } = await supabase
      .from('telegram_conversations')
      .select('chat_id')
      .eq('linked_user_id', userId)
      .eq('is_active', true)
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (conversationError) throw new Error(conversationError.message);
    return data?.chat_id ? String(data.chat_id) : null;
  };

  const buildMessage = (def: PushTemplateDef, t: Template) => {
    const values = withJobAlertSample(sampleValuesFor(def), 'telegram');
    const title = applyVariables(t.title, values) || t.title;
    const body = applyVariables(t.body, values) || t.body;
    return `<b>${escapeTemplateHtml(title)}</b>\n\n${renderTelegramTemplateHtml(body)}`;
  };

  const sendOne = async (def: PushTemplateDef, chatId: string) => {
    const t = templates[def.key];
    const { data, error } = await supabase.functions.invoke('email-api/telegram', {
      body: {
        action: 'send',
        audience,
        chat_id: chatId,
        text: buildMessage(def, t),
        parse_mode: 'HTML',
        photo_url: t.image_url || undefined,
        button_text: t.button_text?.trim() || undefined,
        button_url: t.button_text?.trim() ? absoluteUrl(t.button_url) : undefined,
        buttons: t.buttons.map((button) => ({
          ...button,
          value: button.type === 'copy_text' ? applyVariables(button.value, withJobAlertSample(sampleValuesFor(def), 'telegram')) : absoluteUrl(button.value),
        })),
      },
    });
    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.error || 'Unknown error');
  };

  const sendTest = async (event: string) => {
    setTestingEvent(event);
    try {
      const chatId = await getMyChatId();
      if (!chatId) {
        toast.error('Connect your Telegram account to the bot first, then send a test.');
        return;
      }
      const def = ALL_PUSH_TEMPLATES.find((d) => d.key === event);
      if (!def) return;
      const buttonError = validateButtons(templates[event].buttons);
      if (buttonError) return toast.error(buttonError);
      await sendOne(def, chatId);
      toast.success('Test Telegram message sent successfully.');
    } catch (error) {
      console.error('Telegram template test failed:', error);
      toast.error(`Test message could not be sent. ${error instanceof Error ? error.message : ''}`);
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
              <p className="text-sm font-medium">Telegram message enabled</p>
              <p className="text-xs text-muted-foreground">Turn this off to stop sending this message.</p>
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
            maxLength={80}
            onChange={(e) => patch(event, { title: e.target.value })}
            placeholder={def.defaults.title}
          />
        </div>

        <div className="space-y-2">
          <Label>Message</Label>
          <TelegramBodyEditor
            ref={(el) => { bodyRefs.current[event] = el; }}
            value={t.body}
            maxLength={900}
            onChange={(body) => patch(event, { body })}
            placeholder={def.defaults.body}
          />
          <p className="text-xs text-muted-foreground">
            Tap a field to insert it. Real data is filled in automatically when the message is sent.
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
          <Label>Telegram app preview</Label>
          <TemplateChannelPreview
            channel="telegram"
            title={applyVariables(t.title, withJobAlertSample(sampleValuesFor(def), 'telegram')) || t.title}
            body={applyVariables(t.body, withJobAlertSample(sampleValuesFor(def), 'telegram')) || t.body}
            buttonText={t.button_text}
            imageUrl={t.image_url}
            isOtp={event.endsWith('_2fa_otp')}
            telegramButtons={t.buttons.map((button) => ({ ...button, value: applyVariables(button.value, withJobAlertSample(sampleValuesFor(def), 'telegram')) }))}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label>Telegram buttons</Label>
              <p className="text-xs text-muted-foreground">Add links, copy actions, or pages that open inside Telegram.</p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => addButton(event)} disabled={t.buttons.length >= 20}>
              <Plus className="mr-1 h-4 w-4" /> Add button
            </Button>
          </div>
          {t.buttons.map((button, index) => (
            <div key={button.id} className="space-y-3 rounded-md border p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Button {index + 1}</span>
                <div className="ml-auto flex items-center gap-1">
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveButton(event, button.id, -1)} disabled={index === 0} aria-label="Move button up"><ArrowUp className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveButton(event, button.id, 1)} disabled={index === t.buttons.length - 1} aria-label="Move button down"><ArrowDown className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeButton(event, button.id)} aria-label="Delete button"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Button text</Label>
                  <Input value={button.text} maxLength={64} onChange={(e) => patchButton(event, button.id, { text: e.target.value })} placeholder="Button text" />
                </div>
                <div className="space-y-1.5">
                  <Label>Button action</Label>
                  <Select value={button.type} onValueChange={(type: TelegramTemplateButton['type']) => patchButton(event, button.id, { type, value: '' })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="url">Open link</SelectItem>
                      <SelectItem value="copy_text">Copy text</SelectItem>
                      <SelectItem value="web_app">Open web app</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{button.type === 'copy_text' ? 'Text to copy' : button.type === 'web_app' ? 'Secure web app link' : 'Button link'}</Label>
                <Input value={button.value} maxLength={button.type === 'copy_text' ? 256 : 2048} onChange={(e) => patchButton(event, button.id, { value: e.target.value })} placeholder={button.type === 'copy_text' ? 'Text or {{code}}' : 'https://worklyindia.devs.surf/...'} />
              </div>
              {index > 0 && (
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor={`same-row-${event}-${button.id}`}>Show beside previous button</Label>
                  <Switch id={`same-row-${event}-${button.id}`} checked={button.row === t.buttons[index - 1].row} onCheckedChange={(checked) => setButtonRowMode(event, button.id, checked)} />
                </div>
              )}
            </div>
          ))}
          {t.buttons.length === 0 && <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">No buttons added.</p>}
        </div>

        <div className="space-y-2">
          <Label>Message image (1024 × 512)</Label>
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
            id={`telegram-image-${event}`}
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
            onClick={() => document.getElementById(`telegram-image-${event}`)?.click()}
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
              aria-label="Back to Telegram templates"
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
          title="Crop message image"
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
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Telegram Templates</h1>
          <p className="text-sm text-muted-foreground">
            Update the title, text, button and image of every Telegram message here.
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-label="Bot settings"
          onClick={() => navigate('/owner-portal/telegram-bot-settings')}
        >
          <Settings className="w-5 h-5" />
        </Button>
      </div>

      <Tabs value={audience} onValueChange={(v) => setAudience(v as Audience)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="job_seeker">Job seekers</TabsTrigger>
          <TabsTrigger value="employer">Employers</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="space-y-6">
          {groupsForChannel('telegram', audience).map((group) => (
            <Card key={group.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Send className="w-5 h-5 text-primary" />
                  {group.label}
                </CardTitle>
                <CardDescription>{group.events.length} messages</CardDescription>
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
        title="Crop message image"
        allowOriginal
        hideHeader
      />
    </div>
  );
}
