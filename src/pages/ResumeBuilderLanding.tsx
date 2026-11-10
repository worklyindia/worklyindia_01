import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, ChevronDown, Download, FileText, Link2, Share2 } from "lucide-react";
import resumeIntro from "../assets/owner-resume-introduction.jpg.asset.json";
import PublicIntroductionHeader from "../components/PublicIntroductionHeader";
import PublicIntroductionHero from "../components/PublicIntroductionHero";
import SEO from "../components/SEO";
import { Button } from "../components/ui/button";
import HomeResumePreviewStrip from "../components/HomeResumePreviewStrip";
import { ROUTE_SEO } from '@/lib/routeSeo';
import PublicCareerContent from '@/components/PublicCareerContent';

const LOGIN = "/auth?redirect=%2Fresume-builder";
const SIGNUP = `${LOGIN}&mode=signup`;

/** Same ten sections the builder actually walks through, in the same order. */
const STEPS = [
  ["Personal", "Name, contact, location and links."],
  ["Summary", "A short line about the role you want."],
  ["Experience", "Companies, roles, dates and achievements."],
  ["Education", "Degrees, colleges and marks."],
  ["Skills", "Your tools, languages and strengths."],
  ["Certifications", "Courses and credentials."],
  ["Projects", "Work you built, with links."],
  ["Languages", "Languages you speak and the level."],
  ["Achievements", "Awards, ranks and recognitions."],
  ["Internships", "Training and internship stints."],
] as const;

const INCLUDED = [
  [FileText, "Ten resume designs", "Switch template at any time — your content carries over."],
  [Download, "PDF and DOCX download", "Take your resume in the format the employer asks for."],
  [Share2, "Cover letter designs", "Ten matching cover letter layouts, built the same way."],
  [Link2, "Shareable link", "Send one link instead of attaching a file."],
] as const;

const FAQS = [
  [
    "Does it cost anything?",
    "No. The resume and cover letter builder is free for job seekers — make as many versions as you need.",
  ],
  [
    "Will it pass ATS screening?",
    "The ATS Simple template is built for plain, machine-readable formatting. Other designs stay text-based, so the words can still be read by screening tools.",
  ],
  [
    "Can I change the template after filling the details?",
    "Yes. Your content is separate from the design, so switching a template keeps everything you typed.",
  ],
  [
    "What formats can I download?",
    "PDF and DOCX. PDF is best for portals, DOCX if the employer wants to edit it.",
  ],
  [
    "Do I need to upload my old resume?",
    "No. You type or paste your details into the steps. Nothing is scraped from a file.",
  ],
  [
    "Can I keep more than one resume?",
    "Yes. Save a separate version for each kind of role you apply for, and download the one that fits.",
  ],
];

function Faq({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border/70 bg-card">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-sm font-bold sm:text-base">{question}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <p className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground">{answer}</p>
      ) : null}
    </div>
  );
}

export default function ResumeBuilderLanding() {
  return (
    <div className="public-introduction min-h-screen bg-background">
      <SEO
        title={ROUTE_SEO['/resume-builder'].title}
        description={ROUTE_SEO['/resume-builder'].description}
        keywords={ROUTE_SEO['/resume-builder'].keywords}
        canonical="/resume-builder"
      />
      <PublicIntroductionHeader loginTo={LOGIN} />

      <PublicIntroductionHero
        image={resumeIntro.url}
        imageFallback="https://pub-3225b45ecaf943b3b9061cd57d754bf2.r2.dev/resume-introduction.jpg"
        imageAlt="A job seeker checking a printed resume at a desk with a laptop"
        eyebrow="FREE FOR JOB SEEKERS"
        title="Resume & cover letter builder"
        subtitle="Ten guided steps, ten templates, PDF and DOCX download — no design skill needed."
        description="Fill in your details once, switch designs whenever you like, and download a file that stays clean in front of a person and a screening system."
      >
        <Button asChild className="h-11 flex-1 px-6 text-sm font-bold whitespace-nowrap sm:flex-none">
          <Link to={SIGNUP}>
            Create your resume <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-11 flex-1 border-white/60 bg-white/10 text-white hover:bg-white/20 whitespace-nowrap sm:flex-none">
          <a href="#resume-templates">See the templates</a>
        </Button>
      </PublicIntroductionHero>

      <main className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
        <section id="how-it-works" className="mb-14">
          <p className="text-xs font-black tracking-[0.18em] text-primary">HOW IT WORKS</p>
          <h2 className="mt-2 text-2xl font-black sm:text-3xl">Ten steps, one complete resume.</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Each step asks for one thing at a time, so nothing gets missed. You can come back and edit any
            step later — the preview updates as you type.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {STEPS.map(([title, description], index) => (
              <div
                key={title}
                className="flex items-start gap-3 rounded-xl border border-border/70 bg-card p-4"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-black text-primary">
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-bold text-foreground">{title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div id="resume-templates" className="mb-14 scroll-mt-6">
          <HomeResumePreviewStrip layout="vertical" />
        </div>

        <section id="included" className="mb-14">
          <p className="text-xs font-black tracking-[0.18em] text-primary">WHAT YOU GET</p>
          <h2 className="mt-2 text-2xl font-black sm:text-3xl">Everything you need to apply.</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {INCLUDED.map(([Icon, title, description]) => (
              <div key={title} className="flex items-start gap-3 rounded-xl border border-border/70 bg-card p-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-bold text-foreground">{title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
                </div>
              </div>
            ))}
          </div>
          <ul className="mt-5 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            {[
              "No design skill needed",
              "Edit any step later",
              "One link instead of a file",
              "Keep a version per role",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-primary" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section id="questions" className="mb-14 scroll-mt-24">
          <p className="text-xs font-black tracking-[0.18em] text-primary">QUESTIONS</p>
          <h2 className="mt-2 text-2xl font-black sm:text-3xl">Before you start.</h2>
          <div className="mt-6 space-y-3">
            {FAQS.map(([question, answer]) => (
              <Faq key={question} question={question} answer={answer} />
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border/70 bg-primary/5 p-6 text-center sm:p-8">
          <h2 className="text-xl font-black sm:text-2xl">Your resume takes about fifteen minutes.</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Sign up free, fill the ten steps, and download a resume you can send today.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild className="h-11 whitespace-nowrap px-6 text-sm font-bold">
              <Link to={SIGNUP}>
                Create your resume <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-11 whitespace-nowrap px-6 text-sm font-bold">
              <Link to={LOGIN}>Sign in</Link>
            </Button>
          </div>
        </section>
        <PublicCareerContent page="/resume-builder" />
      </main>
    </div>
  );
}
