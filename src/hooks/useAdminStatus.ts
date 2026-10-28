import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useAdminStatus = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        console.log('👤 useAdminStatus: No user found');
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      console.log('🔍 useAdminStatus: Checking admin status for user:', user.id);

      try {
        // Query admin_users table directly
        const { data: adminData, error } = await supabase
          .from('admin_users')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

        console.log('📊 useAdminStatus: Query response:', { adminData, error });

        if (error) {
          console.error('❌ useAdminStatus: Error checking admin status:', error);
          setIsAdmin(false);
        } else {
          const isAdminUser = !!adminData && ['admin', 'owner'].includes(adminData.role);
          console.log(`✅ useAdminStatus: Admin status = ${isAdminUser}`);
          setIsAdmin(isAdminUser);
        }
      } catch (error) {
        console.error('❌ useAdminStatus: Catch error:', error);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, [user]);

  return { isAdmin, loading };
};