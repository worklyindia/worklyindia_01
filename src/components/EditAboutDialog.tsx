import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { User, Save, X } from 'lucide-react';

interface EditAboutDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentBio: string;
  onBioUpdate: (newBio: string) => void;
}

const EditAboutDialog: React.FC<EditAboutDialogProps> = ({
  isOpen,
  onClose,
  currentBio,
  onBioUpdate
}) => {
  const [bio, setBio] = useState(currentBio);
  const [isLoading, setIsLoading] = useState(false);
  const { updateProfile } = useAuth();
  const { toast } = useToast();

  const maxCharacters = 500;
  const remainingCharacters = maxCharacters - bio.length;

  const handleSave = async () => {
    if (bio.length > maxCharacters) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Bio must be less than ${maxCharacters} characters`
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const { error } = await updateProfile({ bio: bio.trim() });
      
      if (error) {
        throw error;
      }
      
      onBioUpdate(bio.trim());
      toast({
        title: "Success",
        description: "About section updated successfully!"
      });
      onClose();
      
    } catch (error: any) {
      console.error('Error updating bio:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update about section"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setBio(currentBio); // Reset to original value
    onClose();
  };

  // Reset bio when dialog opens with new currentBio
  React.useEffect(() => {
    if (isOpen) {
      setBio(currentBio);
    }
  }, [isOpen, currentBio]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <User className="w-5 h-5 mr-2" />
            Edit About Section
          </DialogTitle>
          <DialogDescription>
            Write a brief professional summary highlighting your key strengths, career goals, and what makes you unique.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bio">Professional Bio</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Write about your professional background, skills, achievements, and career goals. This will help employers and connections understand who you are and what you bring to the table..."
              rows={8}
              className="resize-none"
            />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Share your story and make a great first impression
              </span>
              <span 
                className={`${
                  remainingCharacters < 0 
                    ? 'text-destructive' 
                    : remainingCharacters < 50 
                      ? 'text-amber-600' 
                      : 'text-muted-foreground'
                }`}
              >
                {remainingCharacters} characters remaining
              </span>
            </div>
          </div>
          
          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-medium text-sm mb-2">💡 Tips for a great bio:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Highlight your key skills and expertise</li>
              <li>• Mention your career goals and aspirations</li>
              <li>• Include notable achievements or experiences</li>
              <li>• Keep it professional yet personal</li>
              <li>• Use keywords relevant to your industry</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isLoading || bio.length > maxCharacters}
            className="bg-gradient-to-r from-primary to-secondary"
          >
            <Save className="w-4 h-4 mr-2" />
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditAboutDialog;