import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, User, Shield, Database, AlertCircle } from 'lucide-react';

export const AdminDebugPanel: React.FC = () => {
  const { user, session } = useAuth();
  const [adminStatus, setAdminStatus] = useState<any>(null);
  const [checking, setChecking] = useState(false);

  const checkAdminStatus = async () => {
    setChecking(true);
    try {
      if (!user) {
        setAdminStatus({ status: 'no_user', message: 'No authenticated user' });
        return;
      }

      // Check admin_users table
      const { data: adminData, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        setAdminStatus({
          status: 'error',
          message: `Database error: ${error.message}`,
          error: error
        });
      } else if (adminData) {
        setAdminStatus({
          status: 'admin',
          message: `Admin role: ${adminData.role}`,
          data: adminData
        });
      } else {
        setAdminStatus({
          status: 'no_admin',
          message: 'User exists but no admin role found'
        });
      }
    } catch (err: any) {
      setAdminStatus({
        status: 'error',
        message: `Error: ${err.message}`,
        error: err
      });
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkAdminStatus();
  }, [user]);

  const handleRefreshSession = async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        console.error('Session refresh error:', error);
      } else {
        console.log('Session refreshed successfully');
        checkAdminStatus();
      }
    } catch (err) {
      console.error('Session refresh failed:', err);
    }
  };

  const getStatusBadge = () => {
    if (!adminStatus) return <Badge variant="secondary">Checking...</Badge>;
    
    switch (adminStatus.status) {
      case 'admin':
        return <Badge variant="default" className="bg-green-500">Admin Access</Badge>;
      case 'no_user':
        return <Badge variant="destructive">Not Logged In</Badge>;
      case 'no_admin':
        return <Badge variant="secondary">No Admin Role</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Admin Debug Panel
          <Button
            onClick={checkAdminStatus}
            disabled={checking}
            size="sm"
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Authentication Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              Authentication Status
            </span>
            {getStatusBadge()}
          </div>
          
          {user && (
            <div className="text-sm text-muted-foreground space-y-1">
              <div>Email: {user.email}</div>
              <div>User ID: {user.id.substring(0, 8)}...</div>
              <div>Last Sign In: {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'Never'}</div>
            </div>
          )}
        </div>

        <Separator />

        {/* Session Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium flex items-center gap-2">
              <Database className="h-4 w-4" />
              Session Status
            </span>
            <Badge variant={session ? "default" : "destructive"}>
              {session ? 'Active' : 'No Session'}
            </Badge>
          </div>
          
          {session && (
            <div className="text-sm text-muted-foreground space-y-1">
              <div>Access Token: {session.access_token.substring(0, 20)}...</div>
              <div>Expires At: {new Date(session.expires_at! * 1000).toLocaleString()}</div>
            </div>
          )}
        </div>

        <Separator />

        {/* Admin Status Details */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Admin Status Details
            </span>
          </div>
          
          {adminStatus && (
            <div className="text-sm space-y-2">
              <div>Status: {adminStatus.status}</div>
              <div>Message: {adminStatus.message}</div>
              
              {adminStatus.data && (
                <div className="bg-muted p-2 rounded text-xs">
                  <pre>{JSON.stringify(adminStatus.data, null, 2)}</pre>
                </div>
              )}
              
              {adminStatus.error && (
                <div className="bg-destructive/10 p-2 rounded text-xs">
                  <pre>{JSON.stringify(adminStatus.error, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </div>

        <Separator />

        {/* Quick Actions */}
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={handleRefreshSession}
            variant="outline"
            size="sm"
          >
            Refresh Session
          </Button>
          
          {!user && (
            <Button asChild size="sm">
              <a href="/auth">Sign In</a>
            </Button>
          )}
          
          {user && adminStatus?.status !== 'admin' && (
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              size="sm"
            >
              Reload Page
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};