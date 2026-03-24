import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { API_BASE_URL } from "@/lib/api";
import { Briefcase, Languages, Mail, Phone, Sparkles, Star, User } from "lucide-react";

type WorkerPreviewProfile = {
  specialization?: string[] | string;
  experience?: number;
  languages?: string[];
  rating?: number;
  totalReviews?: number;
  availability?: boolean;
  completedBookings?: number;
  completedJobs?: number;
  totalJobsCompleted?: number;
};

export interface WorkerPreviewData {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  profileImage?: string;
  gender?: string;
  religion?: string;
  workerProfile?: WorkerPreviewProfile;
}

interface WorkerProfilePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  worker: WorkerPreviewData | null;
}

const resolveAssetUrl = (value?: string | null) => {
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return `${API_BASE_URL.replace('/api', '')}${value}`;
};

const normalizeArray = (value?: string[] | string) => {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  return [];
};

const WorkerProfilePreviewDialog = ({ open, onOpenChange, worker }: WorkerProfilePreviewDialogProps) => {
  const profileImageUrl = resolveAssetUrl(worker?.profileImage);
  const specialization = normalizeArray(worker?.workerProfile?.specialization);
  const languages = normalizeArray(worker?.workerProfile?.languages);
  const rating = worker?.workerProfile?.rating ?? 0;
  const totalReviews = worker?.workerProfile?.totalReviews ?? 0;
  const jobsCompleted = worker?.workerProfile?.totalJobsCompleted
    ?? worker?.workerProfile?.completedJobs
    ?? worker?.workerProfile?.completedBookings
    ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Worker profile</DialogTitle>
          <DialogDescription>
            View the assigned worker’s public profile details before you book or while tracking your service.
          </DialogDescription>
        </DialogHeader>

        {!worker ? null : (
          <div className="space-y-5">
            <div className="flex flex-col gap-4 rounded-2xl border border-border bg-muted/30 p-4 sm:flex-row sm:items-center">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-border bg-primary/10 text-primary">
                {profileImageUrl ? (
                  <img src={profileImageUrl} alt={worker.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold">
                    {worker.name
                      .split(" ")
                      .filter(Boolean)
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase() || <User className="h-8 w-8" />}
                  </span>
                )}
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-semibold text-foreground">{worker.name}</h3>
                  {worker.workerProfile?.availability && (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      Available now
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 text-sm">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-700">
                    <Star className="h-4 w-4 fill-current" />
                    {rating > 0 ? rating.toFixed(1) : "New"}
                    {totalReviews > 0 ? ` · ${totalReviews} review${totalReviews !== 1 ? 's' : ''}` : ''}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700">
                    <Briefcase className="h-4 w-4" />
                    {jobsCompleted} job{jobsCompleted !== 1 ? 's' : ''} completed
                  </span>
                  {worker.workerProfile?.experience ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-3 py-1 font-medium text-purple-700">
                      <Sparkles className="h-4 w-4" />
                      {worker.workerProfile.experience} year{worker.workerProfile.experience !== 1 ? 's' : ''} experience
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-4 rounded-2xl border border-border p-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Skills</p>
                  {specialization.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {specialization.map((item) => (
                        <span key={item} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">No specializations added yet.</p>
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Languages</p>
                  {languages.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {languages.map((item) => (
                        <span key={item} className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                          <Languages className="h-3.5 w-3.5" />
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">Language preferences are not listed.</p>
                  )}
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-border p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact & details</p>

                {worker.email ? (
                  <a
                    href={`mailto:${worker.email}`}
                    className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2 text-sm hover:bg-muted"
                  >
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4" /> Email
                    </span>
                    <span className="font-medium text-foreground break-all text-right">{worker.email}</span>
                  </a>
                ) : null}

                {worker.phone ? (
                  <a
                    href={`tel:${worker.phone}`}
                    className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2 text-sm hover:bg-muted"
                  >
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" /> Phone
                    </span>
                    <span className="font-medium text-foreground">{worker.phone}</span>
                  </a>
                ) : null}

                {worker.gender ? (
                  <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2 text-sm">
                    <span className="text-muted-foreground">Gender</span>
                    <span className="font-medium text-foreground capitalize">{worker.gender.replace(/_/g, ' ')}</span>
                  </div>
                ) : null}

                {worker.religion ? (
                  <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2 text-sm">
                    <span className="text-muted-foreground">Religion</span>
                    <span className="font-medium text-foreground capitalize">{worker.religion}</span>
                  </div>
                ) : null}

                {!worker.email && !worker.phone && !worker.gender && !worker.religion ? (
                  <p className="text-sm text-muted-foreground">This worker has not shared extra public details yet.</p>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default WorkerProfilePreviewDialog;