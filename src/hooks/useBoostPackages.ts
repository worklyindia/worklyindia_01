import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BoostPackage {
  id: string;
  name: string;
  price_inr: number;
  boost_days: number;
  boost_level: number;
  is_active: boolean;
  sort_order: number;
  most_popular: boolean;
}

export const useBoostPackages = () => {
  const [packages, setPackages] = useState<BoostPackage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      const { data, error } = await supabase
        .from('boost_packages')
        .select('id, name, price_inr, boost_days, boost_level, is_active, sort_order, most_popular')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setPackages(data || []);
    } catch (error) {
      console.error('Error fetching boost packages:', error);
      toast.error('Failed to load boost packages');
    } finally {
      setLoading(false);
    }
  };

  const createPackage = async (packageData: Omit<BoostPackage, 'id'>) => {
    try {
      const { data, error } = await supabase
        .from('boost_packages')
        .insert(packageData)
        .select()
        .single();

      if (error) throw error;
      setPackages(prev => [...prev, data]);
      toast.success('Boost package created successfully');
      return data;
    } catch (error) {
      console.error('Error creating boost package:', error);
      toast.error('Failed to create boost package');
      throw error;
    }
  };

  const updatePackage = async (id: string, packageData: Partial<BoostPackage>) => {
    try {
      const { data, error } = await supabase
        .from('boost_packages')
        .update(packageData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setPackages(prev => prev.map(pkg => pkg.id === id ? data : pkg));
      toast.success('Boost package updated successfully');
      return data;
    } catch (error) {
      console.error('Error updating boost package:', error);
      toast.error('Failed to update boost package');
      throw error;
    }
  };

  const deletePackage = async (id: string) => {
    try {
      const { error } = await supabase
        .from('boost_packages')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setPackages(prev => prev.filter(pkg => pkg.id !== id));
      toast.success('Boost package deleted successfully');
    } catch (error) {
      console.error('Error deleting boost package:', error);
      toast.error('Failed to delete boost package');
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