import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BRAND_CONFIG } from '@/config/brandConfig';
import { goBack } from '@/lib/goBack';
export default function PublicIntroductionHeader({ loginTo }: { loginTo: string }) {
  const navigate = useNavigate();
  return <header className="border-b border-border bg-background"><div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3"><div className="flex min-w-0 items-center gap-1"><Button variant="ghost" size="icon" aria-label="Back" onClick={() => goBack(navigate)} className="shrink-0"><ArrowLeft className="h-5 w-5" /></Button><Link to="/" className="text-base font-bold text-foreground sm:text-xl">{BRAND_CONFIG.name}</Link></div><div className="flex shrink-0 items-center gap-1"><Button asChild size="sm" variant="ghost"><a href="#questions">FAQ</a></Button><Button asChild size="sm" className="gap-2"><Link to={loginTo}><LogIn className="h-4 w-4" />Log in</Link></Button></div></div></header>;
}
