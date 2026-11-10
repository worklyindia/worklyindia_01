import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useCleanupSettings,
  timeOptions,
  categoryLabels,
  defaultSettings,
  CleanupSettings,
  CleanupSetting,
} from '@/hooks/useCleanupSettings';
import {
  Trash2,
  Save,
  RotateCcw,
  Loader2,
  Zap,
  Clock,
  Shield,
  Database,
  MessageSquare,
  Bell,
  FileText,
  Activity,
  Users,
  Key,
  Timer,
} from 'lucide-react';

const iconMap: Record<keyof CleanupSettings, React.ReactNode> = {
  otp_codes: <Key className="w-4 h-4 text-orange-500" />,
  live_sessions: <Users className="w-4 h-4 text-blue-500" />,
  api_health_checks: <Activity className="w-4 h-4 text-green-500" />,
  api_request_logs: <FileText className="w-4 h-4 text-purple-500" />,
  function_logs: <Zap className="w-4 h-4 text-yellow-500" />,
  notifications: <Bell className="w-4 h-4 text-red-500" />,
  chat_messages: <MessageSquare className="w-4 h-4 text-cyan-500" />,
  cached_audio: <Database className="w-4 h-4 text-pink-500" />,
  ai_response_cache: <Shield className="w-4 h-4 text-indigo-500" />,
  cleanup_logs: <Clock className="w-4 h-4 text-gray-500" />,
  daily_visitors: <Users className="w-4 h-4 text-teal-500" />,
  cron_history: <Timer className="w-4 h-4 text-rose-500" />,
};

const getTimeOptionKey = (setting: CleanupSetting): string => {
  return `${setting.value}-${setting.unit}`;
};

const parseTimeOptionKey = (key: string): { value: number; unit: CleanupSetting['unit'] } => {
  const [value, unit] = key.split('-');
  return { value: parseInt(value), unit: unit as CleanupSetting['unit'] };
};

export function CleanupPowerSettings() {
  const {
    settings,
    isLoading,
    isSaving,
    isCleaningTable,
    fetchSettings,
    saveSettings,
    updateSetting,
    toggleSetting,
    cleanTable,
    cleanAllTables,
    resetToDefaults,
  } = useCleanupSettings();

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleTimeChange = (key: keyof CleanupSettings, optionKey: string) => {
    const { value, unit } = parseTimeOptionKey(optionKey);
    updateSetting(key, value, unit);
  };

  const handleSave = () => {
    saveSettings(settings);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <Card className="border-primary/20">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 sm:flex-none"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Settings
            </Button>
            <Button
              variant="destructive"
              onClick={cleanAllTables}
              disabled={isCleaningTable !== null}
              className="flex-1 sm:flex-none"
            >
              {isCleaningTable === 'all' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Clean All Now
            </Button>
            <Button
              variant="outline"
              onClick={resetToDefaults}
              className="flex-1 sm:flex-none"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset Defaults
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Settings Grid */}
      <div className="grid gap-3">
        {(Object.keys(categoryLabels) as Array<keyof CleanupSettings>).map((key) => {
          const setting = settings[key];
          const label = categoryLabels[key];
          const isCurrentlyCleaning = isCleaningTable === key;

          return (
            <Card key={key} className={`transition-all ${setting.enabled ? 'border-primary/30' : 'opacity-60'}`}>
              <CardContent className="p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* Icon & Label */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      {iconMap[key]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{label.title}</div>
                      <div className="text-xs text-muted-foreground truncate">{label.description}</div>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-2 sm:gap-3">
                    {/* Enable Switch */}
                    <Switch
                      checked={setting.enabled}
                      onCheckedChange={() => toggleSetting(key)}
                      className="shrink-0"
                    />

                    {/* Time Selector */}
                    <Select
                      value={getTimeOptionKey(setting)}
                      onValueChange={(val) => handleTimeChange(key, val)}
                      disabled={!setting.enabled}
                    >
                      <SelectTrigger className="w-[110px] sm:w-[130px] h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {timeOptions.map((opt) => (
                          <SelectItem
                            key={`${opt.value}-${opt.unit}`}
                            value={`${opt.value}-${opt.unit}`}
                            className="text-xs"
                          >
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Clean Now Button */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => cleanTable(key)}
                      disabled={!setting.enabled || isCleaningTable !== null}
                      className="h-9 px-3 shrink-0"
                    >
                      {isCurrentlyCleaning ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Info Card */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">How it works:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Select retention period for each data type</li>
                <li>Data older than selected time will be deleted on cleanup</li>
                <li>"Clean Now" button deletes old data immediately</li>
                <li>Settings are used by auto-cleanup system</li>
                <li>OTP & Sessions: 1 minute recommended (verify ke baad useless)</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
