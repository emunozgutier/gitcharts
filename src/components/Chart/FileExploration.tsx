import React from 'react';
import { type BlameDataPoint } from '../../store/useStore';

interface FileExplorationProps {
  datum: BlameDataPoint;
  onClose: () => void;
}

const FileExploration: React.FC<FileExplorationProps> = ({ datum, onClose }) => {
  // Sort files by line count descending
  const filesList = datum.files
    ? Object.entries(datum.files).sort((a, b) => b[1] - a[1])
    : [];

  return (
    <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="modal-dialog modal-dialog-centered modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content shadow-lg rounded-4">
          <div className="modal-header border-bottom-0 pb-0">
            <h5 className="modal-title fw-bold">
              Files from {datum.period}
            </h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close"></button>
          </div>
          <div className="modal-body">
            <p className="text-muted small mb-3">
              Showing files present in the snapshot from <strong>{new Date(datum.commit_date).toLocaleDateString()}</strong> that contain lines originating from the period <strong>{datum.period}</strong>.
            </p>
            
            {filesList.length === 0 ? (
              <div className="text-center p-4 text-muted">No file details available.</div>
            ) : (
              <div className="list-group rounded-3 overflow-auto" style={{ maxHeight: '400px' }}>
                {filesList.map(([filename, count]) => (
                  <div key={filename} className="list-group-item d-flex justify-content-between align-items-center">
                    <span className="text-truncate me-3" style={{ maxWidth: '80%', fontFamily: 'monospace', fontSize: '0.9em' }} title={filename}>
                      {filename}
                    </span>
                    <span className="badge bg-primary rounded-pill">
                      {count} lines
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileExploration;
