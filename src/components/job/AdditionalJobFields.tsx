import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

export interface AdditionalJobFieldsValue {
  openings: string;
  application_deadline: Date | undefined;
  work_mode: string;
  education_required: string;
  shift_timing: string;
  immediate_joining: boolean;
  hiring_urgency: string;
  apply_mode: string;
  resume_required: boolean;
  cover_letter_required: boolean;
  auto_email_confirmation: boolean;
}

export const defaultAdditionalJobFields: AdditionalJobFieldsValue = {
  openings: "1",
  application_deadline: undefined,
  work_mode: "on-site",
  education_required: "any",
  shift_timing: "day",
  immediate_joining: false,
  hiring_urgency: "normal",
  apply_mode: "workly",
  resume_required: true,
  cover_letter_required: false,
  auto_email_confirmation: true,
};

interface Props {
  value: AdditionalJobFieldsValue;
  onChange: (patch: Partial<AdditionalJobFieldsValue>) => void;
}

const AdditionalJobFields = ({ value, onChange }: Props) => {
  return (
    <div className="space-y-6">


      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Vacancies */}
        <div className="space-y-2">
          <Label htmlFor="openings">Number of Vacancies <span className="text-foreground font-semibold">*</span></Label>
          <Input
            id="openings"
            type="number"
            min={1}
            value={value.openings}
            onChange={(e) => onChange({ openings: e.target.value })}
            placeholder="e.g. 5"
          />
        </div>

        {/* Application Deadline */}
        <div className="space-y-2">
          <Label>Application Deadline (Last Date) <span className="text-foreground font-semibold">*</span></Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !value.application_deadline && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {value.application_deadline
                  ? format(value.application_deadline, "PPP")
                  : "Select last date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={value.application_deadline}
                onSelect={(d) => onChange({ application_deadline: d })}
                disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Work Mode */}
        <div className="space-y-2">
          <Label>Work Mode <span className="text-foreground font-semibold">*</span></Label>
          <Select value={value.work_mode} onValueChange={(v) => onChange({ work_mode: v })}>
            <SelectTrigger><SelectValue placeholder="Select work mode" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="on-site">On-site</SelectItem>
              <SelectItem value="remote">Remote</SelectItem>
              <SelectItem value="hybrid">Hybrid</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Education */}
        <div className="space-y-2">
          <Label>Education Required <span className="text-foreground font-semibold">*</span></Label>
          <Select value={value.education_required} onValueChange={(v) => onChange({ education_required: v })}>
            <SelectTrigger><SelectValue placeholder="Select education" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              <SelectItem value="10th">10th Pass</SelectItem>
              <SelectItem value="12th">12th Pass</SelectItem>
              <SelectItem value="diploma">Diploma</SelectItem>
              <SelectItem value="graduate">Graduate</SelectItem>
              <SelectItem value="post-graduate">Post Graduate</SelectItem>
              <SelectItem value="phd">PhD</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Shift Timing */}
        <div className="space-y-2">
          <Label>Shift Timing <span className="text-foreground font-semibold">*</span></Label>
          <Select value={value.shift_timing} onValueChange={(v) => onChange({ shift_timing: v })}>
            <SelectTrigger><SelectValue placeholder="Select shift" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Day</SelectItem>
              <SelectItem value="night">Night</SelectItem>
              <SelectItem value="rotational">Rotational</SelectItem>
              <SelectItem value="flexible">Flexible</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Hiring Urgency */}
        <div className="space-y-2">
          <Label>Hiring Urgency <span className="text-foreground font-semibold">*</span></Label>
          <Select value={value.hiring_urgency} onValueChange={(v) => onChange({ hiring_urgency: v })}>
            <SelectTrigger><SelectValue placeholder="Select urgency" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Apply Mode */}
        <div className="space-y-2 md:col-span-2">
          <Label>How can candidates apply? <span className="text-foreground font-semibold">*</span></Label>
          <Select value={value.apply_mode} onValueChange={(v) => onChange({ apply_mode: v })}>
            <SelectTrigger><SelectValue placeholder="Select apply mode" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="workly">Apply via Workly India</SelectItem>
              <SelectItem value="external">Apply via External Website</SelectItem>
              <SelectItem value="both">Both Options</SelectItem>
            </SelectContent>
          </Select>
          {(value.apply_mode === "external" || value.apply_mode === "both") && (
            <p className="text-xs text-muted-foreground">
              Make sure to fill the External Apply URL field below.
            </p>
          )}
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-3 pt-2 border-t border-border/60">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label>Immediate Joining</Label>
            <p className="text-xs text-muted-foreground">Candidate should be able to join immediately</p>
          </div>
          <Switch
            checked={value.immediate_joining}
            onCheckedChange={(c) => onChange({ immediate_joining: c })}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <Label>Resume Required</Label>
            <p className="text-xs text-muted-foreground">Applicants must upload a resume</p>
          </div>
          <Switch
            checked={value.resume_required}
            onCheckedChange={(c) => onChange({ resume_required: c })}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <Label>Cover Letter Required</Label>
            <p className="text-xs text-muted-foreground">Ask for a cover letter (optional field)</p>
          </div>
          <Switch
            checked={value.cover_letter_required}
            onCheckedChange={(c) => onChange({ cover_letter_required: c })}
          />
        </div>

      </div>
    </div>
  );
};

export default AdditionalJobFields;
