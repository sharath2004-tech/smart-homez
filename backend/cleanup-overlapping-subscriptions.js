/**
 * Cleanup script: finds and cancels duplicate overlapping subscription root bookings.
 *
 * For each customer, keeps the OLDEST active (or most progressed) subscription root
 * per service+time combo and cancels later duplicates along with their child visits.
 *
 * Usage:
 *   DRY RUN (no changes):  node cleanup-overlapping-subscriptions.js
 *   APPLY CHANGES:         node cleanup-overlapping-subscriptions.js --apply
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in .env');
  process.exit(1);
}

const applyChanges = process.argv.includes('--apply');

const bookingSchema = new mongoose.Schema({}, { strict: false });
const Booking = mongoose.model('Booking', bookingSchema);

const ACTIVATION_PRIORITY = { active: 3, approval_pending: 2, payment_pending: 1 };

const pickKeeper = (a, b) => {
  const pa = ACTIVATION_PRIORITY[a.subscription?.activationStatus] || 0;
  const pb = ACTIVATION_PRIORITY[b.subscription?.activationStatus] || 0;
  if (pa !== pb) return pa > pb ? a : b;
  return a.createdAt <= b.createdAt ? a : b;
};

const timeRangesOverlap = (startA, endA, startB, endB) => {
  const toMin = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  return toMin(startA) < toMin(endB) && toMin(endA) > toMin(startB);
};

const dateRangesOverlap = (startA, endA, startB, endB) => {
  const sA = new Date(startA).getTime();
  const eA = endA ? new Date(endA).getTime() : Infinity;
  const sB = new Date(startB).getTime();
  const eB = endB ? new Date(endB).getTime() : Infinity;
  return sA <= eB && eA >= sB;
};

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB');
  console.log(applyChanges ? '🔧 APPLY MODE — changes will be saved' : '👀 DRY RUN — no changes will be made');

  const roots = await Booking.find({
    'subscription.isSubscription': true,
    parentBooking: null,
    status: { $nin: ['cancelled'] },
  })
    .sort({ customer: 1, createdAt: 1 })
    .lean();

  console.log(`\nFound ${roots.length} non-cancelled subscription roots.\n`);

  // Group by customer
  const byCustomer = new Map();
  for (const root of roots) {
    const cid = root.customer?.toString();
    if (!cid) continue;
    if (!byCustomer.has(cid)) byCustomer.set(cid, []);
    byCustomer.get(cid).push(root);
  }

  let totalDuplicates = 0;
  let totalChildrenCancelled = 0;

  for (const [customerId, customerRoots] of byCustomer) {
    if (customerRoots.length < 2) continue;

    const kept = [];
    const duplicates = [];

    for (const root of customerRoots) {
      const svcId = root.service?.toString();
      const startTime = root.startTime;
      const endTime = root.endTime;
      const startDate = root.subscription?.subscriptionStartDate || root.bookingDate;
      const endDate = root.subscription?.subscriptionEndDate;

      const existingKeeper = kept.find((k) => {
        const kSvc = k.service?.toString();
        const kStart = k.subscription?.subscriptionStartDate || k.bookingDate;
        const kEnd = k.subscription?.subscriptionEndDate;
        return (
          kSvc === svcId
          && timeRangesOverlap(startTime, endTime, k.startTime, k.endTime)
          && dateRangesOverlap(startDate, endDate, kStart, kEnd)
        );
      });

      if (!existingKeeper) {
        kept.push(root);
      } else {
        const winner = pickKeeper(existingKeeper, root);
        if (winner._id.toString() === root._id.toString()) {
          // root is better, swap
          const idx = kept.indexOf(existingKeeper);
          kept[idx] = root;
          duplicates.push(existingKeeper);
        } else {
          duplicates.push(root);
        }
      }
    }

    for (const dup of duplicates) {
      totalDuplicates++;
      const dupId = dup._id.toString();
      const svcName = dup.serviceName || dup.service?.toString() || '?';

      console.log(
        `  ⚠️  Customer ${customerId} | Duplicate root ${dupId} | Service ${svcName}`
        + ` | ${dup.startTime}–${dup.endTime}`
        + ` | activation=${dup.subscription?.activationStatus}`
        + ` | status=${dup.status}`
      );

      if (applyChanges) {
        // Cancel the duplicate root
        await Booking.updateOne(
          { _id: dup._id },
          {
            $set: {
              status: 'cancelled',
              'subscription.activationStatus': 'payment_pending',
              cancelledAt: new Date(),
              cancelReason: 'Automated cleanup: overlapping subscription duplicate',
            },
          }
        );

        // Cancel all child visits of this duplicate root
        const childResult = await Booking.updateMany(
          { parentBooking: dup._id, status: { $nin: ['cancelled', 'completed'] } },
          {
            $set: {
              status: 'cancelled',
              cancelledAt: new Date(),
              cancelReason: 'Parent subscription cancelled (overlap cleanup)',
            },
          }
        );

        totalChildrenCancelled += childResult.modifiedCount;
        console.log(`    ✅ Cancelled root + ${childResult.modifiedCount} child visit(s)`);
      }
    }
  }

  console.log(`\n========================================`);
  console.log(`Overlapping duplicates found: ${totalDuplicates}`);
  if (applyChanges) {
    console.log(`Roots cancelled:             ${totalDuplicates}`);
    console.log(`Child visits cancelled:      ${totalChildrenCancelled}`);
  } else {
    console.log(`Run with --apply to cancel them.`);
  }
  console.log(`========================================\n`);

  await mongoose.disconnect();
  console.log('Disconnected.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
