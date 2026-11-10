import React, { useEffect, useMemo, useRef, useState } from 'react';
import { goBack } from "@/lib/goBack";
import { useNavigate, useParams, useNavigationType } from 'react-router-dom';
import { markSetupComplete, isSetupComplete, clearSetupComplete } from '@/utils/setupCompletion';
import StepHeader from '@/components/resume-create/StepHeader';
import StepNav from '@/components/resume-create/StepNav';
import { useCoverLetterDraft } from '@/hooks/useCoverLetterDraft';
import { useToast } from '@/hooks/use-toast';
import { useProfileResumeData, profileToResumePieces } from '@/hooks/useProfileResumeData';
import { Button } from '@/components/ui/button';
import {
  User, Building2, Briefcase, MessageSquare, FileText, GraduationCap,
  Sparkles, Heart, CheckCircle2, PenTool, ArrowLeft, Loader2, ImageIcon,
} from 'lucide-react';
import {
  CLStep1Personal, CLStep2Employer, CLStep3Job, CLStep4Opening, CLStep5Intro,
  CLStep6Experience, CLStep7Skills, CLStep8WhyCompany, CLStep9Closing, CLStep10Signature,
  CLStep11Template,
} from '@/components/cover-letter-create/Steps';
import AIDocumentImageStep from '@/components/AIDocumentImageStep';
import DownloadChoiceSheet from '@/components/download/DownloadChoiceSheet';
import FormatSheet from '@/components/download/FormatSheet';
import { buildCoverLetterText } from '@/components/cover-letter-create/buildCoverLetter';
import { Download as DownloadIcon, Eye, ArrowLeft as ArrowLeftIcon } from 'lucide-react';
import { CoverLetterRender } from '@/components/cover-letter-create/CoverLetterTemplates';
import { ScaledA4Preview } from '@/components/resume-create/ScaledA4Preview';
import { Dialog, DialogContent } from '@/components/ui/dialog';

const STEPS = [
  { icon: User, title: 'Personal Information', desc: 'Your contact details', optional: false, Comp: CLStep1Personal },
  { icon: Building2, title: 'Employer Details', desc: 'Company you are applying to', optional: false, Comp: CLStep2Employer },
  { icon: Briefcase, title: 'Job Details', desc: 'Position you are targeting', optional: false, Comp: CLStep3Job },
  { icon: MessageSquare, title: 'Opening', desc: 'How you greet the reader', optional: false, Comp: CLStep4Opening },
  { icon: FileText, title: 'Introduction', desc: 'Why you are applying', optional: false, Comp: CLStep5Intro },
  { icon: GraduationCap, title: 'Experience', desc: 'Your relevant background', optional: true, Comp: CLStep6Experience },
  { icon: Sparkles, title: 'Skills', desc: 'Key skills and achievements', optional: true, Comp: CLStep7Skills },
  { icon: Heart, title: 'Why This Company?', desc: 'What draws you to them', optional: false, Comp: CLStep8WhyCompany },
  { icon: CheckCircle2, title: 'Closing', desc: 'Availability & thank you', optional: false, Comp: CLStep9Closing },
  { icon: PenTool, title: 'Signature', desc: 'Sign off your letter', optional: false, Comp: CLStep10Signature },
  { icon: FileText, title: 'Choose a Template', desc: 'Pick a design for your letter', optional: false, Comp: CLStep11Template },
  { icon: ImageIcon, title: 'AI Cover Letter', desc: 'AI is designing your letter', optional: false, Comp: null as any },
];

const TOTAL = STEPS.length;
const AI_STEP = TOTAL; // 12


