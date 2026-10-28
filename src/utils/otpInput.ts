/**
 * Shared helpers so every OTP box set behaves the same:
 * pasting or autofilling a full code fills every box, not just the first one.
 */

export interface OtpDistributionResult {
  otp: string[];
  focusIndex: number;
}

/**
 * Writes the digits found in `raw` into the boxes starting at `startIndex`.
 * Clearing a box (empty `raw`) is handled too.
 */
export function distributeOtpDigits(
  current: string[],
  startIndex: number,
  raw: string
): OtpDistributionResult {
  const digits = (raw || '').replace(/\D/g, '');
  const next = [...current];

  if (!digits) {
    next[startIndex] = '';
    return { otp: next, focusIndex: startIndex };
  }

  let i = startIndex;
  for (const digit of digits) {
    if (i >= next.length) break;
    next[i] = digit;
    i++;
  }

  return { otp: next, focusIndex: Math.min(i, next.length - 1) };
}

/** Extracts digits from a paste event, capped to the number of boxes. */
export function readPastedOtp(e: React.ClipboardEvent, length: number): string {
  return (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, length);
}
