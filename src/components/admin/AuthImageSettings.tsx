import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ImageCropDialog } from "@/components/brand/ImageCropDialog";
import { mutateLoginImage } from "@/lib/r2LoginImages";
import { toast } from "sonner";
import { Upload, Camera, User, Building2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthImages } from "@/hooks/useAuthImages";

interface AvatarUploadCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  currentImage: string | null;
  fallbackImage: string;
  settingKey: string;
  onUploadComplete: () => void;
}

const AvatarUploadCard = ({
  title,
  description,
  icon,
  currentImage,
  fallbackImage,
  settingKey,
  onUploadComplete,
}: AvatarUploadCardProps) => {
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be less than 5MB");
      return;
    }
    setSelectedFile(file);
    setCropDialogOpen(true);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const handleCropComplete = async (croppedFile: File) => {
    try {
      setUploading(true);

      // Saved to the dedicated R2 login bucket as original PNG; old file removed server-side.
      const result = await mutateLoginImage('r2-save-login-image', settingKey, croppedFile);
      result.warnings.forEach((w) => toast.warning(w));

      onUploadComplete();
      toast.success(`${title} updated successfully!`);
      setCropDialogOpen(false);
      setSelectedFile(null);
    } catch (error: any) {
      console.error("Error uploading avatar:", error);
      const msg =
        error?.message ||
        error?.error_description ||
        error?.error ||
        (typeof error === "string" ? error : "Failed to upload image");
      toast.error(`Upload failed: ${msg}`);
    } finally {
      setUploading(false);
    }
  };

  const inputId = `upload-${settingKey}`;

  return (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-primary/20 bg-card shadow-md">
            <img
              src={currentImage || fallbackImage}
              alt={title}
              className={settingKey === "home_hero_image"
                ? "w-full h-full object-cover object-top"
                : "w-full h-full object-contain object-center"
              }
              draggable={false}
              onContextMenu={(event) => event.preventDefault()}
            />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            {icon}
            {title}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
          <div className="mt-3">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              id={inputId}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.getElementById(inputId)?.click()}
              disabled={uploading}
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? "Uploading..." : "Change Image"}
            </Button>
          </div>
        </div>
      </div>

      <ImageCropDialog
        open={cropDialogOpen}
        onOpenChange={setCropDialogOpen}
        imageFile={selectedFile}
        onCropComplete={handleCropComplete}
        aspectRatio={1}
        preservePixels
        title={`Crop ${title}`}
      />
    </Card>
  );
};

export const AuthImageSettings = () => {
  const { data: authImages, isLoading } = useAuthImages();
  const queryClient = useQueryClient();

  const handleUploadComplete = () => {
    queryClient.invalidateQueries({ queryKey: ["auth-images"] });
  };

  if (isLoading) {
    return <p className="text-center text-muted-foreground py-8">Loading...</p>;
  }

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-2 flex items-center">
        <Camera className="w-5 h-5 mr-2 text-primary" />
        Login Page Avatars
      </h2>
      <p className="text-sm text-muted-foreground mb-6">
        Upload and crop images shown on Job Seeker & Employer login/signup pages
      </p>

      <div className="space-y-4">
        <AvatarUploadCard
          title="Job Seeker Avatar"
          description="Image shown on Job Seeker login & signup page"
          icon={<User className="w-4 h-4" />}
          currentImage={authImages?.job_seeker_avatar || null}
          fallbackImage="/src/assets/job-seeker-hero.webp"
          settingKey="job_seeker_login_avatar"
          onUploadComplete={handleUploadComplete}
        />

        <AvatarUploadCard
          title="Employer Avatar"
          description="Image shown on Employer login & signup page"
          icon={<Building2 className="w-4 h-4" />}
          currentImage={authImages?.employer_avatar || null}
          fallbackImage="/src/assets/employer-hero.webp"
          settingKey="employer_login_avatar"
          onUploadComplete={handleUploadComplete}
        />


      </div>
    </Card>
  );
};
