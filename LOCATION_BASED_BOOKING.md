# 📍 Location-Based Booking System

## Overview
Your application implements a comprehensive location-based booking system where:
- ✅ Customers can only book services available in their location
- ✅ Workers are assigned to specific locations/apartments
- ✅ Workers only receive orders from their assigned locations
- ✅ Service availability is validated before booking

## Key Components

### 1. **Location Management** (`backend/models/Location.js`)
Locations represent service areas (apartments, buildings, areas) managed by admins:
```javascript
{
  apartmentName: "Green Valley Apartments",
  area: "Andheri West",
  city: "Mumbai",
  coordinates: [72.8397, 19.1334], // [lng, lat]
  isServiceAvailable: true,
  availableServices: [serviceId1, serviceId2],
  assignedWorkers: [workerId1, workerId2]
}
```

### 2. **Worker Location Assignment** (`backend/models/User.js`)
Workers are explicitly assigned to specific locations:
```javascript
workerProfile: {
  assignedApartments: [{
    locationId: "location_id",
    apartmentName: "Green Valley",
    area: "Andheri West",
    coordinates: [72.8397, 19.1334],
    maxWalkingDistance: 500 // meters
  }]
}
```

### 3. **Location-Based Booking** (`backend/routes/bookings.js`)

#### ✅ **NEW: Strict Location Validation**
When customers create bookings:
1. **Location is mandatory** - Returns error if coordinates not provided
2. **Service area validation** - Finds nearby location within 5km radius
3. **Service availability check** - Verifies service is available at that location
4. **Worker verification** - If worker manually selected, verifies they're assigned to that location

```javascript
// Example error responses:
{
  error: "Location is required. Please select your location to book this service.",
  code: "LOCATION_REQUIRED"
}

{
  error: "Service not available in your area. Please select a location within our service coverage.",
  code: "SERVICE_NOT_AVAILABLE_IN_AREA"
}

{
  error: "This worker is not available in Green Valley Apartments.",
  code: "WORKER_NOT_IN_LOCATION"
}
```

### 4. **Worker Order Filtering** (`GET /api/bookings/available-orders`)
Workers only see orders from their assigned locations:
```javascript
// Filters by worker's assigned location IDs
query = {
  'location.locationId': { $in: assignedLocationIds },
  status: 'pending',
  worker: null
}
```

### 5. **Worker Order Acceptance** (`POST /api/bookings/:id/accept-order`)
Validates that worker is assigned to the booking's location before allowing acceptance.

## New API Endpoints

### 🆕 **GET /api/locations/customer/nearby**
Find nearby service locations for customers
```bash
GET /api/locations/customer/nearby?latitude=19.076&longitude=72.877&maxDistance=5000
```

**Response:**
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "_id": "location_id",
      "apartmentName": "Green Valley Apartments",
      "area": "Andheri West",
      "city": "Mumbai",
      "distance": 0.8,
      "distanceFormatted": "800m",
      "availableWorkersCount": 3,
      "servicesAvailable": 7,
      "isServiceAvailable": true
    }
  ]
}
```

### 🆕 **GET /api/services/by-location/:locationId**
Get services available at a specific location
```bash
GET /api/services/by-location/location_id
```

**Response:**
```json
{
  "services": [...],
  "location": {
    "_id": "location_id",
    "apartmentName": "Green Valley",
    "area": "Andheri West",
    "isServiceAvailable": true
  },
  "totalServices": 7
}
```

## Booking Flow

### Customer Booking Process:
```
1. Customer opens app
   ↓
2. Customer selects/confirms location (GPS or manual)
   ↓
3. System finds nearby service location (5km radius)
   ↓
4. System shows services available at that location
   ↓
5. Customer selects service and books
   ↓
6. System validates:
   - Location exists and is active
   - Service is available at that location
   - If worker selected, worker is assigned to that location
   ↓
7. System auto-assigns worker from that location
   ↓
8. Booking created with location reference
```

### Worker Order Process:
```
1. Worker opens "Available Orders"
   ↓
2. System filters bookings by worker's assigned locations
   ↓
3. Worker sees only orders from their assigned apartments
   ↓
4. Worker accepts order
   ↓
5. System verifies worker is still assigned to that location
   ↓
6. Order confirmed and assigned to worker
```

## Data Flow Diagram

```
┌─────────────────┐
│    Customer     │
└────────┬────────┘
         │
         │ 1. Provides GPS coordinates
         ↓
┌─────────────────────────────┐
│  Location Validation Layer  │
│  - Find nearest location    │
│  - Check service available  │
│  - Verify worker assignment │
└────────┬────────────────────┘
         │
         │ 2. Location validated
         ↓
