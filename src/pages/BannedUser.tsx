import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, AlertTriangle, Mail } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import SEO from "@/components/SEO";

const BannedUser = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 flex items-center justify-center p-4">
      <SEO 
        title="Account Suspended - Workly India"
        description="Your account has been temporarily suspended. Contact support for assistance."
        noindex={true}
      />
      
      <Card className="max-w-2xl w-full p-8 text-center shadow-lg border-red-200">
        <div className="space-y-6">
          {/* Icon */}
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <Shield className="w-8 h-8 text-red-600" />
          </div>

          {/* Heading */}
          <div>
            <h1 className="text-3xl font-bold text-red-900 mb-2">
              Account Suspended
            </h1>
            <p className="text-red-700 text-lg">
              Your account access has been temporarily restricted
            </p>
          </div>

          {/* Reason */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-left">
                <h3 className="font-semibold text-red-900 mb-1">Suspension Reason</h3>
                <p className="text-red-700 text-sm">
                  {profile?.account_status_reason || 'Your account has been suspended by the administrator for violating our terms of service.'}
                </p>
              </div>
            </div>
          </div>

          {/* What this means */}
          <div className="text-left space-y-3">
            <h3 className="font-semibold text-foreground">What this means:</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start space-x-2">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full mt-2 flex-shrink-0"></span>
                <span>You cannot browse or apply for jobs</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full mt-2 flex-shrink-0"></span>
                <span>Your profile and saved jobs are temporarily hidden</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full mt-2 flex-shrink-0"></span>
                <span>Notifications and job alerts are disabled</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full mt-2 flex-shrink-0"></span>
                <span>Company directory access is restricted</span>
              </li>
            </ul>
          </div>

          {/* Contact Support */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-3">Need Help?</h3>
            <p className="text-blue-700 text-sm mb-4">
              If you believe this suspension was made in error or would like to appeal, please contact our support team:
            </p>
            <Button
              asChild
              variant="default"
              className="w-full"
            >
              <Link to="/contact-us" className="flex items-center justify-center space-x-2">
                <Mail className="w-4 h-4" />
                <span>Contact Us</span>
              </Link>
            </Button>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Button 
              onClick={handleSignOut}
              variant="outline"
              className="w-full"
            >
              Sign Out
            </Button>
            <p className="text-xs text-muted-foreground">
              You can sign back in after your account is reactivated
            </p>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Workly India - Remote Jobs Platform
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default BannedUser;