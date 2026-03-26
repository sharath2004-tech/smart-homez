import { describe, expect, it } from 'vitest';

import { getCustomerBookingPaymentSummary } from '../pages/customer/bookingPaymentSummary';

describe('getCustomerBookingPaymentSummary', () => {
  it('marks unpaid subscriptions as pending payment', () => {
    expect(getCustomerBookingPaymentSummary({
      subscription: {
        isSubscription: true,
        activationStatus: 'payment_pending',
      },
      paymentStatus: 'pending',
    }, 1499)).toEqual({
      label: 'Pending payment',
      tone: 'warning',
      description: 'Complete or upload the subscription payment so admin can review and activate your plan.',
      pendingAmount: 1499,
    });
  });

  it('shows verification pending when proof is uploaded', () => {
    expect(getCustomerBookingPaymentSummary({
      paymentStatus: 'worker-confirmed',
    }, 899.456)).toEqual({
      label: 'Verification pending',
      tone: 'warning',
      description: 'Payment proof was uploaded and is waiting for admin verification.',
      pendingAmount: 899.46,
    });
  });

  it('shows verification pending for uploaded subscription proof still awaiting review', () => {
    expect(getCustomerBookingPaymentSummary({
      subscription: {
        isSubscription: true,
        activationStatus: 'payment_pending',
      },
      paymentStatus: 'pending',
      paymentProof: {
        url: '/uploads/completion-photos/proof.png',
        reviewStatus: 'pending',
      },
    }, 4500)).toEqual({
      label: 'Verification pending',
      tone: 'info',
      description: 'Payment proof was uploaded successfully and is waiting for admin review.',
      pendingAmount: 4500,
    });
  });

  it('uses rejection notes for rejected payment proof', () => {
    expect(getCustomerBookingPaymentSummary({
      paymentStatus: 'worker-confirmed',
      paymentProof: {
        reviewStatus: 'rejected',
        reviewNotes: 'Screenshot is blurry.',
      },
    }, 650)).toEqual({
      label: 'Payment rejected',
      tone: 'danger',
      description: 'Screenshot is blurry.',
      pendingAmount: 650,
    });
  });

  it('clears pending amount for paid bookings', () => {
    expect(getCustomerBookingPaymentSummary({
      paymentStatus: 'paid',
    }, 999)).toEqual({
      label: 'Paid',
      tone: 'success',
      description: 'Payment has been received and verified for this booking.',
      pendingAmount: null,
    });
  });

  it('treats approved subscriptions awaiting worker setup as paid', () => {
    expect(getCustomerBookingPaymentSummary({
      subscription: {
        isSubscription: true,
        activationStatus: 'approval_pending',
      },
      paymentStatus: 'pending',
      paymentProof: {
        reviewStatus: 'approved',
      },
    }, 999)).toEqual({
      label: 'Paid',
      tone: 'success',
      description: 'Payment has been verified. Admin will assign a worker to activate your subscription.',
      pendingAmount: null,
    });
  });

  it('treats active prepaid subscriptions as settled', () => {
    expect(getCustomerBookingPaymentSummary({
      subscription: {
        isSubscription: true,
        isPrepaid: true,
        activationStatus: 'active',
      },
      paymentStatus: 'pending',
    }, 2499)).toEqual({
      label: 'Paid',
      tone: 'success',
      description: 'Subscription payment has been received and verified for this plan.',
      pendingAmount: null,
    });
  });
});
