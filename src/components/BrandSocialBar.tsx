import { useSocialLinks } from "@/hooks/useSocialLinks";
import { useEmailSocialIcons } from "@/hooks/useEmailSocialIcons";
import { SOCIAL_PLATFORMS, SOCIAL_LABELS, socialPlatformUrl } from "@/lib/emailSocialIcons";
import { Button } from "@/components/ui/button";

interface Props {
  className?: string;
  size?: "sm" | "md";
  align?: "start" | "center" | "end";
  title?: string;
}

export const BrandSocialBar = ({ className = "", size = "md", align = "center", title }: Props) => {
  const { socialLinks } = useSocialLinks();
  const { socialIcons } = useEmailSocialIcons();
  const entries = SOCIAL_PLATFORMS.flatMap(platform => {
    const url = socialLinks[platform]?.trim();
    return url ? [{ platform, url }] : [];
  });
  if (!entries.length) return null;
  const dim = size === "sm" ? "w-8 h-8" : "w-10 h-10";
  const alignCls = align === "start" ? "justify-start" : align === "end" ? "justify-end" : "justify-center";
  return (
    <div className={className}>
      {title && <p className="text-xs font-semibold text-muted-foreground text-center mb-2 uppercase tracking-wide">{title}</p>}
      <div className={`flex flex-wrap items-center gap-2 ${alignCls}`}>
        {entries.map(({ platform, url }) => (
          <Button key={platform} type="button" variant="ghost" size="icon"
            onClick={() => window.open(socialPlatformUrl(platform, url), "_blank", "noopener,noreferrer")}
            aria-label={SOCIAL_LABELS[platform]} title={SOCIAL_LABELS[platform]}
            className={`${dim} shrink-0 p-0 rounded-full hover:scale-110 active:scale-95 transition-transform motion-reduce:transition-none motion-reduce:transform-none`}>
            <img src={socialIcons[platform]} alt="" data-no-img-optimize="true" className="h-full w-full object-contain" />
          </Button>
        ))}
      </div>
    </div>
  );
};
export default BrandSocialBar;
