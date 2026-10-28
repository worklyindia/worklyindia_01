import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X, Upload, PenTool } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CoverLetterDraft } from '@/hooks/useCoverLetterDraft';
import { COVER_LETTER_TEMPLATES, CoverLetterRender } from './CoverLetterTemplates';
import { ScaledA4Preview } from '@/components/resume-create/ScaledA4Preview';
import { ImageCropDialog } from '@/components/brand/ImageCropDialog';
import SignaturePadDialog from './SignaturePadDialog';
import sampleSignature from '@/assets/sample-signature.webp';



type P = { draft: CoverLetterDraft; update: any };

/* 1 – Personal Information */
export const CLStep1Personal: React.FC<P> = ({ draft, update }) => {
  const p = draft.personal;
  const set = (k: keyof typeof p, v: string) => update('personal', { ...p, [k]: v });
  return (
    <div className="space-y-4">
      <div><Label>Full Name *</Label><Input value={p.fullName} onChange={(e) => set('fullName', e.target.value)} placeholder="John Doe" /></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><Label>Mobile Number *</Label><Input type="tel" value={p.mobile} onChange={(e) => set('mobile', e.target.value)} placeholder="+91 98765 43210" /></div>
        <div><Label>Email *</Label><Input type="email" value={p.email} onChange={(e) => set('email', e.target.value)} placeholder="you@example.com" /></div>
      </div>
      <div><Label>City, State *</Label><Input value={p.location} onChange={(e) => set('location', e.target.value)} placeholder="Mumbai, Maharashtra" /></div>
      <div><Label>LinkedIn (Optional)</Label><Input value={p.linkedin} onChange={(e) => set('linkedin', e.target.value)} placeholder="linkedin.com/in/username" /></div>
      <div><Label>Portfolio (Optional)</Label><Input value={p.portfolio} onChange={(e) => set('portfolio', e.target.value)} placeholder="yourwebsite.com" /></div>
    </div>
  );
};

/* 2 – Employer Details */
export const CLStep2Employer: React.FC<P> = ({ draft, update }) => {
  const p = draft.employer;
  const set = (k: keyof typeof p, v: string) => update('employer', { ...p, [k]: v });
  return (
    <div className="space-y-4">
      <div><Label>Company Name *</Label><Input value={p.companyName} onChange={(e) => set('companyName', e.target.value)} /></div>
      <div><Label>Hiring Manager Name (Optional)</Label><Input value={p.hiringManager} onChange={(e) => set('hiringManager', e.target.value)} /></div>
      <div><Label>Designation (Optional)</Label><Input value={p.designation} onChange={(e) => set('designation', e.target.value)} placeholder="HR Manager" /></div>
      <div><Label>Company Address (Optional)</Label><Textarea rows={3} value={p.companyAddress} onChange={(e) => set('companyAddress', e.target.value)} /></div>
    </div>
  );
};

/* 3 – Job Details */
export const CLStep3Job: React.FC<P> = ({ draft, update }) => {
  const p = draft.job;
  const set = (k: keyof typeof p, v: string) => update('job', { ...p, [k]: v });
  return (
    <div className="space-y-4">
      <div><Label>Job Title *</Label><Input value={p.title} onChange={(e) => set('title', e.target.value)} /></div>
      <div><Label>Job ID (Optional)</Label><Input value={p.id} onChange={(e) => set('id', e.target.value)} /></div>
      <div><Label>Job Location *</Label><Input value={p.location} onChange={(e) => set('location', e.target.value)} /></div>
      <div><Label>Job Source (Optional)</Label><Input value={p.source} onChange={(e) => set('source', e.target.value)} placeholder="LinkedIn, Company Website..." /></div>
    </div>
  );
};

