import { confirmDialog } from '@/lib/confirmDialog';
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Edit, Eye, EyeOff, Image as ImageIcon, GripVertical, Youtube, Play } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cleanupBannerImage } from "@/utils/storageCleanup";
import { deleteBannerFromR2 } from "@/lib/r2Banner";
import { notifyBannerUpdate } from "@/lib/bannerUpdates";

interface HeroBanner {
  id: string;
  title: string;
  subtitle: string;
  gradient: string;
  image_url: string | null;
  youtube_url?: string | null;
  link_url?: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const extractYouTubeId = (url: string) => {
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
};

const HeroBannerManagement = () => {
  const navigate = useNavigate();
  const [banners, setBanners] = useState<HeroBanner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      const { data, error } = await supabase
        .from('hero_banners')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setBanners(data || []);
    } catch (error) {
      console.error('Error fetching banners:', error);
      toast.error('Failed to load banners');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmDialog('Are you sure you want to delete this banner?'))) return;

    try {
      // Find the banner to get the image URL before deletion
      const bannerToDelete = banners.find(b => b.id === id);
      
      const { error } = await supabase
        .from('hero_banners')
        .delete()
        .eq('id', id);

      if (error) throw error;
      notifyBannerUpdate();
      // Delete image from R2 / storage if it exists
      if (bannerToDelete?.image_url) {
        await deleteBannerFromR2(bannerToDelete.image_url);
        await cleanupBannerImage(bannerToDelete.image_url);
      }
      
      toast.success('Banner deleted successfully');
      fetchBanners();
    } catch (error) {
      console.error('Error deleting banner:', error);
      toast.error('Failed to delete banner');
    }
  };

  const toggleActive = async (banner: HeroBanner) => {
    try {
      const { error } = await supabase
        .from('hero_banners')
        .update({ is_active: !banner.is_active })
        .eq('id', banner.id);

      if (error) throw error;
      notifyBannerUpdate();
      toast.success(`Banner ${!banner.is_active ? 'activated' : 'deactivated'}`);
      fetchBanners();
    } catch (error) {
      console.error('Error toggling banner:', error);
      toast.error('Failed to update banner');
    }
  };

  return (
    <div className="container mx-auto p-3 sm:p-4 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 sm:gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/owner-portal')}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Hero Banner Management</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Manage homepage carousel banners</p>
          </div>
        </div>
        <Button onClick={() => navigate('/owner-portal/hero-banners/add')} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Add Banner
        </Button>
      </div>

      <Alert>
        <ImageIcon className="h-4 w-4 shrink-0" />
        <AlertDescription className="text-xs sm:text-sm">
          <strong>Best Practices:</strong> Use 1200x630px images for optimal display. All banners auto-play with 4-second intervals. Users can manually scroll using dots or swipe gestures.
        </AlertDescription>
      </Alert>

      {/* Banner List */}
      <Card>
        <CardHeader>
          <CardTitle>Existing Banners ({banners.length})</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Click edit to modify, toggle eye to activate/deactivate</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : banners.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No banners yet. Create your first banner!
            </div>
          ) : (
            banners.map((banner) => {
              const youtubeId = banner.youtube_url ? extractYouTubeId(banner.youtube_url) : null;
              return (
                <Card key={banner.id} className="overflow-hidden">
                  <div className={`relative ${(banner.image_url || youtubeId) ? 'aspect-[3/1]' : 'h-24 sm:h-28'} ${!banner.image_url && !youtubeId && banner.gradient !== 'none' ? `bg-gradient-to-br ${banner.gradient}` : 'bg-muted'}`}>
                    {/* YouTube Thumbnail */}
                    {youtubeId && (
                      <>
                        <img
                          src={`https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`}
                          alt={banner.title || 'Video Banner'}
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                          <div className="bg-red-600 rounded-full p-2">
                            <Play className="w-5 h-5 text-white fill-white" />
                          </div>
                        </div>
                        <div className="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                          <Youtube className="w-3 h-3" />
                          Video
                        </div>
                      </>
                    )}
                    {/* Regular Image */}
                    {!youtubeId && banner.image_url && (
                      <img
                        src={banner.image_url}
                        alt={banner.title || 'Banner'}
                        className="absolute inset-0 w-full h-full object-contain bg-muted"
                        loading="lazy"
                      />
                    )}
                    {/* Text overlay - only show if there's text and no video */}
                    {!youtubeId && (banner.title?.replace(/<[^>]*>/g, '').trim() || banner.subtitle?.replace(/<[^>]*>/g, '').trim()) && (
                      <div className="absolute inset-0 flex items-center justify-center text-center px-4">
                        <div className={banner.image_url ? 'bg-background/80 backdrop-blur-sm rounded-lg px-3 py-2' : ''}>
                          {banner.title && banner.title.replace(/<[^>]*>/g, '').trim() && (
                            <h3 
                              className="font-bold text-foreground text-sm sm:text-base"
                              style={banner.image_url ? { textShadow: '0 1px 2px rgba(0,0,0,0.2)' } : {}}
                              dangerouslySetInnerHTML={{ __html: banner.title }}
                            />
                          )}
                          {banner.subtitle && banner.subtitle.replace(/<[^>]*>/g, '').trim() && (
                            <p 
                              className="text-xs sm:text-sm text-muted-foreground"
                              style={banner.image_url ? { textShadow: '0 1px 2px rgba(0,0,0,0.1)' } : {}}
                              dangerouslySetInnerHTML={{ __html: banner.subtitle }}
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs sm:text-sm font-medium">Order: {banner.sort_order}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleActive(banner);
                        }}
                        className="h-10 w-10 sm:h-9 sm:w-9"
                      >
                        {banner.is_active ? (
                          <Eye className="h-5 w-5 sm:h-4 sm:w-4 text-green-600" />
                        ) : (
                          <EyeOff className="h-5 w-5 sm:h-4 sm:w-4 text-muted-foreground" />
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/owner-portal/hero-banners/edit/${banner.id}`);
                        }}
                        className="h-10 w-10 sm:h-9 sm:w-9"
                      >
                        <Edit className="h-5 w-5 sm:h-4 sm:w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(banner.id);
                        }}
                        className="h-10 w-10 sm:h-9 sm:w-9"
                      >
                        <Trash2 className="h-5 w-5 sm:h-4 sm:w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default HeroBannerManagement;
