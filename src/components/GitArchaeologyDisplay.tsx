import React, { useEffect, useCallback } from 'react';
import { GitArchaeology } from './GitArchaeology';
import GitStatusDisplay from './GitStatusDisplay';
import GitChart from './GitChart';
import GitSettings from './GitSettings';
import { useRepoStore } from '../store/useRepoStore';

interface GitArchaeologyDisplayProps {
  repoFullName: string;
}

const GitArchaeologyDisplay: React.FC<GitArchaeologyDisplayProps> = ({ 
  repoFullName, 
}) => {
  const {
    analysisState: state,
    setAnalysisState: setState,
    progress,
    setProgress,
    data,
    setData,
    repoInfo,
    setRepoInfo,
    stats,
    setStats,
    repoCache,
    updateCache
  } = useRepoStore();

  const startInitialClone = useCallback(async () => {
    setState('CLONING');
    setProgress("Connecting to GitHub API...");
    
    try {
      const repoRes = await fetch(`https://api.github.com/repos/${repoFullName}`);
      if (!repoRes.ok) throw new Error("Failed to fetch repo metadata");
      const repoData = await repoRes.json();
      
      const currentStats = {
        size: repoData.size,
        language: repoData.language || 'Unknown',
        forks: repoData.forks_count
      };
      setStats(currentStats);

      const archaeology = new GitArchaeology(repoFullName);
      // step 1: download only
      await archaeology.download((msg) => setProgress(msg));
      
      setProgress("Scanning repository structure...");
      const info = await archaeology.scanRepo();
      setRepoInfo(info);
      setState('SETTINGS');
      setProgress(null);
    } catch (err: any) {
      setProgress(`Error: ${err.message || "Failed to initialize"}`);
      console.error(err);
      setState('IDLE');
    }
  }, [repoFullName, setState, setProgress, setRepoInfo, setStats]);

  useEffect(() => {
    const cached = repoCache[repoFullName];
    if (cached) {
      setData(cached.data);
      setStats(cached.stats);
      setState('DONE');
      return;
    }

    if (state === 'IDLE') {
      startInitialClone();
    }
  }, [repoFullName, repoCache, state, startInitialClone, setData, setStats, setState]);

  const handleStartAnalysis = async (options: {
    selectedExtensions: string[];
    selectedFolders: string[];
    depth: number;
    startDate: string;
    endDate: string;
  }) => {
    setState('ANALYZING');
    setProgress("Analyzing commit history...");
    
    try {
      const archaeology = new GitArchaeology(repoFullName);
      // step 2: run analysis on already downloaded repo
      const results = await archaeology.run(
        (msg) => setProgress(msg), 
        { 
          extensions: options.selectedExtensions, 
          folders: options.selectedFolders, 
          skipClone: true,
          depth: options.depth,
          startDate: options.startDate,
          endDate: options.endDate
        }
      );
      
      setData(results);
      if (stats) {
        updateCache(repoFullName, { stats, data: results });
      }
      setState('DONE');
      setProgress(null);
    } catch (err: any) {
      setProgress(`Error: ${err.message || "Failed to analyze"}`);
      console.error(err);
    }
  };

  return (
    <div className="d-flex flex-column h-100 w-100">
      <GitStatusDisplay 
        stats={stats} 
        progress={progress} 
        loading={state === 'CLONING' || state === 'ANALYZING'} 
      />

      <div className="flex-grow-1 position-relative overflow-hidden mt-2">
        {state === 'SETTINGS' && repoInfo && (
          <GitSettings 
            extensions={repoInfo.extensions} 
            folders={repoInfo.folders} 
            folderLines={repoInfo.folderLines}
            timeRange={repoInfo.timeRange}
            onAnalyze={handleStartAnalysis} 
          />
        )}

        {(state === 'ANALYZING' || state === 'CLONING') && (
          <div className="position-absolute top-50 start-50 translate-middle text-center w-75">
            <div className="spinner-grow text-primary mb-3" role="status"></div>
            <div className="h4 fw-bold mb-2">{progress}</div>
            <div className="progress" style={{ height: '4px' }}>
              <div className="progress-bar progress-bar-striped progress-bar-animated" style={{ width: '100%' }}></div>
            </div>
          </div>
        )}

        {state === 'DONE' && data.length > 0 && <GitChart data={data} />}
        
        {state === 'DONE' && data.length === 0 && !progress && (
          <div className="text-center mt-5 text-muted">
             <p>No data found for selected filters.</p>
             <button className="btn btn-sm btn-outline-primary rounded-pill" onClick={() => setState('SETTINGS')}>Adjust Settings</button>
          </div>
        )}
      </div>
      
      <div className="d-flex justify-content-between align-items-center mt-3 px-1 text-muted small">
        <span>{state === 'DONE' ? 'Showing code age distribution. Older layers at the bottom.' : 'Waiting for analysis...'}</span>
        {state === 'DONE' && (
          <div className="d-flex gap-2">
            <button className="btn btn-link btn-sm text-decoration-none p-0" onClick={() => setState('SETTINGS')}>Settings</button>
            <span>•</span>
            <button className="btn btn-link btn-sm text-decoration-none p-0" onClick={() => startInitialClone()}>Reset</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default GitArchaeologyDisplay;
