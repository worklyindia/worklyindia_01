import { assertEquals } from 'jsr:@std/assert';
import { emailImageSource } from '../_shared/emailImageAssets.ts';
const origin = 'https://id-preview--b9ded112-1190-4a4d-8689-7209cc25b712.lovable.app';
Deno.test('relative email asset paths become absolute public sources', () => {
  const path = '/__l5e/assets-v1/fef6911d-5bec-4de5-a61a-4cf987653a17/instagram-transparent.png';
  assertEquals(emailImageSource(path, origin), origin + path);
});
Deno.test('email asset copying refuses non-HTTPS and arbitrary server destinations', () => {
  assertEquals(emailImageSource('http://localhost/private.png', origin), null);
  assertEquals(emailImageSource('https://example.com/private.png', origin), null);
  assertEquals(emailImageSource('https://fake.lovable.app.evil.com/__l5e/assets-v1/a/b.png', origin), null);
});