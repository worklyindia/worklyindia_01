import { describe, expect, it } from 'vitest';
import { currentOffers, formatOfferPrice, visibleTlds, loadPublicDomainCards, popularDomainTlds } from './publicDomainCatalog';

describe('public domain catalogue', () => {
  it('selects 24 distinct supported familiar endings with owner-popular entries first', () => {
    const rows = ['com','in','org','net','co','co.in','io','ai','app','dev','shop','store','online','site','xyz','tech','info','biz','me','cloud','club','live','world','agency','fun'].map(tld => ({tld}));
    const selected = popularDomainTlds([...rows, {tld: '.COM'}, {tld: 'digital', is_popular: true}, {tld: 'bad', active: false}]);
    expect(selected).toHaveLength(24);
    expect(new Set(selected.map(row => row.tld)).size).toBe(24);
    expect(selected[0].tld).toBe('digital');
    expect(selected[1].tld).toBe('com');
    expect(selected.some(row => row.tld === 'bad')).toBe(false);
  });

  it('returns 24 distinct endings, using available alternative names rather than duplicate endings', async () => {
    const tlds = Array.from({length: 24}, (_, i) => ({tld: `ending${i}`}));
    const cards = await loadPublicDomainCards(tlds, [], async domain => ({domain, available: domain.startsWith('getworkly'), price: 1709, renewal_price: 5698, currency: 'INR'}));
    expect(cards).toHaveLength(24);
    expect(new Set(cards.map(card => card.tld)).size).toBe(24);
    expect(cards.every(card => card.domain.startsWith('getworkly.'))).toBe(true);
  });

  it('refreshes saved offers and preserves exact live purchase, renewal and term values', async () => {
    const progress: number[] = [];
    const cards = await loadPublicDomainCards([{tld: 'co'}, {tld: 'com'}], [{domain: 'getxyz.co', price: 1, renewal_price: 2}], async domain => ({domain, available: true, price: 1709, renewal_price: 5698, period_years: 2, currency: 'INR'}), 24, cards => progress.push(cards.length));
    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({domain: 'getxyz.com', price: 1709, renewal_price: 5698, period_years: 2, currency: 'INR'});
    expect(cards[1].price).toBe(1709);
    expect(progress).toEqual([1, 2]);
  });

  it('never invents quotes for taken names or missing renewal prices', async () => {
    const cards = await loadPublicDomainCards([{tld: 'com'}, {tld: 'net'}, {tld: 'org'}], [], async domain => ({domain, available: !domain.endsWith('.com'), price: 1709, renewal_price: domain.endsWith('.org') ? 5698 : undefined}));
    expect(cards.map(card => card.tld)).toEqual(['org']);
  });

  it('hides inactive endings and keeps popular ones first', () => {
    const list = visibleTlds([
      { tld: 'xyz', active: true, is_popular: false, sort_order: 1 },
      { tld: 'com', active: true, is_popular: true, sort_order: 9 },
      { tld: 'biz', active: false, is_popular: true, sort_order: 0 },
      { tld: 'in', active: true, is_popular: true, sort_order: 3 },
    ]);
    expect(list.map((row) => row.tld)).toEqual(['in', 'com', 'xyz']);
  });

  it('shows only today\'s available offers, cheapest first', () => {
    const list = currentOffers(
      [
        { domain: 'b', tld: 'com', available: true, customer_price: 900, offer_day: '2026-10-20', currency: 'INR' },
        { domain: 'a', tld: 'in', available: true, customer_price: 499, offer_day: '2026-10-20', currency: 'INR' },
        { domain: 'old', tld: 'com', available: true, customer_price: 100, offer_day: '2026-10-19', currency: 'INR' },
        { domain: 'taken', tld: 'com', available: false, customer_price: 200, offer_day: '2026-10-20', currency: 'INR' },
      ],
      '2026-10-20',
    );
    expect(list.map((row) => row.domain)).toEqual(['a', 'b']);
  });

  it('formats rupees without inventing a currency', () => {
    expect(formatOfferPrice(1709, 'INR')).toBe('₹1,709');
    expect(formatOfferPrice('1709', 'USD')).toBe('USD 1,709');
  });
});
