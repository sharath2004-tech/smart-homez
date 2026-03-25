import { AlertCircle, Calendar, Clock, Repeat, Settings2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface RecurringSchedule {
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  startDate: string;
  endDate?: string;
  preferredTime: string;
  duration: number; // in hours
  specificDays?: string[]; // ['monday', 'tuesday', etc.]
  autoRenewal: boolean;
  pauseAllowed: boolean;
}

interface RecurringScheduleSetupProps {
  schedule: RecurringSchedule;
  onChange: (schedule: RecurringSchedule) => void;
  bookingType: 'oneTime' | 'daily' | 'weekly' | 'biweekly' | 'monthly';
}

export function RecurringScheduleSetup({ schedule, onChange, bookingType }: RecurringScheduleSetupProps) {
  const { t } = useTranslation();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const daysOfWeek = [
    { value: 'monday', label: t('days.monday'), short: t('days.mon') },
    { value: 'tuesday', label: t('days.tuesday'), short: t('days.tue') },
    { value: 'wednesday', label: t('days.wednesday'), short: t('days.wed') },
    { value: 'thursday', label: t('days.thursday'), short: t('days.thu') },
    { value: 'friday', label: t('days.friday'), short: t('days.fri') },
    { value: 'saturday', label: t('days.saturday'), short: t('days.sat') },
    { value: 'sunday', label: t('days.sunday'), short: t('days.sun') }
  ];

  const toggleDay = (day: string) => {
    const currentDays = schedule.specificDays || [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day];
    
    onChange({ ...schedule, specificDays: newDays });
  };

  const minDate = new Date().toISOString().split('T')[0];
  const minEndDate = schedule.startDate || minDate;

  const isSubscription = bookingType !== 'oneTime';

  return (
    <div className="space-y-6">
      {/* Schedule Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            {t('subscription.scheduleSetup')}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {isSubscription ? t('subscription.recurringScheduleDesc') : t('subscription.oneTimeScheduleDesc')}
          </p>
        </div>
        {isSubscription && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="gap-2"
          >
            <Settings2 className="w-4 h-4" />
            {showAdvanced ? t('common.hideAdvanced') : t('common.showAdvanced')}
          </Button>
        )}
      </div>

      {/* Date Range */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="startDate" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {t('subscription.startDate')}
          </Label>
          <Input
            id="startDate"
            type="date"
            value={schedule.startDate}
            min={minDate}
            onChange={(e) => onChange({ ...schedule, startDate: e.target.value })}
            required
            className="mt-1"
          />
        </div>

        {isSubscription && (
          <div>
            <Label htmlFor="endDate" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {t('subscription.endDate')}
              <span className="text-xs text-muted-foreground">({t('common.optional')})</span>
            </Label>
            <Input
              id="endDate"
              type="date"
              value={schedule.endDate || ''}
              min={minEndDate}
              onChange={(e) => onChange({ ...schedule, endDate: e.target.value })}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t('subscription.endDateNote')}
            </p>
          </div>
        )}
      </div>

      {/* Time and Duration */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="preferredTime" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {t('subscription.preferredTime')}
          </Label>
          <Input
            id="preferredTime"
            type="time"
            value={schedule.preferredTime}
            onChange={(e) => onChange({ ...schedule, preferredTime: e.target.value })}
            required
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            {t('subscription.timeNote')}
          </p>
        </div>

        <div>
          <Label className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {t('subscription.durationPerSession')}
          </Label>
          <div className="flex items-center gap-2 mt-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => onChange({ ...schedule, duration: Math.max(1, schedule.duration - 0.5) })}
              disabled={schedule.duration <= 1}
            >
              -
            </Button>
            <div className="flex-1 text-center">
              <div className="text-2xl font-bold text-primary">{schedule.duration}</div>
              <div className="text-xs text-muted-foreground">{t('subscription.hours')}</div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => onChange({ ...schedule, duration: Math.min(8, schedule.duration + 0.5) })}
              disabled={schedule.duration >= 8}
            >
              +
            </Button>
          </div>
        </div>
      </div>

      {/* Specific Days Selection (for weekly plans) */}
      {isSubscription && bookingType === 'weekly' && (
        <div>
          <Label className="flex items-center gap-2 mb-3">
            <Repeat className="w-4 h-4" />
            {t('subscription.selectDays')}
          </Label>
          <div className="grid grid-cols-7 gap-2">
            {daysOfWeek.map((day) => (
              <button
                key={day.value}
                type="button"
                onClick={() => toggleDay(day.value)}
                className={`p-3 rounded-lg border-2 text-center transition-all ${
                  schedule.specificDays?.includes(day.value)
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="text-xs font-semibold">{day.short}</div>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {t('subscription.selectDaysNote')}
          </p>
        </div>
      )}

      {/* Frequency Display for Daily */}
      {isSubscription && bookingType === 'daily' && (
        <div className="p-4 bg-accent rounded-lg border border-border">
          <div className="flex items-start gap-3">
            <Repeat className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="font-semibold text-sm">{t('subscription.dailySchedule')}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {t('subscription.dailyScheduleDesc')}
              </p>
            </div>
          </div>
        </div>
      )}

      {isSubscription && bookingType === 'biweekly' && (
        <div className="p-4 bg-accent rounded-lg border border-border">
          <div className="flex items-start gap-3">
            <Repeat className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Every 2 weeks</p>
              <p className="text-sm text-muted-foreground mt-1">
                Service will repeat every 2 weeks from your selected start date at your preferred time.
              </p>
            </div>
          </div>
        </div>
      )}

      {isSubscription && bookingType === 'monthly' && (
        <div className="p-4 bg-accent rounded-lg border border-border">
          <div className="flex items-start gap-3">
            <Repeat className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Monthly visit schedule</p>
              <p className="text-sm text-muted-foreground mt-1">
                Service will repeat once a month from your selected start date at your preferred time.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Auto-renewal and Pause Options */}
      {isSubscription && showAdvanced && (
        <div className="space-y-4 p-4 bg-muted/50 rounded-lg border border-border">
          <h4 className="font-semibold flex items-center gap-2">
            <Settings2 className="w-4 h-4" />
            {t('subscription.advancedSettings')}
          </h4>

          {/* Auto-renewal */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={schedule.autoRenewal}
              onChange={(e) => onChange({ ...schedule, autoRenewal: e.target.checked })}
              className="mt-1 w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <div>
              <div className="font-medium text-sm">{t('subscription.autoRenewal')}</div>
              <div className="text-xs text-muted-foreground">{t('subscription.autoRenewalDesc')}</div>
            </div>
          </label>

          {/* Pause Allowed */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={schedule.pauseAllowed}
              onChange={(e) => onChange({ ...schedule, pauseAllowed: e.target.checked })}
              className="mt-1 w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <div>
              <div className="font-medium text-sm">{t('subscription.allowPause')}</div>
              <div className="text-xs text-muted-foreground">{t('subscription.allowPauseDesc')}</div>
            </div>
          </label>
        </div>
      )}

      {/* Summary */}
      {isSubscription && schedule.startDate && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                {t('subscription.scheduleSummary')}
              </p>
              <ul className="text-blue-700 dark:text-blue-300 space-y-1">
                <li>• {t('subscription.serviceDuration')}: {schedule.duration} {t('subscription.hours')}</li>
                <li>• {t('subscription.serviceTime')}: {schedule.preferredTime}</li>
                {schedule.specificDays && schedule.specificDays.length > 0 && (
                  <li>• {t('subscription.serviceDays')}: {schedule.specificDays.map(d => daysOfWeek.find(day => day.value === d)?.short).join(', ')}</li>
                )}
                {schedule.endDate && (
                  <li>• {t('subscription.subscriptionEnds')}: {new Date(schedule.endDate).toLocaleDateString()}</li>
                )}
                {schedule.autoRenewal && (
                  <li>• {t('subscription.autoRenewalEnabled')}</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
