import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Cases.css";
import { useCases } from "../context/CaseContext";
import type { Case } from "../context/CaseContext";

const PRIORITY_COLORS: Record<Case["priority"], string> = {
  High:   "#ef4444",
  Medium: "#f59e0b",
  Low:    "#22c55e",
};

const STATUS_STYLES: Record<Case["status"], { label: string; color: string }> = {
  Open:       { label: "Open",       color: "#3b82f6" },
  Searching:  { label: "Searching",  color: "#facc15" },
  Matched:    { label: "Matched ✓",  color: "#22c55e" },
  "No Match": { label: "No Match",   color: "#f87171" },
  Resolved:   { label: "Resolved",   color: "#64748b" },
};

// ── Canvas compress to base64 ──────────────────────────────────────────────
// Quality 0.95 + 1100px max: high enough that face embeddings stay consistent
// with Pinecone-ingested embeddings (lower quality shifts the embedding vector)
function compressToBase64(file: File, maxDim = 1100, quality = 0.95): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}

// ── Component ──────────────────────────────────────────────────────────────
export default function Cases() {
  const navigate  = useNavigate();
  const {
    cases, createCase, resolveCase, deleteCase,
    setActiveCaseId, activeCaseId, addNote,
  } = useCases();

  const photoRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title:    "",
    suspect:  "",
    priority: "Medium" as Case["priority"],
  });
  const [formPhoto, setFormPhoto]   = useState<string | null>(null); // base64
  const [compressing, setCompr]     = useState(false);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [noteText,   setNoteText]   = useState("");
  const [filter,     setFilter]     = useState<"all" | "open" | "resolved">("all");

  const selectedCase = cases.find(c => c.id === selectedId) ?? null;

  // ── Photo pick ───────────────────────────────────────────────────────────
  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompr(true);
    try {
      const b64 = await compressToBase64(file);
      setFormPhoto(b64);
    } catch {
      alert("Could not process image. Try a different file.");
    } finally {
      setCompr(false);
    }
  };

  // ── Create ────────────────────────────────────────────────────────────────
  const handleCreate = () => {
    if (!form.title.trim()) return;
    const c = createCase({ ...form, photo: formPhoto ?? undefined });
    setSelectedId(c.id);
    setForm({ title: "", suspect: "", priority: "Medium" });
    setFormPhoto(null);
  };

  // ── Start search ──────────────────────────────────────────────────────────
  const handleStartSearch = (caseId: number) => {
    setActiveCaseId(caseId);
    navigate("/");
  };

  // ── Note ──────────────────────────────────────────────────────────────────
  const handleAddNote = () => {
    if (!noteText.trim() || !selectedCase) return;
    addNote(selectedCase.id, noteText.trim());
    setNoteText("");
  };

  const filtered = cases.filter(c => {
    if (filter === "open")     return c.status !== "Resolved";
    if (filter === "resolved") return c.status === "Resolved";
    return true;
  });

  // ── UI ─────────────────────────────────────────────────────────────────────
  return (
    <div className="cases-page">

      <div className="cases-header">
        <div>
          <h1>Case Management</h1>
          <p className="cases-subtitle">
            {cases.filter(c => c.status !== "Resolved").length} active ·{" "}
            {cases.filter(c => c.status === "Matched").length} matched ·{" "}
            {cases.filter(c => c.status === "Resolved").length} resolved
          </p>
        </div>
        <div className="filter-tabs">
          {(["all","open","resolved"] as const).map(f => (
            <button
              key={f}
              className={`filter-tab ${filter === f ? "active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="cases-grid">

        {/* ── CREATE FORM ──────────────────────────────────────────────── */}
        <div className="cases-create-panel">
          <h3>New Case</h3>

          {/* Photo upload */}
          <label className="field-label">Subject Photo</label>
          <div
            className="photo-upload-box"
            onClick={() => photoRef.current?.click()}
          >
            {compressing && (
              <div className="photo-overlay">
                <span className="uploading-spin" />
                Compressing…
              </div>
            )}
            {formPhoto ? (
              <img src={formPhoto} alt="Subject" className="photo-preview-img" />
            ) : (
              <div className="photo-placeholder">
                <span>📷</span>
                <p>Upload subject photo</p>
              </div>
            )}
            {formPhoto && !compressing && (
              <div className="photo-change-hint">Click to change</div>
            )}
          </div>
          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            hidden
          />

          <label className="field-label">Case Title</label>
          <input
            className="cases-input"
            placeholder="e.g. Missing Person — Market District"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
          />

          <label className="field-label">Suspect / Subject Description</label>
          <textarea
            className="cases-textarea"
            placeholder="Physical description, last known location, relevant notes…"
            rows={3}
            value={form.suspect}
            onChange={e => setForm({ ...form, suspect: e.target.value })}
          />

          <label className="field-label">Priority</label>
          <div className="priority-selector">
            {(["Low","Medium","High"] as Case["priority"][]).map(p => (
              <button
                key={p}
                className={`priority-btn ${form.priority === p ? "selected" : ""}`}
                style={form.priority === p ? { borderColor: PRIORITY_COLORS[p], color: PRIORITY_COLORS[p] } : {}}
                onClick={() => setForm({ ...form, priority: p })}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            className="create-btn"
            onClick={handleCreate}
            disabled={!form.title.trim() || compressing}
          >
            + Create Case
          </button>
        </div>

        {/* ── CASE LIST ────────────────────────────────────────────────── */}
        <div className="cases-list-panel">
          {filtered.length === 0 && (
            <div className="cases-empty">
              <span>📁</span>
              <p>No cases — create one to start searching</p>
            </div>
          )}

          {filtered.map(c => {
            const st      = STATUS_STYLES[c.status];
            const isActive = c.id === activeCaseId;
            return (
              <div
                key={c.id}
                className={`case-card ${selectedId === c.id ? "selected" : ""} ${isActive ? "active-case" : ""}`}
                onClick={() => setSelectedId(c.id)}
              >
                <div className="case-card-top">

                  {/* Thumbnail */}
                  {c.photo && (
                    <img src={c.photo} alt="subject" className="case-thumb" />
                  )}
                  {!c.photo && (
                    <div className="case-thumb-placeholder">👤</div>
                  )}

                  <div className="case-card-info">
                    {isActive && <span className="active-badge">🔴 Active</span>}
                    <span className="case-card-title-text">{c.title}</span>
                    <span className="case-suspect-line">{c.suspect || "No description"}</span>

                    <div className="case-card-meta">
                      <span className="priority-chip" style={{ color: PRIORITY_COLORS[c.priority] }}>
                        ■ {c.priority}
                      </span>
                      <span className="meta-item">🔍 {c.searchCount}</span>
                      {c.lastSimilarity && (
                        <span className="meta-item">🎯 {c.lastSimilarity}%</span>
                      )}
                    </div>
                  </div>

                  <span
                    className="status-badge"
                    style={{ color: st.color, borderColor: st.color + "55" }}
                  >
                    {st.label}
                  </span>
                </div>

                <div className="case-card-actions" onClick={e => e.stopPropagation()}>
                  {c.status !== "Resolved" && (
                    <button className="action-btn search-action" onClick={() => handleStartSearch(c.id)}>
                      🔍 Start Search
                    </button>
                  )}
                  {c.status !== "Resolved" && (
                    <button className="action-btn resolve-action" onClick={() => resolveCase(c.id)}>
                      ✓ Resolve
                    </button>
                  )}
                  <button
                    className="action-btn delete-action"
                    onClick={() => { deleteCase(c.id); if (selectedId === c.id) setSelectedId(null); }}
                  >
                    🗑
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── DETAIL PANEL ─────────────────────────────────────────────── */}
        {selectedCase && (
          <div className="cases-detail-panel">
            {selectedCase.photo && (
              <div className="detail-photo-wrap">
                <img src={selectedCase.photo} alt="Subject" className="detail-photo" />
                <div className="detail-photo-overlay">
                  <span className="scan-line" />
                </div>
              </div>
            )}

            <div className="detail-header">
              <h3>{selectedCase.title}</h3>
              <span
                className="status-badge"
                style={{
                  color: STATUS_STYLES[selectedCase.status].color,
                  borderColor: STATUS_STYLES[selectedCase.status].color + "55",
                }}
              >
                {STATUS_STYLES[selectedCase.status].label}
              </span>
            </div>

            <div className="detail-grid">
              {[
                { label: "Priority", value: selectedCase.priority, color: PRIORITY_COLORS[selectedCase.priority] },
                { label: "Searches", value: selectedCase.searchCount },
                { label: "Created",  value: selectedCase.created },
                ...(selectedCase.lastSimilarity
                  ? [{ label: "Best Match", value: `${selectedCase.lastSimilarity}%`, color: "#22c55e" }]
                  : []),
              ].map((item, i) => (
                <div key={i} className="detail-item">
                  <span className="di-label">{item.label}</span>
                  <span className="di-value" style={item.color ? { color: item.color } : {}}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>

            {selectedCase.suspect && (
              <div className="detail-suspect">
                <span className="di-label">Description</span>
                <p>{selectedCase.suspect}</p>
              </div>
            )}

            <div className="notes-section">
              <span className="di-label">Notes</span>
              <div className="notes-list">
                {selectedCase.notes.length === 0 && <p className="no-notes">No notes</p>}
                {selectedCase.notes.map((n, i) => (
                  <div key={i} className="note-item">
                    <span className="note-bullet">▸</span>
                    <span>{n}</span>
                  </div>
                ))}
              </div>
              <div className="note-input-row">
                <input
                  className="note-input"
                  placeholder="Add note…"
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAddNote()}
                />
                <button className="note-add-btn" onClick={handleAddNote}>Add</button>
              </div>
            </div>

            {selectedCase.status !== "Resolved" && (
              <button className="create-btn" style={{ marginTop: 12 }} onClick={() => handleStartSearch(selectedCase.id)}>
                🔍 Start Search
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}