import { useState, useEffect, useCallback } from "react";

// ── Keep in sync with Settings.tsx ─────────────────────────────────────────
export interface AppSettings {
  fastapiUrl: string;
  nodeServerUrl: string;
  apiGatewayUrl: string;
  healthPollInterval: number;
  highConfidenceThreshold: number;
  possibleMatchThreshold: number;
  lowSimilarityThreshold: number;
  maxResults: number;
  notifyOnHighConfidence: boolean;
  notifyOnPossibleMatch: boolean;
  notifyOnLowSimilarity: boolean;
  notifyOnServerError: boolean;
  notifyOnCloudError: boolean;
  soundEnabled: boolean;
  showSimilarityBar: boolean;
  showMapOnMatch: boolean;
  compactCards: boolean;
  animationsEnabled: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  fastapiUrl: import.meta.env.VITE_FASTAPI_URL ?? "http://localhost:8000",
  nodeServerUrl: import.meta.env.VITE_API_URL ?? "http://localhost:3002",
  apiGatewayUrl:
    "https://ej1468d08i.execute-api.us-east-1.amazonaws.com/prod/search",
  healthPollInterval: 10,
  highConfidenceThreshold: 65,
  possibleMatchThreshold: 40,
  lowSimilarityThreshold: 25,
  maxResults: 5,
  notifyOnHighConfidence: true,
  notifyOnPossibleMatch: true,
  notifyOnLowSimilarity: false,
  notifyOnServerError: true,
  notifyOnCloudError: true,
  soundEnabled: false,
  showSimilarityBar: true,
  showMapOnMatch: true,
  compactCards: false,
  animationsEnabled: true,
};

const STORAGE_KEY = "aegis_settings";

function read(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

/**
 * Returns the current AEGIS settings and stays reactive:
 * - when the Settings page saves (same tab, via custom event)
 * - when another tab saves (via StorageEvent)
 */
export function useSettings(): AppSettings {
  const [settings, setSettings] = useState<AppSettings>(read);

  const refresh = useCallback(() => setSettings(read()), []);

  useEffect(() => {
    // Cross-tab updates
    window.addEventListener("storage", refresh);
    // Same-tab updates (dispatched by Settings.tsx on save)
    window.addEventListener("aegis-settings-saved", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("aegis-settings-saved", refresh);
    };
  }, [refresh]);

  return settings;
}
