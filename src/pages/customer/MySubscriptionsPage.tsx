import AppLayout from "@/components/AppLayout";
import SubscriptionCalendar from "@/components/SubscriptionCalendar";
import SubscriptionPaymentStep from "@/components/SubscriptionPaymentStep";
import { api, authAPI, bookingsAPI } from "@/lib/api";
import { AlertTriangle, Calendar, CalendarDays, CheckCircle, ChevronDown, ChevronUp, Clock, Edit2, IndianRupee, MapPin, RefreshCw, Timer, User, UserCheck, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

// ── Session row returned by the new API ──────────────────────────────────────
interface SessionRow {
  sessionNumber: number;
  _id: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  status: string;
  worker?: { name: string } | null;
  actualStartTime?: string;
  actualEndTime?: string;
  actualDurationMinutes?: number;
  scheduledDurationMinutes?: number;
  overtimeMinutes: number;
  overtimeCharges: number;
  isProjected?: boolean;
}

// ── Subscription object returned by /bookings/customer/my-subscriptions ───────
interface CustomerSubscription {
  _id: string;
  service: { _id: string; name: string; description: string; category: string };
  bookingType: string;
  worker?: {
    _id: string;
    name: string;
    phone: string;
    workerProfile: { specialization: string; rating: number; completedBookings: number };
  } | null;
  location: { address?: string; area: string; city: string; apartmentName?: string };
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  activationStatus?: 'payment_pending' | 'approval_pending' | 'active' | string;
  isPaused?: boolean;
  isPrepaid?: boolean;
  autoRenewal?: boolean;
  allowPause?: boolean;
  pauseRequestStatus?: 'none' | 'pending' | 'approved' | 'rejected' | string;
  pauseRequestedAt?: string | null;
  pauseRequestStartDate?: string | null;
  pauseRequestEndDate?: string | null;
  pauseReviewNote?: string | null;
  preferredTime?: string;
  durationPerSession?: number;
  frequency?: string;
  selectedDays?: string[];
  startDate?: string;
  endDate?: string;
  totalAmount: number;
  paymentStatus?: string;
  paymentProof?: {
    url?: string | null;
    reviewStatus?: 'pending' | 'approved' | 'rejected';
    reviewNotes?: string | null;
  };
  sessionsTotal: number;
  sessionsDone: number;
  sessionsUpcoming: number;
  totalOvertimeMinutes: number;
  totalOvertimeCharges: number;
  sessions: SessionRow[];
}

// ── Available-worker type for change-worker modal ─────────────────────────────
interface AvailableWorker {
  _id: string;
  name: string;
  email: string;
  phone: string;
  workerProfile: {
    specialization: string;
    rating: number;
    completedBookings: number;
    availability: boolean;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (d?: string) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }); }
  catch { return d; }
};
const fmtTime = (t?: string) => {
  if (!t) return '—';
  try { return new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); }
  catch { return t; }
};
const fmtMins = (m?: number | null) => {
  if (!m) return '—';
  const h = Math.floor(m / 60); const r = m % 60;
  return h > 0 ? `${h}h ${r}m` : `${r}m`;
};

