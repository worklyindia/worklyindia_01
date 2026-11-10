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

const boostPackageSchema = z.object({
  name: z.string().min(1, 'Package name is required'),
  price_inr: z.number().min(1, 'Price must be greater than 0'),
  boost_days: z.number().min(1, 'Boost days must be greater than 0'),
  boost_level: z.number().min(1).max(5, 'Boost level must be between 1-5'),
  sort_order: z.number().min(0, 'Sort order must be 0 or greater'),
  is_active: z.boolean(),
  most_popular: z.boolean()
});

type BoostPackageFormData = z.infer<typeof boostPackageSchema>;

interface BoostPackageFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: BoostPackageFormData) => Promise<void>;
  initialData?: Partial<BoostPackageFormData>;
  isEdit?: boolean;
}

export function BoostPackageForm({
  open,
  onClose,
  onSubmit,
  initialData,
  isEdit = false
}: BoostPackageFormProps) {
  const form = useForm<BoostPackageFormData>({
    resolver: zodResolver(boostPackageSchema),
    defaultValues: {
      name: '',
      price_inr: undefined,
      boost_days: undefined,
      boost_level: 1,
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
        boost_days: initialData.boost_days || undefined,
        boost_level: initialData.boost_level || 1,
        sort_order: initialData.sort_order || 0,
        is_active: initialData.is_active ?? true,
        most_popular: initialData.most_popular ?? false
      });
    } else if (open && !initialData) {
      form.reset({
        name: '',
        price_inr: undefined,
        boost_days: undefined,
        boost_level: 1,
        sort_order: 0,
        is_active: true,
        most_popular: false
      });
    }
  }, [open, initialData, form]);

  const handleSubmit = async (data: BoostPackageFormData) => {
    try {
      await onSubmit(data);
      form.reset();
      onClose();
    } catch (error) {
      // Error is handled in the parent component
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit Boost Package' : 'Create Boost Package'}
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
                    <Input placeholder="e.g., Premium Boost" {...field} />
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
                      placeholder="e.g., 199"
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
              name="boost_days"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Boost Days</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="e.g., 7"
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
              name="boost_level"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Boost Level</FormLabel>
                  <Select 
                    value={field.value.toString()} 
                    onValueChange={(value) => field.onChange(parseInt(value))}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select boost level" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map(level => (
                        <SelectItem key={level} value={level.toString()}>
                          Level {level} ({level * 100}x multiplier)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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