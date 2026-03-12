import React, { useState, useEffect, useRef } from 'react';
import { GitArchaeology, type BlameDataPoint } from './git_archeology';
import embed from 'vega-embed';

interface GitArchaeologyDisplayProps {
  repoFullName: string;
}

const GitArchaeologyDisplay: React.FC<GitArchaeologyDisplayProps> = ({ repoFullName }) => {
  const [stats, setStats] = useState<{ size: number; language: string; forks: number } | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [data, setData] = useState<BlameDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setProgress("Fetching repository metadata...");
      setData([]); // Reset on new repo
      
      try {
        const repoRes = await fetch(`https://api.github.com/repos/${repoFullName}`);
        const repoData = await repoRes.json();
        setStats({
          size: repoData.size,
          language: repoData.language,
          forks: repoData.forks_count
        });

        const archaeology = new GitArchaeology(repoFullName);
        const results = await archaeology.runLegacy((msg) => setProgress(msg));
        
        setData(results);
        setProgress(null);
      } catch (err) {
        setProgress("Error: Failed to perform archaeology.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [repoFullName]);

  useEffect(() => {
    // Only embed if we have data AND the ref is ready
    if (data.length > 0 && chartRef.current) {
      console.log('GitArchaeologyDisplay: Embedding chart...');
      const spec: any = {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        title: 'Code Archaeology: Lines of Code by Period Added',
        width: 'container',
        height: 400,
        data: { values: data },
        mark: 'area',
        encoding: {
          x: {
            field: 'commit_date',
            type: 'nominal',
            title: 'Commit Timeline',
            axis: { labelAngle: -45 }
          },
          y: {
            field: 'line_count',
            type: 'quantitative',
            title: 'Lines of Code',
            stack: 'zero'
          },
          color: {
            field: 'period',
            type: 'nominal',
            title: 'Period Added',
            scale: { scheme: 'viridis' }
          },
          tooltip: [
            { field: 'commit_date', title: 'Snapshot' },
            { field: 'period', title: 'Added in' },
            { field: 'line_count', title: 'Lines' }
          ]
        }
      };

      embed(chartRef.current, spec, { actions: false }).catch(err => {
        console.error('Vega-Lite embedding failed:', err);
      });
    }
  }, [data, progress]); // Re-run when data is ready or progress is cleared (releasing the div)

  return (
    <div className="card shadow-sm border-0 rounded-4 overflow-hidden mt-2 mb-5">
      <div className="card-header bg-dark text-white p-3 d-flex justify-content-between align-items-center">
        <h5 className="mb-0">Archaeology Report: {repoFullName}</h5>
        {loading && <div className="spinner-border spinner-border-sm text-light" role="status"></div>}
      </div>
      <div className="card-body p-4">
        {stats && (
          <div className="row mb-4 g-3">
            <div className="col-md-4">
              <div className="p-3 bg-light rounded-3 text-center border">
                <small className="text-muted d-block text-uppercase fw-bold">Size</small>
                <span className="h4">{Math.round(stats.size / 1024)} MB</span>
              </div>
            </div>
            <div className="col-md-4">
              <div className="p-3 bg-light rounded-3 text-center border">
                <small className="text-muted d-block text-uppercase fw-bold">Primary Language</small>
                <span className="h4">{stats.language || 'Unknown'}</span>
              </div>
            </div>
            <div className="col-md-4">
              <div className="p-3 bg-light rounded-3 text-center border">
                <small className="text-muted d-block text-uppercase fw-bold">Forks</small>
                <span className="h4">{stats.forks}</span>
              </div>
            </div>
          </div>
        )}

        {progress && (
          <div className="text-center py-5">
            <div className="spinner-border text-primary mb-3" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="lead text-muted">{progress}</p>
          </div>
        )}

        {data.length > 0 && !progress && (
          <div className="chart-container">
            <div ref={chartRef} style={{ width: '100%', minHeight: '400px' }}></div>
            <div className="text-end mt-2">
               <small className="text-muted">Interactive Vega-Lite Visualization</small>
            </div>
          </div>
        )}

        {!loading && !progress && data.length === 0 && (
          <div className="alert alert-info border-0 bg-light">No archaeology data available for this repository.</div>
        )}
      </div>
    </div>
  );
};

export default GitArchaeologyDisplay;
