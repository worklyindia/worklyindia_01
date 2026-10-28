import Header from "@/components/Header";
import BottomNavigation from "@/components/BottomNavigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, User, Heart, MessageCircle, Share, ArrowRight } from "lucide-react";

const TeamDiary = () => {
  const diaryEntries = [
    {
      id: 1,
      title: "Building the Future of Workly India",
      author: "Priya Sharma",
      role: "Product Manager",
      date: "2024-01-15",
      category: "Product Updates",
      excerpt: "Today we launched our new AI-powered job matching feature. The response from our community has been overwhelming...",
      image: "https://jubwzelupbntbetpajqb.supabase.co/storage/v1/object/public/brand-assets/site/95e6c7e0-54e1-4b48-af3e-382152dbf631.png",
      likes: 245,
      comments: 18
    },
    {
      id: 2,
      title: "Remote Team Building in the Digital Age",
      author: "Rohit Kumar", 
      role: "Engineering Lead",
      date: "2024-01-12",
      category: "Team Culture",
      excerpt: "How we maintain team spirit and collaboration across different time zones. Our monthly virtual coffee sessions have become...",
      likes: 189,
      comments: 12
    },
    {
      id: 3,
      title: "The Art of Virtual Interviews",
      author: "Sneha Patel",
      role: "HR Director", 
      date: "2024-01-10",
      category: "HR Insights",
      excerpt: "Best practices for conducting effective remote interviews. We've learned so much from interviewing over 1000 candidates...",
      likes: 156,
      comments: 24
    },
    {
      id: 4,
      title: "Scaling with Purpose",
      author: "Arjun Mehta",
      role: "CEO",
      date: "2024-01-08",
      category: "Leadership",
      excerpt: "Reflections on our journey from a small startup to serving 50,000+ users. The challenges, wins, and lessons learned...",
      likes: 312,
      comments: 45
    },
    {
      id: 5,
      title: "Design Thinking for Remote Platforms",
      author: "Kavya Reddy",
      role: "UX Designer",
      date: "2024-01-05", 
      category: "Design",
      excerpt: "How we approach user experience design for a platform that connects people virtually. Every pixel matters when...",
      likes: 198,
      comments: 15
    },
    {
      id: 6,
      title: "Data-Driven Hiring Decisions",
      author: "Vikash Singh",
      role: "Data Scientist",
      date: "2024-01-03",
      category: "Analytics",
      excerpt: "Using machine learning to improve match quality between candidates and employers. Our algorithms are getting smarter...",
      likes: 167,
      comments: 21
    }
  ];

  const categories = ["All", "Product Updates", "Team Culture", "HR Insights", "Leadership", "Design", "Analytics"];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-6 pb-24 md:pb-8 max-w-4xl">
        {/* Header Section */}
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4">Behind the Scenes</Badge>
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Team Diary
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Stories, insights, and experiences from the Workly India team. 
            Get an inside look at how we're building the future of Workly India.
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-8 justify-center">
          {categories.map((category, index) => (
            <Button
              key={index}
              variant={index === 0 ? "default" : "outline"}
              size="sm"
              className="text-xs"
            >
              {category}
            </Button>
          ))}
        </div>

        {/* Blog Posts Grid */}
        <div className="space-y-6">
          {diaryEntries.map((entry, index) => (
            <Card key={entry.id} className="p-6 bg-gradient-to-br from-white to-gray-50 border border-border/50 hover:shadow-lg transition-all duration-200 cursor-pointer group">
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-3">
                    <Badge variant="secondary" className="text-xs">
                      {entry.category}
                    </Badge>
                    <span className="text-xs text-muted-foreground">•</span>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3 mr-1" />
                      {new Date(entry.date).toLocaleDateString('en-US', { 
                        month: 'long', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </div>
                  </div>
                  
                  <h2 className="text-xl font-semibold text-foreground mb-3 group-hover:text-primary transition-colors">
                    {entry.title}
                  </h2>
                  
                  <p className="text-muted-foreground mb-4 line-clamp-3">
                    {entry.excerpt}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{entry.author}</p>
                          <p className="text-xs text-muted-foreground">{entry.role}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <Heart className="w-4 h-4" />
                        <span>{entry.likes}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <MessageCircle className="w-4 h-4" />
                        <span>{entry.comments}</span>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Share className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                
                {/* Image - only for first entry as example */}
                {index === 0 && entry.image && (
                  <div className="lg:w-48 lg:shrink-0">
                    <div className="aspect-video lg:aspect-square bg-gray-200 rounded-lg overflow-hidden">
                      <img loading="lazy" decoding="async" 
                        src={entry.image} 
                        alt={entry.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>

        {/* Load More */}
        <div className="text-center mt-8">
          <Button variant="outline" size="lg">
            Load More Stories
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>

        {/* Newsletter Signup */}
        <Card className="p-8 mt-12 bg-gradient-to-r from-primary/5 to-secondary/5 border border-border/50">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground mb-4">
              Stay Updated
            </h2>
            <p className="text-muted-foreground mb-6">
              Subscribe to get the latest team updates and insights delivered to your inbox.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 px-4 py-2 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground"
              />
              <Button>
                Subscribe
              </Button>
            </div>
          </div>
        </Card>
      </main>

      <BottomNavigation />
    </div>
  );
};

export default TeamDiary;