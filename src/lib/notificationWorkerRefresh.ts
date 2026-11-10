/** Refresh only an existing Firebase worker; never create/delete a subscription. */
export async function refreshNotificationWorker(
  workers: Pick<ServiceWorkerContainer, 'getRegistration' | 'register'>,
  badge: string | null,
): Promise<boolean> {
  const existing = await workers.getRegistration('/');
  const script = existing?.active?.scriptURL || existing?.waiting?.scriptURL || existing?.installing?.scriptURL;
  if (!existing || !script) return false;
  const url = new URL(script);
  if (!url.pathname.endsWith('/firebase-messaging-sw.js')) return false;
  if (badge) url.searchParams.set('badge', badge);
  else url.searchParams.delete('badge');
  // Same scope means the existing PushSubscription remains attached.
  const registration = await workers.register(url.href, {
    scope: existing.scope,
    updateViaCache: 'none',
  });
  await registration.update();
  return true;
}