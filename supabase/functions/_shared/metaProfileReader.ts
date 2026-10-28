import { META_PROFILE_FIELDS, publicMetaProfile } from './metaProfileData.ts';

/** Unsupported optional fields must not make valid account metadata unavailable. */
export async function readMetaProfile(platform: 'instagram' | 'facebook', read: (fields: string) => Promise<Record<string, unknown>>) {
  const fields = META_PROFILE_FIELDS[platform].map((field) => field === 'picture' ? 'picture.width(512).height(512){url,is_silhouette}' : field);
  let raw: Record<string, unknown>;
  let partial = false;
  try {
    raw = await read(fields.join(','));
  } catch {
    // `name` is not supported for every Instagram login. Only id is mandatory.
    raw = await read('id');
    await Promise.all(fields.filter((field) => field !== 'id').map(async (field) => {
      try { Object.assign(raw, await read(field)); } catch { partial = true; }
    }));
  }
  return { profile: publicMetaProfile(platform, raw), partial };
}