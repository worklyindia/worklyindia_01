export function validateExternalApplyUrl(raw: string): string | null {
  const value = (raw || "").trim();
  if (!value) return null; // optional

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "Please enter a valid URL (example: https://your-company.com/apply)";
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return "URL must start with http:// or https://";
  }

  if (!url.hostname) {
    return "Please enter a valid URL (missing domain)";
  }

  if (value.length > 2048) {
    return "URL is too long (max 2048 characters)";
  }

  return null;
}
