import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Lock, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { validatePassword } from '@/utils/authErrorHandler';

interface PasswordResetFormProps {
  isEmployer?: boolean;
}

const PasswordResetForm = ({ isEmployer = false }: PasswordResetFormProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [tokenError, setTokenError] = useState(false);

  // Verify token exists on mount
  useState(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    
    if (!accessToken) {
      setTokenError(true);
      toast({
        variant: "destructive",
        title: "Invalid Link",
        description: "Password reset link is invalid or has expired. Please request a new one."
      });
      
      setTimeout(() => {
        navigate(isEmployer ? '/employer-auth' : '/auth');
      }, 3000);
    }
  });

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (tokenError) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please request a new password reset link"
      });
      return;
    }
    
    // Validate password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      toast({
        variant: "destructive",
        title: "Invalid Password",
        description: passwordValidation.message
      });
      return;
    }

    // Check if passwords match
    if (newPassword !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Passwords Don't Match",
        description: "Password and confirm password must match"
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        // Handle specific token errors
        if (error.message.includes('session') || error.message.includes('token')) {
          toast({
            variant: "destructive",
            title: "Link Expired",
            description: "Password reset link has expired. Please request a new one."
          });
          
          setTimeout(() => {
            navigate(isEmployer ? '/employer-auth' : '/auth');
          }, 2000);
        } else {
          toast({
            variant: "destructive",
            title: "Error",
            description: error.message
          });
        }
      } else {
        toast({
          title: "Success",
          description: "Your password has been updated successfully!",
          action: (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          )
        });
        
        // Sign out to clear any stale session and redirect to appropriate page
        await supabase.auth.signOut();
        
        // Redirect to appropriate page after 2 seconds
        setTimeout(() => {
          if (isEmployer) {
            navigate('/employer-portal');
          } else {
            navigate('/');
          }
        }, 2000);
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Something went wrong. Please try again."
      });
    }

    setIsLoading(false);
  };

  // If token error, show error state
  if (tokenError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <Card className="w-full max-w-md shadow-2xl border-0 bg-card/80 backdrop-blur-sm">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl font-bold">
              Invalid Link
            </CardTitle>
            <CardDescription>
              Password reset link is invalid or has expired
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Please request a new password reset link
            </p>
            <Button 
              className="w-full"
              onClick={() => navigate(isEmployer ? '/employer-auth' : '/auth')}
            >
              Go to Login Page
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <Card className="w-full max-w-md shadow-2xl border-0 bg-card/80 backdrop-blur-sm">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-r from-primary to-secondary rounded-full flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">
            Set New Password
          </CardTitle>
          <CardDescription>
            Please enter your new password
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handlePasswordReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="bg-muted/50 p-3 rounded-lg text-sm text-muted-foreground">
              <p className="font-medium mb-1">Password Requirements:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>At least 6 characters</li>
                <li>Both passwords must match</li>
              </ul>
            </div>
            
            <Button 
              type="submit" 
              className="w-full bg-gradient-to-r from-primary to-secondary"
              disabled={isLoading}
            >
              {isLoading ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default PasswordResetForm;
