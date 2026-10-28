import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, X, Upload, User } from 'lucide-react';
import { ResumeDraft, newId } from '@/hooks/useResumeDraft';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RESUME_TEMPLATES } from '@/components/resume/ResumeTemplates';
import { draftToResumeData, templateKey } from './draftToResumeData';
import { ImageCropDialog } from '@/components/brand/ImageCropDialog';
import { ScaledA4Preview } from './ScaledA4Preview';
import sampleResumePhoto from '@/assets/sample-resume-photo.webp';


/* ==================== STEP 1 – Personal ==================== */
export const Step1Personal: React.FC<{ draft: ResumeDraft; update: any }> = ({ draft, update }) => {
  const p = draft.personal;
  const set = (k: keyof typeof p, v: string) => update('personal', { ...p, [k]: v });
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const [cropOpen, setCropOpen] = React.useState(false);

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPendingFile(f);
    setCropOpen(true);
    e.target.value = '';
  };

  const handleCropped = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => set('photoUrl', reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Full Name *</Label>
        <Input value={p.fullName} onChange={(e) => set('fullName', e.target.value)} placeholder="John Doe" />
      </div>
      <div>
        <Label>Professional Title *</Label>
        <Input value={p.professionalTitle} onChange={(e) => set('professionalTitle', e.target.value)} placeholder="e.g. Customer Care Executive" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>Mobile Number *</Label>
          <Input type="tel" value={p.mobile} onChange={(e) => set('mobile', e.target.value)} placeholder="+91 98765 43210" />
        </div>
        <div>
          <Label>Email Address *</Label>
          <Input type="email" value={p.email} onChange={(e) => set('email', e.target.value)} placeholder="you@example.com" />
        </div>
      </div>
      <div>
        <Label>Location *</Label>
        <Input value={p.location} onChange={(e) => set('location', e.target.value)} placeholder="City, State, Country" />
      </div>
      <div>
        <Label>LinkedIn Profile</Label>
        <Input value={p.linkedin} onChange={(e) => set('linkedin', e.target.value)} placeholder="linkedin.com/in/username" />
      </div>
      <div>
        <Label>Portfolio / Website</Label>
        <Input value={p.portfolio} onChange={(e) => set('portfolio', e.target.value)} placeholder="yourwebsite.com" />
      </div>
      <div className="space-y-2">
        <Label>Profile Photo</Label>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full border-2 border-border bg-muted overflow-hidden flex items-center justify-center shrink-0">
            {p.photoUrl ? (
              <img src={p.photoUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User className="w-8 h-8 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 space-y-2">
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-xl"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              {p.photoUrl ? 'Change Photo' : 'Upload Photo'}
            </Button>
            {p.photoUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-destructive hover:text-destructive"
                onClick={() => set('photoUrl', '')}
              >
                <X className="w-4 h-4 mr-1" /> Remove
              </Button>
            )}
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFilePick} />
      </div>
      <ImageCropDialog
        open={cropOpen}
        onOpenChange={setCropOpen}
        imageFile={pendingFile}
        onCropComplete={handleCropped}
        aspectRatio={1}
        title="Crop Profile Photo"
        outputSize={{ width: 400, height: 400 }}
      />
    </div>
  );
};

/* ==================== STEP 2 – Summary ==================== */
export const Step2Summary: React.FC<{ draft: ResumeDraft; update: any }> = ({ draft, update }) => {
  const words = draft.summary.trim() ? draft.summary.trim().split(/\s+/).length : 0;
  return (
    <div className="space-y-3">
      <Label>About Me / Professional Summary</Label>
      <Textarea
        rows={8}
        value={draft.summary}
        onChange={(e) => update('summary', e.target.value)}
        placeholder="Write 50–200 words summarizing your experience, key skills, and career goals..."
      />
      <p className={`text-xs ${words < 50 || words > 200 ? 'text-muted-foreground' : 'text-primary'}`}>
        {words} words {words < 50 ? '(min 50)' : words > 200 ? '(max 200)' : '✓'}
      </p>
    </div>
  );
};

