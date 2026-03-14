import React, { useState, useMemo } from 'react';

interface GitSettingsProps {
  extensions: Record<string, number>;
  folders: string[];
  folderLines: Record<string, number>;
  timeRange: { min: number; max: number };
  onAnalyze: (options: {
    selectedExtensions: string[];
    selectedFolders: string[];
    depth: number;
    startDate: string;
    endDate: string;
  }) => void;
}

const GitSettings: React.FC<GitSettingsProps> = ({ extensions, folders, folderLines, timeRange, onAnalyze }) => {
  const [selectedExtensions, setSelectedExtensions] = useState<string[]>([]);
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [depth, setDepth] = useState<number>(50);
  
  const [minVal, setMinVal] = useState(timeRange.min);
  const [maxVal, setMaxVal] = useState(timeRange.max);

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

  const formatDate = (ts: number) => {
    return new Date(ts * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };
  
  const toISODate = (ts: number) => {
    return new Date(ts * 1000).toISOString().split('T')[0];
  };

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.min(Number(e.target.value), maxVal - 86400); // at least 1 day diff
    setMinVal(value);
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(Number(e.target.value), minVal + 86400);
    setMaxVal(value);
  };

  const daysInRange = Math.max(1, (maxVal - minVal) / 86400);
  const maxPossiblePoints = Math.floor(daysInRange) + 1;
  const safeMaxPoints = Math.min(200, maxPossiblePoints);
  
  // Ensure depth stays within safe limits
  const effectiveDepth = Math.max(2, Math.min(depth, safeMaxPoints));
  const distanceDays = (daysInRange / (effectiveDepth - 1)).toFixed(1);

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
        {/* Time Frame - Column 1 */}
        <div className="col-12 col-md-6">
          <label className="form-label text-muted small text-uppercase fw-bold mb-4 ls-1 d-block">1. Time Frame</label>
          <div className="range-slider-container px-2">
            <div className="range-slider-labels d-flex justify-content-between mb-3">
              <span className="small fw-bold text-primary bg-primary bg-opacity-10 px-2 py-1 rounded-pill">{formatDate(minVal)}</span>
              <span className="small fw-bold text-primary bg-primary bg-opacity-10 px-2 py-1 rounded-pill">{formatDate(maxVal)}</span>
            </div>
            <div className="dual-range-wrapper position-relative" style={{ height: '40px' }}>
              <input
                type="range"
                min={timeRange.min}
                max={timeRange.max}
                value={minVal}
                onChange={handleMinChange}
                className="thumb thumb--left"
                style={{ zIndex: minVal > timeRange.max - 100 ? 5 : 3 }}
              />
              <input
                type="range"
                min={timeRange.min}
                max={timeRange.max}
                value={maxVal}
                onChange={handleMaxChange}
                className="thumb thumb--right"
                style={{ zIndex: 4 }}
              />
              <div className="slider-track-bg"></div>
              <div 
                className="slider-range-fill"
                style={{
                  left: `${((minVal - timeRange.min) / (timeRange.max - timeRange.min)) * 100}%`,
                  width: `${((maxVal - minVal) / (timeRange.max - timeRange.min)) * 100}%`
                }}
              ></div>
            </div>
          </div>
          <div className="text-muted smallest mt-2 px-1">Selected range: <strong>{daysInRange.toFixed(0)} days</strong></div>
        </div>

        {/* Time Points - Column 2 */}
        <div className="col-12 col-md-6 border-start-md ps-md-4">
          <label className="form-label text-muted small text-uppercase fw-bold mb-2 ls-1 d-block">2. Time Points</label>
          <div className="d-flex align-items-center gap-3">
            <input 
              type="range" 
              className="form-range flex-grow-1" 
              min="2" 
              max={safeMaxPoints} 
              step={safeMaxPoints > 20 ? 5 : 1}
              value={effectiveDepth} 
              onChange={e => setDepth(parseInt(e.target.value))}
            />
            <span className="badge bg-primary rounded-pill px-3 py-2" style={{ minWidth: '4.5rem' }}>{effectiveDepth} pts</span>
          </div>
          <div className="mt-3 p-2 bg-light rounded-3 border border-light">
            <div className="d-flex justify-content-between align-items-center smallest mb-1 text-muted">
              <span>Status:</span>
              <span className={`fw-bold ${parseFloat(distanceDays) >= 1 ? 'text-success' : 'text-warning'}`}>
                {parseFloat(distanceDays) >= 1 ? '✓ Optimal distance' : '⚠ High density'}
              </span>
            </div>
            <div className="h6 mb-0 fw-bold">{distanceDays} days <span className="text-muted fw-normal smaller">between points</span></div>
          </div>
          <div className="text-muted smallest mt-2 px-1">Constraint: min 1 day distance.</div>
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
            depth: effectiveDepth,
            startDate: toISODate(minVal),
            endDate: toISODate(maxVal)
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
        
        @media (min-width: 768px) {
          .border-start-md { border-left: 1px solid #dee2e6 !important; }
        }
        
        .dual-range-wrapper { position: relative; width: 100%; }
        .thumb {
          position: absolute;
          height: 0;
          width: 100%;
          outline: none;
          pointer-events: none;
          -webkit-appearance: none;
        }
        .thumb::-webkit-slider-thumb {
          background-color: #0d6efd;
          border: 2px solid #fff;
          border-radius: 50%;
          box-shadow: 0 0 1px 1px #ced4da;
          cursor: pointer;
          height: 18px;
          width: 18px;
          margin-top: 4px;
          pointer-events: all;
          position: relative;
          -webkit-appearance: none;
        }
        .thumb::-moz-range-thumb {
          background-color: #0d6efd;
          border: 2px solid #fff;
          border-radius: 50%;
          box-shadow: 0 0 1px 1px #ced4da;
          cursor: pointer;
          height: 18px;
          width: 18px;
          pointer-events: all;
          position: relative;
        }
        .slider-track-bg {
          position: absolute;
          height: 4px;
          border-radius: 2px;
          background-color: #e9ecef;
          width: 100%;
          top: 11px;
          z-index: 1;
        }
        .slider-range-fill {
          position: absolute;
          height: 4px;
          border-radius: 2px;
          background-color: #0d6efd;
          top: 11px;
          z-index: 2;
        }
      `}</style>
    </div>
  );
};

export default GitSettings;