const CoverLetterCreate = () => {
  const navigate = useNavigate();
  const { step: urlStep } = useParams();
  const { toast } = useToast();
  const { draft, update, setDraft, reset } = useCoverLetterDraft();
  const { data: profileData } = useProfileResumeData();
  const [busy, setBusy] = useState<string | null>(null);

  // Pre-fill from the saved job seeker profile (read-only — nothing is written back).
  useEffect(() => {
    if (!profileData) return;
    const pre = profileToResumePieces(profileData);
    const latestExp = pre.experiences[0];
    setDraft((prev) => {
      const p = prev.personal;
      const next = { ...prev };
      if (!p.fullName && !p.email && !p.mobile) {
        next.personal = {
          fullName: pre.personal.fullName || p.fullName,
          mobile: pre.personal.mobile || p.mobile,
          email: pre.personal.email || p.email,
          location: pre.personal.location || p.location,
          linkedin: pre.personal.linkedin || p.linkedin,
          portfolio: pre.personal.portfolio || p.portfolio,
        };
      }
      if (!prev.signature.typedName && pre.personal.fullName) {
        next.signature = { ...prev.signature, typedName: pre.personal.fullName };
      }
      if (!prev.experience.currentTitle && !prev.experience.currentCompany) {
        next.experience = {
          ...prev.experience,
          currentTitle: pre.personal.professionalTitle || latestExp?.jobTitle || '',
          currentCompany: latestExp?.company || '',
          years: prev.experience.years || (profileData.profile?.experience_years != null ? String(profileData.profile.experience_years) : ''),
          relevant: prev.experience.relevant || latestExp?.responsibilities || pre.summary || '',
        };
      }
      if (!prev.skills.skills.length && pre.skills.length) {
        next.skills = { ...prev.skills, skills: pre.skills.map((s) => s.name) };
      }
      if (!prev.skills.certifications && pre.certifications.length) {
        next.skills = {
          ...next.skills,
          certifications: pre.certifications
            .map((c) => [c.name, c.organization].filter(Boolean).join(' — '))
            .join(', '),
        };
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileData]);

  const currentStep = Math.min(Math.max(parseInt(urlStep || '1', 10) || 1, 1), TOTAL);

  // Once the cover letter was finished, browser-back must not re-enter the builder steps.
  const navigationType = useNavigationType();
  useEffect(() => {
    if (!isSetupComplete('cover')) return;
    if (navigationType === 'POP') {
      navigate('/', { replace: true });
    } else {
      clearSetupComplete('cover');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigationType, currentStep]);

  const stepIdx = currentStep - 1;
  const stepMeta = STEPS[stepIdx];
  const StepComp = stepMeta.Comp;

  const goto = (s: number) => navigate(`/cover-letter-builder/create/${s}`);
  const handlePrev = () => currentStep > 1 && goto(currentStep - 1);

  const filename = () => `${(draft.personal.fullName || 'cover-letter').replace(/\s+/g, '_')}_cover_letter`;

  const isAIStep = currentStep === AI_STEP;

  const validateStep = (step: number): string | null => {
    switch (step) {
      case 1: {
        const p = draft.personal;
        if (!p.fullName.trim()) return 'Full name is required';
        if (!p.mobile.trim()) return 'Mobile number is required';
        if (!p.email.trim()) return 'Email is required';
        return null;
      }
      case 2:
        if (!draft.employer.companyName.trim()) return 'Company name is required';
        return null;
      case 3:
        if (!draft.job.title.trim()) return 'Job title is required';
        return null;
      case 4:
        if (!draft.opening.greeting) return 'Please choose a greeting';
        if (draft.opening.greeting === 'Custom' && !draft.opening.customGreeting.trim()) return 'Enter your custom greeting';
        return null;
      case 5:
        if (!draft.introduction.whyApplying.trim()) return 'Please tell why you are applying';
        return null;
      case 8:
        if (!draft.whyCompany.trim()) return 'Please tell why you want to join this company';
        return null;
      case 9:
        if (!draft.closing.thankYou.trim()) return 'A closing thank-you line is required';
        return null;
      case 10:
        if (!draft.signature.typedName.trim()) return 'Typed name is required';
        return null;
      case 11:
        if (!draft.template) return 'Please choose a template first';
        return null;
      default:
        return null;
    }
  };

  const handleNext = () => {
    if (currentStep < TOTAL) {
      const err = validateStep(currentStep);
      if (err) {
        toast({ variant: 'destructive', title: 'Missing details', description: err });
        return;
      }
      goto(currentStep + 1);
    }
  };

  const percent = useMemo(() => Math.round((currentStep / TOTAL) * 100), [currentStep]);

  const [finalFormatOpen, setFinalFormatOpen] = useState(false);
  const finalTemplate = draft.template || 'Professional';
  const finalPlainText = useMemo(() => buildCoverLetterText(draft), [draft]);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <header className="shrink-0 border-b bg-background/95 backdrop-blur px-3 sm:px-4 pt-3 pb-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => goBack(navigate, '/resume-builder')} className="rounded-full -ml-2" aria-label="Back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            {isAIStep ? (
              <div className="flex-1 min-w-0">
                <div className="text-sm sm:text-base font-semibold leading-tight truncate">
                  Your Cover Letter is ready 🎉
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-muted-foreground leading-tight">Step {currentStep} of {TOTAL}</div>
                  <div className="text-sm font-semibold leading-tight truncate">Cover Letter Builder</div>
                </div>
                <div className="text-xs font-semibold text-primary">{percent}%</div>
              </>
            )}
          </div>
          {!isAIStep && (
            <div className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-300" style={{ width: `${percent}%` }} />
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-3 sm:px-4 py-4">
        <div className="max-w-2xl mx-auto pb-4">
          <div key={currentStep} className="animate-in fade-in slide-in-from-right-2 duration-200">
            {!isAIStep && (
              <StepHeader icon={stepMeta.icon} title={stepMeta.title} description={stepMeta.desc} optional={stepMeta.optional} />
            )}
            {isAIStep ? (
              <FinalDownloadStep draft={draft} filename={filename()} />
            ) : (
              StepComp && <StepComp draft={draft} update={update} />
            )}
          </div>
        </div>
      </main>

      <footer className="shrink-0 border-t bg-background/95 backdrop-blur px-3 sm:px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="max-w-2xl mx-auto">
          {isAIStep ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handlePrev}
                className="rounded-xl flex-1"
              >
                <ArrowLeftIcon className="w-4 h-4 sm:mr-1" />
                <span>Previous</span>
              </Button>
              <Button
                type="button"
                onClick={() => setFinalFormatOpen(true)}
                className="rounded-xl flex-1"
              >
                <DownloadIcon className="w-4 h-4 mr-2" />
                Download Letter
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  markSetupComplete('cover');
                  reset();
                  navigate('/resume-builder', { replace: true });
                }}
                className="rounded-xl"
              >
                Done
              </Button>
            </div>
          ) : (
            <StepNav
              onPrev={handlePrev}
              onNext={handleNext}
              isFirst={currentStep === 1}
              isLast={false}
              optional={stepMeta.optional}
              nextLabel={currentStep === AI_STEP - 1 ? 'Finish' : undefined}
              disabled={!!busy}
            />
          )}
        </div>
      </footer>

      {isAIStep && (
        <FormatSheet
          open={finalFormatOpen}
          onOpenChange={setFinalFormatOpen}
          kind="cover_letter"
          template={finalTemplate}
          data={{ ...draft, bodyText: finalPlainText }}
          filename={filename()}
          plainText={finalPlainText}
          docLabel="Cover Letter"
        />
      )}
    </div>
  );
};

const FinalDownloadStep: React.FC<{ draft: ReturnType<typeof useCoverLetterDraft>['draft']; filename: string }> = ({ draft }) => {
  const [viewOpen, setViewOpen] = useState(false);
  const template = draft.template || 'Professional';

  return (
    <div className="space-y-4">
      <div className="p-2 rounded-xl border-2 border-primary bg-primary/5 shadow-md">
        <div className="pointer-events-none">
          <ScaledA4Preview fit="contain">
            <CoverLetterRender draft={draft} template={template} />
          </ScaledA4Preview>
        </div>
        <Button
          variant="outline"
          className="mt-3 w-full rounded-lg h-11"
          onClick={() => setViewOpen(true)}
        >
          <Eye className="w-4 h-4 mr-2" /> View Cover Letter
        </Button>
      </div>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-[96vw] sm:max-w-3xl max-h-[95vh] overflow-y-auto p-2 sm:p-4 [&>button]:hidden">
          <ScaledA4Preview fit="contain">
            <CoverLetterRender draft={draft} template={template} />
          </ScaledA4Preview>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CoverLetterCreate;
