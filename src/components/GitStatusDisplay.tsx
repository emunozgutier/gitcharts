import React from 'react';

interface GitStatusDisplayProps {
  stats: { size: number; language: string; forks: number } | null;
  progress: string | null;
  loading: boolean;
}

const GitStatusDisplay: React.FC<GitStatusDisplayProps> = ({ stats, progress, loading }) => {
  return (
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
      {(loading || progress) && (
        <div className="d-flex align-items-center gap-2">
          <div className="spinner-border spinner-border-sm text-primary"></div>
          <span className="small text-muted">{progress || 'Syncing...'}</span>
        </div>
      )}
    </div>
  );
};

export default GitStatusDisplay;
