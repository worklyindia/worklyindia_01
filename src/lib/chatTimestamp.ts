import { format, isSameDay, isValid } from 'date-fns';

export function formatChatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return isValid(date) ? format(date, 'hh:mm a') : '';
}

export function formatChatDate(timestamp: string): string {
  const date = new Date(timestamp);
  return isValid(date) ? format(date, 'dd MMMM yyyy') : '';
}

export function startsChatDay(timestamp: string, previousTimestamp?: string): boolean {
  const date = new Date(timestamp);
  if (!isValid(date)) return false;
  return !previousTimestamp || !isSameDay(date, new Date(previousTimestamp));
}
