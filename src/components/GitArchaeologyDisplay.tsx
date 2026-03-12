import React, { useState, useEffect, useRef } from 'react';
import { GitArchaeology, type BlameDataPoint } from './git_archeology';
import embed from 'vega-embed';

interface GitArchaeologyDisplayProps {
  repoFullName: string;
  cachedResult?: { stats: any; data: BlameDataPoint[] };
  onAnalysisComplete?: (stats: any, data: BlameDataPoint[]) => void;
}

const GitArchaeologyDisplay: React.FC<GitArchaeologyDisplayProps> = ({ 
  repoFullName, 
  cachedResult, 
  onAnalysisComplete 
}) => {
  const [stats, setStats] = useState<{ size: number; language: string; forks: number } | null>(cachedResult?.stats || null);
  const [progress, setProgress] = useState<string | null>(null);
  const [data, setData] = useState<BlameDataPoint[]>(cachedResult?.data || []);
  const [loading, setLoading] = useState(!cachedResult);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cachedResult) {
      setStats(cachedResult.stats);
      setData(cachedResult.data);
      setLoading(false);
      setProgress(null);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setProgress("Connecting to GitHub API...");
      setData([]);
      
      try {
        const repoRes = await fetch(`https://api.github.com/repos/${repoFullName}`);
        if (!repoRes.ok) throw new Error("Failed to fetch repo metadata");
        const repoData = await repoRes.json();
        
        const currentStats = {
          size: repoData.size,
          language: repoData.language,
          forks: repoData.forks_count
        };
        setStats(currentStats);

        const archaeology = new GitArchaeology(repoFullName);
        const results = await archaeology.runLegacy((msg) => setProgress(msg));
        
        setData(results);
        setProgress(null);
        
        if (onAnalysisComplete) {
          onAnalysisComplete(currentStats, results);
        }
      } catch (err: any) {
        setProgress(`Error: ${err.message || "Failed to perform archaeology"}. Check console for details.`);
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [repoFullName, cachedResult]);

  useEffect(() => {
    if (data.length > 0 && chartRef.current) {
      const spec: any = {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        width: 'container',
        height: 'container',
        autosize: { type: 'fit', contains: 'padding' },
        data: { values: data },
        mark: { type: 'area', line: { color: '#fff', strokeWidth: 0.5 }, tooltip: true },
        encoding: {
          x: {
            field: 'commit_date',
            type: 'temporal',
            title: null,
            axis: { format: '%Y-%m', grid: false, labelColor: '#6e7781' }
          },
          y: {
            field: 'line_count',
            type: 'quantitative',
            title: 'Lines of Code',
            stack: 'zero',
            axis: { grid: true, gridOpacity: 0.1, labelColor: '#6e7781' }
          },
          color: {
            field: 'period',
            type: 'nominal',
            title: 'Quarter Added',
            scale: { scheme: 'magma' },
            sort: 'descending',
            legend: { 
              orient: 'right', 
              offset: 20,
              titleFontSize: 12,
              labelFontSize: 10,
              symbolType: 'square'
            }
          },
          order: {
             field: 'period',
             sort: 'ascending'
          },
          tooltip: [
            { field: 'commit_date', title: 'Snapshot', type: 'temporal', format: '%b %Y' },
            { field: 'period', title: 'Code from' },
            { field: 'line_count', title: 'Lines', format: ',' }
          ]
        },
        config: {
          view: { stroke: null },
          font: 'Outfit, sans-serif'
        }
      };

      embed(chartRef.current, spec, { actions: false }).catch(console.error);
    }
  }, [data]);

  return (
    <div className="d-flex flex-column h-100 w-100">
      <div className="d-flex justify-content-between align-items-center mb-1">
        <div className="stats-card d-flex gap-4">
          {stats ? (
            <>
              <div>
                <div className="text-muted small text-uppercase fw-bold ls-1">Size</div>
                <div className="h5 mb-0 fw-bold">{Math.round(stats.size / 1024)} MB</div>
              </div>
              <div className="vr"></div>
              <div>
                <div className="text-muted small text-uppercase fw-bold ls-1">Language</div>
                <div className="h5 mb-0 fw-bold">{stats.language || 'N/A'}</div>
              </div>
              <div className="vr"></div>
              <div>
                <div className="text-muted small text-uppercase fw-bold ls-1">Forks</div>
                <div className="h5 mb-0 fw-bold">{stats.forks.toLocaleString()}</div>
              </div>
            </>
          ) : (
            <div className="text-muted">Loading repository statistics...</div>
          )}
        </div>
        <div className="d-flex gap-2">
           <button className="btn btn-sm btn-outline-secondary rounded-pill px-3 fw-bold" onClick={() => window.location.reload()}>Refresh</button>
           <button className="btn btn-sm btn-primary rounded-pill px-3 fw-bold border" style={{ display: cachedResult ? 'inline-block' : 'none' }}>Cached</button>
        </div>
      </div>

      <div className="chart-section position-relative">
        {progress && (
          <div className="position-absolute top-50 start-50 translate-middle text-center w-75">
            <div className="spinner-grow text-primary mb-3" role="status"></div>
            <div className="h4 fw-bold mb-2">{progress}</div>
            <div className="progress" style={{ height: '4px' }}>
              <div className="progress-bar progress-bar-striped progress-bar-animated" style={{ width: '100%' }}></div>
            </div>
          </div>
        )}
        
        <div className="chart-wrapper">
          <div ref={chartRef} className="w-100 h-100"></div>
        </div>
      </div>
      
      <div className="d-flex justify-content-between align-items-center mt-3 px-1 text-muted small">
        <span>Showing real code age distribution. Older layers (sediment) at the bottom.</span>
        {loading && <div className="d-flex align-items-center gap-2"><div className="spinner-border spinner-border-sm text-primary"></div><span>Syncing history...</span></div>}
      </div>
    </div>
  );
};

export default GitArchaeologyDisplay;
