import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Calendar, Clock } from "lucide-react";
import { useState } from "react";

interface RescheduleModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (newDate: string, newTime: string) => Promise<void>;
  currentDate: string;
  currentTime: string;
  bookingId: string;
}

const RescheduleModal = ({ 
  open, 
  onClose, 
  onConfirm, 
  currentDate, 
  currentTime 
}: RescheduleModalProps) => {
  const [newDate, setNewDate] = useState(currentDate);
  const [newTime, setNewTime] = useState(currentTime);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const validateReschedule = () => {
    // Check if date and time are provided
    if (!newDate || !newTime) {
      setError("Please provide both date and time");
      return false;
    }

    // Create date objects for comparison
    const now = new Date();
    const selectedDateTime = new Date(`${newDate}T${newTime}`);
    const currentDateTime = new Date(`${currentDate}T${currentTime}`);

    // Check if the new date is in the past
    if (selectedDateTime < now) {
      setError("Cannot reschedule to a past date/time");
      return false;
    }

    // Check if reschedule is at least 1 hour before the original booking
    const oneHourBeforeBooking = new Date(currentDateTime.getTime() - 60 * 60 * 1000);
    
    if (now > oneHourBeforeBooking) {
      setError("Rescheduling must be done at least 1 hour before the scheduled time");
      return false;
    }

    // Check if the new time is different from current
    if (newDate === currentDate && newTime === currentTime) {
      setError("Please select a different date or time");
      return false;
    }

    setError("");
    return true;
  };

  const handleSubmit = async () => {
    if (!validateReschedule()) {
      return;
    }

    setLoading(true);
    try {
      await onConfirm(newDate, newTime);
      onClose();
    } catch (err) {
      setError("Failed to reschedule. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError("");
    setNewDate(currentDate);
    setNewTime(currentTime);
    onClose();
  };

  // Get minimum date (today)
  const minDate = new Date().toISOString().split('T')[0];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Reschedule Booking
          </DialogTitle>
          <DialogDescription>
            Choose a new date and time for your booking. Rescheduling must be done at least 1 hour before the scheduled time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Schedule */}
          <div className="bg-muted/50 p-3 rounded-lg space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Current Schedule:</p>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4" />
              <span>{new Date(currentDate).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4" />
              <span>{currentTime}</span>
            </div>
          </div>

          {/* New Date Input */}
          <div className="space-y-2">
            <Label htmlFor="newDate" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              New Date
            </Label>
            <Input
              id="newDate"
              type="date"
              value={newDate}
              min={minDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full"
            />
          </div>

          {/* New Time Input */}
          <div className="space-y-2">
            <Label htmlFor="newTime" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              New Time
            </Label>
            <Input
              id="newTime"
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive p-3 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleClose}
            className="flex-1"
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="flex-1"
            disabled={loading}
          >
            {loading ? "Rescheduling..." : "Confirm Reschedule"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RescheduleModal;
