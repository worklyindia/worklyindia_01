import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, Quote, Star, MapPin, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SafeAvatarImage } from "@/components/ui/safe-image";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface SuccessStory {
  id: string;
  name: string;
  location: string;
  jobTitle: string;
  company: string;
  testimonial: string;
  rating: number;
  avatarUrl?: string;
  createdAt: string;
}

const SuccessStoriesCarousel = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Fetch real reviews from app_reviews table with profile info
  const { data: stories, isLoading } = useQuery({
    queryKey: ['success-stories'],
    queryFn: async (): Promise<SuccessStory[]> => {
      const { data: reviews, error } = await supabase
        .from('app_reviews')
        .select(`
          id,
          rating,
          review_text,
          created_at,
          user_id
        `)
        .gte('rating', 4)
        .not('review_text', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      // Fetch profile info for each review
      const storiesWithProfiles = await Promise.all(
        (reviews || []).map(async (review) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, profile_image_url, location')
            .eq('id', review.user_id)
            .single();

          return {
            id: review.id,
            name: profile?.full_name || 'Job Seeker',
            location: profile?.location || 'India',
            jobTitle: 'Remote Professional',
            company: 'Workly India User',
            testimonial: review.review_text || 'Great platform for finding remote jobs!',
            rating: review.rating,
            avatarUrl: profile?.profile_image_url || undefined,
            createdAt: review.created_at,
          };
        })
      );

      return storiesWithProfiles.length > 0 ? storiesWithProfiles : getPlaceholderStories();
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  const getPlaceholderStories = (): SuccessStory[] => [
    {
      id: '1',
      name: 'Priya Sharma',
      location: 'Mumbai, Maharashtra',
      jobTitle: 'Customer Support Executive',
      company: 'Remote Company',
      testimonial: 'Found my dream remote job within 2 weeks! The platform is 100% free and all employers are verified. Highly recommend to anyone looking for legitimate Workly India.',
      rating: 5,
      createdAt: new Date().toISOString(),
    },
    {
      id: '2',
      name: 'Rahul Verma',
      location: 'Delhi',
      jobTitle: 'Data Entry Specialist',
      company: 'Tech Solutions',
      testimonial: 'After being scammed by fake job portals, I found Workly India. The UDYAM registration gave me confidence. Got hired within a month!',
      rating: 5,
      createdAt: new Date().toISOString(),
    },
    {
      id: '3',
      name: 'Anita Patel',
      location: 'Ahmedabad, Gujarat',
      jobTitle: 'Content Writer',
      company: 'Digital Agency',
      testimonial: 'As a mother of two, Workly India was essential. Workly India helped me find a flexible content writing job. No registration fees - truly free!',
      rating: 5,
      createdAt: new Date().toISOString(),
    },
  ];

  const displayStories = stories || getPlaceholderStories();

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % displayStories.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + displayStories.length) % displayStories.length);
  };

  if (isLoading) {
    return (
      <section className="py-8 bg-muted/30">
        <div className="container mx-auto px-4 lg:px-6 xl:px-8 max-w-4xl">
          <Skeleton className="h-8 w-48 mx-auto mb-6" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </section>
    );
  }

  const currentStory = displayStories[currentIndex];

  return (
    <section className="py-8 bg-muted/30">
      <div className="container mx-auto px-4 lg:px-6 xl:px-8 max-w-4xl">
        <div className="text-center mb-6">
          <h2 className="text-xl md:text-2xl font-bold text-foreground mb-1">
            ⭐ Success Stories
          </h2>
          <p className="text-sm text-muted-foreground">
            Real experiences from our community members
          </p>
        </div>

        <div className="relative">
          {/* Story Card */}
          <div className="bg-card border rounded-2xl p-6 md:p-8 shadow-sm">
            <Quote className="w-8 h-8 text-primary/30 mb-4" />
            
            <p className="text-foreground text-base md:text-lg leading-relaxed mb-6">
              "{currentStory.testimonial}"
            </p>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Avatar className="w-12 h-12 border-2 border-primary/20">
                  <SafeAvatarImage src={currentStory.avatarUrl} width={96} />
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {currentStory.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-foreground">{currentStory.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3" />
                    <span>{currentStory.location}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-start sm:items-end gap-1">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${
                        i < currentStory.rating
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-muted-foreground'
                      }`}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Briefcase className="w-3 h-3" />
                  <span>{currentStory.jobTitle}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          {displayStories.length > 1 && (
            <>
              <Button
                variant="outline"
                size="icon"
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 bg-background shadow-md"
                onClick={prevSlide}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 bg-background shadow-md"
                onClick={nextSlide}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>

              {/* Dots */}
              <div className="flex justify-center gap-2 mt-4">
                {displayStories.map((_, index) => (
                  <button
                    key={index}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === currentIndex ? 'bg-primary' : 'bg-muted-foreground/30'
                    }`}
                    onClick={() => setCurrentIndex(index)}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* CTA */}
        <div className="text-center mt-6">
          <Badge variant="secondary" className="text-xs">
            Share your success story and inspire others!
          </Badge>
        </div>
      </div>
    </section>
  );
};

export default SuccessStoriesCarousel;
