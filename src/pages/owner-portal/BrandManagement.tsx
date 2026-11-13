import { toNotificationSilhouette } from '@/lib/notificationBadge';
import { NOTIFICATION_LOGO_URL } from '@/lib/notificationLogo';
import { FirebasePushService } from '@/services/FirebasePushService';
import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Palette, Upload, Save, Loader2, X, Share2, ExternalLink, Smartphone, Image } from "lucide-react";
import { ImageCropDialog } from "@/components/brand/ImageCropDialog";
import FounderPhotoSettings from "@/components/brand/FounderPhotoSettings";
import { SocialMediaPreview } from "@/components/brand/SocialMediaPreview";
import { cleanupBrandAsset } from "@/utils/storageCleanup";
import { BRAND_CONFIG } from "@/config/brandConfig";
import { injectDynamicManifest } from "@/utils/dynamicManifest";
import { uploadBrandAsset } from "@/lib/brandAssetStorage";
import { resolveBrandLogo } from "@/lib/brandLogo";
import { PasskeyDomainSettings } from "@/components/owner/PasskeyDomainSettings";
import { setPendingImagePick, getPendingImagePick, clearPendingImagePick } from "@/lib/pendingImagePick";

const PICK_SCOPE = "owner-brand-management";

interface BrandAssets {
  logo_url?: string;
  logo_dark_url?: string;
  favicon_url?: string;
  brand_name?: string;
  brand_tagline?: string;
  primary_color?: string;
  secondary_color?: string;
  og_image_url?: string;
  og_title?: string;
  og_description?: string;
}

