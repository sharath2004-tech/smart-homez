import { api } from '@/lib/api';
import { ArrowLeft, Clock, MapPin, Navigation, Phone, User, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface RoutePoint {
  coordinates: [number, number];
  timestamp: string;
}

interface TrackingData {
  _id: string;
  status: 'en-route' | 'arrived' | 'in-service' | 'completed';
  currentLocation: { coordinates: [number, number] };
  eta?: string;
  delayMinutes?: number;
  distance?: number;
  trafficCondition?: 'light' | 'moderate' | 'heavy';
  route?: RoutePoint[];
  worker?: { name: string; phone?: string };
}

interface Props {
  bookingId: string;
  workerName?: string;
  onClose: () => void;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; step: number }> = {
  'en-route':    { label: 'On the way',  color: 'text-blue-700',  bg: 'bg-blue-100',   step: 1 },
  arrived:       { label: 'Arrived',     color: 'text-green-700', bg: 'bg-green-100',  step: 2 },
  'in-service':  { label: 'In service',  color: 'text-purple-700',bg: 'bg-purple-100', step: 3 },
  completed:     { label: 'Completed',   color: 'text-gray-700',  bg: 'bg-gray-100',   step: 4 },
};

const STEPS = ['Assigned', 'On the way', 'Arrived', 'In service', 'Done'];

export default function WorkerTrackingMap({ bookingId, workerName, onClose }: Props) {
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [etaCountdown, setEtaCountdown] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTracking = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await api.get(`/tracking/booking/${bookingId}`);
      setTracking(res.tracking ?? null);
      if (res.tracking) setLastUpdated(new Date());
    } catch {
      // silently ignore polling errors
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchTracking(false);
    intervalRef.current = setInterval(() => fetchTracking(true), 10000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  // ETA countdown
  useEffect(() => {
    if (!tracking?.eta) { setEtaCountdown(''); return; }
    const tick = () => {
      const diff = new Date(tracking.eta!).getTime() - Date.now();
      if (diff <= 0) { setEtaCountdown('Arriving now'); return; }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setEtaCountdown(`${mins}m ${secs.toString().padStart(2, '0')}s`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [tracking?.eta]);

  const statusMeta = tracking ? (STATUS_META[tracking.status] ?? STATUS_META['en-route']) : null;
  const currentStep = tracking ? (STATUS_META[tracking.status]?.step ?? 1) : 0;

  const trafficColor = { light: 'text-green-600', moderate: 'text-yellow-600', heavy: 'text-red-600' };

  const formatCoords = (coords?: [number, number]) =>
    coords ? `${coords[1].toFixed(5)}°N, ${coords[0].toFixed(5)}°E` : '—';

  const recentRoute = tracking?.route?.slice(-5).reverse() ?? [];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
      <div className="min-h-screen p-4 flex items-start justify-center py-8">
        <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
          {/* Header */}
          <div className="bg-primary text-primary-foreground p-5 rounded-t-2xl flex items-center gap-3">
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Navigation className="w-5 h-5" /> Track Worker
              </h2>
              <p className="text-sm opacity-80">{workerName ?? tracking?.worker?.name ?? 'Worker'}</p>
            </div>
            {lastUpdated && (
              <div className="flex items-center gap-1 text-xs opacity-70">
                <Wifi className="w-4 h-4" />
                Live
              </div>
            )}
          </div>

          {loading ? (
            <div className="p-10 flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Fetching location…</p>
            </div>
          ) : !tracking ? (
            <div className="p-10 flex flex-col items-center gap-3 text-center">
              <WifiOff className="w-12 h-12 text-muted-foreground" />
              <p className="font-medium text-muted-foreground">Tracking not started yet</p>
              <p className="text-xs text-muted-foreground">
                The worker will share their location once they start heading to your location.
              </p>
            </div>
          ) : (
            <div className="p-5 space-y-5">
              {/* Status badge */}
              <div className={`flex items-center gap-3 ${statusMeta?.bg} rounded-xl p-4`}>
                <div className={`w-3 h-3 rounded-full ${tracking.status === 'en-route' ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`} />
                <div className="flex-1">
                  <p className={`font-semibold ${statusMeta?.color}`}>{statusMeta?.label}</p>
                  {tracking.delayMinutes != null && tracking.delayMinutes > 0 && (
                    <p className="text-xs text-orange-600 mt-0.5">⚠ Delayed by {tracking.delayMinutes} min</p>
                  )}
                </div>
                {tracking.trafficCondition && (
                  <span className={`text-xs font-medium capitalize ${trafficColor[tracking.trafficCondition]}`}>
                    {tracking.trafficCondition} traffic
                  </span>
                )}
              </div>

              {/* Progress steps */}
              <div className="flex items-center justify-between relative">
                <div className="absolute top-3 left-0 right-0 h-0.5 bg-border mx-6" />
                {STEPS.map((s, i) => (
                  <div key={s} className="flex flex-col items-center gap-1 z-10 flex-1">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all ${
                      i < currentStep ? 'bg-primary border-primary text-primary-foreground' :
                      i === currentStep ? 'bg-white border-primary text-primary ring-2 ring-primary/20' :
                      'bg-white border-border text-muted-foreground'
                    }`}>
                      {i < currentStep ? '✓' : i + 1}
                    </div>
                    <span className={`text-[9px] text-center leading-tight max-w-[42px] ${
                      i === currentStep ? 'text-primary font-semibold' : 'text-muted-foreground'
                    }`}>{s}</span>
                  </div>
                ))}
              </div>

              {/* ETA card */}
              {etaCountdown && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
                  <Clock className="w-8 h-8 text-blue-500 shrink-0" />
                  <div>
                    <p className="text-xs text-blue-600">Estimated arrival in</p>
                    <p className="text-2xl font-bold text-blue-700 font-mono">{etaCountdown}</p>
                  </div>
                </div>
              )}

              {/* Current location */}
              <div className="bg-muted rounded-xl p-4 space-y-2">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" /> Current Position
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  {formatCoords(tracking.currentLocation?.coordinates)}
                </p>
                {tracking.distance != null && (
                  <p className="text-xs text-muted-foreground">
                    Distance to you: ~{tracking.distance < 1000
                      ? `${Math.round(tracking.distance)} m`
                      : `${(tracking.distance / 1000).toFixed(1)} km`}
                  </p>
                )}
                {lastUpdated && (
                  <p className="text-xs text-green-600">
                    Updated {Math.round((Date.now() - lastUpdated.getTime()) / 1000)}s ago
                  </p>
                )}
              </div>

              {/* Route history */}
              {recentRoute.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-primary" /> Recent Route
                  </p>
                  <div className="space-y-1">
                    {recentRoute.map((pt, idx) => (
                      <div key={idx} className="flex items-center gap-3 text-xs">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${idx === 0 ? 'bg-primary' : 'bg-border'}`} />
                        <span className="font-mono text-muted-foreground flex-1">
                          {pt.coordinates[1].toFixed(4)}°N, {pt.coordinates[0].toFixed(4)}°E
                        </span>
                        <span className="text-muted-foreground shrink-0">
                          {new Date(pt.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Worker info */}
              {tracking.worker && (
                <div className="border rounded-xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold shrink-0">
                    <User className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{tracking.worker.name}</p>
                    <p className="text-xs text-muted-foreground">Your assigned worker</p>
                  </div>
                  {tracking.worker.phone && (
                    <a href={`tel:${tracking.worker.phone}`}
                      className="flex items-center gap-1 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm">
                      <Phone className="w-4 h-4" />
                    </a>
                  )}
                </div>
              )}

              <p className="text-center text-xs text-muted-foreground">Updates every 10 seconds</p>
            </div>
          )}

          <div className="px-5 pb-5">
            <button onClick={onClose} className="w-full btn-secondary py-3">Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
