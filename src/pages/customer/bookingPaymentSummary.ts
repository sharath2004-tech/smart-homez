export type CustomerPaymentTone = 'success' | 'warning' | 'danger' | 'info';

type CustomerBookingPaymentSummaryInput = {
  paymentStatus?: string | null;
  subscription?: {
    isSubscription?: boolean;
    activationStatus?: 'payment_pending' | 'approval_pending' | 'active' | string;
  } | null;
  paymentProof?: {
    url?: string | null;
    reviewStatus?: 'pending' | 'approved' | 'rejected' | string;
    reviewNotes?: string | null;
  } | null;
};

export type CustomerBookingPaymentSummary = {
  label: string;
  tone: CustomerPaymentTone;
  description: string;
  pendingAmount: number | null;
};

const roundAmount = (amount: number) => Math.round(amount * 100) / 100;

export const getCustomerBookingPaymentSummary = (
  booking: CustomerBookingPaymentSummaryInput,
  totalAmountDue: number,
): CustomerBookingPaymentSummary => {
  const pendingAmount = totalAmountDue > 0 ? roundAmount(totalAmountDue) : null;

  if (booking.paymentProof?.reviewStatus === 'rejected') {
    return {
      label: 'Payment rejected',
      tone: 'danger',
      description: booking.paymentProof.reviewNotes?.trim()
        || 'The uploaded payment proof was rejected. Please upload a fresh proof or contact support.',
      pendingAmount,
    };
  }

  if (booking.paymentProof?.url && booking.paymentProof?.reviewStatus === 'pending') {
    return {
      label: 'Verification pending',
      tone: 'info',
      description: 'Payment proof was uploaded successfully and is waiting for admin review.',
      pendingAmount,
    };
  }

  if (booking.subscription?.isSubscription && booking.subscription.activationStatus === 'payment_pending') {
    return {
      label: 'Pending payment',
      tone: 'warning',
      description: 'Complete or upload the subscription payment so admin can review and activate your plan.',
      pendingAmount,
    };
  }

  switch (booking.paymentStatus) {
    case 'paid':
      return {
        label: 'Paid',
        tone: 'success',
        description: 'Payment has been received and verified for this booking.',
        pendingAmount: null,
      };
    case 'worker-confirmed':
      return {
        label: 'Verification pending',
        tone: 'warning',
        description: 'Payment proof was uploaded and is waiting for admin verification.',
        pendingAmount,
      };
    case 'qr-generated':
      return {
        label: 'QR generated',
        tone: 'warning',
        description: 'A payment QR was generated for this booking. Complete the payment to finish checkout.',
        pendingAmount,
      };
    case 'failed':
      return {
        label: 'Payment failed',
        tone: 'danger',
        description: 'Payment was not confirmed. Please retry the payment or contact support.',
        pendingAmount,
      };
    case 'refunded':
      return {
        label: 'Refunded',
        tone: 'info',
        description: 'This booking payment has been refunded.',
        pendingAmount: null,
      };
    case 'pending':
    default:
      return {
        label: 'Pending payment',
        tone: 'warning',
        description: 'Payment is still due for this booking.',
        pendingAmount,
      };
  }
};
