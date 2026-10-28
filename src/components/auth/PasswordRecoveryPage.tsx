import type { ReactNode } from 'react';
import { KeyRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import SEO from '@/components/SEO';

interface PasswordRecoveryPageProps {
  audience: 'job_seeker' | 'employer';
  children: ReactNode;
}

export default function PasswordRecoveryPage({ audience, children }: PasswordRecoveryPageProps) {
  const loginPath = audience === 'employer' ? '/employer-auth' : '/auth';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO title="Forgot password? - Workly India" description="Recover your Workly India account securely using a verification code." canonical={audience === 'employer' ? '/employer-forgot-password' : '/forgot-password'} />
      <main className="mx-auto w-full max-w-md px-6 py-12 sm:py-16">
        <div className="mb-8 space-y-3">
          <KeyRound className="mb-5 h-10 w-10 text-auth-link" />
          <p className="text-sm text-muted-foreground">{audience === 'employer' ? 'Employer Portal' : 'Job Seeker Portal'}</p>
          <h1 className="text-3xl font-semibold">Forgot password?</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">Enter your account email to reset your password securely.</p>
        </div>
        {children}
        <div className="mt-8 border-t border-border pt-5 text-center">
          <Button asChild variant="link" className="text-auth-link"><Link to={loginPath}>Back to Log In</Link></Button>
        </div>
      </main>
    </div>
  );
}