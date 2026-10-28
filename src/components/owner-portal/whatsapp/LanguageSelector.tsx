import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { X, Plus, Check } from "lucide-react";
import { useState } from "react";

export interface Language {
  code: string;
  name: string;
}

const LANGUAGES: Language[] = [
  { code: "en", name: "English" },
  { code: "en_US", name: "English (US)" },
  { code: "en_GB", name: "English (UK)" },
  { code: "hi", name: "Hindi" },
  { code: "bn", name: "Bengali" },
  { code: "te", name: "Telugu" },
  { code: "mr", name: "Marathi" },
  { code: "ta", name: "Tamil" },
  { code: "gu", name: "Gujarati" },
  { code: "kn", name: "Kannada" },
  { code: "ml", name: "Malayalam" },
  { code: "pa", name: "Punjabi" },
  { code: "or", name: "Odia" },
  { code: "as", name: "Assamese" },
  { code: "ur", name: "Urdu" },
  { code: "ar", name: "Arabic" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "pt_BR", name: "Portuguese (BR)" },
  { code: "zh_CN", name: "Chinese (Simplified)" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "ru", name: "Russian" },
];

interface LanguageSelectorProps {
  value: string;
  onChange: (value: string) => void;
  multiple?: boolean;
  selectedLanguages?: string[];
  onMultipleChange?: (languages: string[]) => void;
}

export function LanguageSelector({ 
  value, 
  onChange, 
  multiple = false,
  selectedLanguages = [],
  onMultipleChange
}: LanguageSelectorProps) {
  const [open, setOpen] = useState(false);

  const getLanguageName = (code: string) => {
    return LANGUAGES.find(l => l.code === code)?.name || code;
  };

  if (multiple && onMultipleChange) {
    const toggleLanguage = (code: string) => {
      if (selectedLanguages.includes(code)) {
        onMultipleChange(selectedLanguages.filter(l => l !== code));
      } else {
        onMultipleChange([...selectedLanguages, code]);
      }
    };

    const removeLanguage = (code: string) => {
      onMultipleChange(selectedLanguages.filter(l => l !== code));
    };

    return (
      <div className="space-y-2">
        {/* Selected Languages as Chips */}
        {selectedLanguages.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {selectedLanguages.map((code) => (
              <Badge key={code} variant="secondary" className="gap-1 pr-1">
                {getLanguageName(code)}
                <button
                  type="button"
                  onClick={() => removeLanguage(code)}
                  className="ml-1 hover:bg-muted rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Add Language Button */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="w-full border-dashed">
              <Plus className="h-4 w-4 mr-2" />
              Add Language
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[250px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search language..." />
              <CommandList>
                <CommandEmpty>No language found.</CommandEmpty>
                <CommandGroup className="max-h-[200px] overflow-y-auto">
                  {LANGUAGES.map((lang) => {
                    const isSelected = selectedLanguages.includes(lang.code);
                    return (
                      <CommandItem
                        key={lang.code}
                        value={lang.name}
                        onSelect={() => {
                          toggleLanguage(lang.code);
                        }}
                      >
                        <Check
                          className={`mr-2 h-4 w-4 ${isSelected ? "opacity-100" : "opacity-0"}`}
                        />
                        {lang.name}
                        <span className="ml-auto text-xs text-muted-foreground">{lang.code}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  // Single selection mode
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          {getLanguageName(value)}
          <span className="text-xs text-muted-foreground ml-2">{value}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search language..." />
          <CommandList>
            <CommandEmpty>No language found.</CommandEmpty>
            <CommandGroup className="max-h-[200px] overflow-y-auto">
              {LANGUAGES.map((lang) => (
                <CommandItem
                  key={lang.code}
                  value={lang.name}
                  onSelect={() => {
                    onChange(lang.code);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={`mr-2 h-4 w-4 ${value === lang.code ? "opacity-100" : "opacity-0"}`}
                  />
                  {lang.name}
                  <span className="ml-auto text-xs text-muted-foreground">{lang.code}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
