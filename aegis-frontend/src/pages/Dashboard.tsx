import { useState, useRef, useEffect } from "react";
import "../styles/Dashboard.css";
import { requestNotificationPermission } from "../firebase";
import type { SearchResult, FaceMatch } from "../types";
import { useAlert } from "../context/AlertContext";
import { useCases } from "../context/CaseContext";
import TacticalMap from "../components/TacticalMap";
import { useSettings } from "../hooks/useSettings";


type StepStatus = "idle" | "active" | "done" | "error";

const PIPELINE_STEPS = [
  { label: "Subject Loaded", sub: "Image ready for processing" },
  { label: "Face Detection", sub: "InsightFace analyzing image" },
  { label: "Querying Pinecone", sub: "Searching face database" },
  { label: "Result Ready", sub: "Pipeline complete" },
];

// ── Confidence tier (thresholds come from Settings) ───────────────────────
function getConfidenceTier(
  pct: number,
  high: number,
  possible: number,
  low: number,
): { label: string; color: string; bg: string; barColor: string } {
  if (pct >= high) return { label: "HIGH CONFIDENCE", color: "#22c55e", bg: "#14532d33", barColor: "#22c55e" };
  if (pct >= possible) return { label: "POSSIBLE MATCH", color: "#f59e0b", bg: "#78350f33", barColor: "#f59e0b" };
  if (pct >= low) return { label: "LOW SIMILARITY", color: "#f97316", bg: "#7c2d1233", barColor: "#f97316" };
  return { label: "CANDIDATE", color: "#64748b", bg: "#1e293b33", barColor: "#475569" };
}

// ── Pipeline step UI ──────────────────────────────────────────────────────
function PipelineStep({
  step, status, last,
}: { step: typeof PIPELINE_STEPS[0]; status: StepStatus; last: boolean }) {
  return (
    <div className="pipeline-row">
      <div className={`p-icon ${status}`}>
        {status === "done" && "✓"}
        {status === "error" && "✗"}
        {status === "active" && <span className="p-spinner" />}
        {status === "idle" && "·"}
      </div>
      <div className="p-info">
        <span className="p-label">{step.label}</span>
        <span className="p-sub">{step.sub}</span>
      </div>
      {!last && <div className={`p-line ${status === "done" ? "filled" : ""}`} />}
    </div>
  );
}

