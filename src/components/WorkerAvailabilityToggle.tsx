import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Switch } from '../../components/ui/switch';
import { Card } from '../../components/ui/card';

export default function WorkerAvailabilityToggle() {
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ['worker-profile'],
    queryFn: async () => {
      const res = await api.get('/users/profile');
      return res.data.user;
    }
  });

  const toggleMutation = useMutation({
    mutationFn: async (available) => {
      return api.put('/users/profile', {
        workerProfile: { ...profile.workerProfile, availability: available }
      });
    },
    onSuccess: () => queryClient.invalidateQueries(['worker-profile'])
  });

  return (
    <Card className="p-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-semibold">Availability Status</h3>
          <p className="text-sm text-gray-600">
            {profile?.workerProfile?.availability ? 'You are online and accepting orders' : 'You are offline'}
          </p>
        </div>
        <Switch
          checked={profile?.workerProfile?.availability || false}
          onCheckedChange={(checked) => toggleMutation.mutate(checked)}
        />
      </div>
    </Card>
  );
}
