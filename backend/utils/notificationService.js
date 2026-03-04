/**
 * Multi-Channel Notification Service
 * Supports: In-App, SMS, WhatsApp
 * REQ-C-010: Change Notifications
 */

import Notification from '../models/Notification.js';
import User from '../models/User.js';

/**
 * Notification Types for REQ-C-010
 */
const NOTIFICATION_TYPES = {
  WORKER_REASSIGNMENT: 'worker-reassignment',
  SCHEDULE_CHANGE: 'schedule-change',
  WORKER_UNAVAILABLE: 'worker-unavailable',
  DELAY_NOTIFICATION: 'delay',
  BOOKING_CONFIRMED: 'booking-confirmed',
  BOOKING_CANCELLED: 'cancellation',
  BOOKING_RESCHEDULED: 'booking-rescheduled',
  REFUND_PROCESSED: 'refund-processed',
  WORKER_ASSIGNED: 'worker-assigned',
  WORKER_ENROUTE: 'worker-enroute'
};

/**
 * Notification Channels (Cost-Effective Order)
 */
const NOTIFICATION_CHANNELS = {
  IN_APP: 'in-app',        // Free
  WHATSAPP: 'whatsapp',    // Most cost-effective
  SMS: 'sms'               // More expensive
};

/**
 * Send multi-channel notification
 * @param {Object} options - Notification options
 * @param {String} options.userId - Recipient user ID
 * @param {String} options.type - Notification type
 * @param {String} options.title - Notification title
 * @param {String} options.message - Notification message
 * @param {Object} options.data - Additional data
 * @param {String} options.priority - Priority level (low, medium, high)
 * @param {Array} options.channels - Preferred channels (default: all based on user preferences)
 */
export const sendNotification = async (options) => {
  try {
    const { userId, type, title, message, data = {}, priority = 'medium', channels } = options;

    // Get user preferences
    const user = await User.findById(userId).select('phone email notificationPreferences');
    
    if (!user) {
      console.error('User not found for notification:', userId);
      return;
    }

    const prefs = user.notificationPreferences || {};
    
    // Determine which channels to use
    const channelsToUse = channels || getChannelsForNotificationType(type, prefs);
    
    const results = {
      inApp: false,
      whatsapp: false,
      sms: false
    };

    // 1. In-App Notification (Always send if enabled)
    if (channelsToUse.includes(NOTIFICATION_CHANNELS.IN_APP) && prefs.inApp?.enabled !== false) {
      try {
        await Notification.create({
          recipient: userId,
          type,
          title,
          message,
          data,
          priority
        });
        results.inApp = true;
        console.log(`✅ In-app notification sent to user ${userId}`);
      } catch (error) {
        console.error('In-app notification failed:', error);
      }
    }

    // 2. WhatsApp Notification (Cost-effective priority)
    if (channelsToUse.includes(NOTIFICATION_CHANNELS.WHATSAPP) && 
        prefs.whatsapp?.enabled && 
        user.phone) {
      try {
        await sendWhatsAppMessage({
          phone: user.phone,
          message: formatWhatsAppMessage(title, message, data)
        });
        results.whatsapp = true;
        console.log(`✅ WhatsApp notification sent to ${user.phone}`);
      } catch (error) {
        console.error('WhatsApp notification failed:', error);
        
        // Fallback to SMS if WhatsApp fails and SMS is enabled
        if (prefs.sms?.enabled) {
          channelsToUse.push(NOTIFICATION_CHANNELS.SMS);
        }
      }
    }

    // 3. SMS Notification (Fallback or if specifically enabled)
    if (channelsToUse.includes(NOTIFICATION_CHANNELS.SMS) && 
        prefs.sms?.enabled && 
        user.phone) {
      try {
        await sendSMS({
          phone: user.phone,
          message: formatSMSMessage(title, message)
        });
        results.sms = true;
        console.log(`✅ SMS notification sent to ${user.phone}`);
      } catch (error) {
        console.error('SMS notification failed:', error);
      }
    }

    return results;

  } catch (error) {
    console.error('Notification service error:', error);
    throw error;
  }
};

/**
 * Determine which channels to use based on notification type and user preferences
 */
function getChannelsForNotificationType(type, prefs) {
  const channels = [];

  // Always include in-app
  if (prefs.inApp?.enabled !== false) {
    channels.push(NOTIFICATION_CHANNELS.IN_APP);
  }

  // High priority notifications
  const highPriorityTypes = [
    NOTIFICATION_TYPES.WORKER_UNAVAILABLE,
    NOTIFICATION_TYPES.DELAY_NOTIFICATION,
    NOTIFICATION_TYPES.BOOKING_CANCELLED
  ];

  if (highPriorityTypes.includes(type)) {
    // Send via all enabled channels for critical notifications
    if (prefs.whatsapp?.enabled) channels.push(NOTIFICATION_CHANNELS.WHATSAPP);
    if (prefs.sms?.enabled) channels.push(NOTIFICATION_CHANNELS.SMS);
  } else {
    // For normal notifications, prefer cost-effective channels
    if (prefs.whatsapp?.enabled) {
      channels.push(NOTIFICATION_CHANNELS.WHATSAPP);
    } else if (prefs.sms?.enabled) {
      channels.push(NOTIFICATION_CHANNELS.SMS);
    }
  }

  return channels;
}

