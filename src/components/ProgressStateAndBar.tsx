import React from 'react';

interface ProgressStateAndBarProps {
  state: string;
  progress: string | null;
}

const ProgressStateAndBar: React.FC<ProgressStateAndBarProps> = ({ state, progress }) => {
  if (state !== 'ANALYZING' && state !== 'CLONING') {
    return null;
  }

  return (
    <div className="position-absolute top-50 start-50 translate-middle text-center w-75">
      <div className="spinner-grow text-primary mb-3" role="status"></div>
      <div className="h4 fw-bold mb-2">{progress}</div>
      <div className="progress" style={{ height: '4px' }}>
        <div 
          className="progress-bar progress-bar-striped progress-bar-animated" 
          role="progressbar"
          aria-valuenow={100} 
          aria-valuemin={0} 
          aria-valuemax={100}
          style={{ width: '100%' }}
        ></div>
      </div>
    </div>
  );
};

export default ProgressStateAndBar;
