import { assert, assertEquals, assertThrows } from 'jsr:@std/assert@1';
import { buildMediaKey, canDeleteMedia, decodeMedia, ownsUploadKey, parseMediaKey, mediaExtension } from './mediaR2.ts';

const uid = '11111111-2222-3333-4444-555555555555';
const other = '99999999-2222-3333-4444-555555555555';

Deno.test('job key belongs to its uploader', () => {
  const key = buildMediaKey('jobs', uid, 'png');
  assertEquals(parseMediaKey(key)?.scope, 'jobs');
  assert(canDeleteMedia(key, uid, false));
  assert(!canDeleteMedia(key, other, false));
  assert(canDeleteMedia(key, other, true));
});

Deno.test('unknown scope or path traversal rejected', () => {
  assertEquals(parseMediaKey(`media/evil/${uid}/a.png`), null);
  assertEquals(parseMediaKey(`hero-banners/x.png`), null);
  assertEquals(parseMediaKey(`media/jobs/${uid}/../x.png`), null);
});

Deno.test('png kept as png, not webp', () => {
  const d = decodeMedia('data:image/png;base64,iVBORw0KGgo=');
  assertEquals(d.contentType, 'image/png');
  assertEquals(d.extension, 'png');
  assertThrows(() => decodeMedia('data:application/x-msdownload;base64,AAAA'));
});

Deno.test('direct upload keeps PNG video PDF formats and rejects another upload owner', () => {
  assertEquals(mediaExtension('image/png'), 'png');
  assertEquals(mediaExtension('video/mp4'), 'mp4');
  assertEquals(mediaExtension('application/pdf'), 'pdf');
  const key = buildMediaKey('jobs', uid, 'png');
  assert(ownsUploadKey(key, 'jobs', uid));
  assert(!ownsUploadKey(key, 'jobs', other));
  assert(!ownsUploadKey(key, 'brand', uid));
});
