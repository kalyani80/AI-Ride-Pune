import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import LocationInput from "../components/LocationInput";
import AIAssistant from "../components/AIAssistant";
import {
  addMarker,
  clearMarkers,
  createMap,
  drawRouteOnMap,
  GOOGLE_KEY,
} from "../maps";

const getStepIndex = (status) => {
  switch (status) {
    case "requested": return 1;
    case "accepted": return 2;
    case "ongoing": return 3;
    case "completed": return 4;
    default: return 1;
  }
};

export default function RiderPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [route, setRoute] = useState(null);
  const [fare, setFare] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState("mini");
  const [currentRide, setCurrentRide] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [nearbyDrivers, setNearbyDrivers] = useState([]);
  const [history, setHistory] = useState([]);
  const [temperature, setTemperature] = useState(null);
  const [weather, setWeather] = useState("--");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(5);

  const riderMapRef = useRef(null);
  const riderMap = useRef(null);
  const riderRouteLine = useRef(null);
  const riderMarkers = useRef([]);

  const signOut = () => {
    logout();
    navigate("/login");
  };

  const updateRiderMap = async (data = {}) => {
    if (!riderMap.current) {
      return;
    }
    clearMarkers(riderMarkers);

    if (data.pickup_lat != null && data.pickup_lng != null) {
      const marker = await addMarker(
        riderMap.current,
        { lat: Number(data.pickup_lat), lng: Number(data.pickup_lng) },
        "Pickup",
        "P"
      );
      if (marker) riderMarkers.current.push(marker);
    }

    if (data.destination_lat != null && data.destination_lng != null) {
      const marker = await addMarker(
        riderMap.current,
        { lat: Number(data.destination_lat), lng: Number(data.destination_lng) },
        "Drop",
        "X"
      );
      if (marker) riderMarkers.current.push(marker);
    }

    if (data.latitude != null && data.longitude != null) {
      const marker = await addMarker(
        riderMap.current,
        { lat: Number(data.latitude), lng: Number(data.longitude) },
        data.driver_name || "Driver",
        "D"
      );
      if (marker) riderMarkers.current.push(marker);
      riderMap.current.panTo({
        lat: Number(data.latitude),
        lng: Number(data.longitude),
      });
    }

    const drivers = data.nearby_drivers || nearbyDrivers;
    for (const driver of drivers) {
      if (driver.latitude == null || driver.longitude == null) continue;
      if (tracking?.driver_id && driver.driver_id === tracking.driver_id) continue;
      const marker = await addMarker(
        riderMap.current,
        { lat: Number(driver.latitude), lng: Number(driver.longitude) },
        driver.name,
        "D"
      );
      if (marker) riderMarkers.current.push(marker);
    }
  };

  const refreshNearbyDrivers = async (lat, lng) => {
    if (lat == null || lng == null) return;
    try {
      const response = await api.get("/drivers/nearby", { params: { lat, lng } });
      setNearbyDrivers(response.data);
      await updateRiderMap({
        pickup_lat: lat,
        pickup_lng: lng,
        nearby_drivers: response.data,
      });
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    const boot = async () => {
      if (!GOOGLE_KEY) {
        setMessage("Google Maps key is missing.");
      }
      const map = await createMap(riderMapRef, riderMap);
      try {
        const weatherResponse = await api.get("/weather");
        setTemperature(weatherResponse.data.temperature);
        setWeather(weatherResponse.data.condition);
      } catch {
        setWeather("--");
      }
      try {
        const active = await api.get("/rides/active");
        if (active.data.ride) {
          setCurrentRide(active.data.ride);
        }
      } catch {
        /* ignore */
      }
      try {
        const historyResponse = await api.get("/rides/history");
        setHistory(historyResponse.data);
      } catch {
        /* ignore */
      }
      if (map && route?.polyline) {
        await drawRouteOnMap(map, riderRouteLine, route.polyline);
      }
    };
    boot();
  }, []);

  useEffect(() => {
    if (route?.polyline && riderMap.current) {
      drawRouteOnMap(riderMap.current, riderRouteLine, route.polyline);
    }
  }, [route]);
