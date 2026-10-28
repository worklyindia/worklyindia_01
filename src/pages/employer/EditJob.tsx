import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Save, Eye, Loader2, RefreshCw, Trash2, ImagePlus, ExternalLink, Sparkles } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEmployerAuth } from "@/contexts/EmployerAuthContext";
import { useWakeRefetch } from "@/hooks/useWakeRefetch";
import { useLoadingTimeout } from "@/hooks/useLoadingTimeout";
import SalaryInput from "@/components/SalaryInput";
import LanguageSelector from "@/components/LanguageSelector";
import VideoInput from "@/components/VideoInput";
import SkillsSelector from "@/components/SkillsSelector";
import PublishSettings from "@/components/PublishSettings";
import RichTextEditor from "@/components/RichTextEditor";
import { JobImageUploader, JobImage } from "@/components/job/JobImageUploader";
import { ExternalApplyUrlField } from "@/components/job/ExternalApplyUrlField";
import { JOB_CATEGORIES, DEPARTMENTS } from "@/constants/categories";
import { cleanupJobImage, cleanupJobImages } from "@/utils/storageCleanup";
import { getCompanyDisplayLocation } from "@/utils/locationUtils";
import { useAIJobContentGenerator } from "@/hooks/useAIJobContentGenerator";
import AIUsageLimitModal, { AIErrorType } from "@/components/AIUsageLimitModal";
import { validateExternalApplyUrl } from "@/lib/validateExternalApplyUrl";
import AdditionalJobFields, { AdditionalJobFieldsValue, defaultAdditionalJobFields } from "@/components/job/AdditionalJobFields";

const getRichTextPlainText = (value: string) => {
  if (!value) return "";

  if (typeof document === "undefined") {
    return value.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
  }

  const container = document.createElement("div");
  container.innerHTML = value;
  return (container.textContent || container.innerText || "").replace(/\u00a0/g, " ").trim();
};

const hasRichTextContent = (value: string) => getRichTextPlainText(value).length > 0;

const isTodayOrFuture = (date: Date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selectedDate = new Date(date);
  selectedDate.setHours(0, 0, 0, 0);
  return selectedDate >= today;
};