/* 4 – Opening / Greeting */
const GREETINGS = ['Dear Hiring Manager', 'Dear Recruiter', 'Dear Mr./Ms. [Name]', 'Custom'] as const;
export const CLStep4Opening: React.FC<P> = ({ draft, update }) => {
  const p = draft.opening;
  return (
    <div className="space-y-3">
      <Label>Choose a greeting</Label>
      <div className="flex flex-wrap gap-2">
        {GREETINGS.map((g) => {
          const active = p.greeting === g;
          return (
            <button
              key={g}
              type="button"
              onClick={() => update('opening', { ...p, greeting: g })}
              className={`px-3 py-1.5 rounded-full text-sm border transition ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:bg-muted'}`}
            >
              {g}
            </button>
          );
        })}
      </div>
      {p.greeting === 'Dear Mr./Ms. [Name]' && (
        <div className="space-y-2">
          <Label>Recipient Name</Label>
          <Input
            value={p.customGreeting}
            onChange={(e) => update('opening', { ...p, customGreeting: e.target.value })}
            placeholder="e.g. Mr Vinod Kumar or Ms Priya Sharma"
          />
          <p className="text-xs text-muted-foreground">
            This will appear as "Dear {p.customGreeting || 'Mr Vinod Kumar'}," in your cover letter.
          </p>
        </div>
      )}
      {p.greeting === 'Custom' && (
        <div>
          <Label>Custom Greeting</Label>
          <Input value={p.customGreeting} onChange={(e) => update('opening', { ...p, customGreeting: e.target.value })} placeholder="Dear Team..." />
        </div>
      )}
    </div>
  );
};

/* 5 – Introduction */
export const CLStep5Intro: React.FC<P> = ({ draft, update }) => {
  const p = draft.introduction;
  const set = (k: keyof typeof p, v: string) => update('introduction', { ...p, [k]: v });
  return (
    <div className="space-y-4">
      <div>
        <Label>Why are you applying? *</Label>
        <Textarea rows={4} value={p.whyApplying} onChange={(e) => set('whyApplying', e.target.value)} placeholder="I am excited to apply for the [role] position because..." />
      </div>
      <div>
        <Label>Where did you find the job? (Optional)</Label>
        <Input value={p.whereFound} onChange={(e) => set('whereFound', e.target.value)} placeholder="LinkedIn, Naukri, referral..." />
      </div>
    </div>
  );
};

/* 6 – Experience */
export const CLStep6Experience: React.FC<P> = ({ draft, update }) => {
  const p = draft.experience;
  const set = (k: keyof typeof p, v: string) => update('experience', { ...p, [k]: v });
  return (
    <div className="space-y-4">
      <div><Label>Years of Experience</Label><Input value={p.years} onChange={(e) => set('years', e.target.value)} placeholder="3 years" /></div>
      <div><Label>Current Job Title</Label><Input value={p.currentTitle} onChange={(e) => set('currentTitle', e.target.value)} /></div>
      <div><Label>Current Company</Label><Input value={p.currentCompany} onChange={(e) => set('currentCompany', e.target.value)} /></div>
      <div>
        <Label>Relevant Experience</Label>
        <Textarea rows={4} value={p.relevant} onChange={(e) => set('relevant', e.target.value)} placeholder="Led a team of 5 engineers, delivered 12 projects..." />
      </div>
    </div>
  );
};

