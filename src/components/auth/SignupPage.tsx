import type { ReactNode } from 'react';
import { UserRoundPlus } from 'lucide-react';
import SEO from '@/components/SEO';

interface SignupPageProps {
  audience: 'job_seeker' | 'employer';
  children: ReactNode;
}

export default function SignupPage({ audience, children }: SignupPageProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO title={audience === 'employer' ? 'Employer Sign Up - Post Jobs Free | Workly India' : 'Job Seeker Sign Up - Create Free Account | Workly India'} description={audience === 'employer' ? 'Create a free employer account on Workly India and start posting jobs to reach verified candidates across India.' : 'Create your free Workly India job seeker account and apply to verified remote and work from home jobs across India.'} canonical={audience === 'employer' ? '/employer-signup' : '/signup'} />
      <main className="mx-auto w-full max-w-md px-6 py-12 sm:py-16">
        <div className="mb-8 space-y-3">
          <UserRoundPlus className="mb-5 h-10 w-10 text-auth-link" />
          <p className="text-sm text-muted-foreground">{audience === 'employer' ? 'Employer Portal' : 'Job Seeker Portal'}</p>
          <h1 className="text-3xl font-semibold">Create an account</h1>
        </div>
        {children}
      </main>
    </div>
  );
}