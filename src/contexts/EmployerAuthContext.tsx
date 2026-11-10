import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { signInWithIdentifier } from '@/lib/loginIdentifier';
import { handleAuthError } from '@/utils/authErrorHandler';
import { triggerPushEvent } from '@/hooks/usePushTrigger';
import { updateLastLogin } from '@/utils/updateLastLogin';
import { SUPABASE_FUNCTIONS_URL } from '@/constants/supabase';
import { autoCollectDeviceInfo } from '@/utils/autoDeviceInfoCollector';
import { triggerPwaInstallAfterLogin } from '@/utils/pwaInstallTrigger';
import { isFilePickerSuspended } from '@/lib/filePickerGuard';
import { toE164, isValidE164 } from '@/lib/phone';

interface Company {
  id: string;
  user_id: string;
  company_name: string;
  legal_name: string | null;
  business_type: string | null;
  industry: string | null;
  location: string | null;
  website: string | null;
  description: string | null;
  logo_url: string | null;
  is_verified: boolean;
  is_profile_complete: boolean;
  email: string | null;
  phone: string | null;
  country: string | null;
  state: string | null;
  district: string | null;
  city: string | null;
  postal_code: string | null;
  whatsapp_number: string | null;
  company_details: string | null;
  organisation_size: string | null;
  company_size: string | null;
  interview_contact_details: string | null;
  incorporation_date: string | null;
  verified_plan_start: string | null;
  verified_plan_end: string | null;
  badge_color: string | null;
  hr_contact_name: string | null;
  account_status?: string;
  job_posting_visibility?: boolean;
}

