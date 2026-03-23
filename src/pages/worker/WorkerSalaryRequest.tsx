import AppLayout from '@/components/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { api, authAPI } from '@/lib/api';
import { CheckCircle, IndianRupee, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

// ── Types ────────────────────────────────────────────────────────────────────

interface SalaryRecord {
  _id: string;
  periodFrom: string;
  periodTo: string;
  totalMinutesWorked: number;
  totalTasksCompleted: number;
  wageType?: 'hourly' | 'daily' | 'monthly';
  hourlyRate: number;
  dailyWage?: number | null;
  monthlyWage?: number | null;
  rateAmount?: number;
  payUnitsWorked?: number;
  payUnitLabel?: 'hour' | 'day' | 'month';
  requestedAmount: number;
  netAmount?: number | null;
  totalPenaltyAmount?: number;
  penaltyTreatment?: 'included' | 'excluded';
  penaltyBreakdown?: Array<{
    leaveDate: string;
    requestedAt?: string;
    reason?: string;
    amount: number;
    leaveStatus?: 'pending' | 'approved' | 'rejected';
  }>;
  penaltyDecidedBy?: { name?: string; role?: string } | string;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  paidAt?: string;
  adminNotes?: string;
}

interface WorkerProfileData {
  name?: string;
  workerProfile?: {
    wageType?: 'hourly' | 'daily' | 'monthly';
    hourlyRate?: number;
    dailyWage?: number;
    monthlyWage?: number;
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatMinutes(mins: number): string {
  if (mins <= 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getFinalPaidAmount(record: SalaryRecord) {
  return record.netAmount ?? record.requestedAmount;
}

function getSalaryRateLabel(record: SalaryRecord) {
  if (record.wageType === 'daily') return `₹${record.dailyWage ?? record.rateAmount ?? 0}/day`;
  if (record.wageType === 'monthly') return `₹${record.monthlyWage ?? record.rateAmount ?? 0}/month`;
  return `₹${record.hourlyRate ?? record.rateAmount ?? 0}/hr`;
}

function getSalaryBasisLabel(record: SalaryRecord) {
  if (record.payUnitLabel === 'day') {
    return `${record.payUnitsWorked ?? 0} worked day${(record.payUnitsWorked ?? 0) === 1 ? '' : 's'}`;
  }
  if (record.payUnitLabel === 'month') {
    return `${record.payUnitsWorked ?? 0} month${(record.payUnitsWorked ?? 0) === 1 ? '' : 's'} covered`;
  }
  const hours = record.payUnitsWorked ?? (record.totalMinutesWorked / 60);
  return `${hours.toFixed(2)} worked hour${hours === 1 ? '' : 's'}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

const WorkerSalaryHistory = () => {
  const { t } = useTranslation();
  const [userName, setUserName] = useState('Worker');
  const [profile, setProfile] = useState<WorkerProfileData | null>(null);
  const [records, setRecords] = useState<SalaryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const getApprovedPayLabel = () => {
    const workerProfile = profile?.workerProfile;
    if (!workerProfile) return 'Not set yet';
    if (workerProfile.wageType === 'daily' && workerProfile.dailyWage) return `Daily · ₹${workerProfile.dailyWage}/day`;
    if (workerProfile.wageType === 'monthly' && workerProfile.monthlyWage) return `Monthly · ₹${workerProfile.monthlyWage}/month`;
    if (workerProfile.hourlyRate) return `Hourly · ₹${workerProfile.hourlyRate}/hr`;
    return 'Hourly · Rate pending';
  };

  useEffect(() => {
    authAPI.getProfile().then(res => {
      const u = res?.user || res;
      setProfile(u || null);
      if (u?.name) setUserName(u.name);
    }).catch(() => {});
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const data = await api.get('/salary-requests/my');
      const all: SalaryRecord[] = data.requests || [];
      // Show only paid records (sent by admin) in descending order
      setRecords(all.filter(r => r.status === 'paid'));
    } catch (err) {
      console.error('Fetch salary history error:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalEarned = records.reduce((sum, r) => sum + getFinalPaidAmount(r), 0);

  return (
    <AppLayout userType="worker" userName={userName}>
      <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('worker.salary.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('worker.salary.subtitle')}</p>
        </div>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Approved pay type</p>
            <p className="text-xl font-bold text-foreground mt-1">{getApprovedPayLabel()}</p>
          </CardContent>
        </Card>

        {/* Summary card */}
        {records.length > 0 && (
          <Card className="bg-primary text-primary-foreground">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-primary-foreground/80">{t('worker.salary.totalReceived')}</p>
                <p className="text-3xl font-bold mt-0.5">₹{totalEarned.toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-primary-foreground/80">{t('worker.salary.payments')}</p>
                <p className="text-3xl font-bold mt-0.5">{records.length}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* History list */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <IndianRupee className="w-4 h-4" />
              {t('worker.salary.paymentHistory')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : records.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <IndianRupee className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">{t('worker.salary.noPayments')}</p>
                <p className="text-xs text-center mt-1">{t('worker.salary.noPaymentsDesc')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {records.map(rec => (
                  <div key={rec._id} className="rounded-lg border border-border p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {fmtDate(rec.periodFrom)} – {fmtDate(rec.periodTo)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {rec.totalTasksCompleted} {rec.totalTasksCompleted !== 1 ? t('worker.salary.tasks') : t('worker.salary.task')} · {getSalaryBasisLabel(rec)}
                        </p>
                      </div>
                      <Badge className="bg-green-100 text-green-800 flex items-center gap-1 text-xs shrink-0">
                        <CheckCircle className="w-3 h-3" />
                        {t('worker.salary.paid')}
                      </Badge>
                    </div>

                    <Separator />

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{t('worker.salary.rate')}: {getSalaryRateLabel(rec)}</span>
                        <span className="font-bold text-primary text-lg">₹{getFinalPaidAmount(rec).toFixed(2)}</span>
                      </div>

                      {(rec.totalPenaltyAmount || 0) > 0 && (
                        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 space-y-1.5">
                          <div className="flex items-center justify-between text-xs sm:text-sm">
                            <span className="font-medium text-amber-900">Leave penalties</span>
                            <span className={`font-semibold ${rec.penaltyTreatment === 'included' ? 'text-red-700' : 'text-green-700'}`}>
                              {rec.penaltyTreatment === 'included'
                                ? `Deducted ₹${(rec.totalPenaltyAmount || 0).toFixed(2)}`
                                : `Waived ₹${(rec.totalPenaltyAmount || 0).toFixed(2)}`}
                            </span>
                          </div>

                          {rec.penaltyBreakdown && rec.penaltyBreakdown.length > 0 && (
                            <div className="space-y-1">
                              {rec.penaltyBreakdown.map((penalty, index) => (
                                <div key={`${rec._id}-penalty-${index}`} className="flex items-center justify-between text-xs text-amber-900/90">
                                  <span>{fmtDate(penalty.leaveDate)}{penalty.reason ? ` · ${penalty.reason}` : ''}</span>
                                  <span>₹{penalty.amount.toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {rec.paidAt && (
                      <p className="text-xs text-green-700">{t('worker.salary.receivedOn')} {fmtDate(rec.paidAt)}</p>
                    )}
                    {rec.penaltyDecidedBy && typeof rec.penaltyDecidedBy !== 'string' && rec.penaltyDecidedBy.name && (
                      <p className="text-xs text-muted-foreground">
                        Penalty decision by {rec.penaltyDecidedBy.name}{rec.penaltyDecidedBy.role ? ` (${rec.penaltyDecidedBy.role.replace('_', ' ')})` : ''}
                      </p>
                    )}
                    {rec.adminNotes && (
                      <p className="text-xs text-muted-foreground italic">{t('worker.salary.note')} {rec.adminNotes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default WorkerSalaryHistory;
