import { useState, useEffect } from "react";
import { payWithRazorpay } from "@/lib/razorpayJobPayment";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Plus, X, CheckCircle, RefreshCw, ImagePlus, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import SalaryInput from "@/components/SalaryInput";
import LanguageSelector from "@/components/LanguageSelector";
import VideoInput from "@/components/VideoInput";
import SkillsSelector from "@/components/SkillsSelector";
import SocialMediaIcons from "@/components/SocialMediaIcons";
import { getCompanyDisplayLocation } from "@/utils/locationUtils";
import PublishSettings from "@/components/PublishSettings";
import { useEmployerSettings } from "@/hooks/useEmployerSettings";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PaymentPageHeader } from "@/components/PaymentPageHeader";
import { JOB_CATEGORIES, DEPARTMENTS } from "@/constants/categories";
import RichTextEditor from "@/components/RichTextEditor";
import { JobImageUploader, JobImage } from "@/components/job/JobImageUploader";
import { useFormPersistence } from "@/hooks/useFormPersistence";
import { useAIJobContentGenerator } from "@/hooks/useAIJobContentGenerator";
import AIUsageLimitModal, { AIErrorType } from "@/components/AIUsageLimitModal";
import { useAIUsageStatus } from "@/hooks/useAIUsageStatus";
import { ExternalApplyUrlField } from "@/components/job/ExternalApplyUrlField";
import { validateExternalApplyUrl } from "@/lib/validateExternalApplyUrl";
import AdditionalJobFields, { AdditionalJobFieldsValue, defaultAdditionalJobFields } from "@/components/job/AdditionalJobFields";
import { packagePrice, visiblePackages } from '@/lib/jobPostingPackages';

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

