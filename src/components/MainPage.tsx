import React, { useEffect, useCallback, useState, useRef } from 'react';
import { GitArchaeology } from './gitComponents/GitProcessing';
import { type GranularityUnit } from './gitComponents/GitProcessing';
import { cloneRepo } from './gitComponents/GitDownload';
import Chart from './Chart';
import Settings from './Settings';
import { useStore } from '../store/useStore';

import ProgressStateAndBar from './ProgressStateAndBar';

interface MainPageProps {
  repoFullName: string;
}

let globalIsCloning = false;

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
  } = useStore();

  const [xDomain, setXDomain] = useState<[string, string] | undefined>(undefined);
  const archaeologyRef = useRef<GitArchaeology | null>(null);

  const startInitialClone = useCallback(async () => {
    if (globalIsCloning) return;
    globalIsCloning = true;
    setState('searching for repo name');
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
      archaeologyRef.current = archaeology;
      // step 1: download only
      setState('Downloading repo');
      await cloneRepo({
        dir: archaeology.dir,
        repoUrl: archaeology.repoUrl,
        ref: repoData.default_branch,
        depth: 100,
        onProgress: (msg: string) => setProgress(msg),
      });
      
      setProgress("Scanning repository structure...");
      const info = await archaeology.scanRepo();
      setRepoInfo(info);
      setState('selected repo name');
      setProgress(null);
    } catch (err: any) {
      setProgress(`Error: ${err.message || "Failed to initialize"}`);
      console.error(err);
      setState('FAILURE during download');
    } finally {
      globalIsCloning = false;
    }
  }, [repoFullName, setState, setProgress, setRepoInfo, setStats]);

  useEffect(() => {
    const cached = repoCache[repoFullName];
    if (cached) {
      setData(cached.data);
      setStats(cached.stats);
      setState('done');
      return;
    }

    if (state === 'init') {
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
    setState('processing repo');
    setProgress("Analyzing commit history...");
    
    try {
      const archaeology = archaeologyRef.current;
      if (!archaeology) throw new Error("Repository not initialized. Please try again.");
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
        },
        (partialData, timePoints) => {
            setData([...partialData]); // Create new array reference for React
            if (timePoints.length > 1) {
               const startStr = new Date(timePoints[0] * 1000).toISOString().split('T')[0];
               const endStr = new Date(timePoints[timePoints.length - 1] * 1000).toISOString().split('T')[0];
               setXDomain([startStr, endStr]);
            }
        }
      );
      
      setData(results);
      if (stats) {
        updateCache(repoFullName, { stats, data: results });
      }
      setState('done');
      setProgress(null);
    } catch (err: any) {
      setProgress(`Error: ${err.message || "Failed to analyze"}`);
      console.error(err);
      setState('failure during processing repo');
    }
  };

  return (
    <div className="d-flex flex-column h-100 w-100">
      <div className="flex-grow-1 position-relative overflow-hidden">
        {state === 'selected repo name' && repoInfo && (
          <Settings 
            extensions={repoInfo.extensions} 
            folders={repoInfo.folders} 
            folderLines={repoInfo.folderLines}
            timeRange={repoInfo.timeRange}
            commitTimestamps={repoInfo.commitTimestamps}
            onAnalyze={handleStartAnalysis} 
          />
        )}

        {(state === 'FAILURE during download' || state === 'failure during processing repo') && (
          <div className="d-flex flex-column justify-content-center align-items-center h-100 text-center p-4">
            <div className="alert alert-danger shadow-sm rounded-4 mb-4" style={{ maxWidth: '500px' }}>
              <h4 className="alert-heading h5 fw-bold mb-3">Something went wrong</h4>
              <p className="mb-0 small">{progress}</p>
            </div>
            <button 
              className="btn btn-primary btn-lg rounded-pill px-5 shadow" 
              onClick={() => {
                setState('init');
                setProgress(null);
              }}
            >
              Try Again
            </button>
          </div>
        )}

        <ProgressStateAndBar state={state} progress={progress} />

        {(state === 'done' || state === 'processing repo') && data.length > 0 && <Chart data={data} xDomain={xDomain} />}
        
        {state === 'done' && data.length === 0 && !progress && (
          <div className="text-center mt-5 text-muted">
             <p>No data found for selected filters.</p>
             <button className="btn btn-sm btn-outline-primary rounded-pill" onClick={() => setState('selected repo name')}>Adjust Settings</button>
          </div>
        )}
      </div>
      
      <div className="d-flex justify-content-between align-items-center mt-3 px-1 text-muted small">
        <span>{state === 'done' ? 'Showing code age distribution. Older layers at the bottom.' : 'Waiting for analysis...'}</span>
        {state === 'done' && (
          <div className="d-flex gap-2">
            <button className="btn btn-link btn-sm text-decoration-none p-0" onClick={() => setState('selected repo name')}>Settings</button>
            <span>•</span>
            <button className="btn btn-link btn-sm text-decoration-none p-0" onClick={() => startInitialClone()}>Reset</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MainPage;
