import { describe, expect, it } from 'vitest';
import { normalizeForSave, packagePrice, visiblePackages } from './jobPostingPackages';

describe('job posting packages', () => {
  it('uses the owner-edited points over a stale price', () => {
    expect(packagePrice({ points: 499, price: 299 })).toBe(499);
  });

  it('shows lowest price first, then shorter duration on ties', () => {
    const list = visiblePackages([
      { months: 12, points: 299 },
      { months: 1, points: 160 },
      { months: 6, points: 299 },
      { months: 2, points: 240 },
    ]);
    expect(list.map((p) => p.months)).toEqual([1, 2, 6, 12]);
  });

  it('hides packages the owner switched off', () => {
    const list = visiblePackages([{ months: 1, points: 100 }, { months: 3, points: 200, is_active: false }]);
    expect(list.map((p) => p.months)).toEqual([1]);
  });

  it('saves price equal to points', () => {
    expect(normalizeForSave([{ months: 1, points: 180, price: 160 }])[0].price).toBe(180);
  });
});
