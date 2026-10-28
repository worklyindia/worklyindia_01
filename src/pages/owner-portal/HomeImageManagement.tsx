import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Image as ImageIcon, Upload, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { goBack } from "@/lib/goBack";
import { mutateLoginImage } from "@/lib/r2LoginImages";
import { useAuthImages } from "@/hooks/useAuthImages";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import homeSeekersAsset from "@/assets/home-seekers.png.asset.json";
import homeHeroAsset from "@/assets/home-hero.png.asset.json";

/** Owner page: home page image shown below the domain section. Stored on Cloudflare R2. */
type HomeImageKey = "home_hero_image" | "home_seekers_image";
const COPY: Record<HomeImageKey, { title: string; desc: string; fallback: string }> = {
  home_hero_image: { title: "Home Image", desc: "This image shows on the home page below the domain section.", fallback: homeHeroAsset.url },
  home_seekers_image: { title: "Job Seekers Image", desc: "This image shows on the home page below \"Join 500,000+ job seekers\". Use a transparent PNG so it matches light and dark mode.", fallback: homeSeekersAsset.url },
};

const HomeImageManagement = ({ settingKey = "home_hero_image" }: { settingKey?: HomeImageKey }) => {
  const copy = COPY[settingKey];
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: authImages, isLoading } = useAuthImages();
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentImage = authImages?.[settingKey] || copy.fallback;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["auth-images"] });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be less than 5MB");
      return;
    }
    try {
      setUploading(true);
      const result = await mutateLoginImage("r2-save-login-image", settingKey, file);
      result.warnings.forEach((w) => toast.warning(w));
      refresh();
      toast.success("Home image updated successfully!");
    } catch (error: any) {
      toast.error(`Upload failed: ${error?.message || "Unknown error"}`);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    try {
      setRemoving(true);
      await mutateLoginImage("r2-remove-login-image", settingKey);
      refresh();
      toast.success("Home image removed");
    } catch (error: any) {
      toast.error(`Remove failed: ${error?.message || "Unknown error"}`);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b bg-background/95 px-2 py-3 backdrop-blur">
        <Button variant="ghost" size="icon" aria-label="Back" onClick={() => goBack(navigate, "/owner-portal")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <ImageIcon className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-semibold text-foreground">{copy.title}</h1>
      </header>

      <main className="w-full px-3 py-4 pb-24">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">
            {copy.desc} Uploads are stored on Cloudflare.
          </p>

          <div className="mt-4 flex items-center justify-center rounded-2xl border border-border/40 bg-muted/30 p-4">
            {isLoading ? (
              <p className="py-10 text-sm text-muted-foreground">Loading...</p>
            ) : (
              <img
                src={currentImage}
                alt="Home page image"
                className="max-h-64 w-full object-contain"
                draggable={false}
              />
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
          />

          <div className="mt-4 flex gap-2">
            <Button
              className="flex-1"
              onClick={() => inputRef.current?.click()}
              disabled={uploading || removing}
            >
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? "Uploading..." : "Upload New Image"}
            </Button>
            {authImages?.[settingKey] && (
              <Button
                variant="outline"
                onClick={handleRemove}
                disabled={uploading || removing}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {removing ? "Removing..." : "Remove"}
              </Button>
            )}
          </div>
        </Card>
      </main>
    </div>
  );
};

export default HomeImageManagement;
