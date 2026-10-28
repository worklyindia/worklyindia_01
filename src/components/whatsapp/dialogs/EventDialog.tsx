import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: { title: string; date: string; time: string; description?: string; location?: string }) => void;
}

export function EventDialog({ open, onOpenChange, onSubmit }: EventDialogProps) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");

  const handleSubmit = () => {
    if (title.trim() && date && time) {
      onSubmit({
        title: title.trim(),
        date,
        time,
        description: description.trim() || undefined,
        location: location.trim() || undefined,
      });
      setTitle("");
      setDate("");
      setTime("");
      setDescription("");
      setLocation("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Event</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground">Event Title</label>
            <Input
              placeholder="Meeting, Interview, etc."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-sm text-muted-foreground">Date</label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Time</label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Location (Optional)</label>
            <Input
              placeholder="Office, Online, etc."
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Description (Optional)</label>
            <Textarea
              placeholder="Event details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <Button onClick={handleSubmit} className="w-full">
            Send Event
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
