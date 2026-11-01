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
import BrandSocialBar from "@/components/BrandSocialBar";
import FounderSection from "@/components/FounderSection";
import { ROUTE_SEO } from "@/lib/routeSeo";

const AboutUs = () => {
  const { data: merchantInfo } = useMerchantInfo();
  const { data: socialLinks } = useSocialLinks();
  
  const stats = [
    { label: "Job Seekers", value: "500K+", icon: Users },
    { label: "Hiring Companies", value: "5K+", icon: Building },
    { label: "Job Opportunities", value: "15K+", icon: Target },
    { label: "Fee for Job Seekers", value: "₹0", icon: Award }
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
        title={ROUTE_SEO['/about-us'].title}
        description={ROUTE_SEO['/about-us'].description}
        keywords={ROUTE_SEO['/about-us'].keywords}
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
              Join 500,000+ job seekers and 5,000+ companies hiring on Workly India — with verified employers since 2025. Verified opportunities, zero registration fees, and strong fraud protection.
            </p>
            <div className="flex justify-center mt-6 space-x-4">
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                <Shield className="w-4 h-4 mr-1" />
                Government Registered
              </Badge>
              <Badge variant="secondary" className="bg-secondary text-secondary-foreground">
                <Building className="w-4 h-4 mr-1" />
                Legally Compliant
              </Badge>
            </div>
          </div>
        </TextReveal>

        <FounderSection className="mb-12" />

        {/* Stats Section */}
        <ParallaxSection speed={0.08} fadeIn>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
            {stats.map((stat, index) => (
              <Tilt3DCard key={index} className="rounded-xl" maxTilt={12}>
                <Card className="p-6 text-center bg-card border border-border/50 animate-scale-bounce-in" style={{ animationDelay: `${index * 0.1}s`, animationFillMode: 'both' }}>
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
                  <Card className="p-6 bg-card border border-border/50 hover-lift animate-slide-up-fade" style={{ animationDelay: `${index * 0.1}s`, animationFillMode: 'both' }}>
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

        {/* Why Workly India */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-6 text-center">Why People Trust Workly India</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { t: "100% Free for Job Seekers", d: "No registration fee, no training fee, no hidden charges — ever.", i: Award },
              { t: "Verified Employers", d: "Every company's documents, address and contact are checked before jobs go live.", i: Shield },
              { t: "Free Resume Builder", d: "Create professional resumes and cover letters in minutes, at no cost.", i: Target },
              { t: "Government Registered", d: "UDYAM MSME registered business from Patan, Gujarat, India.", i: Building },
              { t: "Direct HR Connect", d: "Talk to employers directly — no agents and no middlemen.", i: Users },
              { t: "Real Human Support", d: "Call or WhatsApp our team for any job, complaint or platform issue.", i: Phone },
            ].map((f) => (
              <Card key={f.t} className="p-5 bg-card border border-border flex items-start gap-4">
                <div className="p-3 bg-primary/10 rounded-xl shrink-0"><f.i className="w-5 h-5 text-primary" /></div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">{f.t}</h3>
                  <p className="text-sm text-muted-foreground">{f.d}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Company Information */}
        <Card className="p-8 mb-8">
          <div className="flex items-center mb-6">
            <div className="p-3 bg-primary/10 rounded-xl mr-4">
              <Building className="w-8 h-8 text-primary" />
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
          
          <div className="mt-6 p-4 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 text-primary mr-2" />
              <p className="text-sm text-foreground">
                <strong>Verified Business:</strong> All company details have been verified using official government records.
              </p>
            </div>
          </div>
        </Card>

        {/* Story Section */}
        <Card className="p-8 bg-card border border-border/50">
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
              Today, we've successfully helped 500,000+ job seekers connect with 5,000+ companies hiring across India. Our fraud-prevention policy has protected countless job seekers from scams, while our dedicated support ensures quick resolution of any disputes.
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

        {/* Social Media Section — same icons as home page */}
        <Card className="p-6 sm:p-8 mt-8 mb-8 bg-card border border-border">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-foreground mb-2">Connect With Us</h2>
            <p className="text-muted-foreground">
              Follow Workly India for daily job updates, career tips and success stories
            </p>
          </div>
          <BrandSocialBar size="md" />
        </Card>

      </main>

    </div>
  );
};

export default AboutUs;
