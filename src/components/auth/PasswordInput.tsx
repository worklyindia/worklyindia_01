import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const PasswordInput = forwardRef<HTMLInputElement, React.ComponentProps<typeof Input>>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative">
        <Input {...props} ref={ref} type={visible ? 'text' : 'password'} className={cn(className, 'pr-12')} />
        <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 h-10 w-10 -translate-y-1/2 text-muted-foreground" aria-label={visible ? 'Hide password' : 'Show password'} title={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} onClick={() => setVisible(!visible)}>
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
    );
  },
);
PasswordInput.displayName = 'PasswordInput';