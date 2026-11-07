import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { refreshNotificationWorker } from '@/lib/notificationWorkerRefresh';

/**
 * Firebase Cloud Messaging (FCM) based push notifications.
 *
 * Replaces the previous OneSignal integration. The public Firebase web config
 * is fetched from the `push-config` edge function (values live in Supabase
 * secrets), device tokens are stored in `public.push_subscriptions`, and
 * sending happens through the `send-push` edge function.
 */

export interface FirebaseWebConfig {
  apiKey: string;
  projectId: string;
  appId: string;
  messagingSenderId: string;
}

interface PushConfigResponse {
  configured: boolean;
  config: FirebaseWebConfig;
  vapidKey: string;
}

const CONFIG_CACHE_KEY = 'firebase_push_config_v1';

declare global {
  interface Window {
    WorklyAndroid?: {
      isNativeAndroidApp?: () => boolean;
      getNotificationPermissionStatus?: () => string;
      requestNativeNotifications?: () => void;
      unsubscribeNativeNotifications?: () => void;
      isNotificationPermissionGranted?: () => boolean;
      requestNotificationPermission?: () => boolean;
      registerPushNotifications?: () => void;
      syncAuthSession?: (raw: string) => void;
    };
    __WORKLY_NATIVE_ANDROID__?: boolean;
  }
}

