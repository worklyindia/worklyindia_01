import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare, Video, Users, Clock, CheckCircle, Play, Target, Lightbulb,
  Building2, Copy, ChevronLeft, ChevronRight, Eye, Shuffle, Briefcase, Code,
} from "lucide-react";

const interviewTypes = [
  { type: "Phone Interview", icon: MessageSquare, description: "First round screening call with HR", duration: "15-30 mins",
    tips: ["Sit in a quiet place with good network", "Keep your resume and job description in front of you", "Speak clearly, smile while talking", "Note the interviewer's name"] },
  { type: "Video Interview", icon: Video, description: "Online meeting on Google Meet, Zoom or Teams", duration: "30-60 mins",
    tips: ["Test camera, mic and internet 30 mins before", "Use good light facing you and a clean background", "Look at the camera, not the screen", "Dress fully formal"] },
  { type: "In-Person Interview", icon: Building2, description: "Face-to-face meeting at the office", duration: "30-90 mins",
    tips: ["Reach 10-15 mins early", "Carry 2 printed resumes, ID and certificates", "Firm handshake and good eye contact", "Be polite with every staff member"] },
  { type: "Panel Interview", icon: Users, description: "Several interviewers together", duration: "45-90 mins",
    tips: ["Look at everyone while answering", "Address the person who asked first", "Ask for clarification if needed", "Thank every panel member"] },
  { type: "Technical Interview", icon: Code, description: "Test of job skills, coding or practical task", duration: "45-120 mins",
    tips: ["Think out loud while solving", "Ask about requirements before starting", "Revise basics of your field", "It's fine to say what you don't know"] },
  { type: "HR Interview", icon: Briefcase, description: "Salary, notice period and culture fit", duration: "15-30 mins",
    tips: ["Research the salary range for the role", "Be honest about notice period", "Ask about growth and benefits", "Stay positive about past employers"] },
];

const commonQuestions = [
  { question: "Tell me about yourself", category: "Introduction", difficulty: "Easy", tip: "Give a 60-90 second summary: education, experience, key skills and why this role." },
  { question: "Why do you want this job?", category: "Motivation", difficulty: "Easy", tip: "Connect your skills and goals to the company and role." },
  { question: "Why should we hire you?", category: "Motivation", difficulty: "Medium", tip: "Mention 2-3 strengths that match the job, with a real example." },
  { question: "What are your strengths?", category: "Self-awareness", difficulty: "Easy", tip: "Pick strengths relevant to the job and prove each with an example." },
  { question: "What's your greatest weakness?", category: "Self-awareness", difficulty: "Medium", tip: "Choose a real weakness and show how you are improving it." },
  { question: "Describe a challenging situation you faced", category: "Experience", difficulty: "Medium", tip: "Use the STAR method: Situation, Task, Action, Result." },
  { question: "Why are you leaving your current job?", category: "Experience", difficulty: "Medium", tip: "Stay positive — talk about growth and learning, never complain." },
  { question: "Where do you see yourself in 5 years?", category: "Goals", difficulty: "Medium", tip: "Show ambition that fits the company's growth path." },
  { question: "What are your salary expectations?", category: "HR", difficulty: "Hard", tip: "Give a researched range and say you are flexible for the right role." },
  { question: "Tell me about a time you failed", category: "Experience", difficulty: "Hard", tip: "Own the mistake briefly, focus on what you learned and changed." },
  { question: "How do you handle pressure or deadlines?", category: "Work style", difficulty: "Medium", tip: "Explain your method (planning, priorities) with a real example." },
  { question: "Do you have any questions for us?", category: "Closing", difficulty: "Easy", tip: "Always ask 1-2: team, growth, first 90 days, next steps." },
];

