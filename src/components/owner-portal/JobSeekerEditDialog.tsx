import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useJobSeekerManagement } from "@/hooks/useJobSeekerManagement";
import SkillsSelector from "@/components/SkillsSelector";

interface JobSeekerEditDialogProps {
  jobSeeker: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

export function JobSeekerEditDialog({ jobSeeker, open, onOpenChange, onSave }: JobSeekerEditDialogProps) {
  const { updateJobSeekerProfile } = useJobSeekerManagement();
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    location: "",
    current_position: "",
    company: "",
    industry: "",
    bio: "",
    experience_years: 0,
    skills: [] as string[],
    languages: [] as string[],
    gender: ""
  });
  const [loading, setLoading] = useState(false);
  const [newLanguage, setNewLanguage] = useState("");

  useEffect(() => {
    if (jobSeeker) {
      setFormData({
        full_name: jobSeeker.full_name || "",
        phone: jobSeeker.phone || "",
        location: jobSeeker.location || "",
        current_position: jobSeeker.current_position || "",
        company: jobSeeker.company || "",
        industry: jobSeeker.industry || "",
        bio: jobSeeker.bio || "",
        experience_years: jobSeeker.experience_years || 0,
        skills: jobSeeker.skills || [],
        languages: jobSeeker.languages || [],
        gender: jobSeeker.gender || ""
      });
    }
  }, [jobSeeker]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.full_name.trim()) {
      toast.error("Full name is required");
      return;
    }

    setLoading(true);
    try {
      await updateJobSeekerProfile(jobSeeker.user_id, formData);
      toast.success("Job seeker profile updated successfully");
      onSave();
    } catch (error) {
      console.error("Error updating job seeker:", error);
      toast.error("Failed to update job seeker profile");
    } finally {
      setLoading(false);
    }
  };

  const handleSkillsChange = (newSkills: string[]) => {
    setFormData(prev => ({
      ...prev,
      skills: newSkills
    }));
  };

  const addLanguage = () => {
    if (newLanguage.trim() && !formData.languages.includes(newLanguage.trim())) {
      setFormData(prev => ({
        ...prev,
        languages: [...prev.languages, newLanguage.trim()]
      }));
      setNewLanguage("");
    }
  };

  const removeLanguage = (languageToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      languages: prev.languages.filter(language => language !== languageToRemove)
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Job Seeker Profile</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name *</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="current_position">Current Position</Label>
              <Input
                id="current_position"
                value={formData.current_position}
                onChange={(e) => setFormData(prev => ({ ...prev, current_position: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={formData.company}
                onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Select
                value={formData.industry}
                onValueChange={(value) => setFormData(prev => ({ ...prev, industry: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IT">Information Technology</SelectItem>
                  <SelectItem value="Finance">Finance & Banking</SelectItem>
                  <SelectItem value="Healthcare">Healthcare</SelectItem>
                  <SelectItem value="Education">Education</SelectItem>
                  <SelectItem value="Marketing">Marketing & Advertising</SelectItem>
                  <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                  <SelectItem value="Retail">Retail & E-commerce</SelectItem>
                  <SelectItem value="Consulting">Consulting</SelectItem>
                  <SelectItem value="Real Estate">Real Estate</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Gender</Label>
            <Select
              value={formData.gender}
              onValueChange={(value) => setFormData(prev => ({ ...prev, gender: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
                <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="experience_years">Experience (Years)</Label>
            <Input
              id="experience_years"
              type="number"
              min="0"
              max="50"
              value={formData.experience_years}
              onChange={(e) => setFormData(prev => ({ ...prev, experience_years: parseInt(e.target.value) || 0 }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={formData.bio}
              onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
              rows={3}
              placeholder="Brief description about the job seeker..."
            />
          </div>

          <SkillsSelector
            selectedSkills={formData.skills}
            onSkillsChange={handleSkillsChange}
            required={false}
          />

          <div className="space-y-2">
            <Label>Languages</Label>
            <div className="flex gap-2">
              <Input
                value={newLanguage}
                onChange={(e) => setNewLanguage(e.target.value)}
                placeholder="Add language"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addLanguage())}
              />
              <Button type="button" onClick={addLanguage}>Add</Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {formData.languages.map((language, index) => (
                <Badge key={index} variant="outline" className="cursor-pointer">
                  {language}
                  <X 
                    className="w-3 h-3 ml-1" 
                    onClick={() => removeLanguage(language)}
                  />
                </Badge>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}