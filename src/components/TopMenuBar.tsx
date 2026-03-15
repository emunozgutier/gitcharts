import SearchBar from './TopMenuBar/SearchBar';
import GitStatusDisplay from './GitStatusDisplay';
import { useRepoStore } from '../store/useRepoStore';

interface TopMenuBarProps {
  selectedRepo: string;
  onRepoSelect: (repo: string | null) => void;
}

const TopMenuBar: React.FC<TopMenuBarProps> = ({ selectedRepo, onRepoSelect }) => {
  const { stats, progress, analysisState } = useRepoStore();

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
            <GitStatusDisplay 
              stats={stats} 
              progress={progress} 
              loading={analysisState === 'CLONING' || analysisState === 'ANALYZING'} 
            />
          </div>
        </div>
      </div>
      <style>{`
        .navbar-brand { font-size: 1.1rem; color: #fff !important; }
        .navbar-brand:hover { opacity: 0.8; }
      `}</style>
    </nav>
  );
};

export default TopMenuBar;
