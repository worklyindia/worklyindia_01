import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FileEdit, IndianRupee, MapPin, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import SEO from '@/components/SEO';
import PublicIntroductionHeader from '@/components/PublicIntroductionHeader';
import PublicIntroductionHero from '@/components/PublicIntroductionHero';
import { supabase } from '@/integrations/supabase/client';
import { useLiveTableRefresh } from '@/hooks/useLiveTableRefresh';
import postJobPhoto from '@/assets/post-job-introduction.jpg';
import { packagePrice, visiblePackages } from '@/lib/jobPostingPackages';
const loginTo = '/employer-auth?redirect=%2Fpost-job';
interface DurationPackage { months: number; points: number; price?: number; is_default?: boolean }
const steps = [
  { icon: FileEdit, title: 'Describe the role', text: 'Add a clear job title, responsibilities and the skills you need so the right candidates apply.' },
  { icon: IndianRupee, title: 'Set salary & details', text: 'Share the salary range, job type and work schedule. Clear details bring more serious applicants.' },
  { icon: MapPin, title: 'Choose the location', text: 'Mark the job as remote, work-from-home or office-based with the city, so nearby candidates find it.' },
  { icon: Users, title: 'Receive applications', text: 'Candidates apply directly to your post. Review profiles, shortlist and plan interviews from one place.' },
];
export default function PostJobLanding() {
  const [packages, setPackages] = useState<DurationPackage[]>([]);
  const load = () => {
    supabase
      .from('job_posting_settings')
      .select('duration_packages')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setPackages(visiblePackages<DurationPackage>(data?.duration_packages));
      });
  };
  useEffect(load, []);
  useLiveTableRefresh('job_posting_settings', load);
  return <div className="min-h-screen bg-background text-foreground public-introduction">
    <SEO title="Post a Job — Hire Faster" description="Post a job on Workly India and reach thousands of candidates. Describe the role, set salary and start receiving applications." canonical="/post-job" />
    <PublicIntroductionHeader loginTo={loginTo} />
    <main>
      <PublicIntroductionHero image={postJobPhoto} imageAlt="Hiring manager writing a job posting on a laptop" eyebrow="HIRE THE RIGHT PEOPLE" title="Post a Job" subtitle="Reach thousands of job seekers across India." description="Create a clear job post in minutes and start receiving applications from candidates who match your role.">
        <Button asChild size="lg" className="flex-1 gap-2 whitespace-nowrap px-2 sm:flex-none sm:px-8"><Link to={loginTo}>Post a job <ArrowRight className="h-4 w-4" /></Link></Button>
        <Button asChild size="lg" variant="outline" className="public-photo-secondary flex-1 whitespace-nowrap px-2 sm:flex-none sm:px-8"><Link to="/jobs">See live jobs</Link></Button>
      </PublicIntroductionHero>
      {packages.length > 0 && <section className="border-t border-border bg-muted/30"><div className="mx-auto max-w-5xl px-4 py-9 sm:py-12">
        <p className="text-sm font-medium text-primary">SIMPLE PRICING</p><h2 className="mt-2 text-2xl font-bold">Job posting plans for every need</h2>
        <p className="mt-2 text-muted-foreground">Pick how long your job stays live. Prices update automatically — what you see here is what you pay.</p>
        <div className="mt-6 grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">{packages.map((pkg) => <Card key={pkg.months} className={`rounded-lg p-4 text-center ${pkg.is_default ? 'border-primary ring-1 ring-primary' : ''}`}>
          {pkg.is_default && <p className="text-xs font-semibold text-primary">MOST POPULAR</p>}
          <p className="mt-1 text-2xl font-bold">₹{packagePrice(pkg).toLocaleString('en-IN')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{pkg.months} {pkg.months === 1 ? 'month' : 'months'} live</p>
        </Card>)}</div>
      </div></section>}
      <section className="mx-auto max-w-5xl px-4 py-9 sm:py-12">
        <p className="text-sm font-medium text-primary">HOW IT WORKS</p><h2 className="mt-2 text-2xl font-bold">A great job post in four simple steps</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">{steps.map(({ icon: Icon, title, text }) => <Card key={title} className="rounded-lg p-5"><Icon className="h-6 w-6 text-primary" /><h3 className="mt-4 text-lg font-semibold">{title}</h3><p className="mt-2 text-base leading-7 text-muted-foreground">{text}</p></Card>)}</div>
      </section>
      <section className="border-t border-border bg-muted/30"><div className="mx-auto max-w-5xl px-4 py-10">
        <h2 className="text-2xl font-bold">Why employers post with Workly</h2>
        <div className="mt-7 grid gap-7 sm:grid-cols-3">{[
          ['01', 'Candidates who match', 'Your job is shown to seekers whose skills, location and preferences fit the role you describe.'],
          ['02', 'Everything in one place', 'Applications, candidate profiles and interview planning stay together in your company workspace.'],
          ['03', 'Hire at your pace', 'Edit, pause or close your job anytime. You stay in control of every opening you publish.'],
        ].map(([number, title, text]) => <div key={number}><p className="text-sm font-bold text-primary">{number}</p><h3 className="mt-2 text-lg font-semibold">{title}</h3><p className="mt-2 leading-7 text-muted-foreground">{text}</p></div>)}</div>
      </div></section>
      <section id="questions" className="border-t border-border bg-muted/30"><div className="mx-auto max-w-5xl px-4 py-10">
        <h2 className="text-2xl font-bold">Frequently asked questions</h2><div className="mt-6 grid gap-8 sm:grid-cols-2">
          <div><h3 className="font-semibold">Who can post a job?</h3><p className="mt-2 leading-7 text-muted-foreground">Any company with a Workly Employee account. Log in, complete your company profile and publish your first opening.</p></div>
          <div><h3 className="font-semibold">What should a good job post include?</h3><p className="mt-2 leading-7 text-muted-foreground">A clear title, honest salary range, location or remote option, required skills and what the candidate will do day to day.</p></div>
          <div><h3 className="font-semibold">How do candidates apply?</h3><p className="mt-2 leading-7 text-muted-foreground">Job seekers apply directly from the Jobs page. You receive their applications and profiles in your workspace.</p></div>
          <div><h3 className="font-semibold">Looking for a job instead?</h3><p className="mt-2 leading-7 text-muted-foreground">This page is for companies hiring. To find your next role, visit the <Link to="/jobs" className="font-medium text-primary underline">Jobs page</Link>.</p></div>
        </div><Button asChild className="mt-7 w-full sm:w-auto" size="lg"><Link to={loginTo}>Log in to post your job</Link></Button>
      </div></section>
      <section aria-label="Workly India overview video" className="border-t border-border"><div className="mx-auto max-w-5xl px-4 py-10">
        <h2 className="text-center text-2xl font-bold">See Workly India in action</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">A quick look at how hiring and job search work on the platform.</p>
        <div className="mx-auto mt-6 max-w-3xl overflow-hidden rounded-2xl border border-border bg-card p-2 shadow-sm sm:p-3">
          <video
            src="https://pub-58e90721f9fe42b38ecde13543c608fc.r2.dev/workly-india-promo-30s-silent.mp4"
            poster={postJobPhoto}
            aria-label="Workly India platform overview"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            controls={false}
            disablePictureInPicture
            controlsList="nodownload nofullscreen noremoteplayback"
            onContextMenu={(e) => e.preventDefault()}
            onPause={(e) => { void e.currentTarget.play().catch(() => {}); }}
            className="aspect-video w-full rounded-xl object-cover"
          />
        </div>
<a href="/watch/workly-india-promo" className="mt-3 block text-center text-sm font-medium text-primary underline-offset-4 hover:underline">Watch full video</a>
      </div></section>
    </main>
  </div>;
}
