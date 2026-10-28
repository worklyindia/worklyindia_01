import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Header from "@/components/Header";
import BottomNavigation from "@/components/BottomNavigation";
import { RESUME_TEMPLATES, TemplateType } from "@/components/resume/ResumeTemplates";
import TemplateSelector from "@/components/resume/TemplateSelector";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useResumeData } from "@/hooks/useResumeData";
import { generateShareableLink } from "@/utils/pdfGenerator";
import { downloadDocument, printPlainText, type DocFormat } from "@/lib/documentDownload";
import { BRAND_CONFIG } from "@/config/brandConfig";
import { 
  FileText, 
  Download, 
  Save, 
  Share2, 
  Eye, 
  Plus, 
  X,
  User,
  Briefcase,
  GraduationCap,
  Award,
  Languages,
  Palette,
  ArrowLeft,
  Loader2,
  Printer,
  FileDown,
  Trash2
} from "lucide-react";

interface Experience {
  id: string;
  position: string;
  company: string;
  duration: string;
  description: string;
}

interface Education {
  id: string;
  degree: string;
  institution: string;
  year: string;
  grade: string;
}

const ResumeEditor = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const templateName = searchParams.get("template") || "Professional";
  
  const { resumeData, setResumeData, isInitialized } = useResumeData();
  const [showPreview, setShowPreview] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('professional');
  const [isDownloading, setIsDownloading] = useState(false);
  const [newSkill, setNewSkill] = useState("");
  const [newLanguage, setNewLanguage] = useState("");
  const [newCertification, setNewCertification] = useState("");

  const resolveTemplateName = (t: string): string => {
    const map: Record<string, string> = {
      professional: 'Professional',
      creative: 'Creative',
      minimalist: 'Minimal',
      minimal: 'Minimal',
      modern: 'Modern',
      executive: 'Executive',
      fresher: 'Fresher',
      compact: 'Compact',
      'ats simple': 'ATS Simple',
      'two column': 'Two Column',
      'one column': 'One Column',
    };
    return map[t.toLowerCase()] || t;
  };

  const handleExport = async (format: DocFormat | 'print') => {
    const templateName = resolveTemplateName(selectedTemplate);
    const filename = `${resumeData.personalInfo.fullName || 'Resume'}-${templateName}`.replace(/\s+/g, '_');

    if (format === 'print') {
      printPlainText(filename, '', { kind: 'resume', template: templateName, data: resumeData });
      return;
    }

    setIsDownloading(true);
    try {
      toast({
        title: `Generating ${format.toUpperCase()}`,
        description: 'Rendering your resume from the live preview…',
      });
      await downloadDocument({
        kind: 'resume',
        format,
        template: templateName,
        data: resumeData,
        filename,
      });
      toast({
        title: `${format.toUpperCase()} Downloaded!`,
        description: `Your ${templateName} resume has been downloaded.`,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: 'Download Failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadPDF = () => handleExport('pdf');


  const handleSave = () => {
    localStorage.setItem('resumeData', JSON.stringify(resumeData));
    toast({
      title: "Resume Saved!",
      description: "Your resume has been saved successfully.",
    });
  };

  const handleShare = () => {
    const shareLink = generateShareableLink({ ...resumeData, template: selectedTemplate });
    navigator.clipboard.writeText(shareLink);
    toast({
      title: "Share Link Copied!",
      description: `Your ${selectedTemplate} resume link has been copied to clipboard.`,
    });
  };

  const updatePersonalInfo = (field: string, value: string) => {
    setResumeData(prev => ({
      ...prev,
      personalInfo: {
        ...prev.personalInfo,
        [field]: value
      }
    }));
  };

  const addExperience = () => {
    const newExperience: Experience = {
      id: Date.now().toString(),
      position: "New Position",
      company: "Company Name",
      duration: "Start Date - End Date",
      description: "Describe your responsibilities and achievements..."
    };
    setResumeData(prev => ({
      ...prev,
      experience: [...prev.experience, newExperience]
    }));
  };

  const updateExperience = (id: string, field: string, value: string) => {
    setResumeData(prev => ({
      ...prev,
      experience: prev.experience.map(exp => 
        exp.id === id ? { ...exp, [field]: value } : exp
      )
    }));
  };

  const removeExperience = (id: string) => {
    setResumeData(prev => ({
      ...prev,
      experience: prev.experience.filter(exp => exp.id !== id)
    }));
  };

  const addEducation = () => {
    const newEducation: Education = {
      id: Date.now().toString(),
      degree: "Degree Name",
      institution: "Institution Name",
      year: "Year",
      grade: "Grade"
    };
    setResumeData(prev => ({
      ...prev,
      education: [...prev.education, newEducation]
    }));
  };

  const updateEducation = (id: string, field: string, value: string) => {
    setResumeData(prev => ({
      ...prev,
      education: prev.education.map(edu => 
        edu.id === id ? { ...edu, [field]: value } : edu
      )
    }));
  };

  const removeEducation = (id: string) => {
    setResumeData(prev => ({
      ...prev,
      education: prev.education.filter(edu => edu.id !== id)
    }));
  };

  const addSkill = () => {
    if (newSkill.trim()) {
      setResumeData(prev => ({
        ...prev,
        skills: [...prev.skills, newSkill.trim()]
      }));
      setNewSkill("");
    }
  };

  const removeSkill = (index: number) => {
    setResumeData(prev => ({
      ...prev,
      skills: prev.skills.filter((_, i) => i !== index)
    }));
  };

  const addLanguage = () => {
    if (newLanguage.trim()) {
      setResumeData(prev => ({
        ...prev,
        languages: [...prev.languages, newLanguage.trim()]
      }));
      setNewLanguage("");
    }
  };

  const removeLanguage = (index: number) => {
    setResumeData(prev => ({
      ...prev,
      languages: prev.languages.filter((_, i) => i !== index)
    }));
  };

  const addCertification = () => {
    if (newCertification.trim()) {
      setResumeData(prev => ({
        ...prev,
        certifications: [...prev.certifications, newCertification.trim()]
      }));
      setNewCertification("");
    }
  };

  const removeCertification = (index: number) => {
    setResumeData(prev => ({
      ...prev,
      certifications: prev.certifications.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="min-h-screen bg-background">
      <Header hideSearch />
      
      <main className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 pb-24 md:pb-8 max-w-7xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div className="flex items-center space-x-3">
            <FileText className="w-6 h-6 text-primary" />
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">{BRAND_CONFIG.name} Resume Builder</h1>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowPreview(true)}
              className="rounded-xl flex-1 sm:flex-none"
            >
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </Button>
            <Button 
              variant="outline" 
              onClick={handleSave}
              className="rounded-xl hidden sm:flex"
            >
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
            <Button 
              variant="outline" 
              onClick={handleShare}
              className="rounded-xl hidden sm:flex"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExport('docx')}
              disabled={isDownloading}
              className="rounded-xl hidden sm:flex"
            >
              <FileDown className="w-4 h-4 mr-2" />
              DOCX
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExport('print')}
              disabled={isDownloading}
              className="rounded-xl hidden sm:flex"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            <Button 
              onClick={handleDownloadPDF}
              disabled={isDownloading}
              className="rounded-xl flex-1 sm:flex-none bg-primary hover:bg-primary/90"
            >
              {isDownloading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Download PDF
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Editor Panel */}
          <div className="space-y-6">
            <Tabs defaultValue="template" className="w-full">
              <TabsList className="flex w-full overflow-x-auto no-scrollbar bg-muted p-1 rounded-lg">
                <TabsTrigger value="template" className="flex-shrink-0 px-3 py-2">
                  <Palette className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Template</span>
                </TabsTrigger>
                <TabsTrigger value="personal" className="flex-shrink-0 px-3 py-2">
                  <User className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Personal</span>
                </TabsTrigger>
                <TabsTrigger value="experience" className="flex-shrink-0 px-3 py-2">
                  <Briefcase className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Experience</span>
                </TabsTrigger>
                <TabsTrigger value="education" className="flex-shrink-0 px-3 py-2">
                  <GraduationCap className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Education</span>
                </TabsTrigger>
                <TabsTrigger value="skills" className="flex-shrink-0 px-3 py-2">Skills</TabsTrigger>
                <TabsTrigger value="languages" className="flex-shrink-0 px-3 py-2">
                  <Languages className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Languages</span>
                </TabsTrigger>
                <TabsTrigger value="certifications" className="flex-shrink-0 px-3 py-2">
                  <Award className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Certs</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="template">
                <Card className="p-6">
                  <TemplateSelector
                    selectedTemplate={selectedTemplate}
                    onTemplateChange={setSelectedTemplate}
                  />
                </Card>
              </TabsContent>

              <TabsContent value="personal">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Personal Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1 block">Full Name</label>
                      <Input
                        value={resumeData.personalInfo.fullName}
                        onChange={(e) => updatePersonalInfo("fullName", e.target.value)}
                        placeholder="Your Full Name"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1 block">Professional Title</label>
                      <Input
                        value={resumeData.personalInfo.title || ""}
                        onChange={(e) => updatePersonalInfo("title", e.target.value)}
                        placeholder="e.g., Software Developer"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1 block">Email</label>
                      <Input
                        value={resumeData.personalInfo.email}
                        onChange={(e) => updatePersonalInfo("email", e.target.value)}
                        placeholder="your.email@example.com"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1 block">Phone</label>
                      <Input
                        value={resumeData.personalInfo.phone}
                        onChange={(e) => updatePersonalInfo("phone", e.target.value)}
                        placeholder="+91 9876543210"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1 block">Address</label>
                      <Input
                        value={resumeData.personalInfo.address}
                        onChange={(e) => updatePersonalInfo("address", e.target.value)}
                        placeholder="City, State, Country"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1 block">Website</label>
                      <Input
                        value={resumeData.personalInfo.website || ""}
                        onChange={(e) => updatePersonalInfo("website", e.target.value)}
                        placeholder="yourportfolio.com"
                      />
                    </div>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="experience">
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-foreground">Work Experience</h3>
                    <Button size="sm" onClick={addExperience} className="rounded-xl">
                      <Plus className="w-4 h-4 mr-1" />
                      Add Experience
                    </Button>
                  </div>
                  <div className="space-y-4">
                    {resumeData.experience.map((exp, index) => (
                      <div key={exp.id} className="border rounded-lg p-4 bg-card">
                        <div className="flex items-center justify-between mb-3">
                          <Badge variant="outline">Experience #{index + 1}</Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => removeExperience(exp.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <Input
                            placeholder="Position Title"
                            value={exp.position}
                            onChange={(e) => updateExperience(exp.id, "position", e.target.value)}
                          />
                          <Input
                            placeholder="Company Name"
                            value={exp.company}
                            onChange={(e) => updateExperience(exp.id, "company", e.target.value)}
                          />
                          <Input
                            placeholder="Duration (e.g., Jan 2020 - Present)"
                            value={exp.duration}
                            onChange={(e) => updateExperience(exp.id, "duration", e.target.value)}
                          />
                        </div>
                        <Textarea
                          placeholder="Describe your responsibilities and achievements..."
                          value={exp.description}
                          onChange={(e) => updateExperience(exp.id, "description", e.target.value)}
                          className="mt-3"
                          rows={3}
                        />
                      </div>
                    ))}
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="education">
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-foreground">Education</h3>
                    <Button size="sm" onClick={addEducation} className="rounded-xl">
                      <Plus className="w-4 h-4 mr-1" />
                      Add Education
                    </Button>
                  </div>
                  <div className="space-y-4">
                    {resumeData.education.map((edu, index) => (
                      <div key={edu.id} className="border rounded-lg p-4 bg-card">
                        <div className="flex items-center justify-between mb-3">
                          <Badge variant="outline">Education #{index + 1}</Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => removeEducation(edu.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <Input
                            placeholder="Degree/Course"
                            value={edu.degree}
                            onChange={(e) => updateEducation(edu.id, "degree", e.target.value)}
                          />
                          <Input
                            placeholder="Institution Name"
                            value={edu.institution}
                            onChange={(e) => updateEducation(edu.id, "institution", e.target.value)}
                          />
                          <Input
                            placeholder="Year"
                            value={edu.year}
                            onChange={(e) => updateEducation(edu.id, "year", e.target.value)}
                          />
                          <Input
                            placeholder="Grade/CGPA"
                            value={edu.grade}
                            onChange={(e) => updateEducation(edu.id, "grade", e.target.value)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="skills">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Technical Skills</h3>
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add a skill..."
                        value={newSkill}
                        onChange={(e) => setNewSkill(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addSkill()}
                      />
                      <Button onClick={addSkill} className="rounded-xl">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {resumeData.skills.map((skill, index) => (
                        <Badge key={index} variant="secondary" className="flex items-center gap-1">
                          {skill}
                          <X 
                            className="w-3 h-3 cursor-pointer" 
                            onClick={() => removeSkill(index)}
                          />
                        </Badge>
                      ))}
                    </div>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="languages">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Languages</h3>
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add a language..."
                        value={newLanguage}
                        onChange={(e) => setNewLanguage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addLanguage()}
                      />
                      <Button onClick={addLanguage} className="rounded-xl">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {resumeData.languages.map((language, index) => (
                        <Badge key={index} variant="secondary" className="flex items-center gap-1">
                          {language}
                          <X 
                            className="w-3 h-3 cursor-pointer" 
                            onClick={() => removeLanguage(index)}
                          />
                        </Badge>
                      ))}
                    </div>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="certifications">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Certifications</h3>
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add a certification..."
                        value={newCertification}
                        onChange={(e) => setNewCertification(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addCertification()}
                      />
                      <Button onClick={addCertification} className="rounded-xl">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {resumeData.certifications.map((cert, index) => (
                        <div key={index} className="flex items-center justify-between bg-muted p-2 rounded-lg">
                          <span className="text-sm">{cert}</span>
                          <X 
                            className="w-4 h-4 cursor-pointer text-muted-foreground hover:text-foreground" 
                            onClick={() => removeCertification(index)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

        </div>

        {/* Full Screen Preview Dialog */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="w-[95vw] h-[95vh] max-w-4xl p-2 sm:p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Resume Preview - {selectedTemplate.charAt(0).toUpperCase() + selectedTemplate.slice(1)} Template
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto bg-muted/20 p-2 sm:p-4 rounded-lg">
              <div className="w-full max-w-[210mm] mx-auto bg-white shadow-large rounded-lg">
                {React.createElement(RESUME_TEMPLATES[selectedTemplate], { resumeData })}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Summary Section */}
        <Card className="p-6 mt-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Professional Summary</h3>
          <Textarea
            value={resumeData.summary}
            onChange={(e) => setResumeData(prev => ({ ...prev, summary: e.target.value }))}
            rows={4}
            placeholder="Write a brief professional summary highlighting your key skills and experience..."
          />
        </Card>
      </main>

      <BottomNavigation />
    </div>
  );
};

export default ResumeEditor;