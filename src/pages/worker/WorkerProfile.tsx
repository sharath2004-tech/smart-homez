import AppLayout from "@/components/AppLayout";
import { ImageCropDialog } from "@/components/ImageCropDialog";
import { API_ORIGIN, authAPI, workersAPI } from "@/lib/api";
import { Briefcase, Camera, CheckCircle, Clock, Download, FileText, Loader2, Mail, MapPin, Phone, Star, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

interface Profile {
  name: string;
  email: string;
  role: string;
  profileImage?: string;
  phone?: string;
  isActive?: boolean;
  isVerified?: boolean;
  workerProfile?: {
    rating: number;
    specialization: string[];
    totalJobsCompleted?: number;
    wageType?: 'hourly' | 'daily' | 'monthly';
    hourlyRate?: number;
    dailyWage?: number;
    monthlyWage?: number;
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

interface WorkerDocuments {
  profileImage?: string;
  aadhaarFront?: string;
  aadhaarBack?: string;
  aadhaarNumber?: string;
  uploadedAt?: string;
}

const resolveAssetUrl = (value?: string | null) => {
  if (!value) {
    return null;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return `${API_ORIGIN}${value}`;
};

const getWorkerPayLabel = (workerProfile?: Profile['workerProfile']) => {
  if (!workerProfile) return 'Not set yet';
  if (workerProfile.wageType === 'daily' && workerProfile.dailyWage) return `Daily · ₹${workerProfile.dailyWage}/day`;
  if (workerProfile.wageType === 'monthly' && workerProfile.monthlyWage) return `Monthly · ₹${workerProfile.monthlyWage}/month`;
  if (workerProfile.hourlyRate) return `Hourly · ₹${workerProfile.hourlyRate}/hr`;
  return 'Hourly · Rate pending';
};

const WorkerProfile = () => {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [documents, setDocuments] = useState<WorkerDocuments | null>(null);
  const [stats, setStats] = useState({ today: 0, thisWeek: 0, thisMonth: 0 });
  const [loading, setLoading] = useState(true);
  const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(null);
  const [pendingProfilePicture, setPendingProfilePicture] = useState<File | null>(null);
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [uploadingProfilePhoto, setUploadingProfilePhoto] = useState(false);
  const profilePictureInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    return () => {
      if (profilePicturePreview) {
        URL.revokeObjectURL(profilePicturePreview);
      }
    };
  }, [profilePicturePreview]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const [profileData, statsData, documentsData] = await Promise.all([
        authAPI.getProfile(),
        workersAPI.getDashboardStats(),
        workersAPI.getDocuments()
      ]);

      setProfile(profileData.user || profileData);
      setStats(statsData.stats || { today: 0, thisWeek: 0, thisMonth: 0 });
      setDocuments(documentsData.documents || null);
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
  const profileImageUrl = resolveAssetUrl(profile.profileImage) || resolveAssetUrl(documents?.profileImage);
  const displayProfileImageUrl = profilePicturePreview || profileImageUrl;

  const handleProfilePictureSelection = (file: File | null) => {
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please choose a JPG, PNG, or WEBP image.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Profile photo should be 5MB or smaller.');
      return;
    }

    setPendingProfilePicture(file);
    setShowCropDialog(true);
  };

  const handleProfilePictureUpload = async (file: File) => {
    if (profilePicturePreview?.startsWith('blob:')) {
      URL.revokeObjectURL(profilePicturePreview);
    }

    const previewUrl = URL.createObjectURL(file);
    setProfilePicturePreview(previewUrl);
    setUploadingProfilePhoto(true);

    try {
      const payload = new FormData();
      payload.append('profilePicture', file);

      const result = await authAPI.updateProfile(payload);
      const updatedUser = result?.user;

      if (updatedUser) {
        setProfile((prev) => prev ? { ...prev, ...updatedUser } : updatedUser);
        setDocuments((prev) => ({
          ...(prev || {}),
          profileImage: updatedUser.profileImage || prev?.profileImage,
          uploadedAt: new Date().toISOString(),
        }));
      }

      try {
        const stored = JSON.parse(localStorage.getItem('user') || '{}');
        localStorage.setItem('user', JSON.stringify({
          ...stored,
          name: updatedUser?.name || profile.name,
          email: updatedUser?.email || profile.email,
          profileImage: updatedUser?.profileImage || stored?.profileImage || null,
        }));
      } catch {
        // Ignore localStorage sync issues
      }

      toast.success('Profile picture updated. Looking sharp ✨');
      setProfilePicturePreview(null);
      setPendingProfilePicture(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update profile picture');
      setProfilePicturePreview(null);
    } finally {
      setUploadingProfilePhoto(false);
      if (profilePictureInputRef.current) {
        profilePictureInputRef.current.value = '';
      }
    }
  };

  const handleCropCancel = () => {
    setPendingProfilePicture(null);
    setShowCropDialog(false);
    if (profilePictureInputRef.current) {
      profilePictureInputRef.current.value = '';
    }
  };

  const handleCropConfirm = async (file: File, previewUrl: string) => {
    setShowCropDialog(false);
    setPendingProfilePicture(null);
    if (profilePicturePreview?.startsWith('blob:')) {
      URL.revokeObjectURL(profilePicturePreview);
    }
    setProfilePicturePreview(previewUrl);
    await handleProfilePictureUpload(file);
  };

  return (
    <AppLayout userType="worker" userName={profile.name} userImage={profile.profileImage || documents?.profileImage || null}>
      <div className="max-w-2xl mx-auto px-3 sm:px-4 md:px-6 space-y-6 animate-fade-in pb-20 md:pb-0">
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground mb-1">{t('worker.profile.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('worker.profile.subtitle')}</p>
        </div>

        {/* Profile Header Card */}
        <div className="card-elevated p-4 sm:p-5 md:p-6">
          <div className="flex items-start gap-5">
            <div className="relative shrink-0 group">
              <input
                ref={profilePictureInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="hidden"
                onChange={(e) => handleProfilePictureSelection(e.target.files?.[0] || null)}
              />
              {displayProfileImageUrl ? (
                <img
                  src={displayProfileImageUrl}
                  alt={profile.name}
                  className="w-24 h-24 rounded-full object-cover border-4 border-primary/15 shadow-sm"
                />
              ) : (
                <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-2xl font-bold border-4 border-primary/15 shadow-sm">
                  {initials}
                </div>
              )}
              <button
                type="button"
                onClick={() => !uploadingProfilePhoto && profilePictureInputRef.current?.click()}
                className="absolute bottom-0 right-0 h-9 w-9 rounded-full bg-card border border-border shadow-md flex items-center justify-center text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                aria-label="Change profile picture"
                title="Change profile picture"
              >
                {uploadingProfilePhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold font-heading text-foreground mb-1">{profile.name}</h2>
              <div className="mb-2 text-xs text-muted-foreground">
                Tap the camera button to add or change your profile photo.
              </div>
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

            <div className="card-elevated p-4 sm:p-5 md:p-6 border-primary/20 bg-primary/5">
              <h3 className="font-bold font-heading text-foreground mb-2 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-primary" />
                Approved pay type
              </h3>
              <p className="text-lg font-bold text-foreground">{getWorkerPayLabel(profile.workerProfile)}</p>
              <p className="text-sm text-muted-foreground mt-1">This is the payment structure approved for your account.</p>
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

        {/* Documents Section */}
        {documents && (
          <div className="card-elevated p-4 sm:p-5 md:p-6">
            <h3 className="font-bold font-heading text-foreground mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              {t('worker.profile.documents', 'My Documents')}
            </h3>
            <div className="space-y-4">
              {/* Profile Picture */}
              {documents.profileImage && (
                <div className="flex items-start gap-3 p-3 bg-accent rounded-lg">
                  <FileText className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-foreground mb-1">Profile Picture</p>
                    <img 
                      src={resolveAssetUrl(documents.profileImage) || undefined}
                      alt="Profile"
                      className="w-32 h-32 object-cover rounded-lg mb-2"
                    />
                    <a
                      href={resolveAssetUrl(documents.profileImage) || undefined}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </a>
                  </div>
                </div>
              )}

              {/* Aadhaar Front */}
              {documents.aadhaarFront && (
                <div className="flex items-start gap-3 p-3 bg-accent rounded-lg">
                  <FileText className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-foreground mb-1">Aadhaar Card (Front)</p>
                    {documents.aadhaarNumber && (
                      <p className="text-sm text-muted-foreground mb-2">
                        Number: {documents.aadhaarNumber}
                      </p>
                    )}
                    <img 
                      src={resolveAssetUrl(documents.aadhaarFront) || undefined}
                      alt="Aadhaar Front"
                      className="w-full max-w-md h-auto object-contain rounded-lg mb-2"
                    />
                    <a
                      href={resolveAssetUrl(documents.aadhaarFront) || undefined}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </a>
                  </div>
                </div>
              )}

              {/* Aadhaar Back */}
              {documents.aadhaarBack && (
                <div className="flex items-start gap-3 p-3 bg-accent rounded-lg">
                  <FileText className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-foreground mb-1">Aadhaar Card (Back)</p>
                    <img 
                      src={resolveAssetUrl(documents.aadhaarBack) || undefined}
                      alt="Aadhaar Back"
                      className="w-full max-w-md h-auto object-contain rounded-lg mb-2"
                    />
                    <a
                      href={resolveAssetUrl(documents.aadhaarBack) || undefined}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </a>
                  </div>
                </div>
              )}

              {documents.uploadedAt && (
                <p className="text-xs text-muted-foreground text-center">
                  Last updated: {new Date(documents.uploadedAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </p>
              )}

              {!documents.profileImage && !documents.aadhaarFront && !documents.aadhaarBack && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No documents uploaded yet. Use the camera button above to upload your profile picture, or contact your admin for ID documents.
                </p>
              )}
            </div>
          </div>
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

        <ImageCropDialog
          open={showCropDialog}
          imageFile={pendingProfilePicture}
          onClose={handleCropCancel}
          onConfirm={handleCropConfirm}
          title="Crop profile photo"
          description="Crop and resize your photo before saving it to your worker profile."
        />
      </div>
    </AppLayout>
  );
};

export default WorkerProfile;
