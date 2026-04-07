import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Circle, Tooltip, Popup, useMap } from "react-leaflet";
import { useState, useEffect } from "react";

// ── Camera definitions (Bangalore coords — adjust to your real location) ──
export const CAMERAS = [
  { id: "cam1", label: "Laptop", lat: 12.9716, lng: 77.5906, status: "Active" },
  { id: "cam2", label: "Front door", lat: 12.9745, lng: 77.6125, status: "Active" },
  { id: "cam3", label: "Extra", lat: 12.9615, lng: 77.6155, status: "Active" }
];

// Helper to center map
function FlyToLocation({ coords }: { coords?: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (coords) {
      map.flyTo(coords, 16, { duration: 1.5 });
    }
  }, [coords, map]);
  return null;
}

// Map a free-text location string to one of our camera IDs
export function resolveCamera(location?: string): string | null {
  if (!location || location.toLowerCase() === "unknown") return null;
  const loc = location.toLowerCase();

  if (loc.includes("cam1") || loc.includes("gate") || loc.includes("entry")) return "cam1";
  if (loc.includes("cam2") || loc.includes("hall") || loc.includes("main")
    || loc.includes("laptop") || loc.includes("desk")) return "cam2";
  if (loc.includes("cam3") || loc.includes("south") || loc.includes("exit")) return "cam3";
  if (loc.includes("cam4") || loc.includes("north") || loc.includes("perim")) return "cam4";
  if (loc.includes("cam5") || loc.includes("cargo") || loc.includes("bay")) return "cam5";

  return "cam1";
}

// ── Props ─────────────────────────────────────────────────────────────────
interface TacticalMapProps {
  /** Location string from Pinecone match metadata */
  activeLocation?: string;
  /** Array of location strings for multiple matches */
  activeLocations?: string[];
  /** Whether the search found a match */
  matchFound?: boolean;
  /** Similarity % to show in the popup */
  similarity?: number;
  height?: string;
  /** For programmatically centering the map */
  focusCoords?: [number, number];
  /** Callback when user clicks a marker */
  onMarkerClick?: (camId: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────
const TacticalMap = ({
  activeLocation,
  activeLocations = [],
  matchFound = false,
  similarity,
  height = "380px",
  focusCoords,
  onMarkerClick,
}: TacticalMapProps) => {
  const activeCamIds = new Set<string>();
  if (activeLocation) {
    const res = resolveCamera(activeLocation);
    if (res) activeCamIds.add(res);
  }
  activeLocations.forEach(loc => {
    const res = resolveCamera(loc);
    if (res) activeCamIds.add(res);
  });

  const [pulse, setPulse] = useState(50);

  // Animate pulse rings when a match is found
  useEffect(() => {
    if (!matchFound || activeCamIds.size === 0) return;
    setPulse(50);
    const interval = setInterval(() => {
      setPulse(p => (p > 400 ? 50 : p + 18));
    }, 100);
    return () => clearInterval(interval);
  }, [matchFound, activeLocation, activeLocations.join(',')]);

  return (
    <MapContainer
      center={[12.9716, 77.5980]}
      zoom={14}
      style={{ height, width: "100%", borderRadius: "10px" }}
      zoomControl={true}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
      />

      <FlyToLocation coords={focusCoords} />

      {CAMERAS.map(cam => {
        const isActive = activeCamIds.has(cam.id) && matchFound;
        const isOffline = cam.status === "Offline";

        return (
          <div key={cam.id}>
            {/* Camera dot */}
            <Circle
              center={[cam.lat, cam.lng]}
              radius={isActive ? 30 : 22}
              eventHandlers={{
                click: () => onMarkerClick?.(cam.id)
              }}
              pathOptions={{
                color: isActive ? "#ff3b3b" : isOffline ? "#4b5563" : "#00e0ff",
                fillColor: isActive ? "#ff3b3b" : isOffline ? "#1f2937" : "#00e0ff",
                fillOpacity: 1,
                weight: 2,
              }}
            >
              <Tooltip
                permanent
                direction="top"
                offset={[0, -12]}
                className={isActive ? "camera-active" : "camera-inactive"}
              >
                {cam.label} {isOffline && "(Offline)"}
              </Tooltip>

              {(isActive || similarity) && (
                <Popup>
                  <div style={{ color: "#111", fontWeight: 600, minWidth: 140 }}>
                    {isActive ? "🎯 Match Detected" : "📷 Camera Info"}<br />
                    {similarity && (
                      <span style={{ color: "#dc2626" }}>
                        {similarity}% similarity
                      </span>
                    )}
                    <br />
                    <small style={{ color: "#555" }}>
                      {cam.label} · {cam.status}
                    </small>
                    <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid #eee", fontSize: 10 }}>
                      Lat: {cam.lat.toFixed(4)}, Lng: {cam.lng.toFixed(4)}
                    </div>
                  </div>
                </Popup>
              )}
            </Circle>

            {/* Pulse rings on active camera */}
            {isActive && (
              <>
                {[0, 120, 240].map((offset, i) => (
                  <Circle
                    key={i}
                    center={[cam.lat, cam.lng]}
                    radius={pulse + offset}
                    pathOptions={{
                      color: "#ff3b3b",
                      weight: 1.5,
                      opacity: 0.6 - i * 0.18,
                      fillOpacity: 0,
                    }}
                  />
                ))}
              </>
            )}
          </div>
        );
      })}
    </MapContainer>
  );
};

export default TacticalMap;