/* ==================== STEP 3 – Experience ==================== */
export const Step3Experience: React.FC<{ draft: ResumeDraft; update: any }> = ({ draft, update }) => {
  const items = draft.experiences;
  const add = () =>
    update('experiences', [
      ...items,
      {
        id: newId(),
        company: '',
        jobTitle: '',
        employmentType: '',
        startDate: '',
        endDate: '',
        currentlyWorking: false,
        city: '',
        responsibilities: '',
        achievements: '',
      },
    ]);
  const upd = (id: string, patch: any) =>
    update('experiences', items.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const del = (id: string) => update('experiences', items.filter((x) => x.id !== id));

  return (
    <div className="space-y-4">
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">No experience added yet. Add your first role below.</p>
      )}
      {items.map((exp, idx) => (
        <Card key={exp.id} className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm">Experience #{idx + 1}</span>
            <Button variant="ghost" size="icon" onClick={() => del(exp.id)}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Company Name</Label>
              <Input value={exp.company} onChange={(e) => upd(exp.id, { company: e.target.value })} />
            </div>
            <div>
              <Label>Job Title</Label>
              <Input value={exp.jobTitle} onChange={(e) => upd(exp.id, { jobTitle: e.target.value })} />
            </div>
            <div>
              <Label>Employment Type</Label>
              <Select value={exp.employmentType} onValueChange={(v) => upd(exp.id, { employmentType: v })}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {['Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship'].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>City</Label>
              <Input value={exp.city} onChange={(e) => upd(exp.id, { city: e.target.value })} />
            </div>
            <div>
              <Label>Start Date</Label>
              <Input type="month" value={exp.startDate} onChange={(e) => upd(exp.id, { startDate: e.target.value })} />
            </div>
            <div>
              <Label>End Date</Label>
              <Input type="month" value={exp.endDate} disabled={exp.currentlyWorking} onChange={(e) => upd(exp.id, { endDate: e.target.value })} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={exp.currentlyWorking} onCheckedChange={(v) => upd(exp.id, { currentlyWorking: !!v, endDate: v ? '' : exp.endDate })} />
            Currently working here
          </label>
          <div>
            <Label>Responsibilities</Label>
            <Textarea rows={3} value={exp.responsibilities} onChange={(e) => upd(exp.id, { responsibilities: e.target.value })} />
          </div>
          <div>
            <Label>Achievements</Label>
            <Textarea rows={2} value={exp.achievements} onChange={(e) => upd(exp.id, { achievements: e.target.value })} />
          </div>
        </Card>
      ))}
      <Button variant="outline" className="w-full rounded-xl" onClick={add}>
        <Plus className="w-4 h-4 mr-1" /> Add Experience
      </Button>
    </div>
  );
};

