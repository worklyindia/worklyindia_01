import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface AIChatPlan {
  id?: string;
  name: string;
  price_inr: number;
  messages_per_month: number;
  voice_playback_per_month: number;
  voice_input_per_month: number;
  image_analysis_per_month: number;
  ai_image_generation_per_month: number;
  ai_model_tier: string;
  priority_support: boolean;
  features: string[];
  is_active: boolean;
  display_order: number;
}

interface AIChatPlanFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<AIChatPlan, 'id'>) => Promise<void>;
  initialData?: AIChatPlan;
  isEdit: boolean;
}

export const AIChatPlanForm: React.FC<AIChatPlanFormProps> = ({
  open,
  onClose,
  onSubmit,
  initialData,
  isEdit
}) => {
  const [formData, setFormData] = useState<Omit<AIChatPlan, 'id'>>({
    name: '',
    price_inr: 0,
    messages_per_month: 50,
    voice_playback_per_month: 0,
    voice_input_per_month: 0,
    image_analysis_per_month: 0,
    ai_image_generation_per_month: 5,
    ai_model_tier: 'basic',
    priority_support: false,
    features: [],
    is_active: true,
    display_order: 0
  });
  const [featuresText, setFeaturesText] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        price_inr: initialData.price_inr,
        messages_per_month: initialData.messages_per_month,
        voice_playback_per_month: initialData.voice_playback_per_month,
        voice_input_per_month: initialData.voice_input_per_month,
        image_analysis_per_month: initialData.image_analysis_per_month,
        ai_image_generation_per_month: initialData.ai_image_generation_per_month || 5,
        ai_model_tier: initialData.ai_model_tier,
        priority_support: initialData.priority_support,
        features: initialData.features,
        is_active: initialData.is_active,
        display_order: initialData.display_order
      });
      setFeaturesText(initialData.features.join('\n'));
    }
  }, [initialData]);

  const resetForm = () => {
    setFormData({
      name: '',
      price_inr: 0,
      messages_per_month: 50,
      voice_playback_per_month: 0,
      voice_input_per_month: 0,
      image_analysis_per_month: 0,
      ai_image_generation_per_month: 5,
      ai_model_tier: 'basic',
      priority_support: false,
      features: [],
      is_active: true,
      display_order: 0
    });
    setFeaturesText('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const features = featuresText.split('\n').filter(f => f.trim() !== '');
      
      // Validate numeric fields
      if (isNaN(formData.price_inr) || isNaN(formData.messages_per_month) || 
          isNaN(formData.voice_playback_per_month) || isNaN(formData.voice_input_per_month) ||
          isNaN(formData.image_analysis_per_month) || isNaN(formData.ai_image_generation_per_month) ||
          isNaN(formData.display_order)) {
        toast.error('Please enter valid numbers for all numeric fields');
        setLoading(false);
        return;
      }

      await onSubmit({
        ...formData,
        features
      });
      
      resetForm();
      onClose();
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save plan');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit AI Chat Plan' : 'Create AI Chat Plan'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Plan Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Free, Basic, Pro"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Price (INR) *</Label>
              <Input
                id="price"
                type="number"
                value={formData.price_inr}
                onChange={(e) => setFormData({ ...formData, price_inr: parseInt(e.target.value) || 0 })}
                min="0"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="messages">Messages/Month *</Label>
              <Input
                id="messages"
                type="number"
                value={formData.messages_per_month}
                onChange={(e) => setFormData({ ...formData, messages_per_month: parseInt(e.target.value) || 0 })}
                min="0"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="voice_playback">Voice Playback/Month</Label>
              <Input
                id="voice_playback"
                type="number"
                value={formData.voice_playback_per_month}
                onChange={(e) => setFormData({ ...formData, voice_playback_per_month: parseInt(e.target.value) || 0 })}
                min="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="voice_input">Voice Input/Month</Label>
              <Input
                id="voice_input"
                type="number"
                value={formData.voice_input_per_month}
                onChange={(e) => setFormData({ ...formData, voice_input_per_month: parseInt(e.target.value) || 0 })}
                min="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="image_analysis">Image Analysis/Month</Label>
              <Input
                id="image_analysis"
                type="number"
                value={formData.image_analysis_per_month}
                onChange={(e) => setFormData({ ...formData, image_analysis_per_month: parseInt(e.target.value) || 0 })}
                min="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai_image_generation">AI Generation/Month</Label>
              <Input
                id="ai_image_generation"
                type="number"
                value={formData.ai_image_generation_per_month}
                onChange={(e) => setFormData({ ...formData, ai_image_generation_per_month: parseInt(e.target.value) || 0 })}
                min="0"
                placeholder="e.g., 5 for Free, 20 for Basic, 100 for Pro"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai_model">AI Model Tier *</Label>
              <Select value={formData.ai_model_tier} onValueChange={(value) => setFormData({ ...formData, ai_model_tier: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="all">All Models</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="display_order">Display Order</Label>
              <Input
                id="display_order"
                type="number"
                value={formData.display_order}
                onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                min="0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="features">Features (one per line)</Label>
            <Textarea
              id="features"
              value={featuresText}
              onChange={(e) => setFeaturesText(e.target.value)}
              placeholder="Enter each feature on a new line"
              rows={5}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="priority_support"
              checked={formData.priority_support}
              onCheckedChange={(checked) => setFormData({ ...formData, priority_support: checked })}
            />
            <Label htmlFor="priority_support">Priority Support</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
            <Label htmlFor="is_active">Active</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : isEdit ? 'Update Plan' : 'Create Plan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
