import { useState, useEffect } from "react";
import "../styles/Settings.css";
import { useAlert } from "../context/AlertContext";
import { useCases } from "../context/CaseContext";
import { type AppSettings, DEFAULT_SETTINGS } from "../hooks/useSettings";

const STORAGE_KEY = "aegis_settings";

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

// ── Tab definitions ───────────────────────────────────────────────────────────
const TABS = [
  { id: "system",        label: "System",        icon: "⚙️" },
  { id: "detection",     label: "Detection",      icon: "🎯" },
  { id: "notifications", label: "Notifications",  icon: "🔔" },
  { id: "display",       label: "Display",        icon: "🖥️" },
  { id: "data",          label: "Data & Privacy", icon: "🗄️" },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ── Re-usable sub-components ──────────────────────────────────────────────────
function SettingRow({
  label,
  sub,
  children,
}: {
  label: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="setting-row">
      <div className="setting-row-text">
        <span className="setting-label">{label}</span>
        {sub && <span className="setting-sub">{sub}</span>}
      </div>
      <div className="setting-row-control">{children}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
}) {
  return (
    <label className="toggle" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="toggle-track">
        <span className="toggle-thumb" />
      </span>
    </label>
  );
}

function SliderInput({
  value,
  min,
  max,
  step = 1,
  unit = "%",
  onChange,
  color,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
  color?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="slider-wrap">
      <div
        className="slider-track"
        style={
          {
            "--pct": `${pct}%`,
            "--track-color": color ?? "#00e0ff",
          } as React.CSSProperties
        }
      >
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="slider-input"
        />
      </div>
      <span className="slider-val" style={{ color: color ?? "#00e0ff" }}>
        {value}
        {unit}
      </span>
    </div>
  );
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="settings-card">
      <div className="settings-card-header">
        <span className="settings-card-icon">{icon}</span>
        <h3>{title}</h3>
      </div>
      <div className="settings-card-body">{children}</div>
    </div>
  );
}

// ── Main Settings Page ────────────────────────────────────────────────────────
export default function Settings() {
  const [activeTab, setActiveTab] = useState<TabId>("system");
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [saved, setSaved] = useState(false);
  const [confirmData, setConfirmData] = useState<string | null>(null);

  const { clearAlerts, alerts, backendStatus, cloudStatus, networkStatus } =
    useAlert();
  const { cases, clearAllCases } = useCases();

  // Persist on every change and notify any listening components (e.g. Dashboard)
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new Event("aegis-settings-saved"));
  }, [settings]);

  const patch = (partial: Partial<AppSettings>) =>
    setSettings((prev) => ({ ...prev, ...partial }));

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new Event("aegis-settings-saved"));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleReset = () => {
    setSettings({ ...DEFAULT_SETTINGS });
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event("aegis-settings-saved"));
  };

  const handleDataAction = (action: string) => {
    setConfirmData(action);
  };

  const confirmAction = () => {
    if (confirmData === "clear_alerts") clearAlerts();
    else if (confirmData === "clear_cases") clearAllCases?.();
    else if (confirmData === "clear_session") {
      sessionStorage.clear();
    } else if (confirmData === "clear_all") {
      clearAlerts();
      clearAllCases?.();
      sessionStorage.clear();
      localStorage.removeItem(STORAGE_KEY);
      setSettings({ ...DEFAULT_SETTINGS });
    }
    setConfirmData(null);
  };

  // ── Status indicators for System tab ─────────────────────────────────────
  const statusDot = (s: "ok" | "error" | "checking" | "online" | "offline") => {
    const map: Record<string, string> = {
      ok: "#22c55e",
      online: "#22c55e",
      error: "#ef4444",
      offline: "#ef4444",
      checking: "#f59e0b",
    };
    return (
      <span
        className="status-pip"
        style={{ background: map[s] ?? "#64748b" }}
      />
    );
  };

  return (
    <div className="settings-page">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="settings-header">
        <div>
          <h1>System Settings</h1>
          <p className="settings-subtitle">
            Configure AEGIS surveillance platform behaviour and thresholds
          </p>
        </div>
        <div className="settings-header-actions">
          <button className="btn-ghost" onClick={handleReset}>
            ↺ Reset Defaults
          </button>
          <button
            className={`btn-save ${saved ? "btn-saved" : ""}`}
            onClick={handleSave}
          >
            {saved ? "✓ Saved!" : "💾 Save Changes"}
          </button>
        </div>
      </div>

      {/* ── Tab nav ─────────────────────────────────────────────────────── */}
      <div className="settings-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`settings-tab ${activeTab === t.id ? "active" : ""}`}
            onClick={() => setActiveTab(t.id)}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────── */}
      <div className="settings-body">
        {/* ════════════ SYSTEM ════════════ */}
        {activeTab === "system" && (
          <>
            {/* Live Status Card */}
            <SectionCard title="System Status" icon="📡">
              <div className="status-grid">
                <div className="status-item">
                  {statusDot(networkStatus)}
                  <div>
                    <span className="status-name">Internet</span>
                    <span
                      className="status-val"
                      style={{
                        color:
                          networkStatus === "online" ? "#22c55e" : "#ef4444",
                      }}
                    >
                      {networkStatus === "online" ? "Online" : "Offline"}
                    </span>
                  </div>
                </div>
                <div className="status-item">
                  {statusDot(backendStatus)}
                  <div>
                    <span className="status-name">FastAPI Backend</span>
                    <span
                      className="status-val"
                      style={{
                        color:
                          backendStatus === "ok"
                            ? "#22c55e"
                            : backendStatus === "checking"
                            ? "#f59e0b"
                            : "#ef4444",
                      }}
                    >
                      {backendStatus === "ok"
                        ? "Running"
                        : backendStatus === "checking"
                        ? "Checking…"
                        : "Unreachable"}
                    </span>
                  </div>
                </div>
                <div className="status-item">
                  {statusDot(cloudStatus)}
                  <div>
                    <span className="status-name">Cloud / Pinecone</span>
                    <span
                      className="status-val"
                      style={{
                        color:
                          cloudStatus === "ok"
                            ? "#22c55e"
                            : cloudStatus === "checking"
                            ? "#f59e0b"
                            : "#ef4444",
                      }}
                    >
                      {cloudStatus === "ok"
                        ? "Healthy"
                        : cloudStatus === "checking"
                        ? "Checking…"
                        : "Degraded"}
                    </span>
                  </div>
                </div>
                <div className="status-item">
                  <span
                    className="status-pip"
                    style={{ background: "#3b82f6" }}
                  />
                  <div>
                    <span className="status-name">Active Cases</span>
                    <span className="status-val" style={{ color: "#3b82f6" }}>
                      {cases.filter((c) => c.status !== "Resolved").length}
                    </span>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="API Endpoints" icon="🔗">
              <SettingRow
                label="FastAPI Server URL"
                sub="Used for /search, /health, and /alerts"
              >
                <input
                  className="settings-input"
                  value={settings.fastapiUrl}
                  onChange={(e) => patch({ fastapiUrl: e.target.value })}
                  placeholder="http://localhost:8000"
                />
              </SettingRow>
              <SettingRow
                label="Node.js Gateway URL"
                sub="Used for alert polling and FCM relay"
              >
                <input
                  className="settings-input"
                  value={settings.nodeServerUrl}
                  onChange={(e) => patch({ nodeServerUrl: e.target.value })}
                  placeholder="http://localhost:3002"
                />
              </SettingRow>
              <SettingRow
                label="AWS API Gateway URL"
                sub="Lambda function endpoint for cloud face search"
              >
                <input
                  className="settings-input"
                  value={settings.apiGatewayUrl}
                  onChange={(e) => patch({ apiGatewayUrl: e.target.value })}
                  placeholder="https://..."
                />
              </SettingRow>
            </SectionCard>

            <SectionCard title="Polling Intervals" icon="🔄">
              <SettingRow
                label="Backend Health Poll"
                sub="How often to check if FastAPI is reachable"
              >
                <SliderInput
                  value={settings.healthPollInterval}
                  min={5}
                  max={60}
                  step={5}
                  unit="s"
                  color="#00e0ff"
                  onChange={(v) => patch({ healthPollInterval: v })}
                />
              </SettingRow>
            </SectionCard>
          </>
        )}

        {/* ════════════ DETECTION ════════════ */}
        {activeTab === "detection" && (
          <>
            <SectionCard title="Confidence Thresholds" icon="🏅">
              <div className="threshold-visual">
                <div
                  className="tv-segment"
                  style={{ background: "linear-gradient(90deg,#14532d55,#22c55e33)", flex: 100 - settings.highConfidenceThreshold }}
                >
                  <span style={{ color: "#22c55e" }}>HIGH ≥ {settings.highConfidenceThreshold}%</span>
                </div>
                <div
                  className="tv-segment"
                  style={{ background: "linear-gradient(90deg,#78350f55,#f59e0b33)", flex: settings.highConfidenceThreshold - settings.possibleMatchThreshold }}
                >
                  <span style={{ color: "#f59e0b" }}>POSSIBLE ≥ {settings.possibleMatchThreshold}%</span>
                </div>
                <div
                  className="tv-segment"
                  style={{ background: "linear-gradient(90deg,#7c2d1255,#f9731633)", flex: settings.possibleMatchThreshold - settings.lowSimilarityThreshold }}
                >
                  <span style={{ color: "#f97316" }}>LOW ≥ {settings.lowSimilarityThreshold}%</span>
                </div>
                <div
                  className="tv-segment"
                  style={{ background: "#1e293b55", flex: settings.lowSimilarityThreshold }}
                >
                  <span style={{ color: "#64748b" }}>CANDIDATE</span>
                </div>
              </div>

              <SettingRow
                label="High Confidence Threshold"
                sub="Score above this = definite match (green badge)"
              >
                <SliderInput
                  value={settings.highConfidenceThreshold}
                  min={50}
                  max={95}
                  color="#22c55e"
                  onChange={(v) => {
                    const next = Math.max(v, settings.possibleMatchThreshold + 5);
                    patch({ highConfidenceThreshold: next });
                  }}
                />
              </SettingRow>

              <SettingRow
                label="Possible Match Threshold"
                sub="Score above this = possible match (amber badge)"
              >
                <SliderInput
                  value={settings.possibleMatchThreshold}
                  min={20}
                  max={settings.highConfidenceThreshold - 5}
                  color="#f59e0b"
                  onChange={(v) => {
                    const next = Math.max(v, settings.lowSimilarityThreshold + 5);
                    patch({ possibleMatchThreshold: next });
                  }}
                />
              </SettingRow>

              <SettingRow
                label="Low Similarity Threshold"
                sub="Score above this = low similarity (orange badge)"
              >
                <SliderInput
                  value={settings.lowSimilarityThreshold}
                  min={5}
                  max={settings.possibleMatchThreshold - 5}
                  color="#f97316"
                  onChange={(v) => patch({ lowSimilarityThreshold: v })}
                />
              </SettingRow>
            </SectionCard>

            <SectionCard title="Search Parameters" icon="🔍">
              <SettingRow
                label="Max Results Returned"
                sub="How many Pinecone matches to display per search"
              >
                <SliderInput
                  value={settings.maxResults}
                  min={1}
                  max={20}
                  unit=""
                  color="#7c3aed"
                  onChange={(v) => patch({ maxResults: v })}
                />
              </SettingRow>
            </SectionCard>

            <SectionCard title="Threshold Reference" icon="📋">
              <div className="threshold-table">
                <div className="tt-row tt-head">
                  <span>Tier</span><span>Range</span><span>Action</span>
                </div>
                <div className="tt-row">
                  <span style={{ color: "#22c55e" }}>HIGH</span>
                  <span>≥ {settings.highConfidenceThreshold}%</span>
                  <span>Alert + Case updated + Map pulse</span>
                </div>
                <div className="tt-row">
                  <span style={{ color: "#f59e0b" }}>POSSIBLE</span>
                  <span>
                    {settings.possibleMatchThreshold}–
                    {settings.highConfidenceThreshold - 1}%
                  </span>
                  <span>Near-miss alert + Map pulse</span>
                </div>
                <div className="tt-row">
                  <span style={{ color: "#f97316" }}>LOW</span>
                  <span>
                    {settings.lowSimilarityThreshold}–
                    {settings.possibleMatchThreshold - 1}%
                  </span>
                  <span>Map pulse only</span>
                </div>
                <div className="tt-row">
                  <span style={{ color: "#64748b" }}>CANDIDATE</span>
                  <span>&lt; {settings.lowSimilarityThreshold}%</span>
                  <span>Displayed, no alert</span>
                </div>
              </div>
            </SectionCard>
          </>
        )}

        {/* ════════════ NOTIFICATIONS ════════════ */}
        {activeTab === "notifications" && (
          <>
            <SectionCard title="Match Alerts" icon="🚨">
              <SettingRow
                label="High Confidence Match"
                sub="Alert when similarity ≥ High threshold"
              >
                <Toggle
                  id="notif-high"
                  checked={settings.notifyOnHighConfidence}
                  onChange={(v) => patch({ notifyOnHighConfidence: v })}
                />
              </SettingRow>
              <SettingRow
                label="Possible Match"
                sub="Alert on near-miss matches"
              >
                <Toggle
                  id="notif-possible"
                  checked={settings.notifyOnPossibleMatch}
                  onChange={(v) => patch({ notifyOnPossibleMatch: v })}
                />
              </SettingRow>
              <SettingRow
                label="Low Similarity"
                sub="Alert on low-confidence detections (noisy)"
              >
                <Toggle
                  id="notif-low"
                  checked={settings.notifyOnLowSimilarity}
                  onChange={(v) => patch({ notifyOnLowSimilarity: v })}
                />
              </SettingRow>
            </SectionCard>

            <SectionCard title="System Alerts" icon="⚠️">
              <SettingRow
                label="Backend Server Errors"
                sub="Alert when FastAPI becomes unreachable"
              >
                <Toggle
                  id="notif-server"
                  checked={settings.notifyOnServerError}
                  onChange={(v) => patch({ notifyOnServerError: v })}
                />
              </SettingRow>
              <SettingRow
                label="Cloud / Pinecone Errors"
                sub="Alert when Lambda or Pinecone health check fails"
              >
                <Toggle
                  id="notif-cloud"
                  checked={settings.notifyOnCloudError}
                  onChange={(v) => patch({ notifyOnCloudError: v })}
                />
              </SettingRow>
            </SectionCard>

            <SectionCard title="Audio" icon="🔊">
              <SettingRow
                label="Alert Sound"
                sub="Play a beep when a high-confidence match is detected"
              >
                <Toggle
                  id="notif-sound"
                  checked={settings.soundEnabled}
                  onChange={(v) => patch({ soundEnabled: v })}
                />
              </SettingRow>
            </SectionCard>

            <div className="info-banner">
              <span>ℹ️</span>
              <p>
                Push notifications via <strong>Firebase Cloud Messaging</strong>{" "}
                require browser permission. Click the 🔔 button on the Dashboard
                to enable.
              </p>
            </div>
          </>
        )}

        {/* ════════════ DISPLAY ════════════ */}
        {activeTab === "display" && (
          <>
            <SectionCard title="Results Display" icon="🖼️">
              <SettingRow
                label="Show Similarity Bar"
                sub="Render the coloured percentage bar on match cards"
              >
                <Toggle
                  id="disp-bar"
                  checked={settings.showSimilarityBar}
                  onChange={(v) => patch({ showSimilarityBar: v })}
                />
              </SettingRow>
              <SettingRow
                label="Auto-Show Map on Match"
                sub="Highlight the camera location on the tactical map after detection"
              >
                <Toggle
                  id="disp-map"
                  checked={settings.showMapOnMatch}
                  onChange={(v) => patch({ showMapOnMatch: v })}
                />
              </SettingRow>
              <SettingRow
                label="Compact Case Cards"
                sub="Use condensed view in the Cases list"
              >
                <Toggle
                  id="disp-compact"
                  checked={settings.compactCards}
                  onChange={(v) => patch({ compactCards: v })}
                />
              </SettingRow>
            </SectionCard>

            <SectionCard title="Animations" icon="✨">
              <SettingRow
                label="UI Animations"
                sub="Enable scan beams, pulse effects and transitions"
              >
                <Toggle
                  id="disp-anim"
                  checked={settings.animationsEnabled}
                  onChange={(v) => patch({ animationsEnabled: v })}
                />
              </SettingRow>
            </SectionCard>

            <SectionCard title="About AEGIS" icon="🛡️">
              <div className="about-grid">
                <div className="about-item"><span>Platform</span><strong>AEGIS Mission Control</strong></div>
                <div className="about-item"><span>Face Engine</span><strong>InsightFace + Pinecone</strong></div>
                <div className="about-item"><span>Backend</span><strong>FastAPI (Python)</strong></div>
                <div className="about-item"><span>Gateway</span><strong>Node.js + AWS Lambda</strong></div>
                <div className="about-item"><span>Push Alerts</span><strong>Firebase Cloud Messaging</strong></div>
                <div className="about-item"><span>Maps</span><strong>Leaflet.js</strong></div>
                <div className="about-item"><span>Version</span><strong>1.0.0-beta</strong></div>
                <div className="about-item"><span>Build</span><strong>React 18 + Vite + TypeScript</strong></div>
              </div>
            </SectionCard>
          </>
        )}

        {/* ════════════ DATA ════════════ */}
        {activeTab === "data" && (
          <>
            <SectionCard title="Storage Summary" icon="💾">
              <div className="data-stats">
                <div className="ds-item">
                  <span className="ds-num">{alerts.length}</span>
                  <span className="ds-label">Stored Alerts</span>
                </div>
                <div className="ds-item">
                  <span className="ds-num">{cases.length}</span>
                  <span className="ds-label">Total Cases</span>
                </div>
                <div className="ds-item">
                  <span className="ds-num">
                    {cases.reduce((s, c) => s + (c.notes?.length ?? 0), 0)}
                  </span>
                  <span className="ds-label">Total Notes</span>
                </div>
                <div className="ds-item">
                  <span className="ds-num">
                    {cases.reduce((s, c) => s + (c.searchCount ?? 0), 0)}
                  </span>
                  <span className="ds-label">Total Searches</span>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Clear Data" icon="🗑️">
              <div className="data-actions">
                <DataActionRow
                  label="Clear Alert History"
                  sub="Remove all stored alerts from localStorage"
                  btnLabel="Clear Alerts"
                  danger
                  onClick={() => handleDataAction("clear_alerts")}
                />
                <DataActionRow
                  label="Clear Session Data"
                  sub="Remove last scan result and preview from sessionStorage"
                  btnLabel="Clear Session"
                  onClick={() => handleDataAction("clear_session")}
                />
                <DataActionRow
                  label="Delete All Cases"
                  sub="Permanently remove all cases, notes and search records"
                  btnLabel="Delete Cases"
                  danger
                  onClick={() => handleDataAction("clear_cases")}
                />
                <DataActionRow
                  label="Factory Reset"
                  sub="Clear all data including alerts, cases and settings"
                  btnLabel="Reset Everything"
                  danger
                  onClick={() => handleDataAction("clear_all")}
                />
              </div>
            </SectionCard>

            <SectionCard title="Data Retention Policy" icon="📄">
              <div className="policy-text">
                <p>
                  All data is stored <strong>locally in the browser</strong> via
                  localStorage and sessionStorage. No personal data is sent to
                  third-party analytics services.
                </p>
                <p>
                  Face embeddings processed via FastAPI are queried against your
                  Pinecone index and are{" "}
                  <strong>not permanently stored by AEGIS</strong> — only search
                  metadata (timestamp, similarity score, location) is retained.
                </p>
                <p>
                  Alert history is capped at <strong>100 entries</strong> and
                  persisted across reloads. Cases, notes and search records are
                  persisted indefinitely until manually deleted.
                </p>
              </div>
            </SectionCard>
          </>
        )}
      </div>

      {/* ── Confirm modal ─────────────────────────────────────────────────── */}
      {confirmData && (
        <div
          className="confirm-overlay"
          onClick={() => setConfirmData(null)}
        >
          <div
            className="confirm-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="confirm-icon">⚠️</div>
            <h3>Confirm Action</h3>
            <p>
              {confirmData === "clear_alerts" &&
                "This will permanently remove all stored alerts."}
              {confirmData === "clear_session" &&
                "This will remove the last scan result and preview."}
              {confirmData === "clear_cases" &&
                "This will permanently delete ALL cases, notes, and search history. This cannot be undone."}
              {confirmData === "clear_all" &&
                "This will reset everything — alerts, cases, session data and settings — to factory defaults. This cannot be undone."}
            </p>
            <div className="confirm-actions">
              <button
                className="btn-ghost"
                onClick={() => setConfirmData(null)}
              >
                Cancel
              </button>
              <button className="btn-danger" onClick={confirmAction}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Data action row helper ─────────────────────────────────────────────────────
function DataActionRow({
  label,
  sub,
  btnLabel,
  danger = false,
  onClick,
}: {
  label: string;
  sub: string;
  btnLabel: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <div className="data-action-row">
      <div>
        <span className="setting-label">{label}</span>
        <span className="setting-sub">{sub}</span>
      </div>
      <button
        className={danger ? "btn-danger-outline" : "btn-neutral"}
        onClick={onClick}
      >
        {btnLabel}
      </button>
    </div>
  );
}