// ── Results panel ─────────────────────────────────────────────────────────
function ResultsView({
  result,
  high,
  possible,
  low,
  showBar,
}: {
  result: SearchResult;
  high: number;
  possible: number;
  low: number;
  showBar: boolean;
}) {
  const matches: FaceMatch[] = result.matches ?? [];
  const bestPct = matches[0]?.similarity_percent ?? 0;

  let mainBadge: { label: string; cls: string };
  if (result.message === "No face detected") {
    mainBadge = { label: "✗ NO FACE DETECTED", cls: "no-match" };
  } else if (bestPct >= high) {
    mainBadge = { label: "✓ MATCH FOUND", cls: "found" };
  } else if (bestPct >= possible) {
    mainBadge = { label: "~ POSSIBLE MATCH", cls: "possible" };
  } else if (bestPct >= low) {
    mainBadge = { label: "⚠ LOW SIMILARITY", cls: "low-sim" };
  } else if (matches.length > 0) {
    mainBadge = { label: "· CANDIDATES ONLY", cls: "candidates" };
  } else {
    mainBadge = { label: "✗ NO MATCH FOUND", cls: "no-match" };
  }

  return (
    <div className="results-inner">
      <div className="results-top-row">
        <div className={`result-badge ${mainBadge.cls}`}>
          {mainBadge.label}
        </div>
        {matches.length > 0 && (
          <span className="match-count-label">
            {matches.length} result{matches.length !== 1 ? "s" : ""} from Pinecone
          </span>
        )}
      </div>

      {result.message === "No face detected" && (
        <div className="no-match-box">
          <span>🔍</span>
          <p>No face detected in the image</p>
          <small>Try a clearer, more frontal photo with better lighting</small>
        </div>
      )}

      {matches.length > 0 && (
        <div className="match-cards-row">
          {matches.map((m: FaceMatch, i: number) => {
            const tier = getConfidenceTier(m.similarity_percent, high, possible, low);
            return (
              <div key={i} className="match-card" style={{ borderColor: tier.color + "55" }}>
                <div
                  className="tier-badge"
                  style={{ color: tier.color, background: tier.bg, border: `1px solid ${tier.color}44` }}
                >
                  {tier.label}
                </div>

                <div className="similarity">
                  <span>Rank #{i + 1}</span>
                  <span className="sim-value" style={{ color: tier.color }}>
                    {m.similarity_percent}%
                  </span>
                </div>

                {showBar && (
                  <div className="bar">
                    <div
                      className="fill"
                      style={{
                        width: `${m.similarity_percent}%`,
                        background: `linear-gradient(90deg, ${tier.barColor}aa, ${tier.barColor})`,
                      }}
                    />
                  </div>
                )}

                <div className="meta">
                  {m.metadata.location && <p>📍 {m.metadata.location}</p>}
                  {m.metadata.timestamp && <p>🕐 {m.metadata.timestamp}</p>}
                  {m.metadata.device_id && <p>📷 {m.metadata.device_id}</p>}
                  {m.metadata.label && <p>🔖 {m.metadata.label}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {matches.length === 0 && result.message !== "No face detected" && (
        <div className="no-match-box">
          <span>🔍</span>
          <p>Face detected — no matches in database</p>
          <small>The face was processed but found no similar records in Pinecone</small>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function Dashboard() {
  const { addAlert } = useAlert();
  const {
    activeCase, activeCaseId, setActiveCaseId,
    addSearchRecord, cases,
  } = useCases();

  // All live settings from the Settings page
  const {
    highConfidenceThreshold: HIGH,
    possibleMatchThreshold: POSSIBLE,
    lowSimilarityThreshold: LOW,
    fastapiUrl,
    showMapOnMatch,
    showSimilarityBar,
    maxResults,
    notifyOnHighConfidence,
    notifyOnPossibleMatch,
    notifyOnLowSimilarity,
    soundEnabled,
  } = useSettings();

  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notifOn, setNotifOn] = useState(false);
  const [steps, setSteps] = useState<StepStatus[]>(["idle", "idle", "idle", "idle"]);
  const [photoSource, setPhotoSource] = useState<"case" | "manual" | null>(null);

  const [mapLocations, setMapLocations] = useState<string[]>([]);
  const [mapSimilarity, setMapSimilar] = useState<number | undefined>();
  const [mapFound, setMapFound] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    requestNotificationPermission().then(t => { if (t) setNotifOn(true); });
  }, []);

  // Auto-load case photo when active case changes
  useEffect(() => {
    if (!activeCase?.photo) return;
    fetch(activeCase.photo)
      .then(r => r.blob())
      .then(blob => {
        const file = new File([blob], `${activeCase.title}.jpg`, { type: blob.type });
        setImage(file);
        setPreview(activeCase.photo!);
        setSteps(["done", "idle", "idle", "idle"]);
        setPhotoSource("case");
        setResult(null);
        setError(null);
        setMapFound(false);
        setMapLocations([]);
      })
      .catch(() => { });
  }, [activeCase?.id]);

  // Restore session
  useEffect(() => {
    const r = sessionStorage.getItem("last_scan_result");
    const p = sessionStorage.getItem("last_scan_preview");
    if (r && !activeCase?.photo) setResult(JSON.parse(r));
    if (p && !activeCase?.photo) setPreview(p);
  }, []);

  useEffect(() => {
    if (result) sessionStorage.setItem("last_scan_result", JSON.stringify(result));
    if (preview) sessionStorage.setItem("last_scan_preview", preview);
  }, [result, preview]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImage(file);
    setPreview(URL.createObjectURL(file));
    setPhotoSource("manual");
    setResult(null);
    setError(null);
    setSteps(["done", "idle", "idle", "idle"]);
    setMapFound(false);
    setMapLocations([]);
  };

  const handleSearch = async () => {
    if (!image) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setMapFound(false);
    setMapLocations([]);
    setSteps(["done", "active", "idle", "idle"]);

    const startMs = Date.now();
    timerRef.current = setTimeout(() => setSteps(["done", "done", "active", "idle"]), 700);

    try {
      const formData = new FormData();
      formData.append("file", image);
      formData.append("top_k", String(maxResults));  // from Settings → Max Results

      const res = await fetch(`${fastapiUrl}/search`, {
        method: "POST",
        body: formData,
      });

      if (timerRef.current) clearTimeout(timerRef.current);
      const processingMs = Date.now() - startMs;

      if (!res.ok) {
        const err = await res.json();
        const msg = err.detail || "Search failed";
        if (msg.toLowerCase().includes("face") || msg.toLowerCase().includes("embed")) {
          setSteps(["done", "error", "idle", "idle"]);
        } else {
          setSteps(["done", "done", "error", "idle"]);
        }
        throw new Error(msg);
      }

      const data: SearchResult = await res.json();
      setResult(data);

      const noFace = data.message === "No face detected";
      const matches = data.matches ?? [];
      const topMatch = matches[0];
      const location = topMatch?.metadata?.location || topMatch?.metadata?.device_id;

      if (noFace) {
        setSteps(["done", "error", "idle", "idle"]);
      } else {
        setSteps(["done", "done", "done", "done"]);
        // Map pulse for matches at or above the LOW threshold (from Settings)
        if (showMapOnMatch && matches.length > 0) {
          const validMatches = matches.filter(m => m.similarity_percent >= LOW);
          if (validMatches.length > 0) {
            const locs = validMatches.map(m => m.metadata?.location || m.metadata?.device_id).filter(Boolean) as string[];
            setMapLocations(locs);
            setMapSimilar(validMatches[0].similarity_percent);
            setMapFound(data.found);
          }
        }
      }

      // Alerts — gated by notification settings
      const topPct = topMatch?.similarity_percent ?? 0;
      if (data.found && topMatch && notifyOnHighConfidence) {
        addAlert({
          id: Date.now(),
          type: "PERSON_FOUND",
          message: `Person detected at ${location || "unknown"} (${topPct}% match)`,
          time: new Date().toLocaleTimeString(),
        });
        // Sound alert
        if (soundEnabled) {
          try {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.frequency.value = 880;
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
            osc.start(); osc.stop(ctx.currentTime + 0.4);
          } catch { }
        }
      } else if (!noFace && topMatch && topPct >= POSSIBLE && notifyOnPossibleMatch) {
        addAlert({
          id: Date.now(),
          type: "PROCESSING_ERROR",
          message: `Possible match: ${topPct}% at ${location || "unknown"}`,
          time: new Date().toLocaleTimeString(),
        });
      } else if (!noFace && topMatch && topPct >= LOW && notifyOnLowSimilarity) {
        addAlert({
          id: Date.now(),
          type: "PROCESSING_ERROR",
          message: `Low similarity: ${topPct}% at ${location || "unknown"}`,
          time: new Date().toLocaleTimeString(),
        });
      }

      addSearchRecord({
        caseId: activeCaseId ?? undefined,
        caseName: activeCase?.title,
        timestamp: new Date().toISOString(),
        found: data.found,
        similarity: topMatch?.similarity_percent,
        location,
        processingMs,
        imageName: image.name,
      });

    } catch (err: any) {
      if (timerRef.current) clearTimeout(timerRef.current);
      const msg = err.message || "Search failed";
      setError(msg);
      const isNetwork = msg.includes("fetch") || msg.includes("Failed") || msg.includes("network");
      addAlert({
        id: Date.now(),
        type: isNetwork ? "SERVER_ERROR" : "SYSTEM_ERROR",
        message: `Search error: ${msg}`,
        time: new Date().toLocaleTimeString(),
      });
      addSearchRecord({
        caseId: activeCaseId ?? undefined,
        caseName: activeCase?.title,
        timestamp: new Date().toISOString(),
        found: false,
        processingMs: Date.now() - startMs,
        imageName: image?.name,
      });
    } finally {
      setLoading(false);
    }
  };

  const openCases = cases.filter(c => c.status !== "Resolved");

  const toggleSound = () => {
    const raw = localStorage.getItem("aegis_settings");
    const current = raw ? JSON.parse(raw) : {};
    const newState = !soundEnabled;
    const updated = { ...current, soundEnabled: newState };

    localStorage.setItem("aegis_settings", JSON.stringify(updated));
    window.dispatchEvent(new Event("aegis-settings-saved"));

    if (newState) {
      requestNotificationPermission().then(granted => {
        if (granted) setNotifOn(true);
      });
    }
  };

  return (
    <div className="dashboard">

      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1>Surveillance Operations</h1>
          <p className="db-subtitle">Face Recognition Search Pipeline</p>
        </div>
        <div className="db-header-right">
          <select
            className="case-selector"
            value={activeCaseId ?? ""}
            onChange={e => setActiveCaseId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">No case linked</option>
            {openCases.map(c => (
              <option key={c.id} value={c.id}>
                [{c.priority}] {c.title}
              </option>
            ))}
          </select>
          <button
            title={soundEnabled ? "Disable audio notifications" : "Enable audio notifications"}
            className={soundEnabled ? "notif-on" : "notif-off"}
            onClick={toggleSound}
            style={{ border: "none", cursor: "pointer", fontWeight: "inherit" }}
          >
            {soundEnabled ? "🔔 Live" : "🔕 Off"}
          </button>
        </div>
      </div>

      {/* Case banner */}
      {activeCase && (
        <div className={`case-banner priority-${activeCase.priority.toLowerCase()}`}>
          <div className="case-banner-left">
            <span className="case-banner-icon">🗂</span>
            <div>
              <span className="case-banner-title">{activeCase.title}</span>
              <span className="case-banner-meta">
                {activeCase.suspect ? `${activeCase.suspect.slice(0, 60)}… · ` : ""}
                Searches: {activeCase.searchCount} · {activeCase.status}
              </span>
            </div>
          </div>
          <button className="case-unlink" onClick={() => setActiveCaseId(null)}>✕ Unlink</button>
        </div>
      )}

      {/* Ops grid */}
      <div className="ops-grid">

        {/* ── SUBJECT PANEL (spans both rows) ────────────────────────────── */}
        <div className="subject-panel card">
          <div className="subject-panel-header">
            <h3>Subject</h3>
            {photoSource === "case" && activeCase && (
              <span className="photo-source-badge">From Case</span>
            )}
          </div>

          <div
            className={`subject-photo-wrap ${loading ? "scanning" : ""}`}
            onClick={() => fileRef.current?.click()}
            title="Click to upload a different image"
          >
            {preview ? (
              <>
                <img src={preview} alt="Subject" className="subject-photo" />
                <div className="subject-photo-overlay">
                  {loading && <div className="scan-beam" />}
                  <div className="photo-hover-hint">Click to change</div>
                </div>
              </>
            ) : (
              <div className="subject-upload-placeholder">
                <span>🎯</span>
                <p>Upload target face</p>
                <small>Or link a case to auto-load</small>
              </div>
            )}
          </div>

          <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange} hidden />

          {activeCase && (
            <div className="subject-case-info">
              <div className="sci-row">
                <span className="sci-label">Priority</span>
                <span className="sci-val" style={{
                  color: activeCase.priority === "High" ? "#ef4444"
                    : activeCase.priority === "Medium" ? "#f59e0b" : "#22c55e"
                }}>{activeCase.priority}</span>
              </div>
              <div className="sci-row">
                <span className="sci-label">Searches</span>
                <span className="sci-val">{activeCase.searchCount}</span>
              </div>
              {activeCase.lastSimilarity && (
                <div className="sci-row">
                  <span className="sci-label">Best Match</span>
                  <span className="sci-val" style={{ color: "#22c55e" }}>{activeCase.lastSimilarity}%</span>
                </div>
              )}
              {activeCase.lastSearch && (
                <div className="sci-row">
                  <span className="sci-label">Last Search</span>
                  <span className="sci-val">{activeCase.lastSearch}</span>
                </div>
              )}
              <div className="sci-status">{activeCase.status}</div>
            </div>
          )}
        </div>

        {/* ── PIPELINE PANEL ─────────────────────────────────────────────── */}
        <div className="pipeline-panel card">
          <h3>Operations Pipeline</h3>

          <div className="pipeline">
            {PIPELINE_STEPS.map((step, i) => (
              <PipelineStep key={i} step={step} status={steps[i]} last={i === PIPELINE_STEPS.length - 1} />
            ))}
          </div>

          <button
            onClick={handleSearch}
            disabled={!image || loading}
            className="search-btn"
            style={{ marginTop: "auto" }}
          >
            {loading ? <><span className="btn-spinner" /> Scanning…</> : "🔍 Start Detection"}
          </button>
        </div>

        {/* ── MAP PANEL ──────────────────────────────────────────────────── */}
        <div className="map-panel card">
          <div className="map-card-header">
            <h3>Surveillance Map</h3>
            {mapFound && <span className="map-alert-badge">🔴 Detection Active</span>}
          </div>
          <TacticalMap
            activeLocations={mapLocations}
            matchFound={mapFound}
            similarity={mapSimilarity}
            height="290px"
          />
          <div className="camera-legend">
            <span className="legend-cam normal">● Camera</span>
            <span className="legend-cam alert">● Match Detected</span>
          </div>
        </div>

        {/* ── RESULTS PANEL (spans cols 2-3) ─────────────────────────────── */}
        <div className="results-panel card">
          <h3>Detection Results</h3>

          {error && <div className="error">⚠ {error}</div>}

          {!result && !loading && !error && (
            <div className="placeholder-msg">
              <span>🧠</span>
              <p>Upload an image and run detection to see results here</p>
            </div>
          )}

          {loading && (
            <div className="placeholder-msg">
              <span className="large-spinner" />
              <p>Analyzing… please wait</p>
            </div>
          )}

          {result && !loading && (
            <ResultsView
              result={result}
              high={HIGH}
              possible={POSSIBLE}
              low={LOW}
              showBar={showSimilarityBar}
            />
          )}
        </div>

      </div>
    </div>
  );
}