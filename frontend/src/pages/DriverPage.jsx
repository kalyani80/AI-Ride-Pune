import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import AIAssistant from "../components/AIAssistant";
import { puneImages } from "../pune";
import {
  addMarker,
  clearMarkers,
  createMap,
  drawRouteOnMap,
} from "../maps";

export default function DriverPage() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [driverRides, setDriverRides] = useState([]);
  const [driverRide, setDriverRide] = useState(null);
  const [otpInput, setOtpInput] = useState("");
  const [driverLocation, setDriverLocation] = useState(null);
  const [driverTracking, setDriverTracking] = useState(null);
  const [history, setHistory] = useState([]);
  const [message, setMessage] = useState("");
  const [online, setOnline] = useState(Boolean(user?.is_online));

  const driverMapRef = useRef(null);
  const driverMap = useRef(null);
  const driverRouteLine = useRef(null);
  const driverMarkers = useRef([]);
  const locationWatchId = useRef(null);
  const driverLocationRef = useRef(null);

  const signOut = () => {
    if (locationWatchId.current !== null) {
      navigator.geolocation.clearWatch(locationWatchId.current);
    }
    logout();
    navigate("/login");
  };

  const refreshDriverMap = async () => {
    if (!driverMap.current || !driverLocationRef.current) return;
    const { latitude, longitude } = driverLocationRef.current;
    try {
      const response = await api.get("/drivers/nearby", {
        params: { lat: latitude, lng: longitude },
      });
      clearMarkers(driverMarkers);

      const selfMarker = await addMarker(
        driverMap.current,
        { lat: latitude, lng: longitude },
        "You",
        "Y"
      );
      if (selfMarker) driverMarkers.current.push(selfMarker);

      for (const driver of response.data) {
        if (driver.driver_id === user.user_id) continue;
        const marker = await addMarker(
          driverMap.current,
          { lat: Number(driver.latitude), lng: Number(driver.longitude) },
          driver.name,
          "D"
        );
        if (marker) driverMarkers.current.push(marker);
      }

      if (driverRide?.pickup_lat != null) {
        const riderMarker = await addMarker(
          driverMap.current,
          { lat: Number(driverRide.pickup_lat), lng: Number(driverRide.pickup_lng) },
          "Rider pickup",
          "R"
        );
        if (riderMarker) driverMarkers.current.push(riderMarker);
      }

      if (driverTracking?.rider_latitude != null) {
        const riderMarker = await addMarker(
          driverMap.current,
          {
            lat: Number(driverTracking.rider_latitude),
            lng: Number(driverTracking.rider_longitude),
          },
          "Rider",
          "R"
        );
        if (riderMarker) driverMarkers.current.push(riderMarker);
      }

      if (driverRide?.polyline) {
        await drawRouteOnMap(driverMap.current, driverRouteLine, driverRide.polyline);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const startLocationSharing = () => {
    if (!navigator.geolocation) return;
    if (locationWatchId.current !== null) {
      navigator.geolocation.clearWatch(locationWatchId.current);
    }
    locationWatchId.current = navigator.geolocation.watchPosition(
      async (position) => {
        const nextLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setDriverLocation(nextLocation);
        driverLocationRef.current = nextLocation;
        try {
          await api.post("/driver/location", nextLocation);
          await refreshDriverMap();
        } catch (error) {
          console.error(error);
        }
      },
      (error) => console.error(error),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );
  };

  const toggleOnline = async () => {
    try {
      const response = await api.post("/driver/online", { is_online: !online });
      setOnline(response.data.is_online);
      setUser((prev) => ({ ...prev, ...response.data }));
    } catch (error) {
      setMessage(error.response?.data?.detail || "Could not update status.");
    }
  };

const loadDriverData = async () => {
    try {
      const ridesRes = await api.get("/driver/rides");
      setDriverRides(ridesRes.data);
    } catch (error) {
      console.error(error);
    }
    try {
      const historyResponse = await api.get("/rides/history");
      setHistory(historyResponse.data.filter((ride) => ride.status === "completed"));
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    const boot = async () => {
      await createMap(driverMapRef, driverMap);
      startLocationSharing();
      try {
        const active = await api.get("/rides/active");
        if (active.data.ride) setDriverRide(active.data.ride);
      } catch {
        /* ignore */
      }
      await loadDriverData();
    };
    boot();
    return () => {
      if (locationWatchId.current !== null) {
        navigator.geolocation.clearWatch(locationWatchId.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!online) return;
    loadDriverData();
    const interval = setInterval(loadDriverData, 3000); // Polls both requests and earnings history every 3s
    return () => clearInterval(interval);
  }, [online]);

  const acceptRide = async (rideId) => {
    try {
      const response = await api.post(`/driver/accept/${rideId}`);
      setDriverRide(response.data);
      setOtpInput("");
      await loadDriverRides();
      await refreshDriverMap();
    } catch (error) {
      setMessage(error.response?.data?.detail || "Ride is no longer available.");
    }
  };

  
  useEffect(() => {
    if (!driverRide?.ride_id) return;
    const poll = async () => {
      try {
        const response = await api.get(`/ride/${driverRide.ride_id}/tracking`);
        setDriverTracking(response.data);
        await refreshDriverMap();
      } catch (error) {
        console.error(error);
      }
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [driverRide]);

  const startRide = async () => {
    if (!driverRide || !otpInput.trim()) return;
    try {
      const response = await api.post(`/driver/start/${driverRide.ride_id}`, {
        otp: otpInput.trim(),
      });
      setDriverRide({ ...driverRide, ...response.data });
      setOtpInput("");
    } catch (error) {
      setMessage(error.response?.data?.detail || "Incorrect OTP.");
    }
  };

 const completeRide = async () => {
    if (!driverRide) return;
    try {
      const response = await api.post(`/driver/complete/${driverRide.ride_id}`);
      setDriverRide({ ...driverRide, ...response.data });
      await loadDriverData(); // Immediately re-fetches history and updates earnings!
    } catch {
      setMessage("Could not complete ride.");
    }
  };

  const cancelRide = async () => {
    if (!driverRide) return;
    try {
      await api.post(`/rides/${driverRide.ride_id}/cancel`);
      setDriverRide(null);
      setDriverTracking(null);
    } catch (error) {
      setMessage(error.response?.data?.detail || "Could not cancel.");
    }
  };

  const earnings = history.reduce((sum, ride) => sum + Number(ride.fare || 0), 0);

  return (
    <div className="app-shell driver-page">
      <header className="topbar">
        <div className="brand">
          AI-RIDE
          <span>PUNE</span>
        </div>
        <div className="topbar-right">
          <span>{user.name}</span>
          <button onClick={signOut}>Logout</button>
        </div>
      </header>

      <main className="page-container">
        <section className="city-hero driver-hero">
          <img src={puneImages.street} alt="Pune" />
          <div className="city-hero-overlay">
            <div>
              <span className="eyebrow light">DRIVER PARTNER</span>
              <h1>Driver console</h1>
            </div>
            <button className={`status-pill ${online ? "live" : ""}`} onClick={toggleOnline}>
              {online ? "● ONLINE" : "○ GO ONLINE"}
            </button>
          </div>
        </section>

        <div className="driver-layout">
          <section className="panel driver-map-panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">LIVE MAP</span>
                <h2>{driverRide ? "Route tracking" : "Nearby area"}</h2>
              </div>
              {driverLocation && <span className="map-location-pill">GPS ON</span>}
            </div>
            <div ref={driverMapRef} className="real-map driver-map" />
          </section>

          <section className="panel requests-panel">
            <div className="earnings-strip">
              <div>
                <span>Vehicle</span>
                <strong>{user.vehicle_type || "mini"} · {user.vehicle_number || "--"}</strong>
              </div>
              <div>
                <span>Today earnings</span>
                <strong>₹{earnings.toFixed(0)}</strong>
              </div>
            </div>

            {driverRide ? (
              <div className="active-ride">
                <div className="ride-top">
                  <span className="eyebrow">RIDE #{driverRide.ride_id}</span>
                  <span className="ride-state">{driverRide.status}</span>
                </div>
                <div className="route-points">
                  <div>
                    <span>Pickup</span>
                    <strong>{driverRide.pickup}</strong>
                  </div>
                  <div>
                    <span>Destination</span>
                    <strong>{driverRide.destination}</strong>
                  </div>
                </div>
                <div className="ride-meta">
                  <div>
                    <span>Trip</span>
                    <strong>{driverRide.distance_km} km</strong>
                  </div>
                  <div>
                    <span>ETA</span>
                    <strong>{driverRide.eta_minutes} min</strong>
                  </div>
                  <div>
                    <span>Fare</span>
                    <strong>₹{driverRide.fare}</strong>
                  </div>
                </div>
                {driverRide.status === "accepted" && (
                  <div className="otp-box">
                    <label>Enter rider OTP</label>
                    <input
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value)}
                      maxLength={4}
                      inputMode="numeric"
                      placeholder="4-digit OTP"
                    />
                    <button className="primary-btn" onClick={startRide}>
                      START RIDE
                    </button>
                    <button className="secondary-btn wide" onClick={cancelRide}>
                      CANCEL
                    </button>
                  </div>
                )}
                {driverRide.status === "ongoing" && (
                  <button className="primary-btn wide" onClick={completeRide}>
                    COMPLETE RIDE · COLLECT CASH
                  </button>
                )}
                {driverRide.status === "completed" && (
                  <>
                    <div className="success-line">Ride completed. Cash collected.</div>
                    <button className="primary-btn wide" onClick={() => setDriverRide(null)}>
                      FIND NEXT RIDE
                    </button>
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="panel-head">
                  <div>
                    <span className="eyebrow">DISPATCH</span>
                    <h2>Ride requests</h2>
                  </div>
                  <span className="nearby-radius">Within 5 km</span>
                </div>
                {!online ? (
                  <div className="empty-state">Go online to receive nearby requests.</div>
                ) : driverRides.length === 0 ? (
                  <div className="empty-state">
                    {driverLocation
                      ? "No nearby requests right now."
                      : "Allow location access to receive nearby requests."}
                  </div>
                ) : (
                  <div className="request-list">
                    {driverRides.map((ride) => (
                      <article className="request-card" key={ride.ride_id}>
                        <div className="ride-top">
                          <span>Ride #{ride.ride_id}</span>
                          <span className="nearby-pill">{ride.nearby_distance_km} km away</span>
                        </div>
                        <div className="route-points">
                          <div>
                            <span>Pickup</span>
                            <strong>{ride.pickup}</strong>
                          </div>
                          <div>
                            <span>Destination</span>
                            <strong>{ride.destination}</strong>
                          </div>
                        </div>
                        <div className="ride-meta">
                          <div>
                            <span>Trip</span>
                            <strong>{ride.distance_km} km</strong>
                          </div>
                          <div>
                            <span>Fare</span>
                            <strong>₹{ride.fare}</strong>
                          </div>
                          <div>
                            <span>Cab</span>
                            <strong>{ride.vehicle_type}</strong>
                          </div>
                        </div>
                        <button className="primary-btn wide" onClick={() => acceptRide(ride.ride_id)}>
                          ACCEPT
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </main>
      {message && <div className="toast">{message}</div>}
      <AIAssistant role="driver" />
    </div>
  );
}
