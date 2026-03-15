import React from 'react';

interface GitStatusDisplayProps {
  stats: { size: number; language: string; forks: number } | null;
  progress: string | null;
  loading: boolean;
}

const GitStatusDisplay: React.FC<GitStatusDisplayProps> = ({ stats, progress, loading }) => {
  return (
    <div className="d-flex align-items-center">
      <div className="stats-card d-flex gap-3 me-3 text-light">
        {stats ? (
          <>
            <div className="text-end">
              <div className="text-light opacity-50 fw-bold ls-1" style={{ fontSize: '0.65rem' }}>SIZE</div>
              <div className="fw-bold small">{Math.round(stats.size / 1024)} MB</div>
            </div>
            <div className="vr bg-light opacity-25" style={{ height: '24px' }}></div>
            <div className="text-end">
              <div className="text-light opacity-50 fw-bold ls-1" style={{ fontSize: '0.65rem' }}>LANG</div>
              <div className="fw-bold small">{stats.language || 'N/A'}</div>
            </div>
            <div className="vr bg-light opacity-25" style={{ height: '24px' }}></div>
            <div className="text-end">
              <div className="text-light opacity-50 fw-bold ls-1" style={{ fontSize: '0.65rem' }}>FORKS</div>
              <div className="fw-bold small">{stats.forks.toLocaleString()}</div>
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