interface EmployerAuthContextType {
  user: User | null;
  session: Session | null;
  company: Company | null;
  loading: boolean;
  companyLoading: boolean;
  signUp: (email: string, password: string, companyName: string, mobileNumber?: string, customRedirectUrl?: string, phoneVerified?: boolean) => Promise<{ error: any; needsEmailConfirmation?: boolean }>;
  signIn: (email: string, password: string, redirectUrl?: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signInWithLinkedIn: () => Promise<{ error: any }>;
  signInWithTwitter: () => Promise<{ error: any }>;
  signInWithGitHub: () => Promise<{ error: any }>;
  signInWithGitLab: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  changeEmail: (newEmail: string) => Promise<{ error: any }>;
  updateCompany: (updates: Partial<Company>) => Promise<{ error: any }>;
  checkCompanyCompletion: () => boolean;
  refreshCompany: () => Promise<void>;
}

export const EmployerAuthContext = createContext<EmployerAuthContextType | undefined>(undefined);

export const useEmployerAuth = () => {
  const context = useContext(EmployerAuthContext);
  if (context === undefined) {
    throw new Error('useEmployerAuth must be used within an EmployerAuthProvider');
  }
  return context;
};

export const EmployerAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyLoading, setCompanyLoading] = useState(false);
  
  // Dedup guard: prevent concurrent/duplicate company fetches for the same user
  const companyFetchRef = React.useRef<string | null>(null);

  // Cache employer profile completion status (matching job seeker pattern)
  const getCachedCompanyCompletion = () => {
    try {
      const cached = localStorage.getItem('employer_profile_completion_status');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  };

  const setCachedCompanyCompletion = (isComplete: boolean) => {
    try {
      localStorage.setItem('employer_profile_completion_status', JSON.stringify(isComplete));
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
      if (currentPath !== '/' && !currentPath.includes('/employer-auth')) {
        try {
          sessionStorage.setItem('preservedEmployerRoute', currentPath);
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
          // Preserve route before loading company - defer with setTimeout
          preserveRoute();

          // Save LinkedIn connection + profile link whenever a LinkedIn token is present
          setTimeout(() => {
            import('@/lib/linkedinSync').then(({ syncLinkedInFromSession }) =>
              syncLinkedInFromSession(session)
            );
          }, 0);
          
          // Update last login ONLY on fresh login (not page refresh)
          if (event === 'SIGNED_IN' && !isInitialLoad) {
            // Extra safety: Check session age - if session is older than 10 seconds, it's a page refresh
            const sessionLastSignIn = session.user?.last_sign_in_at;
            const now = Date.now();
            const signInTime = sessionLastSignIn ? new Date(sessionLastSignIn).getTime() : 0;
            const sessionAge = now - signInTime;
            
            // Only update if this is a truly fresh login (session age < 10 seconds)
            if (sessionAge < 10000) {
              console.log('🏢 Fresh employer login detected, updating last login...', { sessionAge: `${sessionAge}ms` });
              updateLastLogin().catch(console.error);
              // Auto-collect device info on fresh login
              if (session.access_token) {
                autoCollectDeviceInfo(session.access_token, 'employer').catch(console.error);
              }
              // Trigger PWA install prompt after fresh login
              setTimeout(() => {
                triggerPwaInstallAfterLogin().catch(console.error);
              }, 3000);
            } else {
              console.log('⏭️ Skipping employer last login update - session is old (page refresh)', { sessionAge: `${sessionAge}ms` });
            }
            
            // Check if this is an employer Google OAuth login
            try {
              // LinkedIn: whenever a LinkedIn provider token is present, activate/refresh services
              const liProviderToken = (session as any)?.provider_token || null;
              const liProviders: string[] = (session.user?.app_metadata as any)?.providers || [];
              const isLinkedIn =
                session.user?.app_metadata?.provider === 'linkedin_oidc' ||
                liProviders.includes('linkedin_oidc');
              if (isLinkedIn && liProviderToken) {
                setTimeout(async () => {
                  try {
                    const { data: liData, error: liError } = await supabase.functions.invoke(
                      'employer-google-auth',
                      {
                        headers: { Authorization: `Bearer ${session.access_token}` },
                        body: {
                          action: 'linkedin-connect',
                          provider_token: liProviderToken,
                          scopes: 'openid profile email w_member_social',
                        },
                      }
                    );
                    console.log('🔗 LinkedIn services activation:', { liData, liError });
                  } catch (e) {
                    console.warn('LinkedIn activation failed (non-critical):', e);
                  }
                }, 0);
              }
              const isEmployerOAuth = sessionStorage.getItem('employer_oauth_pending') === 'true';
              if (isEmployerOAuth) {
                console.log('🏢 Employer OAuth detected via sessionStorage flag');
                // Set employer auto-redirect flag so Index.tsx redirects to employer portal
                localStorage.setItem('employerAutoRedirect', 'true');
                // Call edge function to ensure company profile exists
                setTimeout(async () => {
                  try {
                    const { data: { session: currentSession } } = await supabase.auth.getSession();
                    if (currentSession) {
                      await supabase.functions.invoke('employer-google-auth', {
                        headers: { Authorization: `Bearer ${currentSession.access_token}` }
                      });
                      console.log('✅ Employer Google OAuth edge function called');

                      // LinkedIn: activate all LinkedIn services for this employer
                      const providerToken =
                        (currentSession as any)?.provider_token ||
                        (session as any)?.provider_token ||
                        null;
                      const provider = currentSession.user?.app_metadata?.provider;
                      if (provider === 'linkedin_oidc' && providerToken) {
                        const { data: liData, error: liError } = await supabase.functions.invoke(
                          'employer-google-auth',
                          {
                            headers: { Authorization: `Bearer ${currentSession.access_token}` },
                            body: {
                              action: 'linkedin-connect',
                              provider_token: providerToken,
                              scopes: 'openid profile email w_member_social',
                            },
                          }
                        );
                        console.log('🔗 LinkedIn services activation:', { liData, liError });
                      }
                    }
                  } catch (err) {
                    console.error('⚠️ Employer OAuth edge function error (non-critical):', err);
                  }
                }, 0);
                // Clear the flag
                sessionStorage.removeItem('employer_oauth_pending');
              }
            } catch (e) {
              // Ignore storage errors
            }
          }
          
          // USER_UPDATED (phone_change OTP verify) must refetch the company —
          // otherwise the dedup guard in fetchCompanyProfile returns early and
          // companyLoading=true here is never cleared (guard stuck on loader).
          if (event === 'USER_UPDATED') companyFetchRef.current = null;
          // Only raise the loading gate when a fetch will actually run.
          if (companyFetchRef.current !== session.user.id) setCompanyLoading(true);
          setTimeout(() => {
            fetchCompanyProfile(session.user.id);
          }, 0);
        } else {
          // User signed out — clear all state and dedup guard
          companyFetchRef.current = null;
          setCompany(null);
          setCompanyLoading(false);
        }
        setLoading(false);
      }
    );

    // Check for existing session - mark as initial load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        preserveRoute();
        setCompanyLoading(true);
        setTimeout(() => {
          fetchCompanyProfile(session.user.id);
        }, 0);
        
        // Check if this is a fresh OAuth redirect (session age < 15 seconds)
        const sessionLastSignIn = session.user?.last_sign_in_at;
        const signInTime = sessionLastSignIn ? new Date(sessionLastSignIn).getTime() : 0;
        const sessionAge = Date.now() - signInTime;
        if (sessionAge < 15000 && session.access_token) {
          console.log('🏢 Fresh employer OAuth/login detected, collecting device info...', { sessionAge: `${sessionAge}ms` });
          autoCollectDeviceInfo(session.access_token, 'employer').catch(console.error);
          // Trigger PWA install prompt after OAuth redirect login
          setTimeout(() => {
            triggerPwaInstallAfterLogin().catch(console.error);
          }, 3000);
        }
      }
      setLoading(false);
      // After initial session check, any subsequent SIGNED_IN events are fresh logins
      // Use 2000ms to ensure page refresh completes before flag changes
      setTimeout(() => {
        isInitialLoad = false;
      }, 2000);
    });

    return () => subscription.unsubscribe();
  }, []);

  // === Wake self-heal ===
  // On mobile, screen-off suspends in-flight Supabase requests and can leave
  // `loading = true` forever. When the tab returns to visible, re-check the
  // session and refetch the company profile. Also enforce a hard safety
  // timeout that force-releases loading so the UI never stays on skeleton.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      // Coming back from the native file/photo picker must not re-check the
      // session — it remounts the page and loses the picked image.
      if (isFilePickerSuspended()) return;
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (!session?.user) {
          setCompany(null);
          setCompanyLoading(false);
          setLoading(false);
          return;
        }
        setLoading(false);
        // Reset dedup guard so the refetch actually runs
        companyFetchRef.current = null;
        fetchCompanyProfile(session.user.id);
      }).catch(() => setLoading(false));
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

  // Hard safety net: prevent forever-stuck loading gate.
  useEffect(() => {
    if (!loading) return;
    const t = window.setTimeout(() => setLoading(false), 8000);
    return () => window.clearTimeout(t);
  }, [loading]);

  // Same safety net for the company loading gate: a hung request on a flaky
  // network must never keep OnboardingGuard's full-screen loader up forever.
  useEffect(() => {
    if (!companyLoading) return;
    const t = window.setTimeout(() => setCompanyLoading(false), 10000);
    return () => window.clearTimeout(t);
  }, [companyLoading]);

  // === Auto-logout when this employer account is deleted server-side ===
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase.channel(`account-${user.id}`);
    channel
      .on('broadcast', { event: 'account_deleted' }, async () => {
        try { await supabase.auth.signOut(); } catch (_e) {}
        setSession(null);
        setUser(null);
        try { localStorage.clear(); sessionStorage.clear(); } catch (_e) {}
        setTimeout(() => { window.location.href = '/'; }, 500);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);


  const fetchCompanyProfile = async (userId: string) => {
    // Dedup: skip if already fetching/fetched for this user
    if (companyFetchRef.current === userId) return;
    companyFetchRef.current = userId;
    
    setCompanyLoading(true);
    console.log('🏢 Starting company profile fetch for user:', userId);
    
    // Watchdog to prevent infinite loading
    const watchdog = setTimeout(() => {
      console.warn('Company profile fetch timed out. Unblocking UI.');
      setCompanyLoading(false);
    }, 8000);
    
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('❌ Error fetching company:', error);
        clearTimeout(watchdog);
        setCompanyLoading(false);
        return;
      }

      const latest = Array.isArray(data) && data.length > 0 ? data[0] : null;

      console.log('✅ Company profile fetched:', {
        found: !!latest,
        companyId: latest?.id,
        companyName: latest?.company_name,
        legalName: latest?.legal_name,
        email: latest?.email,
        phone: latest?.phone,
        hrContactName: latest?.hr_contact_name,
        isProfileComplete: latest?.is_profile_complete,
        accountStatus: latest?.account_status
      });
      
      // Resolve a logo fallback from OAuth avatar or the user's job seeker profile.
      // Used for both auto-create (OAuth signup) and existing-company backfill.
      const resolveLogoFallback = async (currentUser: User | null | undefined): Promise<string | null> => {
        const meta: any = currentUser?.user_metadata || {};
        // Try every common avatar key Google / LinkedIn / other providers use.
        const directAvatar: string | null =
          meta.avatar_url ||
          meta.picture ||
          meta.picture_url ||
          meta.avatar ||
          meta.profile_picture ||
          meta.profile_image_url ||
          null;
        if (directAvatar) return directAvatar;

        // Fallback: scan linked identities (Google/LinkedIn populate identity_data here).
        const identities: any[] = (currentUser as any)?.identities || [];
        for (const ident of identities) {
          const id: any = ident?.identity_data || {};
          const url =
            id.avatar_url || id.picture || id.picture_url || id.avatar || null;
          if (url) return url;
        }

        // Final fallback: same auth user's job seeker profile photo (if any).
        try {
          const { data: seekerProfile } = await supabase
            .from('profiles')
            .select('profile_image_url')
            .eq('user_id', userId)
            .maybeSingle();
          if (seekerProfile?.profile_image_url) return seekerProfile.profile_image_url;
        } catch {
          /* ignore */
        }

        // Koi default company logo save nahi karna — logo sirf social DP
        // ya employer ke apne upload se aayega.
        return null;
      };

      // Auto-create company for Google OAuth users who don't have one yet
      if (!latest) {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        const currentUser = currentSession?.user;
        const provider = currentUser?.app_metadata?.provider;
        
        if ((provider === 'google' || provider === 'linkedin_oidc' || provider === 'twitter' || provider === 'x' || provider === 'github' || provider === 'gitlab') && currentUser) {
          const googleName =
            currentUser.user_metadata?.full_name ||
            currentUser.user_metadata?.name ||
            currentUser.user_metadata?.user_name ||
            currentUser.user_metadata?.preferred_username ||
            'My Company';
          const googleEmail = currentUser.email;
          const fallbackLogo = await resolveLogoFallback(currentUser);
          
          console.log('🔄 Auto-creating company for Google OAuth employer:', { googleName, googleEmail, hasFallbackLogo: !!fallbackLogo });
          
          try {
            // Set user_type metadata
            await supabase.auth.updateUser({
              data: { user_type: 'employer' }
            });
            
            const { data: newCompany, error: createError } = await supabase
              .from('companies')
              .insert({
                user_id: userId,
                company_name: googleName,
                email: googleEmail,
                logo_url: fallbackLogo,
                is_profile_complete: false
              })
              .select()
              .single();
            
            if (createError) {
              console.error('❌ Error auto-creating company for Google user:', createError);
            } else {
              console.log('✅ Company auto-created for Google OAuth employer:', newCompany?.id);
              setCompany(newCompany as Company);
              
              // Auto-fill location for new company
              try {
                const { data: { session: sess } } = await supabase.auth.getSession();
                if (sess) {
                  const ipRes = await fetch(`${SUPABASE_FUNCTIONS_URL}/get-ip-info`, {
                    headers: {
                      Authorization: `Bearer ${sess.access_token}`,
                      'Content-Type': 'application/json',
                      apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1Ynd6ZWx1cGJudGJldHBhanFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDc3NjIsImV4cCI6MjA3MDQ4Mzc2Mn0.YsA13ya6S-ogDW59wVQ-n1JhVzDSwAuErfG0WZLTqI4',
                    },
                  });
                  const ipData = await ipRes.json();
                  if (!ipData.error && ipData.city !== 'Unknown') {
                    const locationStr = `${ipData.city}, ${ipData.state}, ${ipData.country}`;
                    await supabase.from('companies').update({
                      city: ipData.city,
                      state: ipData.state,
                      country: ipData.country,
                      location: locationStr,
                    }).eq('user_id', userId);
                    console.log('📍 Auto-filled location for new company:', locationStr);
                  }
                }
              } catch (locErr) {
                console.error('⚠️ Auto-location failed (non-critical):', locErr);
              }
              
              clearTimeout(watchdog);
              setCompanyLoading(false);
              return;
            }
          } catch (autoCreateErr) {
            console.error('❌ Error in Google OAuth company auto-creation:', autoCreateErr);
          }
        }
      }

      // Existing company: refresh logo from OAuth if missing OR if current logo
      // is the saved default / a rotating OAuth-hosted URL. Never overwrite an
      // employer-uploaded logo.
      if (latest) {
        try {
          const { isOAuthHostedAvatar } = await import('@/utils/defaultAvatars');
          const { data: defLogoRow } = await supabase
            .from('app_settings')
            .select('setting_value')
            .eq('setting_key', 'default_company_logo')
            .maybeSingle();
          const defaultLogo = defLogoRow?.setting_value || '';
          const hasNoLogo = !latest.logo_url;
          const isDefault = !!defaultLogo && latest.logo_url === defaultLogo;
          const isOAuthHosted = isOAuthHostedAvatar(latest.logo_url);
          const isReplaceable = hasNoLogo || isDefault || isOAuthHosted;

          if (isReplaceable) {
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            const fallbackLogo = await resolveLogoFallback(currentSession?.user);
            if (fallbackLogo && fallbackLogo !== latest.logo_url) {
              const { error: bfError } = await supabase
                .from('companies')
                .update({ logo_url: fallbackLogo })
                .eq('id', latest.id);
              if (!bfError) {
                latest.logo_url = fallbackLogo;
                console.log('🖼️ Updated company logo from OAuth/seeker/default avatar');
              }
            }
          }
        } catch (bfErr) {
          console.error('⚠️ Logo refresh failed (non-critical):', bfErr);
        }
      }

      setCompany(latest as Company | null);
      clearTimeout(watchdog);
      setCompanyLoading(false);
    } catch (error) {
      console.error('❌ Error fetching company profile:', error);
      clearTimeout(watchdog);
      setCompanyLoading(false);
    }
  };

  const signUp = async (email: string, password: string, companyName: string, mobileNumber?: string, customRedirectUrl?: string, phoneVerified = false) => {
    try {
      const redirectUrl = customRedirectUrl || `${window.location.origin}/employer-portal`;
      
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
            company_name: companyName,
            user_type: 'employer',
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
      
      // If signup is successful, create company profile and send welcome notification
      if (!error && data.user) {
        // Send welcome push notification via OneSignal
        // Welcome is sent after CompanyOnboarding completes, not at signup.
        if (false) try {
          await triggerPushEvent('push_employer_signup_welcome', data.user.id, 'employer', companyName, {
            company_name: companyName
          });
          console.log('🔔 OneSignal welcome push sent for new employer');
        } catch (pushError) {
          console.error('⚠️ OneSignal welcome push failed (non-critical):', pushError);
        }
        
        setTimeout(async () => {
          try {
            const { error: companyError } = await supabase
              .from('companies')
              .insert({
                user_id: data.user.id,
                company_name: companyName,
                is_profile_complete: false
              });
            
            if (companyError) {
              console.error('Error creating company profile:', companyError);
            }
          } catch (err) {
            console.error('Error in company creation:', err);
          }
        }, 1000);
      }
      
      // No session back from signUp means Supabase "Confirm email" is ON.
      return { error, needsEmailConfirmation: !error && !!data?.user && !data?.session };
    } catch (err) {
      console.error('Employer signup error:', err);
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
      console.error('Employer sign in error:', err);
      return { error: err };
    }
  };

  const signInWithGoogle = async () => {
    try {
      const redirectUrl = `${window.location.origin}/employer-auth`;

      // Flag so post-OAuth handler knows this is an employer OAuth flow
      // (triggers company auto-create + employer portal redirect).
      try {
        sessionStorage.setItem('employer_oauth_pending', 'true');
        localStorage.setItem('employerAutoRedirect', 'true');
      } catch {}

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          scopes: 'openid email profile',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        }
      });
      
      return { error };
    } catch (err) {
      console.error('Employer Google sign in error:', err);
      return { error: err };
    }
  };

  const signInWithLinkedIn = async () => {
    try {
      const redirectUrl = `${window.location.origin}/employer-auth`;

      try {
        sessionStorage.setItem('employer_oauth_pending', 'true');
        localStorage.setItem('employerAutoRedirect', 'true');
      } catch {}

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'linkedin_oidc',
        options: {
          redirectTo: redirectUrl,
          scopes: 'openid profile email w_member_social',
        }
      });
      
      return { error };
    } catch (err) {
      console.error('Employer LinkedIn sign in error:', err);
      return { error: err };
    }
  };

  const signInWithTwitter = async () => {
    try {
      const redirectUrl = `${window.location.origin}/employer-auth`;

      try {
        sessionStorage.setItem('employer_oauth_pending', 'true');
        localStorage.setItem('employerAutoRedirect', 'true');
      } catch {}

      const { error } = await supabase.auth.signInWithOAuth({
        // X uses OAuth 2.0 provider key 'x' in current GoTrue
        provider: 'x' as any,
        options: {
          redirectTo: redirectUrl,
          scopes: 'tweet.read tweet.write users.read offline.access',
        }
      });

      return { error };
    } catch (err) {
      console.error('Employer X sign in error:', err);
      return { error: err };
    }
  };

  const signInWithGit = async (provider: 'github' | 'gitlab') => {
    try {
      const redirectUrl = `${window.location.origin}/employer-auth`;
      try {
        sessionStorage.setItem('employer_oauth_pending', 'true');
        localStorage.setItem('employerAutoRedirect', 'true');
      } catch {}

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl,
          scopes: provider === 'github' ? 'read:user user:email' : 'read_user',
        },
      });
      return { error };
    } catch (err) {
      console.error(`Employer ${provider} sign in error:`, err);
      return { error: err };
    }
  };

  const signInWithGitHub = () => signInWithGit('github');
  const signInWithGitLab = () => signInWithGit('gitlab');


  const signOut = async () => {
    companyFetchRef.current = null;
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    try {
      // First check if company exists with this email
      const { data: existingCompany, error: checkError } = await supabase
        .from('companies')
        .select('user_id')
        .eq('email', email)
        .maybeSingle();

      // If no company found with this email, return error
      if (!existingCompany && !checkError) {
        return { 
          error: { 
            message: 'user not found',
            code: 'user_not_found'
          } 
        };
      }

      const redirectUrl = `${window.location.origin}/employer-auth?type=recovery`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl
      });
      return { error };
    } catch (err) {
      console.error('Employer reset password error:', err);
      return { error: err };
    }
  };

  const changeEmail = async (newEmail: string) => {
    try {
      if (!user) {
        return { error: { message: 'No user logged in' } };
      }

      const redirectUrl = `${window.location.origin}/verify-email-change`;
      
      const { error } = await supabase.auth.updateUser(
        { email: newEmail },
        { emailRedirectTo: redirectUrl }
      );

      return { error };
    } catch (err) {
      console.error('Change email error:', err);
      return { error: err };
    }
  };

  const updateCompany = async (updates: Partial<Company>) => {
    if (!user) return { error: 'No user logged in' };

    try {
      console.log('Updating company with data:', updates);
      
      // Fetch the latest company row for this user (array-based to avoid maybeSingle issues)
      const { data: existingRows, error: fetchError } = await supabase
        .from('companies')
        .select('id, is_profile_complete, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (fetchError) {
        console.error('Error fetching existing company:', fetchError);
        return { error: fetchError };
      }

      const existingCompany = Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0] : null;

      let error;
      let data;
      
      if (existingCompany) {
        // Update existing company by ID
        console.log('Updating existing company by ID:', existingCompany.id);
        const updateResult = await supabase
          .from('companies')
          .update(updates)
          .eq('id', existingCompany.id)
          .select()
          .single();
        error = updateResult.error;
        data = updateResult.data;
        
        if (error) {
          console.error('Error updating company:', error);
        } else {
          console.log('Company updated successfully');
        }
      } else {
        // Insert new company with required fields
        console.log('Creating new company...');
        const companyData = {
          user_id: user.id,
          company_name: updates.company_name || 'My Company',
          is_profile_complete: false,
          ...updates
        };
        
        const insertResult = await supabase
          .from('companies')
          .insert(companyData)
          .select()
          .single();
        error = insertResult.error;
        data = insertResult.data;
        
        if (error) {
          console.error('Error creating company:', error);
        } else {
          console.log('Company created successfully');
        }
      }

      if (!error && data) {
        // Update local state with the returned data
        setCompany(data as Company);
      }

      return { error };
    } catch (err) {
      console.error('Error updating company:', err);
      return { error: err };
    }
  };

  const checkCompanyCompletion = () => {
    // Use cached status if available and company is still loading (network resilience)
    if ((loading || companyLoading) && !company) {
      const cached = getCachedCompanyCompletion();
      if (cached !== null) {
        console.log('📦 Using cached employer profile completion:', cached);
        return cached;
      }
    }

    console.log('=== checkCompanyCompletion called ===', {
      loading,
      companyLoading,
      user: !!user,
      company: !!company,
      currentPath: window.location.pathname
    });

    // Trust DB flag immediately whenever available (even during loading)
    if (company?.is_profile_complete === true) {
      console.log('✅ Database flag indicates profile is complete - trusting DB');
      setCachedCompanyCompletion(true);
      return true;
    }

    // If we don't have a user or company yet, it's not complete
    if (!user) {
      console.log('Profile completion check: No user');
      return false;
    }

    if (!company) {
      console.log('Profile completion check: No company found, user logged in');
      return false;
    }

    // If still loading, defer strict checks (avoid false negatives during slow fetches)
    if (loading || companyLoading) {
      console.log('Profile completion check: Still loading, deferring decision');
      return false;
    }

    // Fallback: Check required fields
    const hasCompanyName = !!(company.company_name?.toString().trim());
    const hasLegalName = !!(company.legal_name?.toString().trim());
    const hasPhone = !!(company.phone?.toString().trim());
    const hasWhatsAppNumber = !!(company.whatsapp_number?.toString().trim());
    const hasHrContactName = !!(company.hr_contact_name?.toString().trim());

    const hasRequiredFields = hasCompanyName && hasLegalName && hasPhone && hasWhatsAppNumber && hasHrContactName;

    console.log('Enhanced profile completion check (fallback):', {
      companyId: company.id,
      dbFlag: company.is_profile_complete,
      hasRequiredFields
    });

    // Cache the result
    setCachedCompanyCompletion(hasRequiredFields);

    return hasRequiredFields;
  };
  const refreshCompany = useCallback(async () => {
    if (user) {
      await fetchCompanyProfile(user.id);
    }
  }, [user]);

  const value = {
    user,
    session,
    company,
    loading,
    companyLoading,
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
    updateCompany,
    checkCompanyCompletion,
    refreshCompany
  };

  return (
    <EmployerAuthContext.Provider value={value}>
      {children}
    </EmployerAuthContext.Provider>
  );
};