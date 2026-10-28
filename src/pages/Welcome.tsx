import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Briefcase, Users, Globe, Zap, FileText, Target, BookOpen, TrendingUp, Shield, Star } from "lucide-react";
import SEO from "@/components/SEO";

const Welcome = () => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleGetStarted = () => {
    navigate("/home");
  };

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-background">
      <SEO 
        title="Remote Jobs in India - Workly India"
        description="Discover legitimate Workly India opportunities with top companies across India. Find remote jobs in customer support, data entry, content writing, software development, and more."
        keywords="remote jobs india, remote jobs, Workly India jobs, online jobs"
        canonical="/"
      />
      
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500 text-white py-20 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Workly India<br />
            Jobs in India
          </h1>
          <p className="text-xl md:text-2xl mb-12 max-w-3xl mx-auto text-white/90">
            Discover legitimate Workly India opportunities with top companies across India
          </p>
          
          {/* Quick Links */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12 max-w-4xl mx-auto">
            <Button 
              onClick={() => handleNavigation("/jobs")}
              variant="outline" 
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 h-12"
            >
              Browse All Jobs
            </Button>
            <Button 
              onClick={() => handleNavigation("/jobs-for-women")}
              variant="outline" 
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 h-12"
            >
              Jobs for Women
            </Button>
            <Button 
              onClick={() => handleNavigation("/company-directory")}
              variant="outline" 
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 h-12"
            >
              Company Directory
            </Button>
          </div>

          {/* Second Row of Links */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12 max-w-4xl mx-auto">
            <Button 
              onClick={() => handleNavigation("/resume-builder")}
              variant="outline" 
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 h-12"
            >
              Resume Builder
            </Button>
            <Button 
              onClick={() => handleNavigation("/career-guidance")}
              variant="outline" 
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 h-12"
            >
              Career Guidance
            </Button>
            <Button 
              onClick={() => handleNavigation("/skill-assessment")}
              variant="outline" 
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 h-12"
            >
              Skill Assessment
            </Button>
            <Button 
              onClick={() => handleNavigation("/interview-tips")}
              variant="outline" 
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 h-12"
            >
              Interview Tips
            </Button>
          </div>

          <Button 
            onClick={handleGetStarted}
            size="lg"
            className="bg-white text-gray-900 hover:bg-white/90 text-xl px-12 py-6 rounded-2xl font-semibold"
          >
            Get Started Now
            <ArrowRight className="w-6 h-6 ml-2" />
          </Button>
        </div>
      </section>

      {/* Why Choose Remote Section */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-12 text-gray-900">
            Why Choose Remote Jobs in India?
          </h2>
          <p className="text-lg text-gray-600 max-w-4xl mx-auto mb-16 text-center leading-relaxed">
            Workly India opportunities in India have revolutionized the way professionals approach their careers. 
            With the rise of Workly India culture, thousands of Indians are now enjoying the flexibility of working 
            from their homes while maintaining successful careers with top companies.
          </p>
          
          <p className="text-lg text-gray-600 max-w-4xl mx-auto mb-16 text-center leading-relaxed">
            Our platform connects job seekers with legitimate Workly India positions across various industries including 
            customer support, data entry, content writing, digital marketing, software development, and virtual assistance. 
            These remote jobs offer competitive salaries and the perfect work-life balance that modern professionals seek.
          </p>

          <p className="text-lg text-gray-600 max-w-4xl mx-auto text-center leading-relaxed">
            Whether you are looking for full-time remote positions, part-time opportunities, or freelance projects, 
            Workly India provides a comprehensive job board featuring verified employers and genuine Workly India 
            vacancies. Join thousands of professionals who have successfully transitioned to Workly India and 
            discovered new career possibilities.
          </p>
        </div>
      </section>

      {/* Free Career Resources */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16 text-gray-900">Free Career Resources</h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Resume Builder */}
            <div className="bg-white rounded-xl p-8 shadow-lg border border-gray-100">
              <FileText className="w-12 h-12 text-blue-600 mb-6" />
              <h3 className="text-2xl font-bold mb-4 text-gray-900">Resume Builder</h3>
              <p className="text-gray-600 mb-6 leading-relaxed">
                Create professional resumes optimized for Workly India applications with our free resume builder tool.
              </p>
              <Button 
                onClick={() => handleNavigation("/resume-builder")}
                className="text-blue-600 hover:text-blue-700 p-0 h-auto font-semibold"
                variant="ghost"
              >
                Build Resume →
              </Button>
            </div>

            {/* Interview Preparation */}
            <div className="bg-white rounded-xl p-8 shadow-lg border border-gray-100">
              <Target className="w-12 h-12 text-green-600 mb-6" />
              <h3 className="text-2xl font-bold mb-4 text-gray-900">Interview Preparation</h3>
              <p className="text-gray-600 mb-6 leading-relaxed">
                Master remote job interviews with our comprehensive guide covering video etiquette and common questions.
              </p>
              <Button 
                onClick={() => handleNavigation("/interview-tips")}
                className="text-green-600 hover:text-green-700 p-0 h-auto font-semibold"
                variant="ghost"
              >
                Prepare Now →
              </Button>
            </div>

            {/* Skill Assessment */}
            <div className="bg-white rounded-xl p-8 shadow-lg border border-gray-100">
              <BookOpen className="w-12 h-12 text-purple-600 mb-6" />
              <h3 className="text-2xl font-bold mb-4 text-gray-900">Skill Assessment</h3>
              <p className="text-gray-600 mb-6 leading-relaxed">
                Evaluate your skills and discover which remote jobs match your expertise with our free assessment tool.
              </p>
              <Button 
                onClick={() => handleNavigation("/skill-assessment")}
                className="text-purple-600 hover:text-purple-700 p-0 h-auto font-semibold"
                variant="ghost"
              >
                Take Assessment →
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Popular Remote Job Categories */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16 text-gray-900">Popular Remote Job Categories</h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="flex items-center space-x-3 bg-white p-4 rounded-lg shadow-sm">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-gray-700 font-medium">Customer Support & Call Center Jobs</span>
            </div>
            
            <div className="flex items-center space-x-3 bg-white p-4 rounded-lg shadow-sm">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-gray-700 font-medium">Data Entry & Virtual Assistant</span>
            </div>
            
            <div className="flex items-center space-x-3 bg-white p-4 rounded-lg shadow-sm">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-gray-700 font-medium">Content Writing & Digital Marketing</span>
            </div>
            
            <div className="flex items-center space-x-3 bg-white p-4 rounded-lg shadow-sm">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-gray-700 font-medium">Software Development & IT</span>
            </div>
            
            <div className="flex items-center space-x-3 bg-white p-4 rounded-lg shadow-sm">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-gray-700 font-medium">Online Teaching & Training</span>
            </div>
            
            <div className="flex items-center space-x-3 bg-white p-4 rounded-lg shadow-sm">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-gray-700 font-medium">Sales & Business Development</span>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Remote Opportunities */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6 text-gray-900">Featured Remote Opportunities</h2>
          <p className="text-xl text-gray-600 mb-12">Hand-picked remote opportunities from top companies across India</p>
          
          <Button 
            onClick={() => handleNavigation("/jobs")}
            size="lg"
            className="bg-blue-600 hover:bg-blue-700 text-white px-12 py-6 rounded-xl text-xl font-semibold"
          >
            View All Jobs
            <ArrowRight className="w-6 h-6 ml-2" />
          </Button>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16 text-gray-900">
            Frequently Asked Questions About Remote Jobs
          </h2>
          
          <div className="space-y-8">
            {/* FAQ 1 */}
            <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100">
              <h3 className="text-xl font-bold mb-4 text-gray-900">
                What types of remote jobs are available in India?
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Popular remote jobs in India include customer support, data entry, content writing, virtual 
                assistance, digital marketing, software development, online teaching, and sales positions. These roles 
                span across industries like IT, healthcare, education, e-commerce, and financial services.
              </p>
            </div>

            {/* FAQ 2 */}
            <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100">
              <h3 className="text-xl font-bold mb-4 text-gray-900">
                What is the average salary for remote jobs in India?
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Salaries range from ₹15,000-₹25,000 for entry-level positions like data entry and customer support, 
                to ₹50,000-₹1,00,000+ for specialized roles like software development and digital marketing management. 
                Experience and skills significantly impact earning potential.
              </p>
            </div>

            {/* FAQ 3 */}
            <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100">
              <h3 className="text-xl font-bold mb-4 text-gray-900">
                How can I find legitimate remote jobs?
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Use trusted job boards like Workly India, verify company credentials, avoid jobs requiring upfront payments, 
                and research employer reviews before applying. Look for companies with established websites, clear job 
                descriptions, and transparent hiring processes.
              </p>
            </div>

            {/* FAQ 4 */}
            <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100">
              <h3 className="text-xl font-bold mb-4 text-gray-900">
                What skills do I need for Workly India in India?
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Essential skills include strong communication, self-discipline, time management, and basic computer 
                proficiency. Specific technical skills vary by role - customer support needs excellent English, while 
                content writing requires SEO knowledge and creativity.
              </p>
            </div>
          </div>

          <div className="text-center mt-12">
            <Button 
              onClick={() => handleNavigation("/faq")}
              variant="outline"
              className="border-blue-600 text-blue-600 hover:bg-blue-50 px-8 py-3 rounded-xl font-semibold"
            >
              View All FAQs →
            </Button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-blue-600 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Start Your Remote Career?</h2>
          <p className="text-xl mb-8 text-blue-100">
            Join thousands of professionals who have found their dream remote jobs
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={() => handleNavigation("/jobs")}
              size="lg"
              className="bg-white text-blue-600 hover:bg-blue-50 px-8 py-4 rounded-xl font-semibold"
            >
              Browse Jobs
            </Button>
            <Button 
              onClick={() => handleNavigation("/resume-builder")}
              size="lg"
              variant="outline"
              className="border-white text-white hover:bg-white/10 px-8 py-4 rounded-xl font-semibold"
            >
              Build Resume
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Welcome;