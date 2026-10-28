import { useContactInfo as useSiteContactInfo } from "@/hooks/useSiteSettings";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Target, Award, Heart, Globe, CheckCircle, Shield, Building, Phone } from "lucide-react";
import SEO from "@/components/SEO";
import { getUpdatedTimestamp } from "@/utils/timestampUtils";
import { useMerchantInfo, useSocialLinks } from "@/hooks/useSiteSettings";
import ParallaxSection from "@/components/animations/ParallaxSection";
import TextReveal from "@/components/animations/TextReveal";
import AnimatedCounter from "@/components/animations/AnimatedCounter";
import Tilt3DCard from "@/components/animations/Tilt3DCard";

const AboutUs = () => {
  const { data: merchantInfo } = useMerchantInfo();
  const { data: socialLinks } = useSocialLinks();
  
  const stats = [
    { label: "Active Users", value: "75K+", icon: Users },
    { label: "Job Opportunities", value: "15K+", icon: Target },
    { label: "Success Stories", value: "8K+", icon: Award },
    { label: "Verified Companies", value: "2K+", icon: Globe }
  ];

  const { data: siteContact } = useSiteContactInfo();
  const supportPhone = siteContact?.phone?.trim() || merchantInfo?.contact_number || "+91 9904923067";
  const companyInfo = [
    { label: "Founded", value: merchantInfo?.founded_year || "2025" },
    { label: "Headquarters", value: merchantInfo?.registered_address || "Panchasar, Gujarat, India" },
    { label: "UDYAM Registration", value: merchantInfo?.udyam_registration || "UDYAM-GJ-18-0022888" },
    { label: "IEC Code", value: merchantInfo?.iec_code || "EBGPG4522J" },
    { label: "Business Type", value: merchantInfo?.business_type || "Workly India – Remote Jobs Platform" },
    { label: "Support", value: supportPhone }
  ];

  const values = [
    {
      title: "Innovation",
      description: "We continuously evolve to provide cutting-edge job search solutions",
      icon: Target
    },
    {
      title: "Accessibility", 
      description: "Making job opportunities accessible to everyone, everywhere",
      icon: Globe
    },
    {
      title: "Trust",
      description: "Building trust through transparency and reliable service",
      icon: CheckCircle
    },
    {
      title: "Community",
      description: "Creating a supportive community for job seekers and employers",
      icon: Heart
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="About Workly India - Leading Remote Job Platform in India"
        description="Learn about Workly India's mission to connect professionals with legitimate remote-work opportunities. Founded in 2025, serving 75,000+ users across India."
        keywords="about workly india, Workly India platform india, Workly India company, legitimate online jobs india"
        canonical="/about-us"
      />
      <PageHeader title="About Us" />
      
      <main className="container mx-auto px-4 py-6 pb-24 md:pb-8 max-w-4xl">
        {/* Header Section */}
        <TextReveal>
          <div className="text-center mb-12">
            <Badge variant="secondary" className="mb-4 animate-scale-bounce-in">About Workly India</Badge>
            <h1 className="text-4xl font-bold text-foreground mb-4">
              India's Most Trusted Workly India Platform
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              Last updated: {getUpdatedTimestamp('about-us')}
            </p>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mt-4">
              Connecting 75,000+ professionals with verified employers since 2025. Verified opportunities, zero registration fees, and strong fraud protection.
            </p>
            <div className="flex justify-center mt-6 space-x-4">
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                <Shield className="w-4 h-4 mr-1" />
                Government Registered
              </Badge>
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                <Building className="w-4 h-4 mr-1" />
                Legally Compliant
              </Badge>
            </div>
          </div>
        </TextReveal>

        {/* Stats Section */}
        <ParallaxSection speed={0.08} fadeIn>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
            {stats.map((stat, index) => (
              <Tilt3DCard key={index} className="rounded-xl" maxTilt={12}>
                <Card className="p-6 text-center bg-gradient-to-br from-white to-gray-50 border border-border/50 animate-scale-bounce-in" style={{ animationDelay: `${index * 0.1}s`, animationFillMode: 'both' }}>
                  <div className="p-3 bg-primary/10 rounded-xl w-fit mx-auto mb-3 animate-float" style={{ animationDelay: `${index * 0.3}s` }}>
                    <stat.icon className="w-6 h-6 text-primary" />
                  </div>
                  <AnimatedCounter value={stat.value} className="text-2xl font-bold text-foreground" />
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </Card>
              </Tilt3DCard>
            ))}
          </div>
        </ParallaxSection>

        {/* Mission Section */}
        <ParallaxSection speed={0.06} fadeIn>
          <Card className="p-8 mb-8 bg-gradient-to-r from-primary/5 to-secondary/5 border border-border/50 shine-effect">
            <h2 className="text-2xl font-bold text-foreground mb-4 text-center">Our Mission</h2>
            <p className="text-muted-foreground text-center text-lg leading-relaxed">
              To revolutionize the job market by providing a comprehensive platform that enables 
              professionals to find meaningful Workly India opportunities while helping companies 
              discover exceptional talent across India.
            </p>
          </Card>
        </ParallaxSection>

        {/* Values Section */}
        <ParallaxSection speed={0.08} fadeIn>
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-6 text-center">Our Values</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {values.map((value, index) => (
                <Tilt3DCard key={index} className="rounded-xl" maxTilt={10}>
                  <Card className="p-6 bg-gradient-to-br from-white to-gray-50 border border-border/50 hover-lift animate-slide-up-fade" style={{ animationDelay: `${index * 0.1}s`, animationFillMode: 'both' }}>
                    <div className="flex items-start space-x-4">
                      <div className="p-3 bg-primary/10 rounded-xl shrink-0 animate-float" style={{ animationDelay: `${index * 0.2}s` }}>
                        <value.icon className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground mb-2">{value.title}</h3>
                        <p className="text-sm text-muted-foreground">{value.description}</p>
                      </div>
                    </div>
                  </Card>
                </Tilt3DCard>
              ))}
            </div>
          </div>
        </ParallaxSection>

        {/* Company Information */}
        <Card className="p-8 mb-8">
          <div className="flex items-center mb-6">
            <div className="p-3 bg-blue-100 rounded-xl mr-4">
              <Building className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Company Information</h2>
              <p className="text-muted-foreground">Registered & verified business details</p>
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {companyInfo.map((info, index) => (
              <div key={index} className="p-4 bg-muted/30 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">{info.label}</p>
                <p className="font-semibold text-foreground">{info.value}</p>
              </div>
            ))}
          </div>
          
          <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
              <p className="text-sm text-green-800">
                <strong>Verified Business:</strong> All company details have been verified using official government records.
              </p>
            </div>
          </div>
        </Card>

        {/* Story Section */}
        <Card className="p-8 bg-gradient-to-br from-white to-gray-50 border border-border/50">
          <div className="flex items-center mb-6">
            <div className="p-3 bg-primary/10 rounded-xl mr-4">
              <Heart className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Our Story</h2>
              <p className="text-muted-foreground">Building India's most trusted Workly India platform</p>
            </div>
          </div>
          
          <div className="space-y-6 text-muted-foreground leading-relaxed">
            <p>
              Workly India was founded in 2025 with a mission: to eliminate fraudulent job schemes and create India's first completely transparent remote-work platform. After witnessing thousands of job seekers lose money to fake employers demanding registration fees, our founders decided to build a platform where job seekers never pay a single rupee.
            </p>
            <p>
              We implemented rigorous company verification processes including UDYAM registration validation, business registration checks, address verification, and financial background screening. Every employer must provide government-issued business documents before posting jobs on our platform.
            </p>
            <p>
              Today, we've successfully connected over 75,000 professionals with verified employers across India. Our fraud-prevention policy has protected countless job seekers from scams, while our dedicated support ensures quick resolution of any disputes.
            </p>
            <p>
              As India's leading Workly India platform, we continue innovating with features like skill assessments, resume builders, and career guidance tools - all free for job seekers. Our vision is to empower every Indian professional with access to legitimate remote opportunities.
              "We do not charge any fees from job seekers. Payments are collected only from companies/employers for job postings."
            </p>
          </div>
          
          <div className="mt-8 p-6 bg-gradient-to-r from-primary/5 to-secondary/5 rounded-xl">
            <div className="flex items-center">
              <Phone className="w-6 h-6 text-primary mr-3" />
              <div>
                <h4 className="font-semibold text-foreground">Need Support?</h4>
                <p className="text-sm text-muted-foreground">
                  Call us at {supportPhone} for assistance with jobs, complaints, or platform issues.
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Social Media Section */}
        <Card className="p-8 mb-8 bg-gradient-to-br from-primary/5 to-secondary/5 border border-border/50">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-foreground mb-2">Connect With Us</h2>
            <p className="text-muted-foreground">
              Follow us on social media for the latest job updates, career tips, and success stories
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-center p-4 bg-white rounded-lg border border-border/50 hover:shadow-md transition-all">
              <div className="p-3 bg-pink-100 rounded-xl mr-4">
                <svg className="w-6 h-6 text-pink-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Instagram</h3>
                <p className="text-sm text-muted-foreground">{socialLinks?.instagram_handle || "@worklyindia"}</p>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="p-0 h-auto mt-1 text-pink-600 hover:text-pink-700"
                  onClick={() => window.open(socialLinks?.instagram || "https://www.instagram.com/worklyindiaofficial", "_blank")}
                >
                  Follow →
                </Button>
              </div>
            </div>

            <div className="flex items-center p-4 bg-white rounded-lg border border-border/50 hover:shadow-md transition-all">
              <div className="p-3 bg-blue-100 rounded-xl mr-4">
                <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Facebook</h3>
                <p className="text-sm text-muted-foreground">{socialLinks?.facebook_handle || "Workly India"}</p>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="p-0 h-auto mt-1 text-blue-600 hover:text-blue-700"
                  onClick={() => window.open(socialLinks?.facebook || "https://www.facebook.com/share/1Jj9yDRirA/", "_blank")}
                >
                  Like →
                </Button>
              </div>
            </div>

            <div className="flex items-center p-4 bg-white rounded-lg border border-border/50 hover:shadow-md transition-all">
              <div className="p-3 bg-red-100 rounded-xl mr-4">
                <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">YouTube</h3>
                <p className="text-sm text-muted-foreground">{socialLinks?.youtube_handle || "@worklyindia"}</p>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="p-0 h-auto mt-1 text-red-600 hover:text-red-700"
                  onClick={() => window.open(socialLinks?.youtube || "https://youtube.com/@worklyindiaofficial", "_blank")}
                >
                  Subscribe →
                </Button>
              </div>
            </div>

            <div className="flex items-center p-4 bg-white rounded-lg border border-border/50 hover:shadow-md transition-all">
              <div className="p-3 bg-sky-100 rounded-xl mr-4">
                <svg className="w-6 h-6 text-sky-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Twitter</h3>
                <p className="text-sm text-muted-foreground">{socialLinks?.twitter_handle || "@WorklyIndia"}</p>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="p-0 h-auto mt-1 text-sky-600 hover:text-sky-700"
                  onClick={() => window.open(socialLinks?.twitter || "https://x.com/WorklyIndia", "_blank")}
                >
                  Follow →
                </Button>
              </div>
            </div>

            <div className="flex items-center p-4 bg-white rounded-lg border border-border/50 hover:shadow-md transition-all">
              <div className="p-3 bg-blue-100 rounded-xl mr-4">
                <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Telegram</h3>
                <p className="text-sm text-muted-foreground">{socialLinks?.telegram_handle || "Workly India"}</p>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="p-0 h-auto mt-1 text-blue-600 hover:text-blue-700"
                  onClick={() => window.open(socialLinks?.telegram || "https://t.me/WorklyIndia", "_blank")}
                >
                  Join →
                </Button>
              </div>
            </div>
          </div>
        </Card>

      </main>

    </div>
  );
};

export default AboutUs;
