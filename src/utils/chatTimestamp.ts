import { formatInTimeZone } from "date-fns-tz";

const IST = "Asia/Kolkata";

/**
 * Chat message stamp: "11/08/2026 • 03:47:22 PM" (IST)
 */
export const formatChatStamp = (date: string | Date = new Date()): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return formatInTimeZone(d, IST, "dd MMMM yyyy '•' hh:mm:ss a");
};
