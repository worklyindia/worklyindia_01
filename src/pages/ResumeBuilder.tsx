import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, FileText, Mail } from "lucide-react";
import {
  RESUME_TEMPLATE_THUMBS,
  COVER_LETTER_TEMPLATE_THUMBS,
} from "@/components/resume-create/templateThumbs";
import { emptyDraft as emptyResumeDraft } from "@/hooks/useResumeDraft";
import { emptyCoverLetterDraft } from "@/hooks/useCoverLetterDraft";

type Mode = "home" | "resume" | "cover";

const RESUME_TEMPLATES = [
  { id: "Professional", desc: "Classic clean layout for corporate roles" },
  { id: "ATS Simple", desc: "ATS-friendly plain formatting" },
  { id: "Modern", desc: "Contemporary design with color accents" },
  { id: "Minimal", desc: "Understated design with whitespace" },
  { id: "Executive", desc: "Refined layout for senior leadership" },
  { id: "Fresher", desc: "Ideal for students & first-time seekers" },
  { id: "Two Column", desc: "Sidebar layout with skills panel" },
  { id: "One Column", desc: "Single column top-to-bottom flow" },
  { id: "Compact", desc: "Space-efficient, fits more on a page" },
  { id: "Creative", desc: "Bold and unique for creative industries" },
] as const;

const COVER_TEMPLATES = [
  { id: "Professional", desc: "Classic business letter with navy header" },
  { id: "ATS Simple", desc: "Plain black-and-white ATS format" },
  { id: "Modern", desc: "Blue accent line and modern typography" },
  { id: "Minimal", desc: "Large whitespace with thin separators" },
  { id: "Executive", desc: "Premium senior-level business styling" },
  { id: "Fresher", desc: "Friendly first-job layout" },
  { id: "Creative", desc: "Stylish split header with soft colors" },
  { id: "Corporate", desc: "Gray-blue memo sidebar format" },
  { id: "Formal", desc: "Traditional serif business letter" },
  { id: "Simple", desc: "Basic clean layout" },
] as const;

const RESUME_DRAFT_KEY = "resume_builder_draft_v1";
const COVER_DRAFT_KEY = "cover_letter_draft_v1";

const preselectTemplate = (
  storageKey: string,
  fallback: any,
  templateId: string,
) => {
  try {
    const raw = localStorage.getItem(storageKey);
    const current = raw ? JSON.parse(raw) : fallback;
    current.template = templateId;
    localStorage.setItem(storageKey, JSON.stringify(current));
  } catch {
    // ignore
  }
};

const ResumeBuilder = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("home");

  const handleBack = () => {
    if (mode !== "home") {
      setMode("home");
      return;
    }
    // Coming back here after finishing a resume/cover letter, history still
    // holds the builder steps — going "back" there would bounce right back.
    // Always land the user on the home page instead.
    navigate("/", { replace: true });
  };

  const startResume = (templateId: string) => {
    preselectTemplate(RESUME_DRAFT_KEY, { ...emptyResumeDraft }, templateId);
    toast({ title: "Template selected", description: `${templateId} — starting resume builder…` });
    navigate("/resume-builder/create/1");
  };

  const startCoverLetter = (templateId: string) => {
    preselectTemplate(COVER_DRAFT_KEY, { ...emptyCoverLetterDraft }, templateId);
    toast({ title: "Template selected", description: `${templateId} — starting cover letter builder…` });
    navigate("/cover-letter-builder/create/1");
  };

  const heading =
    mode === "resume"
      ? "Choose a Resume Template"
      : mode === "cover"
        ? "Choose a Cover Letter Template"
        : "Resume & Cover Letter Builder";

  return (
    <div className="min-h-screen bg-background">
      {/* Colored header with back button */}
      <header
        className="sticky top-0 z-40 bg-gradient-to-r from-primary via-primary to-primary/80 text-primary-foreground shadow-md"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex items-center gap-2 h-14 px-3 max-w-7xl mx-auto">
          <button
            onClick={handleBack}
            aria-label="Go back"
            className="p-2 -ml-1 rounded-full hover:bg-white/15 active:scale-95 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="flex-1 min-w-0 text-base sm:text-lg font-semibold truncate">
            {heading}
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-5 sm:py-8 max-w-7xl">
        {mode === "home" && (
          <div className="grid gap-4 sm:grid-cols-2 max-w-3xl mx-auto">
            <Card
              onClick={() => navigate("/resume-builder/create/1")}
              className="p-6 cursor-pointer hover:shadow-lg hover:border-primary/50 transition active:scale-[0.99]"
            >
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <FileText className="w-7 h-7" />
                </div>
                <h2 className="text-lg font-semibold">Create Resume</h2>
                <p className="text-sm text-muted-foreground">
                  Craft a professional, job-ready resume in minutes — guided step by step.
                </p>
                <Button
                  className="w-full mt-2 rounded-xl"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate("/resume-builder/create/1");
                  }}
                >
                  Create Resume
                </Button>
              </div>
            </Card>

            <Card
              onClick={() => navigate("/cover-letter-builder/create/1")}
              className="p-6 cursor-pointer hover:shadow-lg hover:border-primary/50 transition active:scale-[0.99]"
            >
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <Mail className="w-7 h-7" />
                </div>
                <h2 className="text-lg font-semibold">Create Cover Letter</h2>
                <p className="text-sm text-muted-foreground">
                  Write a standout cover letter that gets noticed — quick, easy, and personalized.
                </p>
                <Button
                  className="w-full mt-2 rounded-xl"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate("/cover-letter-builder/create/1");
                  }}
                >
                  Create Cover Letter
                </Button>
              </div>
            </Card>
          </div>
        )}

        {mode === "resume" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {RESUME_TEMPLATES.map((t) => (
              <Card key={t.id} className="overflow-hidden flex flex-col">
                <div className="bg-muted/40 p-3 flex justify-center">
                  <img
                    src={RESUME_TEMPLATE_THUMBS[t.id]}
                    alt={`${t.id} resume template preview`}
                    loading="lazy"
                    className="w-full max-w-[240px] aspect-[794/1123] object-cover object-top rounded-md shadow-sm border"
                  />
                </div>
                <div className="p-3 flex-1 flex flex-col gap-2">
                  <div>
                    <h3 className="font-semibold text-sm">{t.id}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">{t.desc}</p>
                  </div>
                  <Button
                    className="w-full rounded-lg mt-auto"
                    onClick={() => startResume(t.id)}
                  >
                    Create Resume
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {mode === "cover" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {COVER_TEMPLATES.map((t) => (
              <Card key={t.id} className="overflow-hidden flex flex-col">
                <div className="bg-muted/40 p-3 flex justify-center">
                  <img
                    src={COVER_LETTER_TEMPLATE_THUMBS[t.id]}
                    alt={`${t.id} cover letter template preview`}
                    loading="lazy"
                    className="w-full max-w-[240px] aspect-[794/1123] object-cover object-top rounded-md shadow-sm border"
                  />
                </div>
                <div className="p-3 flex-1 flex flex-col gap-2">
                  <div>
                    <h3 className="font-semibold text-sm">{t.id}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">{t.desc}</p>
                  </div>
                  <Button
                    className="w-full rounded-lg mt-auto"
                    onClick={() => startCoverLetter(t.id)}
                  >
                    Create Cover Letter
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default ResumeBuilder;