const MySubscriptionsPage = () => {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<{ role: string; name?: string } | null>(null);
  const [subscriptions, setSubscriptions] = useState<CustomerSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [changingWorker, setChangingWorker] = useState<string | null>(null);
  const [availableWorkers, setAvailableWorkers] = useState<AvailableWorker[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [expandedCalendars, setExpandedCalendars] = useState<Set<string>>(new Set());
  const [pauseRequestFor, setPauseRequestFor] = useState<string | null>(null);
  const [pauseRequestForm, setPauseRequestForm] = useState({
    requestedStartDate: '',
    requestedEndDate: '',
    reason: '',
  });
  const [submittingPauseRequest, setSubmittingPauseRequest] = useState(false);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

  const toggleSessions = (id: string) =>
    setExpandedSessions(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });

  const toggleCalendar = (id: string) =>
    setExpandedCalendars(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [profileData, subsData] = await Promise.all([
        authAPI.getProfile(),
        api.get('/bookings/customer/my-subscriptions'),
      ]);
      setProfile(profileData.user || profileData);
      setSubscriptions(subsData.subscriptions ?? []);
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error(t('subscriptionPage.toasts.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAvailableWorkers = async (serviceCategory: string) => {
    try {
      setLoadingWorkers(true);
      const data = await api.get(`/users/workers/available?specialization=${encodeURIComponent(serviceCategory)}`);
      setAvailableWorkers(data.workers || []);
    } catch (error) {
      console.error('Error fetching workers:', error);
      toast.error(t('subscriptionPage.toasts.workersLoadFailed'));
    } finally {
      setLoadingWorkers(false);
    }
  };

  const handleChangeWorkerClick = async (subscription: CustomerSubscription) => {
    setChangingWorker(subscription._id);
    await fetchAvailableWorkers(subscription.service.category);
  };

  const handleWorkerChange = async (bookingId: string, newWorkerId: string) => {
    try {
      await bookingsAPI.changeSubscriptionWorker(bookingId, newWorkerId);

      toast.success(t('subscriptionPage.toasts.workerChangeSent'));
      setChangingWorker(null);
      setAvailableWorkers([]);
      await fetchData();
    } catch (error) {
      console.error('Error changing worker:', error);
      toast.error((error as Error).message || t('subscriptionPage.toasts.workerChangeFailed'));
    }
  };

  const openPauseRequestModal = (bookingId: string) => {
    setPauseRequestFor(bookingId);
    setPauseRequestForm({
      requestedStartDate: '',
      requestedEndDate: '',
      reason: '',
    });
  };

  const handlePauseSubscription = async (bookingId: string) => {
    try {
      if (!pauseRequestForm.requestedStartDate || !pauseRequestForm.requestedEndDate) {
        toast.error(t('subscriptionPage.pause.validation.datesRequired'));
        return;
      }

      if (pauseRequestForm.requestedEndDate < pauseRequestForm.requestedStartDate) {
        toast.error(t('subscriptionPage.pause.validation.endBeforeStart'));
        return;
      }

      setSubmittingPauseRequest(true);
      await bookingsAPI.pauseSubscription(bookingId, {
        requestedStartDate: pauseRequestForm.requestedStartDate || null,
        requestedEndDate: pauseRequestForm.requestedEndDate || null,
        reason: pauseRequestForm.reason.trim(),
      });

      toast.success(t('subscriptionPage.toasts.pauseRequestSent'));
      setPauseRequestFor(null);
      await fetchData();
    } catch (error) {
      console.error('Error pausing subscription:', error);
      toast.error((error as Error).message || t('subscriptionPage.toasts.pauseRequestFailed'));
    } finally {
      setSubmittingPauseRequest(false);
    }
  };

  const handleResumeSubscription = async (bookingId: string) => {
    try {
      await bookingsAPI.resumeSubscription(bookingId);

      toast.success(t('subscriptionPage.toasts.resumeSuccess'));
      await fetchData();
    } catch (error) {
      console.error('Error resuming subscription:', error);
      toast.error((error as Error).message || t('subscriptionPage.toasts.resumeFailed'));
    }
  };

  if (loading) {
    return (
      <AppLayout userType="customer" userName={profile?.name || "Customer"}>
        <div className="max-w-6xl mx-auto py-12 text-center">
          <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3"></div>
          <p className="text-sm text-muted-foreground">{t('subscriptionPage.loading')}</p>
        </div>
      </AppLayout>
    );
  }

  const isSubscriptionPaymentSettled = (subscription: CustomerSubscription) => Boolean(
    subscription.paymentStatus === 'paid'
    || subscription.paymentProof?.reviewStatus === 'approved'
    || subscription.activationStatus === 'active'
  );

  return (
    <AppLayout userType="customer" userName={profile?.name || "Customer"}>
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">{t('subscriptionPage.title')}</h1>
          <p className="text-muted-foreground">{t('subscriptionPage.subtitle')}</p>
        </div>

        {/* Renewal reminder banners */}
        {subscriptions
          .filter(s => {
            const end = s.subscriptionEndDate;
            if (!end) return false;
            const daysLeft = Math.ceil((new Date(end).getTime() - Date.now()) / 86400000);
            return daysLeft >= 0 && daysLeft <= 3;
          })
          .map(s => {
            const daysLeft = Math.ceil((new Date(s.subscriptionEndDate!).getTime() - Date.now()) / 86400000);
            return (
              <div key={`renewal-${s._id}`} className="mb-3 flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
                <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-orange-800">
                    {t('subscriptionPage.renewal.expires', {
                      service: s.service.name,
                      when: daysLeft <= 0 ? t('subscriptionPage.renewal.today') : daysLeft === 1 ? t('subscriptionPage.renewal.tomorrow') : t('subscriptionPage.renewal.inDays', { count: daysLeft })
                    })}
                  </p>
                  <p className="text-xs text-orange-600 mt-0.5">
                    {t('subscriptionPage.renewal.description', {
                      date: new Date(s.subscriptionEndDate!).toLocaleDateString()
                    })}
                  </p>
                </div>
                <a href="/customer/services" className="text-xs font-semibold text-orange-700 underline underline-offset-2 shrink-0">
                  {t('subscriptionPage.renewal.action')}
                </a>
              </div>
            );
          })
        }

        {/* Subscriptions List */}
        {subscriptions.length === 0 ? (
          <div className="card-elevated p-12 text-center">
            <Calendar className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold text-foreground mb-2">{t('subscriptionPage.empty.title')}</h3>
            <p className="text-muted-foreground mb-4">
              {t('subscriptionPage.empty.description')}
            </p>
            <a href="/customer/services" className="btn-brand inline-flex">
              {t('subscriptionPage.empty.action')}
            </a>
          </div>
        ) : (
          <div className="space-y-6">
            {subscriptions.map((subscription) => (
              (() => {
                const paymentSettled = isSubscriptionPaymentSettled(subscription);
                const proofSubmittedPending = Boolean(
                  subscription.activationStatus === 'payment_pending'
                  && subscription.paymentProof?.reviewStatus === 'pending'
                  && subscription.paymentProof?.url
                );

                return (
              <div key={subscription._id} className="card-elevated p-4 sm:p-5 md:p-6">
                {/* Subscription Header */}
                <div className="flex items-start justify-between mb-4 pb-4 border-b border-border">
                  <div>
                    <h3 className="text-xl font-bold text-foreground mb-1">
                      {subscription.service.name}
                    </h3>
                    <p className="text-sm text-muted-foreground capitalize">
                      {t('subscriptionPage.frequencyLabel', { frequency: subscription.frequency || '-' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {proofSubmittedPending ? (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                          {t('subscriptionPage.badges.proofSubmitted')}
                      </span>
                    ) : subscription.activationStatus === 'payment_pending' && !paymentSettled ? (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                          {t('subscriptionPage.badges.paymentRequired')}
                      </span>
                    ) : subscription.activationStatus === 'approval_pending' ? (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                          {t('subscriptionPage.badges.review')}
                      </span>
                    ) : paymentSettled ? (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                          {t('subscriptionPage.badges.paid')}
                      </span>
                    ) : subscription.isPaused ? (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">
                          {t('subscriptionPage.badges.paused')}
                      </span>
                    ) : subscription.pauseRequestStatus === 'pending' ? (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                          {t('subscriptionPage.badges.pausePending')}
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                          {t('subscriptionPage.badges.active')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Subscription Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{t('subscriptionPage.labels.time')}:</span>
                      <span className="font-medium text-foreground">
                        {subscription.preferredTime || '—'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{t('subscriptionPage.labels.started')}:</span>
                      <span className="font-medium text-foreground">
                        {fmtDate(subscription.subscriptionStartDate)}
                      </span>
                    </div>

                    {subscription.subscriptionEndDate && (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{t('subscriptionPage.labels.ends')}:</span>
                        <span className="font-medium text-foreground">
                          {fmtDate(subscription.subscriptionEndDate)}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{t('subscriptionPage.labels.location')}:</span>
                      <span className="font-medium text-foreground line-clamp-2 break-words">
                        {subscription.location.area}, {subscription.location.city}
                      </span>
                    </div>
                  </div>

                  {/* Assigned Worker Card */}
                  <div className="border-2 border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-primary" />
                        {t('subscriptionPage.worker.title')}
                      </p>
                      {subscription.worker && (
                        <button
                          onClick={() => handleChangeWorkerClick(subscription)}
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" />
                          {t('subscriptionPage.worker.change')}
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mb-3">
                      {t('subscriptionPage.worker.help')}
                    </p>

                    {subscription.worker ? (
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white font-bold">
                          {subscription.worker.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground">{subscription.worker.name}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2 break-words">
                            {subscription.worker.workerProfile?.specialization} • ⭐ {subscription.worker.workerProfile?.rating?.toFixed(1)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg bg-muted/60 px-3 py-3 text-sm text-muted-foreground">
                        {proofSubmittedPending
                          ? t('subscriptionPage.worker.unassigned.proofSubmitted')
                          : subscription.activationStatus === 'payment_pending' && !paymentSettled
                          ? t('subscriptionPage.worker.unassigned.paymentPending')
                          : subscription.activationStatus === 'approval_pending'
                          ? t('subscriptionPage.worker.unassigned.review')
                          : paymentSettled
                            ? t('subscriptionPage.worker.unassigned.paid')
                            : t('subscriptionPage.worker.unassigned.assigning')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Service days calendar */}
                {subscription.selectedDays && subscription.selectedDays.length > 0 && (
                  <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-foreground">📅 {t('subscriptionPage.calendar.serviceDays')}</p>
                      <button
                        onClick={() => toggleCalendar(subscription._id)}
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <CalendarDays className="w-3 h-3" />
                        {expandedCalendars.has(subscription._id) ? t('subscriptionPage.calendar.hide') : t('subscriptionPage.calendar.view')}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {subscription.selectedDays.map((day) => (
                        <span
                          key={day}
                          className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium capitalize"
                        >
                          {day}
                        </span>
                      ))}
                    </div>
                    {expandedCalendars.has(subscription._id) && (
                      <div className="mt-3">
                        <SubscriptionCalendar
                          selectedDays={subscription.selectedDays}
                          startDate={subscription.startDate}
                          endDate={subscription.endDate}
                          isPaused={subscription.isPaused}
                          preferredTime={subscription.preferredTime}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Features */}
                <div className="flex flex-wrap gap-3 mb-4 text-xs text-muted-foreground">
                  {subscription.autoRenewal && (
                    <span className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-green-600" />
                      {t('subscriptionPage.features.autoRenewal')}
                    </span>
                  )}
                  {subscription.allowPause && (
                    <span className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-blue-600" />
                      {t('subscriptionPage.features.pauseAvailable')}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-purple-600" />
                    {t('subscriptionPage.features.durationPerSession', { count: subscription.durationPerSession || 1 })}
                  </span>
                </div>

                {/* Session Progress + Bill Summary */}
                {(() => {
                  const sessions = subscription.sessions ?? [];
                  const done = subscription.sessionsDone;
                  const total = subscription.sessionsTotal;
                  const upcoming = subscription.sessionsUpcoming;
                  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
                  const totalOvertimeCharges = subscription.totalOvertimeCharges;
                  const totalOvertimeMinutes = subscription.totalOvertimeMinutes;
                  const nextSession = sessions.find(s => ['confirmed', 'assigned', 'pending'].includes(s.status));
                  return (
                    <div className="mb-4 p-4 bg-muted/40 rounded-xl space-y-3">
                      {/* Summary pills */}
                      <div className="flex flex-wrap gap-2">
                        <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                          <IndianRupee className="w-3 h-3" />
                          Prepaid ₹{subscription.totalAmount.toLocaleString('en-IN')} ✓
                        </span>
                        {totalOvertimeCharges > 0 && (
                          <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                            <Timer className="w-3 h-3" />
                            Overtime Due: ₹{totalOvertimeCharges.toLocaleString('en-IN')} ({fmtMins(totalOvertimeMinutes)})
                          </span>
                        )}
                      </div>

                      {/* Progress bar */}
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium text-muted-foreground">Sessions Progress</span>
                          <span className="font-semibold text-foreground">{done}/{total} done · {upcoming} upcoming</span>
                        </div>
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      {/* Next session */}
                      {nextSession && (
                        <div className="flex items-center gap-2 text-xs rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-blue-800">
                          <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>
                            Next session: <strong>{fmtDate(nextSession.bookingDate)}</strong> at <strong>{nextSession.startTime}</strong>
                            {nextSession.worker && <> · {nextSession.worker.name}</>}
                          </span>
                        </div>
                      )}

                      {/* Session history toggle */}
                      {total > 0 && (
                        <button
                          onClick={() => toggleSessions(subscription._id)}
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          {expandedSessions.has(subscription._id) ? (
                            <><ChevronUp className="w-3 h-3" /> Hide Session Log</>
                          ) : (
                            <><ChevronDown className="w-3 h-3" /> View Session Log ({total} sessions)</>
                          )}
                        </button>
                      )}

                      {expandedSessions.has(subscription._id) && (
                        <div className="rounded-lg border border-border overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-muted/60">
                              <tr>
                                <th className="text-left px-3 py-2 font-medium text-muted-foreground">#</th>
                                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Date</th>
                                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Scheduled</th>
                                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Actual</th>
                                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Duration</th>
                                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Overtime</th>
                                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sessions.map((session, idx) => (
                                <tr key={session._id} className={`${
                                  session.isProjected
                                    ? 'opacity-60 bg-sky-50/40 dark:bg-sky-900/10'
                                    : idx % 2 === 0 ? '' : 'bg-muted/30'
                                }`}>
                                  <td className="px-3 py-2 text-muted-foreground font-medium">{session.sessionNumber}</td>
                                  <td className="px-3 py-2 whitespace-nowrap">{fmtDate(session.bookingDate)}</td>
                                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                                    {session.startTime} – {session.endTime}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap">
                                    {!session.isProjected && session.actualStartTime
                                      ? `${fmtTime(session.actualStartTime)} – ${fmtTime(session.actualEndTime)}`
                                      : <span className="text-muted-foreground">—</span>}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap">
                                    {!session.isProjected && session.actualDurationMinutes
                                      ? `${session.actualDurationMinutes} min`
                                      : fmtMins(session.scheduledDurationMinutes ?? (subscription.durationPerSession ?? 1) * 60)}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap">
                                    {!session.isProjected && session.overtimeMinutes > 0 ? (
                                      <span className="text-orange-600 font-semibold">
                                        +{session.overtimeMinutes}m / ₹{session.overtimeCharges.toFixed(0)}
                                      </span>
                                    ) : <span className="text-muted-foreground">—</span>}
                                  </td>
                                  <td className="px-3 py-2">
                                    {session.isProjected ? (
                                      <span className="text-xs text-sky-600 font-medium">📅 scheduled</span>
                                    ) : (
                                      <span className={`capitalize font-medium ${
                                        session.status === 'completed' ? 'text-green-600' :
                                        session.status === 'in-progress' ? 'text-blue-600' :
                                        session.status === 'cancelled' ? 'text-red-500' :
                                        'text-muted-foreground'
                                      }`}>
                                        {session.status}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Actions */}
                <div className="flex gap-2">
                  {subscription.allowPause && subscription.activationStatus === 'active' && (
                    subscription.isPaused ? (
                      <button
                        onClick={() => handleResumeSubscription(subscription._id)}
                        className="btn-outline flex items-center gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        {t('subscriptionPage.actions.resume')}
                      </button>
                    ) : subscription.pauseRequestStatus === 'pending' ? (
                      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                        {t('subscriptionPage.actions.pausePending')}
                      </div>
                    ) : (
                      <button
                        onClick={() => openPauseRequestModal(subscription._id)}
                        className="btn-outline flex items-center gap-2"
                      >
                        <XCircle className="w-4 h-4" />
                        {t('subscriptionPage.actions.requestPause')}
                      </button>
                    )
                  )}
                </div>

                {subscription.activationStatus === 'payment_pending' && !paymentSettled && (
                  <div className="mt-4 space-y-4">
                    {subscription.paymentProof?.reviewStatus === 'pending' && subscription.paymentProof?.url ? (
                      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                        {t('subscriptionPage.payment.pendingReview')}
                      </div>
                    ) : (
                      <>
                        {subscription.paymentProof?.reviewStatus === 'rejected' && (
                          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {subscription.paymentProof.reviewNotes
                              ? t('subscriptionPage.payment.rejectedWithNote', { note: subscription.paymentProof.reviewNotes })
                              : t('subscriptionPage.payment.rejected')}
                          </div>
                        )}

                        <SubscriptionPaymentStep
                          bookingId={subscription._id}
                          amount={subscription.totalAmount}
                          title={t('subscriptionPage.payment.stepTitle')}
                          description={t('subscriptionPage.payment.stepDescription')}
                          successLabel={t('subscriptionPage.payment.stepSuccess')}
                          onPaymentSubmitted={fetchData}
                        />
                      </>
                    )}
                  </div>
                )}

                {subscription.activationStatus === 'approval_pending' && (
                  <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
                    {t('subscriptionPage.payment.approvalPending')}
                  </div>
                )}

                {paymentSettled && (
                  <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                    {t('subscriptionPage.payment.verified')}
                  </div>
                )}

                {subscription.pauseRequestStatus === 'rejected' && subscription.pauseReviewNote && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {t('subscriptionPage.pause.rejectedUpdate', { note: subscription.pauseReviewNote })}
                  </div>
                )}

                {subscription.pauseRequestStatus === 'pending' && (
                  <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                    {t('subscriptionPage.pause.sentOn', {
                      date: subscription.pauseRequestedAt ? new Date(subscription.pauseRequestedAt).toLocaleDateString() : t('subscriptionPage.renewal.today')
                    })}
                    {subscription.pauseRequestStartDate && (
                      <span> {t('subscriptionPage.pause.breakWindowStart', { date: new Date(subscription.pauseRequestStartDate).toLocaleDateString() })}</span>
                    )}
                    {subscription.pauseRequestEndDate && (
                      <span> {t('subscriptionPage.pause.breakWindowEnd', { date: new Date(subscription.pauseRequestEndDate).toLocaleDateString() })}</span>
                    )}
                  </div>
                )}

                {/* Worker Change Modal */}
                {changingWorker === subscription._id && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-background rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6">
                      <h3 className="text-xl font-bold text-foreground mb-4">
                        {t('subscriptionPage.worker.modalTitle')}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        {t('subscriptionPage.worker.modalDescription')}
                      </p>

                      {loadingWorkers ? (
                        <div className="py-12 text-center">
                          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                          <p className="text-sm text-muted-foreground">{t('subscriptionPage.worker.loading')}</p>
                        </div>
                      ) : availableWorkers.length === 0 ? (
                        <div className="py-12 text-center">
                          <User className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                          <p className="text-muted-foreground">{t('subscriptionPage.worker.noneAvailable')}</p>
                        </div>
                      ) : (
                        <div className="space-y-3 mb-6">
                          {availableWorkers
                            .filter(w => w._id !== subscription.worker?._id)
                            .map((worker) => (
                              <button
                                key={worker._id}
                                onClick={() => handleWorkerChange(subscription._id, worker._id)}
                                className="w-full p-4 border-2 border-border hover:border-primary rounded-lg text-left transition-all"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white font-bold text-lg">
                                    {worker.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="flex-1">
                                    <p className="font-semibold text-foreground">{worker.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {worker.workerProfile.specialization} • ⭐ {worker.workerProfile.rating.toFixed(1)} ({t('subscriptionPage.worker.jobs', { count: worker.workerProfile.completedBookings })})
                                    </p>
                                  </div>
                                </div>
                              </button>
                            ))}
                        </div>
                      )}

                      <button
                        onClick={() => {
                          setChangingWorker(null);
                          setAvailableWorkers([]);
                        }}
                        className="btn-outline w-full"
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  </div>
                )}

                {pauseRequestFor === subscription._id && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-background rounded-xl max-w-lg w-full p-6 space-y-4">
                      <div>
                        <h3 className="text-xl font-bold text-foreground">{t('subscriptionPage.pause.modalTitle')}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {t('subscriptionPage.pause.modalDescription')}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">{t('subscriptionPage.pause.startDate')}</label>
                          <input
                            type="date"
                            value={pauseRequestForm.requestedStartDate}
                            min={new Date().toISOString().split('T')[0]}
                            required
                            onChange={(event) => setPauseRequestForm((current) => ({
                              ...current,
                              requestedStartDate: event.target.value,
                              requestedEndDate: current.requestedEndDate && event.target.value && current.requestedEndDate < event.target.value
                                ? event.target.value
                                : current.requestedEndDate,
                            }))}
                            className="input-clean"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">{t('subscriptionPage.pause.endDate')}</label>
                          <input
                            type="date"
                            value={pauseRequestForm.requestedEndDate}
                            min={pauseRequestForm.requestedStartDate || new Date().toISOString().split('T')[0]}
                            required
                            onChange={(event) => setPauseRequestForm((current) => ({
                              ...current,
                              requestedEndDate: event.target.value,
                            }))}
                            className="input-clean"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">{t('subscriptionPage.pause.reason')}</label>
                        <textarea
                          value={pauseRequestForm.reason}
                          onChange={(event) => setPauseRequestForm((current) => ({
                            ...current,
                            reason: event.target.value.slice(0, 500),
                          }))}
                          rows={4}
                          maxLength={500}
                          placeholder={t('subscriptionPage.pause.reasonPlaceholder')}
                          className="input-clean resize-none"
                        />
                      </div>

                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setPauseRequestFor(null);
                            setPauseRequestForm({ requestedStartDate: '', requestedEndDate: '', reason: '' });
                          }}
                          className="btn-outline flex-1"
                          disabled={submittingPauseRequest}
                        >
                          {t('common.cancel')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePauseSubscription(subscription._id)}
                          className="btn-brand flex-1"
                          disabled={submittingPauseRequest}
                        >
                          {submittingPauseRequest ? t('subscriptionPage.pause.sending') : t('subscriptionPage.pause.send')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
                );
              })()
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default MySubscriptionsPage;
