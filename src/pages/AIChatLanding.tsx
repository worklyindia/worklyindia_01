import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Briefcase, FileText, Languages, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AIChipIcon } from '@/components/icons/AIChipIcon';
import PublicIntroductionHeader from '@/components/PublicIntroductionHeader';
import PublicIntroductionHero from '@/components/PublicIntroductionHero';
import { AIPlanCards, AIPlanNotes } from '@/components/PublicAIPlans';
const aiPhoto = 'https://pub-3225b45ecaf943b3b9061cd57d754bf2.r2.dev/ai-introduction.jpg';
import SEO from '@/components/SEO';
const ideas = [
  { icon: Briefcase, title: 'Career & interviews', example: '“Help me prepare for my first job interview.”', text: 'Practice common questions, explore career options and break your preparation into manageable steps.' },
  { icon: FileText, title: 'Resumes & writing', example: '“Write a professional summary for my resume.”', text: 'Find the right words for a resume, cover letter or email. Share your experience to make the draft more relevant.' },
  { icon: Languages, title: 'Understand & translate', example: '“Explain this email in simple English.”', text: 'Make complex information easier to understand, or ask for a translation into your preferred language.' },
  { icon: MessageCircle, title: 'Questions & ideas', example: '“Turn this topic into a short action plan.”', text: 'Explore ideas, compare options and get a starting point when you are not sure what to write or do next.' },
];
export default function AIChatLanding() {
  const location = useLocation();
  const audience = new URLSearchParams(location.search).get('audience');
  const loginPage = audience === 'employer' || audience === 'developer' ? '/employer-auth' : '/auth';
  const loginTo = `${loginPage}?redirect=${encodeURIComponent(location.pathname + location.search)}`;
  const signupTo = `${loginTo}&mode=signup`;
  return <div className="min-h-screen bg-background text-foreground public-introduction">
    <SEO title="Workly AI Chat" description="Get help with careers, resumes, writing and everyday questions with Workly AI Chat." canonical="/ai-assistant" />
    <PublicIntroductionHeader loginTo={loginTo} />
    <main>
      <PublicIntroductionHero image={aiPhoto} imageAlt="Professional preparing career notes with a laptop" eyebrow="YOUR EVERYDAY AI ASSISTANT" title="Workly AI Chat" subtitle="What would you like help with today?" description="A fresh idea, a clearer answer or the next step in your career. Ask in your own words and keep the conversation simple.">
        <Button asChild size="lg" className="flex-1 gap-2 whitespace-nowrap px-2 sm:flex-none sm:px-8"><Link to={loginTo}>Log in to chat <ArrowRight className="h-4 w-4" /></Link></Button>
        <Button asChild size="lg" variant="outline" className="public-photo-secondary flex-1 whitespace-nowrap px-2 sm:flex-none sm:px-8"><a href="#ai-ideas">Explore ideas</a></Button>
      </PublicIntroductionHero>
      <div className="mx-auto max-w-5xl px-4 py-10">
      <section aria-labelledby="ai-ideas"><h2 id="ai-ideas" className="text-xl font-semibold">A little inspiration to get started</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">{ideas.map(({ icon: Icon, title, example, text }) => <Card key={title} className="rounded-lg p-5"><Icon className="h-5 w-5 text-primary" /><h3 className="mt-3 text-lg font-semibold">{title}</h3><p className="mt-2 text-base leading-7 text-muted-foreground">{text}</p><p className="mt-4 border-l-2 border-primary pl-3 text-base leading-7">{example}</p></Card>)}</div>
      </section>
      <section className="mt-10 border-t border-border pt-8">
        <div className="flex items-center gap-3"><AIChipIcon className="h-8 w-8 shrink-0 text-primary" /><h2 className="text-2xl font-bold">Make room for a better conversation</h2></div>
        <div className="mt-6 grid gap-7 sm:grid-cols-3">{[
          ['Start with your question', 'Tell AI what you want to achieve. A role, topic or short example gives your conversation a useful starting point.'],
          ['Make it your own', 'Ask a follow-up, request a simpler explanation or change the tone of a draft until it fits your needs.'],
          ['Check what matters', 'Treat answers as a starting point. Verify important job, financial and personal decisions with trusted sources.'],
        ].map(([title, text]) => <div key={title}><h3 className="text-lg font-semibold">{title}</h3><p className="mt-2 leading-7 text-muted-foreground">{text}</p></div>)}</div>
      </section>
      <section id="ai-plans" className="mt-10 border-t border-border pt-8" aria-labelledby="ai-plans-title">
        <h2 id="ai-plans-title" className="text-2xl font-bold">AI Chat plans</h2>
        <p className="mt-2 max-w-3xl leading-7 text-muted-foreground">Pick the option that fits how often you want to chat. Prices are in Indian rupees per month, shown here and at checkout.</p>
        <AIPlanCards signupTo={signupTo} />
        <AIPlanNotes />
      </section>
      <section id="questions" className="mt-10 border-t border-border pt-8"><h2 className="text-2xl font-bold">Frequently asked questions</h2>
        <div className="mt-6 grid gap-8 sm:grid-cols-2">
          <div><h3 className="font-semibold">Can I chat without logging in?</h3><p className="mt-2 leading-7 text-muted-foreground">Log in to your Workly account to start a conversation and access your chat and account options.</p></div>
          <div><h3 className="font-semibold">Is every answer accurate?</h3><p className="mt-2 leading-7 text-muted-foreground">AI can make mistakes. Double-check important information before acting on career, money or other significant decisions.</p></div>
          <div><h3 className="font-semibold">Which language can I use?</h3><p className="mt-2 leading-7 text-muted-foreground">You can ask in English, Hindi or your preferred language. Ask for simpler wording whenever you need it.</p></div>
          <div><h3 className="font-semibold">Where can I see the plans?</h3><p className="mt-2 leading-7 text-muted-foreground">The current plans are listed on this page under “AI Chat plans”, above these questions. Each one shows its monthly price and what you get.</p></div>
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-4"><Button asChild size="lg" className="w-full sm:w-auto"><Link to={loginTo}>Open AI Chat</Link></Button></div>
      </section>
      </div>
    </main>
  </div>;
}
