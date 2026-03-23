import AppLayout from "@/components/AppLayout";
import WorkerAvailabilityToggle from "@/components/WorkerAvailabilityToggle";
import { API_BASE_URL, authAPI, workersAPI } from "@/lib/api";
import { Bell, CheckCircle, ChevronRight, Clock, MapPin, TrendingUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import TaskDetailModal from "./TaskDetailModal";

interface Stats {
  today: number;
  thisWeek: number;
  thisMonth: number;
  minutesToday: number;
  minutesThisWeek: number;
  minutesThisMonth: number;
}

interface Task {
  _id: string;
  service?: {
    name: string;
    price: number;
  } | null;
  bookingType?: string;
  customer: {
    name: string;
  };
  location?: {
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  bookingDate: string;
  startTime: string;
  endTime: string;
  status: string;
  totalAmount: number;
  actualStartTime?: string;
}

interface Profile {
  name: string;
  email: string;
  role: string;
  profileImage?: string;
  workerProfile?: {
    availability?: boolean;
    rating?: number;
    completedServices?: number;
    wageType?: 'hourly' | 'daily' | 'monthly';
    hourlyRate?: number;
    dailyWage?: number;
    monthlyWage?: number;
  };
}

const formatWorkerPay = (workerProfile?: Profile['workerProfile']) => {
  if (!workerProfile) return 'Not set yet';
  if (workerProfile.wageType === 'daily' && workerProfile.dailyWage) return `Daily · ₹${workerProfile.dailyWage}/day`;
  if (workerProfile.wageType === 'monthly' && workerProfile.monthlyWage) return `Monthly · ₹${workerProfile.monthlyWage}/month`;
  if (workerProfile.hourlyRate) return `Hourly · ₹${workerProfile.hourlyRate}/hr`;
  return 'Hourly · Rate pending';
};

const WorkerDashboard = () => {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats>({
    today: 0, thisWeek: 0, thisMonth: 0,
    minutesToday: 0, minutesThisWeek: 0, minutesThisMonth: 0
  });
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskTimer, setTaskTimer] = useState<number>(0);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Use refs to persist timer offset across renders
  const timeOffsetRef = useRef<number>(0);
  const offsetCalculatedRef = useRef<boolean>(false);
  const actualStartTimeRef = useRef<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Timer for current task with timezone offset persistence
  useEffect(() => {
    if (currentTask && currentTask.actualStartTime) {
      // Only calculate offset once when actualStartTime first appears or changes
      if (currentTask.actualStartTime !== actualStartTimeRef.current) {
        actualStartTimeRef.current = currentTask.actualStartTime;
        offsetCalculatedRef.current = false;
      }
      
      if (!offsetCalculatedRef.current) {
        const startTime = new Date(currentTask.actualStartTime!).getTime();
        const initialNow = Date.now();
        const initialElapsed = Math.floor((initialNow - startTime) / 1000);
        
        // If time is significantly negative (more than 5 minutes), likely a timezone issue
        timeOffsetRef.current = initialElapsed < -300 ? -initialElapsed : 0;
        offsetCalculatedRef.current = true;
        
        if (timeOffsetRef.current > 0 && import.meta.env.DEV) {
          console.info('Dashboard timer adjusted for timezone offset:', timeOffsetRef.current, 'seconds');
        }
      }
      
      const interval = setInterval(() => {
        const startTime = new Date(currentTask.actualStartTime!).getTime();
        const now = Date.now();
        const rawElapsed = Math.floor((now - startTime) / 1000);
        const elapsed = Math.max(0, rawElapsed + timeOffsetRef.current);
        const elapsedMinutes = Math.floor(elapsed / 60);
        setTaskTimer(elapsedMinutes);
      }, 1000);

      return () => clearInterval(interval);
    } else {
      setTaskTimer(0);
      actualStartTimeRef.current = null;
      offsetCalculatedRef.current = false;
      timeOffsetRef.current = 0;
    }
  }, [currentTask]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [profileData, statsData, currentTaskData, upcomingTasksData] = await Promise.all([
        authAPI.getProfile(),
        workersAPI.getDashboardStats(),
        workersAPI.getCurrentTask(),
        workersAPI.getUpcomingTasks(3)
      ]);

      setProfile(profileData.user || profileData);
      setStats(statsData.stats || { today: 0, thisWeek: 0, thisMonth: 0 });
      setCurrentTask(currentTaskData.task || null);
      setUpcomingTasks(upcomingTasksData.tasks || []);

      console.log('📊 Worker Dashboard Data:');
      console.log('  Current Task:', currentTaskData.task);
      console.log('  Upcoming Tasks:', upcomingTasksData.tasks);
      console.log('  Tasks Count:', upcomingTasksData.tasks?.length || 0);
      console.log('  Worker Availability:', profileData.user?.workerProfile?.availability);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatMinutes = (mins: number) => {
    if (!mins || mins <= 0) return '0m';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getServiceEmoji = (serviceName?: string | null) => {
    const name = (serviceName ?? '').toLowerCase();
    if (name.includes('kitchen')) return '🍳';
    if (name.includes('bathroom')) return '🚿';
    if (name.includes('deep clean') || !serviceName) return '✨';
    if (name.includes('sofa')) return '🛋️';
    return '🧹';
  };

  if (loading) {
    return (
      <AppLayout userType="worker" userName={t('common.loading')}>
        <div className="max-w-3xl mx-auto flex items-center justify-center py-20">
          <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout userType="worker" userName={profile?.name || "Worker"}>
      <div className="max-w-3xl mx-auto px-3 sm:px-4 md:px-6 space-y-6 animate-fade-in pb-20 md:pb-0">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {profile?.profileImage ? (
                <img
                  src={`${API_BASE_URL.replace('/api', '')}${profile.profileImage}`}
                  alt={profile.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-border shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                  {profile?.name?.charAt(0).toUpperCase() || "W"}
                </div>
              )}
              <div>
                <p className="text-muted-foreground text-sm">{t('worker.dashboard.welcomeBack')}</p>
                <h1 className="text-2xl font-bold font-heading text-foreground">{profile?.name}</h1>
              </div>
            </div>
          </div>
          
          {/* Availability Toggle - Prominent position */}
          <WorkerAvailabilityToggle />
        </div>

        {/* Hours worked summary */}
        <div className="card-elevated p-4 sm:p-5 md:p-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
              <Clock className="w-4 h-4 text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground">{t('worker.dashboard.hoursWorked')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: t('worker.tasks.today'),      value: formatMinutes(stats.minutesToday) },
              { label: t('worker.tasks.thisWeek'),  value: formatMinutes(stats.minutesThisWeek) },
              { label: t('worker.tasks.thisMonth'), value: formatMinutes(stats.minutesThisMonth) },
            ].map((item) => (
              <div key={item.label} className="bg-muted rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                <p className="text-base font-bold font-heading text-primary">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card-elevated p-4 sm:p-5 md:p-6 border-primary/20 bg-primary/5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm text-muted-foreground">Approved pay type</p>
              <p className="text-lg font-bold text-foreground">{formatWorkerPay(profile?.workerProfile)}</p>
            </div>
            <Link to="/worker/profile" className="text-sm font-medium text-primary hover:underline">
              View in profile
            </Link>
          </div>
        </div>

        {/* Active task */}
        {currentTask && (
          <div className="rounded-2xl overflow-hidden border-2 border-warning">
            <div className="bg-warning-light px-5 py-3 flex items-center gap-2">
              <div className="w-2 h-2 bg-warning rounded-full animate-pulse" />
              <span className="text-sm font-semibold text-warning-foreground">{t('worker.tasks.workInProgress')}</span>
            </div>
            <div className="bg-card p-5">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center text-2xl shrink-0">
                  {getServiceEmoji(currentTask.service?.name)}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-foreground">{currentTask.service?.name ?? '✨ Deep Cleaning'}</p>
                  <p className="text-sm text-muted-foreground">{t('worker.dashboard.customer')}: {currentTask.customer.name}</p>
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3" />
                    {currentTask.location ? [currentTask.location.address, currentTask.location.city].filter(Boolean).join(', ') : t('worker.dashboard.location')}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">{t('worker.dashboard.collect')}</p>
                  <span className="text-base font-bold text-primary">₹{currentTask.totalAmount}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted rounded-xl mb-4 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground font-medium">{formatTime(currentTask.startTime)} - {formatTime(currentTask.endTime)}</span>
                {taskTimer > 0 && (
                  <div className="ml-auto flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
                    <span className="text-success font-semibold text-xs">{taskTimer} {t('worker.dashboard.mins')}</span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={() => setSelectedTaskId(currentTask._id)}
                  className="py-2.5 border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-2"
                >
                  View task details
                </button>
              </div>
            </div>
          </div>
        )}

        {/* No active task message */}
        {profile?.workerProfile?.availability && !currentTask && upcomingTasks.length === 0 && (
          <div className="card-elevated p-8 text-center">
            <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <h3 className="text-lg font-bold text-foreground mb-1">{t('worker.dashboard.noActiveTask')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('worker.dashboard.notified')}
            </p>
          </div>
        )}

        {/* Show upcoming tasks count when no active task */}
        {profile?.workerProfile?.availability && !currentTask && upcomingTasks.length > 0 && (
          <div className="card-elevated p-8 text-center border-2 border-primary/20">
            <CheckCircle className="w-12 h-12 text-primary mx-auto mb-3" />
            <h3 className="text-lg font-bold text-foreground mb-1">{t('worker.dashboard.activeTask')}</h3>
            <p className="text-sm text-muted-foreground">
              {upcomingTasks.length} {t('worker.dashboard.upcomingTasks')}
            </p>
          </div>
        )}

        {/* Offline message */}
        {!profile?.workerProfile?.availability && (
          <div className="card-elevated p-8 text-center">
            <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <h3 className="text-lg font-bold text-foreground mb-1">{t('worker.dashboard.offline')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('worker.dashboard.online')}
            </p>
          </div>
        )}

        {/* Upcoming tasks */}
        {upcomingTasks.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold font-heading text-foreground">{t('worker.dashboard.upcomingTasks')}</h2>
              <Link to="/worker/tasks" className="text-sm text-primary font-medium flex items-center gap-1">
                {t('worker.tasks.title')} <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="space-y-3">
              {upcomingTasks.map((task) => (
                <div 
                  key={task._id} 
                  className="card-elevated p-4 sm:p-5 md:p-6 flex items-center gap-4 hover:shadow-lg transition-all cursor-pointer"
                  onClick={() => setSelectedTaskId(task._id)}
                >
                  <div className="w-11 h-11 bg-accent rounded-xl flex items-center justify-center text-xl shrink-0">
                    {getServiceEmoji(task.service?.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm">{task.service?.name ?? '✨ Deep Cleaning'}</p>
                    <p className="text-xs text-muted-foreground">{task.customer.name}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {formatTime(task.startTime)}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {task.location?.city || t('worker.dashboard.locationTBD')}
                      </span>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-primary shrink-0">₹{task.totalAmount}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link to="/worker/earnings" className="card-elevated-hover p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-success-light rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{t('worker.dashboard.myEarnings')}</p>
              <p className="text-xs text-muted-foreground">{t('worker.dashboard.viewWithdraw')}</p>
            </div>
          </Link>
          <Link to="/worker/leaves" className="card-elevated-hover p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-light rounded-xl flex items-center justify-center">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{t('worker.dashboard.applyLeave')}</p>
              <p className="text-xs text-muted-foreground">{t('worker.dashboard.requestTimeOff')}</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Task Detail Modal */}
      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onRefresh={fetchDashboardData}
        />
      )}
    </AppLayout>
  );
};

export default WorkerDashboard;
