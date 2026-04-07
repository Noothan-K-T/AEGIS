import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { messaging, onMessage } from "../firebase";

// ── Types ─────────────────────────────────────────────────────────────────
export interface Alert {
  id: number;
  type:
    | "PERSON_FOUND"
    | "SYSTEM_ERROR"
    | "PROCESSING_ERROR"
    | "SERVER_ERROR"
    | "CLOUD_ERROR"
    | "CONNECTION_ERROR";
  message: string;
  time: string;
}

export type SystemStatus = "ok" | "error" | "checking";

export interface AlertContextType {
  alerts: Alert[];
  addAlert: (alert: Alert) => void;
  clearAlerts: () => void;
  newAlert: boolean;
  clearAlertIndicator: () => void;
  networkStatus: "online" | "offline";
  backendStatus: SystemStatus;
  cloudStatus: SystemStatus;
}

// ── Context ───────────────────────────────────────────────────────────────
const AlertContext = createContext<AlertContextType | null>(null);

const API = import.meta.env.VITE_API_URL as string;

// ─────────────────────────────────────────────────────────────────────────────
// External internet probe — fetches a tiny cross-origin resource.
// navigator.onLine is UNRELIABLE on Windows (returns true even with WiFi off
// if virtual adapters like Docker/Hyper-V are present). This probe actually
// tries to reach the internet via CORS-bypass no-cors mode.
// ─────────────────────────────────────────────────────────────────────────────
async function probeInternet(): Promise<boolean> {
  // Try multiple lightweight targets — if ANY succeeds we're online
  const targets = [
    "https://1.1.1.1",                            // Cloudflare
    "https://dns.google",                          // Google DNS
    "https://www.google.com/favicon.ico",          // Google favicon
  ];

  for (const url of targets) {
    try {
      await fetch(url, {
        mode: "no-cors",
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      });
      return true; // opaque response = request succeeded
    } catch {
      // this target failed, try next
    }
  }
  return false; // all targets failed → truly offline
}

