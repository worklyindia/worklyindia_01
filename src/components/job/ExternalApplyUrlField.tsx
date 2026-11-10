import { ExternalLink, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  applyMode?: string;
};

export function ExternalApplyUrlField({ id = "externalApplyUrl", value, onChange, error, applyMode = "both" }: Props) {
  const hasValue = value.trim().length > 0;
  const externalOnly = applyMode === "external";

  return (
    <div className="space-y-3">
      {/* Section header (like YouTube Videos label) */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <ExternalLink className="w-5 h-5 text-primary" />
          <Label htmlFor={id} className="text-base font-semibold truncate">
            External Website
          </Label>
        </div>
        <Badge variant="outline" className="text-xs shrink-0">
          Required
        </Badge>
      </div>

      {/* Content box */}
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {externalOnly
            ? "Note: The application will NOT be saved on Workly India. Candidates will be sent directly to your website to apply."
            : "Candidates will apply on Workly India first, and then be redirected to this website to complete the process."}
        </p>


        <Input
          id={id}
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://your-company.com/careers/apply"
          className="w-full"
          aria-invalid={!!error}
        />

        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : hasValue ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Globe className="w-4 h-4" />
            <span>Candidates will be redirected after applying</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
