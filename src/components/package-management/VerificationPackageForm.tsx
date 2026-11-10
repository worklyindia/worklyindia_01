import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

const verificationPackageSchema = z.object({
  name: z.string().min(1, 'Package name is required'),
  price_inr: z.number().min(1, 'Price must be greater than 0'),
  validity_days: z.number().min(1, 'Validity days must be greater than 0'),
  badge_color: z.string().min(1, 'Badge color is required'),
  sort_order: z.number().min(0, 'Sort order must be 0 or greater'),
  is_active: z.boolean(),
  most_popular: z.boolean()
});

type VerificationPackageFormData = z.infer<typeof verificationPackageSchema>;

interface VerificationPackageFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: VerificationPackageFormData) => Promise<void>;
  initialData?: Partial<VerificationPackageFormData>;
  isEdit?: boolean;
}

const badgeColors = [
  { value: 'gold', label: 'Gold', color: '#ffd700', textColor: '#000' },
  { value: 'blue', label: 'Blue', color: '#3b82f6', textColor: '#fff' },
  { value: 'silver', label: 'Silver', color: '#c0c0c0', textColor: '#000' },
  { value: 'green', label: 'Green', color: '#10b981', textColor: '#fff' }
];

export function VerificationPackageForm({
  open,
  onClose,
  onSubmit,
  initialData,
  isEdit = false
}: VerificationPackageFormProps) {
  const form = useForm<VerificationPackageFormData>({
    resolver: zodResolver(verificationPackageSchema),
    defaultValues: {
      name: '',
      price_inr: undefined,
      validity_days: undefined,
      badge_color: 'gold',
      sort_order: 0,
      is_active: true,
      most_popular: false
    }
  });

  useEffect(() => {
    if (open && initialData) {
      form.reset({
        name: initialData.name || '',
        price_inr: initialData.price_inr || undefined,
        validity_days: initialData.validity_days || undefined,
        badge_color: initialData.badge_color || 'gold',
        sort_order: initialData.sort_order || 0,
        is_active: initialData.is_active ?? true,
        most_popular: initialData.most_popular ?? false
      });
    } else if (open && !initialData) {
      form.reset({
        name: '',
        price_inr: undefined,
        validity_days: undefined,
        badge_color: 'gold',
        sort_order: 0,
        is_active: true,
        most_popular: false
      });
    }
  }, [open, initialData, form]);

  const handleSubmit = async (data: VerificationPackageFormData) => {
    try {
      await onSubmit(data);
      form.reset();
      onClose();
    } catch (error) {
      // Error is handled in the parent component
    }
  };

  const selectedColor = form.watch('badge_color');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit Verification Package' : 'Create Verification Package'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Package Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Gold Verification" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="price_inr"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price (INR)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="e.g., 299"
                      {...field}
                      value={field.value || ''}
                      onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="validity_days"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Validity Days</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="e.g., 365"
                      {...field}
                      value={field.value || ''}
                      onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="badge_color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Badge Color</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select badge color" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {badgeColors.map(color => (
                        <SelectItem key={color.value} value={color.value}>
                          <div className="flex items-center space-x-2">
                            <Badge 
                              variant="outline"
                              style={{ 
                                backgroundColor: color.color,
                                color: color.textColor 
                              }}
                            >
                              {color.label}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedColor && (
                    <div className="mt-2">
                      <span className="text-sm text-muted-foreground">Preview: </span>
                      <Badge 
                        variant="outline"
                        style={{ 
                          backgroundColor: badgeColors.find(c => c.value === selectedColor)?.color,
                          color: badgeColors.find(c => c.value === selectedColor)?.textColor 
                        }}
                      >
                        Verified
                      </Badge>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sort_order"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sort Order</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="e.g., 1"
                      {...field}
                      value={field.value || ''}
                      onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <FormLabel>Active</FormLabel>
                  <FormControl>
                    <Switch 
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="most_popular"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <FormLabel>Most Popular</FormLabel>
                  <FormControl>
                    <Switch 
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Saving...' : (isEdit ? 'Update' : 'Create')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}