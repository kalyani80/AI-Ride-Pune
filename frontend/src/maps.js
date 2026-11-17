import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

export const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export async function loadMaps() {
  if (!GOOGLE_KEY) {
    return false;
  }

  setOptions({
    key: GOOGLE_KEY,
    v: "weekly",
  });

  await importLibrary("maps");
  await importLibrary("geometry");
  await importLibrary("marker");
  await importLibrary("places");
  return true;
}

export async function createMap(ref, target) {
  if (!ref.current) {
    return null;
  }
  if (target.current) {
    return target.current;
  }

  const loaded = await loadMaps();
  if (!loaded) {
    return null;
  }

  const { Map } = await importLibrary("maps");
  target.current = new Map(ref.current, {
    center: { lat: 18.5204, lng: 73.8567 },
    zoom: 12,
    mapId: "DEMO_MAP_ID",
    streetViewControl: false,
    mapTypeControl: false,
    fullscreenControl: false,
    clickableIcons: false,
  });

  return target.current;
}

export async function addMarker(map, position, title, glyph = "D") {
  if (!map || !position) {
    return null;
  }

  const { AdvancedMarkerElement, PinElement } = await importLibrary("marker");
  const pin = new PinElement({
    glyphText: glyph,
    scale: 1.05,
  });

  return new AdvancedMarkerElement({
    map,
    position,
    title,
    content: pin.element,
  });
}

export function clearMarkers(ref) {
  ref.current.forEach((marker) => {
    marker.map = null;
  });
  ref.current = [];
}

export async function drawRouteOnMap(map, lineRef, encodedPolyline) {
  if (!map || !encodedPolyline) {
    return;
  }

  await importLibrary("geometry");
  const path = window.google.maps.geometry.encoding.decodePath(encodedPolyline);

  if (lineRef.current) {
    lineRef.current.setMap(null);
  }

  lineRef.current = new window.google.maps.Polyline({
    path,
    geodesic: true,
    strokeColor: "#ea8a17",
    strokeOpacity: 0.95,
    strokeWeight: 5,
    map,
  });

  const bounds = new window.google.maps.LatLngBounds();
  path.forEach((point) => bounds.extend(point));
  map.fitBounds(bounds);
}
