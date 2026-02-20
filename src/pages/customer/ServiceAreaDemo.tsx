/**
 * Service Area Demo Page
 * Shows the service availability checker with map visualization
 */

import AppLayout from '@/components/AppLayout';
import ServiceAreaMap from '@/components/ServiceAreaMap';
import ServiceAvailabilityChecker from '@/components/ServiceAvailabilityChecker';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getAvailableCities } from '@/data/serviceAreas';
import { CheckCircle2, MapPin } from 'lucide-react';
import { useState } from 'react';

const ServiceAreaDemo = () => {
  const [confirmedArea, setConfirmedArea] = useState<string | null>(null);
  const [confirmedLocation, setConfirmedLocation] = useState<{ lat: number; lng: number } | null>(null);

  const handleAvailabilityConfirmed = (serviceArea: string, coordinates: { lat: number; lng: number }) => {
    setConfirmedArea(serviceArea);
    setConfirmedLocation(coordinates);
  };

  const cities = getAvailableCities();

  return (
    <ServiceAvailabilityChecker onAvailabilityConfirmed={handleAvailabilityConfirmed}>
      <AppLayout userType="customer" userName="Guest">
        <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pb-20 md:pb-0">
          <div>
            <h1 className="text-2xl font-bold font-heading text-foreground mb-1">
              Service Availability
            </h1>
            <p className="text-muted-foreground text-sm">
              Check if our services are available in your area
            </p>
          </div>

          {confirmedArea && confirmedLocation && (
            <div className="bg-success-light border border-success rounded-xl p-4 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
              <div>
                <p className="font-semibold text-foreground">Service Available!</p>
                <p className="text-sm text-muted-foreground">
                  You're in an active service zone. Browse our services below.
                </p>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            {/* Map */}
            <Card>
              <CardHeader>
                <CardTitle>Service Coverage Map</CardTitle>
                <CardDescription>Blue areas show where services are available</CardDescription>
              </CardHeader>
              <CardContent>
                <ServiceAreaMap
                  userLocation={confirmedLocation || undefined}
                  highlightedArea={confirmedArea || undefined}
                  height="500px"
                />
              </CardContent>
            </Card>

            {/* Coverage Areas */}
            <Card>
              <CardHeader>
                <CardTitle>Service Areas</CardTitle>
                <CardDescription>We currently serve these locations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {cities.map((city) => (
                    <div key={city} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-primary" />
                        <h3 className="font-semibold text-foreground">{city}</h3>
                      </div>
                      <div className="pl-6 space-y-1">
                        {/* This would be populated from serviceAreas data */}
                        <Badge variant="secondary" className="mr-2">Andheri West</Badge>
                        <Badge variant="secondary" className="mr-2">Bandra</Badge>
                        <Badge variant="secondary" className="mr-2">Powai</Badge>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 p-4 bg-accent rounded-lg">
                  <h4 className="font-semibold text-sm mb-2">How it works:</h4>
                  <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Allow location access when prompted</li>
                    <li>We check if you're in a service zone using GeoJSON polygons</li>
                    <li>If available, you can browse and book services</li>
                    <li>If not, sign up to be notified when we expand</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Features */}
          <div className="grid sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-3xl mb-3">🗺️</div>
                <h3 className="font-bold text-foreground mb-2">GeoJSON Polygons</h3>
                <p className="text-sm text-muted-foreground">
                  Precise service area boundaries using geographic coordinates
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-3xl mb-3">⚡</div>
                <h3 className="font-bold text-foreground mb-2">Client-Side Fast</h3>
                <p className="text-sm text-muted-foreground">
                  Instant availability check using Turf.js point-in-polygon algorithm
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-3xl mb-3">🔒</div>
                <h3 className="font-bold text-foreground mb-2">Backend Validated</h3>
                <p className="text-sm text-muted-foreground">
                  Final booking validation on server for security
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </AppLayout>
    </ServiceAvailabilityChecker>
  );
};

export default ServiceAreaDemo;
