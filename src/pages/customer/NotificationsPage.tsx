import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppLayout from '../../components/AppLayout';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { api, authAPI } from '../../lib/api';

interface Notification {
  _id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationCenterProps {
  userType?: "customer" | "worker" | "admin" | "super_admin";
}

interface ProfileSummary {
  role?: "customer" | "worker" | "admin" | "super_admin";
  name?: string;
}

export default function NotificationCenter({ userType }: NotificationCenterProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [detectedUserType, setDetectedUserType] = useState<"customer" | "worker" | "admin" | "super_admin">("customer");

  // Fetch current user profile from API and detect userType
  useEffect(() => {
    authAPI.getProfile()
      .then((res: { user?: ProfileSummary } & ProfileSummary) => {
        const user = res.user || res;
        setProfile(user);
        
        // Auto-detect userType from profile if not explicitly provided
        if (!userType && user?.role) {
          setDetectedUserType(user.role);
        }
      })
      .catch((err: unknown) => {
        console.error('Error fetching profile:', err);
      });
  }, [userType]);
  
  // Use provided userType or detected userType
  const effectiveUserType = userType || detectedUserType;

  const { data: notifications, isLoading } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get('/notifications');
      return res.notifications ?? [];
    },
    refetchInterval: 30000, // poll every 30 s for new notifications
    refetchOnWindowFocus: true,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] })
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.patch('/notifications/mark-all-read'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] })
  });

  const unreadCount = notifications?.filter(n => !n.isRead).length || 0;

  if (isLoading) {
    return (
      <AppLayout userType={effectiveUserType} userName={profile?.name || "Loading..."}>
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout userType={effectiveUserType} userName={profile?.name || "User"}>
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bell className="w-6 h-6" />
          {t('customer.notifications.title')}
          {unreadCount > 0 && (
            <span className="text-sm bg-red-500 text-white px-2 py-1 rounded-full">{unreadCount}</span>
          )}
        </h1>
        {unreadCount > 0 && (
          <Button size="sm" onClick={() => markAllReadMutation.mutate()}>
            {t('customer.notifications.markAllRead')}
          </Button>
        )}
      </div>

      {!notifications || notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <Bell className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">{t('customer.notifications.noNotifications')}</p>
          <p className="text-sm mt-1">{t('customer.notifications.allCaughtUp')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => (
            <Card key={notif._id} className={`p-4 ${!notif.isRead ? 'bg-blue-50 border-blue-200' : ''}`}>
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {!notif.isRead && <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />}
                    <h3 className="font-semibold line-clamp-2 break-words">{notif.title}</h3>
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5">{notif.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(notif.createdAt).toLocaleString()}</p>
                </div>
                {!notif.isRead && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0"
                    onClick={() => markReadMutation.mutate(notif._id)}
                  >
                    {t('customer.notifications.markRead')}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
    </AppLayout>
  );
}
