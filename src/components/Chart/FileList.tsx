import React, { useMemo } from 'react';

interface FileListProps {
  commitDate: string;
  filesData: Record<string, number>;
  onClose: () => void;
}

const FileList: React.FC<FileListProps> = ({ commitDate, filesData, onClose }) => {
  // Group files by folder
  const groupedFiles = useMemo(() => {
    const groups: Record<string, { filename: string; count: number }[]> = {};
    for (const [filepath, count] of Object.entries(filesData)) {
      const parts = filepath.split('/');
      const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : '(root)';
      const filename = parts[parts.length - 1];
      
      if (!groups[folder]) groups[folder] = [];
      groups[folder].push({ filename, count });
    }
    
    // Sort files within each folder by count descending
    for (const folder in groups) {
      groups[folder].sort((a, b) => b.count - a.count);
    }
    
    return groups;
  }, [filesData]);

  const sortedFolders = Object.keys(groupedFiles).sort();
  const totalLines = Object.values(filesData).reduce((a, b) => a + b, 0);

  return (
    <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content shadow-lg rounded-4">
          <div className="modal-header border-bottom-0 pb-0">
            <h5 className="modal-title fw-bold">
              Files on {new Date(commitDate).toLocaleDateString()}
            </h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close"></button>
          </div>
          <div className="modal-body">
            <div className="d-flex justify-content-between align-items-center mb-3 text-muted small">
               <span>Showing all files present in the snapshot.</span>
               <span className="badge bg-secondary rounded-pill">{totalLines.toLocaleString()} total lines</span>
            </div>
            
            {sortedFolders.length === 0 ? (
              <div className="text-center p-4 text-muted">No file details available.</div>
            ) : (
              <div className="accordion accordion-flush" id="fileHierarchyAccordion">
                {sortedFolders.map((folder, idx) => {
                  const folderLines = groupedFiles[folder].reduce((sum, f) => sum + f.count, 0);
                  const headingId = `flush-heading-${idx}`;
                  const collapseId = `flush-collapse-${idx}`;
                  
                  return (
                    <div className="accordion-item border rounded-3 mb-2 overflow-hidden shadow-sm" key={folder}>
                      <h2 className="accordion-header" id={headingId}>
                        <button 
                          className="accordion-button collapsed py-2" 
                          type="button" 
                          data-bs-toggle="collapse" 
                          data-bs-target={`#${collapseId}`} 
                          aria-expanded="false" 
                          aria-controls={collapseId}
                          style={{ backgroundColor: '#f8f9fa' }}
                        >
                          <i className="bi bi-folder2-open me-2 text-primary"></i>
                          <span className="fw-semibold me-auto">{folder}</span>
                          <span className="badge bg-primary rounded-pill ms-3">{folderLines.toLocaleString()} lines</span>
                        </button>
                      </h2>
                      <div id={collapseId} className="accordion-collapse collapse" aria-labelledby={headingId}>
                        <div className="accordion-body p-0">
                          <div className="list-group list-group-flush">
                            {groupedFiles[folder].map((file) => (
                              <div key={file.filename} className="list-group-item d-flex justify-content-between align-items-center px-4 py-2 border-0 border-bottom">
                                <span className="text-truncate me-3" style={{ maxWidth: '80%', fontFamily: 'monospace', fontSize: '0.85em' }} title={file.filename}>
                                  <i className="bi bi-file-earmark-code text-muted me-2"></i>
                                  {file.filename}
                                </span>
                                <span className="text-muted small">
                                  {file.count.toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileList;
