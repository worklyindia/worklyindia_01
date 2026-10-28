import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Shield, CheckCircle, Crown } from 'lucide-react';

export default function AdminAccessButton() {
  const [loading, setLoading] = useState(false);
  const [hasAdmin, setHasAdmin] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const { user } = useAuth();

  // Check if user already has admin access
  useEffect(() => {
    const checkExistingAdminStatus = async () => {
      if (!user) {
        setCheckingStatus(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('admin_users')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!error && data && ['admin', 'owner'].includes(data.role)) {
          setHasAdmin(true);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
      } finally {
        setCheckingStatus(false);
      }
    };

    checkExistingAdminStatus();
  }, [user]);

  const grantAdminAccess = async () => {
    if (!user) {
      toast.error('Please log in first');
      return;
    }

    setLoading(true);
    try {
      // Call the function to grant admin access
      const { error } = await supabase.rpc('grant_admin_access');
      
      if (error) {
        console.error('Error granting admin access:', error);
        toast.error('Failed to grant admin access: ' + error.message);
      } else {
        setHasAdmin(true);
        toast.success('Admin access granted! You can now access admin features.');
      }
    } catch (err) {
      console.error('Error:', err);
      toast.error('Failed to grant admin access');
    } finally {
      setLoading(false);
    }
  };

  if (checkingStatus) {
    return (
      <div className="p-4 bg-muted rounded-lg animate-pulse">
        <div className="h-4 bg-muted-foreground/20 rounded w-3/4"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-4 bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground">Please log in to access admin features</p>
      </div>
    );
  }

  if (hasAdmin) {
    return (
      <div className="p-4 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg">
        <div className="flex items-center gap-3 mb-3">
          <Crown className="w-6 h-6 text-yellow-600" />
          <div>
            <h3 className="font-semibold text-green-800">Owner Access Active</h3>
            <p className="text-sm text-green-700">You have full administrative privileges</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button 
            size="sm" 
            onClick={() => window.location.href = '/owner-portal/website-users'}
            className="text-xs"
          >
            Website Users
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => window.location.href = '/owner-portal'}
            className="text-xs"
          >
            Owner Portal
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <Shield className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-blue-900">Admin Access Required</h3>
      </div>
      <p className="text-sm text-blue-800 mb-3">
        You need admin privileges to access the Website Users Management page.
      </p>
      <Button 
        onClick={grantAdminAccess} 
        disabled={loading}
        className="w-full"
      >
        {loading ? 'Granting Access...' : 'Grant Admin Access'}
      </Button>
    </div>
  );
}