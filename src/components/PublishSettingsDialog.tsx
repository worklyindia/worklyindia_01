import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarIcon, Info, Settings, Globe, EyeOff, Lock, Clock, Zap, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useState } from "react";

interface PublishSettingsDialogProps {
  visibility: string;
  onVisibilityChange: (value: string) => void;
  publishMode: string;
  onPublishModeChange: (value: string) => void;
  scheduledDate: Date | undefined;
  onScheduledDateChange: (date: Date | undefined) => void;
  jobTitle?: string;
  companyName?: string;
  location?: string;
}

const PublishSettingsDialog = ({
  visibility,
  onVisibilityChange,
  publishMode,
  onPublishModeChange,
  scheduledDate,
  onScheduledDateChange,
  jobTitle = "",
  companyName = "",
  location = ""
}: PublishSettingsDialogProps) => {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [open, setOpen] = useState(false);

  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    return now;
  };

  const visibilityOptions = [
    {
      value: "public",
      icon: Globe,
      title: "Public",
      description: "Anyone can search and view",
      color: "bg-green-500",
      features: ["Search results", "Recommendations", "Public directory"]
    },
    {
      value: "unlisted",
      icon: EyeOff,
      title: "Unlisted",
      description: "Link sharing only",
      color: "bg-blue-500",
      features: ["Direct link access", "No search results", "Private sharing"]
    },
    {
      value: "private",
      icon: Lock,
      title: "Private",
      description: "Only you can view",
      color: "bg-purple-500",
      features: ["Complete privacy", "Draft mode", "Review before publish"]
    }
  ];

  const publishOptions = [
    {
      value: "now",
      icon: Zap,
      title: "Publish Now",
      description: "Go live immediately",
      color: "bg-orange-500",
      badge: "Instant"
    },
    {
      value: "schedule",
      icon: Clock,
      title: "Schedule",
      description: "Set future publish time",
      color: "bg-indigo-500",
      badge: "Planned"
    }
  ];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="ghost" 
          className="w-full justify-between h-12 hover:bg-accent/30 transition-all duration-200"
        >

          <div className="flex items-center space-x-2">
            <Settings className="h-5 w-5 text-primary" />
            <span className="font-medium">Publish Settings</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
              Configure
            </span>
            <span className="text-primary">›</span>
          </div>
        </Button>
      </SheetTrigger>

      <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-hidden p-0 [&>button]:hidden">
        <SheetHeader className="p-6 pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center space-x-2 text-lg">
              <span className="text-lg">📢</span>
              <span>Publish Settings</span>
            </SheetTitle>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setOpen(false)}
              className="h-8 w-8 -mr-2"
            >
              <ChevronDown className="h-5 w-5" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Configure how and when your job will be published
          </p>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(90vh-140px)] px-6 pb-6">

        <div className="space-y-6 py-4">
          {/* Visibility Settings */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Visibility</Label>
            <RadioGroup value={visibility} onValueChange={onVisibilityChange}>
              {visibilityOptions.map((option) => (
                <div key={option.value} className="relative">
                  <div className={cn(
                    "border-2 rounded-lg p-4 cursor-pointer transition-all duration-200",
                    visibility === option.value 
                      ? "border-primary bg-primary/5" 
                      : "border-muted hover:border-primary/50"
                  )}>
                    <RadioGroupItem 
                      value={option.value} 
                      id={option.value}
                      className="absolute top-4 right-4"
                    />
                    
                    <div className="flex items-start space-x-3">
                      <div className={cn("p-2 rounded-full", option.color)}>
                        <option.icon className="h-4 w-4 text-white" />
                      </div>
                      
                      <div className="flex-1">
                        <h3 className="font-medium">{option.title}</h3>
                        <p className="text-sm text-muted-foreground">{option.description}</p>
                        
                        <div className="mt-2 space-y-1">
                          {option.features.map((feature, index) => (
                            <div key={index} className="flex items-center space-x-1">
                              <div className="w-1 h-1 bg-primary rounded-full"></div>
                              <span className="text-xs text-muted-foreground">{feature}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Publish Timing */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Publish Timing</Label>
            <RadioGroup value={publishMode} onValueChange={onPublishModeChange}>
              {publishOptions.map((option) => (
                <div key={option.value} className="relative">
                  <div className={cn(
                    "border-2 rounded-lg p-4 cursor-pointer transition-all duration-200",
                    publishMode === option.value 
                      ? "border-primary bg-primary/5" 
                      : "border-muted hover:border-primary/50"
                  )}>
                    <RadioGroupItem 
                      value={option.value} 
                      id={`publish-${option.value}`}
                      className="absolute top-4 right-4"
                    />
                    
                    <div className="flex items-start space-x-3">
                      <div className={cn("p-2 rounded-full", option.color)}>
                        <option.icon className="h-4 w-4 text-white" />
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-medium">{option.title}</h3>
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            {option.badge}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{option.description}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Schedule Date/Time Picker */}
          {publishMode === 'schedule' && (
            <Card className="p-4 border-dashed border-2 border-primary/30 bg-primary/5">
              <Label className="text-sm font-medium">Schedule Date & Time</Label>
              <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal mt-2",
                      !scheduledDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {scheduledDate ? format(scheduledDate, "PPP 'at' p") : "Select date and time"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto max-w-sm p-0" align="start">
                  <div className="p-3 space-y-3">
                    <Calendar
                      mode="single"
                      selected={scheduledDate}
                      onSelect={(date) => {
                        if (date) {
                          const now = new Date();
                          date.setHours(now.getHours());
                          date.setMinutes(now.getMinutes() + 5);
                          onScheduledDateChange(date);
                        }
                      }}
                      disabled={(date) => date < new Date()}
                      initialFocus
                      className="pointer-events-auto"
                    />
                    {scheduledDate && (
                      <div className="space-y-2">
                        <Label className="text-sm">Time</Label>
                        <Input
                          type="time"
                          value={scheduledDate ? format(scheduledDate, "HH:mm") : ""}
                          onChange={(e) => {
                            if (scheduledDate && e.target.value) {
                              const [hours, minutes] = e.target.value.split(':');
                              const newDate = new Date(scheduledDate);
                              newDate.setHours(parseInt(hours));
                              newDate.setMinutes(parseInt(minutes));
                              
                              const minTime = getMinDateTime();
                              if (newDate < minTime) {
                                newDate.setTime(minTime.getTime());
                              }
                              
                              onScheduledDateChange(newDate);
                            }
                          }}
                        />
                        <Button 
                          onClick={() => setShowDatePicker(false)}
                          className="w-full"
                          size="sm"
                        >
                          Set Time
                        </Button>
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </Card>
          )}


          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
            <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={() => setOpen(false)} className="flex-1">
              Apply Settings
            </Button>
          </div>
        </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default PublishSettingsDialog;