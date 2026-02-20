import { bookingsAPI } from "@/lib/api";
import { ArrowLeft, Star } from "lucide-react";
import { useState } from "react";

interface ReviewModalProps {
  bookingId: string;
  workerName: string;
  onClose: () => void;
  onReviewSubmitted: () => void;
}

const ReviewModal = ({ bookingId, workerName, onClose, onReviewSubmitted }: ReviewModalProps) => {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [review, setReview] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmitReview = async () => {
    if (rating === 0) {
      alert('Please select a rating');
      return;
    }

    try {
      setSubmitting(true);
      await bookingsAPI.update(bookingId, {
        rating,
        review: review.trim()
      });
      alert('Thank you for your review!');
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

            {/* Star Rating */}
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoveredRating(star)}
                    onMouseLeave={() => setHoveredRating(0)}
                    className="transition-transform hover:scale-110 focus:outline-none"
                  >
                    <Star
                      className={`w-12 h-12 ${
                        star <= (hoveredRating || rating)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
              {rating > 0 && (
                <p className="text-sm font-medium text-foreground">
                  {rating === 1 && "Poor"}
                  {rating === 2 && "Fair"}
                  {rating === 3 && "Good"}
                  {rating === 4 && "Very Good"}
                  {rating === 5 && "Excellent"}
                </p>
              )}
            </div>

            {/* Review Text */}
            <div>
              <label className="block mb-2">
                <span className="text-sm font-medium text-foreground">
                  Share your feedback (optional)
                </span>
              </label>
              <textarea
                value={review}
                onChange={(e) => setReview(e.target.value)}
                placeholder="Tell us about your experience..."
                rows={4}
                maxLength={500}
                className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1 text-right">
                {review.length}/500 characters
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              <button
                onClick={handleSubmitReview}
                disabled={submitting || rating === 0}
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
