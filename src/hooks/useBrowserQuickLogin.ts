import { useEffect, useState, useCallback } from 'react';
import {
  BrowserAccount,
  BrowserUserType,
  verifyBrowserTokens,
  quickLoginWithBrowserToken,
  removeStoredTokens,
} from '@/lib/browserQuickLogin';
import { supabase } from '@/integrations/supabase/client';

export function useBrowserQuickLogin(userType: BrowserUserType) {
  const [accounts, setAccounts] = useState<BrowserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingInEmail, setSigningInEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results = await verifyBrowserTokens(userType);
      if (!cancelled) {
        setAccounts(results);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userType]);

  const signInWithAccount = useCallback(
    async (account: BrowserAccount): Promise<{ ok: boolean; error?: string }> => {
      setSigningInEmail(account.email);
      try {
        const result = await quickLoginWithBrowserToken(account.token, userType);
        if (result.ok !== true) {
          const err = 'error' in result ? result.error : 'quick_login_failed';
          // Drop stale account from UI.
          setAccounts((prev) => prev.filter((a) => a.email !== account.email));
          return { ok: false, error: err };
        }
        const { error } = await supabase.auth.verifyOtp({
          token_hash: result.token_hash,
          type: 'magiclink',
        });
        if (error) return { ok: false, error: error.message };
        return { ok: true };
      } finally {
        setSigningInEmail(null);
      }
    },
    [userType]
  );

  const removeAccount = useCallback((account: BrowserAccount) => {
    removeStoredTokens([account.token]);
    setAccounts((prev) => prev.filter((a) => a.token !== account.token));
  }, []);

  return { accounts, loading, signingInEmail, signInWithAccount, removeAccount };
}
