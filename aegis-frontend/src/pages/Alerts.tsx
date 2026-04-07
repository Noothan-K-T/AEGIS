import { useState, useEffect, useRef } from "react";
import "../styles/Alerts.css";
import { useAlert } from "../context/AlertContext";
import type { Alert, SystemStatus } from "../context/AlertContext";

// ── Status dot component ──────────────────────────────────────────────────
function StatusDot({ status, label }: { status: "online" | "offline" | SystemStatus; label: string }) {
  const isOk = status === "ok" || status === "online";
  const isChecking = status === "checking";
  return (
    <div className="status-item">
      <span className={`status-dot ${isOk ? "green" : isChecking ? "yellow" : "red"}`} />
      <span className="status-label">{label}</span>
      <span className={`status-value ${isOk ? "ok" : isChecking ? "checking" : "err"}`}>
        {isChecking ? "Checking…" : isOk ? "OK" : "Error"}
      </span>
    </div>
  );
}

// ── Section config ────────────────────────────────────────────────────────
const SECTIONS: { type: Alert["type"]; title: string; color: string; icon: string }[] = [
  { type: "PERSON_FOUND",     title: "Person Found",       color: "cyan",   icon: "🎯" },
  { type: "SYSTEM_ERROR",     title: "System Errors",      color: "orange", icon: "⚙️" },
  { type: "PROCESSING_ERROR", title: "Processing Errors",  color: "yellow", icon: "🖼️" },
  { type: "SERVER_ERROR",     title: "Server Errors",      color: "red",    icon: "🖥️" },
  { type: "CLOUD_ERROR",      title: "Cloud Errors",       color: "purple", icon: "☁️" },
  { type: "CONNECTION_ERROR", title: "Connection Errors",  color: "pink",   icon: "🌐" },
];

// ── AlertSection ──────────────────────────────────────────────────────────
function AlertSection({
  title,
  alerts,
  color,
  icon,
}: {
  title: string;
  alerts: Alert[];
  color: string;
  icon: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to top (newest alert) when alerts change
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [alerts.length]);

  return (
    <div className={`alert-section ${color}`}>
      <div className="section-header">
        <span className="section-icon">{icon}</span>
        <h3>{title}</h3>
        {alerts.length > 0 && (
          <span className="alert-count">{alerts.length}</span>
        )}
      </div>

      <div className="alert-list" ref={listRef}>
        {alerts.length === 0 ? (
          <p className="no-alert">No alerts</p>
        ) : (
          alerts.map((alert) => (
            <div key={alert.id} className="alert-card">
              <p className="alert-msg">{alert.message}</p>
              <span className="alert-time">{alert.time}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Main Alerts page ──────────────────────────────────────────────────────
export default function Alerts() {
  const {
    alerts,
    clearAlerts,
    clearAlertIndicator,
    networkStatus,
    backendStatus,
    cloudStatus,
  } = useAlert();

  const [muted, setMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevCountRef = useRef(alerts.length);

  useEffect(() => {
    audioRef.current = new Audio("/alert.mp3");
    clearAlertIndicator();
  }, [clearAlertIndicator]);

  // Play sound when new alerts arrive
  useEffect(() => {
    if (!muted && alerts.length > prevCountRef.current) {
      audioRef.current?.play().catch(() => {});
    }
    prevCountRef.current = alerts.length;
  }, [alerts.length, muted]);

  const totalErrors = alerts.filter((a) => a.type !== "PERSON_FOUND").length;

  return (
    <div className="alerts-page">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="alerts-header">
        <div>
          <h1>Alerts Monitor</h1>
          <p className="alerts-subtitle">
            {alerts.length === 0
              ? "All systems running normally"
              : `${alerts.length} total · ${totalErrors} errors`}
          </p>
        </div>

        <div className="alerts-header-actions">
          {alerts.length > 0 && (
            <button className="clear-btn" onClick={clearAlerts}>
              🗑 Clear All
            </button>
          )}
          <button className="mute-btn" onClick={() => setMuted(!muted)}>
            {muted ? "🔇 Unmute" : "🔊 Mute"}
          </button>
        </div>
      </div>

      {/* ── Live Status Strip ────────────────────────────────────────── */}
      <div className="status-strip">
        <div className="status-strip-label">Live Status</div>
        <StatusDot status={networkStatus} label="Network" />
        <div className="status-divider" />
        <StatusDot status={backendStatus} label="Backend" />
        <div className="status-divider" />
        <StatusDot status={cloudStatus} label="Cloud (Pinecone)" />
        <div className="status-live-badge">
          <span className="pulse-dot" />
          LIVE
        </div>
      </div>

      {/* ── Alert Grid ───────────────────────────────────────────────── */}
      <div className="alerts-grid">
        {SECTIONS.map(({ type, title, color, icon }) => (
          <AlertSection
            key={type}
            title={title}
            alerts={alerts.filter((a) => a.type === type)}
            color={color}
            icon={icon}
          />
        ))}
      </div>

    </div>
  );
}