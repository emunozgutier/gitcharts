import React from 'react';

interface TooltipProps {
  x: number;
  y: number;
  date: string;
  periods: { period: string; count: number; added: number }[];
}

const Tooltip: React.FC<TooltipProps> = ({ x, y, date, periods }) => {
  const totalLines = periods.reduce((sum, p) => sum + p.count, 0);
  const totalAdded = periods.reduce((sum, p) => sum + p.added, 0);

  // Prevent tooltip from overflowing the right side of the screen
  const isTooFarRight = x + 300 > window.innerWidth;
  const horizontalStyle = isTooFarRight 
    ? { right: window.innerWidth - x + 15 }
    : { left: x + 15 };

  return (
    <div 
      className="position-fixed shadow-sm rounded-3 bg-white border"
      style={{ 
        ...horizontalStyle,
        top: y + 15, 
        zIndex: 1050, 
        pointerEvents: 'none',
        minWidth: '260px',
        padding: '12px',
        fontFamily: 'Outfit, sans-serif'
      }}
    >
      <div className="text-primary small fw-bold mb-1">
        <i className="bi bi-cursor-fill me-1"></i> Click to explore
      </div>
      <div className="fw-bold border-bottom pb-2 mb-2">
        {new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
      </div>
      <div className="d-flex text-muted small mb-1 fw-bold">
        <span style={{ width: '35%' }}>Period</span>
        <span style={{ width: '35%', textAlign: 'right' }}>Lines</span>
        <span style={{ width: '30%', textAlign: 'right' }}>Added</span>
      </div>
      <div className="d-flex flex-column gap-1 mb-2">
        {periods.map(p => (
          <div key={p.period} className="d-flex small">
            <span style={{ width: '35%' }}>{p.period}</span>
            <span className="fw-semibold" style={{ width: '35%', textAlign: 'right' }}>
              {p.count.toLocaleString()}
            </span>
            <span style={{ width: '30%', textAlign: 'right' }}>
              {p.added > 0 ? (
                <span className="text-success"><i className="bi bi-arrow-up-short"></i>{p.added.toLocaleString()}</span>
              ) : p.added < 0 ? (
                <span className="text-danger"><i className="bi bi-arrow-down-short"></i>{Math.abs(p.added).toLocaleString()}</span>
              ) : (
                <span className="text-muted">-</span>
              )}
            </span>
          </div>
        ))}
      </div>
      <div className="d-flex border-top pt-2 small fw-bold">
        <span style={{ width: '35%' }}>Total</span>
        <span style={{ width: '35%', textAlign: 'right' }}>{totalLines.toLocaleString()}</span>
        <span style={{ width: '30%', textAlign: 'right' }}>
           {totalAdded > 0 ? (
              <span className="text-success"><i className="bi bi-arrow-up-short"></i>{totalAdded.toLocaleString()}</span>
            ) : totalAdded < 0 ? (
              <span className="text-danger"><i className="bi bi-arrow-down-short"></i>{Math.abs(totalAdded).toLocaleString()}</span>
            ) : (
              <span className="text-muted">-</span>
            )}
        </span>
      </div>
    </div>
  );
};

export default Tooltip;
