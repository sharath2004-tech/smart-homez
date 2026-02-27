import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useGeolocation } from "@/hooks/useGeolocation";
import { preferencesAPI } from "@/lib/api";
import {
    AlertCircle,
    Check,
    Heart,
    Search,
    Shield,
    Star,
    Trash2,
    UserCheck,
    UserMinus,
    UserPlus,
    X
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface Worker {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  workerProfile?: {
    rating: number;
    specialization: string[];
    experienceYears: number;
    languages?: string[];
    gender?: string;
    availabilityStatus: string;
    totalJobsCompleted: number;
  };
}

interface ExceptionWorker {
  workerId: {
    _id: string;
    name: string;
    workerProfile?: {
      rating: number;
      specialization: string[];
    };
  };
  reason?: string;
  addedBy: string;
  addedAt: string;
}

interface Preferences {
  workerGenderPreference?: string;
  preferredWorkerP1?: Worker | null;
  preferredWorkerP2?: Worker | null;
  preferredWorkerP3?: Worker | null;
  languagePreference?: string;
  religionPreference?: string;
  specialInstructions?: string;
  exceptionWorkers?: ExceptionWorker[];
}

const PreferencesPage = () => {
  const [preferences, setPreferences] = useState<Preferences>({});
  const [availableWorkers, setAvailableWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showWorkerDialog, setShowWorkerDialog] = useState(false);
  const [selectedPreferenceSlot, setSelectedPreferenceSlot] = useState<'P1' | 'P2' | 'P3' | null>(null);
  const [showExceptionDialog, setShowExceptionDialog] = useState(false);
  const [exceptionReason, setExceptionReason] = useState('');
  const [selectedWorkerForException, setSelectedWorkerForException] = useState<string | null>(null);
  
  const { latitude, longitude } = useGeolocation();
  const { toast } = useToast();

  const fetchPreferences = useCallback(async () => {
    try {
      setLoading(true);
      const data = await preferencesAPI.getPreferences();
      setPreferences(data.preferences || {});
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Error fetching preferences:', error);
      toast({
        title: "Error",
        description: err.message || "Failed to load preferences",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchAvailableWorkers = useCallback(async () => {
    try {
      const data = await preferencesAPI.getAvailableWorkers({
        latitude,
        longitude,
        radius: 5000 // 5km
      });
      setAvailableWorkers(data.workers || []);
    } catch (error) {
      console.error('Error fetching workers:', error);
    }
  }, [latitude, longitude]);
  
  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  useEffect(() => {
    if (latitude && longitude) {
      fetchAvailableWorkers();
    }
  }, [latitude, longitude, fetchAvailableWorkers]);

  const handleSavePreferences = async () => {
    try {
      setSaving(true);
      await preferencesAPI.updatePreferences({
        workerGenderPreference: (preferences.workerGenderPreference || 'any') as 'any' | 'male' | 'female',
        preferredWorkerP1: preferences.preferredWorkerP1?._id,
        preferredWorkerP2: preferences.preferredWorkerP2?._id,
        preferredWorkerP3: preferences.preferredWorkerP3?._id,
        languagePreference: preferences.languagePreference,
        religionPreference: preferences.religionPreference,
        specialInstructions: preferences.specialInstructions,
      });
      
      toast({
        title: "Success",
        description: "Your preferences have been saved",
      });
      
      await fetchPreferences();
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Error saving preferences:', error);
      toast({
        title: "Error",
        description: err.message || "Failed to save preferences",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddException = async (workerId: string, reason: string) => {
    try {
      await preferencesAPI.addException(workerId, reason);
      toast({
        title: "Success",
        description: "Worker added to exception list",
      });
      await fetchPreferences();
      setShowExceptionDialog(false);
      setExceptionReason('');
      setSelectedWorkerForException(null);
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Error adding exception:', error);
      toast({
        title: "Error",
        description: err.message || "Failed to add exception",
        variant: "destructive"
      });
    }
  };

  const handleRemoveException = async (workerId: string) => {
    if (!confirm('Remove this worker from exception list?')) return;
    
    try {
      await preferencesAPI.removeException(workerId);
      toast({
        title: "Success",
        description: "Worker removed from exception list",
      });
      await fetchPreferences();
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Error removing exception:', error);
      toast({
        title: "Error",
        description: err.message || "Failed to remove exception",
        variant: "destructive"
      });
    }
  };

  const handleSelectWorkerForPreference = (worker: Worker) => {
    if (!selectedPreferenceSlot) return;
    
    setPreferences(prev => ({
      ...prev,
      [`preferredWorker${selectedPreferenceSlot}`]: worker
    }));
    
    setShowWorkerDialog(false);
    setSelectedPreferenceSlot(null);
  };

  const handleRemovePreference = (slot: 'P1' | 'P2' | 'P3') => {
    setPreferences(prev => ({
      ...prev,
      [`preferredWorker${slot}`]: null
    }));
  };

  const openWorkerSelection = (slot: 'P1' | 'P2' | 'P3') => {
    setSelectedPreferenceSlot(slot);
    setShowWorkerDialog(true);
  };

  const openAddException = (workerId: string) => {
    setSelectedWorkerForException(workerId);
    setShowExceptionDialog(true);
  };

  const filteredWorkers = availableWorkers.filter(worker => {
    const matchesSearch = worker.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         worker.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesGender = !preferences.workerGenderPreference || 
                         preferences.workerGenderPreference === 'any' ||
                         worker.workerProfile?.gender?.toLowerCase() === preferences.workerGenderPreference.toLowerCase();
    
    const isNotInPreferences = worker._id !== preferences.preferredWorkerP1?._id &&
                               worker._id !== preferences.preferredWorkerP2?._id &&
                               worker._id !== preferences.preferredWorkerP3?._id;
    
    const isNotInExceptions = !preferences.exceptionWorkers?.some(
      ex => ex.workerId._id === worker._id
    );
    
    return matchesSearch && matchesGender && isNotInPreferences && isNotInExceptions;
  });

  const WorkerCard = ({ worker, onSelect, onAddException }: { 
    worker: Worker; 
    onSelect?: () => void;
    onAddException?: () => void;
  }) => (
    <Card className="p-4 hover:border-primary transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{worker.name}</h3>
            {worker.workerProfile?.rating && (
              <div className="flex items-center gap-1 text-sm text-yellow-600">
                <Star className="h-4 w-4 fill-yellow-600" />
                <span>{worker.workerProfile.rating.toFixed(1)}</span>
              </div>
            )}
          </div>
          
          {worker.workerProfile?.specialization && worker.workerProfile.specialization.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {worker.workerProfile.specialization.slice(0, 3).map((spec, idx) => (
                <span key={idx} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                  {spec}
                </span>
              ))}
            </div>
          )}
          
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            {worker.workerProfile?.experienceYears && (
              <span>{worker.workerProfile.experienceYears}y exp</span>
            )}
            {worker.workerProfile?.totalJobsCompleted !== undefined && (
              <span>{worker.workerProfile.totalJobsCompleted} jobs</span>
            )}
            {worker.workerProfile?.gender && (
              <span className="capitalize">{worker.workerProfile.gender}</span>
            )}
          </div>
        </div>
        
        <div className="flex flex-col gap-2">
          {onSelect && (
            <Button size="sm" onClick={onSelect}>
              <UserPlus className="h-4 w-4 mr-1" />
              Select
            </Button>
          )}
          {onAddException && (
            <Button size="sm" variant="outline" onClick={onAddException}>
              <UserMinus className="h-4 w-4 mr-1" />
              Block
            </Button>
          )}
        </div>
      </div>
    </Card>
  );

  const PreferenceSlot = ({ 
    label, 
    priority, 
    worker, 
    onAdd, 
    onRemove 
  }: { 
    label: string; 
    priority: 'P1' | 'P2' | 'P3'; 
    worker?: Worker | null;
    onAdd: () => void;
    onRemove: () => void;
  }) => (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`
            w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
            ${priority === 'P1' ? 'bg-yellow-500 text-white' : ''}
            ${priority === 'P2' ? 'bg-blue-500 text-white' : ''}
            ${priority === 'P3' ? 'bg-green-500 text-white' : ''}
          `}>
            {priority}
          </div>
          <h3 className="font-semibold">{label}</h3>
        </div>
        
        {priority === 'P1' && (
          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
            First Choice
          </span>
        )}
      </div>
      
      {worker ? (
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium">{worker.name}</p>
                {worker.workerProfile?.rating && (
                  <div className="flex items-center gap-1 text-sm text-yellow-600">
                    <Star className="h-3 w-3 fill-yellow-600" />
                    <span>{worker.workerProfile.rating.toFixed(1)}</span>
                  </div>
                )}
              </div>
              
              {worker.workerProfile?.specialization && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {worker.workerProfile.specialization.slice(0, 2).map((spec, idx) => (
                    <span key={idx} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                      {spec}
                    </span>
                  ))}
                </div>
              )}
            </div>
            
            <Button size="sm" variant="ghost" onClick={onRemove}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" className="w-full" onClick={onAdd}>
          <UserPlus className="h-4 w-4 mr-2" />
          Add Worker
        </Button>
      )}
    </Card>
  );

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6 p-4 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Worker Preferences</h1>
            <p className="text-muted-foreground mt-1">
              Set your preferred workers and manage your preferences
            </p>
          </div>
          
          <Button onClick={handleSavePreferences} disabled={saving}>
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>

        {/* Info Card */}
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">How Preferences Work</p>
              <ul className="space-y-1 list-disc list-inside">
                <li><strong>P1 (Priority 1)</strong>: Your first choice worker</li>
                <li><strong>P2 (Priority 2)</strong>: Backup if P1 is unavailable</li>
                <li><strong>P3 (Priority 3)</strong>: Second backup option</li>
                <li><strong>Exception List</strong>: Workers who will never be assigned to you</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Preferred Workers Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Preferred Workers</h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-4">
            <PreferenceSlot
              label="Priority 1"
              priority="P1"
              worker={preferences.preferredWorkerP1}
              onAdd={() => openWorkerSelection('P1')}
              onRemove={() => handleRemovePreference('P1')}
            />
            
            <PreferenceSlot
              label="Priority 2"
              priority="P2"
              worker={preferences.preferredWorkerP2}
              onAdd={() => openWorkerSelection('P2')}
              onRemove={() => handleRemovePreference('P2')}
            />
            
            <PreferenceSlot
              label="Priority 3"
              priority="P3"
              worker={preferences.preferredWorkerP3}
              onAdd={() => openWorkerSelection('P3')}
              onRemove={() => handleRemovePreference('P3')}
            />
          </div>
        </div>

        {/* Exception List */}
        {preferences.exceptionWorkers && preferences.exceptionWorkers.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-red-600" />
              <h2 className="text-xl font-semibold">Exception List</h2>
              <span className="text-sm text-muted-foreground">
                ({preferences.exceptionWorkers.length} blocked)
              </span>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              {preferences.exceptionWorkers.map((exception) => (
                <Card key={exception.workerId._id} className="p-4 border-red-200 bg-red-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{exception.workerId.name}</h3>
                        {exception.workerId.workerProfile?.rating && (
                          <div className="flex items-center gap-1 text-sm text-yellow-600">
                            <Star className="h-3 w-3 fill-yellow-600" />
                            <span>{exception.workerId.workerProfile.rating.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                      
                      {exception.reason && (
                        <p className="text-sm text-muted-foreground mt-1">{exception.reason}</p>
                      )}
                      
                      <p className="text-xs text-muted-foreground mt-2">
                        Added by {exception.addedBy} on {new Date(exception.addedAt).toLocaleDateString()}
                      </p>
                    </div>
                    
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => handleRemoveException(exception.workerId._id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* General Preferences */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">General Preferences</h2>
          </div>
          
          <Card className="p-6 space-y-6">
            {/* Gender Preference */}
            <div className="space-y-3">
              <Label>Worker Gender Preference</Label>
              <RadioGroup 
                value={preferences.workerGenderPreference || 'any'}
                onValueChange={(value) => setPreferences(prev => ({ ...prev, workerGenderPreference: value }))}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="any" id="any" />
                  <Label htmlFor="any" className="cursor-pointer">Any Gender</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="male" id="male" />
                  <Label htmlFor="male" className="cursor-pointer">Male Only</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="female" id="female" />
                  <Label htmlFor="female" className="cursor-pointer">Female Only</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Language Preference */}
            <div className="space-y-3">
              <Label htmlFor="language">Preferred Language</Label>
              <Select 
                value={preferences.languagePreference || ''}
                onValueChange={(value) => setPreferences(prev => ({ ...prev, languagePreference: value }))}
              >
                <SelectTrigger id="language">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="english">English</SelectItem>
                  <SelectItem value="hindi">Hindi</SelectItem>
                  <SelectItem value="marathi">Marathi</SelectItem>
                  <SelectItem value="tamil">Tamil</SelectItem>
                  <SelectItem value="telugu">Telugu</SelectItem>
                  <SelectItem value="kannada">Kannada</SelectItem>
                  <SelectItem value="bengali">Bengali</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Religion Preference */}
            <div className="space-y-3">
              <Label htmlFor="religion">Religion Preference (Optional)</Label>
              <Select 
                value={preferences.religionPreference || ''}
                onValueChange={(value) => setPreferences(prev => ({ ...prev, religionPreference: value }))}
              >
                <SelectTrigger id="religion">
                  <SelectValue placeholder="Select religion preference" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">No Preference</SelectItem>
                  <SelectItem value="hindu">Hindu</SelectItem>
                  <SelectItem value="muslim">Muslim</SelectItem>
                  <SelectItem value="christian">Christian</SelectItem>
                  <SelectItem value="sikh">Sikh</SelectItem>
                  <SelectItem value="buddhist">Buddhist</SelectItem>
                  <SelectItem value="jain">Jain</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Special Instructions */}
            <div className="space-y-3">
              <Label htmlFor="instructions">Special Instructions</Label>
              <Textarea
                id="instructions"
                placeholder="Any special requirements or instructions for workers (max 500 characters)"
                value={preferences.specialInstructions || ''}
                onChange={(e) => setPreferences(prev => ({ ...prev, specialInstructions: e.target.value }))}
                maxLength={500}
                rows={4}
              />
              <p className="text-xs text-muted-foreground text-right">
                {(preferences.specialInstructions || '').length}/500 characters
              </p>
            </div>
          </Card>
        </div>

        {/* Save Button (Bottom) */}
        <div className="flex justify-end">
          <Button onClick={handleSavePreferences} disabled={saving} size="lg">
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Check className="h-5 w-5 mr-2" />
                Save All Preferences
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Worker Selection Dialog */}
      <Dialog open={showWorkerDialog} onOpenChange={setShowWorkerDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Worker for {selectedPreferenceSlot}</DialogTitle>
            <DialogDescription>
              Choose a worker to add to your preferences. They will be assigned when available.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search workers by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Workers List */}
            {filteredWorkers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No workers available</p>
                <p className="text-sm mt-1">Try adjusting your search or filters</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredWorkers.map(worker => (
                  <WorkerCard
                    key={worker._id}
                    worker={worker}
                    onSelect={() => handleSelectWorkerForPreference(worker)}
                    onAddException={() => {
                      setShowWorkerDialog(false);
                      openAddException(worker._id);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Exception Dialog */}
      <Dialog open={showExceptionDialog} onOpenChange={setShowExceptionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Exception List</DialogTitle>
            <DialogDescription>
              This worker will never be assigned to your bookings. Please provide a reason.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (Optional but recommended)</Label>
              <Textarea
                id="reason"
                placeholder="e.g., Poor service quality, unprofessional behavior, etc."
                value={exceptionReason}
                onChange={(e) => setExceptionReason(e.target.value)}
                rows={3}
              />
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowExceptionDialog(false);
                  setExceptionReason('');
                  setSelectedWorkerForException(null);
                }}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={() => {
                  if (selectedWorkerForException) {
                    handleAddException(selectedWorkerForException, exceptionReason);
                  }
                }}
              >
                <UserMinus className="h-4 w-4 mr-2" />
                Block Worker
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default PreferencesPage;
