import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Download } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ExportLogsDialogProps {
  open: boolean;
  onClose: () => void;
  onExport: (startDate: Date | null, endDate: Date | null, actionType: string | null) => Promise<void>;
}

const actionTypes = [
  { value: "all", label: "All Actions" },
  { value: "assign_role", label: "Assign Role" },
  { value: "update_permissions", label: "Update Permissions" },
  { value: "remove_team_member", label: "Remove Member" },
  { value: "change_role", label: "Change Role" },
  { value: "create_custom_role", label: "Create Custom Role" },
];

export function ExportLogsDialog({ open, onClose, onExport }: ExportLogsDialogProps) {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [actionType, setActionType] = useState<string>("all");
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    try {
      setExporting(true);
      await onExport(
        startDate || null,
        endDate || null,
        actionType === "all" ? null : actionType
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base md:text-lg">Export Audit Logs</DialogTitle>
          <DialogDescription className="text-sm">
            Configure filters and download audit logs as CSV
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm">Action Type</Label>
            <Select value={actionType} onValueChange={setActionType}>
              <SelectTrigger className="min-h-[48px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {actionTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm">Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full min-h-[48px] justify-start text-left font-normal text-sm",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full min-h-[48px] justify-start text-left font-normal text-sm",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {(startDate || endDate || actionType !== "all") && (
            <div className="bg-muted p-3 rounded-lg text-sm">
              <p className="font-medium mb-1">Export Summary</p>
              <ul className="text-muted-foreground space-y-1">
                {actionType !== "all" && (
                  <li>• Filter: {actionTypes.find(t => t.value === actionType)?.label}</li>
                )}
                {startDate && <li>• From: {format(startDate, "PPP")}</li>}
                {endDate && <li>• To: {format(endDate, "PPP")}</li>}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} disabled={exporting} className="w-full sm:w-auto min-h-[48px]">
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={exporting} className="w-full sm:w-auto min-h-[48px]">
            <Download className="h-4 w-4 mr-2" />
            {exporting ? "Exporting..." : "Export CSV"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
