import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Settings, Save, Smartphone, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAppSettings, useUpdateAppSettings } from "@/hooks/useAppSettings";
import AppDownloadButtons from "@/components/AppDownloadButtons";

export const AdminAppSettingsPanel = () => {
  const { data: settings, isLoading } = useAppSettings();
  const updateSettings = useUpdateAppSettings();

  const [formData, setFormData] = useState({
    android_app_url: "",
    ios_app_url: "",
    show_download_buttons: "true",
    show_install_banner: "true",
    install_button_action: "pwa",
  });

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const isValidUrl = (url: string) => {
    if (!url.trim()) return true;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.android_app_url && !isValidUrl(formData.android_app_url)) {
      toast.error("Please enter a valid Android app URL");
      return;
    }
    if (formData.ios_app_url && !isValidUrl(formData.ios_app_url)) {
      toast.error("Please enter a valid iOS app URL");
      return;
    }
    updateSettings.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center px-4 py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit}>
        <Card className="p-4 sm:p-6">
          <h2 className="text-xl font-semibold mb-6 flex items-center">
            <Settings className="w-5 h-5 mr-2 text-primary" />
            App Download Link Settings
          </h2>

          <div className="space-y-4">
            <div>
              <Label htmlFor="android_app_url">Android App URL (Google Play Store)</Label>
              <Input
                id="android_app_url"
                type="url"
                value={formData.android_app_url}
                onChange={(e) => setFormData({ ...formData, android_app_url: e.target.value })}
                placeholder="https://play.google.com/store/apps/details?id=com.yourapp"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter the full Google Play Store URL for your Android app
              </p>
            </div>

            <div>
              <Label htmlFor="ios_app_url">iOS App URL (Apple App Store)</Label>
              <Input
                id="ios_app_url"
                type="url"
                value={formData.ios_app_url}
                onChange={(e) => setFormData({ ...formData, ios_app_url: e.target.value })}
                placeholder="https://apps.apple.com/app/yourapp/id123456789"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter the full Apple App Store URL for your iOS app
              </p>
            </div>

            <div className="flex items-center justify-between border rounded-lg p-4">
              <div className="space-y-0.5">
                <Label htmlFor="show_buttons">Show Download Buttons</Label>
                <p className="text-sm text-muted-foreground">
                  Display app download buttons on login and signup pages
                </p>
              </div>
              <Switch
                id="show_buttons"
                checked={formData.show_download_buttons === "true"}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, show_download_buttons: checked ? "true" : "false" })
                }
              />
            </div>

            <div className="flex items-center justify-between border rounded-lg p-4">
              <div className="space-y-0.5">
                <Label htmlFor="show_install_banner">Show Install Prompt Banner</Label>
                <p className="text-sm text-muted-foreground">
                  Show install banner on top of pages for app installation
                </p>
              </div>
              <Switch
                id="show_install_banner"
                checked={formData.show_install_banner === "true"}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, show_install_banner: checked ? "true" : "false" })
                }
              />
            </div>

            <div className="border rounded-lg p-4 space-y-3">
              <div className="space-y-0.5">
                <Label>Install Button Action</Label>
                <p className="text-sm text-muted-foreground">
                  Choose what happens when user clicks the Install button
                </p>
              </div>
              <RadioGroup
                value={formData.install_button_action}
                onValueChange={(value) =>
                  setFormData({ ...formData, install_button_action: value })
                }
                className="flex flex-col gap-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="pwa" id="action_pwa" />
                  <Label htmlFor="action_pwa" className="font-normal cursor-pointer">
                    PWA Install — Browser ka native install prompt
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="url" id="action_url" />
                  <Label htmlFor="action_url" className="font-normal cursor-pointer">
                    Open URL — Android/iOS app store link open karega
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <Button type="submit" disabled={updateSettings.isPending} className="flex-1">
              <Save className="w-4 h-4 mr-2" />
              {updateSettings.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </Card>
      </form>

      <Card className="p-4 sm:p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Smartphone className="w-5 h-5 mr-2 text-primary" />
          Button Preview
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          This is how the download buttons will appear on authentication pages:
        </p>
        <div className="border rounded-lg p-4 sm:p-6 bg-muted/30">
          <AppDownloadButtons userType="job_seeker" clickedFrom="preview" />
        </div>
        {!formData.android_app_url && !formData.ios_app_url && (
          <p className="text-sm text-muted-foreground mt-4 text-center">
            Add at least one app URL to see the preview
          </p>
        )}
      </Card>
    </div>
  );
};
