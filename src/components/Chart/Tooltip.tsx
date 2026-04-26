import React from 'react';

interface TooltipProps {
  x: number;
  y: number;
  date: string;
  periods: { period: string; count: number }[];
}

const Tooltip: React.FC<TooltipProps> = ({ x, y, date, periods }) => {
  const totalLines = periods.reduce((sum, p) => sum + p.count, 0);

  return (
    <div 
      className="position-fixed shadow-sm rounded-3 bg-white border"
      style={{ 
        left: x + 15, 
        top: y + 15, 
        zIndex: 1050, 
        pointerEvents: 'none',
        minWidth: '220px',
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
      <div className="d-flex justify-content-between text-muted small mb-1 fw-bold">
        <span>Period</span>
        <span>Lines</span>
      </div>
      <div className="d-flex flex-column gap-1 mb-2">
        {periods.map(p => (
          <div key={p.period} className="d-flex justify-content-between small">
            <span>{p.period}</span>
            <span className="fw-semibold">{p.count.toLocaleString()}</span>
          </div>
        ))}
      </div>
      <div className="d-flex justify-content-between border-top pt-2 small fw-bold">
        <span>Total</span>
        <span>{totalLines.toLocaleString()}</span>
      </div>
    </div>
  );
};

export default Tooltip;
