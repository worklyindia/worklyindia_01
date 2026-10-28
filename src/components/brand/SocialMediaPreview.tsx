import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, Facebook, Twitter, Linkedin, Send } from "lucide-react";
import { storageImageUrl } from "@/utils/imageUrl";
import { CANONICAL_DOMAIN } from '@/config/domainConfig';

interface SocialMediaPreviewProps {
  title: string;
  description: string;
  imageUrl: string;
  url?: string;
  isUnsaved?: boolean;
}

export const SocialMediaPreview = ({ 
  title, 
  description, 
  imageUrl,
  url = CANONICAL_DOMAIN,
  isUnsaved = false
}: SocialMediaPreviewProps) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Preview on Social Media</h3>
        {isUnsaved && (
          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
            ⚠️ Not saved yet
          </span>
        )}
      </div>
      
      <div className="grid gap-4 md:grid-cols-2">
        {/* WhatsApp Preview */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-green-600" />
              WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="border rounded-lg overflow-hidden bg-background">
              {imageUrl && (
                <img loading="lazy" decoding="async" 
                  src={storageImageUrl(imageUrl, 600) || imageUrl} 
                  alt="Preview" 
                  className="w-full h-32 object-cover"
                />
              )}
              <div className="p-3 space-y-1">
                <p className="font-semibold text-xs line-clamp-1">{title}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
                <p className="text-xs text-muted-foreground">{url}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Facebook Preview */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Facebook className="w-4 h-4 text-blue-600" />
              Facebook
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="border rounded-lg overflow-hidden bg-background">
              {imageUrl && (
                <img loading="lazy" decoding="async" 
                  src={storageImageUrl(imageUrl, 600) || imageUrl} 
                  alt="Preview" 
                  className="w-full h-32 object-cover"
                />
              )}
              <div className="p-3 space-y-1 bg-muted/50">
                <p className="text-xs text-muted-foreground uppercase">{url}</p>
                <p className="font-semibold text-sm line-clamp-1">{title}</p>
                <p className="text-xs text-muted-foreground line-clamp-1">{description}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Twitter Preview */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Twitter className="w-4 h-4 text-blue-400" />
              Twitter/X
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="border rounded-xl overflow-hidden bg-background">
              {imageUrl && (
                <img loading="lazy" decoding="async" 
                  src={storageImageUrl(imageUrl, 600) || imageUrl} 
                  alt="Preview" 
                  className="w-full h-32 object-cover"
                />
              )}
              <div className="p-3 space-y-1">
                <p className="font-semibold text-sm line-clamp-1">{title}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
                <p className="text-xs text-muted-foreground">{url}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Telegram Preview */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Send className="w-4 h-4 text-blue-500" />
              Telegram
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="border rounded-lg overflow-hidden bg-background">
              {imageUrl && (
                <img loading="lazy" decoding="async" 
                  src={storageImageUrl(imageUrl, 600) || imageUrl} 
                  alt="Preview" 
                  className="w-full h-32 object-cover"
                />
              )}
              <div className="p-3 space-y-1">
                <p className="font-semibold text-xs line-clamp-1">{title}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-muted/50 border rounded-lg p-3 space-y-1">
        <p className="text-xs font-medium">💡 महत्वपूर्ण जानकारी:</p>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
          <li>सोशल मीडिया इमेज का सबसे अच्छा साइज: <strong>1200x630px (1.91:1 ratio)</strong></li>
          <li>अपडेट करने के बाद "Save Brand Assets" बटन पर क्लिक करना न भूलें</li>
          <li>सोशल मीडिया पर नई इमेज दिखने में 5-10 मिनट लग सकते हैं</li>
        </ul>
      </div>
    </div>
  );
};