/* 7 – Skills */
export const CLStep7Skills: React.FC<P> = ({ draft, update }) => {
  const [input, setInput] = React.useState('');
  const p = draft.skills;
  const add = () => {
    const v = input.trim();
    if (!v || p.skills.includes(v)) return;
    update('skills', { ...p, skills: [...p.skills, v] });
    setInput('');
  };
  const del = (s: string) => update('skills', { ...p, skills: p.skills.filter((x) => x !== s) });
  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <Label>Add multiple skills</Label>
        <div className="flex gap-2">
          <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} placeholder="e.g. Communication" />
          <Button onClick={add}><Plus className="w-4 h-4" /></Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {p.skills.map((s) => (
            <Badge key={s} variant="secondary" className="pl-3 pr-1 py-1 gap-1">
              {s}
              <button onClick={() => del(s)} className="ml-1 hover:bg-background/50 rounded-full p-0.5">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      </Card>
      <div>
        <Label>Certifications (Optional)</Label>
        <Textarea rows={2} value={p.certifications} onChange={(e) => update('skills', { ...p, certifications: e.target.value })} placeholder="AWS Certified, Google PM..." />
      </div>
      <div>
        <Label>Achievements (Optional)</Label>
        <Textarea rows={2} value={p.achievements} onChange={(e) => update('skills', { ...p, achievements: e.target.value })} placeholder="Employee of the year 2024..." />
      </div>
    </div>
  );
};

/* 8 – Why This Company */
export const CLStep8WhyCompany: React.FC<P> = ({ draft, update }) => (
  <div className="space-y-3">
    <Label>Why do you want to join this company? *</Label>
    <Textarea
      rows={7}
      value={draft.whyCompany}
      onChange={(e) => update('whyCompany', e.target.value)}
      placeholder="I admire your company's mission to..."
    />
  </div>
);

/* 9 – Closing */
export const CLStep9Closing: React.FC<P> = ({ draft, update }) => {
  const p = draft.closing;
  const set = (k: keyof typeof p, v: string) => update('closing', { ...p, [k]: v });
  return (
    <div className="space-y-4">
      <div>
        <Label>Availability to Join</Label>
        <Input value={p.availability} onChange={(e) => set('availability', e.target.value)} placeholder="immediately / within 30 days" />
      </div>
      <div>
        <Label>Thank You Message</Label>
        <Textarea rows={3} value={p.thankYou} onChange={(e) => set('thankYou', e.target.value)} />
      </div>
    </div>
  );
};

/* 10 – Signature */
type SignatureMethod = 'font' | 'draw' | 'upload';

export const CLStep10Signature: React.FC<P> = ({ draft, update }) => {
  const p = draft.signature;
  const set = (k: keyof typeof p, v: string) => update('signature', { ...p, [k]: v });
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const [cropOpen, setCropOpen] = React.useState(false);
  const [drawOpen, setDrawOpen] = React.useState(false);

  // Detect current signature method from existing draft data.
  const detectMethod = (): SignatureMethod => {
    if (p.signatureFont) return 'font';
    if (p.digitalSignatureUrl) return 'draw';
    return 'font';
  };
  const [method, setMethod] = React.useState<SignatureMethod>(detectMethod);

  // Selecting a method clears the other options so only one is ever active.
  const chooseMethod = (m: SignatureMethod) => {
    setMethod(m);
    if (m === 'font') {
      if (p.digitalSignatureUrl) set('digitalSignatureUrl', '');
    } else {
      if (p.signatureFont) set('signatureFont', '');
    }
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPendingFile(f);
    setCropOpen(true);
    e.target.value = '';
  };

  const handleCropped = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => set('digitalSignatureUrl', reader.result as string);
    reader.readAsDataURL(file);
  };

  const SIG_FONTS: { id: NonNullable<typeof p.signatureFont>; label: string; family: string }[] = [
    { id: 'great-vibes', label: 'Elegant', family: '"Great Vibes", cursive' },
    { id: 'allura', label: 'Refined', family: '"Allura", cursive' },
    { id: 'alex-brush', label: 'Brush', family: '"Alex Brush", cursive' },
    { id: 'dancing-script', label: 'Casual', family: '"Dancing Script", cursive' },
    { id: 'sacramento', label: 'Classic', family: '"Sacramento", cursive' },
    { id: 'kaushan-script', label: 'Bold Script', family: '"Kaushan Script", cursive' },
    { id: 'satisfy', label: 'Smooth', family: '"Satisfy", cursive' },
    { id: 'pacifico', label: 'Playful', family: '"Pacifico", cursive' },
    { id: 'caveat', label: 'Handwritten', family: '"Caveat", cursive' },
    { id: 'homemade-apple', label: 'Natural', family: '"Homemade Apple", cursive' },
    { id: 'yellowtail', label: 'Flowy', family: '"Yellowtail", cursive' },
    { id: 'parisienne', label: 'Parisian', family: '"Parisienne", cursive' },
    { id: 'monsieur-la-doulaise', label: 'Formal Script', family: '"Monsieur La Doulaise", cursive' },
    { id: 'tangerine', label: 'Delicate', family: '"Tangerine", cursive' },
    { id: 'mrs-saint-delafield', label: 'Vintage', family: '"Mrs Saint Delafield", cursive' },
    { id: 'pinyon-script', label: 'Pinyon', family: '"Pinyon Script", cursive' },
    { id: 'herr-von-muellerhoff', label: 'Muellerhoff', family: '"Herr Von Muellerhoff", cursive' },
    { id: 'rochester', label: 'Rochester', family: '"Rochester", cursive' },
    { id: 'qwigley', label: 'Qwigley', family: '"Qwigley", cursive' },
    { id: 'italianno', label: 'Italianno', family: '"Italianno", cursive' },
    { id: 'arizonia', label: 'Arizonia', family: '"Arizonia", cursive' },
    { id: 'marck-script', label: 'Marck', family: '"Marck Script", cursive' },
    { id: 'bilbo', label: 'Bilbo', family: '"Bilbo", cursive' },
    { id: 'bilbo-swash-caps', label: 'Bilbo Swash', family: '"Bilbo Swash Caps", cursive' },
    { id: 'aguafina-script', label: 'Aguafina', family: '"Aguafina Script", cursive' },
    { id: 'cedarville-cursive', label: 'Cedarville', family: '"Cedarville Cursive", cursive' },
    { id: 'clicker-script', label: 'Clicker', family: '"Clicker Script", cursive' },
    { id: 'sofia', label: 'Sofia', family: '"Sofia", cursive' },
    { id: 'windsong', label: 'WindSong', family: '"WindSong", cursive' },
    { id: 'freebooter-script', label: 'Freebooter', family: '"Freebooter Script", "Great Vibes", cursive' },
    { id: 'euphoria-script', label: 'Euphoria', family: '"Euphoria Script", cursive' },
  ];

  const previewName = p.typedName || draft.personal.fullName || 'Your Name';

  const methodOptions: { id: SignatureMethod; label: string; hint: string }[] = [
    { id: 'font', label: 'Signature Style', hint: 'Pick a handwriting font' },
    { id: 'draw', label: 'Draw Signature', hint: 'Sign with finger / mouse' },
    { id: 'upload', label: 'Upload Signature', hint: 'Upload an image file' },
  ];

  return (
    <div className="space-y-5">
      <div>
        <Label>Typed Name *</Label>
        <Input
          value={p.typedName}
          onChange={(e) => set('typedName', e.target.value)}
          placeholder={draft.personal.fullName || 'John Doe'}
        />
      </div>

      <div className="space-y-2">
        <Label>How do you want to sign?</Label>
        <p className="text-xs text-muted-foreground">Choose one option — you can use only one signature at a time.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {methodOptions.map((opt) => {
            const selected = method === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => chooseMethod(opt.id)}
                className={`rounded-xl border-2 p-3 bg-white text-left transition-all ${selected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/40'}`}
              >
                <div className="font-semibold text-sm text-foreground">{opt.label}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{opt.hint}</div>
              </button>
            );
          })}
        </div>
      </div>

      {method === 'font' && (
        <div className="space-y-2">
          <Label>Signature Style (choose a font)</Label>
          <p className="text-xs text-muted-foreground">Tap a style to use it as your signature.</p>
          <div className="grid grid-cols-1 gap-2">
            {SIG_FONTS.map((f) => {
              const selected = p.signatureFont === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => set('signatureFont', selected ? '' : f.id)}
                  className={`rounded-xl border-2 px-4 py-3 bg-white text-left transition-all ${selected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/40'}`}
                >
                  <div
                    style={{
                      fontFamily: f.family,
                      fontSize: 30,
                      lineHeight: 1.15,
                      color: '#1E40AF',
                      minHeight: 36,
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {previewName}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{f.label}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {method === 'draw' && (
        <div className="space-y-2">
          <Label>Draw Signature</Label>
          <Button type="button" variant="outline" className="rounded-xl w-full" onClick={() => setDrawOpen(true)}>
            <PenTool className="w-4 h-4 mr-2" /> Open drawing pad
          </Button>
          {p.digitalSignatureUrl && (
            <div className="mt-2 flex items-center gap-3 p-3 border rounded-xl bg-muted/30">
              <img src={p.digitalSignatureUrl} alt="Signature preview" className="max-h-16 object-contain bg-white rounded" />
              <Button type="button" variant="ghost" size="sm" onClick={() => set('digitalSignatureUrl', '')}>
                <X className="w-4 h-4 mr-1" /> Remove
              </Button>
            </div>
          )}
        </div>
      )}

      {method === 'upload' && (
        <div className="space-y-2">
          <Label>Upload Signature</Label>
          <Button type="button" variant="outline" className="rounded-xl w-full" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" /> Choose image
          </Button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFilePick} />
          {p.digitalSignatureUrl && (
            <div className="mt-2 flex items-center gap-3 p-3 border rounded-xl bg-muted/30">
              <img src={p.digitalSignatureUrl} alt="Signature preview" className="max-h-16 object-contain bg-white rounded" />
              <Button type="button" variant="ghost" size="sm" onClick={() => set('digitalSignatureUrl', '')}>
                <X className="w-4 h-4 mr-1" /> Remove
              </Button>
            </div>
          )}
        </div>
      )}

      <ImageCropDialog
        open={cropOpen}
        onOpenChange={setCropOpen}
        imageFile={pendingFile}
        onCropComplete={handleCropped}
        aspectRatio={3}
        title="Crop Signature"
        outputSize={{ width: 600, height: 200 }}
      />
      <SignaturePadDialog open={drawOpen} onOpenChange={setDrawOpen} onSave={(url) => set('digitalSignatureUrl', url)} />
    </div>
  );
};

/* Sample fake draft for template previews so users see what a fully-filled
   cover letter looks like — never the user's own half-typed data. */
const SAMPLE_SIGNATURE_URL = sampleSignature;

export const SAMPLE_COVER_DRAFT: CoverLetterDraft = {
  personal: {
    fullName: 'Ananya Sharma',
    mobile: '+91 98765 43210',
    email: 'ananya@example.com',
    location: 'Mumbai, Maharashtra',
    linkedin: 'linkedin.com/in/ananya',
    portfolio: 'ananyasharma.com',
  },
  employer: {
    companyName: 'Bright Works Pvt Ltd',
    hiringManager: 'Priya Verma',
    designation: 'HR Manager',
    companyAddress: '123 Business Avenue, Mumbai',
  },
  job: { title: 'Marketing Manager', id: 'JOB-1042', location: 'Mumbai', source: 'LinkedIn' },
  opening: { greeting: 'Dear Hiring Manager', customGreeting: '' },
  introduction: {
    whyApplying:
      'I am excited to apply for the Marketing Manager role because it aligns closely with my experience leading integrated campaigns and growing digital audiences.',
    whereFound: 'LinkedIn',
  },
  experience: {
    years: '5 years',
    currentTitle: 'Senior Associate',
    currentCompany: 'North Star',
    relevant: 'Led a cross-functional team of eight and delivered a 42% increase in qualified leads across our top three product lines.',
  },
  skills: {
    skills: ['Campaign Strategy', 'SEO', 'Analytics', 'Team Leadership'],
    certifications: 'Google Ads Certified, HubSpot Inbound',
    achievements: 'Employee of the Year 2024, Tripled organic traffic in 12 months.',
  },
  whyCompany:
    "I admire Bright Works' commitment to customer-first thinking and would love to bring the same rigour and results focus to your team.",
  closing: {
    availability: 'within 30 days',
    thankYou: 'Thank you for considering my application. I look forward to discussing how my background can benefit your team.',
  },
  signature: { typedName: 'Ananya Sharma', digitalSignatureUrl: '', signatureFont: 'great-vibes' },
  template: 'Professional',
};

/* 11 – Choose a Template */
export const CLStep11Template: React.FC<P> = ({ draft, update }) => {
  return (
    <div>
      <Label className="mb-2 block">Choose a Template *</Label>
      <p className="text-xs text-muted-foreground mb-3">
        Previews use sample data so you can see how a fully-filled cover letter will look.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {COVER_LETTER_TEMPLATES.map((t) => {
          const active = draft.template === t.id;
          return (
            <div
              key={t.id}
              role="button"
              tabIndex={0}
              onClick={() => update('template', t.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  update('template', t.id);
                }
              }}
              aria-label={`Select ${t.name}`}
              className={`p-2 rounded-xl border-2 transition cursor-pointer ${active ? 'border-primary bg-primary/5 shadow-md' : 'border-border hover:border-primary/40'}`}
            >
              <div className="pointer-events-none">
                <ScaledA4Preview>
                  <CoverLetterRender draft={SAMPLE_COVER_DRAFT} template={t.id} />
                </ScaledA4Preview>
              </div>

              <div className="mt-3 px-1 font-semibold text-sm">{t.name}</div>
              <div className="px-1 text-xs text-muted-foreground mt-0.5">{t.desc}</div>
              <div className="mt-3 px-1">
                <Button
                  size="sm"
                  variant={active ? 'default' : 'outline'}
                  className="w-full rounded-lg"
                  onClick={(e) => { e.stopPropagation(); update('template', t.id); }}
                >
                  {active ? 'Selected' : 'Use This'}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

