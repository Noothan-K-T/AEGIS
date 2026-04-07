import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from "react";
import type { FaceMatch } from "../types";

// ── Types ─────────────────────────────────────────────────────────────────
export interface Case {
  id: number;
  title: string;
  suspect: string;
  priority: "Low" | "Medium" | "High";
  status: "Open" | "Searching" | "Matched" | "No Match" | "Resolved";
  created: string;
  lastSearch?: string;
  searchCount: number;
  lastSimilarity?: number;
  photo?: string; // base64 compressed JPEG for subject identification
  notes: string[];
}

export interface SearchRecord {
  id: number;
  caseId?: number;
  caseName?: string;
  timestamp: string;
  found: boolean;
  similarity?: number;
  location?: string;
  processingMs: number;
  imageName?: string;
}

export interface CaseContextType {
  cases: Case[];
  activeCaseId: number | null;
  activeCase: Case | null;
  searchHistory: SearchRecord[];
  totalSearches: number;
  totalMatches: number;
  avgAccuracy: number;
  createCase: (data: { title: string; suspect: string; priority: Case["priority"]; photo?: string }) => Case;
  setActiveCaseId: (id: number | null) => void;
  updateCase: (id: number, updates: Partial<Case>) => void;
  addSearchRecord: (record: Omit<SearchRecord, "id">) => void;
  resolveCase: (id: number) => void;
  addNote: (caseId: number, note: string) => void;
  deleteCase: (id: number) => void;
  clearAllCases: () => void;
}

// ── Context ───────────────────────────────────────────────────────────────
const CaseContext = createContext<CaseContextType | null>(null);

const KEY_CASES   = "aegis_cases";
const KEY_HISTORY = "aegis_search_history";

// ── Provider ──────────────────────────────────────────────────────────────
export const CaseProvider = ({ children }: { children: React.ReactNode }) => {
  const [cases, setCases] = useState<Case[]>(() => {
    try { return JSON.parse(localStorage.getItem(KEY_CASES) || "[]"); }
    catch { return []; }
  });

  const [activeCaseId, setActiveCaseId] = useState<number | null>(null);

  const [searchHistory, setSearchHistory] = useState<SearchRecord[]>(() => {
    try { return JSON.parse(localStorage.getItem(KEY_HISTORY) || "[]"); }
    catch { return []; }
  });

  // ── Computed ─────────────────────────────────────────────────────────────
  const activeCase = useMemo(
    () => cases.find(c => c.id === activeCaseId) ?? null,
    [cases, activeCaseId]
  );

  const totalSearches = searchHistory.length;
  const totalMatches  = useMemo(() => searchHistory.filter(s => s.found).length, [searchHistory]);

  const avgAccuracy = useMemo(() => {
    const found = searchHistory.filter(s => s.found && s.similarity != null);
    if (!found.length) return 0;
    return Math.round(
      found.reduce((sum, s) => sum + (s.similarity ?? 0), 0) / found.length * 10
    ) / 10;
  }, [searchHistory]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const persistCases = (updated: Case[]) => {
    localStorage.setItem(KEY_CASES, JSON.stringify(updated));
  };
  const persistHistory = (updated: SearchRecord[]) => {
    localStorage.setItem(KEY_HISTORY, JSON.stringify(updated.slice(0, 200)));
  };

  // ── Actions ───────────────────────────────────────────────────────────────
  const createCase = useCallback(
    (data: { title: string; suspect: string; priority: Case["priority"]; photo?: string }): Case => {
      const newCase: Case = {
        id: Date.now(),
        ...data,
        status: "Open",
        created: new Date().toLocaleString(),
        searchCount: 0,
        notes: [],
      };
      setCases(prev => {
        const updated = [newCase, ...prev];
        persistCases(updated);
        return updated;
      });
      return newCase;
    },
    []
  );

  const updateCase = useCallback((id: number, updates: Partial<Case>) => {
    setCases(prev => {
      const updated = prev.map(c => (c.id === id ? { ...c, ...updates } : c));
      persistCases(updated);
      return updated;
    });
  }, []);

  const addSearchRecord = useCallback(
    (record: Omit<SearchRecord, "id">) => {
      const newRecord: SearchRecord = { id: Date.now(), ...record };

      setSearchHistory(prev => {
        const updated = [newRecord, ...prev].slice(0, 200);
        persistHistory(updated);
        return updated;
      });

      // Update linked case via functional update (avoids stale closure)
      if (record.caseId) {
        setCases(prev => {
          const updated = prev.map(c => {
            if (c.id !== record.caseId) return c;
            return {
              ...c,
              searchCount: c.searchCount + 1,
              lastSearch: new Date().toLocaleTimeString(),
              status: record.found ? "Matched" : "No Match",
              lastSimilarity: record.found ? record.similarity : c.lastSimilarity,
            } as Case;
          });
          persistCases(updated);
          return updated;
        });
      }
    },
    []
  );

  const resolveCase = useCallback((id: number) => {
    setCases(prev => {
      const updated = prev.map(c =>
        c.id === id ? { ...c, status: "Resolved" as const } : c
      );
      persistCases(updated);
      return updated;
    });
    setActiveCaseId(prev => (prev === id ? null : prev));
  }, []);

  const addNote = useCallback((caseId: number, note: string) => {
    setCases(prev => {
      const updated = prev.map(c =>
        c.id === caseId ? { ...c, notes: [...c.notes, note] } : c
      );
      persistCases(updated);
      return updated;
    });
  }, []);

  const deleteCase = useCallback((id: number) => {
    setCases(prev => {
      const updated = prev.filter(c => c.id !== id);
      persistCases(updated);
      return updated;
    });
    setActiveCaseId(prev => (prev === id ? null : prev));
  }, []);

  const clearAllCases = useCallback(() => {
    setCases([]);
    setSearchHistory([]);
    setActiveCaseId(null);
    localStorage.removeItem(KEY_CASES);
    localStorage.removeItem(KEY_HISTORY);
  }, []);

  return (
    <CaseContext.Provider
      value={{
        cases,
        activeCaseId,
        activeCase,
        searchHistory,
        totalSearches,
        totalMatches,
        avgAccuracy,
        createCase,
        setActiveCaseId,
        updateCase,
        addSearchRecord,
        resolveCase,
        addNote,
        deleteCase,
        clearAllCases,
      }}
    >
      {children}
    </CaseContext.Provider>
  );
};

export const useCases = () => {
  const ctx = useContext(CaseContext);
  if (!ctx) throw new Error("useCases must be used inside CaseProvider");
  return ctx;
};