/**
 * Send WhatsApp message (Integration placeholder)
 * TODO: Integrate with WhatsApp Business API or Twilio
 */
async function sendWhatsAppMessage({ phone, message }) {
  // Placeholder for WhatsApp API integration
  // Example: Twilio WhatsApp, WhatsApp Business API, etc.
  
  console.log('📱 [WhatsApp - Placeholder]');
  console.log(`To: ${phone}`);
  console.log(`Message: ${message}`);
  
  // TODO: Implement actual WhatsApp sending logic
  // const twilioClient = twilio(accountSid, authToken);
  // await twilioClient.messages.create({
  //   from: 'whatsapp:+14155238886',
  //   to: `whatsapp:${phone}`,
  //   body: message
  // });

  return Promise.resolve({ success: true, channel: 'whatsapp' });
}

/**
 * Send SMS (Integration placeholder)
 * TODO: Integrate with SMS provider (Twilio, AWS SNS, etc.)
 */
async function sendSMS({ phone, message }) {
  // Placeholder for SMS API integration
  
  console.log('📨 [SMS - Placeholder]');
  console.log(`To: ${phone}`);
  console.log(`Message: ${message}`);
  
  // TODO: Implement actual SMS sending logic
  // const twilioClient = twilio(accountSid, authToken);
  // await twilioClient.messages.create({
  //   from: '+1234567890',
  //   to: phone,
  //   body: message
  // });

  return Promise.resolve({ success: true, channel: 'sms' });
}

/**
 * Format message for WhatsApp
 */
function formatWhatsAppMessage(title, message, data) {
  let formatted = `*${title}*\n\n${message}`;
  
  if (data.bookingId) {
    formatted += `\n\n📋 Booking ID: ${data.bookingId}`;
  }
  
  if (data.workerName) {
    formatted += `\n👤 Worker: ${data.workerName}`;
  }
  
  if (data.newTime) {
    formatted += `\n🕐 New Time: ${data.newTime}`;
  }
  
  return formatted;
}

/**
 * Format message for SMS (160 char limit aware)
 */
function formatSMSMessage(title, message) {
  const smsText = `${title}: ${message}`;
  // Truncate to 160 chars if needed
  return smsText.length > 160 ? smsText.substring(0, 157) + '...' : smsText;
}

/**
 * Notification Templates for REQ-C-010
 */
export const NOTIFICATION_TEMPLATES = {
  WORKER_REASSIGNMENT: (data) => ({
    type: NOTIFICATION_TYPES.WORKER_REASSIGNMENT,
    title: '👷 Worker Reassigned',
    message: `Your booking has been reassigned to ${data.newWorkerName}. ${data.reason || 'Original worker became unavailable.'}`,
    priority: 'high'
  }),
  
  SCHEDULE_CHANGE: (data) => ({
    type: NOTIFICATION_TYPES.SCHEDULE_CHANGE,
    title: '📅 Schedule Updated',
    message: `Your booking has been rescheduled to ${data.newDate} at ${data.newTime}.`,
    priority: 'high'
  }),
  
  WORKER_UNAVAILABLE: (data) => ({
    type: NOTIFICATION_TYPES.WORKER_UNAVAILABLE,
    title: '⚠️ Worker Unavailable',
    message: `${data.workerName} is unavailable. We're assigning a replacement worker.`,
    priority: 'high'
  }),
  
  DELAY_NOTIFICATION: (data) => ({
    type: NOTIFICATION_TYPES.DELAY_NOTIFICATION,
    title: '⏰ Delay Notice',
    message: `Your service is delayed by ${data.delayMinutes} minutes. ${data.reason || ''}`,
    priority: 'high'
  }),
  
  BOOKING_CONFIRMED: (data) => ({
    type: NOTIFICATION_TYPES.BOOKING_CONFIRMED,
    title: '✅ Booking Confirmed',
    message: `Your booking for ${data.serviceName} on ${data.date} at ${data.time} is confirmed.`,
    priority: 'medium'
  }),
  
  BOOKING_CANCELLED: (data) => ({
    type: NOTIFICATION_TYPES.BOOKING_CANCELLED,
    title: '❌ Booking Cancelled',
    message: `Your booking has been cancelled. ${data.refundAmount ? `Refund of ₹${data.refundAmount} will be processed.` : ''}`,
    priority: 'medium'
  }),
  
  REFUND_PROCESSED: (data) => ({
    type: NOTIFICATION_TYPES.REFUND_PROCESSED,
    title: '💰 Refund Processed',
    message: `Refund of ₹${data.amount} has been processed for cancelled booking. It will reflect in 3-5 business days.`,
    priority: 'medium'
  }),
  
  WORKER_ASSIGNED: (data) => ({
    type: NOTIFICATION_TYPES.WORKER_ASSIGNED,
    title: '👤 Worker Assigned',
    message: `${data.workerName} has been assigned to your booking.`,
    priority: 'medium'
  })
};

/**
 * Send notification using template
 */
export const sendTemplatedNotification = async (userId, templateName, data) => {
  const template = NOTIFICATION_TEMPLATES[templateName];
  
  if (!template) {
    console.error('Unknown notification template:', templateName);
    return;
  }
  
  const notification = template(data);
  
  return sendNotification({
    userId,
    ...notification,
    data
  });
};

export default {
  sendNotification,
  sendTemplatedNotification,
  NOTIFICATION_TYPES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_TEMPLATES
};
