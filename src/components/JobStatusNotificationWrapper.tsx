import React, { useContext } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import { useJobStatusNotifications } from '@/hooks/useJobStatusNotifications';

interface JobStatusNotificationWrapperProps {
  children: React.ReactNode;
}

export const JobStatusNotificationWrapper: React.FC<JobStatusNotificationWrapperProps> = ({ children }) => {
  const authContext = useContext(AuthContext);

  if (!authContext) {
    return <>{children}</>;
  }

  return <JobStatusNotificationInitializer>{children}</JobStatusNotificationInitializer>;
};

const JobStatusNotificationInitializer: React.FC<JobStatusNotificationWrapperProps> = ({ children }) => {
  useJobStatusNotifications();
  return <>{children}</>;
};