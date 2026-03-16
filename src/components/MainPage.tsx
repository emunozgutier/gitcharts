import React, { useEffect, useCallback } from 'react';
import { GitArchaeology } from './gitComponents/GitProcessing';
import { type GranularityUnit } from './gitComponents/GitProcessing';
import { cloneRepo } from './gitComponents/GitDownload';
import Chart from './Chart';
import Settings from './Settings';
import { useRepoStore } from '../store/useRepoStore';

import ProgressStateAndBar from './ProgressStateAndBar';

interface MainPageProps {
  repoFullName: string;
}

const MainPage: React.FC<MainPageProps> = ({ 
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
      await cloneRepo({
        dir: archaeology.dir,
        repoUrl: archaeology.repoUrl,
        depth: 100,
        onProgress: (msg: string) => setProgress(msg),
      });
      
      setProgress("Scanning repository structure...");
      const info = await archaeology.scanRepo();
      setRepoInfo(info);
      setState('SETTINGS');
      setProgress(null);
    } catch (err: any) {
      setProgress(`Error: ${err.message || "Failed to initialize"}`);
      console.error(err);
      setState('ERROR');
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
    granularity: GranularityUnit;
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
          endDate: options.endDate,
          granularity: options.granularity
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
      <div className="flex-grow-1 position-relative overflow-hidden">
        {state === 'SETTINGS' && repoInfo && (
          <Settings 
            extensions={repoInfo.extensions} 
            folders={repoInfo.folders} 
            folderLines={repoInfo.folderLines}
            timeRange={repoInfo.timeRange}
            commitTimestamps={repoInfo.commitTimestamps}
            onAnalyze={handleStartAnalysis} 
          />
        )}

        {state === 'ERROR' && (
          <div className="d-flex flex-column justify-content-center align-items-center h-100 text-center p-4">
            <div className="alert alert-danger shadow-sm rounded-4 mb-4" style={{ maxWidth: '500px' }}>
              <h4 className="alert-heading h5 fw-bold mb-3">Something went wrong</h4>
              <p className="mb-0 small">{progress}</p>
            </div>
            <button 
              className="btn btn-primary btn-lg rounded-pill px-5 shadow" 
              onClick={() => {
                setState('IDLE');
                setProgress(null);
              }}
            >
              Try Again
            </button>
          </div>
        )}

        <ProgressStateAndBar state={state} progress={progress} />

        {state === 'DONE' && data.length > 0 && <Chart data={data} />}
        
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

export default MainPage;
