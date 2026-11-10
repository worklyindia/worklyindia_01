import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldX, ArrowLeft, Mail } from "lucide-react";

interface PermissionDeniedErrorProps {
  title?: string;
  message?: string;
}

export const PermissionDeniedError = ({ 
  title = "Access Denied",
  message = "You don't have permission to view this page."
}: PermissionDeniedErrorProps) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg border-2 shadow-xl">
        <CardContent className="pt-12 pb-8 px-6 text-center">
          {/* Animated Lock Icon */}
          <div className="mb-6 flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-red-500/20 rounded-full blur-2xl animate-pulse"></div>
              <div className="relative w-24 h-24 bg-gradient-to-br from-red-500 to-orange-600 rounded-full flex items-center justify-center shadow-lg">
                <ShieldX className="w-12 h-12 text-white" />
              </div>
            </div>
          </div>

          {/* Error Message */}
          <h1 className="text-3xl font-bold text-foreground mb-3">
            {title}
          </h1>
          <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
            {message}
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={() => navigate(-1)}
              variant="outline"
              size="lg"
              className="min-w-[140px]"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
            <Button
              onClick={() => navigate('/contact-us')}
              size="lg"
              className="min-w-[140px] bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              <Mail className="w-4 h-4 mr-2" />
              Contact Us
            </Button>
          </div>

          {/* Additional Info */}
          <div className="mt-8 pt-6 border-t">
            <p className="text-sm text-muted-foreground">
              Need access? Please contact your administrator or reach out to our support team.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
