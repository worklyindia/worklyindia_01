import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Gift, Share2, Trophy, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import SEO from '@/components/SEO';
import PublicIntroductionHeader from '@/components/PublicIntroductionHeader';
import PublicIntroductionHero from '@/components/PublicIntroductionHero';
import { supabase } from '@/integrations/supabase/client';
import { useLiveTableRefresh } from '@/hooks/useLiveTableRefresh';
import referPhoto from '@/assets/refer-introduction.jpg';
const referVideo = 'https://pub-58e90721f9fe42b38ecde13543c608fc.r2.dev/workly-india-refer-earn-30s_v2.mp4';
const loginTo = '/auth?redirect=%2Freferral';
interface ReferralCommission { commission_percentage: number; minimum_commission_amount: number; maximum_commission_amount: number; commission_calculation_method: string }
const features = [
  { icon: Share2, title: 'Share your code', text: 'Get your personal referral code and share it with friends, family and colleagues on WhatsApp or social media.' },
  { icon: Gift, title: 'Earn on every referral', text: 'When someone joins with your code and completes the steps, your reward is credited to your referral wallet.' },
  { icon: Wallet, title: 'Track your earnings', text: 'See every referral, pending reward and payout in one clear activity list — nothing hidden.' },
  { icon: Trophy, title: 'Win monthly competitions', text: 'Top referrers each month win extra bonuses and recognition on the platform.' },
];
export default function ReferralLanding() {
  const [commission, setCommission] = useState<ReferralCommission | null>(null);
  const load = () => {
    supabase
      .from('referral_settings')
      .select('commission_percentage, minimum_commission_amount, maximum_commission_amount, commission_calculation_method')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { setCommission((data as ReferralCommission) ?? null); });
  };
  useEffect(load, []);
  useLiveTableRefresh('referral_settings', load);
  return <div className="min-h-screen bg-background text-foreground public-introduction">
    <SEO title="Refer & Earn — Workly India" description="Invite friends to Workly India with your referral code and earn rewards for every successful referral. Track earnings and win monthly competitions." canonical="/referral" />
    <PublicIntroductionHeader loginTo={loginTo} />
    <main>
      <PublicIntroductionHero image={referPhoto} imageAlt="Two friends sharing a referral code on a phone" eyebrow="REFER & EARN" title="Refer your friends" subtitle="Earn rewards for every friend who joins." description="Share your personal referral code, help people you know find work, and get rewarded when they get started.">
        <Button asChild size="lg" className="flex-1 gap-2 whitespace-nowrap px-2 sm:flex-none sm:px-8"><Link to={loginTo}>Start referring <ArrowRight className="h-4 w-4" /></Link></Button>
        <Button asChild size="lg" variant="outline" className="public-photo-secondary flex-1 whitespace-nowrap px-2 sm:flex-none sm:px-8"><a href="#how-referral-works">How it works</a></Button>
      </PublicIntroductionHero>
      {commission && <section className="border-t border-border bg-muted/30"><div className="mx-auto max-w-5xl px-4 py-9 sm:py-12">
        <p className="text-sm font-medium text-primary">YOUR COMMISSION</p><h2 className="mt-2 text-2xl font-bold">Earn {commission.commission_calculation_method === 'percentage' ? `${commission.commission_percentage}% commission` : `₹${commission.maximum_commission_amount.toLocaleString('en-IN')} per referral`} on every successful referral</h2>
        <p className="mt-2 text-muted-foreground">Commission is credited to your referral wallet when your friend completes the required steps.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Card className="rounded-lg p-5 text-center"><p className="text-2xl font-bold text-primary">{commission.commission_calculation_method === 'percentage' ? `${commission.commission_percentage}%` : `₹${commission.maximum_commission_amount.toLocaleString('en-IN')}`}</p><p className="mt-1 text-sm text-muted-foreground">Commission rate</p></Card>
          <Card className="rounded-lg p-5 text-center"><p className="text-2xl font-bold">₹{commission.minimum_commission_amount.toLocaleString('en-IN')}</p><p className="mt-1 text-sm text-muted-foreground">Minimum per referral</p></Card>
          <Card className="rounded-lg p-5 text-center"><p className="text-2xl font-bold">₹{commission.maximum_commission_amount.toLocaleString('en-IN')}</p><p className="mt-1 text-sm text-muted-foreground">Maximum per referral</p></Card>
        </div>
      </div></section>}
      <section id="how-referral-works" className="mx-auto max-w-5xl px-4 py-9 sm:py-12">
        <p className="text-sm font-medium text-primary">YOUR REFERRAL WALLET</p><h2 className="mt-2 text-2xl font-bold">Everything you need to earn by referring</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">{features.map(({ icon: Icon, title, text }) => <Card key={title} className="rounded-lg p-5"><Icon className="h-6 w-6 text-primary" /><h3 className="mt-4 text-lg font-semibold">{title}</h3><p className="mt-2 text-base leading-7 text-muted-foreground">{text}</p></Card>)}</div>
      </section>
      <section className="border-t border-border bg-muted/30"><div className="mx-auto max-w-5xl px-4 py-10">
        <h2 className="text-2xl font-bold">Three steps to your first reward</h2>
        <div className="mt-7 grid gap-7 sm:grid-cols-3">{[
          ['01', 'Create your referral profile', 'Log in and add your name, photo and payout details so your rewards reach the right account.'],
          ['02', 'Share your unique code', 'Send your referral code or link to friends through WhatsApp, SMS or any social app.'],
          ['03', 'Get rewarded', 'When your friend joins and completes the required steps, the reward appears in your wallet.'],
        ].map(([number, title, text]) => <div key={number}><p className="text-sm font-bold text-primary">{number}</p><h3 className="mt-2 text-lg font-semibold">{title}</h3><p className="mt-2 leading-7 text-muted-foreground">{text}</p></div>)}</div>
      </div></section>
      {/* Refer & Earn video */}
      <section className="border-t border-border"><div className="mx-auto max-w-5xl px-4 py-9 sm:py-12">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold">See how Refer & Earn works</h2>
          <p className="mt-3 text-muted-foreground">A quick look at how sharing your code turns into real earnings.</p>
        </div>
        <div className="mx-auto mt-6 max-w-3xl overflow-hidden rounded-2xl border border-border bg-card p-2 shadow-sm sm:p-3">
          <video
            src={referVideo}
            poster={referPhoto}
            aria-label="How Refer and Earn works on Workly India"
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
      </div></section>
      <section id="questions" className="border-t border-border bg-muted/30"><div className="mx-auto max-w-5xl px-4 py-10">
        <h2 className="text-2xl font-bold">Frequently asked questions</h2><div className="mt-6 grid gap-8 sm:grid-cols-2">
          <div><h3 className="font-semibold">Who can I refer?</h3><p className="mt-2 leading-7 text-muted-foreground">Anyone who is new to Workly India — job seekers and employers both count when they join with your code.</p></div>
          <div><h3 className="font-semibold">When do I receive my reward?</h3><p className="mt-2 leading-7 text-muted-foreground">Rewards are credited once your referred friend completes the required steps. You can follow each referral in your activity list.</p></div>
          <div><h3 className="font-semibold">How do I withdraw my earnings?</h3><p className="mt-2 leading-7 text-muted-foreground">Add your payout details in payment settings and withdraw your wallet balance to your bank account.</p></div>
          <div><h3 className="font-semibold">Is there a limit on referrals?</h3><p className="mt-2 leading-7 text-muted-foreground">No limit — the more friends you refer, the more you earn. Top referrers also win monthly competition bonuses.</p></div>
        </div><Button asChild className="mt-7 w-full sm:w-auto" size="lg"><Link to={loginTo}>Log in to get your code</Link></Button>
      </div></section>
    </main>
  </div>;
}