export class FirebasePushService {
  static isNativeAndroidApp(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      if (new URLSearchParams(window.location.search).get('workly_native') === 'android') return true;
      if (window.__WORKLY_NATIVE_ANDROID__ === true) return true;
      if (window.WorklyAndroid?.isNativeAndroidApp?.() === true) return true;
      // Compatibility with earlier Workly Android app builds.
      return typeof window.WorklyAndroid?.isNotificationPermissionGranted === 'function' &&
        typeof window.WorklyAndroid?.requestNotificationPermission === 'function';
    } catch { return false; }
  }

  private static isNativeAndroid(): boolean { return this.isNativeAndroidApp(); }

  private static requestNativeSetup(): Promise<boolean> {
    if (!window.WorklyAndroid?.requestNativeNotifications) return Promise.resolve(false);
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value: boolean) => {
        if (settled) return;
        settled = true;
        window.removeEventListener('workly:native-notification-result', onResult);
        window.clearTimeout(timeout);
        resolve(value);
      };
      const onResult = (event: Event) => {
        const detail = (event as CustomEvent<{ granted?: boolean; registered?: boolean }>).detail;
        finish(detail?.granted === true && detail?.registered === true);
      };
      const timeout = window.setTimeout(() => finish(false), 90000);
      window.addEventListener('workly:native-notification-result', onResult, { once: true });
      try { window.WorklyAndroid!.requestNativeNotifications!(); }
      catch (error) { console.error('Native Android notification request failed:', error); finish(false); }
    });
  }

  private static requestNativeUnsubscribe(): Promise<boolean> {
    if (!window.WorklyAndroid?.unsubscribeNativeNotifications) return Promise.resolve(false);
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value: boolean) => {
        if (settled) return;
        settled = true;
        window.removeEventListener('workly:native-unsubscribe-result', onResult);
        window.clearTimeout(timeout);
        resolve(value);
      };
      const onResult = (event: Event) => {
        const detail = (event as CustomEvent<{ success?: boolean }>).detail;
        finish(detail?.success === true);
      };
      const timeout = window.setTimeout(() => finish(false), 25000);
      window.addEventListener('workly:native-unsubscribe-result', onResult, { once: true });
      try { window.WorklyAndroid!.unsubscribeNativeNotifications!(); }
      catch (error) { console.error('Native Android unsubscribe failed:', error); finish(false); }
    });
  }

  private static configPromise: Promise<PushConfigResponse | null> | null = null;
  private static initialized = false;
  private static messagingApp: unknown = null;
  private static currentToken: string | null = null;

  // ---------------------------------------------------------------- config

  static async getConfig(): Promise<PushConfigResponse | null> {
    if (this.configPromise) return this.configPromise;

    this.configPromise = (async () => {
      // Fast path: cached config from a previous session.
      try {
        const cached = localStorage.getItem(CONFIG_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached) as PushConfigResponse;
          if (parsed?.configured) {
            // Refresh in the background but return immediately.
            void this.fetchConfig();
            return parsed;
          }
        }
      } catch {
        /* ignore cache issues */
      }
      return this.fetchConfig();
    })();

    return this.configPromise;
  }

  private static async fetchConfig(): Promise<PushConfigResponse | null> {
    const attempts: Array<() => Promise<unknown>> = [
      async () =>
        (await supabase.functions.invoke('email-api', {
          body: { action: 'push_config' },
        })).data,
    ];

    for (const attempt of attempts) {
      try {
        const data = (await attempt()) as PushConfigResponse | null;
        if (data?.configured) {
          try {
            localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(data));
          } catch {
            /* ignore */
          }
          return data;
        }
      } catch (error) {
        console.warn('Could not load Firebase push config:', error);
      }
    }
    return null;
  }

  // ---------------------------------------------------------- capabilities

  static isBrowserPushSupported(): boolean {
    if (this.isNativeAndroid()) return true;
    return (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window
    );
  }

  static detectEnvironment() {
    const isStandalone =
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true);
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    return {
      isSecure: typeof window !== 'undefined' ? window.isSecureContext : false,
      isStandalone,
      isIframe: typeof window !== 'undefined' ? window.top !== window.self : false,
      isIOS: /iPad|iPhone|iPod/.test(ua),
      isAndroid: /Android/i.test(ua),
      hostname: typeof window !== 'undefined' ? window.location.hostname : '',
      supported: this.isBrowserPushSupported() || this.isNativeAndroidApp(),
      userAgent: ua,
    };
  }

  static canEnableNotifications(): { canEnable: boolean; reason?: string; recommendation?: string } {
    if (typeof window === 'undefined') {
      return { canEnable: false, reason: 'Not running in a browser' };
    }
    if (this.isNativeAndroidApp()) return { canEnable: true };
    if (!this.isBrowserPushSupported()) {
      return {
        canEnable: false,
        reason: 'This browser does not support push notifications',
        recommendation: 'Please use the latest version of Chrome or Edge',
      };
    }
    if (!window.isSecureContext) {
      return {
        canEnable: false,
        reason: 'Push notifications need a secure (https) connection',
      };
    }
    if (window.top !== window.self) {
      return {
        canEnable: false,
        reason: 'Notification permission is not available inside the preview window',
        recommendation: 'Open the app in a new tab, then enable notifications',
      };
    }
    return { canEnable: true };
  }

  static async checkPermissionStatus(): Promise<'granted' | 'denied' | 'default'> {
    if (this.isNativeAndroid()) {
      const status = window.WorklyAndroid?.getNotificationPermissionStatus?.();
      if (status === 'granted' || status === 'denied') return status;
      return window.WorklyAndroid?.isNotificationPermissionGranted?.() ? 'granted' : 'default';
    }
    if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
    return Notification.permission;
  }

  static async checkNotificationPermissionDetails() {
    const permission = await this.checkPermissionStatus();
    const env = this.detectEnvironment();
    // Push is attempted on whatever domain the site is currently served from —
    // no environment is treated as unsupported just because of its hostname.
    const isDevelopment = false;
    return {
      permission,
      supported: env.supported,
      secure: env.isSecure,
      inIframe: env.isIframe,
      isBlocked: permission === 'denied',
      subscribed: await this.isSubscribed(),
      environment: { ...env, isDevelopment },
    };
  }

  static async checkServiceWorkerStatus() {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return { supported: false, registrations: 0, firebaseWorker: false };
    }
    const registrations = await navigator.serviceWorker.getRegistrations();
    const firebaseWorker = registrations.some((r) =>
      (r.active?.scriptURL || '').includes('firebase-messaging-sw.js'),
    );
    return { supported: true, registrations: registrations.length, firebaseWorker };
  }

  static isSDKInitialized(): boolean {
    return this.initialized;
  }

  /** True when the server has Firebase web push keys configured. */
  static async isConfigured(): Promise<boolean> {
    try {
      const configResponse = await this.getConfig();
      return Boolean(configResponse?.configured);
    } catch {
      return false;
    }
  }

  static async isSDKLoaded(): Promise<boolean> {
    return this.initialized;
  }

  // --------------------------------------------------------------- runtime

  /** Loads the Firebase messaging SDK and registers the service worker. */
  static async initialize(_guestMode = false): Promise<void> {
    await this.syncNotificationIcon();
    if (this.initialized) return;
    if (!this.isBrowserPushSupported()) return;

    const configResponse = await this.getConfig();
    if (!configResponse?.configured) {
      console.log('🔔 Firebase push not configured yet');
      return;
    }

    try {
      const [{ initializeApp, getApps }, { getMessaging, isSupported, onMessage }] = await Promise.all([
        import('firebase/app'),
        import('firebase/messaging'),
      ]);

      if (!(await isSupported())) {
        console.log('🔔 Firebase messaging not supported in this browser');
        return;
      }

      const app = getApps().length ? getApps()[0] : initializeApp(configResponse.config);
      this.messagingApp = app;
      this.initialized = true;

      // Foreground messages: show a toast instead of a silent drop.
      try {
        const messaging = getMessaging(app);
        onMessage(messaging, (payload) => {
          const title = payload.notification?.title || payload.data?.title;
          const body = payload.notification?.body || payload.data?.body;
          if (title) {
            toast(title, { description: body });
          }
        });
      } catch (error) {
        console.warn('Foreground message listener failed:', error);
      }
    } catch (error) {
      console.error('❌ Firebase push initialization failed:', error);
      this.initialized = false;
    }
  }

  /** Update artwork for an existing subscription without touching FCM tokens. */
  static async syncNotificationIcon(): Promise<void> {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    try {
      const { data, error } = await supabase.from('app_settings')
        .select('setting_value').eq('setting_key', 'notification_badge_icon').maybeSingle();
      // A denied/offline read must not erase an already saved worker badge.
      if (error) return;
      await refreshNotificationWorker(navigator.serviceWorker, data?.setting_value || null);
    } catch (error) {
      console.warn('Notification artwork refresh failed:', error);
    }
  }

  /** Site header logo, used as the notification icon so push follows the brand. */
  private static async getBrandIcon(): Promise<string | null> {
    try {
      const { data, error } = await supabase.rpc('get_brand_assets');
      if (error || !data || typeof data !== 'object') return null;
      const assets = data as { logo_url?: string; favicon_url?: string };
      return assets.logo_url || assets.favicon_url || null;
    } catch {
      return null;
    }
  }

  private static async registerServiceWorker(
    config: FirebaseWebConfig,
  ): Promise<ServiceWorkerRegistration> {
    const brandIcon = await this.getBrandIcon();
    const params = new URLSearchParams(config as unknown as Record<string, string>);
    if (brandIcon) params.set('brandIcon', brandIcon);
    try {
      const { data } = await supabase.from('app_settings').select('setting_value')
        .eq('setting_key', 'notification_badge_icon').maybeSingle();
      if (data?.setting_value) params.set('badge', String(data.setting_value));
    } catch { /* default badge */ }
    const registration = await navigator.serviceWorker.register(
      `/firebase-messaging-sw.js?${params.toString()}`,
      { scope: '/', updateViaCache: 'none' },
    );
    // Pick up the new native push handler immediately on repeat visits.
    try {
      await registration.update();
    } catch {
      /* ignore */
    }
    // getToken needs an active worker; `ready` resolves once one is activated.
    await navigator.serviceWorker.ready;
    return registration;
  }

  /**
   * Asks the browser for notification permission.
   *
   * MUST be called directly from the click handler, before any `await` on
   * network work: Chrome (especially on Android) ignores — and after repeated
   * ignores permanently blocks — permission prompts that are no longer tied to
   * a live user gesture. That is why this is separate from token saving.
   */
  static async ensurePermission(): Promise<'granted' | 'denied' | 'default'> {
    if (this.isNativeAndroid()) return this.checkPermissionStatus();
    if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    try {
      return await Notification.requestPermission();
    } catch (error) {
      console.warn('🔔 requestPermission failed:', error);
      return 'default';
    }
  }

  /** Asks for permission (if needed), gets an FCM token and saves it. */
  static async requestPermissionAndSaveToken(_forceLink = false): Promise<boolean> {
    if (this.isNativeAndroid()) {
      if (window.WorklyAndroid?.requestNativeNotifications) {
        return await this.requestNativeSetup();
      }
      const permission = await this.ensurePermission();
      if (permission !== 'granted') return false;
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) return false;
      if (!sessionData.session || !window.WorklyAndroid!.registerPushNotifications) return false;
      // Android reports the actual FCM/PostgREST result. This avoids treating
      // an optimistic permission grant or a stale DB row as a successful subscribe.
      const registration = await new Promise<boolean>((resolve) => {
        let settled = false;
        const finish = (value: boolean) => {
          if (settled) return;
          settled = true;
          window.removeEventListener('workly-native-push-registration-complete', onComplete);
          window.clearTimeout(timeout);
          resolve(value);
        };
        const onComplete = (event: Event) => {
          const detail = (event as CustomEvent<{ success?: boolean; reason?: string }>).detail;
          if (!detail?.success) console.error('Native FCM registration failed:', detail?.reason || 'unknown');
          finish(detail?.success === true);
        };
        const timeout = window.setTimeout(() => finish(false), 25000);
        window.addEventListener('workly-native-push-registration-complete', onComplete, { once: true });
        try {
          window.WorklyAndroid!.syncAuthSession?.(JSON.stringify(sessionData.session));
          window.WorklyAndroid!.registerPushNotifications!();
        } catch (error) {
          console.error('Could not call Android push bridge:', error);
          finish(false);
        }
      });
      if (!registration) return false;
      const { data, error } = await supabase.from('push_subscriptions')
        .select('fcm_token').eq('user_id', userId).eq('platform', 'android')
        .eq('enabled', true).maybeSingle();
      if (error) {
        console.warn('Android FCM row verification failed:', error.message);
        return false;
      }
      return Boolean(data?.fcm_token);
    }
    const canEnable = this.canEnableNotifications();
    if (!canEnable.canEnable) {
      console.log('🔔 Cannot enable notifications:', canEnable.reason);
      return false;
    }

    // Permission first — no network round trip before the prompt.
    const permission = await this.ensurePermission();
    if (permission !== 'granted') {
      console.log('🔔 Notification permission not granted:', permission);
      return false;
    }

    const configResponse = await this.getConfig();
    if (!configResponse?.configured) {
      console.warn('🔔 Firebase push config missing — cannot subscribe');
      return false;
    }

    await this.initialize();
    if (!this.messagingApp) return false;

    try {
      const { deleteToken, getMessaging, getToken } = await import('firebase/messaging');
      const messaging = getMessaging(this.messagingApp as never);

      const registration = await this.registerServiceWorker(configResponse.config);
      let token = await getToken(messaging, {
        vapidKey: configResponse.vapidKey,
        serviceWorkerRegistration: registration,
      });

      if (!token) {
        console.warn('🔔 No FCM token returned');
        return false;
      }

      // FCM can keep returning a locally cached token after its server has
      // invalidated it. The push hub removes those dead rows after an
      // UNREGISTERED response. When this signed-in device's current token is
      // no longer present, rotate it instead of saving the same dead token
      // again forever.
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (userId) {
        const { data: savedToken } = await supabase
          .from('push_subscriptions')
          .select('id')
          .eq('user_id', userId)
          .eq('fcm_token', token)
          .eq('enabled', true)
          .maybeSingle();

        if (!savedToken) {
          try {
            await deleteToken(messaging);
            const refreshedToken = await getToken(messaging, {
              vapidKey: configResponse.vapidKey,
              serviceWorkerRegistration: registration,
            });
            if (refreshedToken) token = refreshedToken;
          } catch (refreshError) {
            console.warn('🔔 FCM token refresh failed; saving current token:', refreshError);
          }
        }
      }

      this.currentToken = token;
      const saved = await this.saveToken(token);
      if (saved) await this.sendLifecyclePush('subscribe', token);
      return saved;
    } catch (error) {
      console.error('❌ Failed to get FCM token:', error);
      return false;
    }
  }

  static async showNotificationPrompt(forceLink = false): Promise<boolean> {
    return this.requestPermissionAndSaveToken(forceLink);
  }

  private static async saveToken(token: string): Promise<boolean> {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) {
        console.log('🔔 Guest user — token not saved');
        return true;
      }

      const ua = navigator.userAgent;

      // One current browser subscription per account: remove the previous web
      // token before saving the latest token. Android uses its own platform row.
      const { error: cleanupError } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('platform', 'web')
        .neq('fcm_token', token);

      if (cleanupError) {
        console.error('❌ Failed to replace older web push token:', cleanupError.message);
        return false;
      }

      const { error } = await supabase.from('push_subscriptions').upsert(
        {
          user_id: userId,
          fcm_token: token,
          platform: 'web',
          enabled: true,
          last_seen_at: new Date().toISOString(),
          device_info: {
            userAgent: ua,
            language: navigator.language,
            hostname: window.location.hostname,
          },
        },
        { onConflict: 'user_id,platform' },
      );

      if (error) {
        console.error('❌ Failed to save push token:', error.message);
        return false;
      }

      console.log('✅ Push token saved');
      return true;
    } catch (error) {
      console.error('❌ Error saving push token:', error);
      return false;
    }
  }

  static async getCurrentPlayerId(): Promise<string | null> {
    if (this.currentToken) return this.currentToken;
    const configResponse = await this.getConfig();
    if (!configResponse?.configured) return null;
    if (Notification.permission !== 'granted') return null;
    await this.initialize();
    if (!this.messagingApp) return null;
    try {
      const { getMessaging, getToken } = await import('firebase/messaging');
      const registration = await this.registerServiceWorker(configResponse.config);
      const token = await getToken(getMessaging(this.messagingApp as never), {
        vapidKey: configResponse.vapidKey,
        serviceWorkerRegistration: registration,
      });
      this.currentToken = token || null;
      return this.currentToken;
    } catch {
      return null;
    }
  }

  /** Sends the owner-configured welcome / goodbye notification for this device. */
  private static async sendLifecyclePush(
    event: 'subscribe' | 'unsubscribe',
    token: string,
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase.functions.invoke('email-api', {
        body: { action: 'send_lifecycle_push', event, token },
      });
      if (error || !data?.success) {
        console.warn(`🔔 lifecycle push (${event}) failed:`, error?.message || data?.error || data?.reason);
        return false;
      }
      return true;
    } catch (error) {
      console.warn(`🔔 lifecycle push (${event}) failed:`, error);
      return false;
    }
  }

  static async unsubscribe(): Promise<boolean> {
    if (this.isNativeAndroid() && window.WorklyAndroid?.unsubscribeNativeNotifications) {
      return await this.requestNativeUnsubscribe();
    }
    try {
      if (this.isNativeAndroid()) {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;
        if (!userId) return false;
        // Keep the Android token row so the user can re-subscribe without
        // generating a new FCM token; disabled rows are excluded by send-push.
        const { error } = await supabase.from('push_subscriptions')
          .update({ enabled: false, last_seen_at: new Date().toISOString() })
          .eq('user_id', userId).eq('platform', 'android');
        if (error) {
          console.error('Native Android unsubscribe failed:', error.message);
          return false;
        }
        return true;
      }
      // Grab the token first: the goodbye push has to go out before the token
      // is deleted, otherwise there is nothing left to deliver to.
      const token = this.currentToken || (await this.getCurrentPlayerId());
      if (token) {
        await this.sendLifecyclePush('unsubscribe', token);
        // Give FCM a moment to hand the message to the push service.
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }

      // Delete the FCM token locally so this device stops receiving pushes
      if (this.messagingApp) {
        try {
          const { getMessaging, deleteToken } = await import('firebase/messaging');
          await deleteToken(getMessaging(this.messagingApp as never));
        } catch (e) {
          console.warn('🔔 FCM deleteToken failed (continuing):', e);
        }
      }
      this.currentToken = null;

      // Sirf is device ki subscription hatao — user ke dusre phone/laptop
      // subscribed hi rehne chahiye.
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) return true;

      let query = supabase.from('push_subscriptions').delete().eq('user_id', userId);
      query = token
        ? query.eq('fcm_token', token)
        : query
            .eq('platform', 'web')
            .eq('device_info->>userAgent', navigator.userAgent)
            .eq('device_info->>hostname', window.location.hostname);
      const { error } = await query;

      if (error) {
        console.error('❌ Failed to delete push subscriptions:', error.message);
        return false;
      }
      console.log('✅ Push notifications unsubscribed and token deleted');
      return true;
    } catch (error) {
      console.error('❌ Error unsubscribing:', error);
      return false;
    }
  }

  static async isSubscribed(): Promise<boolean> {
    if (this.isNativeAndroid()) {
      if (!window.WorklyAndroid!.isNotificationPermissionGranted!()) return false;
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) return false;
      const { data } = await supabase.from('push_subscriptions').select('fcm_token').eq('user_id', userId).eq('platform', 'android').eq('enabled', true).maybeSingle();
      return Boolean(data?.fcm_token);
    }
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    if (Notification.permission !== 'granted') return false;
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) return false;

    const { data } = await supabase
      .from('push_subscriptions')
      .select('fcm_token')
      .eq('user_id', userId)
      .eq('enabled', true);

    const tokens = (data || []).map((r) => r.fcm_token).filter(Boolean) as string[];
    if (tokens.length === 0) return false;

    // A stored row alone is not enough: the row may belong to another device or
    // hold a token this browser has since deleted. Only report "subscribed"
    // when this device's live token is actually the one saved.
    const deviceToken = await this.getCurrentPlayerId();
    if (!deviceToken) return false;
    return tokens.includes(deviceToken);
  }

  // ------------------------------------------------------------- sending

  static async sendEmployerNotification(
    userId: string,
    title: string,
    message: string,
    actionUrl?: string,
    eventType?: string,
    audience: 'employer' | 'job_seeker' = 'employer',
  ): Promise<boolean> {
    try {
      // Always go through the template-aware `send_push` action so every
      // notification carries the website logo and exactly one action button
      // (the owner's Push Template decides the copy and button text).
      // The side is always explicit, so a login that owns both an employer and a
      // job-seeker profile never has one of the two skipped.
      const { data, error } = await supabase.functions.invoke('email-api', {
        body: {
          action: 'send_push',
          user_id: userId,
          audience,
          title,
          message,
          action_url: actionUrl || '/activity',
          skip_rephrase: true,
          ...(eventType ? { event_type: eventType } : {}),
        },
      });
      if (error) {
        console.error('❌ push send failed:', error.message);
        return false;
      }
      return Boolean(data?.success);
    } catch (error) {
      console.error('❌ Error sending push notification:', error);
      return false;
    }
  }

  // ------------------------------------------------------- token hygiene

  static async validateUserTokens(userId: string): Promise<boolean> {
    const { data } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('enabled', true)
      .limit(1);
    return Boolean(data && data.length > 0);
  }

  static async refreshUserTokens(_userId?: string): Promise<boolean> {
    if (Notification.permission !== 'granted') return false;
    return this.requestPermissionAndSaveToken(true);
  }

  static async linkCurrentPlayerIdToUser(): Promise<boolean> {
    const token = await this.getCurrentPlayerId();
    if (!token) return false;
    return this.saveToken(token);
  }

  /** Drops this user's stale tokens, keeping only the current device token. */
  static async cleanupOldTokens(userId?: string): Promise<boolean> {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const targetUser = userId || sessionData.session?.user?.id;
      if (!targetUser) return false;

      const current = await this.getCurrentPlayerId();
      let query = supabase.from('push_subscriptions').delete().eq('user_id', targetUser);
      if (current) query = query.neq('fcm_token', current);
      const { error } = await query;
      if (error) {
        console.error('❌ Token cleanup failed:', error.message);
        return false;
      }
      return true;
    } catch (error) {
      console.error('❌ Token cleanup error:', error);
      return false;
    }
  }

  /** Removes stale service workers/caches left over from older builds. */
  static async forceServiceWorkerUpdate(): Promise<boolean> {
    try {
      if (!('serviceWorker' in navigator)) return false;
      const registrations = await navigator.serviceWorker.getRegistrations();
      let removed = 0;
      for (const registration of registrations) {
        const url = registration.active?.scriptURL || '';
        if (/onesignal/i.test(url)) {
          await registration.unregister();
          removed++;
        } else {
          await registration.update().catch(() => undefined);
        }
      }
      if ('caches' in window) {
        for (const name of await caches.keys()) {
          if (/onesignal|workbox/i.test(name)) await caches.delete(name);
        }
      }
      return removed > 0;
    } catch (error) {
      console.error('Service worker refresh failed:', error);
      return false;
    }
  }

  static async forceReset(): Promise<void> {
    this.initialized = false;
    this.messagingApp = null;
    this.currentToken = null;
    this.configPromise = null;
    try {
      localStorage.removeItem(CONFIG_CACHE_KEY);
    } catch {
      /* ignore */
    }
  }
}

export default FirebasePushService;
