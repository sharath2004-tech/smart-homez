import AppLayout from '@/components/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { api, authAPI } from '@/lib/api';
import { CheckCircle, IndianRupee, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

interface SalaryRecord {
  _id: string;
  periodFrom: string;
  periodTo: string;
  totalMinutesWorked: number;
  totalTasksCompleted: number;
  hourlyRate: number;
  requestedAmount: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  paidAt?: string;
  adminNotes?: string;
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

// ── Component ─────────────────────────────────────────────────────────────────

const WorkerSalaryHistory = () => {
  const [userName, setUserName] = useState('Worker');
  const [records, setRecords] = useState<SalaryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authAPI.getProfile().then(res => {
      const u = res?.user || res;
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

  const totalEarned = records.reduce((sum, r) => sum + r.requestedAmount, 0);

  return (
    <AppLayout userType="worker" userName={userName}>
      <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Salary History</h1>
          <p className="text-sm text-muted-foreground mt-1">Your monthly salary payments sent by admin</p>
        </div>

        {/* Summary card */}
        {records.length > 0 && (
          <Card className="bg-primary text-primary-foreground">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-primary-foreground/80">Total Received</p>
                <p className="text-3xl font-bold mt-0.5">₹{totalEarned.toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-primary-foreground/80">Payments</p>
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
              Payment History
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
                <p className="text-sm">No salary payments yet</p>
                <p className="text-xs text-center mt-1">Your salary will appear here once admin processes it</p>
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
                          {rec.totalTasksCompleted} task{rec.totalTasksCompleted !== 1 ? 's' : ''} · {formatMinutes(rec.totalMinutesWorked)} worked
                        </p>
                      </div>
                      <Badge className="bg-green-100 text-green-800 flex items-center gap-1 text-xs shrink-0">
                        <CheckCircle className="w-3 h-3" />
                        Paid
                      </Badge>
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Rate: ₹{rec.hourlyRate}/hr</span>
                      <span className="font-bold text-primary text-lg">₹{rec.requestedAmount.toFixed(2)}</span>
                    </div>

                    {rec.paidAt && (
                      <p className="text-xs text-green-700">Received on {fmtDate(rec.paidAt)}</p>
                    )}
                    {rec.adminNotes && (
                      <p className="text-xs text-muted-foreground italic">Note: {rec.adminNotes}</p>
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
