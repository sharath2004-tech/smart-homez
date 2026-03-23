import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { authAPI } from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

export default function WorkerAvailabilityToggle() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['worker-profile'],
    queryFn: async () => {
      const res = await authAPI.getProfile();
      return res.user;
    }
  });

  const toggleMutation = useMutation({
    mutationFn: async (available: boolean) => {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/users/toggle-availability`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ availability: available })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to update availability');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['worker-profile'] });
      toast.success(data.message);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update availability');
    }
  });

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="flex justify-between items-center">
          <div className="animate-pulse">
            <div className="h-5 bg-gray-200 rounded w-32 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-48"></div>
          </div>
        </div>
      </Card>
    );
  }

  const isOnline = profile?.workerProfile?.availability || false;
  const availabilityReason = profile?.workerProfile?.availabilityReason as string | undefined;

  return (
    <Card className="p-4 bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-900">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
            {t('worker.dashboard.availability')}
          </h3>
          <p className={`text-sm ${isOnline ? 'text-green-600 dark:text-green-400 font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
            {isOnline 
              ? `🟢 ${t('worker.dashboard.online')}`
              : `🔴 ${availabilityReason || `${t('worker.dashboard.offline')} - No orders will be assigned`}`}
          </p>
        </div>
        <Switch
          checked={isOnline}
          onCheckedChange={(checked) => toggleMutation.mutate(checked)}
          disabled={toggleMutation.isPending}
        />
      </div>
      {toggleMutation.isPending && (
        <p className="text-xs text-gray-500 mt-2">Updating...</p>
      )}
    </Card>
  );
}