┌─────────────────┐
│     Booking     │◄────┐
│  - locationId   │     │
│  - coordinates  │     │
│  - apartmentName│     │
└────────┬────────┘     │
         │              │
         │ 3. Auto-assign│
         ↓              │
┌─────────────────┐     │
│     Worker      │     │
│  - Assigned to  │─────┘
│    specific     │
│    apartments   │
└─────────────────┘
```

## Admin Setup Requirements

### 1. Create Locations
```javascript
POST /api/locations
{
  "apartmentName": "Green Valley Apartments",
  "area": "Andheri West",
  "city": "Mumbai",
  "state": "Maharashtra",
  "location": {
    "type": "Point",
    "coordinates": [72.8397, 19.1334]
  },
  "isServiceAvailable": true
}
```

### 2. Assign Workers to Locations
```javascript
POST /api/locations/:locationId/assign-worker
{
  "workerId": "worker_id"
}
```

### 3. Configure Available Services (Optional)
```javascript
PATCH /api/locations/:locationId
{
  "availableServices": [
    { "service": "service_id_1", "isActive": true },
    { "service": "service_id_2", "isActive": true }
  ]
}
```

## Frontend Integration

### Location Selection Component
```typescript
// src/components/LocationSelector.tsx
// Already exists - shows map with service areas

// Usage:
<LocationSelector
  onLocationConfirmed={(location) => {
    // location contains: lat, lng, address, isAvailable
    localStorage.setItem('userLocation', JSON.stringify(location));
  }}
/>
```

### Before Booking - Validate Location
```typescript
// In BookServicePage.tsx
const userLocation = localStorage.getItem('userLocation');
if (!userLocation) {
  toast.error('Please set your location first');
  navigate('/customer/services');
  return;
}

// Parse and include in booking
const location = JSON.parse(userLocation);
bookingData.location = {
  coordinates: [location.lng, location.lat],
  address: location.address,
  area: location.area,
  city: location.city
};
```

## Testing the System

### 1. Test Location Validation
```bash
# Try booking without location - should fail
POST /api/bookings
{
  "service": "service_id",
  "bookingDate": "2026-03-02",
  "startTime": "10:00",
  "endTime": "11:00",
  "totalAmount": 500
}

# Expected: Error "Location is required"
```

### 2. Test Service Availability
```bash
# Try booking in area without coverage
POST /api/bookings
{
  "service": "service_id",
  "location": {
    "coordinates": [0, 0] # Middle of ocean
  },
  ...
}

# Expected: Error "Service not available in your area"
```

### 3. Test Worker Location Verification
```bash
# Try booking with worker from different location
POST /api/bookings
{
  "worker": "worker_from_different_area",
  "location": {
    "coordinates": [72.8397, 19.1334]
  },
  ...
}

# Expected: Error "Worker not available in your location"
```

## Error Codes Reference

| Code | Message | Action Required |
|------|---------|----------------|
| `LOCATION_REQUIRED` | Location is required | Customer must select location |
| `SERVICE_NOT_AVAILABLE_IN_AREA` | Service not available in your area | Select different location or wait for coverage |
| `SERVICE_NOT_AT_LOCATION` | Service not available at this location | Choose different service or location |
| `WORKER_NOT_IN_LOCATION` | Worker not available in your location | System will auto-assign correct worker |

## Benefits

✅ **For Customers:**
- Only see services actually available in their area
- Workers are always nearby (within 5km)
- No disappointment from unavailable services

✅ **For Workers:**
- Only see orders they can actually serve
- Work within their assigned region
- No time wasted on far-away orders

✅ **For Admins:**
- Organized service coverage
- Easy worker management by location
- Clear visibility of service areas

## Next Steps

### Recommended Frontend Updates:

1. **Add Location Selection Prompt**
   - Show location selector on first app open
   - Require location confirmation before showing services

2. **Show Location in Service Cards**
   - Display distance from user location
   - Show "Available in your area" badge

3. **Filter Services by Location**
   - Call `/api/services/by-location/:locationId` after location selected
   - Only show available services

4. **Add Location Badge**
   - Show current location in header
   - Allow quick location change

---

## Summary

✅ **Location-based booking is FULLY IMPLEMENTED**

What was added today:
- ✅ Strict location validation in booking creation
- ✅ Service availability checking by location
- ✅ Enhanced worker verification with better error messages
- ✅ New API endpoints for customer location discovery
- ✅ Detailed error codes and messages

The system now ensures:
- Customers can ONLY book services available in their location
- Workers ONLY see orders from their assigned locations
- All bookings have valid location references
- Service coverage is properly validated

**The database cleanup removed 18 corrupted bookings that had broken references, which was causing the 500 error you saw earlier.**