const handleAgentBookRide = async (agentPickup, agentDrop, vehicleType = "mini", autoConfirm = true) => {
    try {
      setPickup(agentPickup);
      setDestination(agentDrop);
      setSelectedVehicle(vehicleType);
      setMessage("🤖 AI Agent is calculating your route & fare...");

      const routeResponse = await api.post("/route", {
        pickup: agentPickup,
        destination: agentDrop,
      });
      const routeData = routeResponse.data;
      setRoute(routeData);
      await drawRouteOnMap(riderMap.current, riderRouteLine, routeData.polyline);

      const fareResponse = await api.post("/fare-preview", {
        distance_km: routeData.distance_km,
        eta_minutes: routeData.eta_minutes,
        traffic: routeData.traffic,
        pickup: agentPickup,
        destination: agentDrop,
        pickup_lat: routeData.pickup_lat,
        pickup_lng: routeData.pickup_lng,
      });
      const fareData = fareResponse.data;
      setFare(fareData);

      const chosenOption =
        fareData.options?.find((item) => item.vehicle_type === vehicleType) ||
        fareData.options?.[0];

      if (autoConfirm && chosenOption) {
        const confirmResponse = await api.post("/confirm-ride", {
          pickup: agentPickup,
          destination: agentDrop,
          distance_km: routeData.distance_km,
          eta_minutes: chosenOption.eta_minutes || routeData.eta_minutes,
          traffic: routeData.traffic,
          weather: fareData.weather,
          fare: chosenOption.final_fare,
          pickup_lat: routeData.pickup_lat,
          pickup_lng: routeData.pickup_lng,
          destination_lat: routeData.destination_lat,
          destination_lng: routeData.destination_lng,
          vehicle_type: chosenOption.vehicle_type,
          payment_method: "cash",
          polyline: routeData.polyline,
        });
        setCurrentRide(confirmResponse.data);
        setFare(null);
        setTracking({ ...confirmResponse.data, nearby_drivers: nearbyDrivers });
        setMessage("🤖 AI Agent booked your ride!");
        return `✅ **Ride Booked Autonomously!**\n• Ride ID: **#${confirmResponse.data.ride_id}**\n• Cab: **${chosenOption.name}**\n• Fare: **₹${chosenOption.final_fare}**\n• OTP: **${confirmResponse.data.otp}**\nYour driver is being assigned now!`;
      }

      return `✅ Route & Fare loaded! Your ${chosenOption?.name} fare is ₹${chosenOption?.final_fare}. Click Confirm whenever you're ready!`;
    } catch (err) {
      return `⚠️ Couldn't auto-book that route (${err.response?.data?.detail || "Check location names"}). Try another Pune landmark!`;
    }
  };
  const findRoute = async () => {
    if (!pickup.trim() || !destination.trim()) {
      setMessage("Enter pickup and destination.");
      return;
    }
    try {
      setMessage("");
      setFare(null);
      setCurrentRide(null);
      setTracking(null);
      const routeResponse = await api.post("/route", { pickup, destination });
      const routeData = routeResponse.data;
      setRoute(routeData);
      await drawRouteOnMap(riderMap.current, riderRouteLine, routeData.polyline);
      const fareResponse = await api.post("/fare-preview", {
        distance_km: routeData.distance_km,
        eta_minutes: routeData.eta_minutes,
        traffic: routeData.traffic,
        pickup,
        destination,
        pickup_lat: routeData.pickup_lat,
        pickup_lng: routeData.pickup_lng,
      });
      setFare(fareResponse.data);
      setSelectedVehicle("mini");
      setTemperature(fareResponse.data.temperature);
      setWeather(fareResponse.data.weather);
      await refreshNearbyDrivers(routeData.pickup_lat, routeData.pickup_lng);
    } catch (error) {
      setMessage(error.response?.data?.detail || "Unable to calculate this ride.");
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPickup(
          `${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`
        );
      },
      () => setMessage("Could not read your location.")
    );
  };

  const confirmRide = async () => {
    if (!route || !fare) return;
    const option = fare.options?.find((item) => item.vehicle_type === selectedVehicle);
    try {
      const response = await api.post("/confirm-ride", {
        pickup,
        destination,
        distance_km: route.distance_km,
        eta_minutes: option?.eta_minutes || route.eta_minutes,
        traffic: route.traffic,
        weather: fare.weather,
        fare: option?.final_fare || fare.final_fare,
        pickup_lat: route.pickup_lat,
        pickup_lng: route.pickup_lng,
        destination_lat: route.destination_lat,
        destination_lng: route.destination_lng,
        vehicle_type: selectedVehicle,
        payment_method: "cash",
        polyline: route.polyline,
      });
      setCurrentRide(response.data);
      setFare(null);
      setTracking({ ...response.data, nearby_drivers: nearbyDrivers });
    } catch (error) {
      setMessage(error.response?.data?.detail || "Unable to confirm ride.");
    }
  };

  const cancelRide = async () => {
    if (!currentRide?.ride_id) return;
    try {
      await api.post(`/rides/${currentRide.ride_id}/cancel`);
      setCurrentRide(null);
      setTracking(null);
      setMessage("Ride cancelled.");
    } catch (error) {
      setMessage(error.response?.data?.detail || "Could not cancel ride.");
    }
  };

  const submitRating = async () => {
    if (!currentRide?.ride_id) return;
    try {
      await api.post(`/rides/${currentRide.ride_id}/rate`, { rating });
      setMessage("Thanks for rating your driver.");
      setCurrentRide(null);
      setTracking(null);
    } catch (error) {
      setMessage(error.response?.data?.detail || "Could not submit rating.");
    }
  };

  useEffect(() => {
    const rideId = currentRide?.ride_id;
    if (!rideId) return;

    const poll = async () => {
      try {
        const response = await api.get(`/ride/${rideId}/tracking`);
        const liveData = response.data;

        setTracking(liveData);
        setCurrentRide((prev) => (prev ? { ...prev, ...liveData } : liveData));
        setNearbyDrivers(liveData.nearby_drivers || []);
        await updateRiderMap(liveData);

        if (liveData.polyline) {
          await drawRouteOnMap(riderMap.current, riderRouteLine, liveData.polyline);
        }

        if (liveData.status === "cancelled") {
          setCurrentRide(null);
          setTracking(null);
          setMessage("Ride was cancelled.");
        }

        const historyResponse = await api.get("/rides/history");
        setHistory(historyResponse.data);
      } catch (error) {
        console.error("Real-time polling error:", error);
      }
    };

    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [currentRide?.ride_id]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watch = navigator.geolocation.watchPosition(
      async (position) => {
        try {
          await api.post("/rider/location", {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        } catch (error) {
          console.error(error);
        }
      },
      (error) => console.error(error),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, []);

  const selectedOption = fare?.options?.find((item) => item.vehicle_type === selectedVehicle);

  return (
    <div className="app-shell rider-page">
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
        <section className="rider-intro">
          <div>
            <span className="eyebrow">PUNE</span>
            <h1>Where to?</h1>
          </div>
          <div className="weather-mini">
            <span>{weather}</span>
            <strong>{temperature !== null ? `${temperature}°C` : "--"}</strong>
          </div>
        </section>

        <div className="rider-layout">
          <section className="panel booking-panel">
            
            <div className="search-box">
              <div className="search-line">
                <span className="dot pickup-dot" />
                <LocationInput value={pickup} onChange={setPickup} placeholder="Pickup location" />
              </div>
              <button type="button" className="ghost-link" onClick={useMyLocation}>
                Use current location
              </button>
              <div className="search-line">
                <span className="dot destination-dot" />
                <LocationInput
                  value={destination}
                  onChange={setDestination}
                  placeholder="Where are you going?"
                />
              </div>
              <button className="primary-btn wide" onClick={findRoute}>
                GET FARE
              </button>
            </div>

            {route && fare && !currentRide && (
              <div className="fare-preview">
                {/* --- IDEA 3: UPGRADED VEHICLE CARDS --- */}
                <div style={{ marginBottom: "12px" }}>
                  <span className="eyebrow" style={{ fontSize: "11px", color: "#6366f1" }}>CHOOSE RIDE OPTION</span>
                </div>
                <div className="vehicle-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "16px" }}>
  {fare.options.map((option, idx) => {
    const isSelected = selectedVehicle === option.vehicle_type;
    const isFastest = idx === 0; 
    return (
      <button
        type="button"
        key={option.vehicle_type}
        className={`vehicle-card ${isSelected ? "active" : ""}`}
        onClick={() => setSelectedVehicle(option.vehicle_type)}
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          alignItems: "flex-start",
          padding: "12px",
          borderRadius: "14px",
          background: isSelected ? "rgba(99, 102, 241, 0.15)" : "rgba(255, 255, 255, 0.04)",
          border: isSelected ? "2px solid #6366f1" : "1px solid rgba(255, 255, 255, 0.08)",
          cursor: "pointer",
          textAlign: "left",
          width: "100%",
          transition: "all 0.2s ease"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", marginBottom: "8px" }}>
          <span style={{ fontSize: "20px" }}>
            {option.vehicle_type === "mini" ? "🚗" : option.vehicle_type === "sedan" ? "🚙" : "🚐"}
          </span>
          {isFastest && (
            <span style={{ fontSize: "8px", fontWeight: "800", background: "#6366f1", color: "#000", padding: "2px 5px", borderRadius: "99px" }}>
              ⚡ FASTEST
            </span>
          )}
        </div>
        <div>
          <strong style={{ fontSize: "14px", color: "#fff", display: "block" }}>{option.name}</strong>
          <span style={{ fontSize: "11px", color: "#9ca3af", display: "block", marginBottom: "6px" }}>
            {option.eta_minutes} min · {option.seats} seats
          </span>
          <div style={{ fontSize: "15px", fontWeight: "900", color: "#fff" }}>₹{option.final_fare}</div>
        </div>
      </button>
    );
  })}
</div>

                <div className="fare-details">
                  <div>
                    <span>Distance</span>
                    <strong>{route.distance_km} km</strong>
                  </div>
                  <div>
                    <span>Traffic</span>
                    <strong>{route.traffic}</strong>
                  </div>
                  <div>
                    <span>Weather</span>
                    <strong>{fare.weather}</strong>
                  </div>
                  <div>
                    <span>Pay</span>
                    <strong>Cash</strong>
                  </div>
                </div>
                <p className="fare-reason">{fare.ai_reason}</p>
                <button className="primary-btn wide" onClick={confirmRide}>
                  CONFIRM {selectedOption?.name?.toUpperCase()} · ₹{selectedOption?.final_fare}
                </button>
              </div>
            )}

            {currentRide && (
              <div className="live-ride-card">
                <div className="ride-top">
                  <div>
                    <span className="eyebrow">RIDE #{currentRide.ride_id}</span>
                    <h2>{tracking?.status || currentRide.status}</h2>
                  </div>
                  <span className="status-pill live">● LIVE</span>
                </div>

                {/* --- IDEA 2: VISUAL 4-STEP PROGRESS STEPPER --- */}
                {(() => {
                  const currentStep = getStepIndex(tracking?.status || currentRide.status);
                  const steps = [
                    { num: 1, label: "Finding" },
                    { num: 2, label: "Accepted" },
                    { num: 3, label: "On Trip" },
                    { num: 4, label: "Arrived" },
                  ];
                  return (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "16px 0 20px 0", padding: "0 4px", position: "relative" }}>
                      {steps.map((s) => {
                        const isDone = currentStep >= s.num;
                        const isCurrent = currentStep === s.num;
                        return (
                          <div key={s.num} style={{ display: "flex", flexDirection: "column", alignItems: "center", zIndex: 2, flex: 1 }}>
                            <div style={{
                              width: "28px",
                              height: "28px",
                              borderRadius: "50%",
                              background: isDone ? "#6366f1" : "rgba(255,255,255,0.1)",
                              border: isCurrent ? "2px solid #fff" : "none",
                              color: isDone ? "#000" : "#9ca3af",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "12px",
                              fontWeight: "800",
                              boxShadow: isCurrent ? "0 0 10px rgba(249,115,22,0.6)" : "none"
                            }}>
                              {isDone && currentStep > s.num ? "✓" : s.num}
                            </div>
                            <span style={{ fontSize: "10px", marginTop: "6px", color: isCurrent ? "#fff" : "#9ca3af", fontWeight: isCurrent ? "700" : "500", textAlign: "center" }}>
                              {s.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
                {/* --------------------------------------------- */}
                <div className="trip-meta">
                  <div>
                    <span>Fare</span>
                    <strong>₹{currentRide.fare}</strong>
                  </div>
                  <div>
                    <span>Distance</span>
                    <strong>{currentRide.distance_km} km</strong>
                  </div>
                  <div>
                    <span>Cab</span>
                    <strong>{currentRide.vehicle_type}</strong>
                  </div>
                </div>
                {tracking?.driver_name && (
                  <div className="driver-live">
                    <span>DRIVER</span>
                    <strong>{tracking.driver_name}</strong>
                    <small>
                      {tracking.driver_vehicle || "Live location enabled"} · ★{tracking.driver_rating}
                    </small>
                  </div>
                )}
               {(tracking?.otp || currentRide?.otp) && (
                  <div className="otp-rider">
                    <span>RIDE OTP</span>
                    <strong>{tracking?.otp || currentRide?.otp}</strong>
                    <small>Share this with your driver</small>
                  </div>
                )}
                {["requested", "accepted"].includes(tracking?.status || currentRide.status) && (
                  <button className="secondary-btn wide" onClick={cancelRide}>
                    CANCEL RIDE
                  </button>
                )}
                {(tracking?.status || currentRide.status) === "completed" && (
                  <div className="rating-box">
                    <label>Rate your driver</label>
                    <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
                      {[5, 4, 3, 2, 1].map((value) => (
                        <option key={value} value={value}>
                          {value} star{value > 1 ? "s" : ""}
                        </option>
                      ))}
                    </select>
                    <button className="primary-btn wide" onClick={submitRating}>
                      SUBMIT RATING
                    </button>
                  </div>
                )}
              </div>
            )}

            {history.length > 0 && (
              <div className="history-list">
                <span className="eyebrow">RECENT RIDES</span>
                {history.slice(0, 5).map((ride) => (
                  <div key={ride.ride_id} className="history-item">
                    <strong>
                      {ride.pickup} → {ride.destination}
                    </strong>
                    <span>
                      ₹{ride.fare} · {ride.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="panel map-panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">LIVE MAP</span>
                <h2>Pune</h2>
              </div>
              <span className="nearby-radius">{nearbyDrivers.length} nearby</span>
            </div>
            <div ref={riderMapRef} className="real-map" />
          </section>
        </div>
      </main>
      {message && <div className="toast">{message}</div>}
      <AIAssistant
        role="rider"
        onAgentBookRide={handleAgentBookRide}
        currentRide={currentRide}
        weather={weather}
        temperature={temperature}
      />
    </div>
  );
}