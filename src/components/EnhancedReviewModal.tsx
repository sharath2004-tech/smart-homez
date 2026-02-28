import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Star } from 'lucide-react';

export default function EnhancedReviewModal({ booking, open, onClose }) {
  const queryClient = useQueryClient();
  const [ratings, setRatings] = useState({ overall: 0, quality: 0, timeliness: 0, professionalism: 0 });
  const [comment, setComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);

  const reviewMutation = useMutation({
    mutationFn: (data) => api.post('/reviews', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['bookings']);
      onClose();
    }
  });

  const RatingStars = ({ value, onChange, label }) => (
    <div className="mb-4">
      <label className="block text-sm font-medium mb-2">{label}</label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`cursor-pointer ${star <= value ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
            onClick={() => onChange(star)}
          />
        ))}
      </div>
    </div>
  );

  const handleSubmit = () => {
    reviewMutation.mutate({
      booking: booking._id,
      worker: booking.worker._id,
      overallRating: ratings.overall,
      categoryRatings: {
        quality: ratings.quality,
        timeliness: ratings.timeliness,
        professionalism: ratings.professionalism
      },
      comment,
      isAnonymous
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rate Your Experience</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <RatingStars label="Overall Rating" value={ratings.overall} onChange={(v) => setRatings({ ...ratings, overall: v })} />
          <RatingStars label="Quality" value={ratings.quality} onChange={(v) => setRatings({ ...ratings, quality: v })} />
          <RatingStars label="Timeliness" value={ratings.timeliness} onChange={(v) => setRatings({ ...ratings, timeliness: v })} />
          <RatingStars label="Professionalism" value={ratings.professionalism} onChange={(v) => setRatings({ ...ratings, professionalism: v })} />
          <textarea
            className="w-full border rounded p-2"
            placeholder="Write your review (max 500 characters)"
            maxLength={500}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} />
            <span className="text-sm">Submit anonymously</span>
          </label>
          <Button className="w-full" onClick={handleSubmit} disabled={ratings.overall === 0}>Submit Review</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
