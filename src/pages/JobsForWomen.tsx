import Header from "@/components/Header";
import BottomNavigation from "@/components/BottomNavigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LottieSearchIcon from "@/components/LottieSearchIcon";
import { 
  Users, 
  Heart, 
  Shield, 
  Clock, 
  Search, 
  MapPin,
  Building,
  Star,
  ArrowRight,
  Filter,
  Briefcase,
  TrendingUp,
  Award
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const JobsForWomen = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedExperience, setSelectedExperience] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");

  const womenFriendlyJobs = [
    {
      id: 1,
      title: "Content Marketing Specialist",
      company: "CreativeWorks",
      location: "Remote",
      type: "Full-time",
      experience: "2-4 years",
      salary: "₹6-8 LPA",
      category: "Marketing",
      postedTime: "2 hours ago",
      features: ["Flexible Hours", "Maternity Support", "Career Growth"],
      description: "Join our inclusive marketing team focused on content strategy and brand building.",
      womenFriendlyBadge: true
    },
    {
      id: 2,
      title: "UX/UI Designer",
      company: "DesignFirst",
      location: "Bangalore/Remote",
      type: "Full-time",
      experience: "1-3 years",
      salary: "₹7-10 LPA",
      category: "Design",
      postedTime: "5 hours ago",
      features: ["Workly India", "Flexible Schedule", "Skill Development"],
      description: "Create amazing user experiences in a supportive and diverse environment.",
      womenFriendlyBadge: true
    },
    {
      id: 3,
      title: "HR Business Partner",
      company: "PeopleFirst Inc",
      location: "Mumbai/Remote",
      type: "Full-time",
      experience: "3-5 years",
      salary: "₹8-12 LPA",
      category: "Human Resources",
      postedTime: "1 day ago",
      features: ["Inclusive Culture", "Leadership Training", "Work-Life Balance"],
      description: "Drive HR initiatives in a company that values diversity and inclusion.",
      womenFriendlyBadge: true
    },
    {
      id: 4,
      title: "Data Analyst",
      company: "DataInsights",
      location: "Remote",
      type: "Full-time",
      experience: "1-2 years",
      salary: "₹5-7 LPA",
      category: "Analytics",
      postedTime: "1 day ago",
      features: ["Learning Budget", "Mentorship Program", "Flexible Time"],
      description: "Analyze data trends and insights in a collaborative team environment.",
      womenFriendlyBadge: true
    },
    {
      id: 5,
      title: "Software Developer",
      company: "TechWomen",
      location: "Hyderabad/Remote",
      type: "Full-time",
      experience: "0-2 years",
      salary: "₹4-6 LPA",
      category: "Technology",
      postedTime: "2 days ago",
      features: ["Women-Led Team", "Coding Bootcamp", "Career Support"],
      description: "Start your tech career with comprehensive support and mentorship.",
      womenFriendlyBadge: true
    },
    {
      id: 6,
      title: "Customer Success Manager",
      company: "ClientCare Solutions",
      location: "Remote",
      type: "Full-time",
      experience: "2-4 years",
      salary: "₹6-9 LPA",
      category: "Customer Service",
      postedTime: "3 days ago",
      features: ["Team Collaboration", "Growth Opportunities", "Wellness Benefits"],
      description: "Build strong customer relationships and drive success initiatives.",
      womenFriendlyBadge: true
    }
  ];

  const benefits = [
    {
      title: "Flexible Work Arrangements",
      description: "Workly India options and flexible scheduling to balance work and life",
      icon: Clock
    },
    {
      title: "Inclusive Environment",
      description: "Safe, supportive workplaces that celebrate diversity and inclusion",
      icon: Users
    },
    {
      title: "Career Development",
      description: "Mentorship programs and growth opportunities specifically for women",
      icon: TrendingUp
    },
    {
      title: "Equal Pay & Benefits",
      description: "Fair compensation and comprehensive benefits including maternity support",
      icon: Shield
    }
  ];

  const categories = [
    "All Categories", "Technology", "Marketing", "Design", "Human Resources", 
    "Analytics", "Customer Service", "Finance", "Healthcare", "Education"
  ];

  const experienceLevels = [
    "All Experience", "0-1 years", "1-2 years", "2-4 years", "3-5 years", "5+ years"
  ];

  const locations = [
    "All Locations", "Remote", "Bangalore", "Mumbai", "Delhi", "Hyderabad", 
    "Pune", "Chennai", "Kolkata"
  ];

  const filteredJobs = womenFriendlyJobs.filter(job => {
    const matchesSearch = job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         job.company.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || selectedCategory === "All Categories" || 
                           job.category === selectedCategory;
    const matchesExperience = !selectedExperience || selectedExperience === "All Experience" || 
                             job.experience.includes(selectedExperience.split('-')[0]);
    const matchesLocation = !selectedLocation || selectedLocation === "All Locations" || 
                           job.location.includes(selectedLocation);
    
    return matchesSearch && matchesCategory && matchesExperience && matchesLocation;
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-6 pb-24 md:pb-8 max-w-6xl">
        {/* Header Section */}
        <div className="text-center mb-8">
          <Badge variant="secondary" className="mb-4 bg-pink-100 text-pink-700">Women Empowerment</Badge>
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Jobs for Women
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Discover inclusive workplaces that support women's careers with flexible arrangements, 
            equal opportunities, and supportive environments.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-4 text-center bg-gradient-to-br from-pink-500/5 to-pink-600/5 border border-pink-200">
            <Briefcase className="w-6 h-6 text-pink-600 mx-auto mb-2" />
            <div className="text-xl font-bold text-pink-600">{womenFriendlyJobs.length}</div>
            <div className="text-xs text-muted-foreground">Women-Friendly Jobs</div>
          </Card>
          <Card className="p-4 text-center bg-gradient-to-br from-purple-500/5 to-purple-600/5 border border-purple-200">
            <Building className="w-6 h-6 text-purple-600 mx-auto mb-2" />
            <div className="text-xl font-bold text-purple-600">150+</div>
            <div className="text-xs text-muted-foreground">Partner Companies</div>
          </Card>
          <Card className="p-4 text-center bg-gradient-to-br from-blue-500/5 to-blue-600/5 border border-blue-200">
            <Users className="w-6 h-6 text-blue-600 mx-auto mb-2" />
            <div className="text-xl font-bold text-blue-600">85%</div>
            <div className="text-xs text-muted-foreground">Success Rate</div>
          </Card>
          <Card className="p-4 text-center bg-gradient-to-br from-green-500/5 to-green-600/5 border border-green-200">
            <Award className="w-6 h-6 text-green-600 mx-auto mb-2" />
            <div className="text-xl font-bold text-green-600">4.8</div>
            <div className="text-xs text-muted-foreground">Avg Satisfaction</div>
          </Card>
        </div>

        {/* Benefits Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-6 text-center">
            Why Choose Women-Friendly Workplaces?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {benefits.map((benefit, index) => (
              <Card key={index} className="p-4 bg-gradient-to-br from-white to-gray-50 border border-border/50 text-center">
                <div className="p-3 bg-primary/10 rounded-xl w-fit mx-auto mb-3">
                  <benefit.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{benefit.title}</h3>
                <p className="text-sm text-muted-foreground">{benefit.description}</p>
              </Card>
            ))}
          </div>
        </div>

        {/* Filters */}
        <Card className="p-6 mb-8 bg-gradient-to-br from-white to-gray-50 border border-border/50">
          <div className="flex items-center space-x-2 mb-4">
            <Filter className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-foreground">Find Your Perfect Job</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none"><LottieSearchIcon size={16} /></div>
              <Input
                placeholder="Search jobs or companies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select onValueChange={setSelectedExperience}>
              <SelectTrigger>
                <SelectValue placeholder="Experience" />
              </SelectTrigger>
              <SelectContent>
                {experienceLevels.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select onValueChange={setSelectedLocation}>
              <SelectTrigger>
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((location) => (
                  <SelectItem key={location} value={location}>
                    {location}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Jobs List */}
        <div className="space-y-4">
          {filteredJobs.map((job) => (
            <Card 
              key={job.id} 
              className="p-6 bg-gradient-to-br from-white to-gray-50 border border-border/50 hover:shadow-lg transition-all duration-200 cursor-pointer group"
              onClick={() => navigate(`/job/${job.id}`)}
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                          {job.title}
                        </h3>
                        {job.womenFriendlyBadge && (
                          <Badge className="bg-pink-100 text-pink-700 border-pink-200">
                            <Heart className="w-3 h-3 mr-1" />
                            Women Friendly
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-2">
                        <div className="flex items-center">
                          <Building className="w-4 h-4 mr-1" />
                          {job.company}
                        </div>
                        <div className="flex items-center">
                          <MapPin className="w-4 h-4 mr-1" />
                          {job.location}
                        </div>
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          {job.postedTime}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        {job.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-3">
                    {job.features.map((feature, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 text-sm">
                      <Badge variant="outline">{job.type}</Badge>
                      <span className="text-muted-foreground">{job.experience}</span>
                      <span className="font-medium text-foreground">{job.salary}</span>
                    </div>
                    <Button className="shrink-0">
                      Apply Now
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* No Results */}
        {filteredJobs.length === 0 && (
          <Card className="p-8 text-center bg-gradient-to-br from-white to-gray-50 border border-border/50">
            <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-foreground mb-2">No Jobs Found</h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting your filters to find more opportunities.
            </p>
            <Button 
              variant="outline"
              onClick={() => {
                setSearchTerm("");
                setSelectedCategory("");
                setSelectedExperience("");
                setSelectedLocation("");
              }}
            >
              Clear Filters
            </Button>
          </Card>
        )}

        {/* CTA Section */}
        <Card className="p-8 mt-12 bg-gradient-to-r from-pink-500/5 to-purple-500/5 border border-pink-200">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground mb-4">
              Ready to Take the Next Step in Your Career?
            </h2>
            <p className="text-muted-foreground mb-6">
              Join thousands of women who have found their dream jobs through our platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg"
                onClick={() => navigate('/profile')}
              >
                Complete Your Profile
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => navigate('/resume-builder')}
              >
                Build Your Resume
              </Button>
            </div>
          </div>
        </Card>
      </main>

      <BottomNavigation />
    </div>
  );
};

export default JobsForWomen;