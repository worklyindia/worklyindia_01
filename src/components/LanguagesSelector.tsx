import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Languages, Plus, X } from 'lucide-react';

interface Language {
  name: string;
  proficiency: string;
}

interface LanguagesSelectorProps {
  languages: string[];
  onChange: (languages: string[]) => void;
}

const LanguagesSelector: React.FC<LanguagesSelectorProps> = ({
  languages,
  onChange
}) => {
  const [newLanguage, setNewLanguage] = useState('');
  const [proficiency, setProficiency] = useState('');

  const commonLanguages = [
    // Major Indian Languages
    'Hindi', 'English', 'Gujarati', 'Bengali', 'Telugu', 'Marathi', 'Tamil', 
    'Urdu', 'Kannada', 'Odia', 'Malayalam', 'Punjabi', 'Assamese', 'Sanskrit',
    'Konkani', 'Sindhi', 'Nepali',
    // International Languages
    'Spanish', 'French', 'German', 'Chinese', 'Japanese', 'Korean', 'Arabic',
    'Portuguese', 'Russian', 'Italian', 'Dutch', 'Turkish', 'Indonesian', 
    'Thai', 'Vietnamese'
  ];

  const proficiencyLevels = [
    { value: 'native', label: 'Native' },
    { value: 'fluent', label: 'Fluent' },
    { value: 'advanced', label: 'Advanced' },
    { value: 'intermediate', label: 'Intermediate' },
    { value: 'beginner', label: 'Beginner' }
  ];

  const addLanguage = () => {
    if (newLanguage.trim() && proficiency) {
      const languageString = `${newLanguage.trim()} - ${proficiency}`;
      if (!languages.includes(languageString)) {
        onChange([...languages, languageString]);
        setNewLanguage('');
        setProficiency('');
      }
    }
  };

  const removeLanguage = (languageToRemove: string) => {
    onChange(languages.filter(lang => lang !== languageToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addLanguage();
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <Languages className="mx-auto w-12 h-12 text-primary mb-2" />
        <h3 className="text-lg font-semibold">Languages</h3>
        <p className="text-muted-foreground">Add languages you can speak</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label>Language</Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={newLanguage}
                    onChange={(e) => setNewLanguage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type or select language..."
                    list="common-languages"
                    className="flex-1"
                  />
                  <datalist id="common-languages">
                    {commonLanguages.map((lang) => (
                      <option key={lang} value={lang} />
                    ))}
                  </datalist>
                  <Select value={proficiency} onValueChange={setProficiency}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Proficiency" />
                    </SelectTrigger>
                    <SelectContent>
                      {proficiencyLevels.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          {level.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Button
              type="button"
              onClick={addLanguage}
              disabled={!newLanguage.trim() || !proficiency}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Language
            </Button>
          </div>
        </CardContent>
      </Card>

      {languages.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <Label>Your Languages</Label>
              <div className="flex flex-wrap gap-2">
                {languages.map((language, index) => (
                  <Badge key={index} variant="secondary" className="text-sm">
                    {language}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto p-1 ml-2"
                      onClick={() => removeLanguage(language)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LanguagesSelector;