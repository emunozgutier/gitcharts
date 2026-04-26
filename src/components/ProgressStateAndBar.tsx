import React, { useState, useEffect } from 'react';

interface ProgressStateAndBarProps {
  state: string;
  progress: string | null;
}

const ProgressStateAndBar: React.FC<ProgressStateAndBarProps> = ({ state, progress }) => {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => (prev.length >= 3 ? '' : prev + '.'));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  if (state !== 'processing repo' && state !== 'Downloading repo' && state !== 'searching for repo name') {
    return null;
  }

  const baseProgress = progress?.replace(/\.+$/, '') || '';

  return (
    <div 
      className="position-absolute top-0 start-50 translate-middle-x mt-4 z-3 bg-white p-2 px-4 rounded-pill shadow-sm d-flex align-items-center gap-3" 
      style={{ opacity: 0.95, minWidth: '400px', border: '1px solid #eee' }}
    >
      <div className="fw-bold mb-0 text-nowrap small text-muted" style={{ minWidth: '180px', textAlign: 'left' }}>
        {baseProgress}<span style={{ display: 'inline-block', width: '1.2em' }}>{dots}</span>
      </div>
      <div className="progress flex-grow-1" style={{ height: '6px' }}>
        <div 
          className="progress-bar progress-bar-striped progress-bar-animated bg-primary" 
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
