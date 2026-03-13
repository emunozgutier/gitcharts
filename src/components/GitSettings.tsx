import React, { useState, useMemo } from 'react';

interface GitSettingsProps {
  extensions: Record<string, number>;
  folders: string[];
  folderLines: Record<string, number>;
  onAnalyze: (options: {
    selectedExtensions: string[];
    selectedFolders: string[];
    depth: number;
    startDate: string;
    endDate: string;
  }) => void;
}

const GitSettings: React.FC<GitSettingsProps> = ({ extensions, folders, folderLines, onAnalyze }) => {
  const [selectedExtensions, setSelectedExtensions] = useState<string[]>([]);
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [depth, setDepth] = useState<number>(50);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const totalLines = useMemo(() => 
    Object.values(extensions).reduce((sum, count) => sum + count, 0), 
  [extensions]);

  const topExtensions = useMemo(() => {
    const sorted = Object.entries(extensions)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
    return sorted.map(([ext, count]) => ({
      ext,
      count,
      percentage: ((count / totalLines) * 100).toFixed(1)
    }));
  }, [extensions, totalLines]);

  const sortedFolders = useMemo(() => {
    return [...folders].sort((a, b) => (folderLines[b] || 0) - (folderLines[a] || 0));
  }, [folders, folderLines]);

  const toggleExtension = (ext: string) => {
    setSelectedExtensions(prev => 
      prev.includes(ext) ? prev.filter(e => e !== ext) : [...prev, ext]
    );
  };

  const toggleFolder = (folder: string) => {
    setSelectedFolders(prev => 
      prev.includes(folder) ? prev.filter(f => f !== folder) : [...prev, folder]
    );
  };

  return (
    <div className="git-settings card shadow-sm p-4 h-100 overflow-auto">
      <h3 className="h5 mb-4 fw-bold">Analysis Settings</h3>
      
      <div className="row g-4 mb-4">
        <div className="col-12">
          <label className="form-label text-muted small text-uppercase fw-bold mb-2 ls-1 d-block">Time Points (Commits)</label>
          <div className="d-flex align-items-center gap-3">
            <input 
              type="range" 
              className="form-range flex-grow-1" 
              min="10" 
              max="200" 
              step="10" 
              value={depth} 
              onChange={e => setDepth(parseInt(e.target.value))}
            />
            <span className="badge bg-primary rounded-pill px-3 py-2" style={{ minWidth: '4.5rem' }}>{depth} pts</span>
          </div>
          <div className="text-muted smallest mt-1 px-1">Number of snapshots to analyze in history.</div>
        </div>

        <div className="col-12 border-top pt-4">
          <label className="form-label text-muted small text-uppercase fw-bold mb-3 ls-1 d-block">Time Frame (Optional)</label>
          <div className="row g-2">
            <div className="col-6">
              <label className="small text-muted mb-1 d-block ps-1">Start Date</label>
              <input 
                type="date" 
                className="form-control form-control-sm border-0 bg-light rounded-pill px-3" 
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
            <div className="col-6">
              <label className="small text-muted mb-1 d-block ps-1">End Date</label>
              <input 
                type="date" 
                className="form-control form-control-sm border-0 bg-light rounded-pill px-3" 
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="col-12 border-top pt-4">
          <label className="form-label text-muted small text-uppercase fw-bold mb-3 ls-1 d-block">File Types (Top 5)</label>
          <div className="d-flex flex-wrap gap-2">
            {topExtensions.map(({ ext, percentage }) => (
              <button
                key={ext}
                type="button"
                className={`btn btn-sm rounded-pill px-3 border transition-all ${selectedExtensions.includes(ext) ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => toggleExtension(ext)}
              >
                {ext} <span className="opacity-75 ps-1">{percentage}%</span>
              </button>
            ))}
          </div>
        </div>

        <div className="col-12 border-top pt-4">
          <label className="form-label text-muted small text-uppercase fw-bold mb-3 ls-1 d-block">Folders (by size)</label>
          <div className="list-group list-group-flush border rounded overflow-auto" style={{ maxHeight: '180px' }}>
            {sortedFolders.map(folder => {
              const lines = folderLines[folder] || 0;
              const pct = ((lines / totalLines) * 100).toFixed(1);
              return (
                <label key={folder} className="list-group-item list-group-item-action d-flex align-items-center gap-2 py-2 small border-0">
                  <input
                    type="checkbox"
                    className="form-check-input mt-0"
                    checked={selectedFolders.includes(folder)}
                    onChange={() => toggleFolder(folder)}
                  />
                  <span className="text-truncate flex-grow-1">{folder}</span>
                  <span className="text-muted opacity-50 smaller">{pct}%</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-auto pt-3 border-top">
        <button 
          className="btn btn-primary w-100 fw-bold py-2 rounded-pill shadow-sm"
          onClick={() => onAnalyze({
            selectedExtensions,
            selectedFolders,
            depth,
            startDate,
            endDate
          })}
        >
          Start Analysis
        </button>
      </div>

      <style>{`
        .ls-1 { letter-spacing: 0.05em; }
        .smallest { font-size: 0.75rem; }
        .git-settings { background: #fdfdfd; border: 1px solid rgba(0,0,0,0.02); }
        .transition-all { transition: all 0.2s ease; }
        ::-webkit-calendar-picker-indicator { opacity: 0.5; cursor: pointer; }
      `}</style>
    </div>
  );
};

export default GitSettings;
