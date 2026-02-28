import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Bell } from 'lucide-react';

export default function NotificationCenter() {
  const queryClient = useQueryClient();

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get('/notifications');
      return res.data.notifications;
    }
  });

  const markReadMutation = useMutation({
    mutationFn: (id) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries(['notifications'])
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.patch('/notifications/mark-all-read'),
    onSuccess: () => queryClient.invalidateQueries(['notifications'])
  });

  const unreadCount = notifications?.filter(n => !n.isRead).length || 0;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bell /> Notifications {unreadCount > 0 && <span className="text-sm bg-red-500 text-white px-2 py-1 rounded-full">{unreadCount}</span>}
        </h1>
        {unreadCount > 0 && (
          <Button size="sm" onClick={() => markAllReadMutation.mutate()}>Mark All Read</Button>
        )}
      </div>
      <div className="space-y-2">
        {notifications?.map((notif) => (
          <Card key={notif._id} className={`p-4 ${!notif.isRead ? 'bg-blue-50' : ''}`}>
            <div className="flex justify-between">
              <div>
                <h3 className="font-semibold">{notif.title}</h3>
                <p className="text-sm text-gray-600">{notif.message}</p>
                <p className="text-xs text-gray-400 mt-1">{new Date(notif.createdAt).toLocaleString()}</p>
              </div>
              {!notif.isRead && (
                <Button size="sm" variant="ghost" onClick={() => markReadMutation.mutate(notif._id)}>Mark Read</Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