const PostNewJob = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings: employerSettings, isLoading: settingsLoading } = useEmployerSettings();
  const { isGenerating, generateDescription, generateRequirements, generateBenefits, generateSkills, generateSalary, generateCategory } = useAIJobContentGenerator();
  
  // AI Usage Status - for showing remaining credits on buttons
  const aiUsageStatus = useAIUsageStatus();
  
  // AI Error Modal state
  const [aiErrorModal, setAiErrorModal] = useState<{
    isOpen: boolean;
    error: { type: AIErrorType; message: string; details?: string; remainingUsage?: number; totalLimit?: number; } | null;
  }>({ isOpen: false, error: null });
  
  const [skills, setSkills] = useState<string[]>([]);
  const [currentSkill, setCurrentSkill] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [minSalary, setMinSalary] = useState("");
  const [maxSalary, setMaxSalary] = useState("");
  const [salaryPeriod, setSalaryPeriod] = useState("monthly");
  const [videos, setVideos] = useState<Array<{ url: string }>>([{ url: "" }]);
  const [externalApplyUrl, setExternalApplyUrl] = useState("");
  const [externalApplyUrlError, setExternalApplyUrlError] = useState<string | null>(null);
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  // Rich text editor states
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [benefits, setBenefits] = useState("");

  // Job images state
  const [jobImages, setJobImages] = useState<JobImage[]>([]);
  
  const [genderPreference, setGenderPreference] = useState("both");
  const [additionalFields, setAdditionalFields] = useState<AdditionalJobFieldsValue>(defaultAdditionalJobFields);
  const [formData, setFormData] = useState({
    title: "",
    department: "",
    location: "",
    country: "",
    state: "",
    city: "",
    precise_address: "",
    job_type: "",
    experience_level: "",
    category: ""
  });

  
  // Duration selection
  const [selectedDuration, setSelectedDuration] = useState(1);
  const [durationPackages, setDurationPackages] = useState<Array<{months: number; points: number; price?: number; is_default?: boolean}>>([
    { months: 1, points: 50, is_default: true },
    { months: 2, points: 100 },
    { months: 3, points: 150 },
    { months: 6, points: 300 },
    { months: 12, points: 600 }
  ]);

  // Publishing settings state
  const [visibility, setVisibility] = useState("public");
  const [publishMode, setPublishMode] = useState("now");
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
  
  // Confirmation dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Form state persistence
  const formState = {
    formData,
    description,
    requirements,
    benefits,
    jobImages,
    skills,
    languages,
    minSalary,
    maxSalary,
    salaryPeriod,
    videos,
    externalApplyUrl,
    visibility,
    publishMode,
    selectedDuration,
    scheduledDate: scheduledDate?.toISOString()
  };

  const { clearSavedState } = useFormPersistence(
    'post-new-job-form',
    formState,
    (savedState) => {
      if (savedState.formData) setFormData(savedState.formData);
      if (savedState.description) setDescription(savedState.description);
      if (savedState.requirements) setRequirements(savedState.requirements);
      if (savedState.benefits) setBenefits(savedState.benefits);
      if (savedState.jobImages) setJobImages(savedState.jobImages);
      if (savedState.skills) setSkills(savedState.skills);
      if (savedState.languages) setLanguages(savedState.languages);
      if (savedState.minSalary) setMinSalary(savedState.minSalary);
      if (savedState.maxSalary) setMaxSalary(savedState.maxSalary);
      if (savedState.salaryPeriod) setSalaryPeriod(savedState.salaryPeriod);
      if (savedState.videos) setVideos(savedState.videos);
      if (typeof savedState.externalApplyUrl === 'string') setExternalApplyUrl(savedState.externalApplyUrl);
      if (savedState.visibility) setVisibility(savedState.visibility);
      if (savedState.publishMode) setPublishMode(savedState.publishMode);
      if (savedState.selectedDuration) setSelectedDuration(savedState.selectedDuration);
      if (savedState.scheduledDate) setScheduledDate(new Date(savedState.scheduledDate));
    },
    true
  );
  

  useEffect(() => {
    // Don't redirect during initial load - only show warning
    if (!settingsLoading && employerSettings && !employerSettings.job_posting_visibility) {
      toast.error("Job posting has been temporarily paused by admin.");
      // Don't auto-redirect to preserve user's current page on refresh
      return;
    }
    
    if (user) {
      fetchCompany();
      fetchJobPostingSettings();
    }
  }, [user, settingsLoading, employerSettings]);

  // Real-time location sync from company profile
  useEffect(() => {
    if (!user || !company) return;

    const channel = supabase
      .channel('company-location-changes')
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
  }, [user, company]);

  const fetchCompany = async () => {
    if (!user) return;

    try {
      console.log('🏢 Fetching company for user:', user.id);
      setLoading(true);
      
      // Use direct table query with safe fetching to handle duplicates
      const { data: company, error } = await supabase
        .from('companies')
        .select('id, company_name, industry, description, company_size, precise_address, district, city, state, postal_code, country, location, latitude, longitude, is_profile_complete, account_status, ban_type, job_posting_ban_reason, job_posting_visibility')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      console.log('📊 Company fetch result:', { company, error });

      if (error) {
        console.error('❌ Error fetching company:', error);
        toast.error("Error loading company profile: " + error.message);
        navigate("/Employer/Setup");
        return;
      }

      if (company) {        
        // Check if profile is complete
        if (!company.is_profile_complete) {
          console.log('⚠️ Company profile incomplete');
          toast.error("Please complete your company profile first");
          navigate("/Employer/Setup");
          return;
        }
        
        // Check account status
        if (company.account_status !== 'active') {
          console.log('⚠️ Company account not active:', company.account_status);
          toast.error(`Your company account is ${company.account_status}. Contact support if needed.`);
          navigate("/employer-disabled");
          return;
        }

        console.log('✅ Company loaded successfully:', company);
        setCompany(company);
        
        // Set location fields from company profile (read-only, auto-sync)
        setFormData(prev => ({ 
          ...prev, 
          country: company.country || "",
          state: company.state || "",
          city: company.city || "",
          precise_address: company.precise_address || "",
          location: getCompanyDisplayLocation(company)
        }));
      } else {
        console.log('⚠️ No company profile found');
        toast.error("Company profile not found. Please create your company profile first");
        navigate("/Employer/Setup");
      }
    } catch (error: any) {
      console.error('💥 Unexpected error:', error);
      toast.error("An unexpected error occurred while loading company profile");
      navigate("/Employer/Setup");
    } finally {
      setLoading(false);
    }
  };

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

  const fetchJobPostingSettings = async () => {
    try {
      console.log('🔄 Fetching job posting settings...');
      const { data, error } = await supabase
        .from('job_posting_settings')
        .select('duration_packages, points_required_per_job')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      console.log('📊 Fetched settings data:', data);
      console.log('❌ Fetch error (if any):', error);
      
      if (data?.duration_packages && Array.isArray(data.duration_packages)) {
        console.log('✅ Using duration packages from database:', data.duration_packages);
        const packages = visiblePackages<{months: number; points: number; price?: number; is_default?: boolean}>(data.duration_packages);
        setDurationPackages(packages);
        
        // Set default selected duration based on package marked as default
        const defaultPackage = packages.find(pkg => pkg.is_default);
        if (defaultPackage) {
          console.log('🎯 Setting default duration to:', defaultPackage.months);
          setSelectedDuration(defaultPackage.months);
        }
      } else if (data?.points_required_per_job) {
        // Fallback to calculating packages based on base cost
        const basePoints = data.points_required_per_job;
        console.log('⚠️ Using fallback packages with base points:', basePoints);
        setDurationPackages([
          { months: 1, points: basePoints, is_default: true },
          { months: 2, points: basePoints * 2 },
          { months: 3, points: basePoints * 3 },
          { months: 6, points: basePoints * 6 },
          { months: 12, points: basePoints * 12 }
        ]);
      } else {
        console.log('⚠️ No settings found, using default packages');
        setDurationPackages([
          { months: 1, points: 50, is_default: true },
          { months: 2, points: 100 },
          { months: 3, points: 150 },
          { months: 6, points: 300 },
          { months: 12, points: 600 }
        ]);
      }
    } catch (error) {
      console.error('❌ Failed to fetch job posting settings:', error);
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

  // Check if all 5 required fields are filled for AI generation
  const isAIEnabled = !!(
    formData.title?.trim() && 
    formData.category?.trim() && 
    formData.department?.trim() && 
    formData.job_type?.trim() && 
    formData.experience_level?.trim()
  );

  const aiDisabled = !isAIEnabled || isGenerating || aiUsageStatus.isLimitReached;
  const aiDisabledReason = !isAIEnabled 
    ? "Fill Title, Category, Department, Job Type & Experience first" 
    : isGenerating 
      ? "AI is generating... please wait"
      : aiUsageStatus.isLimitReached
        ? "AI limit reached - Upgrade your plan"
        : undefined;
  
  // Pass to components
  const aiRemainingCredits = aiUsageStatus.remaining;
  const aiIsLimitReached = aiUsageStatus.isLimitReached;

  // AI Content Generation Handlers (with full company profile)
  const getJobContext = () => ({
    title: formData.title,
    department: formData.department,
    category: formData.category,
    jobType: formData.job_type,
    experienceLevel: formData.experience_level,
    location: formData.location || `${formData.city}, ${formData.state}`,
    companyName: company?.company_name,
    industry: company?.industry,
    companyId: company?.id,
    companyDescription: company?.description,
    companySize: company?.company_size,
    companyWebsite: company?.website, // AI will use website for better context
  });

  const handleAIGenerateDescription = async () => {
    if (!isAIEnabled) {
      setAiErrorModal({ 
        isOpen: true, 
        error: { type: 'missing_fields', message: 'Please fill required fields first', details: 'Fill Title, Category, Department, Job Type & Experience to enable AI' }
      });
      return;
    }
    setDescription("");
    const result = await generateDescription(getJobContext());
    if (result.success && typeof result.content === 'string') {
      setDescription(result.content);
      // Refresh usage status after successful generation
      aiUsageStatus.refetch();
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
    const result = await generateRequirements(getJobContext());
    if (result.success && typeof result.content === 'string') {
      setRequirements(result.content);
      aiUsageStatus.refetch();
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
    const result = await generateBenefits(getJobContext());
    if (result.success && typeof result.content === 'string') {
      setBenefits(result.content);
      aiUsageStatus.refetch();
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
      const result = await generateSkills(getJobContext());
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
        aiUsageStatus.refetch();
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
    const result = await generateSalary(getJobContext());
    if (result.success && result.content && typeof result.content === 'object' && !Array.isArray(result.content)) {
      const salaryData = result.content as { min: number; max: number; period?: string };
      setMinSalary(salaryData.min?.toLocaleString('en-IN') || '');
      setMaxSalary(salaryData.max?.toLocaleString('en-IN') || '');
      if (salaryData.period) {
        setSalaryPeriod(salaryData.period);
      }
      aiUsageStatus.refetch();
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
      ...getJobContext(),
      availableCategories: JOB_CATEGORIES,
    });

    if (result.success && typeof result.content === 'string') {
      setFormData(prev => ({ ...prev, category: result.content as string }));
      aiUsageStatus.refetch();
    } else if (result.error) {
      setAiErrorModal({ isOpen: true, error: result.error });
    }
  };

  const selectedPackage = durationPackages.find(pkg => pkg.months === selectedDuration) || durationPackages[0];
  const selectedPrice = selectedPackage ? packagePrice(selectedPackage) : 50;

  const getButtonText = () => {
    if (publishMode === 'schedule') {
      return "Schedule Job";
    } else if (visibility === 'private') {
      return "Save as Draft";
    } else {
      return "Publish Job";
    }
  };

  const validateForm = () => {
    if (!employerSettings?.job_posting_visibility) {
      toast.error("Job posting has been temporarily paused by admin. Please contact support for assistance.");
      return false;
    }

    if (company?.ban_type === 'job_posting' || company?.job_posting_visibility === false) {
      toast.error("Job posting privileges are paused by admin. You cannot post new jobs. Contact support for assistance.");
      return false;
    }
    
    if (!company) {
      toast.error("Company profile not loaded. Please refresh the page and try again.");
      return false;
    }

    // Check if location fields are set
    if (!formData.country.trim() || !formData.state.trim() || !formData.city.trim()) {
      toast.error("Please fill in Country, State, and City");
      return false;
    }

    // Validate required fields
    if (!formData.title.trim()) {
      toast.error("Job title is required");
      return false;
    }
    if (!formData.department.trim()) {
      toast.error("Department is required");
      return false;
    }
    if (!formData.category.trim()) {
      toast.error("Job category is required");
      return false;
    }
    if (!formData.job_type.trim()) {
      toast.error("Job type is required");
      return false;
    }
    if (!formData.experience_level.trim()) {
      toast.error("Experience level is required");
      return false;
    }
    if (!genderPreference || !genderPreference.trim()) {
      toast.error("Gender preference is required");
      return false;
    }
    if (!hasRichTextContent(description)) {
      toast.error("Job description is required");
      return false;
    }
    if (!hasRichTextContent(requirements)) {
      toast.error("Requirements are required");
      return false;
    }
    
    // Validate salary range
    if (!minSalary || !maxSalary || !salaryPeriod) {
      toast.error("Salary range is required");
      return false;
    }
    
    // Validate skills
    if (skills.length === 0) {
      toast.error("At least one required skill must be selected");
      return false;
    }
    
    if (languages.length === 0) {
      toast.error("At least one required language must be selected");
      return false;
    }
    if (!hasRichTextContent(benefits)) {
      toast.error("Benefits & Perks are required");
      return false;
    }

    const openingsCount = parseInt(additionalFields.openings, 10);
    if (!additionalFields.openings || Number.isNaN(openingsCount) || openingsCount < 1) {
      toast.error("Number of vacancies is required");
      return false;
    }

    if (!additionalFields.application_deadline || !isTodayOrFuture(additionalFields.application_deadline)) {
      toast.error("Application deadline is required");
      return false;
    }

    if (!additionalFields.work_mode) {
      toast.error("Work mode is required");
      return false;
    }

    if (!additionalFields.education_required) {
      toast.error("Education required is required");
      return false;
    }

    if (!additionalFields.shift_timing) {
      toast.error("Shift timing is required");
      return false;
    }

    if (!additionalFields.hiring_urgency) {
      toast.error("Hiring urgency is required");
      return false;
    }

    if (!additionalFields.apply_mode) {
      toast.error("Apply mode is required");
      return false;
    }

    if ((additionalFields.apply_mode === "external" || additionalFields.apply_mode === "both") && !externalApplyUrl.trim()) {
      toast.error("External apply URL is required");
      return false;
    }

    const urlError = validateExternalApplyUrl(externalApplyUrl);
    setExternalApplyUrlError(urlError);
    if (urlError) {
      toast.error(urlError);
      return false;
    }

    // Validate scheduling
    if (publishMode === 'schedule' && (!scheduledDate || scheduledDate <= new Date())) {
      toast.error("Please select a valid future date and time for scheduling");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    // Show confirmation dialog for non-draft postings that require points
    if (visibility !== 'private') {
      // Refresh pricing data before showing dialog
      await fetchJobPostingSettings();
      setShowConfirmDialog(true);
      return;
    }

    // Proceed directly for drafts
    proceedWithJobPosting();
  };

  const proceedWithJobPosting = async () => {
    setLoading(true);
    try {
      const urlError = validateExternalApplyUrl(externalApplyUrl);
      setExternalApplyUrlError(urlError);
      if (urlError) {
        toast.error(urlError);
        return;
      }

      console.log('Starting job submission process...');
      console.log('Company:', company);
      console.log('Form data:', formData);

      // Create salary range string from individual values
      const salaryRange = minSalary && maxSalary && salaryPeriod 
        ? (salaryPeriod === 'commission'
            ? `${minSalary}% - ${maxSalary}% commission`
            : `₹${minSalary} - ₹${maxSalary} ${salaryPeriod}`)
        : "";

      // Determine job status based on publish mode
      let jobStatus = 'active';
      if (publishMode === 'schedule') {
        jobStatus = 'scheduled';
      } else if (visibility === 'private') {
        jobStatus = 'draft';
      }

      // Generate slug for unlisted jobs
      let publicSlug = null;
      if (visibility === 'unlisted') {
        console.log('Generating slug for unlisted job...');
        const { data: slugData, error: slugError } = await supabase.rpc('generate_job_slug');
        if (slugError) {
          console.error('Error generating slug:', slugError);
          toast.error("Error generating job slug: " + slugError.message);
          return;
        }
        publicSlug = slugData;
        console.log('Generated slug:', publicSlug);
      }

      const currentPackage = durationPackages.find(pkg => pkg.months === selectedDuration) || durationPackages[0];
      
      // Create location string from separate fields
      const locationString = `${formData.city}, ${formData.state}`;
      
      const jobData = {
        company_id: company.id,
        ...formData,
        description,
        requirements,
        benefits,
        location: locationString,
        country: formData.country,
        state: formData.state,
        city: formData.city,
        external_apply_url: externalApplyUrl.trim() ? externalApplyUrl.trim() : null,
        salary_range: salaryRange,
        salary_min: minSalary ? parseInt(minSalary.replace(/,/g, '')) : null,
        salary_max: maxSalary ? parseInt(maxSalary.replace(/,/g, '')) : null,
        salary_period: salaryPeriod,
        skills,
        languages: languages.length > 0 ? languages : null,
        video_title_1: null,
        video_url_1: videos[0]?.url || null,
        video_title_2: null,
        video_url_2: videos[1]?.url || null,
        status: jobStatus,
        visibility,
        publish_mode: publishMode,
        scheduled_publish_at: publishMode === 'schedule' ? scheduledDate?.toISOString() : null,
        published_at: publishMode === 'now' && visibility !== 'private' ? new Date().toISOString() : null,
        public_slug: publicSlug,
        duration_months: visibility !== 'private' ? selectedDuration : null,
        points_spent: visibility !== 'private' ? currentPackage.points : null,
        // Save job location coordinates from company
        latitude: company.latitude || null,
        longitude: company.longitude || null,
        precise_address: company.precise_address || null,
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

      console.log('Job data to insert:', jobData);

      let createdJob: any = null;
      let paid = visibility === 'private';

      // Save the job first as an unpublished draft; it goes live only after Razorpay payment
      const { data: savedJob, error: saveError } = await supabase
        .from('jobs')
        .insert({ ...jobData, status: 'draft', published_at: null })
        .select()
        .maybeSingle();
      if (saveError || !savedJob) {
        console.error('❌ Job creation error:', saveError);
        toast.error(saveError?.message || 'Failed to save job');
        return;
      }
      createdJob = savedJob;

      if (visibility !== 'private') {
        const pay = await payWithRazorpay({
          purpose: 'job_posting',
          job_id: savedJob.id,
          months: selectedDuration,
          target_status: publishMode === 'schedule' ? 'scheduled' : 'active',
          description: `Job posting: ${formData.title} (${selectedDuration} month${selectedDuration > 1 ? 's' : ''})`,
        });
        paid = pay.success;
        if (!pay.success) {
          toast.error(pay.cancelled
            ? 'Payment cancelled. Your job is saved as a draft — publish it after payment.'
            : `Payment failed: ${pay.error}. Your job is saved as a draft.`);
        }
      }

      console.log('Job posted successfully:', createdJob);

      // Auto-share to LinkedIn (only when connected + auto-post enabled + not a draft)
      if (createdJob?.id && visibility !== 'private' && paid) {
        supabase.functions
          .invoke('employer-google-auth', {
            body: {
              action: 'linkedin-share-job',
              job_id: createdJob.id,
              site_url: window.location.origin,
            },
          })
          .then(({ data, error }) => {
            if (error) {
              console.warn('LinkedIn auto-share error (non-critical):', error);
              toast.error('LinkedIn par share nahi ho paya. Employer Portal → Settings se LinkedIn dobara connect karein.');
              return;
            }
            if (data?.posted) {
              toast.success('Job LinkedIn par bhi post ho gaya 🎉');
              return;
            }
            const reasons: Record<string, string> = {
              not_connected: 'LinkedIn connected nahi hai — job LinkedIn par share nahi hua. LinkedIn se login karke connect karein.',
              no_post_permission: 'LinkedIn posting permission (w_member_social) nahi mili — LinkedIn se dobara login karein.',
              auto_post_disabled: 'LinkedIn auto-post band hai — settings se ON karein.',
              token_expired: 'LinkedIn session expire ho gaya — LinkedIn se dobara login karein.',
            };
            const msg = data?.skipped ? reasons[data.skipped] : (data?.details || data?.error);
            if (msg) toast.error(msg);
          })
          .catch((e) => console.warn('LinkedIn auto-share failed:', e));
      }

      // Save job images to job_images table
      if (jobImages.length > 0 && createdJob?.id) {
        console.log('📷 Saving job images:', jobImages.length);
        for (const [index, image] of jobImages.entries()) {
          const { error: imageError } = await supabase
            .from('job_images')
            .insert({
              job_id: createdJob.id,
              user_id: user.id,
              image_url: image.url,
              image_type: image.type || 'gallery',
              size_category: image.sizeCategory || 'medium',
              width: image.width || null,
              height: image.height || null,
              sort_order: index,
              alt_text: `${formData.title} - Job Image ${index + 1}`,
              seo_title: formData.title,
              caption: `Job opportunity: ${formData.title} at ${company?.company_name || 'Company'}`
            });
          
          if (imageError) {
            console.error('❌ Error saving job image:', imageError);
          }
        }
        console.log('✅ Job images saved successfully');
      }

      // Clear saved form state on successful submission
      clearSavedState();

      // Show appropriate success message based on publish mode
      if (!paid) {
        // message already shown
      } else if (publishMode === 'schedule') {
        toast.success(`Job scheduled to publish on ${scheduledDate?.toLocaleDateString()} at ${scheduledDate?.toLocaleTimeString()}`);
      } else if (visibility === 'private') {
        toast.success('Job saved as private draft');
      } else {
        toast.success('Job posted successfully!');
      }

      navigate('/employer-portal');
    } catch (error: any) {
      console.error('Unexpected error posting job:', error);
      
      if (error.message) {
        toast.error(`Failed to post job: ${error.message}`);
      } else {
        toast.error("An unexpected error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Enhanced Header */}
      <header className="bg-white/95 backdrop-blur-sm border-b border-border/50 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/employer-portal")}
              className="text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-lg transition-all duration-200 flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Back to Dashboard</span>
              <span className="sm:hidden">Back</span>
            </Button>
            
            <div className="flex-1 text-center px-4 min-w-0">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent truncate">
                Post New Job
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 hidden sm:block truncate">
                Create a new job posting for your company
              </p>
            </div>
            
            <div className="w-16 sm:w-24 flex-shrink-0"></div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                  disabled={isGenerating || aiUsageStatus.isLimitReached || !formData.title?.trim()}
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
                  aiRemainingCredits={aiRemainingCredits}
                  aiIsLimitReached={aiIsLimitReached}
                />
              </div>
            </div>

            {/* Job Description */}
            <RichTextEditor
              id="description"
              label="Job Description"
              value={description}
              onChange={setDescription}
              placeholder="Describe the role, responsibilities, and what the candidate will be doing..."
              required={true}
              onAIGenerate={handleAIGenerateDescription}
              aiTooltip="Generate job description with AI"
              aiDisabled={aiDisabled}
              aiDisabledReason={aiDisabledReason}
              aiRemainingCredits={aiRemainingCredits}
              aiIsLimitReached={aiIsLimitReached}
            />

            {/* Requirements */}
            <RichTextEditor
              id="requirements"
              label="Requirements"
              value={requirements}
              onChange={setRequirements}
              placeholder="List the qualifications, experience, and skills required..."
              required={true}
              onAIGenerate={handleAIGenerateRequirements}
              aiTooltip="Generate requirements with AI"
              aiDisabled={aiDisabled}
              aiDisabledReason={aiDisabledReason}
              aiRemainingCredits={aiRemainingCredits}
              aiIsLimitReached={aiIsLimitReached}
            />

            {/* Skills & Languages */}
            <div className="space-y-6">
              <SkillsSelector
                selectedSkills={skills}
                onSkillsChange={handleSkillsChange}
                required={true}
                onAIGenerate={handleAIGenerateSkills}
                aiDisabled={aiDisabled}
                aiDisabledReason={aiDisabledReason}
                aiRemainingCredits={aiRemainingCredits}
                aiIsLimitReached={aiIsLimitReached}
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
              placeholder="Health insurance, flexible hours, Workly India, performance bonuses..."
              required={true}
              onAIGenerate={handleAIGenerateBenefits}
              aiTooltip="Generate benefits with AI"
              aiDisabled={aiDisabled}
              aiDisabledReason={aiDisabledReason}
              aiRemainingCredits={aiRemainingCredits}
              aiIsLimitReached={aiIsLimitReached}
            />

            {/* Job Images */}
            <div className="space-y-3">
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
                images={jobImages}
                onImagesChange={setJobImages}
                maxImages={10}
                disabled={loading}
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
                disabled={
                  loading ||
                  (publishMode === 'schedule' && (!scheduledDate || scheduledDate <= new Date()))
                } 
                className="flex-1 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
              >
                {loading ? 'Processing...' : getButtonText()}
              </Button>
              
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate("/employer-portal")}
                className="flex-1 sm:flex-none"
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>

        {/* Confirmation Dialog */}
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent fullPage hideClose>
            <PaymentPageHeader
              onBack={() => setShowConfirmDialog(false)}
              subtitle="Confirm job posting"
            />
            <div>
              <div className="space-y-4 text-sm text-muted-foreground">
                {/* Duration Selection */}
                <div className="space-y-2">
                  <Label htmlFor="duration">Select Validity (Months)</Label>
                  <Select value={selectedDuration.toString()} onValueChange={(value) => setSelectedDuration(parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent>
                      {durationPackages.map((pkg) => (
                        <SelectItem key={pkg.months} value={pkg.months.toString()}>
                          {pkg.months} Month{pkg.months > 1 ? 's' : ''} (₹{packagePrice(pkg)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Cost Breakdown */}
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm font-medium">
                    <span>Amount to pay:</span>
                    <span className="text-primary">₹{selectedPrice}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Secure payment via Razorpay (UPI, cards, net banking)</p>
                </div>

                {/* Expiry Information */}
                <div className="bg-blue-50 rounded-lg p-3 text-sm">
                  <div className="font-medium text-blue-900">Job Expiry Date & Time:</div>
                  <div className="text-blue-700">
                    {(() => {
                      const expiryDate = new Date();
                      expiryDate.setMonth(expiryDate.getMonth() + selectedDuration);
                      return `${expiryDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })} at ${expiryDate.toLocaleTimeString('en-GB', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        hour12: true 
                      })}`;
                    })()}
                  </div>
                </div>
                
              </div>
            </div>
            <DialogFooter className="gap-2 mt-auto">
              <Button 
                variant="outline" 
                onClick={() => setShowConfirmDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setShowConfirmDialog(false);
                  proceedWithJobPosting();
                }}
              >
                Pay ₹{selectedPrice} &amp; Post Job
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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

export default PostNewJob;