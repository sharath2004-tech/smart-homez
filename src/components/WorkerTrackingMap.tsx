import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/card';

export default function WorkerTrackingMap({ bookingId }) {
  const [eta, setEta] = useState(null);

  const { data: tracking } = useQuery({
    queryKey: ['tracking', bookingId],
    queryFn: async () => {
      const res = await api.get(`/tracking/booking/${bookingId}`);
      return res.data.tracking;
    },
    refetchInterval: 10000
  });

  useEffect(() => {
    if (tracking?.eta) {
      setEta(new Date(tracking.eta));
    }
  }, [tracking]);

  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-4">Worker Location</h3>
      {tracking ? (
        <div className="space-y-2">
          <p className="text-sm">Worker: {tracking.worker?.name}</p>
          <p className="text-sm">Status: {tracking.status}</p>
          {eta && <p className="text-sm">ETA: {eta.toLocaleTimeString()}</p>}
          {tracking.delayMinutes > 0 && (
            <p className="text-sm text-yellow-600">Delayed by {tracking.delayMinutes} minutes</p>
          )}
          <div className="h-64 bg-gray-200 rounded flex items-center justify-center">
            <p className="text-gray-500">Map View (Integrate Google Maps)</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500">No tracking data available</p>
      )}
    </Card>
  );
}
