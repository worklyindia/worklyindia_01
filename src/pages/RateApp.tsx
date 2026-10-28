import PageHeader from "@/components/PageHeader";
import BottomNavigation from "@/components/BottomNavigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Star, 
  Heart, 
  MessageSquare, 
  Share2,
  Award,
  TrendingUp,
  Users,
  Send,
  Edit,
  Trash2
} from "lucide-react";
import { HelpfulButton } from "@/components/review/HelpfulButton";
import { ShareReviewButton } from "@/components/review/ShareReviewButton";
import TrustpilotWidget from "@/components/review/TrustpilotWidget";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { useAppReviews } from "@/hooks/useAppReviews";
import { useAuth } from "@/contexts/AuthContext";
import { useReferralSystem } from "@/hooks/useReferralSystem";
import { BRAND_CONFIG } from "@/config/brandConfig";

const RateApp = () => {
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  
  const { user } = useAuth();
  const { 
    reviews, 
    userReview, 
    stats, 
    loading,
    isSubmitting,
    submitReview, 
    deleteReview,
    hasReviewed 
  } = useAppReviews();
  
  const { referralCode } = useReferralSystem();

  // Pre-fill form if user has already reviewed and enters edit mode
  useEffect(() => {
    if (userReview && isEditMode) {
      setRating(userReview.rating);
      setFeedback(userReview.review_text || "");
      setSelectedCategories(userReview.categories || []);
    }
  }, [userReview, isEditMode]);

  const categories = [
    "User Interface",
    "Job Search",
    "Application Process",
    "Notifications",
    "Performance",
    "Customer Support",
    "Features",
    "Overall Experience"
  ];

  const statsData = [
    { label: "Average Rating", value: stats.averageRating > 0 ? stats.averageRating.toFixed(1) : "0.0", icon: Star },
    { label: "Total Reviews", value: stats.totalReviews.toLocaleString(), icon: MessageSquare },
    { label: "5 Star Reviews", value: `${stats.fiveStarPercentage}%`, icon: TrendingUp },
    { label: "Happy Users", value: "50K+", icon: Users }
  ];

  const handleCategoryToggle = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const handleSubmitReview = async () => {
    if (!user) {
      toast({
        title: "Login required",
        description: "Please login to submit a review",
        variant: "destructive"
      });
      return;
    }

    if (rating === 0) {
      toast({
        title: "Please provide a rating",
        description: "Select stars to rate your experience",
        variant: "destructive"
      });
      return;
    }

    try {
      await submitReview(rating, feedback, selectedCategories);
      
      toast({
        title: hasReviewed ? "Review updated!" : "Thank you for your feedback!",
        description: hasReviewed 
          ? "Your review has been updated successfully"
          : "Your review has been submitted successfully",
      });

      // Reset form and exit edit mode
      setRating(0);
      setFeedback("");
      setSelectedCategories([]);
      setIsEditMode(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit review. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteReview = async () => {
    try {
      await deleteReview();
      toast({
        title: "Review deleted",
        description: "Your review has been removed"
      });
      setRating(0);
      setFeedback("");
      setSelectedCategories([]);
      setIsEditMode(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete review",
        variant: "destructive"
      });
    }
  };

  const handleEditReview = () => {
    if (userReview) {
      setRating(userReview.rating);
      setFeedback(userReview.review_text || "");
      setSelectedCategories(userReview.categories || []);
      setIsEditMode(true);
    }
  };

  const handleCancelEdit = () => {
    setRating(0);
    setFeedback("");
    setSelectedCategories([]);
    setIsEditMode(false);
  };

  const handleShareApp = async () => {
    const shareData = {
      title: `${BRAND_CONFIG.name} - Find Remote Jobs`,
      text: 'Best job portal for Workly India opportunities in India. Join thousands of professionals finding their dream jobs!',
      url: window.location.origin
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        toast({
          title: "Thanks for sharing!",
          description: "Help us grow by sharing with more people",
        });
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
        toast({
          title: "Link copied!",
          description: "Share link has been copied to clipboard",
        });
      }
    } catch (error) {
      console.error('Error sharing:', error);
      toast({
        title: "Share failed",
        description: "Please try again or copy the link manually",
        variant: "destructive"
      });
    }
  };

  const handleReferFriends = async () => {
    const referralLink = referralCode?.referral_code 
      ? `${window.location.origin}/auth?ref=${referralCode.referral_code}`
      : window.location.origin;
    
    const referralMessage = `🚀 Hey! I found this amazing job portal "${BRAND_CONFIG.name}" for Workly India opportunities. 

✅ Best remote jobs
✅ Verified companies  
✅ Easy application process
✅ Great user experience

Join using my referral link: ${referralLink}

Let's find our dream remote jobs together! 💼`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `Join ${BRAND_CONFIG.name} - Remote Jobs`,
          text: referralMessage,
          url: referralLink
        });
        toast({
          title: "Referral sent!",
          description: `Thanks for referring friends to ${BRAND_CONFIG.name}`,
        });
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(referralMessage);
        toast({
          title: "Referral message copied!",
          description: "Share this message with your friends",
        });
      }
    } catch (error) {
      console.error('Error referring:', error);
      toast({
        title: "Referral failed",
        description: "Please try again or share manually",
        variant: "destructive"
      });
    }
  };

  const ratingLabels = {
    1: "Poor",
    2: "Fair", 
    3: "Good",
    4: "Very Good",
    5: "Excellent"
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-red-50">
      <PageHeader title="Rate Our App" />
      
      <main className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 pb-24 md:pb-8 max-w-4xl">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-lg">
            <Star className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">Rate Our App</h1>
        </div>

        {/* App Rating Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {statsData.map((stat, index) => (
            <Card key={index} className="p-4 text-center">
              <stat.icon className="w-8 h-8 text-primary mx-auto mb-2" />
              <h3 className="text-2xl font-bold text-foreground">{stat.value}</h3>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </Card>
          ))}
        </div>

        {/* User's Existing Review Card */}
        {hasReviewed && userReview && !isEditMode && (
          <Card className="p-6 mb-8 border-primary/30 bg-primary/5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-foreground">Your Review</h2>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEditReview}
                    className="rounded-xl"
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeleteReview}
                    disabled={isSubmitting}
                    className="rounded-xl text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    {isSubmitting ? "Deleting..." : "Delete"}
                  </Button>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {[...Array(5)].map((_, i) => (
                  <Star 
                    key={i}
                    className={`w-6 h-6 ${i < userReview.rating ? 'text-yellow-500 fill-current' : 'text-gray-300'}`}
                  />
                ))}
                <span className="ml-2 text-muted-foreground">
                  {new Date(userReview.created_at || '').toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </span>
              </div>
              
              {userReview.review_text && (
                <p className="text-muted-foreground">{userReview.review_text}</p>
              )}
              
              {userReview.categories && userReview.categories.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {userReview.categories.map((category, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {category}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Rating Section - Show if user hasn't reviewed OR is in edit mode */}
        {(!hasReviewed || isEditMode) && (
          <Card className="p-8 mb-8">
            <div className="text-center space-y-6">
              <div>
                <h2 className="text-2xl font-semibold text-foreground mb-2">
                  {isEditMode ? "Edit Your Review" : "How was your experience?"}
                </h2>
                <p className="text-muted-foreground">Your feedback helps us improve the app for everyone</p>
              </div>

              {/* Star Rating */}
              <div className="space-y-4">
                <div className="flex justify-center space-x-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-1 transition-transform hover:scale-110"
                    >
                      <Star 
                        className={`w-12 h-12 ${
                          star <= (hoverRating || rating) 
                            ? 'text-yellow-500 fill-current' 
                            : 'text-gray-300'
                        }`} 
                      />
                    </button>
                  ))}
                </div>
                
                {(rating > 0 || hoverRating > 0) && (
                  <p className="text-lg font-medium text-foreground">
                    {ratingLabels[hoverRating || rating] as keyof typeof ratingLabels}
                  </p>
                )}
              </div>

              {/* Category Selection */}
              {rating > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground">What aspects would you like to rate?</h3>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {categories.map((category) => (
                      <button
                        key={category}
                        onClick={() => handleCategoryToggle(category)}
                        className="transition-all"
                      >
                        <Badge 
                          variant={selectedCategories.includes(category) ? "default" : "outline"}
                          className="cursor-pointer hover:scale-105"
                        >
                          {category}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Feedback Text */}
              {rating > 0 && (
                <div className="space-y-4 max-w-2xl mx-auto">
                  <h3 className="text-lg font-semibold text-foreground">Share your thoughts (optional)</h3>
                  <Textarea
                    placeholder="Tell us more about your experience..."
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    className="rounded-xl min-h-[120px]"
                  />
                </div>
              )}

              {/* Submit Button */}
              {rating > 0 && (
                <div className="flex gap-4 justify-center">
                  <Button 
                    size="lg" 
                    className="rounded-xl px-8"
                    onClick={handleSubmitReview}
                    disabled={isSubmitting}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {isSubmitting ? "Submitting..." : (isEditMode ? "Update Review" : "Submit Review")}
                  </Button>
                  
                  {isEditMode && (
                    <Button 
                      variant="outline"
                      size="lg" 
                      className="rounded-xl px-8"
                      onClick={handleCancelEdit}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Recent Reviews */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">Recent Reviews</h2>
            <Button 
              variant="outline" 
              className="rounded-xl"
              onClick={() => navigate('/reviews')}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              View All
            </Button>
          </div>

          <div className="space-y-4">
            {loading ? (
              <p className="text-center text-muted-foreground">Loading reviews...</p>
            ) : reviews.length === 0 ? (
              <p className="text-center text-muted-foreground">No reviews yet. Be the first to review!</p>
            ) : (
              reviews.map((review) => (
                <Card key={review.id} className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-3">
                          <h3 className="font-semibold text-foreground">
                            {review.profiles?.full_name || "Anonymous User"}
                          </h3>
                          <div className="flex items-center space-x-1">
                            {[...Array(5)].map((_, starIndex) => (
                              <Star 
                                key={starIndex} 
                                className={`w-4 h-4 ${
                                  starIndex < review.rating 
                                    ? 'text-yellow-500 fill-current' 
                                    : 'text-gray-300'
                                }`} 
                              />
                            ))}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {new Date(review.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                      <ShareReviewButton
                        reviewId={review.id}
                        userName={review.profiles?.full_name || "Anonymous User"}
                        rating={review.rating}
                        reviewText={review.review_text}
                      />
                    </div>

                    {review.review_text && (
                      <p className="text-muted-foreground">{review.review_text}</p>
                    )}

                    {review.categories && review.categories.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {review.categories.map((category, catIndex) => (
                          <Badge key={catIndex} variant="secondary" className="text-xs">
                            {category}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="space-y-2">
                      <HelpfulButton 
                        reviewId={review.id} 
                        helpfulCount={review.helpful_count}
                      />
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Trustpilot Widget */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-foreground mb-4 text-center">
            Also Review Us on Trustpilot
          </h2>
          <TrustpilotWidget />
        </div>

        {/* Appreciation Section */}
        <Card className="p-8 mt-8 bg-primary/5 border-primary/20 text-center">
          <div className="space-y-4">
            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
              <Heart className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-semibold text-foreground">Thank You!</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Your feedback is incredibly valuable to us. Every review helps us understand what we're doing well 
              and where we can improve to serve you better.
            </p>
            <div className="flex space-x-4 justify-center">
              <Button 
                variant="outline" 
                className="rounded-xl"
                onClick={handleShareApp}
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share App
              </Button>
              <Button 
                className="rounded-xl"
                onClick={handleReferFriends}
              >
                <Award className="w-4 h-4 mr-2" />
                Refer Friends
              </Button>
            </div>
          </div>
        </Card>
      </main>

      <BottomNavigation />
    </div>
  );
};

export default RateApp;