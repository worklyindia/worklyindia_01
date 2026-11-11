import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { signInWithIdentifier } from '@/lib/loginIdentifier';
import { handleAuthError } from '@/utils/authErrorHandler';
import { syncLocalDataToSupabase, hasLocalDataToSync } from '@/lib/dataSyncManager';
import { toast as sonnerToast } from 'sonner';
import { triggerPushEvent } from '@/hooks/usePushTrigger';
import { updateLastLogin } from '@/utils/updateLastLogin';
import { SUPABASE_FUNCTIONS_URL } from '@/constants/supabase';
import { autoCollectDeviceInfo } from '@/utils/autoDeviceInfoCollector';
import { triggerPwaInstallAfterLogin } from '@/utils/pwaInstallTrigger';
import { isFilePickerSuspended } from '@/lib/filePickerGuard';
import { toE164, isValidE164 } from '@/lib/phone';
import { issueBrowserToken } from '@/lib/browserQuickLogin';
import { startSocialOAuth } from '@/lib/socialOAuth';
import {
  buildGithubUrl,
  buildGitlabUrl,
  buildLinkedInUrl,
  isValidPlatformLink,
} from '@/utils/socialProfileUrl';

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  telegram_username: string | null;
  location: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  experience_years: number | null;
  current_position: string | null;
  company: string | null;
  skills: string[] | null;
  education: string | null;
  bio: string | null;
  profile_image_url: string | null;
  is_profile_complete: boolean;
  account_status: string;
  account_status_reason: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  profileLoading: boolean;
  signUp: (email: string, password: string, fullName: string, mobileNumber?: string, customRedirectUrl?: string, phoneVerified?: boolean) => Promise<{ error: any; needsEmailConfirmation?: boolean }>;
  signIn: (email: string, password: string, redirectUrl?: string) => Promise<{ error: any }>;
  signInWithGoogle: (redirectUrl?: string) => Promise<{ error: any }>;
  signInWithLinkedIn: (redirectUrl?: string) => Promise<{ error: any }>;
  signInWithTwitter: (redirectUrl?: string) => Promise<{ error: any }>;
  signInWithGitHub: (redirectUrl?: string) => Promise<{ error: any }>;
  signInWithGitLab: (redirectUrl?: string) => Promise<{ error: any }>;

  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  changeEmail: (newEmail: string) => Promise<{ error: any }>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: any }>;
  checkProfileCompletion: () => boolean;
  isBanned: () => boolean;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const profileRef = useRef<Profile | null>(null);
  profileRef.current = profile;
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  
  // Dedup guard: prevent concurrent/duplicate profile fetches for the same user
  const profileFetchRef = React.useRef<string | null>(null);

  // Cache profile completion status
  const getCachedProfileCompletion = () => {
    try {
      const cached = localStorage.getItem('profile_completion_status');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  };

  const setCachedProfileCompletion = (isComplete: boolean) => {
    try {
      localStorage.setItem('profile_completion_status', JSON.stringify(isComplete));
    } catch {
      // Ignore localStorage errors
    }
  };

  useEffect(() => {
    // Track if this is initial session load vs fresh login
    let isInitialLoad = true;
    
    // Preserve current route during auth loading
    const preserveRoute = () => {
      const currentPath = window.location.pathname + window.location.search;
      if (currentPath !== '/' && !currentPath.includes('/auth')) {
        try {
          sessionStorage.setItem('preservedRoute', currentPath);
        } catch (e) {
          // Ignore storage errors
        }
      }
    };

    // Set up auth state listener FIRST (before getSession)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Preserve route before loading profile
          preserveRoute();

          // Save LinkedIn connection + profile link whenever a LinkedIn token is present
          setTimeout(() => {
            import('@/lib/linkedinSync').then(({ syncLinkedInFromSession }) =>
              syncLinkedInFromSession(session)
            );
          }, 0);
          
          // Update last login ONLY on fresh login (not page refresh)
          // SIGNED_IN fires on: actual login, OAuth callback, AND page refresh with existing session
          // We only want to update on actual fresh logins
          if (event === 'SIGNED_IN' && !isInitialLoad) {
            // Extra safety: Check session age - if session is older than 10 seconds, it's a page refresh
            const sessionCreatedAt = session.user?.created_at;
            const sessionLastSignIn = session.user?.last_sign_in_at;
            const now = Date.now();
            const signInTime = sessionLastSignIn ? new Date(sessionLastSignIn).getTime() : 0;
            const sessionAge = now - signInTime;
            
            // Only update if this is a truly fresh login (session age < 10 seconds)
            if (sessionAge < 10000) {
              console.log('🔐 Fresh login detected, updating last login...', { sessionAge: `${sessionAge}ms` });
              updateLastLogin().catch(console.error);
              // Auto-collect device info on fresh login (works for all methods: Google, LinkedIn, Email)
              if (session.access_token) {
                autoCollectDeviceInfo(session.access_token, 'job_seeker').catch(console.error);
                issueBrowserToken(session.access_token).catch(console.error);
              }
              // Trigger PWA install prompt after fresh login
              setTimeout(() => {
                triggerPwaInstallAfterLogin().catch(console.error);
              }, 3000);
            } else {
              console.log('⏭️ Skipping last login update - session is old (page refresh)', { sessionAge: `${sessionAge}ms` });
            }
          }
          
          // Silently sync any local guest data (favorites/applications) in
          // the background. No toast/scan UX — the user shouldn't see it.
          if (hasLocalDataToSync()) {
            setTimeout(() => {
              syncLocalDataToSupabase(session.user.id).catch(() => {});
            }, 1000);
          }
          
          // USER_UPDATED (e.g. phone_change OTP verify) must actually refetch the
          // profile — otherwise the dedup guard inside
          // fetchUserProfileAndCreateIfNeeded returns early and the
          // profileLoading=true below never gets cleared (OnboardingGuard stuck
          // on the full-screen loader after verifying the number).
          if (event === 'USER_UPDATED') profileFetchRef.current = null;
          // Only raise the loading gate when a fetch will actually run.
          if (profileFetchRef.current !== session.user.id) setProfileLoading(true);
          // Set loading=false immediately so auth page doesn't double-flash
          setLoading(false);
          // Fetch user profile and create if doesn't exist (for OAuth users)
          setTimeout(() => {
            fetchUserProfileAndCreateIfNeeded(session.user);
          }, 0);
        } else {
          // User signed out — clear all state and dedup guard
          profileFetchRef.current = null;
          setProfile(null);
          setProfileLoading(false);
          setLoading(false);
        }
      }
    );

    // Check for existing session - mark as initial load
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      // Do not force-sign-out from a stale profile timestamp. Supabase owns
      // token expiry/refresh; a delayed last_login_at write must not log out
      // an otherwise valid active session.
      setSession(session);
      setUser(session?.user ?? null);
      if (!session?.user) {
        setLoading(false);
      }
      if (session?.user) {
        preserveRoute();
        // Set profileLoading=true BEFORE setLoading(false) to prevent premature redirect
        setProfileLoading(true);
        // Set loading=false immediately after session resolves so Auth page doesn't flash
        setLoading(false);
        fetchUserProfileAndCreateIfNeeded(session.user);
        
        // Check if this is a fresh OAuth redirect (session age < 15 seconds)
        // OAuth redirects cause a full page reload, so SIGNED_IN with isInitialLoad=true gets skipped
        const sessionLastSignIn = session.user?.last_sign_in_at;
        const signInTime = sessionLastSignIn ? new Date(sessionLastSignIn).getTime() : 0;
        const sessionAge = Date.now() - signInTime;
        if (sessionAge < 15000 && session.access_token) {
          console.log('🔐 Fresh OAuth/login detected on page load, collecting device info...', { sessionAge: `${sessionAge}ms` });
          autoCollectDeviceInfo(session.access_token, 'job_seeker').catch(console.error);
          issueBrowserToken(session.access_token).catch(console.error);
          // Trigger PWA install prompt after OAuth redirect login
          setTimeout(() => {
            triggerPwaInstallAfterLogin().catch(console.error);
          }, 3000);
        }
      } else {
        setLoading(false);
      }
      // After initial session check, set isInitialLoad to false
      // Any subsequent SIGNED_IN events are fresh logins
      // Use 2000ms to ensure page refresh completes before flag changes
      setTimeout(() => {
        isInitialLoad = false;
      }, 2000);
    });

    return () => subscription.unsubscribe();
  }, []);

  // === Wake self-heal ===
  // On mobile, screen-off can suspend in-flight Supabase requests, leaving
  // `loading = true` forever. When the tab becomes visible again, re-check
  // the session and (if needed) refetch the profile. Also enforce a hard
  // safety timeout that forces loading=false so gated UI never gets stuck.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      // Returning from the native file/photo picker must NOT trigger a session
      // re-check: the re-render cascade unmounts the page and throws away the
      // image the user just picked (crop dialog never opens).
      if (isFilePickerSuspended()) return;
      // Kick a fresh session read; the auth listener + effects below handle the rest.
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (!session?.user) {
          setProfile(null);
          setProfileLoading(false);
          setLoading(false);
          return;
        }
        // Session exists — make sure loading gate is released and profile is fresh.
        setLoading(false);
        // Reset dedup guard so refetch actually runs
        profileFetchRef.current = null;
        fetchUserProfileAndCreateIfNeeded(session.user);
      }).catch(() => {
        // Even on error, don't leave UI hanging
        setLoading(false);
      });
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    window.addEventListener('pageshow', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('pageshow', onVisible);
    };
  }, []);

  // Hard safety net: if `loading` stays true for >8s, force it to false so
  // downstream pages don't stay on skeleton forever.
  useEffect(() => {
    if (!loading) return;
    const t = window.setTimeout(() => setLoading(false), 8000);
    return () => window.clearTimeout(t);
  }, [loading]);

  // Same safety net for the profile loading gate: on a flaky mobile network a
  // hung profile request must never keep OnboardingGuard's full-screen loader
  // up forever — after 10s the gate releases and the app can proceed.
  useEffect(() => {
    if (!profileLoading) return;
    const t = window.setTimeout(() => setProfileLoading(false), 10000);
    return () => window.clearTimeout(t);
  }, [profileLoading]);

  // === Auto-logout when this account is deleted server-side ===
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase.channel(`account-${user.id}`);
    channel
      .on('broadcast', { event: 'account_deleted' }, async () => {
        try { sonnerToast.error('Your account has been deleted by an administrator.', { duration: 6000 }); } catch (_e) {}
        try { await supabase.auth.signOut(); } catch (_e) {}
        setSession(null);
        setUser(null);
        setProfile(null);
        try { localStorage.clear(); sessionStorage.clear(); } catch (_e) {}
        setTimeout(() => { window.location.href = '/'; }, 500);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);


  const fetchUserProfile = async (userId: string) => {
    setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
        setProfile(null);
      } else {
        setProfile(data);
        // Update cached profile completion status
        if (data) {
          const isComplete = checkProfileCompletionForProfile(data);
          setCachedProfileCompletion(isComplete);
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
    } finally {
      setProfileLoading(false);
      setLoading(false);
    }
  };

  // Helper to extract a *valid* LinkedIn profile URL from OAuth data.
  // LinkedIn's `sub` is an opaque id, NOT a vanity name — building
  // linkedin.com/in/<sub> produced dead links, so it is never used.
  const extractLinkedInUrl = (authUser: User): string | null => {
    const identities: any[] = (authUser as any)?.identities || [];
    const meta: any = authUser.user_metadata || {};
    const li = identities.find((i) => i.provider === 'linkedin_oidc' || i.provider === 'linkedin');
    if (!li && authUser.app_metadata?.provider !== 'linkedin_oidc') return null;
    return buildLinkedInUrl({ ...meta, ...(li?.identity_data || {}) });
  };

  // GitHub / GitLab profile URL from the OAuth identity data (validated).
  const extractGitUrls = (authUser: User): { github_link?: string; gitlab_link?: string } => {
    const out: { github_link?: string; gitlab_link?: string } = {};
    const identities: any[] = (authUser as any)?.identities || [];
    const meta: any = authUser.user_metadata || {};
    const provider = authUser.app_metadata?.provider;

    const gh = identities.find((i) => i.provider === 'github');
    if (gh || provider === 'github') {
      const link = buildGithubUrl({ ...meta, ...(gh?.identity_data || {}) });
      if (link) out.github_link = link;
    }

    const gl = identities.find((i) => i.provider === 'gitlab');
    if (gl || provider === 'gitlab') {
      const link = buildGitlabUrl({ ...meta, ...(gl?.identity_data || {}) });
      if (link) out.gitlab_link = link;
    }
    return out;
  };


  // Resolve an OAuth-hosted avatar from any provider field (Google, LinkedIn, etc.)
  const resolveOAuthAvatar = (authUser: User): string => {
    const meta: any = authUser.user_metadata || {};
    const direct =
      meta.avatar_url ||
      meta.picture ||
      meta.picture_url ||
      meta.avatar ||
      meta.profile_picture ||
      meta.profile_image_url ||
      '';
    if (direct) return direct;
    const identities: any[] = (authUser as any)?.identities || [];
    for (const ident of identities) {
      const id: any = ident?.identity_data || {};
      const url =
        id.avatar_url || id.picture || id.picture_url || id.avatar || '';
      if (url) return url;
    }
    return '';
  };

  // Fetch default job seeker avatar from app_settings (cached at module scope)
  const getDefaultJobSeekerAvatar = async (): Promise<string> => {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'default_job_seeker_avatar')
        .maybeSingle();
      return data?.setting_value || '';
    } catch {
      return '';
    }
  };

  // Fetch profile and create if doesn't exist (for OAuth users)
  const fetchUserProfileAndCreateIfNeeded = async (authUser: User) => {
    // Dedup: skip if already fetching/fetched for this user
    if (profileFetchRef.current === authUser.id) return;
    profileFetchRef.current = authUser.id;
    
    // Background refresh (e.g. returning to the tab) must not flash the loading
    // gate — that unmounts the open page and looks like a page refresh.
    if (!profileRef.current) setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
        setProfile(null);
      } else if (data) {
        // Profile exists - check if we need to update OAuth data
        const metadata = authUser.user_metadata || {};
        const oauthAvatar = resolveOAuthAvatar(authUser);
        const oauthName = metadata.full_name || metadata.name || '';
        const linkedinUrl = extractLinkedInUrl(authUser);
        
        // Only update if profile is missing data that OAuth provides.
        // Also refresh the avatar when the existing one is itself an OAuth-hosted URL
        // (Google/LinkedIn rotate these) or the saved default fallback,
        // but NEVER overwrite a user-uploaded picture.
        const { isOAuthHostedAvatar } = await import('@/utils/defaultAvatars');
        const defaultAvatar = await getDefaultJobSeekerAvatar();
        const existingIsOAuthHosted = isOAuthHostedAvatar(data.profile_image_url);
        const existingIsDefault = !!defaultAvatar && data.profile_image_url === defaultAvatar;
        const hasNoAvatar = !data.profile_image_url;
        const isReplaceable = hasNoAvatar || existingIsOAuthHosted || existingIsDefault;
        // Sirf tab DP save karo jab social login se asli DP mile.
        // Koi default/site logo kabhi save nahi hoga.
        const needsAvatarUpdate =
          !!oauthAvatar && isReplaceable && data.profile_image_url !== oauthAvatar;
        const needsNameUpdate = !data.full_name && oauthName;
        const gitUrls = extractGitUrls(authUser);

        // A previously saved link can be broken (old builds stored full names /
        // opaque ids). Replace anything that is not a real profile URL, and
        // clear it when we have no valid replacement, so the profile never
        // shows a link that opens an error page.
        const storedLinkedIn = (data as any).linkedin_link;
        const storedGithub = (data as any).github_link;
        const storedGitlab = (data as any).gitlab_link;
        const linkedInBroken = !!storedLinkedIn && !isValidPlatformLink(storedLinkedIn, 'linkedin.com');
        const githubBroken = !!storedGithub && !isValidPlatformLink(storedGithub, 'github.com');
        const gitlabBroken = !!storedGitlab && !isValidPlatformLink(storedGitlab, 'gitlab.com');

        const needsLinkedInUpdate = (!storedLinkedIn || linkedInBroken) && !!linkedinUrl;
        const needsGitHubUpdate = (!storedGithub || githubBroken) && !!gitUrls.github_link;
        const needsGitLabUpdate = (!storedGitlab || gitlabBroken) && !!gitUrls.gitlab_link;
        const needsLinkedInClear = linkedInBroken && !linkedinUrl;
        const needsGitHubClear = githubBroken && !gitUrls.github_link;
        const needsGitLabClear = gitlabBroken && !gitUrls.gitlab_link;

        if (
          needsAvatarUpdate ||
          needsNameUpdate ||
          needsLinkedInUpdate ||
          needsGitHubUpdate ||
          needsGitLabUpdate ||
          needsLinkedInClear ||
          needsGitHubClear ||
          needsGitLabClear
        ) {
          const updates: {
            profile_image_url?: string;
            full_name?: string;
            linkedin_link?: string | null;
            github_link?: string | null;
            gitlab_link?: string | null;
          } = {};
          if (needsGitHubUpdate) updates.github_link = gitUrls.github_link;
          if (needsGitLabUpdate) updates.gitlab_link = gitUrls.gitlab_link;
          if (needsLinkedInClear) updates.linkedin_link = null;
          if (needsGitHubClear) updates.github_link = null;
          if (needsGitLabClear) updates.gitlab_link = null;
          if (needsAvatarUpdate) {
            updates.profile_image_url = oauthAvatar;
            console.log('🖼️ Saving OAuth (Google/LinkedIn) DP for user');
          }
          if (needsNameUpdate) {
            updates.full_name = oauthName;
          }
          if (needsLinkedInUpdate) {
            updates.linkedin_link = linkedinUrl!;
            console.log('🔗 Auto-saving LinkedIn profile URL:', linkedinUrl);
          }
          
          const { error: updateError } = await supabase
            .from('profiles')
            .update(updates)
            .eq('user_id', authUser.id);
            
          if (!updateError) {
            // Merge updates with existing data
            const updatedProfile = { ...data, ...updates };
            setProfile(updatedProfile);
            const isComplete = checkProfileCompletionForProfile(updatedProfile);
            setCachedProfileCompletion(isComplete);
          } else {
            console.error('Error updating profile with OAuth data:', updateError);
            setProfile(data);
            const isComplete = checkProfileCompletionForProfile(data);
            setCachedProfileCompletion(isComplete);
          }
        } else {
          setProfile(data);
          const isComplete = checkProfileCompletionForProfile(data);
          setCachedProfileCompletion(isComplete);
        }
      } else {
        // Profile doesn't exist - create one with OAuth data
        const metadata = authUser.user_metadata || {};
        const fullName =
          metadata.full_name || metadata.name || metadata.user_name || metadata.preferred_username || '';
        // Sirf social provider ki asli DP; warna khaali (default logo save nahi karna).
        const avatarUrl = resolveOAuthAvatar(authUser);
        const linkedinUrl = extractLinkedInUrl(authUser);
        
        const newProfileData: any = {
          user_id: authUser.id,
          full_name: fullName,
          profile_image_url: avatarUrl || null,
          is_profile_complete: false,
          account_status: 'active'
        };
        
        // Add LinkedIn URL if available
        const newGitUrls = extractGitUrls(authUser);
        if (newGitUrls.github_link) newProfileData.github_link = newGitUrls.github_link;
        if (newGitUrls.gitlab_link) newProfileData.gitlab_link = newGitUrls.gitlab_link;
        if (metadata.email || authUser.email) newProfileData.email = metadata.email || authUser.email;

        if (linkedinUrl) {
          newProfileData.linkedin_link = linkedinUrl;
          console.log('🔗 Auto-saving LinkedIn profile URL for new user:', linkedinUrl);
        }

        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert(newProfileData)
          .select()
          .single();

        if (insertError) {
          console.error('Error creating profile for OAuth user:', insertError);
          setProfile(null);
        } else {
          console.log('Created profile for OAuth user:', newProfile);
          setProfile(newProfile);
          setCachedProfileCompletion(false);
          
          // Auto-fill location from IP for new profiles
          try {
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            if (currentSession) {
              const ipRes = await fetch(`${SUPABASE_FUNCTIONS_URL}/get-ip-info`, {
                headers: {
                  Authorization: `Bearer ${currentSession.access_token}`,
                  'Content-Type': 'application/json',
                  apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4',
                },
              });
              const ipData = await ipRes.json();
              if (!ipData.error && ipData.city !== 'Unknown') {
                const locationStr = `${ipData.city}, ${ipData.state}, ${ipData.country}`;
                await supabase.from('profiles').update({
                  city: ipData.city,
                  state: ipData.state,
                  country: ipData.country,
                  location: locationStr,
                }).eq('user_id', authUser.id);
                console.log('📍 Auto-filled location for new profile:', locationStr);
              }
            }
          } catch (locErr) {
            console.error('⚠️ Auto-location failed (non-critical):', locErr);
          }
        }
      }
    } catch (error) {
      console.error('Error in fetchUserProfileAndCreateIfNeeded:', error);
      setProfile(null);
    } finally {
      setProfileLoading(false);
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, fullName: string, mobileNumber?: string, customRedirectUrl?: string, phoneVerified = false) => {
    try {
      const redirectUrl = customRedirectUrl || `${window.location.origin}/`;
      
      // Format phone to E.164 (any country; 10-digit input defaults to +91)
      let formattedPhone: string | undefined = undefined;
      if (mobileNumber) {
        const e164 = toE164(mobileNumber);
        if (isValidE164(e164)) {
          formattedPhone = e164;
        }
      }
      
      const signUpData: any = {
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
            mobile_number: mobileNumber || '',
            phone_verified: phoneVerified
          }
        }
      };
      
      // Only add phone if it's properly formatted
      if (formattedPhone) {
        signUpData.phone = formattedPhone;
      }
      
      const { data, error } = await supabase.auth.signUp(signUpData);
      
      // If signup successful and phone number exists, update user with phone
      if (!error && data.user && formattedPhone) {
        try {
          await supabase.auth.updateUser({
            phone: formattedPhone
          });
          console.log('✅ Phone number updated:', formattedPhone);
        } catch (phoneError) {
          console.error('⚠️ Phone update failed (non-critical):', phoneError);
          // Don't fail signup if phone update fails
        }
      }
      
      // Send welcome push notification via OneSignal
      // Welcome is sent after JobSeekerOnboarding completes, not at signup.
      if (false && !error && data.user) {
        try {
          await triggerPushEvent('push_signup_welcome', data.user.id, 'website_user', fullName, {
            user_name: fullName
          });
          console.log('🔔 OneSignal welcome push sent for new user');
        } catch (pushError) {
          console.error('⚠️ OneSignal welcome push failed (non-critical):', pushError);
        }
      }
      
      // When Supabase "Confirm email" is ON, signUp returns a user but no
      // session — the account is not usable until the emailed link is opened.
      // When it is OFF, a session comes back right away.
      return { error, needsEmailConfirmation: !error && !!data?.user && !data?.session };
    } catch (err) {
      console.error('Signup error:', err);
      return { error: err };
    }
  };

  const signIn = async (email: string, password: string, customRedirectUrl?: string) => {
    try {
      const { error } = await signInWithIdentifier(email, password);
      
      // Note: updateLastLogin is called from onAuthStateChange listener (SIGNED_IN event)
      // to avoid duplicate calls and ensure consistent behavior across all login methods
      
      return { error };
    } catch (err) {
      console.error('Sign in error:', err);
      return { error: err };
    }
  };

  const signInWithGoogle = async (customRedirectUrl?: string) => {
    try {
      const baseUrl = `${window.location.origin}/auth`;
      const redirectUrl = customRedirectUrl ? `${baseUrl}?redirect=${encodeURIComponent(customRedirectUrl)}` : baseUrl;
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          scopes: 'openid email profile',
          queryParams: {
            prompt: 'select_account',
          },
        }
      });
      return { error };
    } catch (err) {
      console.error('Google sign in error:', err);
      return { error: err };
    }
  };

  const signInWithLinkedIn = async (customRedirectUrl?: string) => {
    try {
      // Connect flow (AI Connect page) — link/re-authorize and keep the token.
      if (customRedirectUrl) {
        return await startSocialOAuth('linkedin', customRedirectUrl);
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'linkedin_oidc',
        options: {
          redirectTo: `${window.location.origin}/auth`,
          scopes: 'openid profile email w_member_social',
        },
      });
      return { error };
    } catch (err) {
      console.error('LinkedIn sign in error:', err);
      return { error: err };
    }
  };

  const signInWithTwitter = async (customRedirectUrl?: string) => {
    try {
      // Connect flow (AI Connect page) — link/re-authorize and keep the token.
      if (customRedirectUrl) {
        return await startSocialOAuth('x', customRedirectUrl);
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'x',
        options: {
          redirectTo: `${window.location.origin}/auth`,
          scopes: 'tweet.read tweet.write users.read offline.access',
        },
      });
      return { error };
    } catch (err) {
      console.error('X sign in error:', err);
      return { error: err };
    }
  };

  // GitHub / GitLab: plain login lands back on /auth (job seeker home flow);
  // with a redirect path it becomes the AI Connect "link account" flow.
  const signInWithGitHub = async (customRedirectUrl?: string) => {
    try {
      if (customRedirectUrl) {
        return await startSocialOAuth('github', customRedirectUrl);
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/auth`,
          scopes: 'read:user user:email',
        },
      });
      return { error };
    } catch (err) {
      console.error('GitHub sign in error:', err);
      return { error: err };
    }
  };

  const signInWithGitLab = async (customRedirectUrl?: string) => {
    try {
      if (customRedirectUrl) {
        return await startSocialOAuth('gitlab', customRedirectUrl);
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'gitlab',
        options: {
          redirectTo: `${window.location.origin}/auth`,
          scopes: 'read_user',
        },
      });
      return { error };
    } catch (err) {
      console.error('GitLab sign in error:', err);
      return { error: err };
    }
  };


  const signOut = async () => {
    profileFetchRef.current = null;
    // NOTE: browser Quick Login tokens are intentionally KEPT on sign-out so the
    // login page can recommend this account again on this browser. They are only
    // revoked when the user clears browser data or disables Quick Login.
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    try {
      // First check if email exists in auth.users (case-insensitive)
      const { data: emailExists, error: checkError } = await supabase
        .rpc('check_email_exists', { p_email: email.toLowerCase() });

      // If RPC call failed, return a friendly error
      if (checkError) {
        console.error('Email check error:', checkError);
        return { 
          error: { 
            message: 'Password reset temporarily unavailable. Please try again.',
            code: 'service_unavailable'
          } 
        };
      }

      // If no user found with this email, return error
      if (!emailExists) {
        return { 
          error: { 
            message: 'user not found',
            code: 'user_not_found'
          } 
        };
      }

      const redirectUrl = `${window.location.origin}/reset-password`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl
      });
      return { error };
    } catch (err) {
      console.error('Reset password error:', err);
      return { error: err };
    }
  };

  const changeEmail = async (newEmail: string) => {
    try {
      if (!user) {
        return { error: { message: 'No user logged in' } };
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newEmail)) {
        return { error: { message: 'Please enter a valid email address' } };
      }

      // Check if new email is same as current
      if (user.email && newEmail.toLowerCase() === user.email.toLowerCase()) {
        return { error: { message: 'This is already your current email address' } };
      }

      const redirectUrl = `${window.location.origin}/verify-email-change`;
      
      const { error } = await supabase.auth.updateUser(
        { email: newEmail },
        { emailRedirectTo: redirectUrl }
      );

      return { error };
    } catch (err: any) {
      console.error('Change email error:', err);
      return { error: err };
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: 'No user logged in' };

    try {
      console.log('Updating profile with data:', updates);
      
      // First try to update existing profile
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching existing profile:', fetchError);
        return { error: fetchError };
      }

      let error;
      let updateSuccess = false;
      
      if (existingProfile) {
        // Update existing profile and wait for confirmation
        console.log('Updating existing profile...');
        const { data: updatedData, error: updateError } = await supabase
          .from('profiles')
          .update({
            ...updates,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id)
          .select()
          .single();
        
        error = updateError;
        updateSuccess = !updateError && !!updatedData;
        
        if (error) {
          console.error('Error updating profile:', error);
          // Check for RLS policy violations
          if (error.code === '42501' || error.message.includes('policy')) {
            return { error: { ...error, message: 'Profile update failed: Permission denied. Please check your login status.' } };
          }
        } else if (updatedData) {
          console.log('Profile updated successfully:', updatedData);
          // Update local state with confirmed data
          setProfile(updatedData as Profile);
          
          // Update cached profile completion status
          const isComplete = checkProfileCompletionForProfile(updatedData as Profile);
          setCachedProfileCompletion(isComplete);
        }
      } else {
        // Insert new profile and wait for confirmation
        console.log('Creating new profile...');
        const { data: insertedData, error: insertError } = await supabase
          .from('profiles')
          .insert({
            user_id: user.id,
            ...updates,
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
        
        error = insertError;
        updateSuccess = !insertError && !!insertedData;
        
        if (error) {
          console.error('Error creating profile:', error);
          if (error.code === '42501' || error.message.includes('policy')) {
            return { error: { ...error, message: 'Profile creation failed: Permission denied. Please check your login status.' } };
          }
        } else if (insertedData) {
          console.log('Profile created successfully:', insertedData);
          // Update local state with confirmed data
          setProfile(insertedData as Profile);
          
          // Update cached profile completion status
          const isComplete = checkProfileCompletionForProfile(insertedData as Profile);
          setCachedProfileCompletion(isComplete);
        }
      }

      // Only return success if we got confirmed data back
      if (!updateSuccess && !error) {
        error = { message: 'Profile update completed but confirmation failed' };
      }

      return { error };
    } catch (err) {
      console.error('Error updating profile:', err);
      return { error: err };
    }
  };

  const checkProfileCompletionForProfile = (profileData: Profile | null) => {
    if (!profileData) return false;

    // If the DB flag is set, treat profile as complete
    if (profileData.is_profile_complete === true) return true;
    
    // Required fields for profile completion verification
    const requiredFields = [
      'full_name',
      'phone', 
      'whatsapp_number',
      'city',
      'state',
      'country',
      'postal_code'
    ] as const;

    return requiredFields.every((field) => {
      const value = profileData[field as keyof Profile];
      return value !== null && value !== undefined && value !== '';
    });
  };

  // Get missing fields for verification screen
  const getMissingProfileFields = (profileData: Profile | null): string[] => {
    if (!profileData) return ['full_name', 'phone', 'whatsapp_number', 'city', 'state', 'country', 'postal_code'];
    
    const fieldLabels: Record<string, string> = {
      full_name: 'Full Name',
      phone: 'Phone Number',
      whatsapp_number: 'WhatsApp Number',
      city: 'City',
      state: 'State',
      country: 'Country',
      postal_code: 'Postal Code'
    };

    const missingFields: string[] = [];
    const requiredFields = ['full_name', 'phone', 'whatsapp_number', 'city', 'state', 'country', 'postal_code'];

    requiredFields.forEach((field) => {
      const value = profileData[field as keyof Profile];
      if (value === null || value === undefined || value === '') {
        missingFields.push(fieldLabels[field] || field);
      }
    });

    return missingFields;
  };

  const checkProfileCompletion = () => {
    // Use cached status if available and profile is still loading
    if (profileLoading && !profile) {
      const cached = getCachedProfileCompletion();
      if (cached !== null) return cached;
    }
    
    return checkProfileCompletionForProfile(profile);
  };

  const isBanned = () => {
    return profile?.account_status === 'banned';
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserProfile(user.id);
    }
  };

  const value = {
    user,
    session,
    profile,
    loading,
    profileLoading,
    signUp,
    signIn,
    signInWithGoogle,
    signInWithLinkedIn,
    signInWithTwitter,
    signInWithGitHub,
    signInWithGitLab,

    signOut,
    resetPassword,
    changeEmail,
    updateProfile,
    checkProfileCompletion,
    isBanned,
    refreshProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};