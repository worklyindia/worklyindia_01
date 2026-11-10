import { Shield, CheckCircle, Award, Phone, Building, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const TrustIndicators = () => {
  const certifications = [
    {
      title: "Government Compliance",
      description: "Registered under Indian Company Law",
      icon: Building,
      status: "Verified",
      color: "bg-green-100 text-green-700"
    },
    {
      title: "SSL Security Certificate",
      description: "256-bit encryption for data protection",
      icon: Lock,
      status: "Active",
      color: "bg-blue-100 text-blue-700"
    },
    {
      title: "Payment Gateway Approved",
      description: "Certified by leading payment processors",
      icon: Shield,
      status: "Certified",
      color: "bg-purple-100 text-purple-700"
    },
    {
      title: "Business Registration",
      description: "UDYAM: UDYAM-GJ-18-0022888",
      icon: Award,
      status: "Valid",
      color: "bg-amber-100 text-amber-700"
    },
    {
      title: "Customer Support",
      description: "24/7 Phone & Email Support",
      icon: Phone,
      status: "Available",
      color: "bg-red-100 text-red-700"
    },
    {
      title: "No Registration Fees",
      description: "100% Free for Job Seekers",
      icon: CheckCircle,
      status: "Guaranteed",
      color: "bg-green-100 text-green-700"
    }
  ];

  return (
    <section className="py-8 bg-muted/30">
      <div className="container mx-auto px-4 lg:px-6 xl:px-8 max-w-6xl">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
            Trusted & Verified Platform
          </h2>
          <p className="text-lg text-muted-foreground">
            Your safety and security is our top priority
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {certifications.map((cert, index) => (
            <Card key={index} className="p-6 bg-background border shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start space-x-4">
                <div className={`p-3 rounded-lg ${cert.color.split(' ')[0]} flex-shrink-0`}>
                  <cert.icon className={`w-6 h-6 ${cert.color.split(' ')[1]}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-foreground text-sm">
                      {cert.title}
                    </h3>
                    <Badge variant="secondary" className={`text-xs ${cert.color}`}>
                      {cert.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {cert.description}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
        
        <div className="text-center mt-8">
          <p className="text-sm text-muted-foreground">
            <strong>Important:</strong> Legitimate employers never ask for upfront payments. 
            Report suspicious job postings immediately.
          </p>
        </div>
      </div>
    </section>
  );
};

export default TrustIndicators;