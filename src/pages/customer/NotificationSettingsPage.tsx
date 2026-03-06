import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Bell, Check, MessageCircle, MessageSquare, X } from "lucide-react";
import { useEffect, useState } from "react";

interface NotificationPreferences {
  inApp?: {
    enabled: boolean;
  };
  whatsapp?: {
    enabled: boolean;
    consentDate?: string;
  };
  sms?: {
    enabled: boolean;
    consentDate?: string;
  };
  notifyOnWorkerAssignment?: boolean;
  notifyOnScheduleChange?: boolean;
  notifyOnWorkerReassignment?: boolean;
  notifyOnDelay?: boolean;
  notifyOnCancellation?: boolean;
}

const NotificationSettingsPage = () => {
  const [preferences, setPreferences] = useState<NotificationPreferences>({});
  const [contactInfo, setContactInfo] = useState({ phone: '', email: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/notification-preferences`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPreferences(data.preferences || {});
        setContactInfo(data.contactInfo || {});
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
      showMessage('error', 'Failed to load notification preferences');
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/notification-preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(preferences)
      });

      if (response.ok) {
        showMessage('success', 'Notification preferences saved successfully');
        await fetchPreferences();
      } else {
        throw new Error('Failed to save preferences');
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      showMessage('error', 'Failed to save notification preferences');
    } finally {
      setSaving(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const toggleChannel = (channel: 'inApp' | 'whatsapp' | 'sms', enabled: boolean) => {
    setPreferences(prev => ({
      ...prev,
      [channel]: {
        ...prev[channel],
        enabled
      }
    }));
  };

  const toggleNotificationType = (type: string, enabled: boolean) => {
    setPreferences(prev => ({
      ...prev,
      [type]: enabled
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading notification settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bell className="w-8 h-8 text-primary" />
            Notification Settings
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage how you receive notifications about your bookings
          </p>
        </div>

        {/* Success/Error Message */}
        {message && (
          <Alert variant={message.type === 'success' ? 'default' : 'destructive'}>
            {message.type === 'success' ? (
              <Check className="h-4 w-4" />
            ) : (
              <X className="h-4 w-4" />
            )}
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
            <CardDescription>
              Ensure your contact details are up to date to receive notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-sm text-muted-foreground">Phone</Label>
              <p className="font-medium">{contactInfo.phone || 'Not provided'}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Email</Label>
              <p className="font-medium">{contactInfo.email || 'Not provided'}</p>
            </div>
          </CardContent>
        </Card>

        {/* Notification Channels */}
        <Card>
          <CardHeader>
            <CardTitle>Notification Channels</CardTitle>
            <CardDescription>
              Choose how you want to receive notifications. WhatsApp is most cost-effective and instant.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* In-App Notifications */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-primary" />
                <div>
                  <Label htmlFor="in-app" className="font-medium">In-App Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications within the app
                  </p>
                </div>
              </div>
              <Switch
                id="in-app"
                checked={preferences.inApp?.enabled !== false}
                onCheckedChange={(checked) => toggleChannel('inApp', checked)}
              />
            </div>

            {/* WhatsApp Notifications */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MessageCircle className="w-5 h-5 text-green-500" />
                <div>
                  <Label htmlFor="whatsapp" className="font-medium">WhatsApp Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Get instant updates via WhatsApp (Recommended)
                  </p>
                  {preferences.whatsapp?.enabled && preferences.whatsapp?.consentDate && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Enabled since {new Date(preferences.whatsapp.consentDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
              <Switch
                id="whatsapp"
                checked={preferences.whatsapp?.enabled || false}
                onCheckedChange={(checked) => toggleChannel('whatsapp', checked)}
                disabled={!contactInfo.phone}
              />
            </div>

            {/* SMS Notifications */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5 text-blue-500" />
                <div>
                  <Label htmlFor="sms" className="font-medium">SMS Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive updates via text message
                  </p>
                  {preferences.sms?.enabled && preferences.sms?.consentDate && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Enabled since {new Date(preferences.sms.consentDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
              <Switch
                id="sms"
                checked={preferences.sms?.enabled || false}
                onCheckedChange={(checked) => toggleChannel('sms', checked)}
                disabled={!contactInfo.phone}
              />
            </div>

            {!contactInfo.phone && (
              <Alert>
                <AlertDescription>
                  Add your phone number in your profile to enable WhatsApp and SMS notifications.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Notification Types */}
        <Card>
          <CardHeader>
            <CardTitle>What to Notify</CardTitle>
            <CardDescription>
              Choose which events you want to be notified about
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="worker-assignment" className="font-medium">Worker Assignment</Label>
                <p className="text-sm text-muted-foreground">When a worker is assigned to your booking</p>
              </div>
              <Switch
                id="worker-assignment"
                checked={preferences.notifyOnWorkerAssignment !== false}
                onCheckedChange={(checked) => toggleNotificationType('notifyOnWorkerAssignment', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="schedule-change" className="font-medium">Schedule Changes</Label>
                <p className="text-sm text-muted-foreground">When your booking time is changed</p>
              </div>
              <Switch
                id="schedule-change"
                checked={preferences.notifyOnScheduleChange !== false}
                onCheckedChange={(checked) => toggleNotificationType('notifyOnScheduleChange', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="worker-reassignment" className="font-medium">Worker Reassignment</Label>
                <p className="text-sm text-muted-foreground">When a different worker is assigned</p>
              </div>
              <Switch
                id="worker-reassignment"
                checked={preferences.notifyOnWorkerReassignment !== false}
                onCheckedChange={(checked) => toggleNotificationType('notifyOnWorkerReassignment', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="delay" className="font-medium">Delay Notifications</Label>
                <p className="text-sm text-muted-foreground">When your service is delayed</p>
              </div>
              <Switch
                id="delay"
                checked={preferences.notifyOnDelay !== false}
                onCheckedChange={(checked) => toggleNotificationType('notifyOnDelay', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="cancellation" className="font-medium">Cancellations & Refunds</Label>
                <p className="text-sm text-muted-foreground">When bookings are cancelled or refunded</p>
              </div>
              <Switch
                id="cancellation"
                checked={preferences.notifyOnCancellation !== false}
                onCheckedChange={(checked) => toggleNotificationType('notifyOnCancellation', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={fetchPreferences}
            disabled={saving}
          >
            Reset
          </Button>
          <Button
            onClick={savePreferences}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </Button>
        </div>

        {/* Info Box */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Bell className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="space-y-2 text-sm">
                <p className="font-medium">About Notifications</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>In-app notifications are always free and instant</li>
                  <li>WhatsApp notifications are cost-effective and highly reliable</li>
                  <li>SMS notifications are sent as backup when WhatsApp fails</li>
                  <li>You can change these settings anytime</li>
                  <li>Critical notifications (delays, cancellations) use all enabled channels</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NotificationSettingsPage;
