import { useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SafeAvatarImage } from "@/components/ui/safe-image";
import { Badge } from "@/components/ui/badge";
import { Copy, MapPin, Briefcase, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useNativeFeel } from "@/hooks/useNativeFeel";
import { useNavigate } from "react-router-dom";
import profileCoverImage from "@/assets/profile-cover.webp";
import { normalizeImageUrl } from "@/utils/imageUrl";
import { supabase } from "@/integrations/supabase/client";

interface ProfileHeaderProps {
  profile: any;
  user: any;
  experienceYears: number;
}

export const ProfileHeader = ({ profile, user, experienceYears }: ProfileHeaderProps) => {
  const { tapFeedback, successFeedback } = useNativeFeel();
  const navigate = useNavigate();
  const [fetchedOAuthAvatar, setFetchedOAuthAvatar] = useState<string | null>(null);

  const copyMemberId = () => {
    if (user) {
      tapFeedback();
      navigator.clipboard.writeText(user.id);
      successFeedback();
    }
  };

  const getInitials = () => {
    if (profile?.full_name) {
      return profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase();
    }
    return user?.email?.charAt(0).toUpperCase() || 'U';
  };

  // Pull avatar directly from the live OAuth session as a fallback, so the
  // Google/LinkedIn DP shows even if the profile row hasn't been backfilled
  // yet (or the DB write was blocked on the production domain).
  const meta: any = user?.user_metadata || {};
  const identities: any[] = (user as any)?.identities || [];
  const identityAvatar = identities
    .map((i: any) => i?.identity_data || {})
    .map((d: any) => d.avatar_url || d.picture || d.picture_url || d.avatar)
    .find(Boolean);
  const oauthAvatar =
    meta.avatar_url ||
    meta.picture ||
    meta.picture_url ||
    meta.avatar ||
    meta.profile_picture ||
    meta.profile_image_url ||
    identityAvatar ||
    fetchedOAuthAvatar ||
    null;
  const avatarSrc =
    normalizeImageUrl(profile?.profile_image_url) ||
    normalizeImageUrl(oauthAvatar);

  // On production (custom domain), `user.identities` is sometimes empty on
  // the initial getSession() result, so the Google/LinkedIn DP doesn't show.
  // Fetch the full user from Supabase (which always includes identities) and
  // backfill `profiles.profile_image_url` so it persists for future visits.
  useEffect(() => {
    if (avatarSrc) return;
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (cancelled) return;
        const u: any = data?.user;
        if (!u) return;
        const m: any = u.user_metadata || {};
        const ids: any[] = u.identities || [];
        const fromIds = ids
          .map((i: any) => i?.identity_data || {})
          .map((d: any) => d.avatar_url || d.picture || d.picture_url || d.avatar)
          .find(Boolean);
        const found =
          m.avatar_url ||
          m.picture ||
          m.picture_url ||
          m.avatar ||
          m.profile_picture ||
          m.profile_image_url ||
          fromIds ||
          null;
        if (!found) return;
        setFetchedOAuthAvatar(found);
        // Best-effort: persist so the avatar shows instantly next time.
        if (!profile?.profile_image_url) {
          await supabase
            .from("profiles")
            .update({ profile_image_url: found })
            .eq("user_id", user.id);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [avatarSrc, user?.id, profile?.profile_image_url]);

  return (
    <div className="relative">
      {/* Cover Photo - Technology/Work Theme */}
      <div className="h-32 relative overflow-hidden">
        <img loading="lazy" decoding="async" 
          src={profileCoverImage} 
          alt="Profile Cover" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/20" />
        
        {/* Back Button */}
        <button
          onClick={() => {
            tapFeedback();
            navigate(-1);
          }}
          className="absolute top-4 left-4 w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform shadow-lg z-10 border border-border/50"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
      </div>

      {/* Profile Photo - Overlapping Style */}
      <div className="px-4 -mt-16 relative z-10">
        <div className="flex items-end gap-4">
          <Avatar className="w-28 h-28 border-4 border-background shadow-large">
            <SafeAvatarImage
              src={avatarSrc}
              alt={profile?.full_name || "User"}
              width={224}
            />
            <AvatarFallback className="text-3xl font-bold bg-gradient-primary text-primary-foreground">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          

          
          {/* Quick Stats - LinkedIn Style */}
          <div className="flex-1 pb-2">
            <div className="flex gap-6">
              {experienceYears > 0 && (
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">{experienceYears}</p>
                  <p className="text-xs text-muted-foreground">Years Exp</p>
                </div>
              )}
              {profile?.skills?.length > 0 && (
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">{profile.skills.length}</p>
                  <p className="text-xs text-muted-foreground">Skills</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Name & Title */}
        <div className="mt-3">
          <h1 className="text-xl font-bold text-foreground">
            {profile?.full_name || user?.email}
          </h1>
          
          {profile?.current_position && (
            <div className="flex items-center gap-1.5 mt-1">
              <Briefcase className="w-4 h-4 text-primary" />
              <p className="text-sm font-medium text-muted-foreground">
                {profile.current_position}
              </p>
            </div>
          )}
          
          {profile?.location && (
            <div className="flex items-center gap-1.5 mt-1">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{profile.location}</p>
            </div>
          )}

          {/* Member ID Badge */}
          <button
            onClick={copyMemberId}
            className="flex items-center gap-2 mt-3 active:scale-95 transition-transform"
          >
            <Badge variant="secondary" className="font-mono text-xs px-2 py-1">
              ID: {user?.id?.slice(0, 8)}...{user?.id?.slice(-4)}
              <Copy className="w-3 h-3 ml-1.5" />
            </Badge>
          </button>
        </div>
      </div>
    </div>
  );
};
