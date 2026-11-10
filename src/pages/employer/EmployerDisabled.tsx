import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldOff, Mail, Phone } from "lucide-react";
import { useNavigate } from "react-router-dom";

const EmployerDisabled = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldOff className="w-8 h-8 text-red-600" />
          </div>
          <CardTitle className="text-xl text-red-800">Account Disabled</CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4 text-center">
          <p className="text-muted-foreground">
            Your employer account has been temporarily disabled. You cannot access employer features at this time.
          </p>
          
          <div className="bg-red-50 p-4 rounded-lg">
            <p className="text-sm text-red-700 font-medium">
              If you believe this is an error, please contact our support team for assistance.
            </p>
          </div>
          
          <div className="flex flex-col gap-2">
            <Button variant="outline" className="w-full" asChild>
              <a href="/contact-us">
                <Mail className="w-4 h-4 mr-2" />
                Contact Support
              </a>
            </Button>
            
            <Button variant="outline" className="w-full" asChild>
              <a href="/help-center">
                <Phone className="w-4 h-4 mr-2" />
                Help Center
              </a>
            </Button>
          </div>
          
          <Button 
            variant="ghost" 
            className="w-full"
            onClick={() => navigate('/')}
          >
            Return to Homepage
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployerDisabled;