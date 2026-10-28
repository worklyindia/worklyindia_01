import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Plus, X, GraduationCap } from 'lucide-react';

interface EducationEntry {
  id?: string;
  degree: string;
  institution: string;
  field_of_study: string;
  start_year: string;
  end_year: string;
  grade: string;
  description: string;
}

interface MultipleEducationInputProps {
  educationEntries: EducationEntry[];
  onChange: (entries: EducationEntry[]) => void;
  bio: string;
  onBioChange: (bio: string) => void;
}

const MultipleEducationInput: React.FC<MultipleEducationInputProps> = ({
  educationEntries,
  onChange,
  bio,
  onBioChange
}) => {
  const addEducation = () => {
    const newEducation: EducationEntry = {
      degree: '',
      institution: '',
      field_of_study: '',
      start_year: '',
      end_year: '',
      grade: '',
      description: ''
    };
    onChange([...educationEntries, newEducation]);
  };

  const removeEducation = (index: number) => {
    const updatedEducation = educationEntries.filter((_, i) => i !== index);
    onChange(updatedEducation);
  };

  const updateEducation = (index: number, field: keyof EducationEntry, value: string) => {
    const updatedEducation = educationEntries.map((edu, i) => 
      i === index ? { ...edu, [field]: value } : edu
    );
    onChange(updatedEducation);
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 50 }, (_, i) => currentYear - i);

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <GraduationCap className="mx-auto w-12 h-12 text-primary mb-2" />
        <h3 className="text-lg font-semibold">Education & Bio</h3>
        <p className="text-muted-foreground">Add your educational background</p>
      </div>

      {educationEntries.map((education, index) => (
        <Card key={index} className="relative">
          <CardContent className="pt-6">
            {educationEntries.length > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="absolute top-2 right-2 h-8 w-8 p-0"
                onClick={() => removeEducation(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Degree *</Label>
                  <Input
                    value={education.degree}
                    onChange={(e) => updateEducation(index, 'degree', e.target.value)}
                    placeholder="e.g., Bachelor of Technology"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Institution *</Label>
                  <Input
                    value={education.institution}
                    onChange={(e) => updateEducation(index, 'institution', e.target.value)}
                    placeholder="e.g., University of Delhi"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Field of Study</Label>
                <Input
                  value={education.field_of_study}
                  onChange={(e) => updateEducation(index, 'field_of_study', e.target.value)}
                  placeholder="e.g., Computer Science"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Start Year</Label>
                  <Input
                    type="number"
                    value={education.start_year}
                    onChange={(e) => updateEducation(index, 'start_year', e.target.value)}
                    placeholder="2018"
                    min="1950"
                    max={currentYear.toString()}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>End Year</Label>
                  <Input
                    type="number"
                    value={education.end_year}
                    onChange={(e) => updateEducation(index, 'end_year', e.target.value)}
                    placeholder="2022"
                    min="1950"
                    max={(currentYear + 10).toString()}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Grade/CGPA</Label>
                  <Input
                    value={education.grade}
                    onChange={(e) => updateEducation(index, 'grade', e.target.value)}
                    placeholder="8.5 CGPA / First Class"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={education.description}
                  onChange={(e) => updateEducation(index, 'description', e.target.value)}
                  placeholder="Additional details, achievements, relevant coursework..."
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
        onClick={addEducation}
        className="w-full"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add Another Education
      </Button>

      <Card className="border-2 border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <Label htmlFor="bio" className="text-lg font-semibold">Professional Bio / About Me</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  This will appear in your "About" section and helps others understand who you are professionally.
                </p>
              </div>
            </div>
            
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => onBioChange(e.target.value)}
              placeholder="Write a brief professional summary highlighting your key strengths, career goals, and what makes you unique. This is your chance to make a great first impression! Share your story, achievements, and aspirations..."
              rows={6}
              className="resize-none"
            />
            
            <div className="flex justify-between text-sm">
              <div className="text-muted-foreground">
                💡 <strong>Tip:</strong> A good bio helps employers and connections understand your professional journey
              </div>
              <span className="text-muted-foreground">
                {bio.length > 0 ? `${bio.length} characters` : 'Start writing your story'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MultipleEducationInput;