const preparationSteps = [
  { step: "Research the Company", description: "Read their website, products, recent news and reviews", timeframe: "2 days before" },
  { step: "Study the Job Description", description: "Match your skills and experience with each requirement", timeframe: "2 days before" },
  { step: "Prepare Your Stories", description: "Keep 3-4 STAR examples ready for common questions", timeframe: "1 day before" },
  { step: "Practice Common Questions", description: "Say answers aloud — don't memorise word-for-word", timeframe: "1 day before" },
  { step: "Keep Documents Ready", description: "Resume copies, ID, certificates, photos and a pen", timeframe: "1 day before" },
  { step: "Choose Your Outfit", description: "Clean, ironed, formal clothes and polished shoes", timeframe: "Night before" },
  { step: "Plan Your Route / Setup", description: "Know the route, or test your video call setup", timeframe: "Day of interview" },
  { step: "Prepare Your Questions", description: "Write 2-3 smart questions to ask the interviewer", timeframe: "Day of interview" },
];

const emailTemplate = `Dear [Interviewer's Name],

Thank you for taking the time to meet with me today to discuss the [Position Title] role. I enjoyed our conversation about [specific topic discussed] and am excited about the opportunity to contribute to [Company Name].

Please let me know if you need any additional information from me. I look forward to hearing about the next steps.

Best regards,
[Your Name]
[Phone Number]`;

const CHECKLIST_KEY = "interview_prep_checklist";

