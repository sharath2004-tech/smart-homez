import AppLayout from "@/components/AppLayout";
import { authAPI, bookingsAPI, workersAPI } from "@/lib/api";
import { Calendar, CheckCircle, Clock, MapPin, Package, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import TaskDetailModal from "./TaskDetailModal";

interface Task {
  _id: string;
  service?: {
    _id: string;
    name: string;
    price: number;
  } | null;
  bookingType?: string;
  customer: {
    _id: string;
    name: string;
    phone?: string;
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
  actualEndTime?: string;
}

interface Profile {
  name: string;
  email: string;
  role: string;
}

const WorkerTasks = () => {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"current" | "upcoming" | "completed">("current");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const [profileData, currentTaskData, upcomingTasksData] = await Promise.all([
        authAPI.getProfile(),
        workersAPI.getCurrentTask(),
        workersAPI.getUpcomingTasks(10)
      ]);

      setProfile(profileData.user || profileData);
      setCurrentTask(currentTaskData.task || null);
      setUpcomingTasks(upcomingTasksData.tasks || []);
      
      // Fetch completed tasks
      try {
        const completedData = await bookingsAPI.getAll({ status: 'completed' });
        setCompletedTasks(completedData.bookings || []);
      } catch (error) {
        console.error('Error fetching completed tasks:', error);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartTask = async (taskId: string) => {
    try {
      await bookingsAPI.update(taskId, { status: 'in-progress', startedAt: new Date().toISOString() });
      await fetchTasks();
    } catch (error) {
      console.error('Error starting task:', error);
      alert('Failed to start task');
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    if (confirm('Mark this task as completed?')) {
      try {
        await bookingsAPI.update(taskId, { status: 'completed', completedAt: new Date().toISOString() });
        await fetchTasks();
        setActiveTab('completed');
      } catch (error) {
        console.error('Error completing task:', error);
        alert('Failed to complete task');
      }
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
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
    if (name.includes('deep clean') || name.includes('house') || !serviceName) return '✨';
    if (name.includes('sofa')) return '🛋️';
    if (name.includes('carpet')) return '🧺';
    if (name.includes('ac')) return '❄️';
    if (name.includes('plumb')) return '🔧';
    if (name.includes('electric')) return '⚡';
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

  const renderTaskCard = (task: Task, isCurrent: boolean = false) => (
    <div 
      key={task._id} 
      className="card-elevated p-5 hover:shadow-lg transition-all cursor-pointer"
      onClick={() => setSelectedTaskId(task._id)}
    >
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-primary-light rounded-xl flex items-center justify-center text-2xl shrink-0">
          {getServiceEmoji(task.service?.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-foreground line-clamp-2 break-words">{task.service?.name ?? '✨ Deep Cleaning'}</h3>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                <User className="w-3.5 h-3.5" />
                {task.customer.name}
              </p>
            </div>
            <span className={`text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap ${
              task.status === 'completed' ? 'bg-success-light text-success' :
              task.status === 'in-progress' ? 'bg-primary-light text-primary' :
              'bg-warning-light text-warning'
            }`}>
              {task.status === 'completed' ? t('worker.tasks.completed') :
               task.status === 'in-progress' ? t('worker.tasks.workInProgress') : t('worker.tasks.upcoming')}
            </span>
          </div>

          <div className="space-y-1.5 mb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="line-clamp-2 break-words">
                {task.location ? [task.location.address, task.location.city, task.location.state].filter(Boolean).join(', ') : t('worker.dashboard.location')}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>{formatDate(task.bookingDate)}</span>
              <Clock className="w-3.5 h-3.5 ml-2 shrink-0" />
              <span>{formatTime(task.startTime)} - {formatTime(task.endTime)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Package className="w-3.5 h-3.5 shrink-0" />
              <span className="text-muted-foreground font-normal">{t('worker.tasks.collectLabel')}</span>
              <span className="text-primary">₹{task.totalAmount}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-border">
            <p className="text-xs text-primary font-medium">
              👆 {t('worker.tasks.tapToViewDetails')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    if (activeTab === "current") {
      if (!currentTask) {
        return (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-bold text-foreground mb-2">{t('worker.tasks.noActiveTask')}</h3>
            <p className="text-muted-foreground text-sm">{t('worker.tasks.noActiveTasks')}</p>
          </div>
        );
      }
      return renderTaskCard(currentTask, true);
    }

    if (activeTab === "upcoming") {
      if (upcomingTasks.length === 0) {
        return (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-bold text-foreground mb-2">{t('worker.tasks.noUpcomingTasks')}</h3>
            <p className="text-muted-foreground text-sm">{t('worker.tasks.allCaughtUp')}</p>
          </div>
        );
      }
      return (
        <div className="space-y-4">
          {upcomingTasks.map(task => renderTaskCard(task))}
        </div>
      );
    }

    if (activeTab === "completed") {
      if (completedTasks.length === 0) {
        return (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-bold text-foreground mb-2">{t('worker.tasks.noCompletedTasks')}</h3>
            <p className="text-muted-foreground text-sm">{t('worker.tasks.completedWillAppear')}</p>
          </div>
        );
      }
      return (
        <div className="space-y-4">
          {completedTasks.map(task => renderTaskCard(task))}
        </div>
      );
    }
  };

  return (
    <AppLayout userType="worker" userName={profile?.name || "Worker"}>
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in pb-20 md:pb-0">
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground mb-1">{t('worker.tasks.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('worker.tasks.subtitle')}</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-xl">
          {[
            { key: "current", label: t('worker.tasks.current') },
            { key: "upcoming", label: t('worker.tasks.upcoming') },
            { key: "completed", label: t('worker.tasks.completed') }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? "bg-card text-foreground shadow-card"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {renderContent()}
      </div>

      {/* Task Detail Modal */}
      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onRefresh={fetchTasks}
        />
      )}
    </AppLayout>
  );
};

export default WorkerTasks;
