import React, { useEffect, useMemo, useState } from 'react';
import { goBack } from "@/lib/goBack";
import { useNavigate, useParams, useNavigationType } from 'react-router-dom';
import { markSetupComplete, isSetupComplete, clearSetupComplete } from '@/utils/setupCompletion';
import StepHeader from '@/components/resume-create/StepHeader';
import StepNav from '@/components/resume-create/StepNav';
import { useResumeDraft } from '@/hooks/useResumeDraft';
import { useToast } from '@/hooks/use-toast';
import { useProfileResumeData, profileToResumePieces } from '@/hooks/useProfileResumeData';
import { Button } from '@/components/ui/button';
import {
  User, FileText, Briefcase, GraduationCap, Code, BadgeCheck, FolderGit2,
  Languages, Trophy, Heart, Users, Info, Target, Palette, ArrowLeft, ImageIcon,
} from 'lucide-react';
import {
  Step1Personal, Step2Summary, Step3Experience, Step4Education, Step5Skills,
  Step6Certifications, Step7Projects, Step8Languages, Step9Achievements,
  Step10Internships, Step11Hobbies, Step12References, Step13Additional,
  Step14JobPreferences, Step15Template,
} from '@/components/resume-create/Steps';
import AIDocumentImageStep from '@/components/AIDocumentImageStep';
import DownloadChoiceSheet from '@/components/download/DownloadChoiceSheet';
import FormatSheet from '@/components/download/FormatSheet';
import { buildResumeText } from '@/components/resume-create/buildResumeText';
import { draftToResumeData, templateKey } from '@/components/resume-create/draftToResumeData';
import { ScaledA4Preview } from '@/components/resume-create/ScaledA4Preview';
import { RESUME_TEMPLATES } from '@/components/resume/ResumeTemplates';
import { Download as DownloadIcon, Eye, X, ArrowLeft as ArrowLeftIcon } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import ResumeScannerPanel from '@/components/resume-create/ResumeScannerPanel';

const STEPS = [
  { icon: User, title: 'Personal Information', desc: 'Basic contact & profile details', optional: false, Comp: Step1Personal },
  { icon: FileText, title: 'Career Summary', desc: 'A short professional overview (50–200 words)', optional: false, Comp: Step2Summary },
  { icon: Briefcase, title: 'Work Experience', desc: 'Roles you have held', optional: false, Comp: Step3Experience },
  { icon: GraduationCap, title: 'Education', desc: 'Your academic background', optional: false, Comp: Step4Education },
  { icon: Code, title: 'Skills', desc: 'Technical & soft skills with proficiency', optional: false, Comp: Step5Skills },
  { icon: BadgeCheck, title: 'Certifications', desc: 'Courses and credentials', optional: true, Comp: Step6Certifications },
  { icon: FolderGit2, title: 'Projects', desc: 'Showcase what you have built', optional: true, Comp: Step7Projects },
  { icon: Languages, title: 'Languages', desc: 'Languages you speak', optional: false, Comp: Step8Languages },
  { icon: Trophy, title: 'Achievements', desc: 'Awards, competitions & recognition', optional: true, Comp: Step9Achievements },
  { icon: Briefcase, title: 'Internships', desc: 'Any internship experience', optional: true, Comp: Step10Internships },
  { icon: Heart, title: 'Hobbies', desc: 'Interests outside of work', optional: true, Comp: Step11Hobbies },
  { icon: Users, title: 'References', desc: 'People who can vouch for you', optional: true, Comp: Step12References },
  { icon: Info, title: 'Additional Details', desc: 'Personal information (optional)', optional: true, Comp: Step13Additional },
  { icon: Target, title: 'Job Preferences', desc: 'What kind of role you are looking for', optional: false, Comp: Step14JobPreferences },
  { icon: Palette, title: 'Choose Design', desc: 'Pick a resume template to finish', optional: false, Comp: Step15Template },
  { icon: ImageIcon, title: 'AI Resume', desc: 'AI is designing your resume', optional: false, Comp: null as any },
];

const TOTAL = STEPS.length;
const AI_STEP = TOTAL; // 16

