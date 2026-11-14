import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Copy, Check, ArrowLeftRight, Share2, ChevronDown, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { detectStatusLang } from '@/lib/instantStatus';

import { useNativeHaptics } from '@/hooks/useNativeHaptics';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { translationStorage } from '@/lib/translationStorage';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface Translation {
  id: string;
  original: string;
  translated: string;
  sourceLang: string;
  targetLang: string;
  fromCache?: boolean;
}

interface TranslationBottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: Message[];
  selectedMessageIds: string[];
  onTranslate: (translations: Translation[]) => void;
}

// LibreTranslate officially supported languages
// Source: https://libretranslate.com/languages
const supportedLanguages = [
  // ===== India — all scheduled + widely spoken languages =====
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'en', name: 'English', native: 'English' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'or', name: 'Odia', native: 'ଓଡ଼ିଆ' },
  { code: 'as', name: 'Assamese', native: 'অসমীয়া' },
  { code: 'ur', name: 'Urdu', native: 'اردو' },
  { code: 'sa', name: 'Sanskrit', native: 'संस्कृतम्' },
  { code: 'ne', name: 'Nepali', native: 'नेपाली' },
  { code: 'sd', name: 'Sindhi', native: 'سنڌي' },
  { code: 'ks', name: 'Kashmiri', native: 'کٲشُر' },
  { code: 'kok', name: 'Konkani', native: 'कोंकणी' },
  { code: 'mai', name: 'Maithili', native: 'मैथिली' },
  { code: 'doi', name: 'Dogri', native: 'डोगरी' },
  { code: 'brx', name: 'Bodo', native: 'बड़ो' },
  { code: 'mni', name: 'Manipuri', native: 'ꯃꯤꯇꯩꯂꯣꯟ' },
  { code: 'sat', name: 'Santali', native: 'ᱥᱟᱱᱛᱟᱲᱤ' },
  { code: 'bho', name: 'Bhojpuri', native: 'भोजपुरी' },
  { code: 'mag', name: 'Magahi', native: 'मगही' },
  { code: 'awa', name: 'Awadhi', native: 'अवधी' },
  { code: 'hne', name: 'Chhattisgarhi', native: 'छत्तीसगढ़ी' },
  { code: 'raj', name: 'Rajasthani', native: 'राजस्थानी' },
  { code: 'mwr', name: 'Marwari', native: 'मारवाड़ी' },
  { code: 'bgc', name: 'Haryanvi', native: 'हरियाणवी' },
  { code: 'tcy', name: 'Tulu', native: 'ತುಳು' },
  { code: 'kha', name: 'Khasi', native: 'Khasi' },
  { code: 'lus', name: 'Mizo', native: 'Mizo ṭawng' },

  // ===== World languages =====
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'de', name: 'German', native: 'Deutsch' },
  { code: 'zh', name: 'Chinese', native: '中文' },
  { code: 'ar', name: 'Arabic', native: 'العربية' },
  { code: 'pt', name: 'Portuguese', native: 'Português' },
  { code: 'ru', name: 'Russian', native: 'Русский' },
  { code: 'ja', name: 'Japanese', native: '日本語' },
  { code: 'ko', name: 'Korean', native: '한국어' },
  { code: 'it', name: 'Italian', native: 'Italiano' },
  { code: 'nl', name: 'Dutch', native: 'Nederlands' },
  { code: 'pl', name: 'Polish', native: 'Polski' },
  { code: 'tr', name: 'Turkish', native: 'Türkçe' },
  { code: 'uk', name: 'Ukrainian', native: 'Українська' },
  { code: 'th', name: 'Thai', native: 'ไทย' },
  { code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia' },
  { code: 'vi', name: 'Vietnamese', native: 'Tiếng Việt' },
  { code: 'fa', name: 'Persian', native: 'فارسی' },
  { code: 'he', name: 'Hebrew', native: 'עברית' },
  { code: 'el', name: 'Greek', native: 'Ελληνικά' },
  { code: 'sv', name: 'Swedish', native: 'Svenska' },
  { code: 'cs', name: 'Czech', native: 'Čeština' },
  { code: 'ro', name: 'Romanian', native: 'Română' },
  { code: 'hu', name: 'Hungarian', native: 'Magyar' },
  { code: 'fi', name: 'Finnish', native: 'Suomi' },
  { code: 'da', name: 'Danish', native: 'Dansk' },
  { code: 'sk', name: 'Slovak', native: 'Slovenčina' },
  { code: 'bg', name: 'Bulgarian', native: 'Български' },
  { code: 'ms', name: 'Malay', native: 'Bahasa Melayu' },
  { code: 'tl', name: 'Tagalog', native: 'Tagalog' },
  { code: 'sw', name: 'Swahili', native: 'Kiswahili' },
  { code: 'si', name: 'Sinhala', native: 'සිංහල' },
  { code: 'my', name: 'Burmese', native: 'မြန်မာ' },
];

