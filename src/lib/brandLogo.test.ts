import { describe, expect, it } from 'bun:test';
import { resolveBrandLogo } from './brandLogo';

describe('owner logo resolution', () => {
  it('replaces the superseded primary artwork', () => {
    expect(resolveBrandLogo('https://example.com/logo_url-1792658068682.webp')).toBe('/icons/icon-192x192.png?v=20261022');
  });
  it('replaces the superseded favicon artwork', () => {
    expect(resolveBrandLogo('https://example.com/favicon_url-1792658227274.png', true)).toBe('/favicon.png?v=20261022b');
  });
  it('preserves a newly uploaded logo', () => {
    expect(resolveBrandLogo('https://example.com/new-owner-logo.png')).toBe('https://example.com/new-owner-logo.png');
  });
});