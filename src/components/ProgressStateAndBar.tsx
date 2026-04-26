import React, { useState, useEffect } from 'react';

interface ProgressStateAndBarProps {
  state: string;
  progress: string | null;
}

const ProgressStateAndBar: React.FC<ProgressStateAndBarProps> = ({ state, progress }) => {
  const [dots, setDots] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      setDots(prev => (prev.length >= 3 ? '' : prev + '.'));
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 400);
    return () => clearInterval(interval);
  }, [state]);

  if (state !== 'processing repo' && state !== 'Downloading repo' && state !== 'searching for repo name') {
    return null;
  }

  let pctValue = 100;
  let isIndeterminate = true;

  if (progress) {
    const pctMatch = progress.match(/\((\d+)%\)/);
    if (pctMatch) {
      pctValue = parseInt(pctMatch[1], 10);
      isIndeterminate = false;
    } else {
      const snapMatch = progress.match(/SNAPSHOT.*?\((\d+)\/(\d+)\).*?Files:\s*(\d+)\/(\d+)/);
      if (snapMatch) {
        const snapIdx = parseInt(snapMatch[1], 10) - 1;
        const snapTotal = parseInt(snapMatch[2], 10);
        const fileIdx = parseInt(snapMatch[3], 10);
        const fileTotal = parseInt(snapMatch[4], 10);
        
        const snapProgress = fileTotal > 0 ? fileIdx / fileTotal : 0;
        pctValue = Math.round(((snapIdx + snapProgress) / snapTotal) * 100);
        isIndeterminate = false;
      } else {
        const simpleMatch = progress.match(/\((\d+)\/(\d+)\)/);
        if (simpleMatch) {
           pctValue = Math.round((parseInt(simpleMatch[1], 10) / parseInt(simpleMatch[2], 10)) * 100);
           isIndeterminate = false;
        }
      }
    }
  }

  const baseProgress = progress?.replace(/\.+$/, '') || '';
  const timeStr = `${Math.floor(elapsedSeconds / 60).toString().padStart(2, '0')}:${(elapsedSeconds % 60).toString().padStart(2, '0')}`;

  return (
    <div 
      className="position-absolute top-0 start-50 translate-middle-x mt-4 z-3 bg-white p-2 px-4 rounded-pill shadow-sm d-flex align-items-center gap-3" 
      style={{ opacity: 0.95, minWidth: '400px', border: '1px solid #eee' }}
    >
      <div className="fw-bold mb-0 text-nowrap small text-muted d-flex align-items-center gap-2" style={{ minWidth: '240px', textAlign: 'left' }}>
        <span className="badge bg-light text-secondary border" style={{ fontFamily: 'monospace' }}>{timeStr}</span>
        <span>{baseProgress}<span style={{ display: 'inline-block', width: '1.2em' }}>{dots}</span></span>
      </div>
      <div className="progress flex-grow-1" style={{ height: '6px' }}>
        <div 
          className="progress-bar progress-bar-striped progress-bar-animated bg-primary" 
          role="progressbar"
          aria-valuenow={pctValue} 
          aria-valuemin={0} 
          aria-valuemax={100}
          style={{ width: `${isIndeterminate ? 100 : pctValue}%` }}
        ></div>
      </div>
    </div>
  );
};

export default ProgressStateAndBar;
