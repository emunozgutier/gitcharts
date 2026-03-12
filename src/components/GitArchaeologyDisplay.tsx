import React, { useState, useEffect } from 'react';
import { GitArchaeology } from './git_archeology';

interface GitArchaeologyDisplayProps {
  repoFullName: string;
}

const GitArchaeologyDisplay: React.FC<GitArchaeologyDisplayProps> = ({ repoFullName }) => {
  const [stats, setStats] = useState<{ size: number; language: string; forks: number } | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setProgress("Fetching repository metadata...");
      
      try {
        // 1. Get Repo Stats from GitHub API
        const repoRes = await fetch(`https://api.github.com/repos/${repoFullName}`);
        const repoData = await repoRes.json();
        setStats({
          size: repoData.size,
          language: repoData.language,
          forks: repoData.forks_count
        });

        // 2. Start Archaeology Process
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

  return (
    <div className="card shadow-sm border-0 rounded-4 overflow-hidden mt-4">
      <div className="card-header bg-dark text-white p-3">
        <h5 className="mb-0">Archaeology Report: {repoFullName}</h5>
      </div>
      <div className="card-body p-4">
        {stats && (
          <div className="row mb-4">
            <div className="col-md-4">
              <div className="p-3 bg-light rounded-3 text-center">
                <small className="text-muted d-block text-uppercase fw-bold">Size</small>
                <span className="h4">{Math.round(stats.size / 1024)} MB</span>
              </div>
            </div>
            <div className="col-md-4">
              <div className="p-3 bg-light rounded-3 text-center">
                <small className="text-muted d-block text-uppercase fw-bold">Primary Language</small>
                <span className="h4">{stats.language || 'Unknown'}</span>
              </div>
            </div>
            <div className="col-md-4">
              <div className="p-3 bg-light rounded-3 text-center">
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

        {!loading && !progress && data.length > 0 && (
          <div className="text-center py-4 bg-success-subtle rounded-3">
            <h5 className="text-success">Archaeology Complete!</h5>
            <p className="mb-0">Collected {data.length} data points across history.</p>
            <small className="text-muted">(Chart rendering coming soon...)</small>
          </div>
        )}
      </div>
    </div>
  );
};

export default GitArchaeologyDisplay;
