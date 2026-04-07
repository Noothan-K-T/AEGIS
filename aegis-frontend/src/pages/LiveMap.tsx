import { useState, useEffect } from "react";
import TacticalMap, { CAMERAS } from "../components/TacticalMap";
import "../styles/LiveMap.css";
import { useAlert } from "../context/AlertContext";
import { Search, MapPin, Radio, Activity } from "lucide-react";

const LiveMap = () => {
  const { alerts } = useAlert();
  const [search, setSearch] = useState("");
  const [focusCoords, setFocusCoords] = useState<[number, number] | undefined>();
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [recentDetections, setRecentDetections] = useState<any[]>([]);

  // Filter alerts for map detections
  useEffect(() => {
    const mapAlerts = alerts
      .filter((a) => a.type === "PERSON_FOUND" || a.type === "MATCH_FOUND")
      .slice(0, 10);
    setRecentDetections(mapAlerts);
  }, [alerts]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) return;

    setLoadingSearch(true);
    try {
      // Nominatim search restricted to Bangalore viewbox
      const query = encodeURIComponent(search + " Bangalore");
      const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;
      
      const res = await fetch(url);
      const data = await res.json();

      if (data && data.length > 0) {
        setFocusCoords([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
      }
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setLoadingSearch(false);
    }
  };

  const jumpToCamera = (cam: any) => {
    setFocusCoords([cam.lat, cam.lng]);
  };

  return (
    <div className="live-map-page">
      <div className="map-header">
        <div>
          <h1>Tactical Surveillance Map</h1>
          <p>Real-time asset tracking and geofencing</p>
        </div>
        <div className="live-indicator">
          <span className="live-dot" />
          <span>SYSTEM ACTIVE</span>
        </div>
      </div>

      <div className="map-container-layout">
        {/* ── Map Pane ── */}
        <div className="map-view-pane">
          <div className="map-search-overlay">
            <form onSubmit={handleSearch} className="search-input-wrap">
              <span className="search-icon">
                {loadingSearch ? <Activity size={16} className="spinning" /> : <Search size={16} />}
              </span>
              <input
                type="text"
                placeholder="Search area or pincode (e.g. 560001, MG Road)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </form>
          </div>

          <TacticalMap 
            height="100%" 
            focusCoords={focusCoords}
            onMarkerClick={(id) => {
              const cam = CAMERAS.find(c => c.id === id);
              if (cam) setFocusCoords([cam.lat, cam.lng]);
            }}
          />
        </div>

        {/* ── Sidebar ── */}
        <div className="map-sidebar">
          {/* Camera List */}
          <div className="sidebar-section" style={{ flex: 1 }}>
            <div className="section-header">
              <h3>Surveillance Points</h3>
              <Radio size={14} color="#64748b" />
            </div>
            <div className="camera-list">
              {CAMERAS.map((cam) => (
                <div 
                  key={cam.id} 
                  className={`camera-item ${focusCoords && focusCoords[0] === cam.lat ? 'active' : ''}`}
                  onClick={() => jumpToCamera(cam)}
                >
                  <MapPin size={14} className="cam-icon" />
                  <div className="cam-info">
                    <span className="cam-name">{cam.label}</span>
                    <span className="cam-status" style={{ color: cam.status === 'Offline' ? '#ef4444' : '#22c55e' }}>
                      {cam.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Detections Feed */}
          <div className="sidebar-section" style={{ height: '240px' }}>
            <div className="section-header">
              <h3>Live Detections</h3>
              <Activity size={14} color="#64748b" />
            </div>
            <div className="alerts-mini-feed">
              {recentDetections.length > 0 ? (
                recentDetections.map((alert) => (
                  <div key={alert.id} className="mini-alert">
                    <div className="ma-time">{alert.time}</div>
                    <div className="ma-msg">{alert.message}</div>
                    <div className="ma-loc">📍 Signal Detected</div>
                  </div>
                ))
              ) : (
                <div className="no-match-box" style={{ height: '100%', opacity: 0.5 }}>
                  <small>Waiting for signals...</small>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveMap;