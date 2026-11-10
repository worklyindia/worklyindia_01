/** Commit the new reference before deleting the old object; never break saved artwork. */
export async function replaceSavedMedia(options: {
  oldUrl?: string;
  upload?: () => Promise<string>;
  save: (url: string) => Promise<void>;
  cleanup: (url: string) => Promise<boolean>;
}): Promise<{ url: string; cleanupPending: boolean }> {
  const url = options.upload ? await options.upload() : '';
  try {
    await options.save(url);
  } catch (error) {
    if (url) await options.cleanup(url).catch(() => false);
    throw error;
  }
  const cleaned = !options.oldUrl || options.oldUrl === url
    ? true : await options.cleanup(options.oldUrl).catch(() => false);
  return { url, cleanupPending: !cleaned };
}