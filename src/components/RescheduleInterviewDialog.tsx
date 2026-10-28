import { useState, useEffect } from "react";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { StandardSheetHeader } from "@/components/StandardSheetHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Interview } from "@/hooks/useInterviews";
import { TimePickerSelect, convertTo24Hour, convertTo12Hour } from "@/components/TimePickerSelect";
import { supabase } from "@/integrations/supabase/client";

interface RescheduleInterviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  interview: Interview | null;
  onReschedule: (interviewId: string, scheduledAt: string, scheduledEndAt: string, mode: string, locationUrl?: string, notes?: string) => Promise<boolean>;
}

export const RescheduleInterviewDialog = ({
  open,
  onOpenChange,
  interview,
  onReschedule
}: RescheduleInterviewDialogProps) => {
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedEndTime, setSelectedEndTime] = useState("");
  const [mode, setMode] = useState("online");
  const [locationUrl, setLocationUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [serverTimeIST, setServerTimeIST] = useState<Date | null>(null);

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

  // Populate form when interview changes - convert to IST for display
  useEffect(() => {
    if (interview) {
      const interviewDateUTC = new Date(interview.scheduled_at);
      const interviewDateIST = toZonedTime(interviewDateUTC, 'Asia/Kolkata');
      setSelectedDate(interviewDateIST);
      setSelectedTime(convertTo12Hour(format(interviewDateIST, "HH:mm")));
      
      // Populate end time if available
      if (interview.scheduled_end_at) {
        const endDateUTC = new Date(interview.scheduled_end_at);
        const endDateIST = toZonedTime(endDateUTC, 'Asia/Kolkata');
        setSelectedEndTime(convertTo12Hour(format(endDateIST, "HH:mm")));
      }
      
      setMode(interview.mode);
      setLocationUrl(interview.location_url || "");
      setNotes(interview.notes || "");
    }
  }, [interview]);

  const handleSubmit = async () => {
    if (!interview || !selectedDate || !selectedTime || !selectedEndTime) {
      toast.error("Please fill all required fields");
      return;
    }

    // Validate end time is after start time
    const startTime24 = convertTo24Hour(selectedTime);
    const endTime24 = convertTo24Hour(selectedEndTime);
    const [startHours, startMinutes] = startTime24.split(':').map(Number);
    const [endHours, endMinutes] = endTime24.split(':').map(Number);
    const startMinutesTotal = startHours * 60 + startMinutes;
    const endMinutesTotal = endHours * 60 + endMinutes;
    
    if (endMinutesTotal <= startMinutesTotal) {
      toast.error("End time must be after start time");
      return;
    }

    // Validate that if today is selected, the time must be in the future (using IST server time)
    const currentISTTime = serverTimeIST || new Date();
    const isTodayIST = selectedDate
      ? formatInTimeZone(selectedDate, 'Asia/Kolkata', 'yyyy-MM-dd') === formatInTimeZone(currentISTTime, 'Asia/Kolkata', 'yyyy-MM-dd')
      : false;

    if (isTodayIST) {
      // Selected date is today, validate time is in future (based on IST)
      const scheduledIST = new Date(selectedDate);
      scheduledIST.setHours(startHours, startMinutes, 0, 0);
      
      if (currentISTTime && scheduledIST.getTime() <= currentISTTime.getTime()) {
        toast.error("For today's interview, please select a future time");
        return;
      }
    }

    // Combine date and time - convert IST to UTC
    const scheduledIST = new Date(selectedDate);
    scheduledIST.setHours(startHours, startMinutes, 0, 0);
    const scheduledAtUTC = fromZonedTime(scheduledIST, 'Asia/Kolkata');

    // Create end time
    const scheduledEndIST = new Date(selectedDate);
    scheduledEndIST.setHours(endHours, endMinutes, 0, 0);
    const scheduledEndAtUTC = fromZonedTime(scheduledEndIST, 'Asia/Kolkata');

    setLoading(true);
    try {
      const success = await onReschedule(
        interview.id,
        scheduledAtUTC.toISOString(),
        scheduledEndAtUTC.toISOString(),
        mode,
        locationUrl || undefined,
        notes || undefined
      );

      if (success) {
        toast.success("Interview rescheduled successfully");
        onOpenChange(false);
      } else {
        toast.error("Failed to reschedule interview");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (!interview) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="rounded-t-3xl [&>button]:hidden [&>div:last-child]:p-6">
        <StandardSheetHeader 
          title="Reschedule Interview" 
          onClose={() => onOpenChange(false)}
        />
        
        <div className="space-y-6 py-4">
          {/* Live IST Clock */}
          <div className="flex flex-col gap-1 p-3 rounded-md border bg-muted/50">
            <span className="text-xs font-medium text-muted-foreground">🇮🇳 India Time Now</span>
            {serverTimeIST ? (
              <>
                <span className="font-mono text-sm font-semibold">
                  📅 Date : {formatInTimeZone(serverTimeIST, 'Asia/Kolkata', 'dd MMMM yyyy')}
                </span>
                <span className="font-mono text-sm font-semibold">
                  🕐 Time : {formatInTimeZone(serverTimeIST, 'Asia/Kolkata', 'hh:mm:ss')} - {formatInTimeZone(serverTimeIST, 'Asia/Kolkata', 'a')}
                </span>
              </>
            ) : (
              <span className="font-mono text-sm font-semibold">Syncing IST...</span>
            )}
          </div>
          {/* Interview Info */}
          <div className="bg-slate-50 p-4 rounded-lg">
            <div className="space-y-2">
              <p><strong>Job:</strong> {interview.job?.title}</p>
              <p><strong>Candidate:</strong> {interview.applicant?.full_name}</p>
              <p><strong>Current Schedule:</strong> {format(new Date(interview.scheduled_at), "PPP 'at' p")}</p>
            </div>
          </div>

          {/* Date Selection */}
          <div className="space-y-2">
            <Label>New Interview Date *</Label>
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
          <div className="space-y-2">
            <Label htmlFor="time">New Interview Start Time *</Label>
            <TimePickerSelect
              value={selectedTime}
              onChange={setSelectedTime}
              placeholder="Select start time"
            />
          </div>

          {/* End Time Selection */}
          <div className="space-y-2">
            <Label htmlFor="endTime">New Interview End Time *</Label>
            <TimePickerSelect
              value={selectedEndTime}
              onChange={setSelectedEndTime}
              placeholder="Select end time"
            />
            {selectedTime && selectedEndTime && (() => {
              const start = convertTo24Hour(selectedTime);
              const end = convertTo24Hour(selectedEndTime);
              const [startHours, startMinutes] = start.split(':').map(Number);
              const [endHours, endMinutes] = end.split(':').map(Number);
              const startMs = (startHours * 60 + startMinutes) * 60000;
              const endMs = (endHours * 60 + endMinutes) * 60000;
              const durationMinutes = Math.max(0, Math.ceil((endMs - startMs) / 60000));
              return durationMinutes > 0 ? (
                <p className="text-sm text-muted-foreground">
                  Duration: {durationMinutes} minutes
                </p>
              ) : null;
            })()}
          </div>

          {/* Interview Mode */}
          <div className="space-y-2">
            <Label>Interview Mode *</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                
                <SelectItem value="online">💻 Online (Video Call)</SelectItem>
                <SelectItem value="phone">📞 Phone Call</SelectItem>
                <SelectItem value="in_person">🏢 In Person</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Meeting Link/Location */}
          <div className="space-y-2">
            <Label htmlFor="location">
              {mode === "online" ? "Meeting Link" : mode === "phone" ? "Phone Number" : "Address"}
            </Label>
            <Input
              value={locationUrl}
              onChange={(e) => setLocationUrl(e.target.value)}
              placeholder={
                mode === "online" 
                  ? "https://meet.google.com/..." 
                  : mode === "phone"
                    ? "+91 XXXXXXXXXX"
                    : "Office address"
              }
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Reschedule Reason & Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for rescheduling and any additional notes..."
              className="min-h-[100px]"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || !serverTimeIST || !selectedDate || !selectedTime || !selectedEndTime}
          >
            {loading ? "Rescheduling..." : "Reschedule Interview"}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};