/* ==================== STEP 4 – Education ==================== */
export const Step4Education: React.FC<{ draft: ResumeDraft; update: any }> = ({ draft, update }) => {
  const items = draft.education;
  const add = () =>
    update('education', [
      ...items,
      { id: newId(), course: '', school: '', board: '', startYear: '', endYear: '', grade: '' },
    ]);
  const upd = (id: string, patch: any) =>
    update('education', items.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const del = (id: string) => update('education', items.filter((x) => x.id !== id));

  return (
    <div className="space-y-4">
      {items.length === 0 && <p className="text-sm text-muted-foreground">Add your educational background.</p>}
      {items.map((ed, idx) => (
        <Card key={ed.id} className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm">Education #{idx + 1}</span>
            <Button variant="ghost" size="icon" onClick={() => del(ed.id)}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Course / Degree</Label>
              <Input value={ed.course} onChange={(e) => upd(ed.id, { course: e.target.value })} />
            </div>
            <div>
              <Label>School / College</Label>
              <Input value={ed.school} onChange={(e) => upd(ed.id, { school: e.target.value })} />
            </div>
            <div>
              <Label>Board / University</Label>
              <Input value={ed.board} onChange={(e) => upd(ed.id, { board: e.target.value })} />
            </div>
            <div>
              <Label>Percentage / CGPA</Label>
              <Input value={ed.grade} onChange={(e) => upd(ed.id, { grade: e.target.value })} />
            </div>
            <div>
              <Label>Start Year</Label>
              <Input type="number" value={ed.startYear} onChange={(e) => upd(ed.id, { startYear: e.target.value })} />
            </div>
            <div>
              <Label>End Year</Label>
              <Input type="number" value={ed.endYear} onChange={(e) => upd(ed.id, { endYear: e.target.value })} />
            </div>
          </div>
        </Card>
      ))}
      <Button variant="outline" className="w-full rounded-xl" onClick={add}>
        <Plus className="w-4 h-4 mr-1" /> Add Education
      </Button>
    </div>
  );
};

/* ==================== STEP 5 – Skills ==================== */
export const Step5Skills: React.FC<{ draft: ResumeDraft; update: any }> = ({ draft, update }) => {
  const [name, setName] = React.useState('');
  const [category, setCategory] = React.useState<'technical' | 'soft'>('technical');
  const [level, setLevel] = React.useState<'Beginner' | 'Intermediate' | 'Advanced'>('Intermediate');
  const add = () => {
    if (!name.trim()) return;
    update('skills', [...draft.skills, { id: newId(), name: name.trim(), category, level }]);
    setName('');
  };
  const del = (id: string) => update('skills', draft.skills.filter((s) => s.id !== id));
  const tech = draft.skills.filter((s) => s.category === 'technical');
  const soft = draft.skills.filter((s) => s.category === 'soft');

  return (
    <div className="space-y-5">
      <Card className="p-4 space-y-3">
        <Label>Add a skill</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} placeholder="e.g. React, Communication" />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Category</Label>
            <Select value={category} onValueChange={(v: any) => setCategory(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="technical">Technical</SelectItem>
                <SelectItem value="soft">Soft</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Level</Label>
            <Select value={level} onValueChange={(v: any) => setLevel(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['Beginner', 'Intermediate', 'Advanced'].map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={add} className="w-full rounded-xl"><Plus className="w-4 h-4 mr-1" /> Add Skill</Button>
      </Card>

      {[['Technical Skills', tech], ['Soft Skills', soft]].map(([title, list]: any) => (
        <div key={title}>
          <h3 className="text-sm font-semibold mb-2">{title}</h3>
          <div className="flex flex-wrap gap-2">
            {list.length === 0 && <span className="text-xs text-muted-foreground">None yet</span>}
            {list.map((s: any) => (
              <Badge key={s.id} variant="secondary" className="pl-3 pr-1 py-1 gap-1">
                {s.name} <span className="text-[10px] opacity-70">· {s.level}</span>
                <button onClick={() => del(s.id)} className="ml-1 hover:bg-background/50 rounded-full p-0.5">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

/* ==================== STEP 6 – Certifications ==================== */
export const Step6Certifications: React.FC<{ draft: ResumeDraft; update: any }> = ({ draft, update }) => {
  const items = draft.certifications;
  const add = () => update('certifications', [...items, { id: newId(), name: '', organization: '', issueDate: '', expiryDate: '', url: '' }]);
  const upd = (id: string, patch: any) => update('certifications', items.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const del = (id: string) => update('certifications', items.filter((x) => x.id !== id));

  return (
    <div className="space-y-4">
      {items.map((c, i) => (
        <Card key={c.id} className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm">Certification #{i + 1}</span>
            <Button variant="ghost" size="icon" onClick={() => del(c.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
          </div>
          <div><Label>Certificate Name</Label><Input value={c.name} onChange={(e) => upd(c.id, { name: e.target.value })} /></div>
          <div><Label>Issuing Organization</Label><Input value={c.organization} onChange={(e) => upd(c.id, { organization: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Issue Date</Label><Input type="month" value={c.issueDate} onChange={(e) => upd(c.id, { issueDate: e.target.value })} /></div>
            <div><Label>Expiry Date</Label><Input type="month" value={c.expiryDate} onChange={(e) => upd(c.id, { expiryDate: e.target.value })} /></div>
          </div>
          <div><Label>Certificate URL</Label><Input value={c.url} onChange={(e) => upd(c.id, { url: e.target.value })} /></div>
        </Card>
      ))}
      <Button variant="outline" className="w-full rounded-xl" onClick={add}><Plus className="w-4 h-4 mr-1" /> Add Certification</Button>
    </div>
  );
};

/* ==================== STEP 7 – Projects ==================== */
export const Step7Projects: React.FC<{ draft: ResumeDraft; update: any }> = ({ draft, update }) => {
  const items = draft.projects;
  const add = () => update('projects', [...items, { id: newId(), name: '', description: '', technologies: [], link: '' }]);
  const upd = (id: string, patch: any) => update('projects', items.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const del = (id: string) => update('projects', items.filter((x) => x.id !== id));

  return (
    <div className="space-y-4">
      {items.map((p, i) => (
        <Card key={p.id} className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm">Project #{i + 1}</span>
            <Button variant="ghost" size="icon" onClick={() => del(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
          </div>
          <div><Label>Project Name</Label><Input value={p.name} onChange={(e) => upd(p.id, { name: e.target.value })} /></div>
          <div><Label>Description</Label><Textarea rows={3} value={p.description} onChange={(e) => upd(p.id, { description: e.target.value })} /></div>
          <div>
            <Label>Technologies Used (comma separated)</Label>
            <Input
              value={p.technologies.join(', ')}
              onChange={(e) => upd(p.id, { technologies: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
              placeholder="React, Node.js, PostgreSQL"
            />
          </div>
          <div><Label>Project Link</Label><Input value={p.link} onChange={(e) => upd(p.id, { link: e.target.value })} placeholder="https://..." /></div>
        </Card>
      ))}
      <Button variant="outline" className="w-full rounded-xl" onClick={add}><Plus className="w-4 h-4 mr-1" /> Add Project</Button>
    </div>
  );
};

/* ==================== STEP 8 – Languages ==================== */
const LANG_OPTIONS = ['Hindi', 'English', 'Gujarati', 'Marathi', 'Bengali', 'Tamil', 'Telugu', 'Punjabi', 'Kannada', 'Malayalam'];
export const Step8Languages: React.FC<{ draft: ResumeDraft; update: any }> = ({ draft, update }) => {
  const items = draft.languages;
  const [custom, setCustom] = React.useState('');
  const add = (name: string) => {
    if (!name || items.some((l) => l.name.toLowerCase() === name.toLowerCase())) return;
    update('languages', [...items, { id: newId(), name, proficiency: 'Intermediate' as const }]);
  };
  const upd = (id: string, patch: any) => update('languages', items.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const del = (id: string) => update('languages', items.filter((x) => x.id !== id));

  return (
    <div className="space-y-4">
      <div>
        <Label>Quick add</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {LANG_OPTIONS.map((l) => (
            <Button key={l} type="button" size="sm" variant="outline" className="rounded-full" onClick={() => add(l)}>
              + {l}
            </Button>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Add other language" />
        <Button onClick={() => { add(custom.trim()); setCustom(''); }}>Add</Button>
      </div>
      <div className="space-y-2">
        {items.map((l) => (
          <Card key={l.id} className="p-3 flex items-center gap-3">
            <span className="font-medium flex-1">{l.name}</span>
            <Select value={l.proficiency} onValueChange={(v: any) => upd(l.id, { proficiency: v })}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['Basic', 'Intermediate', 'Fluent'].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={() => del(l.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
          </Card>
        ))}
      </div>
    </div>
  );
};

/* ==================== STEP 9 – Achievements ==================== */
export const Step9Achievements: React.FC<{ draft: ResumeDraft; update: any }> = ({ draft, update }) => (
  <div className="space-y-3">
    <Label>Awards, competitions, recognition</Label>
    <Textarea
      rows={8}
      value={draft.achievements}
      onChange={(e) => update('achievements', e.target.value)}
      placeholder="- Winner, State Level Coding Competition 2023&#10;- Employee of the Month, ABC Ltd&#10;- Best Speaker Award..."
    />
  </div>
);

/* ==================== STEP 10 – Internships ==================== */
export const Step10Internships: React.FC<{ draft: ResumeDraft; update: any }> = ({ draft, update }) => {
  const items = draft.internships;
  const add = () => update('internships', [...items, { id: newId(), company: '', role: '', duration: '', description: '' }]);
  const upd = (id: string, patch: any) => update('internships', items.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const del = (id: string) => update('internships', items.filter((x) => x.id !== id));

  return (
    <div className="space-y-4">
      {items.map((it, i) => (
        <Card key={it.id} className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm">Internship #{i + 1}</span>
            <Button variant="ghost" size="icon" onClick={() => del(it.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Company</Label><Input value={it.company} onChange={(e) => upd(it.id, { company: e.target.value })} /></div>
            <div><Label>Role</Label><Input value={it.role} onChange={(e) => upd(it.id, { role: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Duration</Label><Input value={it.duration} onChange={(e) => upd(it.id, { duration: e.target.value })} placeholder="Jun 2024 – Aug 2024" /></div>
          </div>
          <div><Label>Description</Label><Textarea rows={3} value={it.description} onChange={(e) => upd(it.id, { description: e.target.value })} /></div>
        </Card>
      ))}
      <Button variant="outline" className="w-full rounded-xl" onClick={add}><Plus className="w-4 h-4 mr-1" /> Add Internship</Button>
    </div>
  );
};

/* ==================== STEP 11 – Hobbies ==================== */
const HOBBY_OPTIONS = ['Reading', 'Sports', 'Music', 'Coding', 'Travel', 'Cooking', 'Photography', 'Writing', 'Gaming', 'Art'];
export const Step11Hobbies: React.FC<{ draft: ResumeDraft; update: any }> = ({ draft, update }) => {
  const [custom, setCustom] = React.useState('');
  const toggle = (h: string) => {
    const set = new Set(draft.hobbies);
    set.has(h) ? set.delete(h) : set.add(h);
    update('hobbies', Array.from(set));
  };
  const addCustom = () => {
    const v = custom.trim();
    if (!v || draft.hobbies.includes(v)) return;
    update('hobbies', [...draft.hobbies, v]);
    setCustom('');
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[...new Set([...HOBBY_OPTIONS, ...draft.hobbies])].map((h) => {
          const active = draft.hobbies.includes(h);
          return (
            <button
              key={h}
              type="button"
              onClick={() => toggle(h)}
              className={`px-3 py-1.5 rounded-full text-sm border transition ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:bg-muted'}`}
            >
              {h}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Add custom hobby" />
        <Button onClick={addCustom}>Add</Button>
      </div>
    </div>
  );
};

/* ==================== STEP 12 – References ==================== */
export const Step12References: React.FC<{ draft: ResumeDraft; update: any }> = ({ draft, update }) => {
  const items = draft.references;
  const add = () => update('references', [...items, { id: newId(), name: '', company: '', designation: '', phone: '', email: '' }]);
  const upd = (id: string, patch: any) => update('references', items.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const del = (id: string) => update('references', items.filter((x) => x.id !== id));

  return (
    <div className="space-y-4">
      {items.map((r, i) => (
        <Card key={r.id} className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm">Reference #{i + 1}</span>
            <Button variant="ghost" size="icon" onClick={() => del(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Name</Label><Input value={r.name} onChange={(e) => upd(r.id, { name: e.target.value })} /></div>
            <div><Label>Designation</Label><Input value={r.designation} onChange={(e) => upd(r.id, { designation: e.target.value })} /></div>
            <div><Label>Company</Label><Input value={r.company} onChange={(e) => upd(r.id, { company: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={r.phone} onChange={(e) => upd(r.id, { phone: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Email</Label><Input type="email" value={r.email} onChange={(e) => upd(r.id, { email: e.target.value })} /></div>
          </div>
        </Card>
      ))}
      <Button variant="outline" className="w-full rounded-xl" onClick={add}><Plus className="w-4 h-4 mr-1" /> Add Reference</Button>
    </div>
  );
};

/* ==================== STEP 13 – Additional ==================== */
export const Step13Additional: React.FC<{ draft: ResumeDraft; update: any }> = ({ draft, update }) => {
  const a = draft.additional;
  const set = (k: keyof typeof a, v: string) => update('additional', { ...a, [k]: v });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><Label>Date of Birth</Label><Input type="date" value={a.dob} onChange={(e) => set('dob', e.target.value)} /></div>
        <div>
          <Label>Gender</Label>
          <Select value={a.gender} onValueChange={(v) => set('gender', v)}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              {['Male', 'Female', 'Other', 'Prefer not to say'].map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Marital Status</Label>
          <Select value={a.maritalStatus} onValueChange={(v) => set('maritalStatus', v)}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              {['Single', 'Married', 'Divorced', 'Widowed'].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Nationality</Label><Input value={a.nationality} onChange={(e) => set('nationality', e.target.value)} placeholder="Indian" /></div>
      </div>
    </div>
  );
};

/* ==================== STEP 14 – Job Preferences ==================== */
const EMP_TYPES = ['Full Time', 'Part Time', 'Remote', 'Hybrid', 'Internship', 'Freelance'];
export const Step14JobPreferences: React.FC<{ draft: ResumeDraft; update: any }> = ({ draft, update }) => {
  const jp = draft.jobPreferences;
  const set = (k: keyof typeof jp, v: any) => update('jobPreferences', { ...jp, [k]: v });
  const toggleType = (t: string) => {
    const s = new Set(jp.employmentTypes);
    s.has(t) ? s.delete(t) : s.add(t);
    set('employmentTypes', Array.from(s));
  };
  return (
    <div className="space-y-4">
      <div><Label>Preferred Job Role</Label><Input value={jp.preferredRole} onChange={(e) => set('preferredRole', e.target.value)} /></div>
      <div><Label>Preferred Location</Label><Input value={jp.preferredLocation} onChange={(e) => set('preferredLocation', e.target.value)} /></div>
      <div><Label>Expected Salary</Label><Input value={jp.expectedSalary} onChange={(e) => set('expectedSalary', e.target.value)} placeholder="₹ 4,00,000 / year" /></div>
      <div>
        <Label>Employment Type</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {EMP_TYPES.map((t) => {
            const active = jp.employmentTypes.includes(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleType(t)}
                className={`px-3 py-1.5 rounded-full text-sm border transition ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:bg-muted'}`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <Label>Immediate Joining</Label>
        <div className="flex gap-2 mt-2">
          {(['yes', 'no'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => set('immediateJoining', v)}
              className={`px-4 py-1.5 rounded-full text-sm border ${jp.immediateJoining === v ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:bg-muted'}`}
            >
              {v === 'yes' ? 'Yes' : 'No'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ==================== STEP 15 – Template ==================== */
export const TEMPLATES = [
  { id: 'Professional', name: 'Professional', desc: 'Classic clean layout perfect for corporate roles' },
  { id: 'ATS Simple', name: 'ATS Simple', desc: 'ATS-friendly, plain formatting for automated screening' },
  { id: 'Modern', name: 'Modern', desc: 'Contemporary design with color accents' },
  { id: 'Minimal', name: 'Minimal', desc: 'Understated design with lots of whitespace' },
  { id: 'Executive', name: 'Executive', desc: 'Refined layout for senior leadership roles' },
  { id: 'Fresher', name: 'Fresher', desc: 'Ideal for students & first-time job seekers' },
  { id: 'Two Column', name: 'Two Column', desc: 'Sidebar layout with skills panel' },
  { id: 'One Column', name: 'One Column', desc: 'Straight top-to-bottom single column flow' },
  { id: 'Compact', name: 'Compact', desc: 'Space-efficient, fits more on one page' },
  { id: 'Creative', name: 'Creative', desc: 'Bold and unique for creative industries' },
] as const;

const SAMPLE_PHOTO_URL = sampleResumePhoto;

export const RESUME_PREVIEW_DATA = {
  personalInfo: {
    fullName: 'Ananya Sharma',
    email: 'ananya.sharma@example.com',
    phone: '+91 98765 43210',
    address: 'Mumbai, Maharashtra, India',
    linkedin: 'linkedin.com/in/ananyasharma',
    portfolio: 'ananyasharma.com',
    title: 'Senior Marketing Manager',
    website: 'ananyasharma.com',
    photoUrl: SAMPLE_PHOTO_URL,
    n: SAMPLE_PHOTO_URL,
  },
  summary:
    'Results-driven marketing professional with 6+ years of experience leading integrated campaigns, scaling digital audiences, and driving revenue growth. Skilled in team leadership, data-driven strategy, and cross-functional collaboration across product, sales, and creative teams.',
  experience: [
    {
      id: '1',
      position: 'Senior Marketing Manager',
      company: 'Bright Works Pvt Ltd',
      duration: 'Jan 2022 - Present',
      description:
        'Led a team of 8 across content, performance, and brand. Delivered a 42% YoY increase in qualified leads and tripled organic traffic in 12 months. Owned a ₹4 Cr annual budget across paid, SEO, and events.',
    },
    {
      id: '2',
      position: 'Marketing Associate',
      company: 'North Star Digital',
      duration: 'Jun 2020 - Dec 2021',
      description:
        'Ran end-to-end campaigns for 6 B2B SaaS clients. Improved paid ROAS by 3.1x through funnel restructuring and creative testing. Built weekly reporting dashboards used company-wide.',
    },
    {
      id: '3',
      position: 'Marketing Intern',
      company: 'CloudNine Media',
      duration: 'Jan 2020 - May 2020',
      description:
        'Supported content calendars, social campaigns, and community programs. Wrote 20+ blog posts that ranked on page one for target keywords.',
    },
  ],
  education: [
    {
      id: '1',
      degree: 'MBA - Marketing',
      institution: 'Symbiosis Institute of Business Management',
      year: '2018 - 2020',
      grade: 'Distinction (8.6 CGPA)',
    },
    {
      id: '2',
      degree: 'Bachelor of Commerce (Hons.)',
      institution: 'St. Xavier\u2019s College, Mumbai University',
      year: '2015 - 2018',
      grade: 'First Class with Distinction',
    },
  ],
  skills: [
    'Campaign Strategy',
    'SEO & SEM',
    'Google Analytics',
    'HubSpot',
    'Team Leadership',
    'Content Marketing',
    'Performance Marketing',
    'Data Analysis',
    'Communication',
    'Project Management',
  ],
  languages: ['English (Fluent)', 'Hindi (Native)', 'Marathi (Conversational)'],
  certifications: [
    'Google Ads Certified - Google',
    'HubSpot Inbound Marketing - HubSpot Academy',
    'Advanced Google Analytics - Google',
    'Meta Blueprint Certified - Meta',
  ],
  hobbies: ['Photography', 'Trekking', 'Reading', 'Yoga'],
  projects: [
    { id: '1', name: 'Bright Works Rebrand', description: 'Led complete brand refresh across web, product, and social - lifted brand recall by 28%.' },
    { id: '2', name: 'Growth Playbook', description: 'Authored an internal growth playbook adopted across 3 business units.' },
  ],
  achievements: [
    'Employee of the Year 2024 at Bright Works',
    'Speaker at MarTech India 2023',
    'Published in YourStory & Inc42',
  ],
};


const TemplatePreview: React.FC<{
  templateId: (typeof TEMPLATES)[number]['id'];
}> = ({ templateId }) => {
  const Comp = RESUME_TEMPLATES[templateKey(templateId)];
  return (
    <div className="pointer-events-none">
      <ScaledA4Preview>
        <Comp resumeData={RESUME_PREVIEW_DATA} />
      </ScaledA4Preview>
    </div>
  );
};


const FullPreview: React.FC<{
  templateId: (typeof TEMPLATES)[number]['id'];
  draft: ResumeDraft;
}> = ({ templateId, draft }) => {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);
  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const compute = () => {
      const w = el.clientWidth;
      setScale(Math.min(1, w / 794));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const Comp = RESUME_TEMPLATES[templateKey(templateId)];
  return (
    <div ref={wrapRef} className="w-full">
      <div style={{ height: 1123 * scale }}>
        <div
          className="bg-white shadow-lg origin-top-left"
          style={{
            width: 794,
            height: 1123,
            transform: `scale(${scale})`,
          }}
        >
          <Comp resumeData={draftToResumeData(draft)} />
        </div>
      </div>
    </div>
  );
};


export const Step15Template: React.FC<{ draft: ResumeDraft; update: any }> = ({ draft, update }) => {
  const [previewId, setPreviewId] = React.useState<(typeof TEMPLATES)[number]['id'] | null>(null);
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {TEMPLATES.map((t) => {
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
                <TemplatePreview templateId={t.id} />
              </div>
              <div className="mt-3 px-1 font-semibold text-sm">{t.name}</div>
              <div className="px-1 text-xs text-muted-foreground mt-0.5">{t.desc}</div>
              <div className="mt-3 px-1">
                <Button
                  type="button"
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

      <Dialog open={!!previewId} onOpenChange={(o) => !o && setPreviewId(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle>
              {previewId ? TEMPLATES.find((x) => x.id === previewId)?.name : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 max-h-[75vh] overflow-auto bg-muted/30">
            {previewId && <FullPreview templateId={previewId} draft={draft} />}
          </div>
          <div className="p-4 border-t flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setPreviewId(null)}>
              Close
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                if (previewId) update('template', previewId);
                setPreviewId(null);
              }}
            >
              Use This Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
