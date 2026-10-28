import { describe, expect, test } from 'bun:test';
import { metaMessageMedia, metaReactionEmoji } from './metaChatPresentation';
describe('Meta chat media and heart normalization', () => {
  test('Facebook heart variants retain visible emoji presentation', () => {
    expect(metaReactionEmoji('♥')).toBe('♥️');
    expect(metaReactionEmoji('❤︎')).toBe('❤️');
    expect(metaReactionEmoji('heart')).toBe('❤️');
    expect(metaReactionEmoji('LOVE')).toBe('❤️');
  });
  test('old PDF link messages render as documents without duplicate URL text', () => {
    expect(metaMessageMedia({ text: 'Report\nhttps://example.com/storage/report.pdf' })).toEqual({
      attachments: [{ type: 'file', url: 'https://example.com/storage/report.pdf', name: 'report.pdf' }], text: 'Report',
    });
  });
  test('normal website links remain text', () => {
    expect(metaMessageMedia({ text: 'https://example.com/jobs' })).toEqual({ text: 'https://example.com/jobs', attachments: [] });
  });
});
