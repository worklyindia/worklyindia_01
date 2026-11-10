import { Link } from 'react-router-dom';
import { ArrowRight, Briefcase, Users, CalendarDays, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import SEO from '@/components/SEO';
import PublicIntroductionHeader from '@/components/PublicIntroductionHeader';
import PublicIntroductionHero from '@/components/PublicIntroductionHero';
const teamPhoto = 'https://pub-3225b45ecaf943b3b9061cd57d754bf2.r2.dev/employee-introduction.jpg';
const hiringVideo = 'https://pub-58e90721f9fe42b38ecde13543c608fc.r2.dev/workly-india-hiring-solved-30s.mp4';
const loginTo = '/employer-auth?redirect=%2Femployer-portal';
const features = [
  { icon: Briefcase, title: 'Post your jobs', text: 'Publish vacancies with the role, salary, location and required skills so candidates know what to expect.' },
  { icon: Users, title: 'Review applicants', text: 'Review applications and candidate profiles in one place. Shortlist people whose experience fits your opening.' },
  { icon: CalendarDays, title: 'Plan interviews', text: 'Choose an interview date and time with candidates and keep your hiring conversations moving.' },
  { icon: BarChart3, title: 'Track hiring activity', text: 'Follow job views, applications and hiring activity to understand how your openings are performing.' },
];
export default function EmployeeLanding() {
  return <div className="min-h-screen bg-background text-foreground public-introduction">
    <SEO title="Employee — Company Hiring" description="Post company jobs, review applicants and manage interviews with Workly India." canonical="/employer-portal" />
    <PublicIntroductionHeader loginTo={loginTo} />
    <main>
      <PublicIntroductionHero image={teamPhoto} imageAlt="Hiring manager working with their office team" eyebrow="COMPANY & HIRING" title="Workly Employee" subtitle="Find the right people for your company." description="Bring job posts, candidate applications and interviews together. Spend less time switching tasks and more time building your team.">
        <Button asChild size="lg" className="flex-1 gap-2 whitespace-nowrap px-2 sm:flex-none sm:px-8"><Link to={loginTo}>Start hiring <ArrowRight className="h-4 w-4" /></Link></Button>
        <Button asChild size="lg" variant="outline" className="public-photo-secondary flex-1 whitespace-nowrap px-2 sm:flex-none sm:px-8"><Link to="/jobs">Browse jobs</Link></Button>
      </PublicIntroductionHero>
      <section className="mx-auto max-w-5xl px-4 py-9 sm:py-12">
        <p className="text-sm font-medium text-primary">YOUR HIRING WORKSPACE</p><h2 className="mt-2 text-2xl font-bold">From an open role to your next teammate</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">{features.map(({ icon: Icon, title, text }) => <Card key={title} className="rounded-lg p-5"><Icon className="h-6 w-6 text-primary" /><h3 className="mt-4 text-lg font-semibold">{title}</h3><p className="mt-2 text-base leading-7 text-muted-foreground">{text}</p></Card>)}</div>
      </section>
      {/* Hiring overview video */}
      <section aria-label="How Workly India solves hiring" className="border-t border-border"><div className="mx-auto max-w-5xl px-4 py-9 sm:py-12">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold">See how Workly India finds your candidates</h2>
          <p className="mt-3 text-muted-foreground">A quick look at how one job post brings the right applicants to you.</p>
        </div>
        <div className="mx-auto mt-6 max-w-3xl overflow-hidden rounded-2xl border border-border bg-card p-2 shadow-sm sm:p-3">
          <video
            src={hiringVideo}
            poster={teamPhoto}
            aria-label="Workly India company hiring overview"
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
<a href="/watch/hiring-solved" className="mt-3 block text-center text-sm font-medium text-primary underline-offset-4 hover:underline">Watch full video</a>
      </div></section>
      <section className="border-t border-border bg-muted/30"><div className="mx-auto max-w-5xl px-4 py-10">
        <h2 className="text-2xl font-bold">A clear path to your next hire</h2>
        <div className="mt-7 grid gap-7 sm:grid-cols-3">{[
          ['01', 'Set up your company', 'Log in and complete your company profile so applicants can learn who they will be working with.'],
          ['02', 'Describe the opportunity', 'Add the role, skills and job details. Give candidates a clear picture of the position.'],
          ['03', 'Move candidates forward', 'Review applications, build a shortlist and arrange interviews from your company workspace.'],
        ].map(([number, title, text]) => <div key={number}><p className="text-sm font-bold text-primary">{number}</p><h3 className="mt-2 text-lg font-semibold">{title}</h3><p className="mt-2 leading-7 text-muted-foreground">{text}</p></div>)}</div>
      </div></section>
      <section id="questions" className="border-t border-border bg-muted/30"><div className="mx-auto max-w-5xl px-4 py-10">
        <h2 className="text-2xl font-bold">Frequently asked questions</h2><div className="mt-6 grid gap-8 sm:grid-cols-2">
          <div><h3 className="font-semibold">Is this page for finding a job?</h3><p className="mt-2 leading-7 text-muted-foreground">Workly Employee is for companies managing recruitment. To find your next role, visit the <Link to="/jobs" className="font-medium text-primary underline">Jobs page</Link>.</p></div>
          <div><h3 className="font-semibold">When do I need to log in?</h3><p className="mt-2 leading-7 text-muted-foreground">Log in to post jobs and view your company’s applicants. Complete your company details before starting your hiring activity.</p></div>
        </div><Button asChild className="mt-7 w-full sm:w-auto" size="lg"><Link to={loginTo}>Log in to your company account</Link></Button>
      </div></section>
    </main>
  </div>;
}
