import { format } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Formats a date to DD/MM/YYYY with 12-hour time format in IST
 * @param date - Date string or Date object (UTC)
 * @returns Formatted date string in DD/MM/YYYY, hh:mm AM/PM format (IST)
 */
export const formatDateWithTime = (date: string | Date): string => {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) return '';
  
  return formatInTimeZone(dateObj, IST_TIMEZONE, 'dd MMMM yyyy, hh:mm a');
};

/**
 * Formats a date string, showing time ONLY when the source string actually
 * carries a time component. Date-only strings (e.g. "2026-07-08") won't be
 * misrendered as "12:00 AM". Returns empty string for invalid input.
 */
export const formatDateSmart = (date: string | Date): string => {
  if (!date) return '';
  const raw = typeof date === 'string' ? date : date.toISOString();
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return '';
  const hasTimeComponent = typeof date === 'string'
    ? (/\d{1,2}:\d{2}/.test(raw) && !(dateObj.getHours() === 0 && dateObj.getMinutes() === 0 && dateObj.getSeconds() === 0))
    : true;
  return formatInTimeZone(dateObj, IST_TIMEZONE, hasTimeComponent ? 'dd MMMM yyyy, hh:mm a' : 'dd MMMM yyyy');
};

/**
 * Formats a date to DD/MM/YYYY format only in IST
 * @param date - Date string or Date object (UTC)
 * @returns Formatted date string in DD/MM/YYYY format (IST)
 */
export const formatDateOnly = (date: string | Date): string => {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) return '';
  
  return formatInTimeZone(dateObj, IST_TIMEZONE, 'dd MMMM yyyy');
};

/**
 * Gets today's date in IST (format: YYYY-MM-DD)
 * @returns Today's date string in IST timezone
 */
export const getTodayIST = (): string => {
  return formatInTimeZone(new Date(), IST_TIMEZONE, 'yyyy-MM-dd');
};

/**
 * Gets the date portion of a timestamp in IST (format: YYYY-MM-DD)
 * @param date - Date string or Date object (UTC)
 * @returns Date string in IST timezone
 */
export const getDateInIST = (date: string | Date): string => {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) return '';
  
  return formatInTimeZone(dateObj, IST_TIMEZONE, 'yyyy-MM-dd');
};

/**
 * Formats a date to DD/MM/YYYY with 12-hour time format including seconds in IST
 * @param date - Date string or Date object (UTC)
 * @returns Formatted date string in DD/MM/YYYY, hh:mm:ss AM/PM format (IST)
 */
export const formatDateWithSeconds = (date: string | Date): string => {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) return '';
  
  return formatInTimeZone(dateObj, IST_TIMEZONE, 'dd MMMM yyyy, hh:mm:ss a');
};

/**
 * Checks if a given date is today in IST timezone
 * @param date - Date string or Date object (UTC)
 * @returns True if the date is today in IST
 */
export const isToday = (date: string | Date): boolean => {
  if (!date) {
    console.log('🔍 isToday: Empty date provided');
    return false;
  }
  
  const today = getTodayIST();
  const jobDate = getDateInIST(date);
  const result = today === jobDate;
  
  console.log('🔍 isToday Debug:', {
    input: date,
    todayIST: today,
    jobDateIST: jobDate,
    isToday: result
  });
  
  return result;
};