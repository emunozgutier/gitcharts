import React from 'react';

interface GitStatusDisplayProps {
  stats: { size: number; language: string; forks: number } | null;
  progress: string | null;
  loading: boolean;
}

const GitStatusDisplay: React.FC<GitStatusDisplayProps> = ({ stats, progress, loading }) => {
  return (
    <div className="d-flex align-items-center">
      <div className="stats-card d-flex gap-3 me-3 text-light align-items-center">
        {stats ? (
          <>
            <div className="d-flex align-items-baseline gap-2">
              <span className="text-light opacity-50 fw-bold ls-1" style={{ fontSize: '0.6rem' }}>SIZE</span>
              <span className="fw-bold small">{Math.round(stats.size / 1024)}MB</span>
            </div>
            <div className="vr bg-light opacity-25" style={{ height: '16px' }}></div>
            <div className="d-flex align-items-baseline gap-2">
              <span className="text-light opacity-50 fw-bold ls-1" style={{ fontSize: '0.6rem' }}>LANG</span>
              <span className="fw-bold small ">{stats.language || 'N/A'}</span>
            </div>
            <div className="vr bg-light opacity-25" style={{ height: '16px' }}></div>
            <div className="d-flex align-items-baseline gap-2">
              <span className="text-light opacity-50 fw-bold ls-1" style={{ fontSize: '0.6rem' }}>FORKS</span>
              <span className="fw-bold small">{stats.forks.toLocaleString()}</span>
            </div>
          </>
        ) : (
          <div className="text-light opacity-50 small">Loading stats...</div>
        )}
      </div>
      {(loading || progress) && (
        <div className="d-flex align-items-center gap-2 bg-dark bg-opacity-50 px-3 py-1 rounded-pill border border-secondary">
          <div className="spinner-border spinner-border-sm text-primary" style={{ width: '0.75rem', height: '0.75rem' }}></div>
          <span className="smallest text-light opacity-75">{progress || 'Syncing...'}</span>
        </div>
      )}
      <style>{`
        .ls-1 { letter-spacing: 0.05em; }
        .smallest { font-size: 0.7rem; }
      `}</style>
    </div>
  );
};

export default GitStatusDisplay;
