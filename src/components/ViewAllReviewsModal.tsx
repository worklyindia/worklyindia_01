import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import { useAppReviews } from "@/hooks/useAppReviews";
import { HelpfulButton } from "@/components/review/HelpfulButton";
import { ShareReviewButton } from "@/components/review/ShareReviewButton";

interface ViewAllReviewsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const REVIEWS_PER_PAGE = 10;

export const ViewAllReviewsModal = ({ open, onOpenChange }: ViewAllReviewsModalProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [filterRating, setFilterRating] = useState<number | null>(null);
  const { reviews, loading } = useAppReviews();

  // Filter reviews by rating if selected
  const filteredReviews = filterRating
    ? reviews.filter(r => r.rating === filterRating)
    : reviews;

  // Pagination
  const totalPages = Math.ceil(filteredReviews.length / REVIEWS_PER_PAGE);
  const startIndex = (currentPage - 1) * REVIEWS_PER_PAGE;
  const paginatedReviews = filteredReviews.slice(startIndex, startIndex + REVIEWS_PER_PAGE);

  const handleRatingFilterChange = (rating: number | null) => {
    setFilterRating(rating);
    setCurrentPage(1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">All Reviews</DialogTitle>
        </DialogHeader>

        {/* Filter by Rating */}
        <div className="flex gap-2 flex-nowrap mb-4 overflow-x-auto pb-2">
          <Button
            variant={filterRating === null ? "default" : "outline"}
            size="sm"
            onClick={() => handleRatingFilterChange(null)}
            className="rounded-xl"
          >
            All Ratings
          </Button>
          {[5, 4, 3, 2, 1].map((rating) => (
            <Button
              key={rating}
              variant={filterRating === rating ? "default" : "outline"}
              size="sm"
              onClick={() => handleRatingFilterChange(rating)}
              className="rounded-xl"
            >
              {rating} <Star className="w-3 h-3 ml-1 fill-current" />
            </Button>
          ))}
        </div>

        {/* Reviews List */}
        <div className="space-y-4">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading reviews...</p>
          ) : paginatedReviews.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {filterRating ? `No ${filterRating}-star reviews found` : "No reviews yet"}
            </p>
          ) : (
            paginatedReviews.map((review) => (
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
                                  ? "text-yellow-500 fill-current"
                                  : "text-gray-300"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {new Date(review.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded-xl"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="rounded-xl"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
