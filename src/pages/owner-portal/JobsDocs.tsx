import { ErrorCodeReference, JOBS_ERRORS } from "@/components/docs/ErrorCodeReference";
import { useEffect, useState } from "react";
import CopyPageButton from "@/components/docs/CopyPageButton";
import { goBack } from "@/lib/goBack";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Briefcase, Code2, KeyRound, ListChecks, MousePointerClick } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { SampleBlock, SectionHeading } from "./WhatsAppDocs";

type Sample = { title: string; description: string; code: string };

const API_URL = "https://jubwzelupbntbetpajqb.supabase.co/functions/v1/jobs-api";
const SITE = "https://worklyindia.devs.surf";

const apiSamples: Sample[] = [
  {
    title: "Search jobs",
    description: "Search active jobs by keyword, location and job type. Optional: page, limit (max 100), search, location, job_type (full-time | part-time | contract | internship | temporary).",
    code: `curl "${API_URL}/search?search=data%20entry&location=Delhi&job_type=full-time&page=1&limit=20" \\
  -H "x-api-key: wfh_YOUR_API_KEY"

// → { "success": true, "data": { "jobs": [ {
//      "id": "8f2c...", "title": "Data Entry Operator", "description": "...",
//      "location": "Delhi", "job_type": "full-time", "salary_min": 15000, "salary_max": 22000,
//      "skills": ["Typing","Excel"], "created_at": "...",
//      "companies": { "company_name": "ABC Pvt Ltd", "logo_url": "https://..." },
//      "job_url":   "${SITE}/job/data-entry-operator-delhi?utm_source=api_partner&utm_medium=jobs_api",
//      "apply_url": "${SITE}/job/data-entry-operator-delhi?utm_source=api_partner&utm_medium=jobs_api"
//    } ],
//    "pagination": { "page": 1, "limit": 20, "total": 340, "total_pages": 17 } } }`,
  },
  {
    title: "Latest jobs",
    description: "Newest active jobs first, with full company details. Optional: page, limit, location, job_type.",
    code: `curl "${API_URL}/latest?limit=10" \\
  -H "x-api-key: wfh_YOUR_API_KEY"`,
  },
  {
    title: "Trending jobs",
    description: "Most popular active jobs. Optional: page, limit, location, job_type, experience_level.",
    code: `curl "${API_URL}/trending?limit=10&location=Mumbai" \\
  -H "x-api-key: wfh_YOUR_API_KEY"`,
  },
  {
    title: "Full job details",
    description: "Everything about one job: description, requirements, responsibilities, benefits, salary, skills and company. Use it for your job detail page.",
    code: `curl "${API_URL}/detail?job_id=JOB_ID" \\
  -H "x-api-key: wfh_YOUR_API_KEY"

// → { "success": true, "data": { "id": "JOB_ID", "title": "...", "description": "...",
//      "requirements": "...", "responsibilities": [...], "benefits": "...",
//      "companies": { "company_name": "...", "logo_url": "...", "industry": "...", "website": "..." },
//      "apply_url": "${SITE}/job/...?utm_source=api_partner&utm_medium=jobs_api" } }`,
  },
];

const websiteSamples: Sample[] = [
  {
    title: "Node.js: your server fetches the jobs",
    description: "Keep the API key on your server (environment variable). Your website calls your own server, never the API with the key from the browser.",
    code: `// GET /api/jobs?search=...&location=...&page=1
app.get("/api/jobs", async (req, res) => {
  const qs = new URLSearchParams(req.query).toString();
  const r = await fetch("${API_URL}/search?" + qs, {
    headers: { "x-api-key": process.env.WORKLY_API_KEY },
  });
  res.status(r.status).json(await r.json());
});

// GET /api/jobs/:id  → full details for your detail page
app.get("/api/jobs/:id", async (req, res) => {
  const r = await fetch("${API_URL}/detail?job_id=" + encodeURIComponent(req.params.id), {
    headers: { "x-api-key": process.env.WORKLY_API_KEY },
  });
  res.status(r.status).json(await r.json());
});`,
  },
  {
    title: "Job list on your website",
    description: "Show jobs like Jooble, Careerjet or Adzuna. The title opens your own detail page; Apply opens Workly India.",
    code: `const { data } = await (await fetch("/api/jobs?search=sales&page=1")).json();

document.querySelector("#jobs").innerHTML = data.jobs.map((job) => \`
  <article class="job">
    <img src="\${job.companies?.logo_url ?? ""}" alt="" width="48" height="48" />
    <a href="/jobs/\${job.id}"><h3>\${job.title}</h3></a>
    <p>\${job.companies?.company_name ?? ""} · \${job.location} · \${job.job_type}</p>
    <a href="\${job.apply_url}" target="_blank" rel="noopener">Apply on Workly India</a>
  </article>\`).join("");`,
  },
  {
    title: "Job detail page on your website",
    description: "Show complete job details on your site. The Apply button must use apply_url so the candidate applies on Workly India.",
    code: `const { data: job } = await (await fetch("/api/jobs/" + jobId)).json();

render(\`
  <h1>\${job.title}</h1>
  <p>\${job.companies.company_name} · \${job.location}</p>
  <p>Salary: ₹\${job.salary_min} – ₹\${job.salary_max}</p>
  <h2>Description</h2><div>\${job.description}</div>
  <h2>Requirements</h2><div>\${job.requirements ?? ""}</div>
  <a class="apply" href="\${job.apply_url}" target="_blank" rel="noopener">Apply Now</a>
\`);`,
  },
  {
    title: "React example",
    description: "Same flow in React.",
    code: `function Jobs() {
  const [jobs, setJobs] = useState([]);
  useEffect(() => {
    fetch("/api/jobs?limit=20").then((r) => r.json()).then((d) => setJobs(d.data.jobs));
  }, []);
  return jobs.map((job) => (
    <div key={job.id}>
      <h3>{job.title}</h3>
      <p>{job.companies?.company_name} · {job.location}</p>
      <a href={job.apply_url} target="_blank" rel="noopener">Apply Now</a>
    </div>
  ));
}`,
  },
];

