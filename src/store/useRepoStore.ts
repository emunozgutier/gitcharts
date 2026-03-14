import { create } from 'zustand';
import type { AnalysisState, BlameDataPoint, RepoStats, RepoInfo, AnalysisResult } from '../types';

interface RepoStore {
  selectedRepo: string | null;
  repoCache: Record<string, AnalysisResult>;
  analysisState: AnalysisState;
  progress: string | null;
  data: BlameDataPoint[];
  repoInfo: RepoInfo | null;
  stats: RepoStats | null;

  // Actions
  setSelectedRepo: (repo: string | null) => void;
  setAnalysisState: (state: AnalysisState) => void;
  setProgress: (progress: string | null) => void;
  setData: (data: BlameDataPoint[]) => void;
  setRepoInfo: (info: RepoInfo | null) => void;
  setStats: (stats: RepoStats | null) => void;
  updateCache: (repo: string, result: AnalysisResult) => void;
  resetAnalysis: () => void;
}

export const useRepoStore = create<RepoStore>((set) => ({
  selectedRepo: (() => {
    const hash = window.location.hash.substring(1);
    return hash || null;
  })(),
  repoCache: {},
  analysisState: 'IDLE',
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
    analysisState: 'IDLE',
    progress: null,
    data: [],
    repoInfo: null,
    stats: null
  }),
}));
