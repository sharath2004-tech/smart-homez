import AppLayout from "@/components/AppLayout";
import { authAPI, workersAPI } from "@/lib/api";
import { Briefcase, CheckCircle, Clock, Mail, MapPin, Phone, Star, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface Profile {
  name: string;
  email: string;
  role: string;
  phone?: string;
  isActive?: boolean;
  isVerified?: boolean;
  workerProfile?: {
    rating: number;
    specialization: string[];
    totalJobsCompleted?: number;
    assignedApartments: Array<{
      apartmentName?: string;
      buildingName?: string;
      building?: string;
      location?: string;
      area?: string;
      city: string;
    }>;
    availability: boolean;
    verified: boolean;
  };
  createdAt: string;
}

const WorkerProfile = () => {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState({ today: 0, thisWeek: 0, thisMonth: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const [profileData, statsData] = await Promise.all([
        authAPI.getProfile(),
        workersAPI.getDashboardStats()
      ]);

      setProfile(profileData.user || profileData);
      setStats(statsData.stats || { today: 0, thisWeek: 0, thisMonth: 0 });
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AppLayout userType="worker" userName={t('common.loading')}>
        <div className="max-w-2xl mx-auto flex items-center justify-center py-20">
          <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      </AppLayout>
    );
  }

  if (!profile) {
    return (
      <AppLayout userType="worker" userName="Guest">
        <div className="max-w-2xl mx-auto text-center py-20">
          <div className="text-4xl mb-4">👤</div>
          <h2 className="text-xl font-bold mb-2">{t('worker.profile.pleaseLogIn')}</h2>
          <p className="text-muted-foreground mb-4">{t('worker.profile.needLogin')}</p>
          <a href="/login" className="btn-brand px-6 py-2 inline-block">
            {t('worker.profile.goToLogin')}
          </a>
        </div>
      </AppLayout>
    );
  }

  const initials = profile.name.split(' ').map((n: string) => n[0]).join('').toUpperCase();
  const rating = profile.workerProfile?.rating || 0;
  const totalJobs = profile.workerProfile?.totalJobsCompleted || stats.thisMonth || 0;

  return (
    <AppLayout userType="worker" userName={profile.name}>
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in pb-20 md:pb-0">
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground mb-1">{t('worker.profile.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('worker.profile.subtitle')}</p>
        </div>

        {/* Profile Header Card */}
        <div className="card-elevated p-4 sm:p-5 md:p-6">
          <div className="flex items-start gap-5">
            <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-2xl font-bold shrink-0">
              {initials}
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold font-heading text-foreground mb-1">{profile.name}</h2>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm px-3 py-1 bg-primary-light text-primary rounded-full font-medium capitalize">
                  {profile.role}
                </span>
                {rating > 0 && (
                  <div className="flex items-center gap-1 text-sm">
                    <Star className="w-4 h-4 fill-warning text-warning" />
                    <span className="font-semibold">{rating.toFixed(1)}</span>
                  </div>
                )}
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <CheckCircle className="w-4 h-4" />
                  <span>{totalJobs} {t('worker.profile.jobsCompleted')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="card-elevated p-4 sm:p-5 md:p-6">
          <h3 className="font-bold font-heading text-foreground mb-4 flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            {t('worker.profile.personalInfo')}
          </h3>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">{t('worker.profile.email')}</p>
                <p className="font-medium text-foreground">{profile.email}</p>
              </div>
            </div>
            {profile.phone && (
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">{t('worker.profile.phone')}</p>
                  <p className="font-medium text-foreground">{profile.phone}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Work Details */}
        {profile.workerProfile && (
          <>
            {/* Specialization */}
            <div className="card-elevated p-4 sm:p-5 md:p-6">
              <h3 className="font-bold font-heading text-foreground mb-4 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-primary" />
                {t('worker.profile.specialization')}
              </h3>
              {profile.workerProfile.specialization && profile.workerProfile.specialization.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.workerProfile.specialization.map((skill: string, index: number) => (
                    <span
                      key={index}
                      className="px-3 py-1.5 bg-accent text-foreground rounded-lg text-sm font-medium"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">{t('worker.profile.noSpecializations')}</p>
              )}
            </div>

            {/* Assigned Locations */}
            {profile.workerProfile.assignedApartments && profile.workerProfile.assignedApartments.length > 0 && (
              <div className="card-elevated p-4 sm:p-5 md:p-6">
                <h3 className="font-bold font-heading text-foreground mb-4 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  {t('worker.profile.assignedLocations')}
                </h3>
                <div className="space-y-3">
                  {profile.workerProfile.assignedApartments.map((apartment, index: number) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-accent rounded-lg">
                      <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium text-foreground">{apartment.apartmentName}</p>
                        {apartment.building && (
                          <p className="text-sm text-muted-foreground">{apartment.building}</p>
                        )}
                        <p className="text-sm text-muted-foreground">
                          {apartment.area}, {apartment.city}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Work Statistics */}
            <div className="card-elevated p-4 sm:p-5 md:p-6">
              <h3 className="font-bold font-heading text-foreground mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                {t('worker.profile.performance')}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-accent rounded-lg">
                  <p className="text-2xl font-bold text-foreground">{stats.today || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t('worker.tasks.today')}</p>
                </div>
                <div className="text-center p-4 bg-accent rounded-lg">
                  <p className="text-2xl font-bold text-foreground">{stats.thisWeek || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t('worker.tasks.thisWeek')}</p>
                </div>
                <div className="text-center p-4 bg-accent rounded-lg">
                  <p className="text-2xl font-bold text-foreground">{stats.thisMonth || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t('worker.tasks.thisMonth')}</p>
                </div>
              </div>
            </div>

            {/* Availability Status */}
            <div className="card-elevated p-4 sm:p-5 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-foreground mb-1">{t('worker.profile.availabilityStatus')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {profile.workerProfile.availability ? t('worker.profile.availableForBookings') : t('worker.profile.unavailableForBookings')}
                  </p>
                </div>
                <div className={`px-4 py-2 rounded-lg font-semibold ${
                  profile.workerProfile.availability
                    ? 'bg-success-light text-success'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {profile.workerProfile.availability ? t('worker.profile.active') : t('worker.profile.inactive')}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Account Information */}
        <div className="card-elevated p-4 sm:p-5 md:p-6">
          <h3 className="font-bold font-heading text-foreground mb-4">{t('worker.profile.accountInfo')}</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('worker.profile.accountStatus')}</span>
              <span className={`font-medium ${profile.isActive ? 'text-success' : 'text-destructive'}`}>
                {profile.isActive ? t('worker.profile.active') : t('worker.profile.inactive')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('worker.profile.emailVerified')}</span>
              <span className={`font-medium ${profile.isVerified ? 'text-success' : 'text-warning'}`}>
                {profile.isVerified ? t('common.verified') : t('worker.profile.notVerified')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('worker.profile.memberSince')}</span>
              <span className="font-medium text-foreground">
                {new Date(profile.createdAt).toLocaleDateString('en-IN', {
                  month: 'short',
                  year: 'numeric'
                })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default WorkerProfile;
