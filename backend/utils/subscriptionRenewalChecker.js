import Booking from '../models/Booking.js';
import { sendNotification } from './notificationService.js';

/**
 * Check for subscriptions expiring within 3 days and send renewal reminders.
 * Runs once per day via setInterval.
 */
export const checkSubscriptionRenewals = async () => {
  try {
    const now = new Date();
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    // Find active subscription bookings expiring within the next 3 days
    const expiring = await Booking.find({
      'subscription.isSubscription': true,
      'subscription.subscriptionEndDate': { $gte: now, $lte: in3Days },
      status: { $nin: ['cancelled', 'completed'] }
    }).select('_id customer service subscription');

    for (const booking of expiring) {
      const endDate = new Date(booking.subscription.subscriptionEndDate);
      const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
      const label = daysLeft <= 1 ? 'tomorrow' : `in ${daysLeft} days`;

      await sendNotification({
        userId: booking.customer.toString(),
        type: 'subscription-renewal',
        title: 'Subscription Expiring Soon',
        message: `Your subscription expires ${label}. Renew now to keep your services uninterrupted.`,
        data: { bookingId: booking._id.toString() },
        priority: daysLeft <= 1 ? 'high' : 'medium',
        channels: ['in-app']
      });
    }

    if (expiring.length > 0) {
      console.log(`📅 Sent renewal reminders for ${expiring.length} expiring subscription(s)`);
    }
  } catch (err) {
    console.error('Subscription renewal checker error:', err);
  }
};

export const runRenewalChecker = () => {
  checkSubscriptionRenewals(); // Run immediately on startup
  setInterval(checkSubscriptionRenewals, 24 * 60 * 60 * 1000); // Re-run every 24 hours
};
