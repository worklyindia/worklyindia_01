import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { cleanupBrandAsset } from '@/utils/storageCleanup';
import { uploadImage } from '@/lib/mediaCdn';
import { useAIChatSettings } from '@/hooks/useAIChatSettings';
import { useNavigate } from 'react-router-dom';
import { useAIOnlyMode } from '@/hooks/useAIOnlyMode';
import { ImageCropDialog } from '@/components/brand/ImageCropDialog';
import { Upload, MessageSquare, Image as ImageIcon, Wallpaper, Loader2, BadgeCheck } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import VerificationBadge from '@/components/VerificationBadge';

export default function AIChatSettings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useAIChatSettings();
  const { enabled: aiOnlyEnabled } = useAIOnlyMode();
  
  const [name, setName] = useState(settings.name);
  const [tagline, setTagline] = useState(settings.tagline);
  const [avatarUrl, setAvatarUrl] = useState(settings.avatar_url);
  const [verificationEnabled, setVerificationEnabled] = useState(settings.verification_enabled);
  const [verificationColor, setVerificationColor] = useState<'gold' | 'blue' | 'green' | 'silver'>(settings.verification_color);
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [aiOnlyMode, setAiOnlyMode] = useState(aiOnlyEnabled);
  const [savingAiOnly, setSavingAiOnly] = useState(false);

  useEffect(() => {
    setAiOnlyMode(aiOnlyEnabled);
  }, [aiOnlyEnabled]);

  const handleAiOnlyToggle = async (checked: boolean) => {
    setSavingAiOnly(true);
    const previous = aiOnlyMode;
    setAiOnlyMode(checked);
    try {
      const { error } = await supabase
        .from('app_settings')
        .update({ setting_value: checked ? 'true' : 'false' })
        .eq('setting_key', 'ai_only_mode');

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['ai-only-mode'] });
      toast.success(checked ? 'AI Only Mode is ON' : 'AI Only Mode is OFF');
    } catch (error) {
      console.error('Error updating AI only mode:', error);
      setAiOnlyMode(previous);
      toast.error('Failed to update AI Only Mode');
    } finally {
      setSavingAiOnly(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size should be less than 5MB');
        return;
      }
      setSelectedFile(file);
      setShowCropDialog(true);
    }
  };

  const handleCroppedImage = async (croppedFile: File) => {
    setSaving(true);
    try {
      // Delete old avatar from storage before uploading new one
      await cleanupBrandAsset(avatarUrl);

      const fileName = `ai-support-avatar-${Date.now()}.jpg`;
      // Upload to Cloudinary (auto-fallback to ImageKit) — keeps Supabase egress low
      const { url: publicUrl } = await uploadImage(croppedFile, {
        folder: 'brand-assets/ai-support',
        fileName,
      });

      // Update database
      const { error: updateError } = await supabase
        .from('app_settings')
        .update({ setting_value: publicUrl })
        .eq('setting_key', 'ai_support_avatar');

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      queryClient.invalidateQueries({ queryKey: ['ai-chat-settings'] });
      toast.success('Avatar updated successfully');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Failed to upload avatar');
    } finally {
      setSaving(false);
      setShowCropDialog(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const updates = [
        { setting_key: 'ai_support_name', setting_value: name },
        { setting_key: 'ai_support_tagline', setting_value: tagline },
        { setting_key: 'ai_support_verification_enabled', setting_value: verificationEnabled.toString() },
        { setting_key: 'ai_support_verification_color', setting_value: verificationColor }
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('app_settings')
          .update({ setting_value: update.setting_value })
          .eq('setting_key', update.setting_key);

        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ['ai-chat-settings'] });
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AI Chat Customization</h1>
        <p className="text-muted-foreground mt-2">
          Customize your AI Career Assistant's appearance and information
        </p>
      </div>

      <Separator />

      {/* AI Only Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            AI Only Mode
          </CardTitle>
          <CardDescription>
            When ON, visitors can only use the AI login and AI chat pages. All other pages redirect to the AI assistant. Policy pages and the owner portal stay open. Turn OFF to restore the full website.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-base">Show only AI pages</Label>
              <p className="text-sm text-muted-foreground">
                {aiOnlyMode ? 'Website is in AI-only mode' : 'Full website is available'}
              </p>
            </div>
            <Switch
              checked={aiOnlyMode}
              disabled={savingAiOnly}
              onCheckedChange={handleAiOnlyToggle}
            />
          </div>
        </CardContent>
      </Card>

      {/* Profile Picture Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            Profile Picture
          </CardTitle>
          <CardDescription>
            Upload and customize the AI assistant's profile picture
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-6">
            <img
              src={avatarUrl}
              alt="AI Support Avatar"
              className="w-32 h-32 rounded-full object-cover border-4 border-primary/20"
            />
            <div className="flex-1">
              <Label htmlFor="avatar-upload" className="cursor-pointer">
                <div className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors w-fit">
                  <Upload className="w-4 h-4" />
                  Upload New Avatar
                </div>
              </Label>
              <Input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
              <p className="text-sm text-muted-foreground mt-2">
                Recommended: Square image (1:1 ratio), JPG or PNG, max 5MB
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Name & Tagline Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Display Information
          </CardTitle>
          <CardDescription>
            Update the name and tagline shown in the AI chat
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="chat-name">Chat Name</Label>
            <Input
              id="chat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Workly Support"
              maxLength={50}
            />
            <p className="text-xs text-muted-foreground">
              The main display name in chat header and profile
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tagline">Tagline</Label>
            <Input
              id="tagline"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="AI Career Assistant"
              maxLength={100}
            />
            <p className="text-xs text-muted-foreground">
              Short description shown below the name
            </p>
          </div>

          <Button onClick={handleSaveSettings} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Verification Badge Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BadgeCheck className="w-5 h-5" />
            Verification Badge
          </CardTitle>
          <CardDescription>
            Enable and customize the verification badge for your AI assistant
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="verification-toggle">Show Verification Badge</Label>
              <p className="text-xs text-muted-foreground">
                Display a verification badge on the AI assistant profile
              </p>
            </div>
            <Switch
              id="verification-toggle"
              checked={verificationEnabled}
              onCheckedChange={setVerificationEnabled}
            />
          </div>

          {verificationEnabled && (
            <div className="space-y-2">
              <Label htmlFor="badge-color">Badge Color</Label>
              <Select value={verificationColor} onValueChange={(value: 'gold' | 'blue' | 'green' | 'silver') => setVerificationColor(value)}>
                <SelectTrigger id="badge-color">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gold">
                    <div className="flex items-center gap-2">
                      <VerificationBadge color="gold" size={16} />
                      <span>Gold - Premium/Official</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="blue">
                    <div className="flex items-center gap-2">
                      <VerificationBadge color="blue" size={16} />
                      <span>Blue - Verified Account</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="green">
                    <div className="flex items-center gap-2">
                      <VerificationBadge color="green" size={16} />
                      <span>Green - Active/Online</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="silver">
                    <div className="flex items-center gap-2">
                      <VerificationBadge color="silver" size={16} />
                      <span>Silver - Standard</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose the badge color that represents your verification level
              </p>
            </div>
          )}

          <Button onClick={handleSaveSettings} disabled={saving} className="w-full">
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Verification Settings'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Wallpaper Quick Access */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallpaper className="w-5 h-5" />
            Chat Wallpaper
          </CardTitle>
          <CardDescription>
            Customize the background wallpaper for AI chat
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => navigate('/ai-assistant/wallpaper')}
          >
            <Wallpaper className="w-4 h-4 mr-2" />
            Manage Wallpapers
          </Button>
        </CardContent>
      </Card>

      {/* Live Preview */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle>Live Preview</CardTitle>
          <CardDescription>See how your changes will appear</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-background rounded-lg p-4 border">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img
                  src={avatarUrl}
                  alt="Preview"
                  className="w-12 h-12 rounded-full object-cover"
                />
                {verificationEnabled && (
                  <div className="absolute -bottom-1 -right-1">
                    <VerificationBadge color={verificationColor} size={20} />
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{name}</h3>
                  {verificationEnabled && (
                    <VerificationBadge color={verificationColor} size={16} />
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{tagline}</p>
              </div>
            </div>
          </div>
          <Button
            variant="link"
            className="mt-3"
            onClick={() => navigate('/ai-assistant')}
          >
            Test in AI Chat →
          </Button>
        </CardContent>
      </Card>

      {/* Image Crop Dialog */}
      {selectedFile && (
        <ImageCropDialog
          open={showCropDialog}
          onOpenChange={setShowCropDialog}
          imageFile={selectedFile}
          onCropComplete={handleCroppedImage}
          aspectRatio={1}
        />
      )}
    </div>
  );
}
