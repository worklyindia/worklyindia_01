import { useState, useEffect } from 'react';
import { Drawer, DrawerContent, DrawerHeader } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Loader2, Copy, Check, ArrowLeftRight, Share2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNativeHaptics } from '@/hooks/useNativeHaptics';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { translationStorage } from '@/lib/translationStorage';

interface WhatsAppTranslateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageContent: string;
  messageId: string;
}

const supportedLanguages = [
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'en', name: 'English', native: 'English' },
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
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'ur', name: 'Urdu', native: 'اردو' },
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
  { code: 'tl', name: 'Tagalog', native: 'Tagalog' },
  { code: 'ms', name: 'Malay', native: 'Bahasa Melayu' },
  { code: 'sq', name: 'Albanian', native: 'Shqip' },
];

export default function WhatsAppTranslateDialog({
  open,
  onOpenChange,
  messageContent,
  messageId
}: WhatsAppTranslateDialogProps) {
  const [targetLang, setTargetLang] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [detectedLang, setDetectedLang] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { lightImpact, successHaptic } = useNativeHaptics();

  useEffect(() => {
    if (open && messageContent) {
      const detected = detectLanguage(messageContent);
      setDetectedLang(detected);
    }
  }, [open, messageContent]);

  const detectLanguage = (text: string): string => {
    const hindiPattern = /[\u0900-\u097F]/;
    const arabicPattern = /[\u0600-\u06FF]/;
    const chinesePattern = /[\u4E00-\u9FFF]/;
    const japanesePattern = /[\u3040-\u309F\u30A0-\u30FF]/;
    const koreanPattern = /[\uAC00-\uD7AF]/;
    
    if (hindiPattern.test(text)) return 'hi';
    if (arabicPattern.test(text)) return 'ar';
    if (chinesePattern.test(text)) return 'zh';
    if (japanesePattern.test(text)) return 'ja';
    if (koreanPattern.test(text)) return 'ko';
    return 'en';
  };

  const tryMyMemory = async (text: string, sourceLang: string, targetLang: string): Promise<string> => {
    console.log('[WhatsApp Translation] Trying MyMemory API:', { text: text.substring(0, 50), sourceLang, targetLang });
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    try {
      const apiUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`;
      const response = await fetch(apiUrl, { signal: controller.signal });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`MyMemory API failed with status ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.responseStatus !== 200) {
        throw new Error(data.responseDetails || 'MyMemory translation failed');
      }

      return data.responseData.translatedText;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  };

  const tryLingva = async (text: string, sourceLang: string, targetLang: string): Promise<string> => {
    console.log('[WhatsApp Translation] Trying Lingva API:', { text: text.substring(0, 50), sourceLang, targetLang });
    
    const instances = [
      'https://lingva.thedaviddelta.com',
      'https://lingva.lunar.icu',
      'https://translate.plausibility.cloud'
    ];
    
    let lastError: Error | null = null;
    
    for (const instance of instances) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      try {
        const apiUrl = `${instance}/api/v1/${sourceLang}/${targetLang}/${encodeURIComponent(text)}`;
        const response = await fetch(apiUrl, { signal: controller.signal });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          lastError = new Error(`Instance failed with status ${response.status}`);
          continue;
        }
        
        const data = await response.json();
        
        if (data.translation) {
          return data.translation;
        }
        
        lastError = new Error('No translation in response');
      } catch (error) {
        clearTimeout(timeoutId);
        lastError = error as Error;
        continue;
      }
    }
    
    throw lastError || new Error('All Lingva instances failed');
  };

  const tryLibreTranslate = async (text: string, sourceLang: string, targetLang: string): Promise<string> => {
    console.log('[WhatsApp Translation] Trying LibreTranslate API:', { text: text.substring(0, 50), sourceLang, targetLang });
    
    const servers = [
      'https://translate.argosopentech.com/translate',
      'https://translate.fedilab.app/translate',
      'https://trans.zillyhuhn.com/translate'
    ];
    
    let lastError: Error | null = null;
    
    for (const server of servers) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      try {
        const response = await fetch(server, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            q: text,
            source: sourceLang,
            target: targetLang,
            format: 'text'
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.status === 429) {
          lastError = new Error('Rate limit exceeded');
          continue;
        }
        
        if (!response.ok) {
          lastError = new Error(`Server failed with status ${response.status}`);
          continue;
        }
        
        const data = await response.json();
        
        if (data.translatedText) {
          return data.translatedText;
        }
        
        lastError = new Error('No translatedText in response');
      } catch (error) {
        clearTimeout(timeoutId);
        lastError = error as Error;
        continue;
      }
    }
    
    throw lastError || new Error('All LibreTranslate servers failed');
  };

  const handleTranslate = async (langCode: string) => {
    if (!langCode || !messageContent) return;

    setIsTranslating(true);
    setTargetLang(langCode);
    setErrorMessage(null);
    setTranslatedText(null);

    try {
      const sourceLang = detectLanguage(messageContent);
      setDetectedLang(sourceLang);

      // Check cache first
      const cached = translationStorage.getTranslation(messageContent, sourceLang, langCode);
      
      if (cached) {
        console.log('[WhatsApp Translation] ⚡ Using cached translation');
        setTranslatedText(cached.translated);
        successHaptic();
        toast.success('Translation complete');
        setIsTranslating(false);
        return;
      }

      console.log('[WhatsApp Translation] Cache miss, calling APIs...');
      let result = '';
      let lastError: Error | null = null;
      let lastApiName = '';

      const apis = [
        { name: 'MyMemory', fn: tryMyMemory },
        { name: 'Lingva', fn: tryLingva },
        { name: 'LibreTranslate', fn: tryLibreTranslate }
      ];

      for (const api of apis) {
        try {
          console.log(`[WhatsApp Translation] Attempting ${api.name} API...`);
          result = await api.fn(messageContent, sourceLang, langCode);
          console.log(`[WhatsApp Translation] ✅ ${api.name} API succeeded`);
          break;
        } catch (error) {
          console.error(`[WhatsApp Translation] ❌ ${api.name} API failed:`, error);
          lastError = error as Error;
          lastApiName = api.name;
          continue;
        }
      }

      if (!result) {
        const errorMsg = `All translation APIs failed. Last error from ${lastApiName}: ${lastError?.message || 'Unknown error'}`;
        console.error(`[WhatsApp Translation] ${errorMsg}`);
        throw new Error(errorMsg);
      }

      // Save to cache
      translationStorage.saveTranslation({
        cacheKey: translationStorage.generateCacheKey(messageContent, sourceLang, langCode),
        original: messageContent,
        translated: result,
        sourceLang,
        targetLang: langCode,
        timestamp: new Date().toISOString()
      });

      setTranslatedText(result);
      successHaptic();
      toast.success('Translation complete');
    } catch (error) {
      console.error('[WhatsApp Translation] All attempts failed:', error);
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

  const handleSwapLanguages = () => {
    if (detectedLang && targetLang) {
      lightImpact();
      handleTranslate(detectedLang);
    }
  };

  const handleClose = () => {
    setTranslatedText(null);
    setTargetLang('');
    setDetectedLang(null);
    setErrorMessage(null);
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={handleClose}>
      <DrawerContent className="max-h-[90vh] bg-background">
        {/* Google Translate Style Header */}
        <DrawerHeader className="border-b border-border/50 pb-3 pt-2">
          <div className="flex items-center justify-between gap-3 px-2">
            {/* Source Language */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 text-primary hover:bg-primary/10 font-medium"
                >
                  {detectedLang 
                    ? supportedLanguages.find(l => l.code === detectedLang)?.name || 'Detect language'
                    : 'Detect language'
                  }
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem disabled className="text-muted-foreground">
                  Auto-detected
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Swap Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSwapLanguages}
              disabled={!detectedLang || !targetLang}
              className="rounded-full hover:bg-primary/10 active:scale-95 transition-all"
            >
              <ArrowLeftRight className="h-5 w-5 text-primary" />
            </Button>

            {/* Target Language */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 text-primary hover:bg-primary/10 font-medium"
                >
                  {targetLang 
                    ? supportedLanguages.find(l => l.code === targetLang)?.name 
                    : 'Select language'
                  }
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 max-h-80 overflow-y-auto">
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
        </DrawerHeader>

        {/* Two-Panel Layout */}
        <ScrollArea className="flex-1 max-h-[60vh] overflow-y-auto">
          <div className="divide-y divide-border/50">
            {/* Original Message */}
            <div className="p-4 bg-muted/30">
              <div className="flex items-start justify-between gap-2">
                <p className="text-foreground leading-relaxed flex-1">
                  {messageContent}
                </p>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-background/50"
                    onClick={() => handleCopy(messageContent, 'original')}
                  >
                    {copiedId === 'original' ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-background/50"
                    onClick={() => handleShare(messageContent)}
                  >
                    <Share2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Translated Panel */}
            <div className="p-4 min-h-[100px]">
              {isTranslating ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="ml-2 text-muted-foreground">Translating...</span>
                </div>
              ) : errorMessage ? (
                <div className="text-center py-6">
                  <p className="text-destructive text-sm mb-3">{errorMessage}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetry}
                    className="text-primary border-primary hover:bg-primary/10"
                  >
                    Try Again
                  </Button>
                </div>
              ) : translatedText ? (
                <div className="flex items-start justify-between gap-2">
                  <p className="text-primary leading-relaxed flex-1 font-medium">
                    {translatedText}
                  </p>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:bg-primary/10"
                      onClick={() => handleCopy(translatedText, 'translated')}
                    >
                      {copiedId === 'translated' ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4 text-primary" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:bg-primary/10"
                      onClick={() => handleShare(translatedText)}
                    >
                      <Share2 className="h-4 w-4 text-primary" />
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  Select a language to translate
                </p>
              )}
            </div>
          </div>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
}
