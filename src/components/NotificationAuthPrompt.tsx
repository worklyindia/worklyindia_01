import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogIn, Bell, Users, Briefcase, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface NotificationAuthPromptProps {
  onLoginClick: () => void;
}

export const NotificationAuthPrompt: React.FC<NotificationAuthPromptProps> = ({ onLoginClick }) => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="border-2 border-primary/20 shadow-lg">
          <CardHeader className="text-center pb-6">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Bell className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-xl font-bold">
              Stay Updated with Notifications
            </CardTitle>
            <CardDescription className="text-base mt-2">
              Login to receive important updates about your job applications, interviews, and new opportunities.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-3">Get notified about:</p>
                <ul className="space-y-2 text-xs">
                  <li className="flex items-center">
                    <Users className="w-3 h-3 mr-2 flex-shrink-0" />
                    New job applications and status updates
                  </li>
                  <li className="flex items-center">
                    <Briefcase className="w-3 h-3 mr-2 flex-shrink-0" />
                    Matching job opportunities
                  </li>
                  <li className="flex items-center">
                    <Clock className="w-3 h-3 mr-2 flex-shrink-0" />
                    Interview confirmations and reminders
                  </li>
                  <li className="flex items-center">
                    <Bell className="w-3 h-3 mr-2 flex-shrink-0" />
                    Important system alerts
                  </li>
                </ul>
              </div>
            </div>
            
            <Button 
              onClick={onLoginClick}
              className="w-full py-3"
              size="lg"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Login to View Notifications
            </Button>
            
            <div className="text-center text-sm text-muted-foreground">
              <p>Don't have an account? <span className="text-primary cursor-pointer hover:underline" onClick={onLoginClick}>Sign up for free</span></p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};