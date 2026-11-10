import { expect, test } from 'bun:test';
import { readMetaProfile } from './metaProfileReader';

test('Instagram unsupported name does not block username or account DP', async () => {
  const result = await readMetaProfile('instagram', async (fields) => {
    if (fields.includes(',') || fields === 'name') throw new Error('Unsupported field');
    if (fields === 'id') return { id: '17841433089585416' };
    if (fields === 'username') return { username: 'worklyindia_24' };
    if (fields === 'profile_picture_url') return { profile_picture_url: 'https://example.com/real-dp.jpg' };
    return {};
  });
  expect(result.profile.username).toBe('worklyindia_24');
  expect(result.profile.picture_url).toBe('https://example.com/real-dp.jpg');
  expect(result.partial).toBe(true);
});

test('Facebook requests a 512 pixel account photo and retains it when optional fields fail', async () => {
  const result = await readMetaProfile('facebook', async (fields) => {
    if (fields === 'id') return { id: '1322818570914999' };
    if (fields === 'picture.width(512).height(512){url,is_silhouette}') return { picture: { data: { url: 'https://example.com/page-dp.jpg' } } };
    throw new Error('Unsupported field');
  });
  expect(result.profile.picture_url).toBe('https://example.com/page-dp.jpg');
});

test('An invalid connection still fails rather than hiding a refresh failure', async () => {
  await expect(readMetaProfile('instagram', async () => { throw new Error('Expired connection'); })).rejects.toThrow('Expired connection');
});