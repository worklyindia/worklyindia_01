import PageHeader from "@/components/PageHeader";
import BottomNavigation from "@/components/BottomNavigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  GraduationCap, 
  Users, 
  Trophy, 
  Building, 
  CheckCircle, 
  Star,
  ArrowRight,
  Upload,
  Calendar,
  BarChart3
} from "lucide-react";
import { useState } from "react";

const CollegeTPO = () => {
  const [formData, setFormData] = useState({
    collegeName: "",
    tpoName: "",
    email: "",
    phone: "",
    website: "",
    address: "",
    establishedYear: "",
    studentCount: "",
    coursesOffered: "",
    accreditation: "",
    message: "",
    agreedToTerms: false
  });

  const benefits = [
    {
      title: "Direct Industry Connect",
      description: "Connect your students with top remote employers across India",
      icon: Building
    },
    {
      title: "Placement Analytics",
      description: "Track and analyze placement rates with detailed reports",
      icon: BarChart3
    },
    {
      title: "Career Development",
      description: "Access to skill assessments and interview preparation resources",
      icon: Trophy
    },
    {
      title: "Bulk Registration",
      description: "Easy bulk student registration and profile management",
      icon: Users
    }
  ];

  const features = [
    "Dedicated TPO dashboard for placement management",
    "Student profile verification and enhancement tools", 
    "Direct communication channel with recruiters",
    "Placement drive scheduling and coordination",
    "Real-time placement tracking and reporting",
    "Career counseling resources and materials",
    "Industry-specific skill development programs",
    "Alumni network integration"
  ];

  const partnerColleges = [
    { name: "IIT Delhi", students: "2,500+", placements: "95%" },
    { name: "NIT Bangalore", students: "1,800+", placements: "92%" },
    { name: "BITS Pilani", students: "3,200+", placements: "88%" },
    { name: "VIT Chennai", students: "4,000+", placements: "85%" }
  ];

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("TPO Registration:", formData);
    // Handle form submission
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="College TPO" />
      
      <main className="container mx-auto px-4 py-6 pb-24 md:pb-8 max-w-6xl">
        {/* Header Section */}
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4">College Partnership</Badge>
          <h1 className="text-4xl font-bold text-foreground mb-4">
            College TPO Registration
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Partner with Workly India to enhance your students' career prospects with 
            access to premium remote job opportunities and placement support.
          </p>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          <Card className="p-4 text-center bg-gradient-to-br from-blue-500/5 to-blue-600/5 border border-blue-200">
            <GraduationCap className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-blue-600">500+</div>
            <div className="text-sm text-muted-foreground">Partner Colleges</div>
          </Card>
          <Card className="p-4 text-center bg-gradient-to-br from-green-500/5 to-green-600/5 border border-green-200">
            <Users className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-green-600">50K+</div>
            <div className="text-sm text-muted-foreground">Students Placed</div>
          </Card>
          <Card className="p-4 text-center bg-gradient-to-br from-purple-500/5 to-purple-600/5 border border-purple-200">
            <Trophy className="w-8 h-8 text-purple-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-purple-600">89%</div>
            <div className="text-sm text-muted-foreground">Placement Rate</div>
          </Card>
          <Card className="p-4 text-center bg-gradient-to-br from-orange-500/5 to-orange-600/5 border border-orange-200">
            <Building className="w-8 h-8 text-orange-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-orange-600">1000+</div>
            <div className="text-sm text-muted-foreground">Hiring Partners</div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Registration Form */}
          <div className="lg:col-span-2">
            <Card className="p-6 bg-gradient-to-br from-white to-gray-50 border border-border/50">
              <h2 className="text-xl font-semibold text-foreground mb-6 flex items-center">
                <GraduationCap className="w-5 h-5 mr-2 text-primary" />
                TPO Registration Form
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* College Information */}
                <div className="space-y-4">
                  <h3 className="font-medium text-foreground">College Information</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="collegeName">College Name *</Label>
                      <Input
                        id="collegeName"
                        placeholder="Enter college name"
                        value={formData.collegeName}
                        onChange={(e) => handleInputChange("collegeName", e.target.value)}
                        className="mt-1"
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="website">College Website</Label>
                      <Input
                        id="website"
                        type="url"
                        placeholder="https://college.edu"
                        value={formData.website}
                        onChange={(e) => handleInputChange("website", e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="establishedYear">Established Year</Label>
                      <Input
                        id="establishedYear"
                        type="number"
                        placeholder="1995"
                        value={formData.establishedYear}
                        onChange={(e) => handleInputChange("establishedYear", e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="studentCount">Total Students</Label>
                      <Select onValueChange={(value) => handleInputChange("studentCount", value)}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select range" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="500-1000">500 - 1,000</SelectItem>
                          <SelectItem value="1000-2500">1,000 - 2,500</SelectItem>
                          <SelectItem value="2500-5000">2,500 - 5,000</SelectItem>
                          <SelectItem value="5000+">5,000+</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="address">College Address</Label>
                    <Textarea
                      id="address"
                      placeholder="Enter complete address"
                      value={formData.address}
                      onChange={(e) => handleInputChange("address", e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>

                {/* TPO Information */}
                <div className="space-y-4">
                  <h3 className="font-medium text-foreground">TPO Contact Information</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="tpoName">TPO Name *</Label>
                      <Input
                        id="tpoName"
                        placeholder="Training & Placement Officer name"
                        value={formData.tpoName}
                        onChange={(e) => handleInputChange("tpoName", e.target.value)}
                        className="mt-1"
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="email">Email Address *</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="tpo@college.edu"
                        value={formData.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                        className="mt-1"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={formData.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                      className="mt-1"
                      required
                    />
                  </div>
                </div>

                {/* Academic Information */}
                <div className="space-y-4">
                  <h3 className="font-medium text-foreground">Academic Details</h3>
                  
                  <div>
                    <Label htmlFor="coursesOffered">Courses Offered</Label>
                    <Textarea
                      id="coursesOffered"
                      placeholder="List major courses/departments (e.g., CSE, ECE, Mechanical, MBA, etc.)"
                      value={formData.coursesOffered}
                      onChange={(e) => handleInputChange("coursesOffered", e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="accreditation">Accreditation</Label>
                    <Select onValueChange={(value) => handleInputChange("accreditation", value)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select accreditation" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ugc">UGC Recognized</SelectItem>
                        <SelectItem value="naac">NAAC Accredited</SelectItem>
                        <SelectItem value="aicte">AICTE Approved</SelectItem>
                        <SelectItem value="nba">NBA Accredited</SelectItem>
                        <SelectItem value="autonomous">Autonomous</SelectItem>
                        <SelectItem value="deemed">Deemed University</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Additional Information */}
                <div>
                  <Label htmlFor="message">Additional Information</Label>
                  <Textarea
                    id="message"
                    placeholder="Any specific requirements, expectations, or information you'd like to share..."
                    value={formData.message}
                    onChange={(e) => handleInputChange("message", e.target.value)}
                    className="mt-1 min-h-[100px]"
                  />
                </div>

                {/* Terms Agreement */}
                <div className="flex items-start space-x-2">
                  <Checkbox 
                    id="terms"
                    checked={formData.agreedToTerms}
                    onCheckedChange={(checked) => handleInputChange("agreedToTerms", checked as boolean)}
                  />
                  <Label htmlFor="terms" className="text-sm">
                    I agree to the terms and conditions and authorize Workly India to contact our college 
                    for partnership opportunities. *
                  </Label>
                </div>

                <Button 
                  type="submit" 
                  size="lg" 
                  className="w-full"
                  disabled={!formData.agreedToTerms}
                >
                  Submit Registration
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </form>
            </Card>
          </div>

          {/* Benefits & Info Sidebar */}
          <div className="space-y-6">
            {/* Benefits */}
            <Card className="p-6 bg-gradient-to-br from-primary/5 to-secondary/5 border border-border/50">
              <h3 className="font-semibold text-foreground mb-4">Partnership Benefits</h3>
              <div className="space-y-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                      <benefit.icon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-foreground">{benefit.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{benefit.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Features */}
            <Card className="p-6 bg-gradient-to-br from-white to-gray-50 border border-border/50">
              <h3 className="font-semibold text-foreground mb-4">Platform Features</h3>
              <div className="space-y-2">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-start space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                    <span className="text-xs text-muted-foreground">{feature}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Partner Success */}
            <Card className="p-6 bg-gradient-to-br from-white to-gray-50 border border-border/50">
              <h3 className="font-semibold text-foreground mb-4 flex items-center">
                <Star className="w-4 h-4 mr-2 text-yellow-500" />
                Success Stories
              </h3>
              <div className="space-y-3">
                {partnerColleges.map((college, index) => (
                  <div key={index} className="p-3 bg-background rounded-lg">
                    <h4 className="text-sm font-medium text-foreground">{college.name}</h4>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>{college.students} students</span>
                      <span className="text-green-600">{college.placements} placed</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </main>

      <BottomNavigation />
    </div>
  );
};

export default CollegeTPO;