const EditJob = () => {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const { user, company } = useEmployerAuth();
  
  // AI Content Generator Hook
  const { 
    isGenerating, 
    generateDescription, 
    generateRequirements, 
    generateBenefits, 
    generateSkills, 
    generateSalary,
    generateCategory 
  } = useAIJobContentGenerator();
  
  // AI Error Modal state
  const [aiErrorModal, setAiErrorModal] = useState<{
    isOpen: boolean;
    error: { type: AIErrorType; message: string; details?: string; remainingUsage?: number; totalLimit?: number; } | null;
  }>({ isOpen: false, error: null });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [jobStats, setJobStats] = useState<any>({});
  const [skills, setSkills] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [minSalary, setMinSalary] = useState("");
  const [maxSalary, setMaxSalary] = useState("");
  const [salaryPeriod, setSalaryPeriod] = useState("monthly");
  const [videos, setVideos] = useState<Array<{ url: string }>>([{ url: "" }]);
  const [genderPreference, setGenderPreference] = useState("both");
  const [additionalFields, setAdditionalFields] = useState<AdditionalJobFieldsValue>(defaultAdditionalJobFields);
  const [visibility, setVisibility] = useState("public");
  const [publishMode, setPublishMode] = useState("immediate");
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
  
  // Rich text editor states
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [benefits, setBenefits] = useState("");
  
  // Job images state
  const [jobImages, setJobImages] = useState<JobImage[]>([]);
  
  // External apply URL state
  const [externalApplyUrl, setExternalApplyUrl] = useState("");
  const [externalApplyUrlError, setExternalApplyUrlError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    title: "",
    department: "",
    location: "", // Combined location string
    country: "",
    state: "",
    city: "",
    precise_address: "",
    job_type: "",
    experience_level: "",
    category: "",
    status: "active"
  });

  // Check if all 5 required fields are filled for AI generation
  const isAIEnabled = !!(
    formData.title?.trim() && 
    formData.category?.trim() && 
    formData.department?.trim() && 
    formData.job_type?.trim() && 
    formData.experience_level?.trim()
  );

  const aiDisabled = !isAIEnabled || isGenerating;
  const aiDisabledReason = !isAIEnabled 
    ? "Fill Title, Category, Department, Job Type & Experience first" 
    : isGenerating 
      ? "AI is generating... please wait"
      : undefined;

  // AI Context for smart content generation (includes full company profile)
  const getAIContext = () => ({
    title: formData.title,
    department: formData.department,
    category: formData.category,
    jobType: formData.job_type,
    experienceLevel: formData.experience_level,
    location: formData.location || formData.city || "Remote",
    companyName: company?.company_name,
    industry: company?.industry,
    companyId: company?.id, // For smart learning from employer's previous jobs
    // Full company profile for better AI context
    companyDescription: company?.description,
    companySize: company?.company_size,
    companyWebsite: company?.website, // AI will use website for better context
  });

  // AI Generate handlers - auto replace existing content
  const handleAIGenerateDescription = async () => {
    if (!isAIEnabled) {
      setAiErrorModal({ 
        isOpen: true, 
        error: { type: 'missing_fields', message: 'Please fill required fields first', details: 'Fill Title, Category, Department, Job Type & Experience to enable AI' }
      });
      return;
    }
    // Auto clear existing content for fresh AI generation
    setDescription("");
    const result = await generateDescription(getAIContext());
    if (result.success && typeof result.content === 'string') {
      setDescription(result.content);
    } else if (result.error) {
      setAiErrorModal({ isOpen: true, error: result.error });
    }
  };

  const handleAIGenerateRequirements = async () => {
    if (!isAIEnabled) {
      setAiErrorModal({ 
        isOpen: true, 
        error: { type: 'missing_fields', message: 'Please fill required fields first', details: 'Fill Title, Category, Department, Job Type & Experience to enable AI' }
      });
      return;
    }
    setRequirements("");
    const result = await generateRequirements(getAIContext());
    if (result.success && typeof result.content === 'string') {
      setRequirements(result.content);
    } else if (result.error) {
      setAiErrorModal({ isOpen: true, error: result.error });
    }
  };

  const handleAIGenerateBenefits = async () => {
    if (!isAIEnabled) {
      setAiErrorModal({ 
        isOpen: true, 
        error: { type: 'missing_fields', message: 'Please fill required fields first', details: 'Fill Title, Category, Department, Job Type & Experience to enable AI' }
      });
      return;
    }
    setBenefits("");
    const result = await generateBenefits(getAIContext());
    if (result.success && typeof result.content === 'string') {
      setBenefits(result.content);
    } else if (result.error) {
      setAiErrorModal({ isOpen: true, error: result.error });
    }
  };

  const handleAIGenerateSkills = async () => {
    if (!isAIEnabled) {
      setAiErrorModal({ 
        isOpen: true, 
        error: { type: 'missing_fields', message: 'Please fill required fields first', details: 'Fill Title, Category, Department, Job Type & Experience to enable AI' }
      });
      return;
    }
    try {
      const result = await generateSkills(getAIContext());
      if (result.success && Array.isArray(result.content)) {
        // Append new AI skills to existing skills (avoid duplicates)
        const newSkills = result.content as string[];
        setSkills(prevSkills => {
          const combined = [...prevSkills, ...newSkills];
          // Remove duplicates (case-insensitive comparison)
          const uniqueSkills = combined.filter((skill, index, self) => 
            index === self.findIndex(s => s.toLowerCase().trim() === skill.toLowerCase().trim())
          );
          return uniqueSkills;
        });
      } else if (result.error) {
        setAiErrorModal({ isOpen: true, error: result.error });
      }
    } catch (error) {
      console.error('Error generating skills:', error);
      setAiErrorModal({ 
        isOpen: true, 
        error: { type: 'api_error', message: 'Failed to generate skills', details: 'Please try again.' }
      });
    }
  };

  const handleAIGenerateSalary = async () => {
    if (!isAIEnabled) {
      setAiErrorModal({ 
        isOpen: true, 
        error: { type: 'missing_fields', message: 'Please fill required fields first', details: 'Fill Title, Category, Department, Job Type & Experience to enable AI' }
      });
      return;
    }
    setMinSalary("");
    setMaxSalary("");
    const result = await generateSalary(getAIContext());
    if (result.success && result.content && typeof result.content === 'object' && !Array.isArray(result.content)) {
      const salaryData = result.content as { min: number; max: number; period?: string };
      setMinSalary(salaryData.min?.toString() || "");
      setMaxSalary(salaryData.max?.toString() || "");
      if (salaryData.period) {
        setSalaryPeriod(salaryData.period);
      }
    } else if (result.error) {
      setAiErrorModal({ isOpen: true, error: result.error });
    }
  };

  const handleAIGenerateCategory = async () => {
    if (!formData.title?.trim()) {
      setAiErrorModal({ 
        isOpen: true, 
        error: { type: 'missing_title', message: 'Please enter a job title first.', details: 'AI needs the job title to select the best category.' }
      });
      return;
    }

    const result = await generateCategory({
      ...getAIContext(),
      availableCategories: JOB_CATEGORIES,
    });

    if (result.success && typeof result.content === 'string') {
      setFormData(prev => ({ ...prev, category: result.content as string }));
    } else if (result.error) {
      setAiErrorModal({ isOpen: true, error: result.error });
    }
  };

  useEffect(() => {
    if (jobId && user && company) {
      fetchJobData();
    }
  }, [jobId, user, company]);

  // Refetch when tab wakes (mobile screen off/on) so the editor doesn't stay
  // stuck on skeleton. Safety timeout releases the loading gate as a fallback.
  useWakeRefetch(() => { if (jobId && user && company) fetchJobData(); }, !!(jobId && user && company));
  useLoadingTimeout(loading, setLoading, 8000);

  const handleRefreshLocation = async () => {
    if (!user) return;
    
    try {
      const { data: company, error } = await supabase
        .from('companies')
        .select('precise_address, city, state, country')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        toast.error("Failed to refresh location");
        return;
      }

      if (company) {
        setFormData(prev => ({
          ...prev,
          country: company.country || "",
          state: company.state || "",
          city: company.city || "",
          precise_address: company.precise_address || "",
          location: getCompanyDisplayLocation(company)
        }));
        toast.success("Location refreshed successfully");
      }
    } catch (error) {
      toast.error("Error refreshing location");
    }
  };

  // Real-time location sync from company profile
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('company-location-changes-edit')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'companies',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const newCompany = payload.new;
          setFormData(prev => ({
            ...prev,
            country: newCompany.country || "",
            state: newCompany.state || "",
            city: newCompany.city || "",
            precise_address: newCompany.precise_address || "",
            location: getCompanyDisplayLocation(newCompany)
          }));
          toast.success("Location updated from company profile");
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchJobData = async () => {
    if (!jobId) return;

    setLoading(true);
    try {
      // Fetch job data
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .eq('company_id', company?.id) // Ensure owner access
        .single();

      if (jobError) throw jobError;

      // Map job_type from database to display format (backward compatibility)
      const mapJobType = (dbType: string) => {
        switch (dbType?.toLowerCase()) {
          case 'full-time': return 'Full Time';
          case 'part-time': return 'Part Time';
          case 'contract': return 'Contract';
          case 'internship': return 'Internship';
          case 'freelance': return 'Freelance';
          default: return dbType || '';
        }
      };

      // Map department to match PostNewJob format (backward compatibility)
      const mapDepartment = (dbDept: string) => {
        switch (dbDept?.toLowerCase()) {
          case 'engineering': return 'Engineering';
          case 'product': return 'Product';
          case 'design': return 'Design';
          case 'marketing': return 'Marketing';
          case 'sales': return 'Sales';
          case 'hr': case 'human resources': return 'Human Resources';
          case 'finance': return 'Finance';
          case 'operations': return 'Operations';
          default: return dbDept || '';
        }
      };

      // Populate form with job data
      setFormData({
        title: jobData.title || "",
        department: mapDepartment(jobData.department),
        location: jobData.location || "",
        country: jobData.country || "",
        state: jobData.state || "",
        city: jobData.city || "",
        precise_address: jobData.precise_address || "",
        job_type: mapJobType(jobData.job_type),
        experience_level: jobData.experience_level || "",
        category: jobData.category || "",
        status: jobData.status || "active"
      });
      
      // Set rich text editor content
      setDescription(jobData.description || "");
      setRequirements(jobData.requirements || "");
      setBenefits(jobData.benefits || "");
      
      // Set external apply URL
      setExternalApplyUrl((jobData as any).external_apply_url || "");
      setBenefits(jobData.benefits || "");

      // Set publishing settings
      setVisibility(jobData.visibility || "public");
      setPublishMode(jobData.publish_mode || "immediate");
      if (jobData.scheduled_publish_at) {
        setScheduledDate(new Date(jobData.scheduled_publish_at));
      }

      setSkills(jobData.skills || []);
      setLanguages(jobData.languages || []);
      setGenderPreference((jobData as any).gender_preference || "both");

      // Load additional fields
      const j: any = jobData;
      setAdditionalFields({
        openings: j.openings != null ? String(j.openings) : "1",
        application_deadline: j.application_deadline ? new Date(j.application_deadline) : undefined,
        work_mode: j.work_mode || "on-site",
        education_required: j.education_required || "any",
        shift_timing: j.shift_timing || "day",
        immediate_joining: !!j.immediate_joining,
        hiring_urgency: j.hiring_urgency || "normal",
        apply_mode: j.apply_mode || "workly",
        resume_required: j.resume_required !== false,
        cover_letter_required: !!j.cover_letter_required,
        auto_email_confirmation: j.auto_email_confirmation !== false,
      });

      // Set salary fields from database
      if (jobData.salary_min && jobData.salary_max) {
        setMinSalary(jobData.salary_min.toLocaleString('en-IN'));
        setMaxSalary(jobData.salary_max.toLocaleString('en-IN'));
      }
      setSalaryPeriod(jobData.salary_period || "");

      // Set videos from database
      const videoArray: Array<{ url: string }> = [];
      if (jobData.video_url_1) {
        videoArray.push({ url: jobData.video_url_1 });
      }
      if (jobData.video_url_2) {
        videoArray.push({ url: jobData.video_url_2 });
      }
      if (videoArray.length === 0) {
        videoArray.push({ url: "" });
      }
      setVideos(videoArray);

      // Fetch job images from database
      const { data: imagesData, error: imagesError } = await supabase
        .from('job_images')
        .select('*')
        .eq('job_id', jobId)
        .order('sort_order', { ascending: true });

      if (!imagesError && imagesData) {
        const loadedImages: JobImage[] = imagesData.map((img) => ({
          id: img.id,
          url: img.image_url,
          type: img.image_type as 'uploaded' | 'ai_generated',
          sizeCategory: img.size_category as 'banner' | 'square' | 'social',
          width: img.width || undefined,
          height: img.height || undefined,
          sortOrder: img.sort_order || 0
        }));
        setJobImages(loadedImages);
      }

      // Fetch job statistics
      const { data: applicationsData } = await supabase
        .from('job_applications')
        .select('status')
        .eq('job_id', jobId);

      const shortlistedCount = applicationsData?.filter(app => app.status === 'shortlisted').length || 0;
      const interviewCount = applicationsData?.filter(app => app.status === 'interview_scheduled').length || 0;

      setJobStats({
        applications: jobData.applications_count || 0,
        views: jobData.views_count || 0,
        shortlisted: shortlistedCount,
        interviews: interviewCount
      });

    } catch (error) {
      console.error('Error fetching job:', error);
      toast.error('Failed to load job data');
      navigate('/employer-portal?tab=jobs');
    } finally {
      setLoading(false);
    }
  };

  const handleSkillsChange = (newSkills: string[]) => {
    setSkills(newSkills);
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
    if (!jobId) return;

    const urlError = validateExternalApplyUrl(externalApplyUrl);
    setExternalApplyUrlError(urlError);
    if (urlError) {
      toast.error(urlError);
      return;
    }

    console.log('Starting job update for jobId:', jobId);
    console.log('Company ID:', company?.id);
    console.log('User ID:', user?.id);

    if (!company?.id) {
      toast.error('Company data not found. Please try refreshing the page.');
      return;
    }

    setSaving(true);
    try {
      // Map job_type back to database format
      const mapJobTypeToDb = (displayType: string) => {
        switch (displayType) {
          case 'Full Time': return 'Full Time';
          case 'Part Time': return 'Part Time';
          case 'Contract': return 'Contract';
          case 'Internship': return 'Internship';
          case 'Freelance': return 'Freelance';
          default: return displayType;
        }
      };

      // Validate required fields
      if (!formData.title?.trim()) {
        toast.error('Job title is required');
        return;
      }

      if (!formData.country?.trim() || !formData.state?.trim() || !formData.city?.trim()) {
        toast.error('Please fill in Country, State, and City');
        return;
      }

      if (!formData.department?.trim()) {
        toast.error('Department is required');
        return;
      }

      if (!hasRichTextContent(description)) {
        toast.error('Job description is required');
        return;
      }
      
      if (!hasRichTextContent(requirements)) {
        toast.error('Requirements are required');
        return;
      }
      
      if (!hasRichTextContent(benefits)) {
        toast.error('Benefits & Perks are required');
        return;
      }

      if (!formData.job_type) {
        toast.error('Job type is required');
        return;
      }

      if (!formData.experience_level) {
        toast.error('Experience level is required');
        return;
      }

      if (!formData.category) {
        toast.error('Job category is required');
        return;
      }

      if (!genderPreference || !genderPreference.trim()) {
        toast.error('Gender preference is required');
        return;
      }

      if (!minSalary || !maxSalary || !salaryPeriod) {
        toast.error('Salary range is required');
        return;
      }
      
      if (skills.length === 0) {
        toast.error('At least one required skill must be selected');
        return;
      }
      
      if (languages.length === 0) {
        toast.error('At least one required language must be selected');
        return;
      }

      const openingsCount = parseInt(additionalFields.openings, 10);
      if (!additionalFields.openings || Number.isNaN(openingsCount) || openingsCount < 1) {
        toast.error('Number of vacancies is required');
        return;
      }

      if (!additionalFields.application_deadline || !isTodayOrFuture(additionalFields.application_deadline)) {
        toast.error('Application deadline is required');
        return;
      }

      if (!additionalFields.work_mode) {
        toast.error('Work mode is required');
        return;
      }

      if (!additionalFields.education_required) {
        toast.error('Education required is required');
        return;
      }

      if (!additionalFields.shift_timing) {
        toast.error('Shift timing is required');
        return;
      }

      if (!additionalFields.hiring_urgency) {
        toast.error('Hiring urgency is required');
        return;
      }

      if (!additionalFields.apply_mode) {
        toast.error('Apply mode is required');
        return;
      }

      if ((additionalFields.apply_mode === "external" || additionalFields.apply_mode === "both") && !externalApplyUrl.trim()) {
        toast.error('External apply URL is required');
        return;
      }

      // Create salary range string from individual values
      const salaryRange = minSalary && maxSalary && salaryPeriod
        ? (salaryPeriod === 'commission'
            ? `${minSalary}% - ${maxSalary}% commission`
            : `₹${minSalary} - ₹${maxSalary} ${salaryPeriod}`)
        : "";

      // Parse salary values safely
      let salaryMinValue = null;
      let salaryMaxValue = null;
      
      if (minSalary) {
        const parsed = parseInt(minSalary.replace(/,/g, ''));
        if (!isNaN(parsed)) salaryMinValue = parsed;
      }
      
      if (maxSalary) {
        const parsed = parseInt(maxSalary.replace(/,/g, ''));
        if (!isNaN(parsed)) salaryMaxValue = parsed;
      }

      // Prepare update data (exclude location)
      const updateData = {
        title: formData.title.trim(),
        department: formData.department || null,
        job_type: mapJobTypeToDb(formData.job_type),
        experience_level: formData.experience_level,
        category: formData.category,
        salary_range: salaryRange || null,
        salary_min: salaryMinValue,
        salary_max: salaryMaxValue,
        salary_period: salaryPeriod || null,
        description: description.trim(),
        requirements: requirements.trim(),
        benefits: benefits.trim(),
        skills: skills.length > 0 ? skills : null,
        languages: languages.length > 0 ? languages : null,
        video_title_1: null,
        video_url_1: videos[0]?.url?.trim() || null,
        video_title_2: null,
        video_url_2: videos[1]?.url?.trim() || null,
        visibility: visibility,
        publish_mode: publishMode,
        scheduled_publish_at: publishMode === 'schedule' && scheduledDate ? scheduledDate.toISOString() : null,
        status: formData.status,
        updated_at: new Date().toISOString(),
        external_apply_url: externalApplyUrl.trim() || null,
        gender_preference: genderPreference,
        openings: additionalFields.openings ? parseInt(additionalFields.openings, 10) || 1 : 1,
        application_deadline: additionalFields.application_deadline ? additionalFields.application_deadline.toISOString() : null,
        work_mode: additionalFields.work_mode,
        education_required: additionalFields.education_required,
        shift_timing: additionalFields.shift_timing,
        immediate_joining: additionalFields.immediate_joining,
        hiring_urgency: additionalFields.hiring_urgency,
        apply_mode: additionalFields.apply_mode,
        resume_required: additionalFields.resume_required,
        cover_letter_required: additionalFields.cover_letter_required,
        auto_email_confirmation: additionalFields.auto_email_confirmation
      };

      console.log('Update data:', updateData);

      const { error } = await supabase
        .from('jobs')
        .update(updateData)
        .eq('id', jobId)
        .eq('company_id', company?.id);

      if (error) {
        console.error('Supabase update error:', error);
        throw error;
      }

      // Handle job images - cleanup removed images from storage, then update DB
      if (user && jobId) {
        // Fetch existing images from DB to compare
        const { data: existingImages } = await supabase
          .from('job_images')
          .select('image_url')
          .eq('job_id', jobId);

        // Find URLs that are being removed (exist in DB but not in new jobImages)
        const newUrls = new Set(jobImages.map(img => img.url));
        const removedUrls = (existingImages || [])
          .map(img => img.image_url)
          .filter(url => url && !newUrls.has(url));

        // Delete removed images from storage
        if (removedUrls.length > 0) {
          console.log('🗑️ Cleaning up removed images from storage:', removedUrls.length);
          await cleanupJobImages(removedUrls);
        }

        // Delete existing DB records
        const { error: deleteImagesError } = await supabase
          .from('job_images')
          .delete()
          .eq('job_id', jobId);

        if (deleteImagesError) {
          console.error('Error deleting existing images:', deleteImagesError);
        }

        // Insert new/updated images
        if (jobImages.length > 0) {
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
      }

      console.log('Job updated successfully');
      toast.success("Job updated successfully!");
      navigate("/employer-portal?tab=jobs");
    } catch (error: any) {
      console.error('Error updating job:', error);
      
      if (error.message?.includes('row-level security')) {
        toast.error('Permission denied. You can only update your own jobs.');
      } else if (error.message?.includes('violates check constraint')) {
        toast.error('Invalid data provided. Please check all fields.');
      } else {
        toast.error(error.message || 'Failed to update job. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const [deleting, setDeleting] = useState(false);

  const handleDeleteJob = async () => {
    setDeleting(true);
    try {
      // Clean up job images from storage before deleting
      if (jobId) {
        const { data: jobImagesData } = await supabase
          .from('job_images')
          .select('image_url')
          .eq('job_id', jobId);

        if (jobImagesData && jobImagesData.length > 0) {
          console.log('🗑️ Cleaning up job images from storage:', jobImagesData.length);
          await cleanupJobImages(jobImagesData.map(img => img.image_url));
        }
      }

      // Delete from Telegram channel first (if posted there)
      try {
        await supabase.functions.invoke('email-api/telegram', { body: { action: 'channel-delete', job_id: jobId }
        });
      } catch (tgErr) {
        console.warn('Telegram channel delete skipped:', tgErr);
      }

      // Hard delete - triggers URL_DELETED in indexing queue via database trigger
      const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', jobId)
        .eq('company_id', company?.id);

      if (error) throw error;
      
      toast.success(`"${formData.title}" deleted permanently from Google & Bing`);
      navigate('/employer-portal?tab=jobs');
    } catch (error) {
      console.error('Error deleting job:', error);
      toast.error('Failed to delete job');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-background flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-slate-600">Loading job data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Enhanced Header */}
      <header className="bg-white/95 backdrop-blur-sm border-b border-border/50 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/employer-portal?tab=jobs")}
              className="text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-lg transition-all duration-200 flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Back to Jobs</span>
              <span className="sm:hidden">Back</span>
            </Button>
            
            <div className="flex-1 text-center px-4 min-w-0">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent truncate">
                Edit Job
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 hidden sm:block truncate">
                Update your job posting details
              </p>
            </div>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.open(`/job/${jobId}`, '_blank')}
              className="flex-shrink-0"
            >
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Job Status Card */}
          <Card className="p-6 shadow-lg border-0 bg-white/95 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Job Status</h3>
                <p className="text-muted-foreground">Control the visibility of this job posting</p>
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-sm text-muted-foreground">
                  {formData.status === 'active' ? "Active" : "Inactive"}
                </span>
                <Switch 
                  checked={formData.status === 'active'} 
                  onCheckedChange={(checked) => setFormData(prev => ({...prev, status: checked ? 'active' : 'inactive'}))} 
                />
              </div>
            </div>
          </Card>

          {/* Job Details Form */}
          <Card className="p-6 sm:p-8 shadow-lg border-0 bg-white/95 backdrop-blur-sm">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Job Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Job Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  placeholder="e.g. Senior Frontend Developer"
                  maxLength={30}
                  required
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground text-right">
                  {formData.title.length}/30 characters
                </p>
              </div>

              {/* Department */}
              <div className="space-y-2">
                 <Label htmlFor="department">Department *</Label>
                 <Select value={formData.department} onValueChange={(value) => setFormData({...formData, department: value})} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Category */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="category">Job Category *</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleAIGenerateCategory}
                    disabled={isGenerating || !formData.title?.trim()}
                    title="Select category with AI"
                    className="h-8 w-8"
                  >
                    {isGenerating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-primary" />}
                  </Button>
                </div>
                <Select value={formData.category} onValueChange={(value) => setFormData({...formData, category: value})} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    {JOB_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Job Type and Experience */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="type">Job Type *</Label>
                  <Select value={formData.job_type} onValueChange={(value) => setFormData({...formData, job_type: value})} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Full Time">Full Time</SelectItem>
                      <SelectItem value="Contract">Contract</SelectItem>
                      <SelectItem value="Internship">Internship</SelectItem>
                      <SelectItem value="Freelance">Freelance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="experience">Experience *</Label>
                  <Select value={formData.experience_level} onValueChange={(value) => setFormData({...formData, experience_level: value})} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select experience" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0-1">0-1 years</SelectItem>
                      <SelectItem value="1-3">1-3 years</SelectItem>
                      <SelectItem value="3-5">3-5 years</SelectItem>
                      <SelectItem value="5-8">5-8 years</SelectItem>
                      <SelectItem value="8+">8+ years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Gender Preference <span className="text-foreground font-semibold">*</span></Label>
                  <Select value={genderPreference} onValueChange={setGenderPreference}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="both">Both (Male & Female)</SelectItem>
                      <SelectItem value="male">Male Only</SelectItem>
                      <SelectItem value="female">Female Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <SalaryInput
                    minSalary={minSalary}
                    maxSalary={maxSalary}
                    period={salaryPeriod}
                    onMinSalaryChange={setMinSalary}
                    onMaxSalaryChange={setMaxSalary}
                    onPeriodChange={setSalaryPeriod}
                    onAIGenerate={handleAIGenerateSalary}
                    aiDisabled={aiDisabled}
                    aiDisabledReason={aiDisabledReason}
                  />
                </div>
              </div>

              {/* Job Description */}
              <RichTextEditor
                id="description"
                label="Job Description"
                value={description}
                onChange={setDescription}
                placeholder="Describe the role, responsibilities, and what the job involves... Use formatting to make it professional!"
                required
                onAIGenerate={handleAIGenerateDescription}
                aiTooltip="Generate description with AI (learns from similar jobs)"
                aiDisabled={aiDisabled}
                aiDisabledReason={aiDisabledReason}
              />

              {/* Requirements */}
              <RichTextEditor
                id="requirements"
                label="Requirements"
                value={requirements}
                onChange={setRequirements}
                placeholder="List the qualifications, experience, and skills required... Format with colors and styles!"
                required
                onAIGenerate={handleAIGenerateRequirements}
                aiTooltip="Generate requirements with AI"
                aiDisabled={aiDisabled}
                aiDisabledReason={aiDisabledReason}
              />

              {/* Skills & Languages */}
              <div className="space-y-6">
                <SkillsSelector
                  selectedSkills={skills}
                  onSkillsChange={handleSkillsChange}
                  required
                  onAIGenerate={handleAIGenerateSkills}
                  aiDisabled={aiDisabled}
                  aiDisabledReason={aiDisabledReason}
                />
                
                <LanguageSelector
                  selectedLanguages={languages}
                  onLanguageToggle={handleLanguageToggle}
                />
              </div>

              {/* Benefits */}
              <RichTextEditor
                id="benefits"
                label="Benefits & Perks"
                value={benefits}
                onChange={setBenefits}
                placeholder="Health insurance, flexible hours, Workly India, performance bonuses... Make it attractive with formatting!"
                required
                onAIGenerate={handleAIGenerateBenefits}
                aiTooltip="Generate benefits with AI"
                aiDisabled={aiDisabled}
                aiDisabledReason={aiDisabledReason}
              />

              {/* Job Images Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <ImagePlus className="w-5 h-5 text-primary" />
                  <Label className="text-base font-semibold">Images</Label>
                  <Badge variant="outline" className="text-xs">Optional</Badge>
                  <Badge variant="secondary" className="text-xs">{jobImages.length}/10</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Add images to make your job posting more attractive. Images are kept in original HD quality.
                </p>
                <JobImageUploader
                  jobId={jobId}
                  images={jobImages}
                  onImagesChange={setJobImages}
                  maxImages={10}
                  disabled={saving}
                  jobContext={{
                    title: formData.title,
                    category: formData.category,
                    jobType: formData.job_type,
                    companyName: company?.company_name
                  }}
                />
              </div>

              {/* Job Videos */}
              <VideoInput
                videos={videos}
                onVideoChange={handleVideoChange}
                onRemoveVideo={handleRemoveVideo}
              />

              {/* Additional Job Details */}
              <AdditionalJobFields
                value={additionalFields}
                onChange={(patch) => setAdditionalFields((prev) => ({ ...prev, ...patch }))}
              />

              {/* External Apply URL - only when apply_mode requires it */}
              {(additionalFields.apply_mode === "external" || additionalFields.apply_mode === "both") && (
                <ExternalApplyUrlField
                  value={externalApplyUrl}
                  onChange={(v) => {
                    setExternalApplyUrl(v);
                    setExternalApplyUrlError(validateExternalApplyUrl(v));
                  }}
                  error={externalApplyUrlError}
                  applyMode={additionalFields.apply_mode}
                />
              )}


              <Separator className="my-8" />

              {/* Publishing Settings */}
              <PublishSettings
                visibility={visibility}
                onVisibilityChange={setVisibility}
                publishMode={publishMode}
                onPublishModeChange={setPublishMode}
                scheduledDate={scheduledDate}
                onScheduledDateChange={setScheduledDate}
                jobTitle={formData.title}
                companyName={company?.company_name || ""}
                location={formData.location}
              />

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-6">
                <Button 
                  type="submit"
                  disabled={saving} 
                  className="flex-1 sm:flex-none bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Update Job
                    </>
                  )}
                </Button>
                
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate("/employer-portal?tab=jobs")}
                  className="flex-1 sm:flex-none"
                  disabled={saving}
                >
                  Cancel
                </Button>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="destructive"
                      className="flex-1 sm:flex-none"
                      disabled={saving || deleting}
                    >
                      {deleting ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4 mr-2" />
                      )}
                      Delete Job
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Job Permanently?</AlertDialogTitle>
                      <AlertDialogDescription className="space-y-3">
                        <p>Are you sure you want to delete <strong>"{formData.title}"</strong>?</p>
                        <div className="bg-muted p-3 rounded-md text-sm space-y-1">
                          <p>This will:</p>
                          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                            <li>Remove job from website immediately</li>
                            <li>Delete from Google search index</li>
                            <li>Delete from Bing search index</li>
                          </ul>
                        </div>
                        <p className="text-destructive font-medium">This action cannot be undone.</p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteJob}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        Delete Permanently
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </form>
          </Card>

          {/* Job Statistics */}
          <Card className="p-6 shadow-lg border-0 bg-white/95 backdrop-blur-sm">
            <h3 className="text-lg font-semibold text-foreground mb-4">Job Performance</h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{jobStats.applications}</p>
                <p className="text-sm text-muted-foreground">Applications</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{jobStats.views}</p>
                <p className="text-sm text-muted-foreground">Views</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{jobStats.shortlisted}</p>
                <p className="text-sm text-muted-foreground">Shortlisted</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">{jobStats.interviews}</p>
                <p className="text-sm text-muted-foreground">Interviews</p>
              </div>
            </div>
          </Card>
        </div>
      </main>
      
      {/* AI Usage Limit Error Modal */}
      <AIUsageLimitModal
        isOpen={aiErrorModal.isOpen}
        onClose={() => setAiErrorModal({ isOpen: false, error: null })}
        error={aiErrorModal.error}
      />
    </div>
  );
};

export default EditJob;