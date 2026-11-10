import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatDateWithTime } from '@/utils/dateFormatUtils';
import { Globe, Info } from 'lucide-react';
import { useJobSeekerProfileRealtime } from '@/hooks/useProfileRealtime';
import { DeviceInfoSheet } from '@/components/DeviceInfoSheet';

interface LastLoginInfoProps {
  userId: string | undefined;
}

interface LoginInfo {
  lastLoginIp: string | null;
  lastLoginAt: string | null;
}

export const LastLoginInfo: React.FC<LastLoginInfoProps> = ({ userId }) => {
  const [loginInfo, setLoginInfo] = useState<LoginInfo>({
    lastLoginIp: null,
    lastLoginAt: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showDeviceInfo, setShowDeviceInfo] = useState(false);

  const fetchLoginInfo = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('last_login_ip, last_login_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching login info:', error);
        return;
      }

      if (data) {
        setLoginInfo({
          lastLoginIp: data.last_login_ip,
          lastLoginAt: data.last_login_at,
        });
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchLoginInfo();
  }, [fetchLoginInfo]);

  // Real-time updates for last login info
  useJobSeekerProfileRealtime(userId, (updatedProfile) => {
    if (updatedProfile.last_login_at || updatedProfile.last_login_ip) {
      console.log('🔄 Real-time last login update received:', {
        last_login_at: updatedProfile.last_login_at,
        last_login_ip: updatedProfile.last_login_ip
      });
      setLoginInfo({
        lastLoginIp: updatedProfile.last_login_ip ?? loginInfo.lastLoginIp,
        lastLoginAt: updatedProfile.last_login_at ?? loginInfo.lastLoginAt,
      });
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Globe className="h-3 w-3 animate-pulse" />
        <span>Loading...</span>
      </div>
    );
  }

  if (!loginInfo.lastLoginIp && !loginInfo.lastLoginAt) {
    return null;
  }

  return (
    <>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Globe className="h-3 w-3 flex-shrink-0" />
        <span className="truncate">
          {loginInfo.lastLoginIp && (
            <span className="font-mono">{loginInfo.lastLoginIp}</span>
          )}
          {loginInfo.lastLoginAt && (
            <span> • {formatDateWithTime(loginInfo.lastLoginAt)}</span>
          )}
        </span>
        <button
          onClick={() => setShowDeviceInfo(true)}
          className="p-0.5 rounded-full hover:bg-accent transition-colors flex-shrink-0"
          title="Device Information"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </div>
      <DeviceInfoSheet isOpen={showDeviceInfo} onClose={() => setShowDeviceInfo(false)} />
    </>
  );
};
