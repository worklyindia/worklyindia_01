import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, X, Briefcase } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface ProfessionalExperience {
  id?: string;
  position: string;
  company: string;
  experience_years: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  description: string;
}

interface MultipleExperienceInputProps {
  experiences: ProfessionalExperience[];
  onChange: (experiences: ProfessionalExperience[]) => void;
}

const MultipleExperienceInput: React.FC<MultipleExperienceInputProps> = ({
  experiences,
  onChange
}) => {
  const addExperience = () => {
    const newExperience: ProfessionalExperience = {
      position: '',
      company: '',
      experience_years: '',
      start_date: '',
      end_date: '',
      is_current: false,
      description: ''
    };
    onChange([...experiences, newExperience]);
  };

  const removeExperience = (index: number) => {
    const updatedExperiences = experiences.filter((_, i) => i !== index);
    onChange(updatedExperiences);
  };

  const updateExperience = (index: number, field: keyof ProfessionalExperience, value: any) => {
    const updatedExperiences = experiences.map((exp, i) => 
      i === index ? { ...exp, [field]: value } : exp
    );
    onChange(updatedExperiences);
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <Briefcase className="mx-auto w-12 h-12 text-primary mb-2" />
        <h3 className="text-lg font-semibold">Professional Details</h3>
        <p className="text-muted-foreground">Add your work experiences</p>
      </div>

      {experiences.map((experience, index) => (
        <Card key={index} className="relative">
          <CardContent className="pt-6">
            {experiences.length > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="absolute top-2 right-2 h-8 w-8 p-0"
                onClick={() => removeExperience(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Position *</Label>
                  <Input
                    value={experience.position}
                    onChange={(e) => updateExperience(index, 'position', e.target.value)}
                    placeholder="e.g., Senior Frontend Developer"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Company *</Label>
                  <Input
                    value={experience.company}
                    onChange={(e) => updateExperience(index, 'company', e.target.value)}
                    placeholder="Company name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Years of Experience *</Label>
                <Select 
                  value={experience.experience_years} 
                  onValueChange={(value) => updateExperience(index, 'experience_years', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select experience" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Fresher</SelectItem>
                    <SelectItem value="1">1 Year</SelectItem>
                    <SelectItem value="2">2 Years</SelectItem>
                    <SelectItem value="3">3 Years</SelectItem>
                    <SelectItem value="4">4 Years</SelectItem>
                    <SelectItem value="5">5 Years</SelectItem>
                    <SelectItem value="6">6+ Years</SelectItem>
                    <SelectItem value="10">10+ Years</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={experience.start_date}
                    onChange={(e) => updateExperience(index, 'start_date', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={experience.end_date}
                    onChange={(e) => updateExperience(index, 'end_date', e.target.value)}
                    disabled={experience.is_current}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={experience.description}
                  onChange={(e) => updateExperience(index, 'description', e.target.value)}
                  placeholder="Brief description of your role and achievements..."
                  rows={3}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={addExperience}
        className="w-full"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add Another Experience
      </Button>
    </div>
  );
};

export default MultipleExperienceInput;