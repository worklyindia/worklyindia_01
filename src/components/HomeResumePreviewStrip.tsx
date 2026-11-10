import { useNavigate } from "react-router-dom";
import { TEMPLATES, RESUME_PREVIEW_DATA } from "@/components/resume-create/Steps";
import { RESUME_TEMPLATES } from "@/components/resume/ResumeTemplates";
import { templateKey } from "@/components/resume-create/draftToResumeData";
import { ScaledA4Preview } from "@/components/resume-create/ScaledA4Preview";
import {
  COVER_LETTER_TEMPLATES,
  CoverLetterRender,
} from "@/components/cover-letter-create/CoverLetterTemplates";
import { SAMPLE_COVER_DRAFT } from "@/components/cover-letter-create/Steps";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const setDraftTemplate = (storageKey: string, templateId: string) => {
  try {
    const raw = localStorage.getItem(storageKey);
    const current = raw ? JSON.parse(raw) : {};
    current.template = templateId;
    localStorage.setItem(storageKey, JSON.stringify(current));
  } catch {
    // ignore
  }
};

/**
 * Home page strips: all resume templates and all cover letter templates,
 * each in one horizontal line, full-bleed edge-to-edge, swipeable like
 * YouTube video thumbnails. Renders the SAME live template previews as
 * the resume / cover letter builders, not static thumbnail images.
 * Tapping a card opens the builder with that template preselected.
 */
const HomeResumePreviewStrip = ({ layout = "horizontal" }: { layout?: "horizontal" | "vertical" }) => {
  const navigate = useNavigate();

  const openResume = (templateId: string) => {
    setDraftTemplate("resume_builder_draft_v1", templateId);
    navigate("/resume-builder/create/1");
  };

  const openCoverLetter = (templateId: string) => {
    setDraftTemplate("cover_letter_draft_v1", templateId);
    navigate("/cover-letter-builder/create/1");
  };

  if (layout === "vertical") {
    return (
      <div className="w-full space-y-14">
        <section aria-label="Resume templates preview">
          <h2 className="mb-6 text-2xl font-bold sm:text-3xl">Free Resume Templates</h2>
          <div className="mx-auto flex w-full max-w-xl flex-col gap-10">
            {TEMPLATES.map((t) => {
              const Comp = RESUME_TEMPLATES[templateKey(t.id)];
              return (
                <article key={t.id} className="min-w-0 border-b border-border pb-8">
                  <div className="pointer-events-none">
                    <ScaledA4Preview fit="contain">
                      <Comp resumeData={RESUME_PREVIEW_DATA} />
                    </ScaledA4Preview>
                  </div>
                  <h3 className="mt-5 text-center text-xl font-bold">{t.name}</h3>
                  <p className="mt-2 text-center text-sm leading-relaxed text-muted-foreground">{t.desc}</p>
                  <Button
                    onClick={() => openResume(t.id)}
                    aria-label={`Create resume with ${t.name} template`}
                    className="mt-4 w-full"
                  >
                    Create resume <ArrowRight />
                  </Button>
                </article>
              );
            })}
          </div>
        </section>
        <section aria-label="Cover letter templates preview">
          <h2 className="mb-6 text-2xl font-bold sm:text-3xl">Free Cover Letter Templates</h2>
          <div className="mx-auto flex w-full max-w-xl flex-col gap-10">
            {COVER_LETTER_TEMPLATES.map((t) => (
              <article key={t.id} className="min-w-0 border-b border-border pb-8">
                <div className="pointer-events-none">
                  <ScaledA4Preview fit="contain">
                    <CoverLetterRender draft={SAMPLE_COVER_DRAFT} template={t.id} />
                  </ScaledA4Preview>
                </div>
                <h3 className="mt-5 text-center text-xl font-bold">{t.name}</h3>
                <p className="mt-2 text-center text-sm leading-relaxed text-muted-foreground">{t.desc}</p>
                <Button
                  onClick={() => openCoverLetter(t.id)}
                  aria-label={`Create cover letter with ${t.name} template`}
                  className="mt-4 w-full"
                >
                  Create cover letter <ArrowRight />
                </Button>
              </article>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <>
      <section className="py-3" aria-label="Resume templates preview">
        <div className="px-4 pb-2 flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold">
            Free Resume Templates
          </h2>
          <button
            onClick={() => navigate("/resume-builder")}
            className="text-sm font-medium text-primary underline underline-offset-4 decoration-primary/30 hover:decoration-primary transition-all"
          >
            View all
          </button>
        </div>
        {/* Full-bleed single-line horizontal scroll, like YouTube thumbnails */}
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TEMPLATES.map((t, index) => {
            const Comp = RESUME_TEMPLATES[templateKey(t.id)];
            return (
              <button
                key={t.id}
                onClick={() => openResume(t.id)}
                className={`flex-shrink-0 w-[42vw] max-w-[200px] snap-center text-center group ${
                  index === 0 ? "ml-4" : ""
                } ${index === TEMPLATES.length - 1 ? "mr-4" : ""}`}
                aria-label={`Create resume with ${t.name} template`}
              >
                <div className="pointer-events-none transition group-hover:shadow-md group-active:scale-[0.98] rounded-lg">
                  <ScaledA4Preview>
                    <Comp resumeData={RESUME_PREVIEW_DATA} />
                  </ScaledA4Preview>
                </div>
                <p className="mt-1.5 text-xs font-semibold truncate">{t.name}</p>
                <p className="text-[11px] text-muted-foreground">Tap to create</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="py-3" aria-label="Cover letter templates preview">
        <div className="px-4 pb-2 flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold">
            Free Cover Letter Templates
          </h2>
          <button
            onClick={() => navigate("/cover-letter-builder")}
            className="text-sm font-medium text-primary underline underline-offset-4 decoration-primary/30 hover:decoration-primary transition-all"
          >
            View all
          </button>
        </div>
        {/* Full-bleed single-line horizontal scroll, like YouTube thumbnails */}
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {COVER_LETTER_TEMPLATES.map((t, index) => (
            <button
              key={t.id}
              onClick={() => openCoverLetter(t.id)}
              className={`flex-shrink-0 w-[42vw] max-w-[200px] snap-center text-center group ${
                index === 0 ? "ml-4" : ""
              } ${index === COVER_LETTER_TEMPLATES.length - 1 ? "mr-4" : ""}`}
              aria-label={`Create cover letter with ${t.name} template`}
            >
              <div className="pointer-events-none transition group-hover:shadow-md group-active:scale-[0.98] rounded-lg">
                <ScaledA4Preview>
                  <CoverLetterRender draft={SAMPLE_COVER_DRAFT} template={t.id} />
                </ScaledA4Preview>
              </div>
              <p className="mt-1.5 text-xs font-semibold truncate">{t.name}</p>
              <p className="text-[11px] text-muted-foreground">Tap to create</p>
            </button>
          ))}
        </div>
      </section>
    </>
  );
};

export default HomeResumePreviewStrip;
