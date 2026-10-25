# Trip History API - Frontend Usage Guide

## Overview
Once a trip is started (when driver enables location sharing), you can view the trip history using these APIs.

## Base URL
All endpoints are prefixed with `/api/trips`

---

## 1. Get Driver's Trip List
**Endpoint:** `GET /api/trips/driver`

**Authentication:** Required (Driver token)

**Query Parameters:**
- `limit` (optional): Number of trips (1-100, default: 50)
- `skip` (optional): Pagination offset (default: 0)

**Example:**
```javascript
// Get last 10 trips
const response = await fetch('/api/trips/driver?limit=10', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${driverToken}`,
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
// data.trips = array of trip summaries (without locations)
// data.total = total number of trips
```

**Response:**
```json
{
  "trips": [
    {
      "_id": "67890abcdef1234567890123",
      "busNumber": "BUS-001",
      "startTime": "2024-01-15T08:00:00.000Z",
      "endTime": "2024-01-15T09:30:00.000Z",
      "status": "completed",
      "startLocation": { "lat": 40.7128, "lng": -74.0060 },
      "endLocation": { "lat": 40.7500, "lng": -74.0500 }
    }
  ],
  "total": 15,
  "limit": 10,
  "skip": 0
}
```

---

## 2. Get Specific Trip with Locations (For Map)
**Endpoint:** `GET /api/trips/driver/:tripId`

**Authentication:** Required (Driver token)

**Example:**
```javascript
// Get full trip details with all location points
const tripId = "67890abcdef1234567890123";
const response = await fetch(`/api/trips/driver/${tripId}`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${driverToken}`,
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
const trip = data.trip;

// Draw route on map using trip.locations
drawRouteOnMap(trip.locations);
```

**Response:**
```json
{
  "trip": {
    "_id": "67890abcdef1234567890123",
    "driverId": "driver_id_here",
    "busNumber": "BUS-001",
    "startTime": "2024-01-15T08:00:00.000Z",
    "endTime": "2024-01-15T09:30:00.000Z",
    "status": "completed",
    "locations": [
      {
        "lat": 40.7128,
        "lng": -74.0060,
        "timestamp": "2024-01-15T08:00:00.000Z"
      },
      {
        "lat": 40.7130,
        "lng": -74.0062,
        "timestamp": "2024-01-15T08:00:10.000Z"
      },
      {
        "lat": 40.7135,
        "lng": -74.0065,
        "timestamp": "2024-01-15T08:00:20.000Z"
      }
      // ... more location points
    ],
    "startLocation": { "lat": 40.7128, "lng": -74.0060 },
    "endLocation": { "lat": 40.7500, "lng": -74.0500 },
    "createdAt": "2024-01-15T08:00:00.000Z",
    "updatedAt": "2024-01-15T09:30:00.000Z"
  }
}
```

---

## 3. Get Trips by Bus Number (Public)
**Endpoint:** `GET /api/trips/bus?busNumber=XXX`

**Authentication:** Not required

**Query Parameters:**
- `busNumber` (required): The bus number
- `limit` (optional): Number of trips (default: 50)
- `skip` (optional): Pagination offset
- `includeLocations` (optional): Set to `"true"` to include locations in response

**Example:**
```javascript
// Get trips for a specific bus
const response = await fetch('/api/trips/bus?busNumber=BUS-001&limit=20&includeLocations=false', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
// data.trips = array of completed trips
```

---

## 4. Get Specific Trip by ID (Public)
**Endpoint:** `GET /api/trips/:tripId`

**Authentication:** Not required

**Example:**
```javascript
// Get specific trip (public access)
const tripId = "67890abcdef1234567890123";
const response = await fetch(`/api/trips/${tripId}`, {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
const trip = data.trip;
// Use trip.locations to draw route
```

---

## Complete Frontend Example (React)

```javascript
import { useState, useEffect } from 'react';

function TripHistoryView({ driverToken }) {
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch trip list
  useEffect(() => {
    async function fetchTrips() {
      setLoading(true);
      try {
        const response = await fetch('/api/trips/driver?limit=20', {
          headers: {
            'Authorization': `Bearer ${driverToken}`,
            'Content-Type': 'application/json'
          }
        });
        const data = await response.json();
        setTrips(data.trips);
      } catch (error) {
        console.error('Error fetching trips:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchTrips();
  }, [driverToken]);

  // Fetch specific trip with locations
  async function viewTripOnMap(tripId) {
    try {
      const response = await fetch(`/api/trips/driver/${tripId}`, {
        headers: {
          'Authorization': `Bearer ${driverToken}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      setSelectedTrip(data.trip);
      
      // Draw route on map
      if (data.trip.locations && data.trip.locations.length > 0) {
        drawRouteOnMap(data.trip.locations);
      }
    } catch (error) {
      console.error('Error fetching trip details:', error);
    }
  }

  function drawRouteOnMap(locations) {
    // Example using Google Maps
    const path = locations.map(loc => ({
      lat: loc.lat,
      lng: loc.lng
    }));
    
    // Create polyline on your map
    // new google.maps.Polyline({
    //   path: path,
    //   map: mapInstance
    // });
    
    console.log('Drawing route with', locations.length, 'points');
  }

  if (loading) return <div>Loading trips...</div>;

  return (
    <div>
      <h2>Trip History</h2>
      <ul>
        {trips.map(trip => (
          <li key={trip._id}>
            <div>
              <strong>Bus:</strong> {trip.busNumber}<br />
              <strong>Date:</strong> {new Date(trip.startTime).toLocaleString()}<br />
              <strong>Duration:</strong> {
                trip.endTime 
                  ? `${Math.round((new Date(trip.endTime) - new Date(trip.startTime)) / 60000)} minutes`
                  : 'In Progress'
              }
            </div>
            <button onClick={() => viewTripOnMap(trip._id)}>
              View on Map
            </button>
          </li>
        ))}
      </ul>
      
      {selectedTrip && (
        <div>
          <h3>Selected Trip Route</h3>
          <p>Total locations: {selectedTrip.locations?.length || 0}</p>
          {/* Map component here */}
        </div>
      )}
    </div>
  );
}

export default TripHistoryView;
```

---

## Map Integration Example (Google Maps)

```javascript
function drawTripRouteOnMap(mapInstance, locations) {
  // Convert locations to Google Maps LatLng format
  const path = locations.map(loc => ({
    lat: loc.lat,
    lng: loc.lng
  }));

  // Create polyline
  const polyline = new google.maps.Polyline({
    path: path,
    geodesic: true,
    strokeColor: '#FF0000',
    strokeOpacity: 1.0,
    strokeWeight: 3,
    map: mapInstance
  });

  // Fit map to show entire route
  const bounds = new google.maps.LatLngBounds();
  locations.forEach(loc => {
    bounds.extend(new google.maps.LatLng(loc.lat, loc.lng));
  });
  mapInstance.fitBounds(bounds);

  return polyline;
}
```

---

## Notes
- Trips are automatically created when driver starts location sharing
- Trips are marked as "completed" when driver stops sharing
- Only completed trips are returned by public endpoints
- Active trips (status: "active") can only be accessed by the driver
- The `locations` array contains all GPS points recorded during the trip in chronological order

