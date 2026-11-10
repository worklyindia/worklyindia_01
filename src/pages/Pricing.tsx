import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, BriefcaseBusiness, Rocket, BadgeCheck, Video, Sparkles, Code2, CalendarPlus, Globe, Search, Check, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import SEO from '@/components/SEO';
import { usePublicPricing } from '@/hooks/usePublicPricing';
import { formatPrice, pricingSections, pricingSchema, PRICING_DESCRIPTION, PRICING_TITLE } from '@/lib/publicPricing.mjs';
import { CANONICAL_URL } from '@/config/domainConfig';
import { goBack } from '@/lib/goBack';

const icons = { jobs: BriefcaseBusiness, boost: Rocket, badge: BadgeCheck, interview: Video, ai: Sparkles, developer: Code2, extend: CalendarPlus, domain: Globe, search: Search };
export default function Pricing() {
  const navigate = useNavigate();
  const { data, isPending, isError, isFetching, refetch } = usePublicPricing();
  const sections = pricingSections(data);
  return <div className="min-h-screen bg-background text-foreground">
    <SEO title={PRICING_TITLE} description={PRICING_DESCRIPTION} canonical="/pricing" structured={data ? pricingSchema(sections, `${CANONICAL_URL}/pricing`) : undefined} />
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Button variant="ghost" size="icon" aria-label="Back" title="Back" onClick={() => goBack(navigate, '/more')}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="flex-1 text-lg font-semibold">Website Pricing</h1>
        <Button variant="ghost" size="icon" aria-label="Refresh prices" title="Refresh prices" disabled={isFetching} onClick={() => { void refetch(); }}><RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin motion-reduce:animate-none' : ''}`} /></Button>
      </div>
    </header>
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6">
      {isPending && <div role="status" className="py-12 text-center text-muted-foreground">Loading current prices…</div>}
      {isError && <div role="alert" className="mb-8 border-l-4 border-destructive bg-muted p-4"><p>Current prices could not be loaded. Please try again.</p><Button variant="outline" className="mt-3" onClick={() => { void refetch(); }}>Try again</Button></div>}
      {data && sections.map((section) => {
        const Icon = icons[section.icon as keyof typeof icons] || BriefcaseBusiness;
        return <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-24 border-b border-border py-8 first:pt-0">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div className="flex min-w-0 gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-primary"><Icon className="h-5 w-5" /></div><div className="min-w-0"><h2 id={`${section.id}-title`} className="text-xl font-semibold">{section.name}</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{section.note}</p></div></div>
            <Button variant="ghost" size="icon" asChild><Link to={section.target} aria-label={`Open ${section.name}`} title={`Open ${section.name}`}><ArrowUpRight className="h-5 w-5" /></Link></Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {section.plans.map((plan) => <article key={plan.id} className={`flex min-w-0 flex-col rounded-lg border bg-card p-5 ${plan.recommended ? 'border-primary' : 'border-border'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-base font-semibold break-words">{plan.name}</h3>{plan.recommended && <Badge variant="secondary">Recommended</Badge>}</div>
              <p className="mt-4 break-words text-3xl font-bold tabular-nums">{plan.price !== null ? formatPrice(plan.price) : plan.priceLabel}</p>
              <p className="mt-1 text-xs text-muted-foreground">{plan.unit}</p>
              <ul className="mb-5 mt-5 flex-1 space-y-2.5">{plan.details.map((detail, i) => <li key={`${i}-${detail}`} className="flex gap-2 text-sm leading-5 text-muted-foreground"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span className="min-w-0 break-words">{detail}</span></li>)}</ul>
              <Button variant="outline" className="w-full" asChild><Link to={section.target}>View {section.id === 'domains' ? 'domains' : 'service'}<ArrowUpRight className="ml-2 h-4 w-4" /></Link></Button>
            </article>)}
          </div>
          {!section.plans.length && <p className="py-3 text-sm text-muted-foreground">{section.id === 'domains' ? <Link to="/domains" className="font-medium text-primary underline underline-offset-4">Check current domain registration &amp; renewal prices</Link> : 'No active packages available.'}</p>}
        </section>;
      })}
      <footer className="mt-8 text-sm text-muted-foreground"><p>Billing periods and limits are shown with each plan. Any applicable taxes and the final payable amount are confirmed at checkout.</p><nav aria-label="Pricing support" className="mt-4 flex flex-wrap gap-x-5 gap-y-3"><Link to="/terms-conditions" className="text-primary">Terms &amp; Conditions</Link><Link to="/refund-policy" className="text-primary">Refund &amp; Cancellation</Link><Link to="/contact-us" className="text-primary">Contact Us</Link></nav></footer>
    </main>
  </div>;
}