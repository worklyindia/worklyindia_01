import PublishSettingsDialog from "./PublishSettingsDialog";

interface PublishSettingsProps {
  visibility: string;
  onVisibilityChange: (value: string) => void;
  publishMode: string;
  onPublishModeChange: (value: string) => void;
  scheduledDate: Date | undefined;
  onScheduledDateChange: (date: Date | undefined) => void;
  className?: string;
  // Preview props (not used anymore but keeping for compatibility)
  jobTitle?: string;
  companyName?: string;
  location?: string;
  showPreview?: boolean;
}

const PublishSettings = ({
  visibility,
  onVisibilityChange,
  publishMode,
  onPublishModeChange,
  scheduledDate,
  onScheduledDateChange,
  className,
  jobTitle = "",
  companyName = "",
  location = "",
  showPreview = true
}: PublishSettingsProps) => {
  return (
    <div className="space-y-6">
      <PublishSettingsDialog
        visibility={visibility}
        onVisibilityChange={onVisibilityChange}
        publishMode={publishMode}
        onPublishModeChange={onPublishModeChange}
        scheduledDate={scheduledDate}
        onScheduledDateChange={onScheduledDateChange}
        jobTitle={jobTitle}
        companyName={companyName}
        location={location}
      />
    </div>
  );
};

export default PublishSettings;
