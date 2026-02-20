import AppLayout from "@/components/AppLayout";
import { authAPI } from "@/lib/api";
import { ChevronRight, Languages, MessageSquare, Save, Star, User } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Worker {
  _id: string;
  name: string;
  rating: number;
  specialization: string[];
}

interface Preferences {
  workerGenderPreference: string;
  preferredWorkers: string[];
  languagePreference: string;
  specialInstructions: string;
  serviceCustomizations: {
    [serviceId: string]: {
      instructions: string;
      preferences: string[];
    };
  };
}

const PreferencesPage = () => {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<Preferences>({
    workerGenderPreference: 'any',
    preferredWorkers: [],
    languagePreference: 'any',
    specialInstructions: '',
    serviceCustomizations: {}
  });
  const [availableWorkers, setAvailableWorkers] = useState<Worker[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const profileData = await authAPI.getProfile();
      setProfile(profileData.user || profileData);
      
      // Load existing preferences
      if (profileData.user?.preferences) {
        setPreferences({
          workerGenderPreference: profileData.user.preferences.workerGenderPreference || 'any',
          preferredWorkers: profileData.user.preferences.preferredWorkers || [],
          languagePreference: profileData.user.preferences.languagePreference || 'any',
          specialInstructions: profileData.user.preferences.specialInstructions || '',
          serviceCustomizations: profileData.user.preferences.serviceCustomizations || {}
        });
      }

      // Fetch available workers (mock data for now - replace with actual API)
      // In production, this would fetch workers from the backend
      setAvailableWorkers([]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePreferences = async () => {
    try {
      setSaving(true);
      
      await authAPI.updatePreferences(preferences);
      
      toast.success('Preferences saved successfully!');
    } catch (error: any) {
      console.error('Error saving preferences:', error);
      toast.error(error.message || 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const togglePreferredWorker = (workerId: string) => {
    setPreferences(prev => ({
      ...prev,
      preferredWorkers: prev.preferredWorkers.includes(workerId)
        ? prev.preferredWorkers.filter(id => id !== workerId)
        : [...prev.preferredWorkers, workerId]
    }));
  };

  if (loading) {
    return (
      <AppLayout userType="customer" userName={profile?.name || "Loading..."}>
        <div className="max-w-3xl mx-auto py-12 text-center">
          <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3"></div>
          <p className="text-sm text-muted-foreground">Loading preferences...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout userType="customer" userName={profile?.name || "Guest"}>
      <div className="max-w-3xl mx-auto space-y-6 pb-20 md:pb-0">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground mb-1">Service Preferences</h1>
          <p className="text-sm text-muted-foreground">
            Customize your service experience and worker preferences
          </p>
        </div>

        {/* Worker Gender Preference */}
        <div className="card-elevated p-6">
          <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Worker Gender Preference
          </h3>
          
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setPreferences({ ...preferences, workerGenderPreference: 'any' })}
              className={`p-4 border-2 rounded-xl transition-all ${
                preferences.workerGenderPreference === 'any'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="text-2xl mb-2">👥</div>
              <div className="font-semibold text-sm text-foreground">No Preference</div>
            </button>

            <button
              type="button"
              onClick={() => setPreferences({ ...preferences, workerGenderPreference: 'male' })}
              className={`p-4 border-2 rounded-xl transition-all ${
                preferences.workerGenderPreference === 'male'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="text-2xl mb-2">👨</div>
              <div className="font-semibold text-sm text-foreground">Male</div>
            </button>

            <button
              type="button"
              onClick={() => setPreferences({ ...preferences, workerGenderPreference: 'female' })}
              className={`p-4 border-2 rounded-xl transition-all ${
                preferences.workerGenderPreference === 'female'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="text-2xl mb-2">👩</div>
              <div className="font-semibold text-sm text-foreground">Female</div>
            </button>
          </div>

          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground">
              ℹ️ This preference will be applied to all future bookings. Subject to worker availability.
            </p>
          </div>
        </div>

        {/* Language Preference */}
        <div className="card-elevated p-6">
          <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
            <Languages className="w-5 h-5 text-primary" />
            Language Preference
          </h3>
          
          <select
            value={preferences.languagePreference}
            onChange={(e) => setPreferences({ ...preferences, languagePreference: e.target.value })}
            className="input-clean"
          >
            <option value="any">No Preference</option>
            <option value="english">English</option>
            <option value="hindi">Hindi</option>
            <option value="tamil">Tamil</option>
            <option value="telugu">Telugu</option>
            <option value="kannada">Kannada</option>
            <option value="malayalam">Malayalam</option>
            <option value="bengali">Bengali</option>
            <option value="marathi">Marathi</option>
            <option value="gujarati">Gujarati</option>
            <option value="urdu">Urdu</option>
          </select>

          <p className="text-xs text-muted-foreground mt-2">
            We'll try to assign workers who can communicate in your preferred language.
          </p>
        </div>

        {/* Preferred Workers */}
        <div className="card-elevated p-6">
          <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-primary" />
            Preferred Workers
          </h3>
          
          {availableWorkers.length > 0 ? (
            <div className="space-y-3">
              {availableWorkers.map((worker) => (
                <div
                  key={worker._id}
                  onClick={() => togglePreferredWorker(worker._id)}
                  className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                    preferences.preferredWorkers.includes(worker._id)
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center text-xl">
                        👤
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">{worker.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {worker.specialization.join(', ')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      <span className="font-medium text-foreground">{worker.rating}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">🔍</div>
              <p className="text-sm text-muted-foreground">
                No workers available yet. Complete your first booking to see workers!
              </p>
            </div>
          )}

          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground">
              ℹ️ Preferred workers will be prioritized for your bookings when available.
            </p>
          </div>
        </div>

        {/* Special Instructions */}
        <div className="card-elevated p-6">
          <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Default Special Instructions
          </h3>
          
          <textarea
            value={preferences.specialInstructions}
            onChange={(e) => setPreferences({ ...preferences, specialInstructions: e.target.value.slice(0, 500) })}
            placeholder="Add any default instructions that apply to all your bookings (e.g., gate code, parking instructions, pet information)..."
            className="input-clean resize-none"
            rows={6}
            maxLength={500}
          />
          
          <div className="flex justify-between items-center mt-2">
            <p className="text-xs text-muted-foreground">
              These instructions will be included in all your bookings by default.
            </p>
            <div className="text-xs text-muted-foreground">
              {preferences.specialInstructions.length}/500
            </div>
          </div>
        </div>

        {/* Service-Specific Customizations */}
        <div className="card-elevated p-6">
          <h3 className="font-bold text-foreground mb-4">Service-Specific Preferences</h3>
          
          <p className="text-sm text-muted-foreground mb-4">
            Customize preferences for individual services
          </p>

          <button
            type="button"
            className="w-full p-4 border-2 border-dashed border-border hover:border-primary/50 rounded-xl transition-colors flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <span className="text-sm font-medium">Add Service Customization</span>
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground">
              ℹ️ Service-specific preferences will override your default preferences for those services.
            </p>
          </div>
        </div>

        {/* Save Button */}
        <div className="sticky bottom-20 md:bottom-0 z-10">
          <button
            onClick={handleSavePreferences}
            disabled={saving}
            className="w-full btn-brand py-4 flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>

        {/* Info Section */}
        <div className="card-elevated p-6 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
          <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">How Preferences Work</h4>
          <ul className="space-y-2 text-sm text-blue-700 dark:text-blue-300">
            <li className="flex gap-2">
              <span>•</span>
              <span>Your preferences are automatically applied to new bookings</span>
            </li>
            <li className="flex gap-2">
              <span>•</span>
              <span>You can override preferences for individual bookings</span>
            </li>
            <li className="flex gap-2">
              <span>•</span>
              <span>Worker assignment is subject to availability and proximity</span>
            </li>
            <li className="flex gap-2">
              <span>•</span>
              <span>Special instructions help workers provide better service</span>
            </li>
          </ul>
        </div>
      </div>
    </AppLayout>
  );
};

export default PreferencesPage;
