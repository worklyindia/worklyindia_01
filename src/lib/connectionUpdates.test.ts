import { afterEach, expect, test } from 'bun:test';
import { CONNECTION_UPDATE_KEY, notifyConnectionUpdated, subscribeConnectionUpdates } from './connectionUpdates';
const original = { window: globalThis.window, document: globalThis.document, localStorage: globalThis.localStorage };
afterEach(() => Object.assign(globalThis, original));
const pause = () => new Promise(resolve => setTimeout(resolve, 150));
function setup() {
  const win = new EventTarget();
  const values = new Map<string, string>();
  Object.assign(globalThis, { window: win, document: Object.assign(new EventTarget(), { visibilityState: 'visible' }), localStorage: { setItem: (k: string, v: string) => values.set(k, v) } });
  return { win, values };
}
test('connection success refreshes mounted cards and shares no account data', async () => {
  const { values } = setup(); let calls = 0;
  const stop = subscribeConnectionUpdates(() => { calls++; });
  notifyConnectionUpdated(); await pause();
  expect(calls).toBe(1); expect(values.get(CONNECTION_UPDATE_KEY)).toMatch(/^[0-9a-f-]{36}$/); stop();
});
test('another tab refreshes status without page reload; cleanup stops updates', async () => {
  const { win } = setup(); let calls = 0;
  const stop = subscribeConnectionUpdates(() => { calls++; });
  win.dispatchEvent(Object.assign(new Event('storage'), { key: CONNECTION_UPDATE_KEY })); await pause(); expect(calls).toBe(1);
  stop(); notifyConnectionUpdated(); await pause(); expect(calls).toBe(1);
});
test('wake catches OAuth completion and batches duplicate events', async () => {
  const { win } = setup(); let calls = 0;
  const stop = subscribeConnectionUpdates(() => { calls++; });
  win.dispatchEvent(new Event('focus')); win.dispatchEvent(Object.assign(new Event('storage'), { key: 'gmailConnectResult' }));
  await pause(); expect(calls).toBe(1); stop();
});
