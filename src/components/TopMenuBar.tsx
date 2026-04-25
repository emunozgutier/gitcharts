import SearchBar from './TopMenuBar/SearchBar';
import { useStore } from '../store/useStore';

interface TopMenuBarProps {
  selectedRepo: string;
  onRepoSelect: (repo: string | null) => void;
}

const TopMenuBar: React.FC<TopMenuBarProps> = ({ selectedRepo, onRepoSelect }) => {
  const { stats, progress, analysisState } = useStore();

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm py-1 sticky-top">
      <div className="container-fluid px-3">
        <div className="d-flex align-items-center w-100">
          <a 
            className="navbar-brand fw-bold mb-0 d-flex align-items-center me-3" 
            href="#" 
            onClick={(e) => {
              e.preventDefault();
              onRepoSelect(null);
            }} 
            style={{ cursor: 'pointer', textDecoration: 'none' }}
          >
            <span className="me-2" style={{ fontSize: '0.9rem' }}>🏛️</span>
            <span style={{ fontSize: '0.9rem' }}>GitCharts</span>
          </a>

          <div className="flex-grow-1" style={{ maxWidth: '600px' }}>
            <SearchBar onSelect={onRepoSelect} initialValue={selectedRepo} isMinimal />
          </div>

          <div className="ms-auto">
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
              {(analysisState === 'Downloading repo' || analysisState === 'processing repo' || analysisState === 'searching for repo name' || progress) && (
                <div className="d-flex align-items-center gap-2 bg-dark bg-opacity-50 px-3 py-1 rounded-pill border border-secondary">
                  <div className="spinner-border spinner-border-sm text-primary" style={{ width: '0.75rem', height: '0.75rem' }}></div>
                  <span className="smallest text-light opacity-75">{progress || 'Syncing...'}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <style>{`
        .navbar-brand { font-size: 1.1rem; color: #fff !important; }
        .navbar-brand:hover { opacity: 0.8; }
        .ls-1 { letter-spacing: 0.05em; }
        .smallest { font-size: 0.7rem; }
      `}</style>
    </nav>
  );
};

export default TopMenuBar;
