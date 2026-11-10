import { useState, useEffect } from "react";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { PaymentPageHeader } from "@/components/PaymentPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CalendarIcon, Check, ChevronsUpDown, Video, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { TimePickerSelect, convertTo24Hour } from "@/components/TimePickerSelect";
import { useInterviewPricing } from "@/hooks/useInterviewPricing";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InterviewPaymentConfirmationDialog } from "@/components/InterviewPaymentConfirmationDialog";
import RichTextEditor from "@/components/RichTextEditor";
import { useFormPersistence } from "@/hooks/useFormPersistence";

interface ScheduleInterviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSchedule: (data: {
    jobId: string;
    applicantId: string;
    scheduledAt: string;
    scheduledEndAt?: string;
    mode: string;
    locationUrl?: string;
    notes?: string;
    videoPlatform?: string;
  }) => Promise<boolean>;
  jobs: Array<{ id: string; title: string; hasActiveInterview?: boolean }>;
  applicants: Array<{ id: string; full_name: string; job_id: string }>;
  preSelectedJob?: string;
  preSelectedApplicant?: string;
}

export const ScheduleInterviewDialog = ({
  open,
  onOpenChange,
  onSchedule,
  jobs,
  applicants,
  preSelectedJob,
  preSelectedApplicant
}: ScheduleInterviewDialogProps) => {
  const [selectedJob, setSelectedJob] = useState("");
  const [selectedApplicants, setSelectedApplicants] = useState<string[]>([]);
  const [candidatePopoverOpen, setCandidatePopoverOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedEndTime, setSelectedEndTime] = useState("");
  const [mode, setMode] = useState("online");
  const [videoPlatform, setVideoPlatform] = useState<"zoom" | "googlemeet">("zoom");
  const [locationUrl, setLocationUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [showPaymentConfirmation, setShowPaymentConfirmation] = useState(false);
  const [pendingInterviewData, setPendingInterviewData] = useState<any>(null);
  const [enableYouTubeStream, setEnableYouTubeStream] = useState(false);
  const [youtubeStreamKey, setYoutubeStreamKey] = useState("");
  const [youtubeStreamUrl, setYoutubeStreamUrl] = useState("");
  const [youtubeLink, setYoutubeLink] = useState("");
  const [youtubeAccessMode, setYoutubeAccessMode] = useState<"alltime" | "starttime">("alltime");
  const [serverTimeIST, setServerTimeIST] = useState<Date | null>(null);

  // Form state persistence
  const interviewFormState = {
    selectedJob,
    selectedApplicants,
    selectedDate: selectedDate?.toISOString(),
    selectedTime,
    selectedEndTime,
    mode,
    videoPlatform,
    locationUrl,
    notes,
    enableYouTubeStream,
    youtubeStreamKey,
    youtubeStreamUrl,
    youtubeLink,
    youtubeAccessMode
  };

  const { clearSavedState } = useFormPersistence(
    'schedule-interview-form',
    interviewFormState,
    (savedState) => {
      if (savedState.selectedJob && !preSelectedJob) setSelectedJob(savedState.selectedJob);
      if (savedState.selectedApplicants && !preSelectedApplicant) setSelectedApplicants(savedState.selectedApplicants);
      if (savedState.selectedDate) setSelectedDate(new Date(savedState.selectedDate));
      if (savedState.selectedTime) setSelectedTime(savedState.selectedTime);
      if (savedState.selectedEndTime) setSelectedEndTime(savedState.selectedEndTime);
      if (savedState.mode) setMode(savedState.mode);
      if (savedState.videoPlatform) setVideoPlatform(savedState.videoPlatform);
      if (savedState.locationUrl) setLocationUrl(savedState.locationUrl);
      if (savedState.notes) setNotes(savedState.notes);
      if (savedState.enableYouTubeStream !== undefined) setEnableYouTubeStream(savedState.enableYouTubeStream);
      if (savedState.youtubeStreamKey) setYoutubeStreamKey(savedState.youtubeStreamKey);
      if (savedState.youtubeStreamUrl) setYoutubeStreamUrl(savedState.youtubeStreamUrl);
      if (savedState.youtubeLink) setYoutubeLink(savedState.youtubeLink);
      if (savedState.youtubeAccessMode) setYoutubeAccessMode(savedState.youtubeAccessMode);
    },
    open // Only persist when dialog is open
  );

  // Sync with IST server time on mount and update every second
  useEffect(() => {
    let timer: NodeJS.Timeout;
    const syncServerTime = async () => {
      try {
        const { data, error } = await supabase.rpc('get_server_time_ist');
        if (!error && data) {
          const serverTimeEpoch = data as number;
          setServerTimeIST(new Date(serverTimeEpoch));
          // Update every second
          timer = setInterval(() => {
            setServerTimeIST(prev => prev ? new Date(prev.getTime() + 1000) : null);
          }, 1000);
        } else {
          console.error('Error fetching server time:', error);
          setServerTimeIST(new Date());
        }
      } catch (error) {
        console.error('Failed to sync server time:', error);
        setServerTimeIST(new Date());
      }
    };

    syncServerTime();
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    };
    getUser();
  }, []);

  // Preselect job and candidate when coming from Applicants page
  useEffect(() => {
    if (!open) return;
    if (preSelectedJob) {
      const job = jobs.find(j => j.id === preSelectedJob);
      if (job?.hasActiveInterview) {
        toast.error(`Cannot schedule new interview for "${job.title}". An active interview is already scheduled. Please complete or cancel it first.`);
        setSelectedJob("");
      } else {
        setSelectedJob(preSelectedJob);
      }
    }
    if (preSelectedApplicant) {
      const candidate = applicants.find(a => a.id === preSelectedApplicant);
      if (candidate) {
        if (!preSelectedJob) {
          const job = jobs.find(j => j.id === candidate.job_id);
          if (job?.hasActiveInterview) {
            toast.error(`Cannot schedule new interview. This job already has an active interview scheduled.`);
            setSelectedJob("");
          } else {
            setSelectedJob(candidate.job_id);
          }
        }
        setSelectedApplicants([preSelectedApplicant]);
      }
    }
  }, [open, preSelectedJob, preSelectedApplicant, applicants, jobs]);

  const { calculateInterviewCost } = useInterviewPricing();

  const filteredApplicants = selectedJob 
    ? applicants.filter(app => app.job_id === selectedJob)
    : [];

  // Calculate duration in minutes when times are selected
  const durationMinutes = (() => {
    if (!selectedTime || !selectedEndTime) return 0;
    const start = convertTo24Hour(selectedTime);
    const end = convertTo24Hour(selectedEndTime);
    const [startHours, startMinutes] = start.split(':').map(Number);
    const [endHours, endMinutes] = end.split(':').map(Number);
    const startMs = (startHours * 60 + startMinutes) * 60000;
    const endMs = (endHours * 60 + endMinutes) * 60000;
    return Math.max(0, Math.ceil((endMs - startMs) / 60000));
  })();

  const pricingBreakdown = calculateInterviewCost(
    selectedApplicants.length,
    durationMinutes,
    mode
  );
  const totalPoints = pricingBreakdown.total;

  const handleSelectAll = () => {
    if (selectedApplicants.length === filteredApplicants.length) {
      setSelectedApplicants([]);
    } else {
      setSelectedApplicants(filteredApplicants.map(app => app.id));
    }
  };

  const handleCandidateToggle = (candidateId: string) => {
    setSelectedApplicants(prev => 
      prev.includes(candidateId)
        ? prev.filter(id => id !== candidateId)
        : [...prev, candidateId]
    );
  };

  const selectedCandidateNames = selectedApplicants
    .map(id => filteredApplicants.find(app => app.id === id)?.full_name)
    .filter(Boolean);

  const handleSubmit = async () => {
    // For VideoSDK and 100ms iframe modes, locationUrl is not required (auto-generated)
    const requiresLocation = mode !== "videosdk_iframe" && mode !== "100ms_iframe";
    
    if (!selectedJob || selectedApplicants.length === 0 || !selectedDate || !selectedTime || !selectedEndTime || (requiresLocation && !locationUrl) || !notes) {
      toast.error("Please fill all required fields");
      return;
    }

    // Validate end time
    const startTime = convertTo24Hour(selectedTime);
    const endTime = convertTo24Hour(selectedEndTime);
    
    if (endTime <= startTime) {
      toast.error("End time must be after start time");
      return;
    }

    // If Online mode, validate meeting link matches selected platform
    if (mode === "online") {
      const url = (locationUrl || "").trim();
      const isZoomUrl = /(https?:\/\/([a-z0-9.-]+\.)?zoom\.us\/|zoommtg:|zoomus:)/i.test(url);
      const isMeetUrl = /(https?:\/\/meet\.google\.com\/|https?:\/\/g\.co\/meet|google\.com\/_meet)/i.test(url);
      if (videoPlatform === "zoom" && !isZoomUrl) {
        toast.error("Please enter a valid Zoom meeting link");
        return;
      }
      if (videoPlatform === "googlemeet" && !isMeetUrl) {
        toast.error("Please enter a valid Google Meet link");
        return;
      }
    }

    // Validate that if today is selected, the time must be in the future (using IST server time)
    const currentISTTime = serverTimeIST || new Date();
    const isTodayIST = selectedDate
      ? formatInTimeZone(selectedDate, 'Asia/Kolkata', 'yyyy-MM-dd') === formatInTimeZone(currentISTTime, 'Asia/Kolkata', 'yyyy-MM-dd')
      : false;

    if (isTodayIST) {
      // Selected date is today, validate time is in future (based on IST)
      const time24 = convertTo24Hour(selectedTime);
      const [hh, mm] = time24.split(':').map(Number);
      const scheduledIST = new Date(selectedDate);
      scheduledIST.setHours(hh, mm, 0, 0);
      
      if (currentISTTime && scheduledIST.getTime() <= currentISTTime.getTime()) {
        toast.error("For today's interview, please select a future time");
        return;
      }
    }

    // Combine date and time - convert IST to UTC
    const time24 = convertTo24Hour(selectedTime);
    const [hours, minutes] = time24.split(':').map(Number);
    const scheduledIST = new Date(selectedDate);
    scheduledIST.setHours(hours, minutes, 0, 0);
    const scheduledAtUTC = fromZonedTime(scheduledIST, 'Asia/Kolkata');

    // End time is now required - convert IST to UTC
    const endTime24 = convertTo24Hour(selectedEndTime);
    const [endHours, endMinutes] = endTime24.split(':').map(Number);
    const scheduledEndIST = new Date(selectedDate);
    scheduledEndIST.setHours(endHours, endMinutes, 0, 0);
    const scheduledEndAtUTC = fromZonedTime(scheduledEndIST, 'Asia/Kolkata');

    // Get job title and candidate names for confirmation dialog
    const jobTitle = jobs.find(j => j.id === selectedJob)?.title || "Job";
    const candidateNames = selectedApplicants
      .map(id => applicants.find(app => app.id === id)?.full_name)
      .filter(Boolean) as string[];

    // Prepare notes with YouTube link and access mode
    let finalNotes = notes;
    if (youtubeLink && youtubeLink.trim()) {
      finalNotes = `${notes}\n\n${youtubeLink}`;
      if (youtubeAccessMode === "starttime") {
        finalNotes += '\n{{youtube_access:starttime}}';
      }
    }

    // Prepare data for payment confirmation
    setPendingInterviewData({
      jobTitle,
      candidateNames,
      scheduledAt: scheduledAtUTC.toISOString(),
      scheduledEndAt: scheduledEndAtUTC.toISOString(),
      mode,
      locationUrl: (mode === "videosdk_iframe" || mode === "100ms_iframe") ? "" : locationUrl,
      notes: finalNotes,
      videoPlatform: mode === "online" ? videoPlatform : null,
      youtubeStreamKey: enableYouTubeStream ? youtubeStreamKey : null,
      youtubeStreamUrl: enableYouTubeStream ? youtubeStreamUrl : null,
      applicants: selectedApplicants.map(applicantId => ({
        applicantId,
        jobId: selectedJob
      }))
    });

    // Open payment confirmation dialog
    setShowPaymentConfirmation(true);
  };

  const handlePaymentSuccess = () => {
    // Clear saved form state on successful submission
    clearSavedState();
    
    // Reset form
    setSelectedJob("");
    setSelectedApplicants([]);
    setSelectedDate(undefined);
    setSelectedTime("");
    setSelectedEndTime("");
    setMode("videosdk_iframe");
    setVideoPlatform("zoom");
    setLocationUrl("");
    setNotes("");
    setEnableYouTubeStream(false);
    setYoutubeStreamKey("");
    setYoutubeStreamUrl("");
    setYoutubeLink("");
    setYoutubeAccessMode("alltime");
    setPendingInterviewData(null);
    setShowPaymentConfirmation(false);
    onOpenChange(false);
    
    // The parent closes the drawer and navigates to the interviews list.
    // Avoid a full-page reload here so the Android WebView keeps its current
    // session and does not flash the native startup/loading screen.
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mt-0 h-[100dvh] max-h-[100dvh] rounded-none overflow-y-auto [&>button]:hidden [&>div:first-child]:hidden [&>div:last-child]:p-6 [&>div:last-child]:pt-0">
        <PaymentPageHeader
          title="Schedule Interview"
          onBack={() => onOpenChange(false)}
        />

        <div className="space-y-6 py-4">

          {/* Job Selection */}
          <div className="space-y-2">
            <Label htmlFor="job">Job Position *</Label>
            <Select value={selectedJob} onValueChange={setSelectedJob}>
              <SelectTrigger>
                <SelectValue placeholder="Select a job position" />
              </SelectTrigger>
              <SelectContent>
                {jobs.map((job) => (
                  <SelectItem 
                    key={job.id} 
                    value={job.id}
                    disabled={job.hasActiveInterview}
                    className={job.hasActiveInterview ? "opacity-50" : ""}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span>{job.title}</span>
                      {job.hasActiveInterview && (
                        <span className="ml-2 text-xs text-muted-foreground flex items-center gap-1">
                          🔒 Active Interview
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedJob && jobs.find(j => j.id === selectedJob)?.hasActiveInterview && (
              <p className="text-xs text-muted-foreground">
                ⚠️ This job has an active interview. Complete or cancel it first.
              </p>
            )}
          </div>

          {/* Multiple Candidate Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Candidates *</Label>
              {filteredApplicants.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  disabled={!selectedJob}
                  className="text-xs h-7"
                >
                  {selectedApplicants.length === filteredApplicants.length ? "Deselect All" : "Select All"}
                </Button>
              )}
            </div>
            <Popover open={candidatePopoverOpen} onOpenChange={setCandidatePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={candidatePopoverOpen}
                  className="w-full justify-between"
                  disabled={!selectedJob}
                >
                  {selectedApplicants.length === 0
                    ? (selectedJob ? "Select candidates..." : "Select job first")
                    : `${selectedApplicants.length} candidate${selectedApplicants.length > 1 ? 's' : ''} selected`
                  }
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0 z-50 bg-popover border border-border">
                <Command>
                  <CommandInput placeholder="Search candidates..." />
                  <CommandList>
                    <CommandEmpty>No candidates found.</CommandEmpty>
                    <CommandGroup>
                      {filteredApplicants.map((applicant) => (
                        <CommandItem
                          key={applicant.id}
                          onSelect={() => handleCandidateToggle(applicant.id)}
                          className="flex items-center space-x-2"
                        >
                          <Checkbox 
                            checked={selectedApplicants.includes(applicant.id)}
                            onChange={() => handleCandidateToggle(applicant.id)}
                          />
                          <span>{applicant.full_name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {selectedCandidateNames.length > 0 && (
              <div className="text-sm text-muted-foreground">
                Selected: {selectedCandidateNames.join(", ")}
              </div>
            )}
          </div>

          {/* Date Selection */}
          <div className="space-y-2">
            <Label>Interview Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => {
                    // Disable past dates based on IST
                    const ymdIST = (d: Date) => Number(formatInTimeZone(d, 'Asia/Kolkata', 'yyyyMMdd'));
                    const baseTime = serverTimeIST ?? new Date();
                    return ymdIST(date) < ymdIST(baseTime);
                  }}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="time">Interview Start Time *</Label>
              <TimePickerSelect
                value={selectedTime}
                onChange={setSelectedTime}
                placeholder="Select start time"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">Interview End Time *</Label>
              <TimePickerSelect
                value={selectedEndTime}
                onChange={setSelectedEndTime}
                placeholder="Select end time"
              />
            </div>
          </div>

          {/* Interview Mode */}
          <div className="space-y-2">
            <Label>Interview Mode *</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                
                <SelectItem value="videosdk_iframe">🎥 VideoSDK Meeting</SelectItem>
                <SelectItem value="100ms_iframe">🎬 100ms Meeting</SelectItem>
                <SelectItem value="online">💻 Online (Video Call)</SelectItem>
                <SelectItem value="phone">📞 Phone Call</SelectItem>
                <SelectItem value="in_person">🏢 In Person</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Video Platform Selection - Show only for Online (Video Call) */}
          {mode === "online" && (
            <div className="space-y-3">
              <Label>Video Platform *</Label>
              <RadioGroup value={videoPlatform} onValueChange={(value: "zoom" | "googlemeet") => setVideoPlatform(value)} className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="zoom" id="zoom" />
                  <Label htmlFor="zoom" className="cursor-pointer font-normal">
                    Zoom
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="googlemeet" id="googlemeet" />
                  <Label htmlFor="googlemeet" className="cursor-pointer font-normal">
                    Google Meet
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Meeting Link/Location - Hide for auto-generated modes */}
          {mode !== "videosdk_iframe" && mode !== "100ms_iframe" && (
            <div className="space-y-2">
              <Label htmlFor="location">
                {mode === "online" ? "Meeting Link *" : mode === "phone" ? "Phone Number *" : "Address *"}
              </Label>
              <Input
                value={locationUrl}
                onChange={(e) => setLocationUrl(e.target.value)}
                placeholder={
                  mode === "online" 
                    ? (videoPlatform === "zoom" ? "https://zoom.us/j/..." : "https://meet.google.com/...") 
                    : mode === "phone"
                      ? "+91 XXXXXXXXXX"
                      : "Office address"
                }
              />
            </div>
          )}

          {/* YouTube Link - Show for all interview modes */}
          {mode && (
            <div className="space-y-3">
              <Label htmlFor="youtube-link">YouTube Link (Optional)</Label>
              <Input
                id="youtube-link"
                value={youtubeLink}
                onChange={(e) => setYoutubeLink(e.target.value)}
                placeholder="https://youtube.com/..."
              />
              <p className="text-xs text-muted-foreground">
                Add a YouTube link for recording or streaming reference
              </p>

              {/* YouTube Access Mode - Only show if YouTube link is provided */}
              {youtubeLink && (
                <div className="space-y-2 pt-2">
                  <Label>YouTube Video Access</Label>
                  <RadioGroup value={youtubeAccessMode} onValueChange={(value: "alltime" | "starttime") => setYoutubeAccessMode(value)}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="alltime" id="alltime" />
                      <Label htmlFor="alltime" className="cursor-pointer font-normal">
                        All Time Play
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="starttime" id="starttime" />
                      <Label htmlFor="starttime" className="cursor-pointer font-normal">
                        Start Time Unlock
                      </Label>
                    </div>
                  </RadioGroup>
                  <p className="text-xs text-muted-foreground">
                    {youtubeAccessMode === "alltime" 
                      ? "Video can be played anytime"
                      : "Video will unlock and play when interview starts (locked with visible preview before)"}
                  </p>
                </div>
              )}
            </div>
          )}
          
          {/* VideoSDK Info */}
          {mode === "videosdk_iframe" && (
            <Alert>
              <AlertDescription className="flex items-center gap-2">
                <Video className="w-4 h-4" />
                <span>VideoSDK meeting room will be automatically generated with built-in video, audio, screen sharing, and chat.</span>
              </AlertDescription>
            </Alert>
          )}
          
          {/* 100ms Info */}
          {mode === "100ms_iframe" && (
            <Alert>
              <AlertDescription className="flex items-center gap-2">
                <Video className="w-4 h-4" />
                <span>100ms meeting room will be automatically generated with premium video quality, screen sharing, and interactive features.</span>
              </AlertDescription>
            </Alert>
          )}
          
          {/* VideoSDK Info */}
          {mode === "videosdk" && (
            <Alert>
              <Video className="h-4 w-4" />
              <AlertDescription>
                VideoSDK video meeting link will be automatically generated after scheduling.
                <br />
                Features: HD video, screen sharing, recording support.
              </AlertDescription>
            </Alert>
          )}

          {/* Jitsi Meet Info */}
          {mode === "jitsi" && (
            <Alert>
              <Video className="h-4 w-4" />
              <AlertDescription>
                <strong>🆓 Free Video Meeting</strong> - Jitsi Meet link will be automatically generated.
                <br />
                Features: Screen sharing, recording, chat, mobile friendly.
                <br />
                <span className="text-xs text-muted-foreground">
                  No registration required • Works on all devices • 100% free • Open source
                </span>
              </AlertDescription>
            </Alert>
          )}

          {/* 100ms Info */}
          {mode === "100ms" && (
            <Alert>
              <Video className="h-4 w-4" />
              <AlertDescription>
                100ms video meeting link will be automatically generated after scheduling.
                <br />
                Features: High-quality video, screen sharing, recording, low latency, India-optimized servers.
              </AlertDescription>
            </Alert>
          )}

          {/* Notes - Rich Text Editor */}
          <RichTextEditor
            id="notes"
            label="Additional Notes"
            value={notes}
            onChange={setNotes}
            placeholder="Any special instructions or agenda items..."
            required={true}
          />
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={
              loading || 
              !serverTimeIST ||
              !selectedJob || 
              selectedApplicants.length === 0 || 
              !selectedDate || 
              !selectedTime || 
              !selectedEndTime ||
              (mode !== "videosdk_iframe" && mode !== "100ms_iframe" && !locationUrl) ||
              !notes
            }
          >
            {loading ? "Processing..." : 'Continue'}
          </Button>
        </div>
      </DrawerContent>

      {/* Payment Confirmation Dialog */}
      {pendingInterviewData && (
        <InterviewPaymentConfirmationDialog
          open={showPaymentConfirmation}
          onOpenChange={setShowPaymentConfirmation}
          interviewData={pendingInterviewData}
          applicants={pendingInterviewData.applicants}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </Drawer>
  );
};