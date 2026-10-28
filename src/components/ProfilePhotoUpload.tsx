import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SafeAvatarImage } from '@/components/ui/safe-image';
import { normalizeImageUrl } from '@/utils/imageUrl';
import { Camera, Upload, Crop as CropIcon, User } from 'lucide-react';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployerAuth } from '@/contexts/EmployerAuthContext';
import { useToast } from '@/hooks/use-toast';
import { cleanupProfilePhoto } from '@/utils/storageCleanup';
import { uploadImage } from '@/lib/mediaCdn';
import { supabase } from '@/integrations/supabase/client';

interface ProfilePhotoUploadProps {
  currentPhoto?: string;
  onPhotoUpdate: (photoUrl: string) => void;
  className?: string;
  useEmployerContext?: boolean;
  /** Only return the cropped URL; caller saves it. */
  skipSave?: boolean;
  /** Separate image namespace for independent profile types. */
  photoFolder?: string;
}

const ProfilePhotoUpload: React.FC<ProfilePhotoUploadProps> = ({
  currentPhoto,
  onPhotoUpdate,
  className = "",
  useEmployerContext = false,
  skipSave = false,
  photoFolder
}) => {
  const authContext = useAuth();
  const employerContext = useEmployerAuth();
  const { user } = useEmployerContext ? employerContext : authContext;
  const { toast } = useToast();
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [imageSrc, setImageSrc] = useState<string>('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [uploading, setUploading] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { toast: showToast } = useToast();

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showToast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Please select an image file (JPG, PNG, etc.)"
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showToast({
        variant: "destructive",
        title: "File too large",
        description: "Please select an image smaller than 5MB"
      });
      return;
    }

    const reader = new FileReader();
    reader.addEventListener('load', () => {
      const imageUrl = reader.result?.toString() || '';
      setImageSrc(imageUrl);
      setShowCropDialog(true);
    });
    reader.readAsDataURL(file);
  }, [showToast]);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const cropWidthInPercent = (150 / width) * 100;

    const crop = makeAspectCrop(
      {
        unit: '%',
        width: cropWidthInPercent,
      },
      1,
      width,
      height
    );
    const centeredCrop = centerCrop(crop, width, height);
    setCrop(centeredCrop);
  }, []);

  const getCroppedImg = useCallback((
    image: HTMLImageElement,
    crop: PixelCrop
  ): Promise<Blob> => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No 2D context');

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const cropWidth = crop.width * scaleX;
    const cropHeight = crop.height * scaleY;
    const maxOutputSize = 512;
    const outputScale = Math.min(1, maxOutputSize / Math.max(cropWidth, cropHeight));

    canvas.width = Math.max(1, Math.round(cropWidth * outputScale));
    canvas.height = Math.max(1, Math.round(cropHeight * outputScale));
    ctx.imageSmoothingQuality = 'high';

    const cropX = crop.x * scaleX;
    const cropY = crop.y * scaleY;

    ctx.drawImage(
      image,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      canvas.width,
      canvas.height
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Could not crop photo'));
      }, 'image/jpeg', 0.76);
    });
  }, []);

  const handleCropComplete = useCallback(async () => {
    if (!completedCrop || !imgRef.current || !user) return;

    try {
      setUploading(true);
      
      // Delete old photo from storage before uploading new one
      if (currentPhoto && !skipSave) {
        await cleanupProfilePhoto(currentPhoto);
      }
      
      const croppedImageBlob = await getCroppedImg(imgRef.current, completedCrop);

      // Convert blob → File and upload to Cloudinary (with ImageKit fallback)
      const fileName = `${user.id}-${Date.now()}-profile.jpg`;
      const croppedFile = new File([croppedImageBlob], fileName, { type: 'image/jpeg' });

      let publicUrl: string;
      if (photoFolder) {
        const path = `${photoFolder.replace(/^profile-photos\//, '').replace(/^\/+|\/+$/g, '')}/${Date.now()}-${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage.from('profile-photos').upload(path, croppedFile, {
          contentType: 'image/jpeg', cacheControl: '31536000', upsert: false,
        });
        if (error) throw error;
        publicUrl = supabase.storage.from('profile-photos').getPublicUrl(path).data.publicUrl;
      } else {
        const result = await uploadImage(croppedFile, {
          folder: `profile-photos/${user.id}`, fileName,
        });
        publicUrl = result.url;
      }

      // Store the clean URL only — cache-busting query params caused
      // broken images on production (Vercel) when CDNs / ImageKit
      // proxies couldn't preserve them. Also persist immediately so the DB
      // cannot keep pointing at a deleted/stale image after upload.
      const saveResult = skipSave ? null : useEmployerContext
        ? await employerContext.updateCompany({ logo_url: publicUrl } as any)
        : await authContext.updateProfile({ profile_image_url: publicUrl } as any);

      if (saveResult?.error) throw saveResult.error;

      // Update the caller before closing the crop view so the new image is
      // rendered immediately, even when the profile itself is saved later.
      onPhotoUpdate(publicUrl);
      setShowCropDialog(false);
      
      showToast({
        title: "Success",
        description: "Profile photo updated successfully!"
      });

    } catch (error) {
      console.error('Error uploading photo:', error);
      showToast({
        variant: "destructive",
        title: "Upload failed", 
        description: "Failed to upload photo. Please try again."
      });
    } finally {
      setUploading(false);
    }
  }, [completedCrop, user, getCroppedImg, useEmployerContext, employerContext, authContext, onPhotoUpdate, showToast, currentPhoto, skipSave, photoFolder]);

  return (
    <div className={`flex flex-col items-center space-y-4 ${className}`}>
      {/* Profile Photo Display */}
      <div className="relative">
        <Avatar className="w-24 h-24 border-4 border-background shadow-lg">
          <SafeAvatarImage src={normalizeImageUrl(currentPhoto)} alt="Profile" />
          <AvatarFallback className="bg-primary/10">
            <User className="w-12 h-12 text-muted-foreground" />
          </AvatarFallback>
        </Avatar>
        
        {/* Camera Icon Overlay */}
        <Button type="button" size="icon" aria-label="Change profile photo" className="absolute bottom-0 right-0 h-8 w-8 bg-primary rounded-full shadow-lg hover:bg-primary/90 transition-colors"
             onClick={() => fileInputRef.current?.click()}>
          <Camera className="w-4 h-4 text-primary-foreground" />
        </Button>
      </div>

      {/* Upload Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center space-x-2"
      >
        <Upload className="w-4 h-4" />
        <span>{currentPhoto ? 'Change Photo' : 'Add Photo'}</span>
      </Button>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Crop Dialog */}
      <Dialog open={showCropDialog} onOpenChange={setShowCropDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <CropIcon className="w-5 h-5" />
              <span>Crop Your Photo</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {imageSrc && (
              <div className="flex justify-center">
                <ReactCrop
                  crop={crop}
                  onChange={(_, percentCrop) => setCrop(percentCrop)}
                  onComplete={(c) => setCompletedCrop(c)}
                  aspect={1}
                  minWidth={100}
                  minHeight={100}
                  circularCrop
                >
                  <img
                    ref={imgRef}
                    alt="Crop me"
                    src={imageSrc}
                    style={{ maxHeight: '400px' }}
                    onLoad={onImageLoad}
                  />
                </ReactCrop>
              </div>
            )}
            
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setShowCropDialog(false)}
                disabled={uploading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCropComplete}
                disabled={!completedCrop || uploading}
              >
                {uploading ? 'Uploading...' : 'Save Photo'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProfilePhotoUpload;