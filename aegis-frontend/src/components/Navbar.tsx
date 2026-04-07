import "./Navbar.css";
import { useEffect, useState } from "react";
import { useCases } from "../context/CaseContext";
import { useAlert } from "../context/AlertContext";

const Navbar = () => {
  const [time, setTime] = useState("");
  const { cases, totalMatches, avgAccuracy } = useCases();
  const { alerts, backendStatus } = useAlert();

  const activeCases = cases.filter(c => c.status !== "Resolved").length;
  const liveAlerts  = alerts.filter(a =>
    a.type !== "CONNECTION_ERROR" && !a.message.startsWith("✅")
  ).length;

  const systemOk = backendStatus === "ok";

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="navbar">

      <div className="brand">
        <span className="brand-name">AEGIS </span>
        <span className="brand-divider">| </span>
        <span className="brand-module"> Mission Control</span>
      </div>

      <div className="center-metrics">
        <div className="metric">
          <span className="metric-value">{activeCases}</span>
          <span className="metric-label">Active Cases</span>
        </div>

        <div className="metric">
          <span className="metric-value">{liveAlerts}</span>
          <span className="metric-label">Live Alerts</span>
        </div>

        <div className="metric">
          <span className="metric-value">{totalMatches}</span>
          <span className="metric-label">Detections</span>
        </div>

        <div className="metric">
          <span className="metric-value">
            {avgAccuracy > 0 ? `${avgAccuracy}%` : "—"}
          </span>
          <span className="metric-label">AI Accuracy</span>
        </div>
      </div>

      <div className="right-section">
        <div className={`live-status ${systemOk ? "" : "status-error"}`}>
          <span className={`dot ${systemOk ? "" : "dot-error"}`} />
          {systemOk ? "System Active" : "System Error"}
        </div>
        <div className="time">{time}</div>
      </div>

    </div>
  );
};

export default Navbar;