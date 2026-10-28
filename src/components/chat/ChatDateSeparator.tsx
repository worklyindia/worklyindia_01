import { formatChatDate } from '@/lib/chatTimestamp';

export function ChatDateSeparator({ timestamp }: { timestamp: string }) {
  const label = formatChatDate(timestamp);
  if (!label) return null;
  return (
    <div className="flex justify-center py-4" role="separator" aria-label={label}>
      <span className="rounded-md bg-whatsapp-panel px-3 py-1.5 text-xs font-medium text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
