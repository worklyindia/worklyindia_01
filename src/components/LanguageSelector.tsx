import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { X, ChevronDown, ChevronUp } from "lucide-react";

interface LanguageSelectorProps {
  selectedLanguages: string[];
  onLanguageToggle: (language: string) => void;
}

const AVAILABLE_LANGUAGES = [
  // Major Indian Languages
  { code: 'hindi', label: 'Hindi' },
  { code: 'english', label: 'English' },
  { code: 'gujarati', label: 'Gujarati' },
  { code: 'bengali', label: 'Bengali' },
  { code: 'telugu', label: 'Telugu' },
  { code: 'marathi', label: 'Marathi' },
  { code: 'tamil', label: 'Tamil' },
  { code: 'urdu', label: 'Urdu' },
  { code: 'kannada', label: 'Kannada' },
  { code: 'odia', label: 'Odia' },
  { code: 'malayalam', label: 'Malayalam' },
  { code: 'punjabi', label: 'Punjabi' },
  { code: 'assamese', label: 'Assamese' },
  { code: 'sanskrit', label: 'Sanskrit' },
  { code: 'konkani', label: 'Konkani' },
  { code: 'sindhi', label: 'Sindhi' },
  { code: 'nepali', label: 'Nepali' },
  // International Languages
  { code: 'spanish', label: 'Spanish' },
  { code: 'french', label: 'French' },
  { code: 'german', label: 'German' },
  { code: 'chinese', label: 'Chinese' },
  { code: 'japanese', label: 'Japanese' },
  { code: 'korean', label: 'Korean' },
  { code: 'arabic', label: 'Arabic' },
  { code: 'portuguese', label: 'Portuguese' },
  { code: 'russian', label: 'Russian' },
  { code: 'italian', label: 'Italian' },
  { code: 'dutch', label: 'Dutch' },
  { code: 'turkish', label: 'Turkish' },
  { code: 'indonesian', label: 'Indonesian' },
  { code: 'thai', label: 'Thai' },
  { code: 'vietnamese', label: 'Vietnamese' }
];

const LanguageSelector = ({ selectedLanguages, onLanguageToggle }: LanguageSelectorProps) => {
  const [visibleCount, setVisibleCount] = useState(4);
  const isSelected = (language: string) => selectedLanguages.includes(language);
  
  const visibleLanguages = AVAILABLE_LANGUAGES.slice(0, visibleCount);
  const hasMore = visibleCount < AVAILABLE_LANGUAGES.length;
  const canShowLess = visibleCount > 4;

  const showMore = () => {
    setVisibleCount(prev => Math.min(prev + 4, AVAILABLE_LANGUAGES.length));
  };

  const showLess = () => {
    setVisibleCount(4);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Required Languages *</Label>
        {selectedLanguages.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {selectedLanguages.length} selected
          </span>
        )}
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
        {visibleLanguages.map((language) => (
          <Button
            key={language.code}
            type="button"
            size="sm"
            variant={isSelected(language.code) ? "default" : "outline"}
            onClick={() => onLanguageToggle(language.code)}
            className="rounded-lg text-xs sm:text-sm h-9 w-full justify-center"
          >
            {language.label}
          </Button>
        ))}
      </div>
      
      {(hasMore || canShowLess) && (
        <div className="flex gap-2 justify-center pt-2">
          {hasMore && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={showMore}
              className="text-primary hover:text-primary/80"
            >
              <ChevronDown className="w-4 h-4 mr-1" />
              Show More ({AVAILABLE_LANGUAGES.length - visibleCount} more)
            </Button>
          )}
          {canShowLess && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={showLess}
              className="text-muted-foreground hover:text-foreground"
            >
              <ChevronUp className="w-4 h-4 mr-1" />
              Show Less
            </Button>
          )}
        </div>
      )}
      
      {selectedLanguages.length > 0 && (
        <div className="space-y-2 pt-2">
          <Label className="text-sm">Selected Languages:</Label>
          <div className="flex flex-wrap gap-2">
            {selectedLanguages.map((lang) => {
              const language = AVAILABLE_LANGUAGES.find(l => l.code === lang);
              return (
                <Badge key={lang} variant="secondary" className="px-3 py-1.5 text-sm">
                  {language?.label}
                  <button
                    type="button"
                    onClick={() => onLanguageToggle(lang)}
                    className="ml-2 hover:text-destructive transition-colors"
                    aria-label={`Remove ${language?.label}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;