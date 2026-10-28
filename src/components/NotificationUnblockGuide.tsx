import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BellRing, RefreshCw } from 'lucide-react';

type Platform = 'android-chrome' | 'ios-safari' | 'desktop';

const detectPlatform = (): Platform => {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios-safari';
  if (/Android/i.test(ua)) return 'android-chrome';
  return 'desktop';
};

const STEPS: Record<Platform, { title: string; steps: string[] }> = {
  'android-chrome': {
    title: 'Allow notifications on your phone',
    steps: [
      'Tap the lock / info icon next to the website address at the top.',
      'Tap "Permissions".',
      'Tap "Notifications" and choose "Allow".',
      'Come back here and tap "I have allowed it".',
    ],
  },
  'ios-safari': {
    title: 'Allow notifications on iPhone',
    steps: [
      'Add this site to your Home Screen (Share → Add to Home Screen) if you have not already.',
      'Open the app from the Home Screen icon.',
      'Open iPhone Settings → Notifications → find this app → turn on "Allow Notifications".',
      'Come back here and tap "I have allowed it".',
    ],
  },
  desktop: {
    title: 'Allow notifications in your browser',
    steps: [
      'Click the lock / info icon on the left of the address bar.',
      'Find "Notifications" in the list.',
      'Change it to "Allow".',
      'Reload the page, then tap "I have allowed it".',
    ],
  },
};

interface NotificationUnblockGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRecheck: () => void;
  isChecking?: boolean;
}

export const NotificationUnblockGuide: React.FC<NotificationUnblockGuideProps> = ({
  open,
  onOpenChange,
  onRecheck,
  isChecking,
}) => {
  const platform = detectPlatform();
  const { title, steps } = STEPS[platform];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>
            Notifications are currently blocked for this site. Follow these steps to turn them back on.
          </DialogDescription>
        </DialogHeader>

        <ol className="space-y-3 text-sm">
          {steps.map((step, index) => (
            <li key={step} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {index + 1}
              </span>
              <span className="text-muted-foreground">{step}</span>
            </li>
          ))}
        </ol>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={onRecheck} disabled={isChecking} className="w-full">
            <RefreshCw className={`mr-2 h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
            {isChecking ? 'Checking...' : 'I have allowed it'}
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NotificationUnblockGuide;
