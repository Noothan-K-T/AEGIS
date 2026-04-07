export interface FaceMatch {
  id: string;
  score: number;
  similarity_percent: number;
  above_threshold: boolean;
  metadata: {
    label?: string;
    confidence?: number;
    location?: string;
    timestamp?: string;
    device_id?: string;
    camera?: string;
  };
}

export interface SearchResult {
  found: boolean;
  matches: FaceMatch[];
  total_matches: number;
}