export default function TranslationBottomSheet({
  open,
  onOpenChange,
  messages,
  selectedMessageIds,
  onTranslate
}: TranslationBottomSheetProps) {
  const [targetLang, setTargetLang] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [detectedLang, setDetectedLang] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Editable buffers: message id -> text
  const [editedTexts, setEditedTexts] = useState<Record<string, string>>({});
  const [editedTranslations, setEditedTranslations] = useState<Record<string, string>>({});
  // AI spelling suggestions: message id -> corrected source text
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const { lightImpact, successHaptic } = useNativeHaptics();

  const selectedMessages = messages.filter(msg => selectedMessageIds.includes(msg.id));

  const textOf = (msg: Message) => editedTexts[msg.id] ?? msg.content;
  const firstText = selectedMessages[0] ? textOf(selectedMessages[0]) : '';

  // Instant client-side detection (script + romanized/Hinglish heuristics)
  const localDetect = (text: string): string | null => {
    if (!text || !text.trim()) return null;
    const lang = detectStatusLang(text);
    return lang === 'hinglish' ? 'hi-Latn' : lang;
  };

  const langLabel = (code: string | null | undefined): string => {
    if (!code) return 'Detecting…';
    if (code === 'hi-Latn') return 'Hindi (Romanized)';
    return supportedLanguages.find(l => l.code === code)?.name || code;
  };

  // Instant local guess, then AI-verified detection (handles romanized
  // Gujarati/Marathi/Tamil etc., not just Hinglish)
  const [aiSourceLabel, setAiSourceLabel] = useState<string | null>(null);

  // Only guess once the user has typed enough for a language to be
  // identifiable — short fragments produce wrong labels.
  const isDetectable = (text: string) => {
    const t = (text || '').trim();
    return t.length >= 12 || t.split(/\s+/).filter(Boolean).length >= 3;
  };

  useEffect(() => {
    if (!open) return;
    setDetectedLang(isDetectable(firstText) ? localDetect(firstText) : null);
  }, [open, firstText]);

  useEffect(() => {
    if (!open || !isDetectable(firstText)) {
      setAiSourceLabel(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('ai-career-chat/translate', {
          body: { text: firstText, mode: 'detect' },
        });
        if (cancelled || error || !data?.languageLabel) return;
        setAiSourceLabel(data.languageLabel as string);
        const firstId = selectedMessages[0]?.id;
        if (firstId) {
          setCorrections(prev => {
            const next = { ...prev };
            if (data.hasCorrection && data.correctedText) {
              next[firstId] = data.correctedText as string;
            } else {
              delete next[firstId];
            }
            return next;
          });
        }
      } catch (_) {
        /* keep local label */
      }
    }, 900);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [open, firstText]);

  // Lock background scroll while the full page translator is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Re-translate automatically (debounced) after the user edits the source text
  useEffect(() => {
    if (!open || !targetLang) return;
    const texts = selectedMessages.map(textOf).join('\u0000');
    const timer = setTimeout(() => {
      const hasText = selectedMessages.some(m => textOf(m).trim());
      if (hasText) handleTranslate(targetLang);
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editedTexts, open]);

  // Lightweight script hint used as a fallback label
  const scriptHint = (text: string): string => localDetect(text) === 'hi-Latn' ? 'hi' : (localDetect(text) || 'en');

  // AI translation + AI language detection (Lovable AI gateway via edge function)
  const tryAI = async (
    text: string,
    langCode: string,
  ): Promise<{ translated: string; detected: string; corrected?: string }> => {
    const { data, error } = await supabase.functions.invoke('ai-career-chat/translate', {
      body: { text, sourceLang: 'auto', targetLang: langCode },
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    if (!data?.translatedText) throw new Error('Empty AI translation');
    if (data.languageLabel) setAiSourceLabel(data.languageLabel as string);
    return {
      translated: data.translatedText as string,
      corrected: data.hasCorrection ? (data.correctedText as string) : undefined,
      detected: (data.detectedLanguage && data.detectedLanguage !== 'auto')
        ? (data.detectedLanguage as string)
        : scriptHint(text),
    };
  };

  const handleTranslate = async (langCode: string) => {
    if (!langCode) return;

    setIsTranslating(true);
    setTargetLang(langCode);
    setErrorMessage(null);
    setTranslations([]);
    setEditedTranslations({});
    const results: Translation[] = [];

    try {
      for (const msg of selectedMessages) {
        const content = textOf(msg);
        if (!content.trim()) continue;
        let detectedSource = scriptHint(content);
        const cacheSourceKey = detectedSource;

        const cached = translationStorage.getTranslation(content, cacheSourceKey, langCode);

        if (cached) {
          results.push({
            id: msg.id,
            original: content,
            translated: cached.translated,
            sourceLang: cached.sourceLang,
            targetLang: cached.targetLang,
            fromCache: true
          });
          continue;
        }

        const ai = await tryAI(content, langCode);
        const translatedText = ai.translated;
        detectedSource = ai.detected;
        setCorrections(prev => {
          const next = { ...prev };
          if (ai.corrected && ai.corrected.trim() !== content.trim()) next[msg.id] = ai.corrected;
          else delete next[msg.id];
          return next;
        });

        translationStorage.saveTranslation({
          cacheKey: translationStorage.generateCacheKey(content, cacheSourceKey, langCode),
          original: content,
          translated: translatedText,
          sourceLang: detectedSource,
          targetLang: langCode,
          timestamp: new Date().toISOString()
        });

        results.push({
          id: msg.id,
          original: content,
          translated: translatedText,
          sourceLang: detectedSource,
          targetLang: langCode,
          fromCache: false
        });
      }

      setTranslations(results);
      onTranslate(results);
      successHaptic();
    } catch (error) {
      console.error('[Translation] All attempts failed:', error);
      const errorMsg = error instanceof Error ? error.message : 'Translation failed';
      setErrorMessage(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleRetry = () => {
    if (targetLang) {
      setErrorMessage(null);
      handleTranslate(targetLang);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    lightImpact();
    toast.success('Copied!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleShare = async (text: string) => {
    if (navigator.share) {
      try {
        await navigator.share({ text });
        successHaptic();
        toast.success('Shared successfully!');
      } catch (error) {
        console.log('Share cancelled');
      }
    } else {
      handleCopy(text, 'share');
    }
  };

  const handleClose = () => {
    setTranslations([]);
    setTargetLang('');
    setDetectedLang(null);
    setErrorMessage(null);
    setEditedTexts({});
    setEditedTranslations({});
    setCorrections({});
    onOpenChange(false);
  };

  if (!open) return null;

  const sourceLabel = aiSourceLabel ?? langLabel(detectedLang);

  return (
    <div className="fixed inset-0 z-50 bg-background animate-fade-in">
      <div
        className="flex h-[100dvh] w-full flex-col"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Full page header */}
        <div className="shrink-0 border-b border-border/50 bg-background">
          <div className="flex items-center gap-2 px-2 py-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              aria-label="Close translation"
              className="rounded-full shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-base font-semibold truncate">Translate</h1>
          </div>

          <div className="flex items-center justify-between gap-1 px-2 pb-2">
            {/* Source language — auto-detected, not selectable */}
            <div className="flex-1 min-w-0 flex items-center justify-center gap-1 px-2 py-2 text-primary font-medium">
              <span className="truncate text-sm">{sourceLabel}</span>
            </div>

            <ArrowLeftRight className="h-5 w-5 shrink-0 text-muted-foreground" />

            {/* Target Language */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex-1 min-w-0 justify-center gap-1 px-2 text-primary hover:bg-primary/10 font-medium"
                >
                  <span className="truncate text-sm">
                    {targetLang
                      ? supportedLanguages.find(l => l.code === targetLang)?.name
                      : 'Select language'}
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 max-h-[60vh] overflow-y-auto">
                {supportedLanguages.map((lang) => (
                  <DropdownMenuItem
                    key={lang.code}
                    onClick={() => {
                      lightImpact();
                      handleTranslate(lang.code);
                    }}
                    className="cursor-pointer"
                  >
                    <span className="mr-2">{lang.native}</span>
                    <span className="text-muted-foreground text-xs">{lang.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Two-Panel Layout */}
        <ScrollArea className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <div className="divide-y divide-border/50">
            {selectedMessages.map((msg, msgIndex) => {
              const translation = translations.find(t => t.id === msg.id);
              const originalText = textOf(msg);
              const translatedText = translation
                ? (editedTranslations[msg.id] ?? translation.translated)
                : '';

              return (
                <div key={msg.id} className="p-4 space-y-3 touch-manipulation">
                  {/* Original Text Panel — editable */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {sourceLabel}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(originalText, `src-${msg.id}`)}
                          className="h-8 w-8 p-0 hover:bg-primary/10"
                          aria-label="Copy original text"
                        >
                          {copiedId === `src-${msg.id}` ? (
                            <Check className="h-4 w-4 text-primary" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleShare(originalText)}
                          className="h-8 w-8 p-0 hover:bg-primary/10"
                          aria-label="Share original text"
                        >
                          <Share2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <Textarea
                      value={originalText}
                      onChange={(e) =>
                        setEditedTexts(prev => ({ ...prev, [msg.id]: e.target.value }))
                      }
                      placeholder="Type or paste text…"
                      className="min-h-[96px] resize-y bg-muted/30 border-border/50 leading-relaxed text-base"
                    />
                    {corrections[msg.id] && corrections[msg.id].trim() !== originalText.trim() && (
                      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 space-y-1.5">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
                          Spelling suggestion
                        </p>
                        <p className="text-sm leading-relaxed">{corrections[msg.id]}</p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 text-xs"
                            onClick={() => {
                              lightImpact();
                              setEditedTexts(prev => ({ ...prev, [msg.id]: corrections[msg.id] }));
                              setCorrections(prev => {
                                const next = { ...prev };
                                delete next[msg.id];
                                return next;
                              });
                            }}
                          >
                            Fix &amp; translate
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() =>
                              setCorrections(prev => {
                                const next = { ...prev };
                                delete next[msg.id];
                                return next;
                              })
                            }
                          >
                            Ignore
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Translation Panel — editable */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-primary uppercase tracking-wide">
                          {targetLang
                            ? supportedLanguages.find(l => l.code === targetLang)?.name
                            : 'Translation'}
                        </span>
                        {translation?.fromCache && (
                          <span className="text-xs bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">
                            ⚡ Cached
                          </span>
                        )}
                      </div>
                      {translation && (
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopy(translatedText, translation.id)}
                            className="h-8 gap-2 hover:bg-primary/10"
                          >
                            {copiedId === translation.id ? (
                              <Check className="h-4 w-4 text-primary" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleShare(translatedText)}
                            className="h-8 gap-2 hover:bg-primary/10"
                          >
                            <Share2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="rounded-lg bg-primary/5 border border-primary/20 min-h-[80px] flex items-center">
                      {isTranslating && !translation ? (
                        <div className="flex items-center gap-3 text-muted-foreground p-4">
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                          <span className="text-sm">Translating...</span>
                        </div>
                      ) : errorMessage ? (
                        <div className="flex flex-col gap-2 w-full p-4">
                          <p className="text-destructive text-sm">{errorMessage}</p>
                          <Button onClick={handleRetry} size="sm" variant="outline" className="w-fit">
                            Retry
                          </Button>
                        </div>
                      ) : translation ? (
                        <Textarea
                          value={translatedText}
                          onChange={(e) =>
                            setEditedTranslations(prev => ({ ...prev, [msg.id]: e.target.value }))
                          }
                          className="min-h-[96px] resize-y border-0 bg-transparent focus-visible:ring-0 leading-relaxed text-base"
                        />
                      ) : (
                        <p className="text-muted-foreground text-sm p-4">
                          Select a language to translate
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
