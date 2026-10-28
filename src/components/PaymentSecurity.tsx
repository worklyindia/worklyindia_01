import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Lock, CreditCard, Phone, AlertTriangle, CheckCircle } from "lucide-react";

const PaymentSecurity = () => {
  return (
    <section className="py-8 bg-muted/30">
      <div className="container mx-auto px-4 lg:px-6 xl:px-8 max-w-6xl">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
            Payment Protection & Security
          </h2>
          <p className="text-lg text-muted-foreground">
            Your financial security is guaranteed with industry-leading protection
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Security Features */}
          <Card className="p-6">
            <div className="flex items-center mb-4">
              <Shield className="w-6 h-6 text-green-600 mr-3" />
              <h3 className="text-xl font-semibold text-foreground">Security Guarantee</h3>
            </div>
            <ul className="space-y-3">
              <li className="flex items-start">
                <CheckCircle className="w-5 h-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-foreground">256-bit SSL Encryption</p>
                  <p className="text-sm text-muted-foreground">Bank-grade security for all transactions</p>
                </div>
              </li>
              <li className="flex items-start">
                <CheckCircle className="w-5 h-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-foreground">PCI DSS Compliant</p>
                  <p className="text-sm text-muted-foreground">Payment Card Industry standards</p>
                </div>
              </li>
              <li className="flex items-start">
                <CheckCircle className="w-5 h-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-foreground">RBI Approved Partners</p>
                  <p className="text-sm text-muted-foreground">Authorized payment gateways only</p>
                </div>
              </li>
            </ul>
          </Card>

          {/* Payment Process */}
          <Card className="p-6">
            <div className="flex items-center mb-4">
              <CreditCard className="w-6 h-6 text-blue-600 mr-3" />
              <h3 className="text-xl font-semibold text-foreground">How Payments Work</h3>
            </div>
            <div className="space-y-4">
              <div className="flex items-start">
                <Badge variant="secondary" className="mr-3 mt-1">1</Badge>
                <div>
                  <p className="font-medium text-foreground">Job Seekers Apply Free</p>
                  <p className="text-sm text-muted-foreground">Never pay for job applications</p>
                </div>
              </div>
              <div className="flex items-start">
                <Badge variant="secondary" className="mr-3 mt-1">2</Badge>
                <div>
                  <p className="font-medium text-foreground">Employers Pay Platform Fee</p>
                  <p className="text-sm text-muted-foreground">Companies pay for job posting services</p>
                </div>
              </div>
              <div className="flex items-start">
                <Badge variant="secondary" className="mr-3 mt-1">3</Badge>
                <div>
                  <p className="font-medium text-foreground">Secure Payment Processing</p>
                  <p className="text-sm text-muted-foreground">All payments via certified gateways</p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Warning Alert */}
        <Card className="p-6 mt-8 border-l-4 border-l-red-500 bg-red-50/50">
          <div className="flex items-start">
            <AlertTriangle className="w-6 h-6 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-red-900 mb-2">Fraud Prevention Notice</h4>
              <p className="text-sm text-red-800 mb-3">
                <strong>Workly India NEVER asks job seekers for any payment.</strong> If someone asks you to pay for job applications, interviews, or training, it's a scam.
              </p>
              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center">
                  <Phone className="w-4 h-4 text-red-600 mr-1" />
                  <span className="text-red-800">Report: +91 9904923067</span>
                </div>
                <div className="flex items-center">
                  <Shield className="w-4 h-4 text-red-600 mr-1" />
                  <span className="text-red-800">File complaint instantly</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
        
        <div className="text-center mt-8">
          <p className="text-sm text-muted-foreground">
            Questions about payments? Contact our support team 24/7 at{" "}
            <a href="tel:+919904923067" className="text-primary hover:underline">
              +91 9904923067
            </a>
          </p>
        </div>
      </div>
    </section>
  );
};

export default PaymentSecurity;