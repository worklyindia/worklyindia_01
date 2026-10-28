import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import BottomNavigation from "@/components/BottomNavigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { useAppReviews } from "@/hooks/useAppReviews";
import { HelpfulButton } from "@/components/review/HelpfulButton";
import { ShareReviewButton } from "@/components/review/ShareReviewButton";
import SEO from "@/components/SEO";

const REVIEWS_PER_PAGE = 10;

const AllReviews = () => {
  const navigate = useNavigate();
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
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-red-50">
      <SEO 
        title="All Reviews | Workly India"
        description="Read all user reviews and ratings for Workly India job portal. See what job seekers think about our platform."
      />
      <Header hideSearch />
      
      <main className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 pb-24 md:pb-8 max-w-4xl">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="rounded-xl"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">
            All Reviews
          </h1>
          <div className="w-20"></div> {/* Spacer for centering */}
        </div>

        {/* Stats Summary */}
        <Card className="p-4 mb-6">
          <div className="flex items-center justify-center space-x-2">
            <Star className="w-5 h-5 text-yellow-500 fill-current" />
            <span className="text-lg font-semibold text-foreground">
              {filteredReviews.length} {filterRating ? `${filterRating}-star` : ''} review{filteredReviews.length !== 1 ? 's' : ''}
            </span>
          </div>
        </Card>

        {/* Filter by Rating */}
        <div className="flex gap-2 flex-nowrap mb-6 overflow-x-auto pb-2">
          <Button
            variant={filterRating === null ? "default" : "outline"}
            size="sm"
            onClick={() => handleRatingFilterChange(null)}
            className="rounded-xl flex-shrink-0"
          >
            All Ratings
          </Button>
          {[5, 4, 3, 2, 1].map((rating) => (
            <Button
              key={rating}
              variant={filterRating === rating ? "default" : "outline"}
              size="sm"
              onClick={() => handleRatingFilterChange(rating)}
              className="rounded-xl flex-shrink-0"
            >
              {rating} <Star className="w-3 h-3 ml-1 fill-current" />
            </Button>
          ))}
        </div>

        {/* Reviews List */}
        <div className="space-y-4">
          {loading ? (
            <Card className="p-8">
              <p className="text-center text-muted-foreground">Loading reviews...</p>
            </Card>
          ) : paginatedReviews.length === 0 ? (
            <Card className="p-8">
              <p className="text-center text-muted-foreground">
                {filterRating ? `No ${filterRating}-star reviews found` : "No reviews yet"}
              </p>
            </Card>
          ) : (
            paginatedReviews.map((review) => (
              <Card key={review.id} className="p-4 sm:p-6 w-full overflow-hidden">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center space-x-3 flex-wrap">
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
                    <p className="text-muted-foreground break-words">{review.review_text}</p>
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
          <div className="flex items-center justify-between mt-6 gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded-xl"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Previous</span>
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
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </main>

      <BottomNavigation />
    </div>
  );
};

export default AllReviews;
