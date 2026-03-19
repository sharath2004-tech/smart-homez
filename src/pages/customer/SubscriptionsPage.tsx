import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Calendar, IndianRupee, Package, Pause, Play } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'paused': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold font-heading text-foreground mb-2">{t('subscription.mySubscriptions')}</h1>
        <p className="text-muted-foreground">Manage your active subscriptions and recurring services</p>
      </div>

      {/* Subscriptions Grid */}
      <div className="grid gap-4 mb-8">
        {subscriptions && subscriptions.length > 0 ? (
          subscriptions.map((sub) => (
            <Card key={sub._id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                {/* Left Section */}
                <div className="flex-1">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                      <Package className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{sub.service?.name}</h3>
                      <p className="text-sm text-muted-foreground">{sub.plan} {t('subscription.plan')}</p>
                    </div>
                  </div>
                  
                  {/* Status Badge */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(sub.status)}`}>
                      {sub.status === 'active' && <Play className="w-3 h-3" />}
                      {sub.status === 'paused' && <Pause className="w-3 h-3" />}
                      {t(`subscription.${sub.status}`)}
                    </span>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <IndianRupee className="w-4 h-4" />
                      <span className="font-semibold text-foreground">₹{sub.totalAmount}</span>
                      <span>/ {sub.plan}</span>
                    </div>
                    {sub.nextBillingDate && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>Next: {new Date(sub.nextBillingDate).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Right Section - Actions */}
                <div className="flex flex-col gap-2">
                  {sub.status === 'active' ? (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => pauseMutation.mutate(sub._id)}
                      className="gap-2"
                    >
                      <Pause className="w-4 h-4" />
                      {t('subscription.pause')}
                    </Button>
                  ) : (
                    <Button 
                      size="sm" 
                      onClick={() => resumeMutation.mutate(sub._id)}
                      className="gap-2"
                    >
                      <Play className="w-4 h-4" />
                      {t('subscription.resume')}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))
        ) : (
          <Card className="p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Package className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Active Subscriptions</h3>
              <p className="text-muted-foreground mb-4">Save time and money with recurring service plans</p>
              <Link to="/customer/services">
                <Button className="gap-2">
                  <Package className="w-4 h-4" />
                  Browse Services
                </Button>
              </Link>
            </div>
          </Card>
        )}
      </div>

      {/* Next Steps Section */}
      <Card className="p-6 bg-accent/50">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <h3 className="font-semibold text-foreground mb-2">Next Steps & Tips</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span><strong>Save More:</strong> Subscribe to services you use regularly and save up to 20% on each booking</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span><strong>Pause Anytime:</strong> Going on vacation? Pause your subscription and resume when you're back</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span><strong>Priority Booking:</strong> Subscription members get priority worker assignment during peak hours</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span><strong>Flexible Scheduling:</strong> Modify your service schedule up to 24 hours before each appointment</span>
              </li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
