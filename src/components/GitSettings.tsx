import React, { useState, useMemo, useEffect } from 'react';
import { type GranularityUnit } from './gitComponents/GitProcessing';
import TimeFrameAndPoints from './Settings/TimeFrameAndPoints';
import FileTypesAndFolderStructure, { type FolderNode } from './Settings/FileTypesAndFolderStructure';

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

const GitSettings: React.FC<GitSettingsProps> = ({ extensions, folders, folderLines, timeRange, commitTimestamps, onAnalyze }) => {
  const [selectedExtensions, setSelectedExtensions] = useState<string[]>([]);
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['.']));
  const [depth, setDepth] = useState<number>(50);
  
  const [minVal, setMinVal] = useState(timeRange.min);
  const [maxVal, setMaxVal] = useState(timeRange.max);

  const totalLines = useMemo(() => 
    Object.values(extensions).reduce((sum, count) => (sum as number) + (count as number), 0), 
  [extensions]);

  const topExtensions = useMemo(() => {
    const sorted = Object.entries(extensions)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5);
    return sorted.map(([ext, count]) => ({
      ext,
      count: count as number,
      percentage: (((count as number) / (totalLines as number)) * 100).toFixed(1)
    }));
  }, [extensions, totalLines]);

  // Preselect top extensions by default
  useEffect(() => {
    if (topExtensions.length > 0 && selectedExtensions.length === 0) {
      setSelectedExtensions(topExtensions.map(te => te.ext));
    }
  }, [topExtensions, selectedExtensions.length]);

  // Build Tree Structure
  const folderTree = useMemo(() => {
    const root: FolderNode = { name: 'root', path: '.', lines: 0, children: [] };
    const folderMap: Record<string, FolderNode> = { '.': root };

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

    const aggregateLines = (node: FolderNode): number => {
      const childrenSum = node.children.reduce((sum, child) => sum + aggregateLines(child), 0);
      node.lines += childrenSum;
      return node.lines;
    };
    aggregateLines(root);

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
  }, [folders, selectedFolders.length]);

  const toISODate = (ts: number) => {
    return new Date(ts * 1000).toISOString().split('T')[0];
  };

  const daysInRange = Math.max(1, (maxVal - minVal) / 86400);
  const maxPossiblePoints = Math.floor(daysInRange) + 1;
  const safeMaxPoints = Math.min(200, maxPossiblePoints);
  const effectiveDepth = Math.max(2, Math.min(depth, safeMaxPoints));
  const distanceDays = Math.round(daysInRange / (effectiveDepth - 1)).toString();
  
  const commitsInRange = useMemo(() => {
    return commitTimestamps.filter(ts => ts >= minVal && ts <= maxVal).length;
  }, [commitTimestamps, minVal, maxVal]);

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

  return (
    <div className="git-settings card shadow-sm p-4 h-100 overflow-auto border-0">
      <h3 className="h5 mb-4 fw-bold d-flex align-items-center">
        <span className="me-2">⚙️</span> Analysis Settings
      </h3>
      
      <TimeFrameAndPoints
        timeRange={timeRange}
        minVal={minVal}
        maxVal={maxVal}
        setMinVal={setMinVal}
        setMaxVal={setMaxVal}
        setDepth={setDepth}
        safeMaxPoints={safeMaxPoints}
        effectiveDepth={effectiveDepth}
        distanceDays={distanceDays}
        commitsInRange={commitsInRange}
        commitTimestamps={commitTimestamps}
      />

      <div className="row g-4 mb-4">
        <FileTypesAndFolderStructure
          topExtensions={topExtensions}
          selectedExtensions={selectedExtensions}
          toggleExtension={toggleExtension}
          folderTree={folderTree}
          selectedFolders={selectedFolders}
          setSelectedFolders={setSelectedFolders}
          folders={folders}
          topLevelTotalLines={topLevelTotalLines}
          expandedFolders={expandedFolders}
          toggleExpand={toggleExpand}
          toggleFolderNode={toggleFolderNode}
        />
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
          cursor: pointer;
          height: 14px;
          width: 16px;
          margin-top: 25px;
          pointer-events: all;
          position: relative;
          -webkit-appearance: none;
          clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
          border: none;
        }
        .thumb::-moz-range-thumb {
          background-color: #0d6efd;
          cursor: pointer;
          height: 14px;
          width: 16px;
          pointer-events: all;
          position: relative;
          border: none;
          clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
          transform: translateY(23px);
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
