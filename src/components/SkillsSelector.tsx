import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { SKILLS_CATEGORIES, ALL_SKILLS } from "@/constants/categories";
import AIFieldButton from "@/components/AIFieldButton";

interface SkillsSelectorProps {
  selectedSkills: string[];
  onSkillsChange: (skills: string[]) => void;
  required?: boolean;
  onAIGenerate?: () => Promise<void>;
  aiDisabled?: boolean;
  aiDisabledReason?: string;
  aiRemainingCredits?: number;
  aiIsLimitReached?: boolean;
}

// Skills categories are now imported from centralized constants

const SkillsSelector = ({ selectedSkills, onSkillsChange, required = false, onAIGenerate, aiDisabled = false, aiDisabledReason, aiRemainingCredits, aiIsLimitReached = false }: SkillsSelectorProps) => {
  const [customSkill, setCustomSkill] = useState("");
  const [selectedPredefSkill, setSelectedPredefSkill] = useState("");

  const addSkillFromDropdown = () => {
    if (selectedPredefSkill && !selectedSkills.includes(selectedPredefSkill)) {
      onSkillsChange([...selectedSkills, selectedPredefSkill]);
      setSelectedPredefSkill("");
    }
  };

  const addCustomSkill = () => {
    if (customSkill.trim() && !selectedSkills.includes(customSkill.trim())) {
      onSkillsChange([...selectedSkills, customSkill.trim()]);
      setCustomSkill("");
    }
  };

  const removeSkill = (skillToRemove: string) => {
    onSkillsChange(selectedSkills.filter(skill => skill !== skillToRemove));
  };

  const availableSkills = ALL_SKILLS.filter(skill => !selectedSkills.includes(skill));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label htmlFor="skills">Required Skills {required && "*"}</Label>
        {onAIGenerate && (
          <AIFieldButton 
            onClick={onAIGenerate} 
            tooltip="Suggest skills with AI"
            disabled={aiDisabled}
            disabledReason={aiDisabledReason}
            remainingCredits={aiRemainingCredits}
            isLimitReached={aiIsLimitReached}
          />
        )}
      </div>
      
      {/* Category-based Skills Selection */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Select by Category</Label>
        <Select value={selectedPredefSkill} onValueChange={setSelectedPredefSkill}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose from categorized skills" />
          </SelectTrigger>
          <SelectContent className="max-h-80">
            {Object.entries(SKILLS_CATEGORIES).map(([category, skills]) => (
              <div key={category}>
                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted/50 sticky top-0">
                  {category}
                </div>
                {skills.filter(skill => !selectedSkills.includes(skill)).map((skill) => (
                  <SelectItem key={skill} value={skill} className="pl-4">
                    {skill}
                  </SelectItem>
                ))}
              </div>
            ))}
          </SelectContent>
        </Select>
        <Button 
          type="button" 
          onClick={addSkillFromDropdown} 
          variant="outline"
          disabled={!selectedPredefSkill}
          className="w-full"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Selected Skill
        </Button>
      </div>

      {/* Custom Skill Input */}
      <div className="flex gap-2">
        <Input
          placeholder="Or add a custom skill"
          value={customSkill}
          onChange={(e) => setCustomSkill(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomSkill())}
          className="flex-1"
        />
        <Button 
          type="button" 
          onClick={addCustomSkill} 
          variant="outline"
          disabled={!customSkill.trim()}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Selected Skills */}
      {selectedSkills.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg">
          {selectedSkills.map((skill) => (
            <Badge key={skill} variant="secondary" className="text-sm">
              {skill}
              <button
                type="button"
                onClick={() => removeSkill(skill)}
                className="ml-2 hover:text-destructive transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      
      {required && selectedSkills.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Please add at least one required skill for this position.
        </p>
      )}
    </div>
  );
};

export default SkillsSelector;
