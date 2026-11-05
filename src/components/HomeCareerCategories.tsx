import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loadHomeCardImage } from "@/lib/homeCardImageCache";
import { ArrowUpRight, BookOpen, BriefcaseBusiness, Clock3, GraduationCap, House, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";

// Home card person photos live on the Owner's Cloudflare R2 bucket (immutable,
// one-year HTTP cache). Browser copies persist via homeCardImageCache so repeat
// visits hit neither this bucket nor any other source.
const R2_PHOTOS_ORIGIN = "https://pub-3225b45ecaf943b3b9061cd57d754bf2.r2.dev";
const R2_PHOTOS = "https://wsrv.nl/?w=600&q=80&output=webp&url=" + R2_PHOTOS_ORIGIN;

const categories = [
  { id: "fresher", title: "Jobs for Freshers", subtitle: "Your first step starts here", label: "FIRST OPPORTUNITY", href: "/jobs?tab=freshers", image: `${R2_PHOTOS}/01-Jobs-for-Freshers.png`, icon: GraduationCap },
  { id: "remote", title: "Work from Home", subtitle: "A career, wherever you are", label: "WORK YOUR WAY", href: "/jobs?location=Remote", image: `${R2_PHOTOS}/02-Work-from-Home.png`, icon: House },
  { id: "part", title: "Part-time Jobs", subtitle: "Make time for what matters", label: "FLEXIBLE HOURS", href: "/jobs?type=part-time", image: `${R2_PHOTOS}/03-Part-time-Jobs.png`, icon: Clock3 },
  { id: "women", title: "Jobs for Women", subtitle: "Your ambition belongs here", label: "NEW POSSIBILITIES", href: "/jobs-for-women", image: `${R2_PHOTOS}/04-Jobs-for-Women.png`, icon: UsersRound },
  { id: "full", title: "Full-time Jobs", subtitle: "Build your next chapter", label: "CAREER GROWTH", href: "/jobs?type=full-time", image: `${R2_PHOTOS}/05-Full-time-Jobs.png`, icon: BriefcaseBusiness },
  { id: "internship", title: "Internships", subtitle: "Learn today, lead tomorrow", label: "LEARN & GROW", href: "/jobs?type=internship", image: `${R2_PHOTOS}/06-Internships.png`, icon: BookOpen },
];

function SavedPersonImage({ image }: { image: string }) {
  const [source, setSource] = useState<string>();
  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    setSource(undefined);
    void loadHomeCardImage(image).then((blob) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setSource(objectUrl);
    }).catch(() => { if (active) setSource(image); });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [image]);
  return <img src={source} alt="" loading="lazy" decoding="async" width={768} height={1024} draggable={false} className="pointer-events-none absolute bottom-0 right-0 h-[82%] w-[39%] select-none object-contain object-bottom" />;
}

export default function HomeCareerCategories() {
  return (
    <section aria-labelledby="career-categories-title" className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-6 sm:py-10">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-primary">Find your next chapter</p>
          <h2 id="career-categories-title" className="text-xl font-bold text-foreground sm:text-2xl">Jobs that fit your life</h2>
        </div>
        <Button asChild variant="link" className="h-auto shrink-0 px-0 text-xs sm:text-sm">
          <Link to="/jobs">All jobs <ArrowUpRight aria-hidden="true" /></Link>
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {categories.map(({ id, title, subtitle, label, href, image, icon: Icon }) => (
          <article key={id} className={`career-card career-card-${id} relative isolate min-h-[228px] overflow-hidden rounded-lg border sm:min-h-[250px]`}>
            <div className="relative z-10 flex min-h-[228px] w-[65%] flex-col items-start p-5 sm:min-h-[250px] sm:p-6">
              <p className="mb-5 flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground sm:text-xs"><Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{label}</p>
              <h3 className="career-card-heading text-xl font-bold leading-tight sm:text-2xl">{title}</h3>
              <p className="mt-2 max-w-[180px] text-xs leading-relaxed text-muted-foreground sm:text-sm">{subtitle}</p>
              <Button asChild variant="ghost" className="career-card-action mt-auto h-10 rounded-md px-3 font-semibold">
                <Link to={href} aria-label={`View ${title}`}>View jobs <ArrowUpRight aria-hidden="true" /></Link>
              </Button>
            </div>
            <SavedPersonImage image={image} />
          </article>
        ))}
      </div>
    </section>
  );
}