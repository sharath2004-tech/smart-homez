import { useMutation } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { api } from '../../lib/api';

export default function SOSButton({ booking }) {
  const [location, setLocation] = useState(null);

  const sosMutation = useMutation({
    mutationFn: async () => {
      const coords = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve([pos.coords.longitude, pos.coords.latitude]),
          reject
        );
      });
      return api.post('/sos', {
        location: { type: 'Point', coordinates: coords },
        userType: 'customer',
        booking: booking?._id,
        notes: 'Emergency alert triggered'
      });
    },
    onSuccess: () => {
      toast.success('Emergency alert sent! Help is on the way.');
    }
  });

  return (
    <Button
      variant="destructive"
      size="lg"
      className="w-full"
      onClick={() => sosMutation.mutate()}
      disabled={sosMutation.isPending}
    >
      <AlertTriangle className="mr-2" />
      {sosMutation.isPending ? 'Sending Alert...' : 'SOS Emergency'}
    </Button>
  );
}
