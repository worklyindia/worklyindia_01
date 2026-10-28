import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface VerificationPackage {
  id: string;
  name: string;
  price_inr: number;
  validity_days: number;
  badge_color: string;
  is_active: boolean;
  sort_order: number;
  most_popular: boolean;
}

export const useVerificationPackages = () => {
  const [packages, setPackages] = useState<VerificationPackage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      const { data, error } = await supabase
        .from('verification_packages')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setPackages(data || []);
    } catch (error) {
      console.error('Error fetching verification packages:', error);
      toast.error('Failed to load verification packages');
    } finally {
      setLoading(false);
    }
  };

  const createPackage = async (packageData: Omit<VerificationPackage, 'id'>) => {
    try {
      const { data, error } = await supabase
        .from('verification_packages')
        .insert(packageData)
        .select()
        .single();

      if (error) throw error;
      setPackages(prev => [...prev, data]);
      toast.success('Verification package created successfully');
      return data;
    } catch (error) {
      console.error('Error creating verification package:', error);
      toast.error('Failed to create verification package');
      throw error;
    }
  };

  const updatePackage = async (id: string, packageData: Partial<VerificationPackage>) => {
    try {
      const { data, error } = await supabase
        .from('verification_packages')
        .update(packageData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setPackages(prev => prev.map(pkg => pkg.id === id ? data : pkg));
      toast.success('Verification package updated successfully');
      return data;
    } catch (error) {
      console.error('Error updating verification package:', error);
      toast.error('Failed to update verification package');
      throw error;
    }
  };

  const deletePackage = async (id: string) => {
    try {
      const { error } = await supabase
        .from('verification_packages')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setPackages(prev => prev.filter(pkg => pkg.id !== id));
      toast.success('Verification package deleted successfully');
    } catch (error) {
      console.error('Error deleting verification package:', error);
      toast.error('Failed to delete verification package');
      throw error;
    }
  };

  return {
    packages,
    loading,
    refetch: fetchPackages,
    createPackage,
    updatePackage,
    deletePackage
  };
};