import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Youtube, Play, Upload } from "lucide-react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { cleanupBannerImage } from "@/utils/storageCleanup";
import { uploadBannerToR2, deleteBannerFromR2 } from "@/lib/r2Banner";
import { notifyBannerUpdate } from "@/lib/bannerUpdates";
import { ImageCropDialog } from "@/components/brand/ImageCropDialog";

const extractYouTubeId = (url: string) => {
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
};

const gradientOptions = [
  { value: 'none', label: 'None (Transparent)' },
  { value: 'from-primary/20 via-primary/10 to-background', label: 'Primary Purple' },
  { value: 'from-blue-500/20 via-blue-500/10 to-background', label: 'Blue' },
  { value: 'from-green-500/20 via-green-500/10 to-background', label: 'Green' },
  { value: 'from-purple-500/20 via-purple-500/10 to-background', label: 'Purple' },
  { value: 'from-orange-500/20 via-orange-500/10 to-background', label: 'Orange' },
  { value: 'from-pink-500/20 via-pink-500/10 to-background', label: 'Pink' },
  { value: 'from-red-500/20 via-red-500/10 to-background', label: 'Red' },
  { value: 'from-yellow-500/20 via-yellow-500/10 to-background', label: 'Yellow' },
];

const AddEditHeroBanner = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    subtitle: "",
    gradient: 'none',
    image_url: null as string | null,
    youtube_url: "",
    link_url: "",
    is_active: true,
  });
  const [uploading, setUploading] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [maxSortOrder, setMaxSortOrder] = useState(0);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchMaxSortOrder();
    if (isEditMode && id) {
      fetchBanner(id);
    }
  }, [id, isEditMode]);

  const fetchMaxSortOrder = async () => {
    const { data } = await supabase
      .from('hero_banners')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1);
    
    if (data && data.length > 0) {
      setMaxSortOrder(data[0].sort_order);
    }
  };

  const fetchBanner = async (bannerId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('hero_banners')
        .select('*')
        .eq('id', bannerId)
        .single();

      if (error) throw error;
      
      if (data) {
        setFormData({
          title: data.title || "",
          subtitle: data.subtitle || "",
          gradient: data.gradient || 'none',
          image_url: data.image_url,
          youtube_url: data.youtube_url || "",
          link_url: data.link_url || "",
          is_active: data.is_active,
        });
        // Store original image URL for cleanup when replacing
        setOriginalImageUrl(data.image_url);
      }
    } catch (error) {
      console.error('Error fetching banner:', error);
      toast.error('Failed to load banner');
      navigate('/owner-portal/hero-banners');
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size must be less than 5MB');
        return;
      }
      if (!file.type.startsWith('image/')) { toast.error('Please select an image'); return; }
      setCropFile(file);
      setCropOpen(true);
      e.target.value = "";
    }
  };

  const handleOriginalImage = async (file: File) => {
    setUploading(true);
    try {
      // Retain the published file until its replacement is saved.
      const oldImageUrl = formData.image_url;
      const { url: publicUrl } = await uploadBannerToR2(file);
      setFormData(prev => ({ ...prev, image_url: publicUrl }));
      if (oldImageUrl && oldImageUrl !== originalImageUrl) {
        await deleteBannerFromR2(oldImageUrl);
        await cleanupBannerImage(oldImageUrl);
      }
      toast.success('Image uploaded successfully');
      return true;
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload image');
      return false;
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    // Delete image from R2 / storage
    if (formData.image_url && formData.image_url !== originalImageUrl) {
      await deleteBannerFromR2(formData.image_url);
      await cleanupBannerImage(formData.image_url);
    }
    setFormData({ ...formData, image_url: null });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isEditMode && id) {
        const { error } = await supabase
          .from('hero_banners')
          .update(formData)
          .eq('id', id);

        if (error) throw error;
        toast.success('Banner updated successfully');
      } else {
        const { error } = await supabase
          .from('hero_banners')
          .insert({
            ...formData,
            sort_order: maxSortOrder + 1
          });

        if (error) throw error;
        toast.success('Banner created successfully');
      }

      notifyBannerUpdate();
      if (originalImageUrl && originalImageUrl !== formData.image_url) {
        await deleteBannerFromR2(originalImageUrl);
        await cleanupBannerImage(originalImageUrl);
      }
      navigate('/owner-portal/hero-banners');
    } catch (error) {
      console.error('Error saving banner:', error);
      toast.error('Failed to save banner');
    } finally {
      setLoading(false);
    }
  };

  if (loading && isEditMode) {
    return (
      <div className="container mx-auto p-4 flex items-center justify-center min-h-[50vh]">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 pb-24 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/owner-portal/hero-banners')}
          className="shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">
            {isEditMode ? 'Edit Banner' : 'Add New Banner'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isEditMode ? 'Update banner details' : 'Create a new hero banner'}
          </p>
        </div>
      </div>

      {/* Form */}
      <ImageCropDialog open={cropOpen} onOpenChange={setCropOpen} imageFile={cropFile}
        onCropComplete={handleOriginalImage} aspectRatio={1.91} title="Crop Banner Image" preservePixels />
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Banner Details</CardTitle>
          <CardDescription>Fill in the details for the banner</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title (Optional)</Label>
              <ReactQuill
                theme="snow"
                value={formData.title}
                onChange={(value) => setFormData({ ...formData, title: value })}
                placeholder="e.g., Find Your Dream Remote Job"
                className="bg-background [&_.ql-editor]:min-h-[80px]"
                modules={{
                  toolbar: [
                    ['bold', 'italic', 'underline'],
                    [{ 'color': [] }, { 'background': [] }],
                    [{ 'align': [] }],
                    ['clean']
                  ]
                }}
              />
            </div>

            {/* Subtitle */}
            <div className="space-y-2">
              <Label htmlFor="subtitle">Subtitle (Optional)</Label>
              <ReactQuill
                theme="snow"
                value={formData.subtitle}
                onChange={(value) => setFormData({ ...formData, subtitle: value })}
                placeholder="e.g., Connect with top employers hiring remotely"
                className="bg-background [&_.ql-editor]:min-h-[80px]"
                modules={{
                  toolbar: [
                    ['bold', 'italic', 'underline'],
                    [{ 'color': [] }, { 'background': [] }],
                    [{ 'align': [] }],
                    ['clean']
                  ]
                }}
              />
            </div>

            {/* Background Gradient */}
            <div className="space-y-2">
              <Label htmlFor="gradient">Background Gradient</Label>
              <Select
                value={formData.gradient}
                onValueChange={(value) => setFormData({ ...formData, gradient: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {gradientOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* YouTube Video URL */}
            <div className="space-y-2">
              <Label htmlFor="youtube_url" className="flex items-center gap-2">
                <Youtube className="w-4 h-4 text-red-600" />
                YouTube Video URL
              </Label>
              <Input
                id="youtube_url"
                type="url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={formData.youtube_url}
                onChange={(e) => setFormData({ ...formData, youtube_url: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Add a YouTube video URL for a video banner
              </p>
              {/* YouTube Preview */}
              {formData.youtube_url && extractYouTubeId(formData.youtube_url) && (
                <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                  <img
                    src={`https://img.youtube.com/vi/${extractYouTubeId(formData.youtube_url)}/maxresdefault.jpg`}
                    alt="Video thumbnail"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                    <div className="bg-red-600 rounded-full p-3">
                      <Play className="w-6 h-6 text-white fill-white" />
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => setFormData({ ...formData, youtube_url: "" })}
                  >
                    Remove
                  </Button>
                </div>
              )}
            </div>

            {/* Banner Image */}
            <div className="space-y-2">
              <Label>Banner Image (Optional)</Label>
              {formData.image_url && (
                <div className="relative">
                  <img
                    src={formData.image_url}
                    alt="Preview"
                    className="w-full h-40 object-cover object-center rounded-lg border"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={handleRemoveImage}
                    disabled={uploading}
                  >
                    Remove
                  </Button>
                </div>
              )}
              <div className="relative">
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp,image/avif,image/bmp"
                  onChange={handleImageSelect}
                  disabled={uploading}
                  className="file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Banner ratio: 1.91:1. Max 5MB source, 10MB cropped image.
              </p>
            </div>

            {/* Link URL */}
            <div className="space-y-2">
              <Label htmlFor="link_url">Link URL (Optional)</Label>
              <Input
                id="link_url"
                type="url"
                placeholder="https://example.com"
                value={formData.link_url}
                onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Banner will open this link when clicked
              </p>
            </div>

            {/* Active Status */}
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
              <div>
                <Label htmlFor="is_active" className="cursor-pointer font-medium">
                  Active Status
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Show this banner on homepage
                </p>
              </div>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className={`h-40 rounded-lg relative overflow-hidden border ${!formData.image_url && formData.gradient !== 'none' ? `bg-gradient-to-br ${formData.gradient}` : 'bg-muted'}`}>
                {formData.image_url && (
                  <img
                    src={formData.image_url}
                    alt="Preview"
                    className="absolute inset-0 w-full h-full object-cover object-center"
                  />
                )}
                {(formData.title?.replace(/<[^>]*>/g, '').trim() || formData.subtitle?.replace(/<[^>]*>/g, '').trim()) && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                    <div className={formData.image_url ? 'bg-background/60 rounded-xl px-4 py-3' : ''}>
                      {formData.title && formData.title.replace(/<[^>]*>/g, '').trim() && (
                        <h2 
                          className="text-base font-bold text-foreground mb-1"
                          dangerouslySetInnerHTML={{ __html: formData.title }}
                        />
                      )}
                      {formData.subtitle && formData.subtitle.replace(/<[^>]*>/g, '').trim() && (
                        <p 
                          className="text-sm text-muted-foreground"
                          dangerouslySetInnerHTML={{ __html: formData.subtitle }}
                        />
                      )}
                    </div>
                  </div>
                )}
                {!formData.title?.replace(/<[^>]*>/g, '').trim() && !formData.subtitle?.replace(/<[^>]*>/g, '').trim() && !formData.image_url && !formData.youtube_url && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">Add content to see preview</p>
                  </div>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <Button 
                type="submit" 
                disabled={uploading || loading} 
                className="w-full h-12 text-base"
              >
                {uploading ? 'Uploading...' : loading ? 'Saving...' : isEditMode ? 'Update Banner' : 'Create Banner'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>


    </div>
  );
};

export default AddEditHeroBanner;
