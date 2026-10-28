import Header from "@/components/Header";
import BottomNavigation from "@/components/BottomNavigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, Users, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const WereHiring = () => {
  const navigate = useNavigate();

  const openings = [
    {
      title: "Frontend Developer",
      department: "Engineering",
      location: "Remote",
      type: "Full-time",
      experience: "2-4 years",
      skills: ["React", "TypeScript", "Tailwind CSS"],
      description: "Join our frontend team to build exceptional user experiences"
    },
    {
      title: "Product Manager",
      department: "Product",
      location: "Mumbai/Remote",
      type: "Full-time", 
      experience: "3-5 years",
      skills: ["Strategy", "Analytics", "User Research"],
      description: "Lead product strategy and drive feature development"
    },
    {
      title: "UI/UX Designer",
      department: "Design",
      location: "Remote",
      type: "Full-time",
      experience: "2-3 years", 
      skills: ["Figma", "Design Systems", "User Testing"],
      description: "Create beautiful and intuitive user interfaces"
    },
    {
      title: "Backend Developer",
      department: "Engineering",
      location: "Bangalore/Remote",
      type: "Full-time",
      experience: "3-6 years",
      skills: ["Node.js", "PostgreSQL", "AWS"],
      description: "Build scalable backend systems and APIs"
    },
    {
      title: "Marketing Specialist",
      department: "Marketing",
      location: "Delhi/Remote",
      type: "Full-time",
      experience: "1-3 years",
      skills: ["Digital Marketing", "Content", "Analytics"],
      description: "Drive growth through strategic marketing initiatives"
    },
    {
      title: "Data Analyst",
      department: "Analytics",
      location: "Remote",
      type: "Full-time",
      experience: "2-4 years",
      skills: ["SQL", "Python", "Tableau"],
      description: "Transform data into actionable business insights"
    }
  ];

  const benefits = [
    "Competitive salary and equity",
    "Flexible working hours",
    "Remote-first culture",
    "Health insurance",
    "Learning & development budget",
    "Team retreats and events"
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-6 pb-24 md:pb-8 max-w-6xl">
        {/* Header Section */}
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4">Careers at Workly India</Badge>
          <h1 className="text-4xl font-bold text-foreground mb-4">
            We're Hiring Amazing People
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Join our mission to revolutionize Workly India in India. We're looking for 
            passionate individuals who want to make a real impact.
          </p>
        </div>

        {/* Benefits Section */}
        <Card className="p-6 mb-8 bg-gradient-to-r from-primary/5 to-secondary/5 border border-border/50">
          <h2 className="text-xl font-semibold text-foreground mb-4 text-center">Why Work With Us?</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <span className="text-sm text-muted-foreground">{benefit}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Open Positions */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-6">Open Positions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {openings.map((job, index) => (
              <Card key={index} className="p-6 bg-gradient-to-br from-white to-gray-50 border border-border/50 hover:shadow-lg transition-all duration-200 cursor-pointer group">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      {job.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">{job.department}</p>
                  </div>
                  <Badge variant="secondary">{job.type}</Badge>
                </div>
                
                <p className="text-sm text-muted-foreground mb-4">{job.description}</p>
                
                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4 mr-2" />
                    {job.location}
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Clock className="w-4 h-4 mr-2" />
                    {job.experience}
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2 mb-4">
                  {job.skills.map((skill, skillIndex) => (
                    <Badge key={skillIndex} variant="outline" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                </div>
                
                <Button className="w-full group-hover:bg-primary/90 transition-colors">
                  Apply Now
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Card>
            ))}
          </div>
        </div>

        {/* Culture Section */}
        <Card className="p-8 bg-gradient-to-br from-white to-gray-50 border border-border/50">
          <h2 className="text-2xl font-bold text-foreground mb-4 text-center">Our Culture</h2>
          <p className="text-muted-foreground text-center mb-6">
            We believe in creating an environment where everyone can do their best work. 
            Our team is distributed across India, united by our shared mission and values.
          </p>
          <div className="flex justify-center">
            <Button 
              variant="outline"
              onClick={() => navigate('/about-us')}
            >
              Learn More About Us
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </Card>
      </main>

      <BottomNavigation />
    </div>
  );
};

export default WereHiring;