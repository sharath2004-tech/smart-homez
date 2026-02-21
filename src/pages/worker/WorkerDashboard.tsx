import AppLayout from "@/components/AppLayout";
import { authAPI, bookingsAPI, workersAPI } from "@/lib/api";
import { Bell, CheckCircle, ChevronRight, Clock, MapPin, QrCode, Star, ToggleLeft, ToggleRight, TrendingUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import TaskDetailModal from "./TaskDetailModal";

interface Stats {
  today: number;
  thisWeek: number;
  thisMonth: number;
}

interface Task {
  _id: string;
  service: {
    name: string;
    price: number;
  };
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
}

const WorkerDashboard = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats>({ today: 0, thisWeek: 0, thisMonth: 0 });
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
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleOnline = async () => {
    try {
      await workersAPI.updateAvailability(!isOnline);
      setIsOnline(!isOnline);
    } catch (error) {
      console.error('Error updating availability:', error);
      alert('Failed to update availability');
    }
  };

  const handleCompleteService = async () => {
    if (!currentTask) return;

    if (confirm('Mark this service as completed?')) {
      try {
        await bookingsAPI.update(currentTask._id, { status: 'completed', completedAt: new Date().toISOString() });
        await fetchDashboardData();
        alert('Service completed successfully!');
      } catch (error) {
        console.error('Error completing service:', error);
        alert('Failed to complete service');
      }
    }
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getServiceEmoji = (serviceName: string) => {
    if (serviceName.toLowerCase().includes('kitchen')) return '🍳';
    if (serviceName.toLowerCase().includes('bathroom')) return '🚿';
    if (serviceName.toLowerCase().includes('deep clean')) return '✨';
    if (serviceName.toLowerCase().includes('sofa')) return '🛋️';
    return '🧹';
  };

  if (loading) {
    return (
      <AppLayout userType="worker" userName="Loading...">
        <div className="max-w-3xl mx-auto flex items-center justify-center py-20">
          <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout userType="worker" userName={profile?.name || "Worker"}>
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in pb-20 md:pb-0">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-sm">Welcome back 👋</p>
            <h1 className="text-2xl font-bold font-heading text-foreground">{profile?.name}</h1>
          </div>
          <button
            onClick={handleToggleOnline}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
              isOnline
                ? "border-success bg-success-light text-success"
                : "border-border bg-muted text-muted-foreground"
            }`}
          >
            {isOnline ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
            {isOnline ? "Online" : "Offline"}
          </button>
        </div>

        {/* Earnings summary */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Today", value: `₹${stats.today}`, icon: TrendingUp, color: "text-primary", bg: "bg-primary-light" },
            { label: "This Week", value: `₹${stats.thisWeek}`, icon: CheckCircle, color: "text-success", bg: "bg-success-light" },
            { label: "This Month", value: `₹${stats.thisMonth}`, icon: Star, color: "text-warning", bg: "bg-warning-light" },
          ].map((card) => (
            <div key={card.label} className="card-elevated p-4">
              <div className={`w-8 h-8 ${card.bg} rounded-lg flex items-center justify-center mb-2`}>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <p className="text-lg font-bold font-heading text-foreground mt-0.5">{card.value}</p>
            </div>
          ))}
        </div>

        {/* Active task */}
        {isOnline && currentTask && (
          <div className="rounded-2xl overflow-hidden border-2 border-warning">
            <div className="bg-warning-light px-5 py-3 flex items-center gap-2">
              <div className="w-2 h-2 bg-warning rounded-full animate-pulse" />
              <span className="text-sm font-semibold text-warning-foreground">Active Service in Progress</span>
            </div>
            <div className="bg-card p-5">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center text-2xl shrink-0">
                  {getServiceEmoji(currentTask.service.name)}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-foreground">{currentTask.service.name}</p>
                  <p className="text-sm text-muted-foreground">Customer: {currentTask.customer.name}</p>
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3" />
                    {currentTask.location ? [currentTask.location.address, currentTask.location.city].filter(Boolean).join(', ') : 'Location TBD'}
                  </div>
                </div>
                <span className="text-base font-bold text-primary">₹{currentTask.totalAmount}</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted rounded-xl mb-4 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground font-medium">{formatTime(currentTask.startTime)} - {formatTime(currentTask.endTime)}</span>
                {taskTimer > 0 && (
                  <div className="ml-auto flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
                    <span className="text-success font-semibold text-xs">Timer running: {taskTimer} min</span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => alert('QR Code feature coming soon!')}
                  className="py-2.5 border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-2"
                >
                  <QrCode className="w-4 h-4" />
                  Show QR Code
                </button>
                <button
                  onClick={handleCompleteService}
                  className="btn-brand py-2.5 text-sm"
                >
                  Complete Service
                </button>
              </div>
            </div>
          </div>
        )}

        {/* No active task message */}
        {isOnline && !currentTask && upcomingTasks.length === 0 && (
          <div className="card-elevated p-8 text-center">
            <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <h3 className="text-lg font-bold text-foreground mb-1">No Active Task</h3>
            <p className="text-sm text-muted-foreground">
              You'll be notified when a new task is assigned
            </p>
          </div>
        )}

        {/* Show upcoming tasks count when no active task */}
        {isOnline && !currentTask && upcomingTasks.length > 0 && (
          <div className="card-elevated p-8 text-center border-2 border-primary/20">
            <CheckCircle className="w-12 h-12 text-primary mx-auto mb-3" />
            <h3 className="text-lg font-bold text-foreground mb-1">Ready to Work!</h3>
            <p className="text-sm text-muted-foreground">
              You have {upcomingTasks.length} upcoming {upcomingTasks.length === 1 ? 'task' : 'tasks'} assigned
            </p>
          </div>
        )}

        {/* Offline message */}
        {!isOnline && (
          <div className="card-elevated p-8 text-center">
            <ToggleLeft className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <h3 className="text-lg font-bold text-foreground mb-1">You're Offline</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Go online to receive task assignments
            </p>
            <button
              onClick={handleToggleOnline}
              className="btn-brand py-2.5 px-6 text-sm"
            >
              Go Online
            </button>
          </div>
        )}

        {/* Upcoming tasks */}
        {upcomingTasks.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold font-heading text-foreground">Upcoming Tasks</h2>
              <Link to="/worker/tasks" className="text-sm text-primary font-medium flex items-center gap-1">
                All tasks <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="space-y-3">
              {upcomingTasks.map((task) => (
                <div 
                  key={task._id} 
                  className="card-elevated p-4 flex items-center gap-4 hover:shadow-lg transition-all cursor-pointer"
                  onClick={() => setSelectedTaskId(task._id)}
                >
                  <div className="w-11 h-11 bg-accent rounded-xl flex items-center justify-center text-xl shrink-0">
                    {getServiceEmoji(task.service.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm">{task.service.name}</p>
                    <p className="text-xs text-muted-foreground">{task.customer.name}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {formatTime(task.startTime)}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {task.location?.city || 'Location TBD'}
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
        <div className="grid grid-cols-2 gap-3">
          <Link to="/worker/earnings" className="card-elevated-hover p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-success-light rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">My Earnings</p>
              <p className="text-xs text-muted-foreground">View & withdraw</p>
            </div>
          </Link>
          <button
            onClick={() => alert('Leave application feature coming soon!')}
            className="card-elevated-hover p-4 flex items-center gap-3 text-left"
          >
            <div className="w-10 h-10 bg-primary-light rounded-xl flex items-center justify-center">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Apply Leave</p>
              <p className="text-xs text-muted-foreground">Request time off</p>
            </div>
          </button>
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
