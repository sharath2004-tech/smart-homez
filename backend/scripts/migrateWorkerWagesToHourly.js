import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

import User from '../models/User.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const DEFAULT_HOURLY_RATE = 90;
const DEFAULT_MONTHLY_WORKING_DAYS = 26;
const DEFAULT_DAILY_HOURS = 7;

function printHelp() {
  console.log(`
Normalize worker wage profiles to hourly-only.

Usage:
  node scripts/migrateWorkerWagesToHourly.js [options]

Options:
  --apply                         Persist changes to MongoDB
  --default-hourly=<amount>       Fallback hourly rate when no usable rate exists (default: 90)
  --monthly-working-days=<days>   Working days used to convert monthly wage to hourly (default: 26)
  --default-daily-hours=<hours>   Daily hours used when worker target hours are missing (default: 7)
  --help                          Show this help message

Behavior:
  - Dry run by default (no writes)
  - Keeps an existing positive hourly rate when present
  - Converts daily wage using: dailyWage / dailyHours
  - Converts monthly wage using: monthlyWage / (monthlyWorkingDays * dailyHours)
  - Clears legacy daily/monthly fields and normalizes wageType to hourly
`);
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function getNumberFlag(flagName, fallbackValue) {
  const arg = process.argv.find((entry) => entry.startsWith(`${flagName}=`));
  if (!arg) return fallbackValue;

  const value = Number(arg.split('=')[1]);
  return Number.isFinite(value) && value > 0 ? value : fallbackValue;
}

function roundCurrency(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function formatMoney(value) {
  return `₹${roundCurrency(value).toFixed(2)}`;
}

function deriveHourlyRate(workerProfile, options) {
  const existingHourlyRate = Number(workerProfile?.hourlyRate);
  if (Number.isFinite(existingHourlyRate) && existingHourlyRate > 0) {
    return {
      hourlyRate: roundCurrency(existingHourlyRate),
      source: 'existing-hourly',
      dailyHours: Number(workerProfile?.dailyWorkingHoursTarget) || options.defaultDailyHours
    };
  }

  const dailyHours = Number(workerProfile?.dailyWorkingHoursTarget) > 0
    ? Number(workerProfile.dailyWorkingHoursTarget)
    : options.defaultDailyHours;

  const dailyWage = Number(workerProfile?.dailyWage);
  if (Number.isFinite(dailyWage) && dailyWage > 0) {
    return {
      hourlyRate: roundCurrency(dailyWage / dailyHours),
      source: `daily-converted/${dailyHours}h`,
      dailyHours
    };
  }

  const monthlyWage = Number(workerProfile?.monthlyWage);
  if (Number.isFinite(monthlyWage) && monthlyWage > 0) {
    return {
      hourlyRate: roundCurrency(monthlyWage / (options.monthlyWorkingDays * dailyHours)),
      source: `monthly-converted/${options.monthlyWorkingDays}d/${dailyHours}h`,
      dailyHours
    };
  }

  return {
    hourlyRate: roundCurrency(options.defaultHourlyRate),
    source: 'fallback-default',
    dailyHours
  };
}

function shouldMigrate(workerProfile) {
  if (!workerProfile) return false;

  const wageType = workerProfile.wageType || 'hourly';
  const hasDailyWage = workerProfile.dailyWage !== null && workerProfile.dailyWage !== undefined;
  const hasMonthlyWage = workerProfile.monthlyWage !== null && workerProfile.monthlyWage !== undefined;
  const hasInvalidHourlyRate = !(Number(workerProfile.hourlyRate) > 0);

  return wageType !== 'hourly' || hasDailyWage || hasMonthlyWage || hasInvalidHourlyRate;
}

function buildSummaryRows(workers, options) {
  return workers.map((worker) => {
    const profile = worker.workerProfile || {};
    const conversion = deriveHourlyRate(profile, options);

    return {
      workerId: worker._id.toString(),
      name: worker.name || 'Unnamed worker',
      email: worker.email || 'no-email',
      fromWageType: profile.wageType || 'hourly',
      previousHourlyRate: Number(profile.hourlyRate) || 0,
      previousDailyWage: profile.dailyWage,
      previousMonthlyWage: profile.monthlyWage,
      nextHourlyRate: conversion.hourlyRate,
      conversionSource: conversion.source,
      dailyHoursUsed: conversion.dailyHours
    };
  });
}

function printSummary(summaryRows, applyChanges) {
  const sourceCounts = summaryRows.reduce((acc, row) => {
    acc[row.conversionSource] = (acc[row.conversionSource] || 0) + 1;
    return acc;
  }, {});

  console.log(`\n${applyChanges ? '✅ Migration applied' : '🧪 Dry run complete'}`);
  console.log(`Workers requiring normalization: ${summaryRows.length}`);

  if (summaryRows.length === 0) {
    console.log('Nothing to migrate. The wage gremlins have already been evicted.');
    return;
  }

  console.log('\nConversion sources:');
  for (const [source, count] of Object.entries(sourceCounts)) {
    console.log(`  - ${source}: ${count}`);
  }

  console.log('\nSample updates:');
  summaryRows.slice(0, 20).forEach((row) => {
    const legacyBits = [
      `type=${row.fromWageType}`,
      `hourly=${formatMoney(row.previousHourlyRate)}`,
      `daily=${row.previousDailyWage == null ? 'null' : formatMoney(row.previousDailyWage)}`,
      `monthly=${row.previousMonthlyWage == null ? 'null' : formatMoney(row.previousMonthlyWage)}`
    ].join(', ');

    console.log(`  - ${row.name} <${row.email}>`);
    console.log(`    ${legacyBits}`);
    console.log(`    -> hourly=${formatMoney(row.nextHourlyRate)} via ${row.conversionSource}`);
  });

  if (summaryRows.length > 20) {
    console.log(`\n...and ${summaryRows.length - 20} more worker(s)`);
  }
}

async function main() {
  if (hasFlag('--help')) {
    printHelp();
    return;
  }

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI (or MONGO_URI) is required to run this migration');
  }

  const applyChanges = hasFlag('--apply');
  const options = {
    defaultHourlyRate: getNumberFlag('--default-hourly', DEFAULT_HOURLY_RATE),
    monthlyWorkingDays: getNumberFlag('--monthly-working-days', DEFAULT_MONTHLY_WORKING_DAYS),
    defaultDailyHours: getNumberFlag('--default-daily-hours', DEFAULT_DAILY_HOURS)
  };

  await mongoose.connect(mongoUri);
  console.log('📡 Connected to MongoDB');

  try {
    const workers = await User.find({ role: 'worker' })
      .select('name email workerProfile')
      .lean();

    const workersToMigrate = workers.filter((worker) => shouldMigrate(worker.workerProfile));
    const summaryRows = buildSummaryRows(workersToMigrate, options);

    printSummary(summaryRows, applyChanges);

    if (!applyChanges || summaryRows.length === 0) {
      if (!applyChanges && summaryRows.length > 0) {
        console.log('\nNo changes were written. Re-run with --apply to persist these updates.');
      }
      return;
    }

    const bulkOperations = summaryRows.map((row) => ({
      updateOne: {
        filter: { _id: row.workerId },
        update: {
          $set: {
            'workerProfile.wageType': 'hourly',
            'workerProfile.hourlyRate': row.nextHourlyRate,
            'workerProfile.dailyWage': null,
            'workerProfile.monthlyWage': null
          }
        }
      }
    }));

    const result = await User.bulkWrite(bulkOperations, { ordered: false });

    console.log('\nWrite result:');
    console.log(`  - matched: ${result.matchedCount || 0}`);
    console.log(`  - modified: ${result.modifiedCount || 0}`);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

main().catch(async (error) => {
  console.error('❌ Worker wage migration failed:', error.message);
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  process.exit(1);
});
