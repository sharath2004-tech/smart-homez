import { bookingsAPI, reviewsAPI } from "@/lib/api";
import { ArrowLeft, Star } from "lucide-react";
import { useState } from "react";

interface ReviewModalProps {
  bookingId: string;
  workerId: string;
  workerName: string;
  onClose: () => void;
  onReviewSubmitted: () => void;
}

const ReviewModal = ({ bookingId, workerId, workerName, onClose, onReviewSubmitted }: ReviewModalProps) => {
  const [overallRating, setOverallRating] = useState(0);
  const [qualityRating, setQualityRating] = useState(0);
  const [timelinessRating, setTimelinessRating] = useState(0);
  const [professionalismRating, setProfessionalismRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmitReview = async () => {
    if (overallRating === 0) {
      alert('Please select an overall rating');
      return;
    }
    if (qualityRating === 0 || timelinessRating === 0 || professionalismRating === 0) {
      alert('Please rate all categories: Quality, Timeliness, and Professionalism');
      return;
    }

    try {
      setSubmitting(true);
      
      // Create review using the proper API that updates worker stats
      await reviewsAPI.createReview({
        booking: bookingId,
        worker: workerId,
        overallRating,
        categoryRatings: {
          quality: qualityRating,
          timeliness: timelinessRating,
          professionalism: professionalismRating
        },
        comment: comment.trim() || undefined,
        isAnonymous
      });
      
      // Also update the booking record for quick reference
      await bookingsAPI.update(bookingId, {
        rating: overallRating,
        review: comment.trim() || undefined
      });
      
      alert('✅ Thank you for your review! Your feedback helps improve our service.');
      onReviewSubmitted();
    } catch (error) {
      console.error('Error submitting review:', error);
      alert('Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    if (confirm('Are you sure you want to skip the review?')) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
      <div className="min-h-screen p-4 flex items-start justify-center py-8">
        <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl">
          {/* Header */}
          <div className="sticky top-0 bg-primary text-primary-foreground p-6 rounded-t-2xl flex items-center gap-4">
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h2 className="text-xl font-bold">Rate Your Experience</h2>
              <p className="text-sm opacity-90">Help us serve you better</p>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Worker Info */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">How was your experience with</p>
              <p className="text-xl font-bold text-foreground">{workerName}?</p>
            </div>

            {/* Overall Rating */}
            <div className="flex flex-col items-center gap-4 py-4">
              <p className="text-sm font-medium text-muted-foreground">Overall Rating</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setOverallRating(star)}
                    onMouseEnter={() => setHoveredRating(star)}
                    onMouseLeave={() => setHoveredRating(0)}
                    className="transition-transform hover:scale-110 focus:outline-none"
                  >
                    <Star
                      className={`w-12 h-12 ${
                        star <= (hoveredRating || overallRating)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
              {overallRating > 0 && (
                <p className="text-sm font-medium text-foreground">
                  {overallRating === 1 && "Poor"}
                  {overallRating === 2 && "Fair"}
                  {overallRating === 3 && "Good"}
                  {overallRating === 4 && "Very Good"}
                  {overallRating === 5 && "Excellent"}
                </p>
              )}
            </div>

            {/* Category Ratings */}
            <div className="space-y-4 bg-muted/50 p-4 rounded-xl">
              <h3 className="text-sm font-semibold text-foreground">Rate by Category</h3>
              
              {/* Quality */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Quality of Work</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setQualityRating(star)}
                      className="transition-transform hover:scale-110 focus:outline-none"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          star <= qualityRating
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Timeliness */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Timeliness</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setTimelinessRating(star)}
                      className="transition-transform hover:scale-110 focus:outline-none"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          star <= timelinessRating
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Professionalism */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Professionalism</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setProfessionalismRating(star)}
                      className="transition-transform hover:scale-110 focus:outline-none"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          star <= professionalismRating
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Comment */}
            <div>
              <label className="block mb-2">
                <span className="text-sm font-medium text-foreground">
                  Share your feedback (optional)
                </span>
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Tell us about your experience..."
                rows={4}
                maxLength={500}
                className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1 text-right">
                {comment.length}/500 characters
              </p>
            </div>

            {/* Anonymous Option */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="anonymous"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="w-4 h-4 text-primary border-border rounded focus:ring-2 focus:ring-primary"
              />
              <label htmlFor="anonymous" className="text-sm text-muted-foreground">
                Submit anonymously
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              <button
                onClick={handleSubmitReview}
                disabled={submitting || overallRating === 0 || qualityRating === 0 || timelinessRating === 0 || professionalismRating === 0}
                className="w-full btn-brand py-3 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Submitting...
                  </>
                ) : (
                  <>
                    <Star className="w-5 h-5" />
                    Submit Review
                  </>
                )}
              </button>
              <button
                onClick={handleSkip}
                disabled={submitting}
                className="w-full btn-secondary py-3"
              >
                Skip for Now
              </button>
            </div>

            {/* Info Note */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
              <p className="font-medium mb-1">💡 Your review helps us improve</p>
              <p>Your honest feedback helps other customers and improves our service quality.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewModal;