const ResumeCreate = () => {
  const navigate = useNavigate();
  const { step: urlStep } = useParams();
  const { toast } = useToast();
  const { draft, update, setDraft, reset } = useResumeDraft();
  const { data: profileData } = useProfileResumeData();
  const [busy, setBusy] = useState<string | null>(null);

  // Pre-fill from the saved job seeker profile so nothing has to be typed twice.
  // This only reads the profile — builder data is never written back to it.
  useEffect(() => {
    if (!profileData) return;
    const pre = profileToResumePieces(profileData);
    setDraft((prev) => {
      const p = prev.personal;
      const next = { ...prev };
      if (!p.fullName && !p.email && !p.mobile) {
        next.personal = {
          ...p,
          fullName: pre.personal.fullName || p.fullName,
          professionalTitle: pre.personal.professionalTitle || p.professionalTitle,
          mobile: pre.personal.mobile || p.mobile,
          email: pre.personal.email || p.email,
          location: pre.personal.location || p.location,
          linkedin: pre.personal.linkedin || p.linkedin,
          portfolio: pre.personal.portfolio || p.portfolio,
          photoUrl: pre.personal.photoUrl || p.photoUrl,
        };
      }
      if (!prev.summary && pre.summary) next.summary = pre.summary;
      if (!prev.experiences.length && pre.experiences.length) next.experiences = pre.experiences;
      if (!prev.education.length && pre.education.length) next.education = pre.education;
      if (!prev.skills.length && pre.skills.length) next.skills = pre.skills;
      if (!prev.languages.length && pre.languages.length) next.languages = pre.languages;
      if (!prev.certifications.length && pre.certifications.length) next.certifications = pre.certifications;
      if (!prev.additional.dob && !prev.additional.gender) {
        next.additional = { ...prev.additional, dob: pre.additional.dob, gender: pre.additional.gender };
      }
      if (!prev.jobPreferences.preferredRole && !prev.jobPreferences.preferredLocation) {
        next.jobPreferences = {
          ...prev.jobPreferences,
          preferredRole: pre.jobPreferences.preferredRole,
          preferredLocation: pre.jobPreferences.preferredLocation,
          employmentTypes: prev.jobPreferences.employmentTypes.length
            ? prev.jobPreferences.employmentTypes
            : pre.jobPreferences.employmentTypes,
        };
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileData]);

  const currentStep = Math.min(Math.max(parseInt(urlStep || '1', 10) || 1, 1), TOTAL);

  // Once the resume was finished, browser-back must not re-enter the builder steps.
  const navigationType = useNavigationType();
  useEffect(() => {
    if (!isSetupComplete('resume')) return;
    if (navigationType === 'POP') {
      navigate('/', { replace: true });
    } else {
      clearSetupComplete('resume');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigationType, currentStep]);
  const stepIdx = currentStep - 1;
  const stepMeta = STEPS[stepIdx];
  const StepComp = stepMeta.Comp;
  const isAIStep = currentStep === AI_STEP;

  const goto = (s: number) => navigate(`/resume-builder/create/${s}`);
  const handlePrev = () => currentStep > 1 && goto(currentStep - 1);

  const validateStep = (step: number): string | null => {
    switch (step) {
      case 1: {
        const p = draft.personal;
        if (!p.fullName.trim()) return 'Full name is required';
        if (!p.professionalTitle.trim()) return 'Professional title is required';
        if (!p.mobile.trim()) return 'Mobile number is required';
        if (!p.email.trim()) return 'Email is required';
        if (!p.location.trim()) return 'Location is required';
        return null;
      }
      case 2:
        if (!draft.summary.trim() || draft.summary.trim().length < 30) return 'Please write a summary (at least 30 characters)';
        return null;
      case 3:
        if (!draft.experiences.length) return 'Add at least one work experience';
        if (draft.experiences.some((e) => !e.company.trim() || !e.jobTitle.trim())) return 'Every experience needs company and job title';
        return null;
      case 4:
        if (!draft.education.length) return 'Add at least one education entry';
        if (draft.education.some((e) => !e.course.trim() || !e.school.trim())) return 'Every education entry needs course and school';
        return null;
      case 5:
        if (!draft.skills.length) return 'Add at least one skill';
        return null;
      case 8:
        if (!draft.languages.length) return 'Add at least one language';
        return null;
      case 14:
        if (!draft.jobPreferences.preferredRole.trim()) return 'Preferred role is required';
        return null;
      case 15:
        if (!draft.template) return 'Please choose a design first';
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

  const filename = () => (draft.personal.fullName || 'resume').replace(/\s+/g, '_');
  const percent = useMemo(() => Math.round((currentStep / TOTAL) * 100), [currentStep]);

  const [finalFormatOpen, setFinalFormatOpen] = useState(false);
  const finalTemplate = draft.template || 'Professional';
  const finalDownloadData = useMemo(() => draftToResumeData(draft), [draft]);
  const finalPlainText = useMemo(() => buildResumeText(draft), [draft]);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <header className="shrink-0 border-b bg-background/95 backdrop-blur px-3 sm:px-4 pt-3 pb-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => goBack(navigate, '/resume-builder')} className="rounded-full -ml-2" aria-label="Back to Resume Builder">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            {isAIStep ? (
              <div className="flex-1 min-w-0">
                <div className="text-sm sm:text-base font-semibold leading-tight truncate">
                  Your resume is ready 🎉
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-muted-foreground leading-tight">Step {currentStep} of {TOTAL}</div>
                  <div className="text-sm font-semibold leading-tight truncate">Resume Builder</div>
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
              <>
                <StepHeader icon={stepMeta.icon} title={stepMeta.title} description={stepMeta.desc} optional={stepMeta.optional} />
                {currentStep === 1 && <ResumeScannerPanel />}
              </>
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
                Download Resume
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  markSetupComplete('resume');
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
          kind="resume"
          template={finalTemplate}
          data={finalDownloadData}
          filename={filename()}
          plainText={finalPlainText}
          docLabel="Resume"
        />
      )}
    </div>
  );
};

const FinalDownloadStep: React.FC<{ draft: ReturnType<typeof useResumeDraft>['draft']; filename: string }> = ({ draft, filename }) => {
  const [viewOpen, setViewOpen] = useState(false);
  const template = draft.template || 'Professional';
  const TemplateComponent = RESUME_TEMPLATES[templateKey(template)];
  const downloadData = useMemo(() => draftToResumeData(draft), [draft]);

  return (
    <div className="space-y-4">
      <div className="p-2 rounded-xl border-2 border-primary bg-primary/5 shadow-md">
        <div className="pointer-events-none">
          <ScaledA4Preview fit="contain">
            <TemplateComponent resumeData={downloadData} />
          </ScaledA4Preview>
        </div>
        <Button
          variant="outline"
          className="mt-3 w-full rounded-lg h-11"
          onClick={() => setViewOpen(true)}
        >
          <Eye className="w-4 h-4 mr-2" /> View Resume
        </Button>
      </div>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-[96vw] sm:max-w-3xl max-h-[95vh] overflow-y-auto p-2 sm:p-4 [&>button]:hidden">
          <ScaledA4Preview fit="contain">
            <TemplateComponent resumeData={downloadData} />
          </ScaledA4Preview>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ResumeCreate;
