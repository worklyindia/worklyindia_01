import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { LogIn, Loader2, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { SafeAvatarImage } from '@/components/ui/safe-image';
import { normalizeImageUrl } from '@/utils/imageUrl';
import { useBrowserQuickLogin } from '@/hooks/useBrowserQuickLogin';
import { BrowserAccount, BrowserUserType } from '@/lib/browserQuickLogin';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';

interface Props {
  userType: BrowserUserType;
}

const initialsFor = (account: BrowserAccount) => {
  const source = account.full_name || account.email;
  if (!source) return '?';
  const parts = source.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const BrowserQuickLoginCard = ({ userType }: Props) => {
  const { accounts, loading, signingInEmail, signInWithAccount, removeAccount } =
    useBrowserQuickLogin(userType);
  const [dismissed, setDismissed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [manageMode, setManageMode] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isMobile && !loading && !dismissed && accounts.length > 0) {
      setSheetOpen(true);
    }
  }, [isMobile, loading, dismissed, accounts.length]);

  const handleSignIn = async (account: BrowserAccount) => {
    const result = await signInWithAccount(account);
    if (!result.ok) {
      toast.error(
        result.error === 'user_disabled'
          ? 'Quick Login is turned off for this account.'
          : 'Quick Login failed. Please log in normally.'
      );
    }
  };

  if (loading || dismissed || accounts.length === 0) return null;

  const renderAccountList = (list: BrowserAccount[]) => (
    <div className="space-y-2.5">
      {list.map((account) => {
        const isSigningIn = signingInEmail === account.email;
        return (
          <button
            key={account.email}
            type="button"
            onClick={() => (manageMode ? removeAccount(account) : handleSignIn(account))}
            disabled={!!signingInEmail}
            className="w-full flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-3.5 text-left shadow-sm transition-all active:scale-[0.98] hover:border-primary/40 hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Avatar className="h-12 w-12 border-2 border-primary/20">
              {account.image_url ? (
                <SafeAvatarImage
                  src={normalizeImageUrl(account.image_url)}
                  alt={account.full_name || account.email}
                />
              ) : null}
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {initialsFor(account)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              {account.full_name && (
                <p className="text-[15px] font-semibold text-foreground truncate leading-tight">
                  {account.full_name}
                </p>
              )}
              <p className="text-xs text-muted-foreground truncate">{account.email}</p>
            </div>
            {isSigningIn ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : manageMode ? (
              <Trash2 className="h-5 w-5 text-destructive" />
            ) : (
              <ChevronRight className="h-5 w-5 text-primary" />
            )}
          </button>
        );
      })}
    </div>
  );

  if (isMobile) {
    const single = accounts.length === 1 ? accounts[0] : null;
    return (
      <>

        {sheetOpen &&
          createPortal(
            <div
              className="fixed bottom-0 left-0 right-0 z-[100] bg-background border-t border-border rounded-t-3xl shadow-[0_-8px_40px_-12px_hsl(var(--foreground)/0.25)] animate-in slide-in-from-bottom duration-300"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
            >
              <>
                <div className="flex justify-center pt-2.5 pb-1">
                  <div className="w-10 h-1.5 bg-muted rounded-full" />
                </div>

                <div className="flex items-center justify-between px-5 pb-1">
                  <button
                    type="button"
                    onClick={() => setManageMode((m) => !m)}
                    className="text-sm font-semibold text-primary"
                  >
                    {manageMode ? 'Done' : 'Account'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSheetOpen(false);
                      setManageMode(false);
                    }}
                    aria-label="Close"
                    className="rounded-full p-1.5 text-muted-foreground active:scale-95 transition-transform"
                  >
                    <ChevronDown className="h-5 w-5" />
                  </button>
                </div>

                {single && (
                  <div className="flex flex-col items-center px-6 pt-3">
                    <Avatar className="h-24 w-24 border-4 border-primary/15 shadow-lg">
                      {single.image_url ? (
                        <SafeAvatarImage
                          src={normalizeImageUrl(single.image_url)}
                          alt={single.full_name || single.email}
                        />
                      ) : null}
                      <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                        {initialsFor(single)}
                      </AvatarFallback>
                    </Avatar>

                    {single.full_name && (
                      <p className="mt-4 text-lg font-bold text-foreground text-center leading-tight">
                        {single.full_name}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-muted-foreground text-center break-all">
                      {single.email}
                    </p>

                    {manageMode ? (
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={() => removeAccount(single)}
                        className="mt-6 w-full h-12 rounded-2xl text-base font-semibold text-destructive border-destructive/40"
                      >
                        <Trash2 className="h-5 w-5 mr-2" />
                        Remove account
                      </Button>
                    ) : (
                    <Button
                      size="lg"
                      onClick={() => handleSignIn(single)}
                      disabled={!!signingInEmail}
                      className="mt-6 w-full h-12 rounded-2xl text-base font-semibold text-primary-foreground bg-gradient-to-r from-primary via-primary to-secondary shadow-lg shadow-primary/30 hover:opacity-95 active:scale-[0.98] transition-all"
                    >
                      {signingInEmail === single.email ? (
                        <>
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          Logging in...
                        </>
                      ) : (
                        <>
                          <LogIn className="h-5 w-5 mr-2" />
                          Quick Login
                        </>
                      )}
                    </Button>
                    )}
                  </div>
                )}

                {accounts.length > 1 && (
                  <div className="px-5 pt-4 pb-1">{renderAccountList(accounts)}</div>
                )}
              </>
            </div>,
            document.body
          )}
      </>
    );
  }

  return (
    <div className="w-full basis-full rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/5 via-card to-secondary/5 p-4 shadow-sm">
      <div className="flex items-center justify-end mb-3">
        <button
          onClick={() => setDismissed(true)}
          className="rounded-full p-1.5 hover:bg-muted transition-colors"
          aria-label="Dismiss Quick Login"
        >
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
      {renderAccountList(accounts)}
    </div>
  );
};

export default BrowserQuickLoginCard;