const BrandManagement = () => {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [currentImageFile, setCurrentImageFile] = useState<File | null>(null);
  const [currentFieldType, setCurrentFieldType] = useState<keyof BrandAssets | null>(null);
  const [currentPwaField, setCurrentPwaField] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [brandAssets, setBrandAssets] = useState<BrandAssets>({
    brand_name: BRAND_CONFIG.name,
    brand_tagline: BRAND_CONFIG.tagline,
    primary_color: "#8B5CF6",
    secondary_color: "#3B82F6"
  });
  const [pwaSettings, setPwaSettings] = useState({
    pwa_app_name: '',
    pwa_app_description: '',
    pwa_app_icon: '',
    pwa_screenshot_1: '',
    pwa_screenshot_2: '',
    pwa_feature_graphic: '',
    notification_badge_icon: ''
  });

  useEffect(() => {
    fetchBrandAssets();
    fetchPwaSettings();
  }, []);

  // If the browser remounted this page while the photo picker was open,
  // restore the image the user already selected instead of losing it.
  useEffect(() => {
    const pending = getPendingImagePick(PICK_SCOPE);
    if (!pending) return;
    setCurrentImageFile(pending.file);
    if (pending.kind === 'pwa') {
      setCurrentPwaField(pending.field);
      setCurrentFieldType(null);
    } else {
      setCurrentFieldType(pending.field as keyof BrandAssets);
      setCurrentPwaField(null);
    }
    setCropDialogOpen(true);
  }, []);

  const fetchBrandAssets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_brand_assets');
      
      if (error) throw error;
      
      if (data && typeof data === 'object' && data !== null) {
        const fetched = data as BrandAssets;
        setBrandAssets(prev => ({
          ...prev,
          ...fetched,
          logo_url: resolveBrandLogo(fetched.logo_url),
          favicon_url: resolveBrandLogo(fetched.favicon_url, true),
        }));
      }
    } catch (error) {
      console.error('Error fetching brand assets:', error);
      toast.error('Failed to load brand assets');
    } finally {
      setLoading(false);
    }
  };

  const fetchPwaSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['pwa_app_name', 'pwa_app_description', 'pwa_app_icon', 'pwa_screenshot_1', 'pwa_screenshot_2', 'pwa_feature_graphic', 'notification_badge_icon']);
      
      if (error) throw error;
      
      const settings: any = {};
      data?.forEach(row => {
        settings[row.setting_key] = row.setting_value || '';
      });
      setPwaSettings(prev => ({ ...prev, ...settings }));
    } catch (error) {
      console.error('Error fetching PWA settings:', error);
    }
  };

  const handleImageSelect = (file: File, field: keyof BrandAssets) => {
    setPendingImagePick(PICK_SCOPE, { file, field: field as string, kind: 'asset' });
    setCurrentImageFile(file);
    setCurrentFieldType(field);
    setCurrentPwaField(null);
    setCropDialogOpen(true);
  };

  const handlePwaImageSelect = (file: File, field: string) => {
    setPendingImagePick(PICK_SCOPE, { file, field, kind: 'pwa' });
    setCurrentImageFile(file);
    setCurrentFieldType(null);
    setCurrentPwaField(field);
    setCropDialogOpen(true);
  };

  const closeCropDialog = (open: boolean) => {
    setCropDialogOpen(open);
    if (!open) {
      clearPendingImagePick(PICK_SCOPE);
      setCurrentImageFile(null);
    }
  };

  const updateFaviconLink = (url: string | null | undefined) => {
    if (!url) return;
    try {
      const links = document.querySelectorAll<HTMLLinkElement>("link[rel*='icon']");
      links.forEach((l) => { l.href = url; });
      if (links.length === 0) {
        const link = document.createElement('link');
        link.rel = 'icon';
        link.href = url;
        document.head.appendChild(link);
      }
    } catch (e) { /* ignore */ }
  };

  const persistBrandAssets = async (assets: BrandAssets) => {
    const { error } = await supabase.rpc('update_brand_assets', { p_assets: assets as any });
    if (error) throw error;
    // Update the shared cache immediately without refetching/remounting this page.
    queryClient.setQueryData(['brand-assets'], (current: BrandAssets | undefined) => ({
      ...(current || {}),
      ...assets,
    }));
  };

  /**
   * The crop dialog produces a full-resolution lossless PNG which often
   * exceeds the 5MB storage limit. Shrink + re-encode so uploads never fail.
   */
  const compressForUpload = async (file: File, maxSide = 1280): Promise<File> => {
    if (file.size < 900 * 1024) return file;
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob(resolve, 'image/webp', 0.9)
      );
      if (!blob || blob.size >= file.size) return file;
      return new File([blob], file.name.replace(/\.[a-z0-9]+$/i, '.webp'), { type: 'image/webp' });
    } catch {
      return file;
    }
  };

  const handleCropComplete = async (croppedFile: File): Promise<boolean> => {
    const assetField = currentFieldType;
    const pwaField = currentPwaField;
    const fieldName = assetField || pwaField;
    if (!fieldName) return false;

    const oldUrl = assetField
      ? brandAssets[assetField]
      : pwaField
        ? pwaSettings[pwaField as keyof typeof pwaSettings]
        : undefined;

    setUploadingField(fieldName);
    const toastId = toast.loading(`Uploading ${fieldName.replace(/_/g, ' ')}…`);

    try {
      const fileToUpload = pwaField === 'notification_badge_icon'
        ? await toNotificationSilhouette(croppedFile)
        : await compressForUpload(croppedFile);
      // Upload FIRST — never delete the old image before the new one is safely stored
      const publicUrl = await uploadBrandAsset(fileToUpload, fieldName);

      if (assetField) {
        const nextAssets = { ...brandAssets, [assetField]: publicUrl };
        // Auto-save to DB immediately so users don't lose changes
        await persistBrandAssets(nextAssets);
        setBrandAssets(nextAssets);
        if (assetField === 'favicon_url') {
          updateFaviconLink(publicUrl);
        }
        toast.success(`${assetField.replace(/_/g, ' ')} updated & saved`, { id: toastId });
      } else if (pwaField) {
        const nextPwa = { ...pwaSettings, [pwaField]: publicUrl };
        // Persist this single key immediately
        const { data: { user } } = await supabase.auth.getUser();
        const { error: pwaError } = await supabase.from('app_settings').upsert({
          setting_key: pwaField,
          setting_value: publicUrl,
          updated_by: user?.id || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'setting_key' });
        if (pwaError) throw pwaError;
        setPwaSettings(nextPwa);
        if (pwaField === 'notification_badge_icon') await FirebasePushService.syncNotificationIcon();
        await injectDynamicManifest();
        toast.success(`${pwaField.replace(/_/g, ' ')} updated & saved`, { id: toastId });
      }

      // Only now remove the previous file (best effort — never block the update)
      if (oldUrl) {
        try { await cleanupBrandAsset(oldUrl); } catch { /* ignore */ }
      }

      setHasUnsavedChanges(false);
      clearPendingImagePick(PICK_SCOPE);
      setCurrentImageFile(null);
      setCurrentFieldType(null);
      setCurrentPwaField(null);
      return true;
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toast.error(`Failed to upload: ${error?.message || 'unknown error'}`, { id: toastId });
      return false;
    } finally {
      setUploadingField(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await persistBrandAssets(brandAssets);

      // Save PWA settings to app_settings table (save ALL entries including empty ones)
      const pwaEntries = Object.entries(pwaSettings);
      if (pwaEntries.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        for (const [key, value] of pwaEntries) {
          const { error } = await supabase
            .from('app_settings')
            .upsert({
              setting_key: key,
              setting_value: value || '',
              updated_by: user?.id || null,
              updated_at: new Date().toISOString()
            }, { onConflict: 'setting_key' });
          if (error) throw error;
        }
      }

      await FirebasePushService.syncNotificationIcon();
      setHasUnsavedChanges(false);
      toast.success('✅ Brand settings updated successfully!', {
        description: 'PWA manifest has been updated. Social media cache may take 5–10 minutes; use the Facebook Debugger button below to force-refresh.'
      });

      updateFaviconLink(brandAssets.favicon_url);
      await injectDynamicManifest();
      await fetchBrandAssets();
      await fetchPwaSettings();
      // Auto-open Facebook sharing debugger so OG cache is purged for the canonical URL.
      try {
        const target = `https://${BRAND_CONFIG.canonicalDomain}/`;
        window.open(`https://developers.facebook.com/tools/debug/?q=${encodeURIComponent(target)}`, '_blank', 'noopener,noreferrer');
      } catch { /* ignore popup blockers */ }
    } catch (error: any) {
      console.error('Error saving brand assets:', error);
      toast.error(`Failed to save: ${error?.message || 'unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const removeImage = async (field: keyof BrandAssets) => {
    const oldUrl = brandAssets[field];
    const nextAssets = { ...brandAssets, [field]: null as any };
    try {
      await persistBrandAssets(nextAssets);
      setBrandAssets(nextAssets);
      if (oldUrl) {
        try { await cleanupBrandAsset(oldUrl); } catch { /* best effort */ }
      }
      toast.success(`${field.replace(/_/g, ' ')} removed`);
    } catch (e: any) {
      toast.error(`Failed to remove: ${e?.message || 'unknown error'}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Brand & Logo Management - Owner Portal</title>
        <meta
          name="description"
          content="Manage your platform's brand assets, logos, and visual identity"
        />
      </Helmet>

      <div className="container mx-auto py-4 sm:py-6 px-3 sm:px-4 max-w-5xl">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Brand & Logo Management</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage your platform's visual identity, logos, and brand assets
          </p>
        </div>

        {uploadingField && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>Uploading {uploadingField.replace(/_/g, ' ')}… please wait, don't close this page.</span>
          </div>
        )}

        <div className="space-y-6">
          <FounderPhotoSettings />
          {/* Logo Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5" />
                Logo Assets
                {hasUnsavedChanges && (
                  <span className="text-xs font-normal text-amber-600 dark:text-amber-400">
                    ⚠️ Unsaved changes
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                Primary logo and browser icon
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Primary Logo */}
              <div>
                <Label htmlFor="logo" className="text-sm sm:text-base">Primary Logo</Label>
                <p className="text-xs text-muted-foreground mt-1 mb-2">
                  📍 This logo will appear in the website header, loading screen, and browser tab
                </p>
                <div className="mt-2 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  {brandAssets.logo_url ? (
                    <div className="relative w-20 h-20">
                      <img loading="lazy" decoding="async"
                        src={brandAssets.logo_url}
                        alt="Primary Logo"
                        className="w-20 h-20 object-cover border rounded-full bg-background"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                        onClick={() => removeImage('logo_url')}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : null}
                  <div className="flex-1 w-full">
                    <Input
                      id="logo"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageSelect(file, 'logo_url');
                        e.target.value = '';
                      }}
                      disabled={!!uploadingField}
                      className="cursor-pointer w-full"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      PNG, JPG or WebP
                    </p>
                  </div>
                </div>
              </div>

              {/* Favicon */}
              <div>
                <Label htmlFor="favicon" className="text-sm sm:text-base">Favicon (Browser Tab Icon)</Label>
                <p className="text-xs text-muted-foreground mt-1 mb-2">
                  🔖 Small icon in the browser tab that helps identify your website
                </p>
                <div className="mt-2 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  {brandAssets.favicon_url ? (
                    <div className="relative w-16 h-16">
                      <img loading="lazy" decoding="async"
                        src={brandAssets.favicon_url}
                        alt="Favicon"
                        className="w-16 h-16 object-cover border rounded-full bg-background"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                        onClick={() => removeImage('favicon_url')}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : null}
                  <div className="flex-1 w-full">
                    <Input
                      id="favicon"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageSelect(file, 'favicon_url');
                        e.target.value = '';
                      }}
                      disabled={!!uploadingField}
                      className="cursor-pointer w-full"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      ✅ Best: Square PNG, 192x192px
                    </p>
                  </div>
                </div>
              </div>

              {/* Notification small icon */}
              <div>
                <Label htmlFor="notification-badge" className="text-sm sm:text-base">Notification Icon (small icon next to "Chrome")</Label>
                <p className="text-xs text-muted-foreground mt-1 mb-2">
                  Android Chrome chooses the small icon colour. These previews show the uploaded artwork, not the phone's final tint.
                </p>
                <div className="mt-2 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="flex gap-2">
                    <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center">
                      <img src={pwaSettings.notification_badge_icon || NOTIFICATION_LOGO_URL} alt="Notification icon on dark" className="w-12 h-12 object-contain" />
                    </div>
                    <div className="w-16 h-16 rounded-full border bg-white flex items-center justify-center">
                      <img src={pwaSettings.notification_badge_icon || NOTIFICATION_LOGO_URL} alt="Notification icon on light" className="w-12 h-12 object-contain" />
                    </div>
                  </div>
                  <div className="flex-1 w-full">
                    <Input
                      id="notification-badge"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handlePwaImageSelect(file, 'notification_badge_icon');
                        e.target.value = '';
                      }}
                      disabled={!!uploadingField}
                      className="cursor-pointer w-full"
                    />
                    <Button
                      variant="outline"
                      className="mt-2"
                      disabled={!!uploadingField}
                      onClick={async () => {
                        try {
                          const response = await fetch(NOTIFICATION_LOGO_URL);
                          if (!response.ok) throw new Error('Could not load the supplied W logo');
                          const blob = await response.blob();
                          handlePwaImageSelect(new File([blob], 'workly-notification-logo.png', { type: 'image/png' }), 'notification_badge_icon');
                        } catch {
                          toast.error('Could not load the supplied W logo. Please try again.');
                        }
                      }}
                    >
                      <Image className="w-4 h-4 mr-2" />Use supplied W logo
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Brand Identity */}
          <Card>
            <CardHeader>
              <CardTitle>Brand Identity</CardTitle>
              <CardDescription>
                Define your brand name and tagline
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="brand-name">Brand Name</Label>
                <Input
                  id="brand-name"
                  value={brandAssets.brand_name || ''}
                  onChange={(e) => setBrandAssets(prev => ({ ...prev, brand_name: e.target.value }))}
                  placeholder="e.g., Workly India"
                />
              </div>

              <div>
                <Label htmlFor="brand-tagline">Brand Tagline</Label>
                <Textarea
                  id="brand-tagline"
                  value={brandAssets.brand_tagline || ''}
                  onChange={(e) => setBrandAssets(prev => ({ ...prev, brand_tagline: e.target.value }))}
                  placeholder="e.g., Remote Jobs in India"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Brand Colors */}
          <Card>
            <CardHeader>
              <CardTitle>Brand Colors</CardTitle>
              <CardDescription>
                Set your primary and secondary brand colors
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <Label htmlFor="primary-color" className="text-sm sm:text-base">Primary Color</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      id="primary-color"
                      type="color"
                      value={brandAssets.primary_color || '#8B5CF6'}
                      onChange={(e) => setBrandAssets(prev => ({ ...prev, primary_color: e.target.value }))}
                      className="w-16 sm:w-20 h-10 p-1 cursor-pointer flex-shrink-0"
                    />
                    <Input
                      value={brandAssets.primary_color || '#8B5CF6'}
                      onChange={(e) => setBrandAssets(prev => ({ ...prev, primary_color: e.target.value }))}
                      placeholder="#8B5CF6"
                      className="flex-1"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="secondary-color" className="text-sm sm:text-base">Secondary Color</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      id="secondary-color"
                      type="color"
                      value={brandAssets.secondary_color || '#3B82F6'}
                      onChange={(e) => setBrandAssets(prev => ({ ...prev, secondary_color: e.target.value }))}
                      className="w-16 sm:w-20 h-10 p-1 cursor-pointer flex-shrink-0"
                    />
                    <Input
                      value={brandAssets.secondary_color || '#3B82F6'}
                      onChange={(e) => setBrandAssets(prev => ({ ...prev, secondary_color: e.target.value }))}
                      placeholder="#3B82F6"
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Social Media Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="w-5 h-5" />
                Social Media Preview
              </CardTitle>
              <CardDescription>
                Customize how your website appears when shared on social media
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* OG Image Upload */}
              <div>
                <Label htmlFor="og-image" className="text-sm sm:text-base">Social Media Image (OG Image)</Label>
                <p className="text-xs text-muted-foreground mt-1 mb-2">
                  📱 This image will appear when sharing links on WhatsApp, Facebook, Twitter, Telegram, Instagram
                </p>
                <div className="mt-2 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  {brandAssets.og_image_url ? (
                    <div className="relative w-full sm:w-auto">
                      <img loading="lazy" decoding="async"
                        src={brandAssets.og_image_url}
                        alt="OG Image"
                        className="w-full sm:w-[240px] h-auto sm:h-[126px] object-contain border rounded-lg p-2 bg-white"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                        onClick={() => removeImage('og_image_url')}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : null}
                  <div className="flex-1 w-full">
                    <Input
                      id="og-image"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageSelect(file, 'og_image_url');
                        e.target.value = '';
                      }}
                      disabled={!!uploadingField}
                      className="cursor-pointer w-full"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      ✅ Best: 1200x630px (1.91:1 ratio) - perfect size for all social media
                    </p>
                  </div>
                </div>
              </div>

              {/* OG Title & Description */}
              <div>
                <Label htmlFor="og-title">Social Media Title</Label>
                <Input
                  id="og-title"
                  value={brandAssets.og_title || ''}
                  onChange={(e) => setBrandAssets(prev => ({ ...prev, og_title: e.target.value }))}
                  placeholder={brandAssets.brand_name || "Workly India"}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Defaults to brand name if not set
                </p>
              </div>

              <div>
                <Label htmlFor="og-description">Social Media Description</Label>
                <Textarea
                  id="og-description"
                  value={brandAssets.og_description || ''}
                  onChange={(e) => setBrandAssets(prev => ({ ...prev, og_description: e.target.value }))}
                  placeholder={brandAssets.brand_tagline || "Remote Jobs in India"}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Defaults to brand tagline if not set
                </p>
              </div>

              {/* Social Preview */}
              <div className="mt-6">
                <SocialMediaPreview
              title={brandAssets.og_title || brandAssets.brand_name || "Workly India"}
              description={brandAssets.og_description || brandAssets.brand_tagline || "Remote Jobs in India"}
              imageUrl={brandAssets.og_image_url || brandAssets.logo_url || ""}
              isUnsaved={hasUnsavedChanges}
                />
              </div>

              {/* Social Media Debugger Tools */}
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg space-y-3">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                 🔍 Test Social Media Preview
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                   After saving, use these tools to check if your link looks correct:
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="text-xs"
                  >
                    <a 
                      href="https://developers.facebook.com/tools/debug/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Facebook Debugger
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="text-xs"
                  >
                    <a 
                      href="https://cards-dev.twitter.com/validator" 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Twitter Validator
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="text-xs"
                  >
                    <a 
                      href="https://www.linkedin.com/post-inspector/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      LinkedIn Inspector
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* PWA App Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5" />
                PWA App Settings
              </CardTitle>
              <CardDescription>
                Update the name, description, and screenshots shown in the PWA install prompt
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Website Android download icon — stored in Cloudflare R2 */}
              <div className="mb-6 rounded-xl border p-4 sm:p-5">
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ backgroundColor: '#fff', colorScheme: 'only light' }}>
                    <img src={downloadAppIcon?.url || '/icons/icon-512x512.png'} alt="Website Android download app icon" className="h-full w-full rounded-xl object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Label className="text-sm font-semibold">Website Android Download App Icon</Label>
                    <p className="mt-1 text-xs text-muted-foreground">Public website download page par dikhne wala app icon. Square crop (1:1) select karein; 512 × 512 PNG Cloudflare R2 par save hoga aur rounded-square white tile mein dikhega.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button type="button" size="sm" disabled={downloadAppIconBusy || !!uploadingField} onClick={() => {
                        const picker = document.createElement('input');
                        picker.type = 'file';
                        picker.accept = 'image/png,image/jpeg,image/webp,image/avif';
                        picker.onchange = () => { const file = picker.files?.[0]; if (file) handlePwaImageSelect(file, 'download_app_icon'); };
                        picker.click();
                      }}>
                        {downloadAppIconBusy || uploadingField === 'download_app_icon' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        {downloadAppIcon ? 'Replace App Icon' : 'Upload App Icon'}
                      </Button>
                      {downloadAppIcon && <Button type="button" size="sm" variant="destructive" disabled={downloadAppIconBusy || !!uploadingField} onClick={() => void removeDownloadAppIcon()}><X className="mr-2 h-4 w-4" />Remove</Button>}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">PNG, JPG, WEBP or AVIF · Maximum 10 MB · Upload, replace and remove are handled through Cloudflare.</p>
                  </div>
                </div>
              </div>

              {/* App Icon Upload */}
              <div>
                <Label className="text-sm font-medium">App Icon (512x512)</Label>
                <p className="text-xs text-muted-foreground mt-1 mb-3">
                  📱 Upload a square icon for your PWA app. Will be cropped to 512x512px.
                </p>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-muted shadow-md">
                    <img loading="lazy" decoding="async"
                      src={pwaSettings.pwa_app_icon || brandAssets.logo_url || '/icons/icon-192x192.png'}
                      alt="PWA App Icon"
                      className="w-full h-full object-contain bg-white"
                    />
                  </div>
                  <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-muted shadow-sm">
                    <img loading="lazy" decoding="async"
                      src={pwaSettings.pwa_app_icon || brandAssets.logo_url || '/icons/icon-192x192.png'}
                      alt="PWA App Icon Circle"
                      className="w-full h-full object-contain bg-white"
                    />
                  </div>
                  <div className="flex-1">
                    <Input
                      type="file"
                      accept="image/*"
                       disabled={!!uploadingField}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handlePwaImageSelect(file, 'pwa_app_icon');
                        e.target.value = '';
                      }}
                      className="cursor-pointer"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      ✅ Square image, at least 512x512px, PNG format
                    </p>
                  </div>
                </div>
                {pwaSettings.pwa_app_icon && (
                  <Button variant="outline" size="sm" className="mt-2"
                    onClick={() => { setPwaSettings(prev => ({ ...prev, pwa_app_icon: '' })); setHasUnsavedChanges(true); }}>
                    <X className="h-3 w-3 mr-1" /> Remove custom icon
                  </Button>
                )}
                <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-xs text-amber-900 dark:text-amber-100">
                    ⚠️ <strong>Already-installed apps</strong> won't pick up the new icon until users uninstall and reinstall (mobile OS limitation). New visitors and PWA install prompts will show the new icon immediately after Save.
                  </p>
                </div>
              </div>

              {/* PWA App Name */}
              <div>
                <Label htmlFor="pwa-name">PWA App Name</Label>
                <Input
                  id="pwa-name"
                  value={pwaSettings.pwa_app_name}
                  onChange={(e) => {
                    setPwaSettings(prev => ({ ...prev, pwa_app_name: e.target.value }));
                    setHasUnsavedChanges(true);
                  }}
                  placeholder={brandAssets.brand_name || "Workly India"}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  If left empty, the Brand Name will be used
                </p>
              </div>

              {/* PWA Description */}
              <div>
                <Label htmlFor="pwa-desc">PWA App Description</Label>
                <Textarea
                  id="pwa-desc"
                  value={pwaSettings.pwa_app_description}
                  onChange={(e) => {
                    setPwaSettings(prev => ({ ...prev, pwa_app_description: e.target.value }));
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="Find the best remote jobs, online earning opportunities..."
                  rows={2}
                />
              </div>

              {/* Screenshots */}
              <div>
                <Label className="flex items-center gap-2">
                  <Image className="w-4 h-4" />
                  PWA Install Screenshots
                </Label>
                <p className="text-xs text-muted-foreground mt-1 mb-3">
                  📸 These screenshots will appear in the PWA install prompt
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Screenshot 1 - Narrow */}
                  <div>
                    <p className="text-xs font-medium mb-2">Screenshot 1 (540x960)</p>
                    {pwaSettings.pwa_screenshot_1 && (
                      <div className="relative">
                        <img loading="lazy" decoding="async" src={pwaSettings.pwa_screenshot_1} alt="Screenshot 1" className="w-full h-32 object-cover border rounded-lg" />
                        <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                          onClick={() => { setPwaSettings(prev => ({ ...prev, pwa_screenshot_1: '' })); setHasUnsavedChanges(true); }}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    <Input type="file" accept="image/*" disabled={!!uploadingField} onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handlePwaImageSelect(file, 'pwa_screenshot_1');
                        e.target.value = '';
                      }} className="mt-2 cursor-pointer" />
                  </div>
                  {/* Screenshot 2 - Narrow */}
                  <div>
                    <p className="text-xs font-medium mb-2">Screenshot 2 (540x960)</p>
                    {pwaSettings.pwa_screenshot_2 && (
                      <div className="relative">
                        <img loading="lazy" decoding="async" src={pwaSettings.pwa_screenshot_2} alt="Screenshot 2" className="w-full h-32 object-cover border rounded-lg" />
                        <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                          onClick={() => { setPwaSettings(prev => ({ ...prev, pwa_screenshot_2: '' })); setHasUnsavedChanges(true); }}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    <Input type="file" accept="image/*" disabled={!!uploadingField} onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handlePwaImageSelect(file, 'pwa_screenshot_2');
                        e.target.value = '';
                      }} className="mt-2 cursor-pointer" />
                  </div>
                  {/* Feature Graphic - Wide */}
                  <div>
                    <p className="text-xs font-medium mb-2">Feature Graphic (1024x576)</p>
                    {pwaSettings.pwa_feature_graphic && (
                      <div className="relative">
                        <img loading="lazy" decoding="async" src={pwaSettings.pwa_feature_graphic} alt="Feature Graphic" className="w-full h-32 object-cover border rounded-lg" />
                        <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                          onClick={() => { setPwaSettings(prev => ({ ...prev, pwa_feature_graphic: '' })); setHasUnsavedChanges(true); }}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    <Input type="file" accept="image/*" disabled={!!uploadingField} onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handlePwaImageSelect(file, 'pwa_feature_graphic');
                        e.target.value = '';
                      }} className="mt-2 cursor-pointer" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Passkey (fingerprint / face login) domain */}
          <PasskeyDomainSettings />

          {/* Save Button */}
          <div className="flex justify-end sticky bottom-0 py-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t sm:border-0 sm:bg-transparent sm:backdrop-blur-none sm:static">
            <Button 
              onClick={handleSave} 
              disabled={saving || !!uploadingField} 
              size="lg"
              className="w-full sm:w-auto"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Brand Assets
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Image Crop Dialog */}
      <ImageCropDialog
        open={cropDialogOpen}
        onOpenChange={closeCropDialog}
        imageFile={currentImageFile}
        onCropComplete={handleCropComplete}
        aspectRatio={
          currentFieldType === 'logo_url' || currentFieldType === 'favicon_url' || currentPwaField === 'notification_badge_icon' ? 1 :
          currentFieldType === 'og_image_url' ? 1.91 :
          currentPwaField === 'pwa_app_icon' ? 1 :
          currentPwaField === 'pwa_feature_graphic' ? 16/9 :
          currentPwaField?.includes('screenshot') ? 9/16 :
          undefined
        }
        circularCrop={currentFieldType === 'logo_url' || currentFieldType === 'favicon_url' || currentPwaField === 'notification_badge_icon'}
        // Keep logo/favicon pixels exactly as uploaded: a white background stays white, a transparent one stays transparent.
        preservePixels={currentFieldType === 'logo_url' || currentFieldType === 'favicon_url'}
        outputSize={
          currentFieldType === 'logo_url' ? { width: 512, height: 512 } :
          currentFieldType === 'favicon_url' ? { width: 192, height: 192 } :
          currentPwaField === 'notification_badge_icon' ? { width: 144, height: 144 } :
          currentPwaField === 'pwa_app_icon' ? { width: 512, height: 512 } :
          currentPwaField?.includes('screenshot') ? { width: 540, height: 960 } :
          currentPwaField === 'pwa_feature_graphic' ? { width: 1024, height: 576 } :
          undefined
        }
        title={
          currentFieldType === 'favicon_url' ? 'Crop Favicon' :
          currentPwaField === 'notification_badge_icon' ? 'Crop Notification Icon' :
          currentFieldType === 'og_image_url' ? 'Crop for Social Media (1.91:1)' :
          currentPwaField === 'pwa_app_icon' ? 'Crop App Icon (512x512)' :
          currentPwaField === 'pwa_feature_graphic' ? 'Crop Feature Graphic (1024x576)' :
          currentPwaField?.includes('screenshot') ? 'Crop Screenshot (540x960)' :
          'Crop Logo'
        }
      />
    </>
  );
};

export default BrandManagement;
