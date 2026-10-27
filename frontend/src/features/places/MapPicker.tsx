import "leaflet/dist/leaflet.css";

import { useEffect } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";

export interface MapPickerProps {
  latitude: number | null;
  longitude: number | null;
  onPick: (latitude: number, longitude: number) => void;
  label: string;
}

const WORLD: [number, number] = [20, 0];

/**
 * A map to pick a site's location by tapping it. Tiles come from OpenStreetMap, so the browser
 * contacts tile.openstreetmap.org while this map is shown.
 */
export default function MapPicker({ latitude, longitude, onPick, label }: MapPickerProps) {
  const position: [number, number] | null =
    latitude !== null && longitude !== null ? [latitude, longitude] : null;
  return (
    <MapContainer
      center={position ?? WORLD}
      zoom={position ? 14 : 2}
      style={{ height: 260, borderRadius: "var(--mantine-radius-md)" }}
      aria-label={label}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {position && (
        <CircleMarker
          center={position}
          radius={9}
          pathOptions={{ color: "#2a8540", fillColor: "#40c057", fillOpacity: 0.9 }}
        />
      )}
      <ClickToPick onPick={onPick} />
      <FollowPosition position={position} />
    </MapContainer>
  );
}

function ClickToPick({ onPick }: { onPick: MapPickerProps["onPick"] }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

/**
 * Keeps the chosen spot in view: when the position changes (a tap, typed coordinates, or "use
 * my location"), zoom in on it if the map shows too large an area, or move to it if it's off
 * screen.
 */
function FollowPosition({ position }: { position: [number, number] | null }) {
  const map = useMap();
  const lat = position ? position[0] : null;
  const lng = position ? position[1] : null;
  useEffect(() => {
    if (lat === null || lng === null) {
      return;
    }
    const zoomedOut = map.getZoom() < 10;
    if (zoomedOut || !map.getBounds().contains([lat, lng])) {
      map.setView([lat, lng], Math.max(map.getZoom(), 14));
    }
  }, [map, lat, lng]);
  return null;
}
