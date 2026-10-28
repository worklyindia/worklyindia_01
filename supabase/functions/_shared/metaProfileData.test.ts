import { expect, test } from 'bun:test';
import { publicMetaProfile } from './metaProfileData';

test('Instagram retains real account name separately from username and its real DP', () => {
  const profile = publicMetaProfile('instagram', { name: 'Workly India', username: 'worklyindia_24', profile_picture_url: 'https://example.com/dp.jpg', followers_count: 0 });
  expect(profile.name).toBe('Workly India');
  expect(profile.username).toBe('worklyindia_24');
  expect(profile.picture_url).toBe('https://example.com/dp.jpg');
  expect(profile.followers_count).toBe(0);
});
test('Facebook uses Page DP and does not expose token or unrelated private fields', () => {
  const profile = publicMetaProfile('facebook', { id: '123456', picture: { data: { url: 'https://example.com/page.jpg' } }, is_published: false, access_token: 'private', user_id: 'internal' });
  expect(profile.picture_url).toBe('https://example.com/page.jpg');
  expect(profile.id).toBe('123456');
  expect(profile.is_published).toBe(false);
  expect(profile).not.toHaveProperty('access_token');
  expect(profile).not.toHaveProperty('user_id');
});
test('No actual name is invented from an Instagram username', () => {
  expect(publicMetaProfile('instagram', { username: 'worklyindia_24' })).not.toHaveProperty('name');
});