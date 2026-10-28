import { expect, it } from 'bun:test';
import { refreshNotificationWorker } from './notificationWorkerRefresh';

it('refreshes the saved badge on the same scope while retaining Firebase parameters', async () => {
  const calls: Array<{ url: string; options: RegistrationOptions | undefined }> = [];
  let updates = 0;
  const registration = {
    scope: 'https://workly.example/',
    active: { scriptURL: 'https://workly.example/firebase-messaging-sw.js?apiKey=public&projectId=workly&badge=old' },
    update: async () => { updates++; },
  } as unknown as ServiceWorkerRegistration;
  const workers = {
    getRegistration: async () => registration,
    register: async (url: string | URL, options?: RegistrationOptions) => {
      calls.push({ url: String(url), options });
      return registration;
    },
  };
  expect(await refreshNotificationWorker(workers, 'https://cdn.example/new.png')).toBe(true);
  const url = new URL(calls[0].url);
  expect(url.searchParams.get('badge')).toBe('https://cdn.example/new.png');
  expect(url.searchParams.get('apiKey')).toBe('public');
  expect(url.searchParams.get('projectId')).toBe('workly');
  expect(calls[0].options?.scope).toBe('https://workly.example/');
  expect(calls[0].options?.updateViaCache).toBe('none');
  expect(updates).toBe(1);
});

it('does not register a worker for a browser without an existing Firebase worker', async () => {
  let registrations = 0;
  const workers = {
    getRegistration: async () => undefined,
    register: async () => { registrations++; throw new Error('Must not create'); },
  };
  expect(await refreshNotificationWorker(workers, '/badge.png')).toBe(false);
  expect(registrations).toBe(0);
});