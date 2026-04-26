import React from 'react';

export interface FolderNode {
  name: string;
  path: string;
  lines: number;
  children: FolderNode[];
}

interface FileTypesAndFolderStructureProps {
  topExtensions: Array<{ ext: string; count: number; percentage: string }>;
  selectedExtensions: string[];
  toggleExtension: (ext: string) => void;
  folderTree: FolderNode[];
  selectedFolders: string[];
  setSelectedFolders: (folders: string[]) => void;
  folders: string[];
  topLevelTotalLines: number;
  expandedFolders: Set<string>;
  toggleExpand: (path: string) => void;
  toggleFolderNode: (node: FolderNode, isChecked: boolean) => void;
}

const FileTypesAndFolderStructure: React.FC<FileTypesAndFolderStructureProps> = ({
  topExtensions,
  selectedExtensions,
  toggleExtension,
  folderTree,
  selectedFolders,
  setSelectedFolders,
  folders,
  topLevelTotalLines,
  expandedFolders,
  toggleExpand,
  toggleFolderNode,
}) => {
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
    <>
      {/* File Types */}
      <div className="col-12 border-top pt-4">
        <label className="form-label text-muted small text-uppercase fw-bold mb-3 ls-1 d-block">3. File Types (Top 5)</label>
        <div className="d-flex flex-nowrap gap-2 overflow-x-auto pb-2" style={{ WebkitOverflowScrolling: 'touch' }}>
          {topExtensions.map(({ ext, percentage }) => (
            <button
              key={ext}
              type="button"
              className={`btn btn-sm rounded-pill px-3 border transition-all text-nowrap flex-shrink-0 ${selectedExtensions.includes(ext) ? 'btn-primary shadow-sm' : 'btn-outline-secondary'}`}
              onClick={() => toggleExtension(ext)}
            >
              {ext} <span className="opacity-75 ps-1">{percentage}%</span>
            </button>
          ))}
        </div>
      </div>

      {/* Folder Structure */}
      <div className="col-12 border-top pt-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <label className="form-label text-muted small text-uppercase fw-bold mb-0 ls-1">4. Folder structure</label>
          <button 
            className="btn btn-link btn-sm text-decoration-none p-0 smallest"
            onClick={() => setSelectedFolders(selectedFolders.length === folders.length - 1 ? [] : folders.filter(f => f !== '.'))}
          >
            {selectedFolders.length === folders.length - 1 ? 'Deselect All' : 'Select All'}
          </button>
        </div>
        <div className="folder-tree-container border rounded bg-white p-2">
          {folderTree.map(node => renderFolderNode(node))}
        </div>
      </div>
    </>
  );
};

export default FileTypesAndFolderStructure;
