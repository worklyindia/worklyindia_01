import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface CompanyReviewFormProps {
  companyId: string;
  onReviewSubmitted: () => void;
  editingReview?: {
    id: string;
    rating: number;
    review_text: string | null;
    reviewer_name: string | null;
    reviewer_position: string | null;
    user_id: string;
    company_id: string;
  };
}

export const CompanyReviewForm = ({ companyId, onReviewSubmitted, editingReview }: CompanyReviewFormProps) => {
  const [rating, setRating] = useState(editingReview?.rating || 0);
  const [reviewText, setReviewText] = useState(editingReview?.review_text || "");
  const [reviewerPosition, setReviewerPosition] = useState(editingReview?.reviewer_position || "");
  const [loading, setLoading] = useState(false);
  const [profileName, setProfileName] = useState<string>("");
  const { user } = useAuth();

  const isEditing = !!editingReview;

  useEffect(() => {
    const fetchProfileName = async () => {
      if (!user) {
        setProfileName('');
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching profile:', error);
        }

        // Priority: Profile full_name > Email username > "User"
        if (data?.full_name && data.full_name.trim()) {
          setProfileName(data.full_name.trim());
        } else if (user.email) {
          const emailUsername = user.email.split('@')[0];
          setProfileName(emailUsername);
        } else {
          setProfileName('User');
        }
      } catch (error) {
        console.error('Failed to fetch profile name:', error);
        // Fallback to email username
        if (user.email) {
          const emailUsername = user.email.split('@')[0];
          setProfileName(emailUsername);
        } else {
          setProfileName('User');
        }
      }
    };

    fetchProfileName();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error("Please log in to submit a review");
      return;
    }

    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }

    if (!profileName || !profileName.trim()) {
      toast.error("Unable to get your profile name. Please try again.");
      return;
    }

    setLoading(true);
    try {
      if (isEditing) {
        // Update existing review
        const { error } = await supabase
          .from('company_reviews')
          .update({
            rating,
            review_text: reviewText.trim() || null,
            reviewer_name: profileName.trim(),
            reviewer_position: reviewerPosition.trim() || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingReview.id)
          .eq('user_id', user.id);

        if (error) throw error;
        toast.success("Review updated successfully!");
      } else {
        // Check for existing review before creating new one
        const { data: existingReview, error: checkError } = await supabase
          .from('company_reviews')
          .select('id')
          .eq('company_id', companyId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (checkError) {
          console.error('Error checking existing review:', checkError);
          toast.error("Failed to check existing reviews");
          return;
        }

        if (existingReview) {
          toast.error("You have already reviewed this company. Please edit your existing review instead.");
          return;
        }

        // Create new review
        const { error } = await supabase
          .from('company_reviews')
          .insert({
            company_id: companyId,
            user_id: user.id,
            rating,
            review_text: reviewText.trim() || null,
            reviewer_name: profileName.trim(),
            reviewer_position: reviewerPosition.trim() || null
          });

        if (error) {
          // Handle unique constraint violation more gracefully
          if (error.code === '23505') {
            toast.error("You have already reviewed this company. Please refresh the page.");
          } else {
            throw error;
          }
          return;
        }
        toast.success("Review submitted successfully!");
      }
      
      // Reset form only if not editing
      if (!isEditing) {
        setRating(0);
        setReviewText("");
        setReviewerPosition("");
      }
      
      onReviewSubmitted();
    } catch (err) {
      console.error('Error submitting review:', err);
      toast.error(isEditing ? "Failed to update review" : "Failed to submit review");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Edit Review" : "Write a Review"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Rating *</Label>
            <div className="flex items-center gap-1 mt-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="transition-colors"
                >
                  <Star
                    className={`w-6 h-6 ${
                      star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="reviewerPosition">Your Position</Label>
            <Input
              id="reviewerPosition"
              value={reviewerPosition}
              onChange={(e) => setReviewerPosition(e.target.value)}
              placeholder="e.g., Software Engineer, Manager"
            />
          </div>

          <div>
            <Label htmlFor="reviewText">Review</Label>
            <Textarea
              id="reviewText"
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Share your experience with this company..."
              rows={4}
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? (isEditing ? "Updating..." : "Submitting...") : (isEditing ? "Update Review" : "Submit Review")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};