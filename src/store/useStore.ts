import { create } from 'zustand';

export type GlobalState = 'init' | 'searching for repo name' | 'selected repo name' | 'Downloading repo' | 'FAILURE during download' | 'processing repo' | 'failure during processing repo' | 'done';

export interface BlameDataPoint {
  commit_date: string;
  period: string;
  line_count: number;
  files?: Record<string, number>;
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

interface RepoStore {
  selectedRepo: string | null;
  repoCache: Record<string, AnalysisResult>;
  analysisState: GlobalState;
  progress: string | null;
  data: BlameDataPoint[];
  repoInfo: RepoInfo | null;
  stats: RepoStats | null;

  // Actions
  setSelectedRepo: (repo: string | null) => void;
  setAnalysisState: (state: GlobalState) => void;
  setProgress: (progress: string | null) => void;
  setData: (data: BlameDataPoint[]) => void;
  setRepoInfo: (info: RepoInfo | null) => void;
  setStats: (stats: RepoStats | null) => void;
  updateCache: (repo: string, result: AnalysisResult) => void;
  resetAnalysis: () => void;
}

export const useStore = create<RepoStore>((set) => ({
  selectedRepo: (() => {
    const hash = window.location.hash.substring(1);
    return hash || null;
  })(),
  repoCache: {},
  analysisState: 'init',
  progress: null,
  data: [],
  repoInfo: null,
  stats: null,

  setSelectedRepo: (repo) => set({ selectedRepo: repo }),
  setAnalysisState: (state) => set({ analysisState: state }),
  setProgress: (progress) => set({ progress }),
  setData: (data) => set({ data }),
  setRepoInfo: (info) => set({ repoInfo: info }),
  setStats: (stats) => set({ stats }),
  updateCache: (repo, result) => set((state) => ({
    repoCache: { ...state.repoCache, [repo]: result }
  })),
  resetAnalysis: () => set({
    analysisState: 'init',
    progress: null,
    data: [],
    repoInfo: null,
    stats: null
  }),
}));
