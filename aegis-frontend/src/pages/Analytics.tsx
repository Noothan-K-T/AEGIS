import { useMemo } from "react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from "recharts";
import "../styles/Analytics.css";
import { useCases } from "../context/CaseContext";
import { useAlert } from "../context/AlertContext";

const COLORS = ["#00e0ff", "#ef4444", "#facc15", "#a855f7", "#22c55e", "#ec4899"];

// ── Custom tooltip ─────────────────────────────────────────────────────────
const ChartTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#0a1628", border: "1px solid #1e293b",
      borderRadius: 7, padding: "8px 12px", fontSize: 12,
    }}>
      {label && <p style={{ color: "#64748b", marginBottom: 4 }}>{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: <strong>{typeof p.value === "number" ? p.value.toFixed(1) : p.value}</strong>
        </p>
      ))}
    </div>
  );
};

export default function Analytics() {
  const { searchHistory, totalSearches, totalMatches, avgAccuracy, cases } = useCases();
  const { alerts } = useAlert();

  // ── Detection Rate — searches over time (last 20 records, chronological) ──
  const detectionRateData = useMemo(() => {
    return [...searchHistory].reverse().slice(-20).map((s, i) => ({
      index: i + 1,
      time:  new Date(s.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      found: s.found ? 1 : 0,
      total: 1,
    }));
  }, [searchHistory]);

  // ── Match Accuracy — similarity% per found search (last 15) ───────────────
  const accuracyData = useMemo(() => {
    return searchHistory
      .filter(s => s.found && s.similarity != null)
      .slice(0, 15)
      .reverse()
      .map((s, i) => ({
        index: i + 1,
        time:  new Date(s.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        similarity: s.similarity ?? 0,
      }));
  }, [searchHistory]);

  // ── Per-case searches bar chart ────────────────────────────────────────────
  const perCaseData = useMemo(() => {
    return cases
      .filter(c => c.searchCount > 0)
      .map(c => ({
        name:    c.title.length > 14 ? c.title.slice(0, 14) + "…" : c.title,
        searches: c.searchCount,
        matches:  c.status === "Matched" || c.status === "Resolved" ? 1 : 0,
      }))
      .slice(0, 8);
  }, [cases]);

  // ── Processing Time (ms → s) ───────────────────────────────────────────────
  const processingData = useMemo(() => {
    return [...searchHistory].reverse().slice(-15).map((s, i) => ({
      index: i + 1,
      time:  new Date(s.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      ms:    Math.round(s.processingMs / 100) / 10, // in seconds
    }));
  }, [searchHistory]);

  // ── Alert distribution ─────────────────────────────────────────────────────
  const alertDistData = useMemo(() => {
    const counts: Record<string, number> = {};
    alerts.forEach(a => { counts[a.type] = (counts[a.type] ?? 0) + 1; });
    return Object.entries(counts).map(([type, value]) => ({
      name: type.replace(/_/g, " "),
      value,
    }));
  }, [alerts]);

  const avgProcessingMs = useMemo(() => {
    if (!searchHistory.length) return 0;
    return Math.round(
      searchHistory.reduce((s, r) => s + r.processingMs, 0) / searchHistory.length
    );
  }, [searchHistory]);

  const matchRate = totalSearches ? Math.round((totalMatches / totalSearches) * 100) : 0;

  // ── UI ─────────────────────────────────────────────────────────────────────
  return (
    <div className="analytics">
      <div className="analytics-header">
        <h1>System Analytics</h1>
        <p className="analytics-subtitle">Real-time metrics from face recognition pipeline</p>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────── */}
      <div className="stat-cards">
        <StatCard label="Total Searches" value={totalSearches}         color="#00e0ff" icon="🔍" />
        <StatCard label="Matches Found"  value={totalMatches}           color="#22c55e" icon="🎯" />
        <StatCard label="Match Rate"     value={`${matchRate}%`}        color="#facc15" icon="📊" />
        <StatCard label="Avg Accuracy"   value={`${avgAccuracy}%`}      color="#a855f7" icon="🤖" />
        <StatCard label="Avg Ping (ms)"  value={avgProcessingMs}        color="#f59e0b" icon="⚡" />
        <StatCard label="Active Cases"   value={cases.filter(c => c.status !== "Resolved").length} color="#ec4899" icon="🗂" />
      </div>

      {/* ── Charts ─────────────────────────────────────────────────────── */}
      <div className="analytics-grid">

        {/* Detection Rate */}
        <div className="chart-card large">
          <h3>Detection Rate <span className="chart-tag">per search</span></h3>
          {detectionRateData.length === 0
            ? <EmptyChart msg="Run searches to see data" />
            : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={detectionRateData}>
                  <defs>
                    <linearGradient id="gFound" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#00e0ff" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00e0ff" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time" stroke="#475569" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#475569" tick={{ fontSize: 10 }} />
                  <Tooltip content={<ChartTip />} />
                  <Area
                    type="monotone" dataKey="found"
                    stroke="#00e0ff" fill="url(#gFound)" name="Match"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )
          }
        </div>

        {/* Match Accuracy */}
        <div className="chart-card large">
          <h3>Match Accuracy <span className="chart-tag">similarity %</span></h3>
          {accuracyData.length === 0
            ? <EmptyChart msg="No matches yet" />
            : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={accuracyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time" stroke="#475569" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} stroke="#475569" tick={{ fontSize: 10 }} />
                  <Tooltip content={<ChartTip />} />
                  <Line
                    type="monotone" dataKey="similarity"
                    stroke="#22c55e" strokeWidth={2}
                    dot={{ fill: "#22c55e", r: 3 }}
                    name="Similarity %"
                  />
                </LineChart>
              </ResponsiveContainer>
            )
          }
        </div>

        {/* Per-case searches */}
        <div className="chart-card medium">
          <h3>Searches per Case</h3>
          {perCaseData.length === 0
            ? <EmptyChart msg="No cases with searches" />
            : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={perCaseData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#475569" tick={{ fontSize: 9 }} />
                  <YAxis stroke="#475569" tick={{ fontSize: 10 }} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="searches" fill="#3b82f6" radius={[4,4,0,0]} name="Searches" />
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </div>

        {/* Processing time */}
        <div className="chart-card medium">
          <h3>Processing Time <span className="chart-tag">seconds</span></h3>
          {processingData.length === 0
            ? <EmptyChart msg="Run searches to see data" />
            : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={processingData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time" stroke="#475569" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#475569" tick={{ fontSize: 10 }} />
                  <Tooltip content={<ChartTip />} />
                  <Line
                    type="monotone" dataKey="ms"
                    stroke="#f59e0b" strokeWidth={2}
                    dot={{ fill: "#f59e0b", r: 3 }}
                    name="Seconds"
                  />
                </LineChart>
              </ResponsiveContainer>
            )
          }
        </div>

        {/* Alert distribution */}
        <div className="chart-card wide">
          <h3>Alert Distribution</h3>
          {alertDistData.length === 0
            ? <EmptyChart msg="No alerts recorded" />
            : (
              <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={alertDistData} dataKey="value" outerRadius={80} innerRadius={40}>
                      {alertDistData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pie-legend">
                  {alertDistData.map((d, i) => (
                    <div key={i} className="pie-legend-item">
                      <span className="legend-dot" style={{ background: COLORS[i % COLORS.length] }} />
                      <span>{d.name}</span>
                      <span className="legend-val">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          }
        </div>

      </div>
    </div>
  );
}

function StatCard({ label, value, color, icon }: { label: string; value: string | number; color: string; icon: string }) {
  return (
    <div className="stat-card">
      <span className="stat-icon">{icon}</span>
      <span className="stat-value" style={{ color }}>{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

function EmptyChart({ msg }: { msg: string }) {
  return (
    <div className="empty-chart">
      <p>{msg}</p>
    </div>
  );
}