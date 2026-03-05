import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { api } from '../../lib/api';

export default function SubscriptionsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedSub, setSelectedSub] = useState(null);

  const { data: subscriptions } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: async () => {
      const res = await api.get('/subscriptions');
      return res.data.subscriptions;
    }
  });

  const pauseMutation = useMutation({
    mutationFn: (id) => api.patch(`/subscriptions/${id}/pause`, { reason: 'User requested' }),
    onSuccess: () => queryClient.invalidateQueries(['subscriptions'])
  });

  const resumeMutation = useMutation({
    mutationFn: (id) => api.patch(`/subscriptions/${id}/resume`),
    onSuccess: () => queryClient.invalidateQueries(['subscriptions'])
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">{t('subscription.mySubscriptions')}</h1>
      <div className="grid gap-4">
        {subscriptions?.map((sub) => (
          <Card key={sub._id} className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold">{sub.service?.name}</h3>
                <p className="text-sm text-gray-600">{sub.plan} {t('subscription.plan')}</p>
                <p className="text-sm">{t('subscription.status')}: <span className={sub.status === 'active' ? 'text-green-600' : 'text-yellow-600'}>{t(`subscription.${sub.status}`)}</span></p>
                <p className="text-sm">₹{sub.totalAmount}</p>
              </div>
              <div className="space-x-2">
                {sub.status === 'active' ? (
                  <Button size="sm" variant="outline" onClick={() => pauseMutation.mutate(sub._id)}>{t('subscription.pause')}</Button>
                ) : (
                  <Button size="sm" onClick={() => resumeMutation.mutate(sub._id)}>{t('subscription.resume')}</Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