const InterviewTips = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [order, setOrder] = useState<number[]>(commonQuestions.map((_, i) => i));
  const [current, setCurrent] = useState(0);
  const [showTip, setShowTip] = useState(false);
  const [done, setDone] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem(CHECKLIST_KEY) || "[]"); } catch { return []; }
  });

  useEffect(() => { localStorage.setItem(CHECKLIST_KEY, JSON.stringify(done)); }, [done]);

  const toggleStep = (i: number) => setDone((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]));

  const startPractice = () => { setCurrent(0); setShowTip(false); setPracticeOpen(true); };
  const shuffle = () => { setOrder([...order].sort(() => Math.random() - 0.5)); setCurrent(0); setShowTip(false); };
  const go = (dir: number) => { setCurrent((c) => (c + dir + order.length) % order.length); setShowTip(false); };

  const copyTemplate = async () => {
    try {
      await navigator.clipboard.writeText(emailTemplate);
      toast({ title: "Copied", description: "Email template copied. Fill in the brackets and send." });
    } catch {
      toast({ title: "Copy failed", description: "Please select the text and copy it manually.", variant: "destructive" });
    }
  };

  const q = commonQuestions[order[current]];

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Interview Tips" />

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 pb-8 max-w-4xl">
        <Tabs defaultValue="types" className="w-full" onValueChange={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <TabsList className="sticky top-14 z-30 shadow-sm grid w-full grid-cols-4 h-12 p-1 bg-muted gap-1 mb-4">
            <TabsTrigger value="types" className="text-xs sm:text-sm px-1 rounded-lg">Types</TabsTrigger>
            <TabsTrigger value="questions" className="text-xs sm:text-sm px-1 rounded-lg">Questions</TabsTrigger>
            <TabsTrigger value="preparation" className="text-xs sm:text-sm px-1 rounded-lg">Prepare</TabsTrigger>
            <TabsTrigger value="follow-up" className="text-xs sm:text-sm px-1 rounded-lg">Follow-up</TabsTrigger>
          </TabsList>

          <TabsContent value="types" className="space-y-3">
            {interviewTypes.map((t) => (
              <Card key={t.type} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 shrink-0 bg-primary/10 rounded-lg flex items-center justify-center">
                    <t.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                      <h3 className="font-semibold text-foreground">{t.type}</h3>
                      <span className="flex items-center text-xs text-muted-foreground"><Clock className="w-3 h-3 mr-1" />{t.duration}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{t.description}</p>
                    <ul className="space-y-1">
                      {t.tips.map((tip) => (
                        <li key={tip} className="flex items-start text-sm text-muted-foreground">
                          <CheckCircle className="w-4 h-4 text-primary mr-2 mt-0.5 shrink-0" />{tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="questions" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-foreground">Common Questions</h2>
              <Button onClick={startPractice} size="sm" className="rounded-xl">
                <Play className="w-4 h-4 mr-1" />Practice Mode
              </Button>
            </div>
            {commonQuestions.map((item) => (
              <Card key={item.question} className="p-4 space-y-2">
                <h3 className="font-semibold text-foreground">{item.question}</h3>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{item.category}</Badge>
                  <Badge variant={item.difficulty === "Easy" ? "default" : item.difficulty === "Hard" ? "destructive" : "outline"}>{item.difficulty}</Badge>
                </div>
                <div className="flex items-start gap-2">
                  <Lightbulb className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground">{item.tip}</p>
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="preparation" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-foreground">Preparation Checklist</h2>
              <Badge variant="outline">{done.length}/{preparationSteps.length} done</Badge>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${(done.length / preparationSteps.length) * 100}%` }} />
            </div>
            {preparationSteps.map((s, i) => (
              <Card key={s.step} className="p-4 cursor-pointer" onClick={() => toggleStep(i)}>
                <div className="flex items-start gap-3">
                  <Checkbox checked={done.includes(i)} onCheckedChange={() => toggleStep(i)} onClick={(e) => e.stopPropagation()} className="mt-1" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                      <h3 className={`font-semibold ${done.includes(i) ? "text-muted-foreground line-through" : "text-foreground"}`}>{s.step}</h3>
                      <Badge variant="outline" className="text-xs">{s.timeframe}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{s.description}</p>
                  </div>
                </div>
              </Card>
            ))}
            {done.length > 0 && (
              <Button variant="ghost" size="sm" className="w-full" onClick={() => setDone([])}>Reset checklist</Button>
            )}
            <Card className="p-4 bg-primary/5 border-primary/20">
              <div className="flex items-start gap-3">
                <Target className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Pro Tip</h3>
                  <p className="text-sm text-muted-foreground">Use the STAR method (Situation, Task, Action, Result) for behaviour questions to give clear, strong answers.</p>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="follow-up" className="space-y-3">
            <Card className="p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="font-semibold text-foreground">Thank You Email Template</h3>
                <Button size="sm" variant="outline" onClick={copyTemplate}><Copy className="w-4 h-4 mr-1" />Copy</Button>
              </div>
              <pre className="bg-muted p-3 rounded-lg text-sm text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">{emailTemplate}</pre>
            </Card>
            <Card className="p-4">
              <h3 className="font-semibold text-foreground mb-3">Follow-up Timeline</h3>
              <div className="space-y-3">
                {[["Send thank you email", "Within 24 hours"], ["First follow-up if no response", "After 1 week"], ["Final follow-up", "After 2 weeks"]].map(([a, b], i) => (
                  <div key={a} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-foreground">{a}</span>
                    <Badge variant={i === 0 ? "default" : "outline"} className="shrink-0">{b}</Badge>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-4 bg-primary/5 border-primary/20 text-center space-y-3">
              <p className="text-sm text-foreground font-medium">Ready for your next interview?</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button size="sm" onClick={() => navigate("/jobs")}>Find Jobs</Button>
                <Button size="sm" variant="outline" onClick={() => navigate("/activity")}>My Applications</Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={practiceOpen} onOpenChange={setPracticeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Practice Mode</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Question {current + 1} of {order.length}</span>
              <Badge variant="secondary">{q.category}</Badge>
            </div>
            <p className="text-lg font-semibold text-foreground min-h-[3.5rem]">{q.question}</p>
            <p className="text-sm text-muted-foreground">Answer out loud, then check the tip.</p>
            {showTip ? (
              <div className="flex items-start gap-2 p-3 bg-primary/5 rounded-lg">
                <Lightbulb className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <p className="text-sm text-foreground">{q.tip}</p>
              </div>
            ) : (
              <Button variant="outline" className="w-full" onClick={() => setShowTip(true)}><Eye className="w-4 h-4 mr-2" />Show Tip</Button>
            )}
            <div className="flex items-center justify-between gap-2">
              <Button variant="ghost" size="icon" onClick={() => go(-1)} aria-label="Previous"><ChevronLeft className="w-5 h-5" /></Button>
              <Button variant="ghost" size="sm" onClick={shuffle}><Shuffle className="w-4 h-4 mr-1" />Shuffle</Button>
              <Button variant="ghost" size="icon" onClick={() => go(1)} aria-label="Next"><ChevronRight className="w-5 h-5" /></Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InterviewTips;
