import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { NOTIFICATION_LOGO_URL } from './notificationLogo';

const source = readFileSync(new URL('../../public/firebase-messaging-sw.js', import.meta.url), 'utf8');
const build = (badge?: string) => {
  const context = vm.createContext({
    URL, Date, Notification: { prototype: { image: '', actions: [] } },
    self: { location: { origin: 'https://workly.example', toString: () => `https://workly.example/firebase-messaging-sw.js${badge ? `?badge=${encodeURIComponent(badge)}` : ''}` }, addEventListener() {} },
  });
  vm.runInContext(source, context);
  return (payload: unknown) => {
    context.payload = payload;
    return vm.runInContext('buildNotification(payload)', context);
  };
};

describe('notification badge restoration', () => {
  it('retains the badge and unsubscribe destination when rich display fails', async () => {
    let push: ((event: unknown) => void) | undefined;
    let pending: Promise<unknown> | undefined;
    const attempts: Array<Record<string, any>> = [];
    const context = vm.createContext({
      URL, Date, Notification: { prototype: { image: '', actions: [] } },
      self: {
        location: { origin: 'https://workly.example', toString: () => 'https://workly.example/firebase-messaging-sw.js?badge=https%3A%2F%2Fcdn.example%2Fsaved.png' },
        addEventListener: (type: string, callback: (event: unknown) => void) => { if (type === 'push') push = callback; },
        registration: { showNotification: async (_title: string, options: Record<string, any>) => {
          attempts.push(options);
          if (attempts.length === 1) throw new Error('Rich display failed');
        } },
      },
    });
    vm.runInContext(source, context);
    if (!push) throw new Error('Push handler missing');
    push({
      data: { json: () => ({ data: { actions: JSON.stringify([{ action: 'unsubscribe', title: 'Unsubscribe', url: '/unsubscribe' }]) } }) },
      waitUntil: (promise: Promise<unknown>) => { pending = promise; },
    });
    await pending;
    expect(attempts.length).toBe(2);
    expect(attempts[1].badge).toBe('https://cdn.example/saved.png');
    expect(attempts[1].data.actionUrls.unsubscribe).toBe('/unsubscribe');
  });
  it('uses supplied transparent W when no saved badge exists', () => {
    expect(build()({}).options.badge).toBe(NOTIFICATION_LOGO_URL);
  });
  it('preserves an owner-saved badge', () => {
    expect(build('https://cdn.example/owner.png')({}).options.badge).toBe('https://cdn.example/owner.png');
  });
  it('preserves notification content, banner and action destinations', () => {
    const result = build()({ data: {
      title: 'Workly India', body: 'New jobs', icon: '/logo.png', image: '/banner.jpg', url: '/jobs',
      actions: JSON.stringify([{ action: 'explore', title: 'Explore Now', url: '/jobs' }, { action: 'unsubscribe', title: 'Unsubscribe', url: '/unsubscribe' }]),
    } });
    expect(result.title).toBe('Workly India');
    expect(result.options.body).toBe('New jobs');
    expect(result.options.icon).toBe('https://workly.example/logo.png');
    expect(result.options.image).toBe('https://workly.example/banner.jpg');
    expect(Array.from(result.options.actions, (a: { title: string }) => a.title)).toEqual(['Explore Now', 'Unsubscribe']);
    expect(result.options.data.actionUrls.unsubscribe).toBe('/unsubscribe');
  });
});