/** Read every page before deleting a chat; attachments need not be loaded on screen. */
export async function cleanupConversationMedia(
  ids: string[],
  read: (ids: string[], from: number, to: number) => Promise<{ metadata: unknown }[]>,
  remove: (url: string) => Promise<unknown>,
) {
  for (let from = 0; ; from += 500) {
    const rows = await read(ids, from, from + 499);
    for (const row of rows) {
      const meta = row.metadata;
      if (meta && typeof meta === 'object' && 'media_url' in meta && typeof meta.media_url === 'string') await remove(meta.media_url);
    }
    if (rows.length < 500) return;
  }
}