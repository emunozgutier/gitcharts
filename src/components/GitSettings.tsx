import React, { useState, useMemo } from 'react';

interface GitSettingsProps {
  extensions: Record<string, number>;
  folders: string[];
  folderLines: Record<string, number>;
  onAnalyze: (selectedExtensions: string[], selectedFolders: string[]) => void;
}

const GitSettings: React.FC<GitSettingsProps> = ({ extensions, folders, folderLines, onAnalyze }) => {
  const [selectedExtensions, setSelectedExtensions] = useState<string[]>([]);
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);

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
      
      <div className="mb-4">
        <label className="form-label text-muted small text-uppercase fw-bold mb-3 ls-1">File Types (Top 5)</label>
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

      <div className="mb-4">
        <label className="form-label text-muted small text-uppercase fw-bold mb-3 ls-1">Folders (by line count)</label>
        <div className="list-group list-group-flush border rounded overflow-auto" style={{ maxHeight: '200px' }}>
          {sortedFolders.map(folder => {
            const lines = folderLines[folder] || 0;
            const pct = ((lines / totalLines) * 100).toFixed(1);
            return (
              <label key={folder} className="list-group-item list-group-item-action d-flex align-items-center gap-2 py-2 small">
                <input
                  type="checkbox"
                  className="form-check-input mt-0"
                  checked={selectedFolders.includes(folder)}
                  onChange={() => toggleFolder(folder)}
                />
                <span className="text-truncate flex-grow-1">{folder}</span>
                <span className="text-muted opacity-50">{pct}%</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="mt-auto pt-3 border-top">
        <button 
          className="btn btn-primary w-100 fw-bold py-2 rounded-pill shadow-sm"
          onClick={() => onAnalyze(selectedExtensions, selectedFolders)}
        >
          Start Analysis
        </button>
      </div>

      <style>{`
        .ls-1 { letter-spacing: 0.05em; }
        .git-settings { background: #f8f9fa; border: 1px solid rgba(0,0,0,0.05); }
      `}</style>
    </div>
  );
};

export default GitSettings;
