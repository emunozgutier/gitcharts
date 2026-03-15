import React from 'react';
import SearchBar from './TopMenuBar/SearchBar';

interface TopMenuBarProps {
  selectedRepo: string;
  onRepoSelect: (repo: string | null) => void;
}

const TopMenuBar: React.FC<TopMenuBarProps> = ({ selectedRepo, onRepoSelect }) => {
  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm py-2">
      <div className="container-fluid px-4 d-flex align-items-center justify-content-between">
        <a 
          className="navbar-brand fw-bold mb-0 d-flex align-items-center" 
          href="#" 
          onClick={(e) => {
            e.preventDefault();
            onRepoSelect(null);
          }} 
          style={{ cursor: 'pointer', textDecoration: 'none' }}
        >
          <span className="me-2">🏛️</span>
          <span>GitCharts <span className="text-primary">Archaeology</span></span>
        </a>
        <div className="flex-grow-1 mx-4" style={{ maxWidth: '800px' }}>
          <SearchBar onSelect={onRepoSelect} initialValue={selectedRepo} isMinimal />
        </div>
        <div className="text-light d-none d-md-block">
          <span className="badge bg-secondary rounded-pill px-3 py-2 border border-secondary">
            {selectedRepo}
          </span>
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