// ── Provider ──────────────────────────────────────────────────────────────
export const AlertProvider = ({ children }: { children: React.ReactNode }) => {
  const [alerts, setAlerts] = useState<Alert[]>(() => {
    try {
      const saved = localStorage.getItem("aegis_alerts");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [newAlert, setNewAlert] = useState(false);

  // Status strip
  const [networkStatus, setNetworkStatus] = useState<"online" | "offline">("online");
  const [backendStatus, setBackendStatus] = useState<SystemStatus>("checking");
  const [cloudStatus, setCloudStatus] = useState<SystemStatus>("checking");

  // Track last-seen alert IDs to deduplicate polled alerts
  const seenIds = useRef<Set<number>>(new Set());

  // ── Helpers ───────────────────────────────────────────────────────────────
  const addAlert = useCallback((alert: Alert) => {
    if (seenIds.current.has(alert.id)) return;
    seenIds.current.add(alert.id);
    setAlerts((prev) => [alert, ...prev].slice(0, 100));
    setNewAlert(true);
  }, []);

  const clearAlerts = useCallback(async () => {
    setAlerts([]);
    seenIds.current.clear();
    localStorage.removeItem("aegis_alerts");
    try {
      await fetch(`${API}/alerts`, { method: "DELETE" });
    } catch {}
  }, []);

  const clearAlertIndicator = useCallback(() => setNewAlert(false), []);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem("aegis_alerts", JSON.stringify(alerts));
  }, [alerts]);

  // Seed seenIds from initial localStorage load
  useEffect(() => {
    alerts.forEach((a) => seenIds.current.add(a.id));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ══════════════════════════════════════════════════════════════════════════
  // LAYER 1 — Real internet connectivity probe (every 15s)
  //
  // WHY: navigator.onLine / window.offline events are UNRELIABLE on Windows.
  // If Docker, Hyper-V, or VirtualBox virtual adapters are present, the OS
  // keeps reporting "online" even when physical WiFi/Ethernet is disconnected.
  // We probe REAL external URLs instead.
  // ══════════════════════════════════════════════════════════════════════════
  const internetWasDown = useRef(false);

  useEffect(() => {
    const checkInternet = async () => {
      const online = await probeInternet();

      if (!online && !internetWasDown.current) {
        // Just went offline
        internetWasDown.current = true;
        setNetworkStatus("offline");
        addAlert({
          id: Date.now(),
          type: "CONNECTION_ERROR",
          message: "🔴 Internet connection lost — cannot reach external services",
          time: new Date().toLocaleTimeString(),
        });
      } else if (online && internetWasDown.current) {
        // Came back online
        internetWasDown.current = false;
        setNetworkStatus("online");
        addAlert({
          id: Date.now(),
          type: "CONNECTION_ERROR",
          message: "✅ Internet connection restored",
          time: new Date().toLocaleTimeString(),
        });
      } else if (online) {
        setNetworkStatus("online");
      }
    };

    // Run immediately, then every 15s
    checkInternet();
    const interval = setInterval(checkInternet, 15_000);

    // Also keep browser events as a fast-path (fires instantly when they work)
    const handleOffline = () => {
      if (!internetWasDown.current) {
        internetWasDown.current = true;
        setNetworkStatus("offline");
        addAlert({
          id: Date.now(),
          type: "CONNECTION_ERROR",
          message: "🔴 Network disconnected (browser event)",
          time: new Date().toLocaleTimeString(),
        });
      }
    };
    const handleOnline = () => {
      // Don't trust browser online event alone — re-probe to confirm
      checkInternet();
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      clearInterval(interval);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [addAlert]);

  // ══════════════════════════════════════════════════════════════════════════
  // LAYER 2 — Backend health poll (every 10s → SERVER_ERROR)
  //
  // Note: We do NOT gate this on navigator.onLine (unreliable).
  // Even if internetWasDown, FastAPI runs locally so it can still be polled.
  // ══════════════════════════════════════════════════════════════════════════
  const backendWasDown = useRef(false);
  const backendFailCount = useRef(0);

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const res = await fetch(`${API}/health`, {
          signal: AbortSignal.timeout(5000),
          cache: "no-store",
        });

        if (res.ok) {
          setBackendStatus("ok");
          backendFailCount.current = 0;

          if (backendWasDown.current) {
            backendWasDown.current = false;
            addAlert({
              id: Date.now(),
              type: "SERVER_ERROR",
              message: "✅ Backend server (FastAPI) is back online",
              time: new Date().toLocaleTimeString(),
            });
          }
        } else {
          throw new Error(`HTTP ${res.status}`);
        }
      } catch (e: any) {
        backendFailCount.current += 1;
        setBackendStatus("error");

        // Only alert on first failure (not every poll while down)
        if (backendFailCount.current === 1) {
          backendWasDown.current = true;
          const isRefused =
            e?.message?.includes("fetch") ||
            e?.message?.includes("Failed") ||
            e?.name === "TypeError";

          addAlert({
            id: Date.now(),
            type: "SERVER_ERROR",
            message: isRefused
              ? "🔴 Cannot connect to backend server (FastAPI is down or not running)"
              : `🔴 Backend health check failed: ${e?.message || "unknown error"}`,
            time: new Date().toLocaleTimeString(),
          });
        } else if (backendFailCount.current % 6 === 0) {
          // Every ~60s while still down, add a reminder alert
          addAlert({
            id: Date.now(),
            type: "SERVER_ERROR",
            message: `⚠️ Backend still unreachable — ${backendFailCount.current * 10}s of downtime`,
            time: new Date().toLocaleTimeString(),
          });
        }
      }
    };

    checkBackend();
    const interval = setInterval(checkBackend, 10_000);
    return () => clearInterval(interval);
  }, [addAlert]);

  // ══════════════════════════════════════════════════════════════════════════
  // LAYER 3 — Cloud / Pinecone health poll (every 30s → CLOUD_ERROR)
  // ══════════════════════════════════════════════════════════════════════════
  const cloudWasDown = useRef(false);

  useEffect(() => {
    const checkCloud = async () => {
      if (backendStatus === "error") return; // backend must be up first
      try {
        const res = await fetch(`${API}/cloud-health`, {
          signal: AbortSignal.timeout(14_000),
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();

        if (data.status === "ok") {
          setCloudStatus("ok");
          if (cloudWasDown.current) {
            cloudWasDown.current = false;
            addAlert({
              id: Date.now(),
              type: "CLOUD_ERROR",
              message: "✅ Cloud (Lambda/Pinecone) is back online",
              time: new Date().toLocaleTimeString(),
            });
          }
        } else {
          setCloudStatus("error");
          if (!cloudWasDown.current) {
            cloudWasDown.current = true;
            addAlert({
              id: Date.now(),
              type: "CLOUD_ERROR",
              message: `🔴 Cloud service unavailable: ${data.detail || "Lambda/Pinecone unreachable"}`,
              time: new Date().toLocaleTimeString(),
            });
          }
        }
      } catch (e: any) {
        setCloudStatus("error");
        if (!cloudWasDown.current) {
          cloudWasDown.current = true;
          addAlert({
            id: Date.now(),
            type: "CLOUD_ERROR",
            message: `🔴 Cloud health check failed: ${e?.message || "cannot reach Lambda/Pinecone"}`,
            time: new Date().toLocaleTimeString(),
          });
        }
      }
    };

    checkCloud();
    const interval = setInterval(checkCloud, 30_000);
    return () => clearInterval(interval);
  }, [addAlert, backendStatus]);

  // ══════════════════════════════════════════════════════════════════════════
  // LAYER 4 — Alerts sync poll (every 15s)
  // Pulls PERSON_FOUND / PROCESSING_ERROR / SYSTEM_ERROR / CLOUD_ERROR
  // logged by FastAPI into alert_store during /search calls.
  //
  // Also generates SYSTEM_ERROR if the /alerts endpoint itself breaks
  // (backend is up but alerts endpoint fails 3x in a row).
  // ══════════════════════════════════════════════════════════════════════════
  const alertSyncFailCount = useRef(0);
  const alertSyncErrReported = useRef(false);

  useEffect(() => {
    const syncAlerts = async () => {
      if (backendStatus === "error") return;
      try {
        const res = await fetch(`${API}/alerts`, {
          signal: AbortSignal.timeout(8000),
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        alertSyncFailCount.current = 0;
        alertSyncErrReported.current = false;

        const data = await res.json();
        const incoming: Alert[] = (data.alerts || []).map((a: any) => ({
          id: a.id,
          type: a.type as Alert["type"],
          message: a.message,
          time: a.time
            ? new Date(a.time).toLocaleTimeString()
            : new Date().toLocaleTimeString(),
        }));

        incoming.forEach((a) => addAlert(a));
      } catch (e: any) {
        alertSyncFailCount.current += 1;

        // After 3 consecutive failures, report a SYSTEM_ERROR
        if (alertSyncFailCount.current >= 3 && !alertSyncErrReported.current) {
          alertSyncErrReported.current = true;
          addAlert({
            id: Date.now(),
            type: "SYSTEM_ERROR",
            message: `⚠️ Alerts endpoint failing repeatedly: ${e?.message || "sync error"}. Backend may have an internal issue.`,
            time: new Date().toLocaleTimeString(),
          });
        }
      }
    };

    syncAlerts();
    const interval = setInterval(syncAlerts, 15_000);
    return () => clearInterval(interval);
  }, [addAlert, backendStatus]);

  // ══════════════════════════════════════════════════════════════════════════
  // LAYER 5 — FCM (optional, works only when VAPID key is set)
  // ══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    try {
      const unsubscribe = onMessage(messaging, (payload) => {
        console.log("FCM Payload received:", payload);
        const type = (payload.data?.alert_type as Alert["type"]) || "SYSTEM_ERROR";
        const message =
          payload.notification?.body ||
          payload.notification?.title ||
          "Unknown FCM Alert";
        addAlert({
          id: Date.now(),
          type,
          message,
          time: new Date().toLocaleTimeString(),
        });
      });
      return () => unsubscribe();
    } catch {
      // FCM not configured — ignore silently
    }
  }, [addAlert]);

  return (
    <AlertContext.Provider
      value={{
        alerts,
        addAlert,
        clearAlerts,
        newAlert,
        clearAlertIndicator,
        networkStatus,
        backendStatus,
        cloudStatus,
      }}
    >
      {children}
    </AlertContext.Provider>
  );
};

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) throw new Error("useAlert must be used inside AlertProvider");
  return context;
};