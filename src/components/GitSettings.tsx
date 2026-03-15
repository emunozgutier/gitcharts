import React, { useState, useMemo, useEffect } from 'react';
import { type GranularityUnit } from './gitComponents/GitBlame';

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
    granularity: GranularityUnit;
  }) => void;
  commitTimestamps: number[];
}

interface FolderNode {
  name: string;
  path: string;
  lines: number;
  children: FolderNode[];
}

const GitSettings: React.FC<GitSettingsProps> = ({ extensions, folders, folderLines, timeRange, commitTimestamps, onAnalyze }) => {
  const [selectedExtensions, setSelectedExtensions] = useState<string[]>([]);
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
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

  // Preselect top extensions by default
  useEffect(() => {
    if (topExtensions.length > 0 && selectedExtensions.length === 0) {
      setSelectedExtensions(topExtensions.map(te => te.ext));
    }
  }, [topExtensions]);

  // Build Tree Structure
  const folderTree = useMemo(() => {
    const root: FolderNode = { name: 'root', path: '.', lines: 0, children: [] };
    const folderMap: Record<string, FolderNode> = { '.': root };

    // Sort by path length to ensure parents are handled first (though not strictly necessary with this logic)
    const sortedPaths = [...folders].sort((a, b) => a.length - b.length);

    for (const path of sortedPaths) {
      if (path === '.') continue;
      
      const parts = path.split('/');
      let currentPath = '';
      let parent: FolderNode = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        
        if (!folderMap[currentPath]) {
          const node: FolderNode = { 
            name: part, 
            path: currentPath, 
            lines: folderLines[currentPath] || 0, 
            children: [] 
          };
          folderMap[currentPath] = node;
          parent.children.push(node);
        }
        parent = folderMap[currentPath];
      }
    }

    // Aggregate lines recursively (children lines sum up to parent)
    const aggregateLines = (node: FolderNode): number => {
      const childrenSum = node.children.reduce((sum, child) => sum + aggregateLines(child), 0);
      node.lines += childrenSum;
      return node.lines;
    };
    aggregateLines(root);

    // Sort children by aggregated lines
    const sortNodes = (node: FolderNode) => {
      node.children.sort((a, b) => b.lines - a.lines);
      node.children.forEach(sortNodes);
    };
    sortNodes(root);

    return root.children;
  }, [folders, folderLines]);

  const topLevelTotalLines = useMemo(() => {
    return folderTree.reduce((sum, node) => sum + node.lines, 0);
  }, [folderTree]);

  // Initial Preselection
  useEffect(() => {
    if (folders.length > 0 && selectedFolders.length === 0) {
      setSelectedFolders(folders.filter(f => f !== '.'));
    }
  }, [folders]);

  const formatDate = (ts: number) => {
    return new Date(ts * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };
  
  const toISODate = (ts: number) => {
    return new Date(ts * 1000).toISOString().split('T')[0];
  };

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.min(Number(e.target.value), maxVal - 86400); // 1 day
    setMinVal(value);
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(Number(e.target.value), minVal + 86400);
    setMaxVal(value);
  };

  const daysInRange = Math.max(1, (maxVal - minVal) / 86400);
  const maxPossiblePoints = Math.floor(daysInRange) + 1;
  const safeMaxPoints = Math.min(200, maxPossiblePoints);
  const effectiveDepth = Math.max(2, Math.min(depth, safeMaxPoints));
  const distanceDays = (daysInRange / (effectiveDepth - 1)).toFixed(1);
  
  const commitsInRange = useMemo(() => {
    return commitTimestamps.filter(ts => ts >= minVal && ts <= maxVal).length;
  }, [commitTimestamps, minVal, maxVal]);

  const histogramData = useMemo(() => {
    if (commitTimestamps.length === 0) return [];
    
    // Group into buckets (daily)
    const start = Math.floor(timeRange.min / 86400) * 86400;
    const end = Math.ceil(timeRange.max / 86400) * 86400;
    const numDays = Math.max(1, Math.ceil((end - start) / 86400));
    
    const buckets = new Array(numDays).fill(0);
    for (const ts of commitTimestamps) {
      const idx = Math.floor((ts - start) / 86400);
      if (idx >= 0 && idx < numDays) {
        buckets[idx]++;
      }
    }
    
    const maxCommits = Math.max(...buckets, 1);
    
    return buckets.map((count, i) => {
      const ts = start + i * 86400;
      return {
        timestamp: ts,
        count,
        height: (count / maxCommits) * 100,
        date: new Date(ts * 1000).toISOString().split('T')[0],
        inRange: ts >= minVal && ts <= maxVal
      };
    });
  }, [commitTimestamps, timeRange.min, timeRange.max, minVal, maxVal]);

  const histogramTicks = useMemo(() => {
    if (histogramData.length === 0) return [];
    
    // Choose about 4-6 labels to display
    const numLabels = 5;
    const ticks = [];
    if (histogramData.length > 0) {
      for (let i = 0; i < numLabels; i++) {
        const idx = Math.floor(i * (histogramData.length - 1) / (numLabels - 1));
        ticks.push({
          label: histogramData[idx].date,
          position: (idx / (histogramData.length - 1)) * 100
        });
      }
    }
    return ticks;
  }, [histogramData]);

  const toggleExtension = (ext: string) => {
    setSelectedExtensions(prev => 
      prev.includes(ext) ? prev.filter(e => e !== ext) : [...prev, ext]
    );
  };

  const getAllNestedPaths = (node: FolderNode): string[] => {
    let paths = [node.path];
    for (const child of node.children) {
      paths = [...paths, ...getAllNestedPaths(child)];
    }
    return paths;
  };

  const toggleFolderNode = (node: FolderNode, isChecked: boolean) => {
    const pathsToToggle = getAllNestedPaths(node);
    if (isChecked) {
      setSelectedFolders(prev => [...new Set([...prev, ...pathsToToggle])]);
    } else {
      setSelectedFolders(prev => prev.filter(p => !pathsToToggle.includes(p)));
    }
  };

  const toggleExpand = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const renderFolderNode = (node: FolderNode, level: number = 0) => {
    const isExpanded = expandedFolders.has(node.path);
    const hasChildren = node.children.length > 0;
    const isChecked = selectedFolders.includes(node.path);
    const pct = ((node.lines / (topLevelTotalLines || 1)) * 100).toFixed(1);

    return (
      <div key={node.path} className="folder-node-wrapper">
        <div 
          className="folder-node d-flex align-items-center py-1 px-2 rounded-1 hover-bg"
          style={{ marginLeft: `${level * 16}px` }}
        >
          <button 
            type="button"
            className={`btn btn-link p-0 me-1 text-decoration-none transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            style={{ width: '16px', visibility: hasChildren ? 'visible' : 'hidden', color: '#6e7781' }}
            onClick={() => toggleExpand(node.path)}
          >
            ▶
          </button>
          
          <div className="form-check mb-0 d-flex align-items-center flex-grow-1">
            <input 
              type="checkbox" 
              className="form-check-input me-2 mt-0" 
              checked={isChecked}
              onChange={(e) => toggleFolderNode(node, e.target.checked)}
              id={`folder-${node.path}`}
            />
            <label className="form-check-label text-truncate small d-flex align-items-center w-100" htmlFor={`folder-${node.path}`} style={{ cursor: 'pointer' }}>
              <span className="me-2">{hasChildren ? '📂' : '📁'}</span>
              <span className="flex-grow-1 text-truncate">{node.name}</span>
              <span className="text-muted opacity-50 smaller ms-2">{pct}%</span>
            </label>
          </div>
        </div>
        {isExpanded && hasChildren && (
          <div className="folder-children">
            {node.children.map(child => renderFolderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="git-settings card shadow-sm p-4 h-100 overflow-auto border-0">
      <h3 className="h5 mb-4 fw-bold d-flex align-items-center">
        <span className="me-2">⚙️</span> Analysis Settings
      </h3>
      
      <div className="row g-4 mb-4">
        {/* Time Frame */}
        <div className="col-12 col-md-6">
          <label className="form-label text-muted small text-uppercase fw-bold mb-4 ls-1 d-block">1. Time Frame</label>
          
          {/* Histogram */}
          <div className="histogram-container position-relative mb-1 d-flex align-items-end px-2" style={{ height: '60px', gap: '1px' }}>
            {histogramData.map((d, i) => (
              <div 
                key={i}
                className={`histogram-bar flex-grow-1 ${d.inRange ? 'bg-primary' : 'bg-secondary opacity-25'}`}
                style={{ height: `${Math.max(4, d.height)}%`, transition: 'all 0.2s ease', borderRadius: '1px 1px 0 0' }}
                title={`${d.date}: ${d.count} commits`}
              />
            ))}
          </div>
          
          {/* Histogram Axis Labels */}
          <div className="histogram-axis position-relative mb-3 px-2" style={{ height: '14px' }}>
            {histogramTicks.map((tick, i) => (
              <span 
                key={i} 
                className="position-absolute text-muted smallest" 
                style={{ 
                  left: `${tick.position}%`, 
                  transform: i === 0 ? 'none' : i === histogramTicks.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
                  whiteSpace: 'nowrap'
                }}
              >
                {tick.label}
              </span>
            ))}
          </div>

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

        {/* Time Points */}
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
              <span>Timeline Stats:</span>
              <span className={`fw-bold ${parseFloat(distanceDays) >= 1 ? 'text-success' : 'text-warning'}`}>
                {parseFloat(distanceDays) >= 1 ? '✓ Optimal' : '⚠ High'}
              </span>
            </div>
            <div className="d-flex justify-content-between align-items-center">
                <div className="h6 mb-0 fw-bold">{distanceDays} days <span className="text-muted fw-normal smaller">avg spacing</span></div>
                <div className="h6 mb-0 fw-bold">{commitsInRange} <span className="text-muted fw-normal smaller">commits</span></div>
            </div>
          </div>
        </div>


        {/* File Types */}
        <div className="col-12 border-top pt-4">
          <label className="form-label text-muted small text-uppercase fw-bold mb-3 ls-1 d-block">3. Code Types (Top 5)</label>
          <div className="d-flex flex-wrap gap-2">
            {topExtensions.map(({ ext, percentage }) => (
              <button
                key={ext}
                type="button"
                className={`btn btn-sm rounded-pill px-3 border transition-all ${selectedExtensions.includes(ext) ? 'btn-primary shadow-sm' : 'btn-outline-secondary'}`}
                onClick={() => toggleExtension(ext)}
              >
                {ext} <span className="opacity-75 ps-1">{percentage}%</span>
              </button>
            ))}
          </div>
        </div>

        {/* Folder Tree */}
        <div className="col-12 border-top pt-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <label className="form-label text-muted small text-uppercase fw-bold mb-0 ls-1">4. Folder Hierarchy</label>
            <button 
              className="btn btn-link btn-sm text-decoration-none p-0 smallest"
              onClick={() => setSelectedFolders(selectedFolders.length === folders.length - 1 ? [] : folders.filter(f => f !== '.'))}
            >
              {selectedFolders.length === folders.length - 1 ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div className="folder-tree-container border rounded bg-white p-2 overflow-auto" style={{ maxHeight: '300px' }}>
            {folderTree.map(node => renderFolderNode(node))}
          </div>
        </div>
      </div>

      <div className="mt-auto pt-3 border-top">
        <button 
          className="btn btn-primary btn-lg w-100 fw-bold py-3 rounded-pill shadow"
          onClick={() => onAnalyze({
            selectedExtensions,
            selectedFolders,
            depth: effectiveDepth,
            startDate: toISODate(minVal),
            endDate: toISODate(maxVal),
            granularity: 'quarter' as GranularityUnit
          })}
        >
          Start Archaeology Analysis
        </button>
      </div>

      <style>{`
        .ls-1 { letter-spacing: 0.1em; }
        .smallest { font-size: 0.7rem; }
        .hover-bg:hover { background-color: #f8f9fa; }
        .rotate-90 { transform: rotate(90deg); }
        .transition-transform { transition: transform 0.15s ease; }
        .transition-all { transition: all 0.2s ease; }
        
        .folder-node button { font-size: 0.6rem; display: flex; align-items: center; justify-content: center; }
        .folder-tree-container::-webkit-scrollbar { width: 6px; }
        .folder-tree-container::-webkit-scrollbar-thumb { background: #dee2e6; border-radius: 3px; }
        
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
          box-shadow: 0 0 4px rgba(0,0,0,0.1);
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
          box-shadow: 0 0 4px rgba(0,0,0,0.1);
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

        .histogram-bar:hover {
          background-color: #0a58ca !important;
          opacity: 1 !important;
          transform: scaleY(1.1);
        }
      `}</style>
    </div>
  );
};

export default GitSettings;
