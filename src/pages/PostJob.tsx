import Header from "@/components/Header";
import BottomNavigation from "@/components/BottomNavigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import SalaryInput from "@/components/SalaryInput";
import LanguageSelector from "@/components/LanguageSelector";
import VideoInput from "@/components/VideoInput";
import PublishSettings from "@/components/PublishSettings";
import RichTextEditor from "@/components/RichTextEditor";
import { JobImageUploader, JobImage } from "@/components/job/JobImageUploader";
import { ExternalApplyUrlField } from "@/components/job/ExternalApplyUrlField";

import { 
  Briefcase, 
  MapPin, 
  DollarSign, 
  Clock, 
  Users, 
  Building,
  Plus,
  X,
  ImagePlus
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getCompanyDisplayLocation } from "@/utils/locationUtils";
import { useEmployerSettings } from "@/hooks/useEmployerSettings";
import { useNavigate } from "react-router-dom";
import { triggerTelegramEvent } from "@/hooks/useTelegramTrigger";
import { UnifiedNotificationService } from "@/services/UnifiedNotificationService";
import { validateExternalApplyUrl } from "@/lib/validateExternalApplyUrl";

const PostJob = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { settings: employerSettings, isLoading: settingsLoading } = useEmployerSettings();
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [minSalary, setMinSalary] = useState("");
  const [maxSalary, setMaxSalary] = useState("");
  const [salaryPeriod, setSalaryPeriod] = useState("monthly");
  const [videos, setVideos] = useState<Array<{ url: string }>>([{ url: "" }]);
  const [companyLocation, setCompanyLocation] = useState("");
  const [loading, setLoading] = useState(true);
  
  // Form state for jobContext (for AI Image Generator)
  const [jobTitle, setJobTitle] = useState("");
  const [jobType, setJobType] = useState("");
  const [department, setDepartment] = useState("");
  const [companyName, setCompanyName] = useState("");
  
  // Publishing settings
  const [visibility, setVisibility] = useState("public");
  const [publishMode, setPublishMode] = useState("now");
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
  
  // Rich text editor states
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [benefits, setBenefits] = useState("");
  
  // Job images state
  const [jobImages, setJobImages] = useState<JobImage[]>([]);

  // External apply URL (optional)
  const [externalApplyUrl, setExternalApplyUrl] = useState("");
  const [externalApplyUrlError, setExternalApplyUrlError] = useState<string | null>(null);

  // Check job posting visibility and fetch company data
  useEffect(() => {
    if (!settingsLoading && employerSettings && !employerSettings.job_posting_visibility) {
      toast.error("Job posting has been temporarily paused by admin. Redirecting to employer portal...");
      navigate("/employer-portal");
      return;
    }

    const fetchCompanyData = async () => {
      if (!user) return;
      
      try {
        const { data: company, error } = await supabase
          .from('companies')
          .select('company_name, precise_address, district, city, state, postal_code, country, location, latitude, longitude, ban_type, job_posting_visibility, account_status')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error('Error fetching company:', error);
        } else if (company) {
            const displayLocation = getCompanyDisplayLocation(company);
            setCompanyLocation(displayLocation || 'Please update your company profile with location details');
            setCompanyName(company.company_name || '');
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCompanyData();
  }, [user, settingsLoading, employerSettings, navigate]);

  const addSkill = () => {
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      setSkills([...skills, newSkill.trim()]);
      setNewSkill("");
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setSkills(skills.filter(skill => skill !== skillToRemove));
  };

  const handleLanguageToggle = (language: string) => {
    setLanguages(prev => 
      prev.includes(language) 
        ? prev.filter(l => l !== language)
        : [...prev, language]
    );
  };

  const handleVideoChange = (index: number, field: 'url', value: string) => {
    setVideos(prev => {
      const newVideos = [...prev];
      if (index >= newVideos.length) {
        newVideos.push({ url: "" });
      }
      newVideos[index] = { ...newVideos[index], [field]: value };
      return newVideos;
    });
  };

  const handleRemoveVideo = (index: number) => {
    setVideos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const urlError = validateExternalApplyUrl(externalApplyUrl);
    setExternalApplyUrlError(urlError);
    if (urlError) {
      toast.error(urlError);
      return;
    }
    
    if (!employerSettings?.job_posting_visibility) {
      toast.error("Job posting has been temporarily paused by admin. Please contact support for assistance.");
      return;
    }
    
    if (!user) {
      toast.error("Please log in to post a job");
      return;
    }

    // Get company info to check ban status before proceeding
    const { data: companyCheck, error: companyCheckError } = await supabase
      .from('companies')
      .select('ban_type, job_posting_visibility, account_status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (companyCheckError) {
      toast.error("Failed to verify company status. Please try again.");
      return;
    }

    if (companyCheck?.ban_type === 'job_posting' || companyCheck?.job_posting_visibility === false) {
      toast.error("Job posting privileges are paused by admin. You cannot post new jobs. Contact support for assistance.");
      return;
    }

    if (companyCheck?.account_status === 'banned') {
      toast.error("Your account is banned. You cannot post jobs. Please contact support.");
      navigate("/employer-disabled");
      return;
    }

    if (!companyLocation || companyLocation === 'Location not set in company profile') {
      toast.error("Please complete your company location in Company Profile before posting jobs");
      navigate("/Employer/Setup");
      return;
    }

    setLoading(true);
    
    try {
      // Get company info with coordinates
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('id, latitude, longitude, precise_address')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (companyError || !company) {
        toast.error("Company profile not found. Please complete your profile.");
        return;
      }

      // Get form data
      const form = e.target as HTMLFormElement;
      const formData = new FormData(form);
      
      // Create salary range string from individual values
      const salaryRange = minSalary && maxSalary && salaryPeriod 
        ? `₹${minSalary} - ₹${maxSalary} ${salaryPeriod}` 
        : "";

      // Generate slug for unlisted jobs
      let publicSlug = null;
      if (visibility === 'unlisted') {
        const { data: slugData } = await supabase.rpc('generate_job_slug');
        publicSlug = slugData;
      }

      // Determine job status and publish settings
      let jobStatus = 'active';
      let publishedAt = new Date().toISOString();
      if (publishMode === 'schedule' && scheduledDate) {
        jobStatus = 'scheduled';
        publishedAt = null;
      }

      // Prepare job data with coordinates
      const jobData = {
        company_id: company.id,
        title: formData.get('jobTitle') as string,
        department: formData.get('department') as string || null,
        location: companyLocation,
        job_type: formData.get('jobType') as string,
        experience_level: formData.get('experience') as string,
        salary_range: salaryRange,
        salary_min: minSalary ? parseInt(minSalary.replace(/,/g, '')) : null,
        salary_max: maxSalary ? parseInt(maxSalary.replace(/,/g, '')) : null,
        salary_period: salaryPeriod || null,
        description: formData.get('description') as string,
        requirements: formData.get('requirements') as string || null,
        benefits: formData.get('benefits') as string || null,
        category: formData.get('department') as string || 'Other',
        skills: skills.length > 0 ? skills : null,
        languages: languages.length > 0 ? languages : null,
        video_title_1: null,
        video_url_1: videos[0]?.url || null,
        video_title_2: null,
        video_url_2: videos[1]?.url || null,
        status: jobStatus,
        visibility: visibility,
        publish_mode: publishMode,
        scheduled_publish_at: publishMode === 'schedule' ? scheduledDate?.toISOString() : null,
        published_at: publishedAt,
        public_slug: publicSlug,
        // Save job location coordinates from company
        latitude: company.latitude || null,
        longitude: company.longitude || null,
        precise_address: company.precise_address || null,
        external_apply_url: externalApplyUrl.trim() || null
      };

      // Create the job directly (payments, if required, are handled via Razorpay elsewhere)
      const { data: createdJob, error: jobInsertError } = await supabase
        .from('jobs')
        .insert(jobData)
        .select()
        .maybeSingle();

      if (jobInsertError || !createdJob) {
        console.error('❌ Job creation error:', jobInsertError);
        toast.error(jobInsertError?.message || "Failed to post job");
        return;
      }

      const jobId = createdJob.id;

      // Save job images if any
      if (jobImages.length > 0 && jobId) {
        console.log('📷 Saving job images:', jobImages.length);
        for (const [index, image] of jobImages.entries()) {
          const { error: imageError } = await supabase
            .from('job_images')
            .insert({
              job_id: jobId,
              user_id: user.id,
              image_url: image.url,
              image_type: image.type,
              size_category: image.sizeCategory,
              width: image.width,
              height: image.height,
              sort_order: index
            });
          
          if (imageError) {
            console.error('❌ Error saving image:', imageError);
          }
        }
        console.log('✅ Job images saved successfully');
      }

      // Send notifications for job posted via all channels (OneSignal + WhatsApp + Telegram)
      const { data: companyData } = await supabase
        .from('companies')
        .select('company_name')
        .eq('id', company.id)
        .single();
      
      const companyName = companyData?.company_name || 'Your Company';
      const jobTitle = formData.get('jobTitle') as string;
      
      // Use UnifiedNotificationService for multi-channel notifications
      try {
        await UnifiedNotificationService.notifyJobPosted(user.id, companyName, jobTitle);
        console.log('📱 Multi-channel notification sent for: job_posted');
        
        // Post job to Telegram channel for public visibility
        if (visibility === 'public' && jobId) {
          await UnifiedNotificationService.postJobToTelegramChannel({
            job_id: jobId,
            title: jobTitle,
            company_name: companyName,
            location: companyLocation,
            job_type: formData.get('jobType') as string,
            salary_min: minSalary ? parseInt(minSalary.replace(/,/g, '')) : undefined,
            salary_max: maxSalary ? parseInt(maxSalary.replace(/,/g, '')) : undefined,
            public_slug: publicSlug || undefined
          });
          console.log('📢 Job posted to Telegram channel');
        }
      } catch (notifError) {
        console.error('Failed to send job posted notification:', notifError);
      }

      // Reset form
      form.reset();
      setSkills([]);
      setLanguages([]);
      setMinSalary("");
      setMaxSalary("");
      setSalaryPeriod("");
      setVideos([{ url: "" }]);
      setVisibility("public");
      setPublishMode("now");
      setScheduledDate(undefined);
      setDescription("");
      setRequirements("");
      setBenefits("");
      setJobImages([]);
      setExternalApplyUrl("");
      setExternalApplyUrlError(null);
      
    } catch (error) {
      console.error('Error posting job:', error);
      toast.error("Failed to post job. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header hideSearch />
      
      <main className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 pb-24 md:pb-8 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <Briefcase className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Post a New Job</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Basic Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="jobTitle">Job Title *</Label>
                <Input 
                  id="jobTitle" 
                  name="jobTitle"
                  placeholder="e.g. Senior React Developer"
                  className="rounded-xl"
                  required
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Select name="department" value={department} onValueChange={setDepartment}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="engineering">Engineering</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="sales">Sales</SelectItem>
                    <SelectItem value="hr">Human Resources</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                    <SelectItem value="operations">Operations</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="jobType">Job Type *</Label>
                <Select name="jobType" required value={jobType} onValueChange={setJobType}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select job type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full-time">Full-time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="freelance">Freelance</SelectItem>
                    <SelectItem value="internship">Internship</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="experience">Experience Level</Label>
                <Select name="experience">
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select experience level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entry">Entry Level (0-1 years)</SelectItem>
                    <SelectItem value="junior">Junior (1-3 years)</SelectItem>
                    <SelectItem value="mid">Mid Level (3-5 years)</SelectItem>
                    <SelectItem value="senior">Senior (5-8 years)</SelectItem>
                    <SelectItem value="lead">Lead/Expert (8+ years)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {/* Location & Salary */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Location & Compensation</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="location">Work Location *</Label>
                <div className="flex space-x-2">
                  <Select>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Select location type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="remote">Remote</SelectItem>
                      <SelectItem value="onsite">On-site</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input 
                    placeholder="Location from company profile"
                    value={companyLocation}
                    className="rounded-xl bg-muted cursor-not-allowed"
                    disabled
                    title="Location is automatically set from your company profile"
                  />
                </div>
                 <p className="text-sm text-muted-foreground">
                   {companyLocation && companyLocation !== 'Location not set in company profile' ? (
                     <span>📍 Location is automatically set from your company profile</span>
                   ) : (
                     <span className="text-amber-600">
                       ⚠️ Please complete your company location in Company Profile to continue
                     </span>
                   )}
                 </p>
              </div>
              <SalaryInput
                minSalary={minSalary}
                maxSalary={maxSalary}
                period={salaryPeriod}
                onMinSalaryChange={setMinSalary}
                onMaxSalaryChange={setMaxSalary}
                onPeriodChange={setSalaryPeriod}
              />
            </div>
          </Card>

          {/* Job Description */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Job Details</h2>
            <div className="space-y-4">
              <RichTextEditor
                id="description"
                label="Job Description"
                value={description}
                onChange={setDescription}
                placeholder="Provide a detailed description of the job role, responsibilities, and what you're looking for... Use formatting to make it professional!"
                required
              />
              <input type="hidden" name="description" value={description} />
              
              <RichTextEditor
                id="requirements"
                label="Requirements"
                value={requirements}
                onChange={setRequirements}
                placeholder="List the key requirements, qualifications, and skills needed... Format with bullet points and styles!"
              />
              <input type="hidden" name="requirements" value={requirements} />
              
              <RichTextEditor
                id="benefits"
                label="Benefits & Perks"
                value={benefits}
                onChange={setBenefits}
                placeholder="Describe the benefits, perks, and what makes your company great... Make it attractive!"
              />
              <input type="hidden" name="benefits" value={benefits} />
            </div>
          </Card>

          {/* Skills & Qualifications */}
          <Card className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 border-l-4 border-l-blue-400">
            <div className="flex items-center mb-4">
              <span className="text-lg">🎯</span>
              <h2 className="text-lg font-semibold text-blue-800 ml-2">Skills & Languages</h2>
            </div>
            <div className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label className="text-base font-semibold">Required Skills *</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Add the key skills required for this position. This helps candidates understand job requirements better.
                  </p>
                </div>
                <div className="flex space-x-2">
                  <Input 
                    placeholder="Add a skill (e.g. React, Node.js, Python, Communication)"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                    className="rounded-xl"
                  />
                  <Button type="button" onClick={addSkill} className="rounded-xl">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {skills.length > 0 && (
                  <div className="bg-white p-4 rounded-lg">
                    <p className="text-sm font-medium text-foreground mb-2">Added Skills ({skills.length}):</p>
                    <div className="flex flex-wrap gap-2">
                      {skills.map((skill, index) => (
                        <Badge key={index} variant="secondary" className="px-3 py-1 bg-blue-100 text-blue-800">
                          {skill}
                          <button
                            type="button"
                            onClick={() => removeSkill(skill)}
                            className="ml-2 hover:text-destructive"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <LanguageSelector
                selectedLanguages={languages}
                onLanguageToggle={handleLanguageToggle}
              />
            </div>
          </Card>

          {/* Job Images Section */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <ImagePlus className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Images</h2>
              <Badge variant="outline" className="text-xs">Optional</Badge>
              <Badge variant="secondary" className="text-xs">{jobImages.length}/10</Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Add images to make your job posting more attractive. Images are kept in original HD quality.
            </p>
            <JobImageUploader
              images={jobImages}
              onImagesChange={setJobImages}
              maxImages={10}
              disabled={loading}
              jobContext={{
                title: jobTitle,
                category: department,
                jobType: jobType,
                companyName: companyName
              }}
            />
          </Card>

          {/* Job Videos */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Job Videos</h2>
            <VideoInput
              videos={videos}
              onVideoChange={handleVideoChange}
              onRemoveVideo={handleRemoveVideo}
            />
          </Card>

          {/* Application Settings */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Application Settings</h2>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox id="requireResume" />
                <Label htmlFor="requireResume">Require resume/CV upload</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="requireCoverLetter" />
                <Label htmlFor="requireCoverLetter">Require cover letter</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="enableQuestions" />
                <Label htmlFor="enableQuestions">Add screening questions</Label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="applicationDeadline">Application Deadline</Label>
                  <Input 
                    id="applicationDeadline"
                    type="date"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxApplications">Max Applications</Label>
                  <Input 
                    id="maxApplications"
                    type="number"
                    placeholder="Leave empty for unlimited"
                    className="rounded-xl"
                  />
                </div>
              </div>

              <ExternalApplyUrlField
                value={externalApplyUrl}
                onChange={(v) => {
                  setExternalApplyUrl(v);
                  setExternalApplyUrlError(validateExternalApplyUrl(v));
                }}
                error={externalApplyUrlError}
              />
            </div>
          </Card>

          {/* Publish Settings */}
          <PublishSettings
            visibility={visibility}
            onVisibilityChange={setVisibility}
            publishMode={publishMode}
            onPublishModeChange={setPublishMode}
            scheduledDate={scheduledDate}
            onScheduledDateChange={setScheduledDate}
          />


          {/* Action Buttons */}
          <div className="flex space-x-4">
            <Button 
              type="submit" 
              className="flex-1 rounded-xl"
              disabled={
                loading || 
                (publishMode === 'schedule' && (!scheduledDate || scheduledDate < new Date()))
              }
            >
              <Briefcase className="w-4 h-4 mr-2" />
              {loading ? 'Processing...' : publishMode === 'schedule' ? 'Schedule Job' : 'Publish Job'}
            </Button>
            <Button type="button" variant="outline" className="flex-1 rounded-xl">
              Save as Draft
            </Button>
          </div>
        </form>
      </main>

      <BottomNavigation />
    </div>
  );
};

export default PostJob;