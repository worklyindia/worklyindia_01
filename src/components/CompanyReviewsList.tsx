import { Card, CardContent } from "@/components/ui/card";
import { Star, Shield, Edit2, Trash2, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { CompanyReviewForm } from "./CompanyReviewForm";

interface Review {
  id: string;
  rating: number;
  review_text: string | null;
  reviewer_name: string | null;
  reviewer_position: string | null;
  is_verified: boolean;
  created_at: string;
  user_id: string;
  company_id: string;
}

interface CompanyReviewsListProps {
  reviews: Review[];
  loading: boolean;
  onReviewUpdated?: () => void;
}

export const CompanyReviewsList = ({ reviews, loading, onReviewUpdated }: CompanyReviewsListProps) => {
  const { user } = useAuth();
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);

  const handleEditReview = (review: Review) => {
    setEditingReview(review);
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!user) {
      toast.error("Please log in to delete reviews");
      return;
    }

    setDeletingReviewId(reviewId);
    
    try {
      const { error } = await supabase
        .from('company_reviews')
        .delete()
        .eq('id', reviewId)
        .eq('user_id', user.id);

      if (error) throw error;
      
      toast.success("Review deleted successfully");
      onReviewUpdated?.();
    } catch (error) {
      console.error('Error deleting review:', error);
      toast.error("Failed to delete review");
    } finally {
      setDeletingReviewId(null);
    }
  };

  const handleUpdateReview = async (updatedData: any) => {
    if (!editingReview || !user) return;

    try {
      const { error } = await supabase
        .from('company_reviews')
        .update({
          rating: updatedData.rating,
          review_text: updatedData.review_text,
          reviewer_name: updatedData.reviewer_name,
          reviewer_position: updatedData.reviewer_position,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingReview.id)
        .eq('user_id', user.id);

      if (error) throw error;
      
      toast.success("Review updated successfully");
      setEditingReview(null);
      onReviewUpdated?.();
    } catch (error) {
      console.error('Error updating review:', error);
      toast.error("Failed to update review");
    }
  };
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-16 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (editingReview) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Edit Review</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditingReview(null)}
          >
            Cancel
          </Button>
        </div>
        <CompanyReviewForm
          companyId={editingReview.company_id}
          editingReview={editingReview}
          onReviewSubmitted={() => {
            setEditingReview(null);
            onReviewUpdated?.();
          }}
        />
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">No reviews yet. Be the first to review this company!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <Card key={review.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-4 h-4 ${
                        star <= review.rating
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-300"
                      }`}
                    />
                  ))}
                </div>
                {review.is_verified && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    Verified
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {new Date(review.created_at).toLocaleDateString()}
                </span>
                {user && user.id === review.user_id && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditReview(review)}>
                        <Edit2 className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDeleteReview(review.id)}
                        className="text-destructive"
                        disabled={deletingReviewId === review.id}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {deletingReviewId === review.id ? "Deleting..." : "Delete"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
            
            <div className="mb-2">
              <p className="font-medium text-sm">
                {review.reviewer_name || "Anonymous"}
                {review.reviewer_position && (
                  <span className="text-muted-foreground font-normal">
                    {" • "}{review.reviewer_position}
                  </span>
                )}
              </p>
            </div>
            
            {review.review_text && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {review.review_text}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};