const B = ({ children }: { children: React.ReactNode }) => <strong className="text-foreground">{children}</strong>;

const JobsDocs = () => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const section = window.location.hash.slice(1);
    if (section) window.requestAnimationFrame(() => document.getElementById(section)?.scrollIntoView());
  }, []);

  const copy = async (code: string, title: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(title);
      window.setTimeout(() => setCopied(null), 2000);
      toast.success("Copied");
    } catch {
      toast.error("Could not copy the example");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-3 backdrop-blur sm:px-4">
        <Button variant="ghost" size="icon" onClick={() => goBack(navigate, "/developers")} aria-label="Back to Developer Portal">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Job Docs</h1>
        <CopyPageButton title={"Job Docs"} />
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Briefcase className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-semibold">Workly India Jobs API</h2>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Show Workly India jobs on your own website, just like Jooble, Careerjet or Adzuna. Visitors see complete job details on your site, and the Apply button sends them to Workly India to apply.
        </p>

        <section id="setup" className="scroll-mt-20 py-8">
          <SectionHeading icon={KeyRound} title="Setup" />
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-muted-foreground">
            <li>In the <B>Developer Portal</B>, activate an API subscription and create an <B>API key</B> (starts with <code>wfh_</code>).</li>
            <li>Save the key on your server as <code>WORKLY_API_KEY</code>. Never put it in browser code.</li>
            <li>Call the API from your server with the header <code>x-api-key</code> (examples below).</li>
            <li>Show the jobs on your website. Every <B>Apply</B> button must open the job's <code>apply_url</code>.</li>
          </ol>
          <p className="mt-4 break-all text-sm text-muted-foreground">Base URL: <code className="text-foreground">GET {API_URL}</code></p>
        </section>

        <section id="how-it-works" className="scroll-mt-20 border-t border-border py-8">
          <SectionHeading icon={MousePointerClick} title="How it works" />
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
            <li><B>Your website</B> shows the job list and the full job detail page in your own design.</li>
            <li>Every job includes <code>job_url</code> and <code>apply_url</code> pointing to the job on Workly India.</li>
            <li>When a candidate taps <B>Apply</B>, they open Workly India and apply there. The employer receives the application as usual.</li>
            <li>Only active jobs are returned. Expired or closed jobs disappear automatically.</li>
          </ul>
        </section>

        <section id="endpoints" className="scroll-mt-20 border-t border-border py-8">
          <SectionHeading icon={ListChecks} title="Endpoints" />
          {apiSamples.map((s) => <SampleBlock key={s.title} sample={s} copied={copied} onCopy={copy} />)}
        </section>

        <section id="website" className="scroll-mt-20 border-t border-border py-8">
          <SectionHeading icon={Code2} title="Build the jobs page on your website" />
          {websiteSamples.map((s) => <SampleBlock key={s.title} sample={s} copied={copied} onCopy={copy} />)}
          <ul className="mt-5 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
            
            <li>Rate limit headers: <code>X-RateLimit-Limit</code> and <code>X-RateLimit-Remaining</code>. Cache results on your server for a few minutes.</li>
          </ul>
          <h3 className="mt-6 font-semibold">Error codes</h3>
          <ErrorCodeReference errors={JOBS_ERRORS} />
        </section>
      </main>
    </div>
  );
};

export default JobsDocs;
