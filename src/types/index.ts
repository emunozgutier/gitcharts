export type AnalysisState = 'IDLE' | 'CLONING' | 'SETTINGS' | 'ANALYZING' | 'DONE' | 'ERROR';

export interface BlameDataPoint {
  commit_date: string;
  period: string;
  line_count: number;
}

export interface RepoStats {
  size: number;
  language: string;
  forks: number;
}

export interface RepoInfo {
  extensions: Record<string, number>;
  folders: string[];
  folderLines: Record<string, number>;
  timeRange: { min: number; max: number };
  commitTimestamps: number[];
}

export interface AnalysisResult {
  stats: RepoStats;
  data: BlameDataPoint[];
}
