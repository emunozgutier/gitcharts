import React, { useMemo } from 'react';

interface TimeFrameAndPointsProps {
  timeRange: { min: number; max: number };
  minVal: number;
  maxVal: number;
  setMinVal: (val: number) => void;
  setMaxVal: (val: number) => void;
  depth: number;
  setDepth: (val: number) => void;
  safeMaxPoints: number;
  effectiveDepth: number;
  distanceDays: string;
  commitsInRange: number;
  commitTimestamps: number[];
}

const TimeFrameAndPoints: React.FC<TimeFrameAndPointsProps> = ({
  timeRange,
  minVal,
  maxVal,
  setMinVal,
  setMaxVal,
  depth,
  setDepth,
  safeMaxPoints,
  effectiveDepth,
  distanceDays,
  commitsInRange,
  commitTimestamps,
}) => {
  const formatDate = (ts: number) => {
    return new Date(ts * 1000).toISOString().split('T')[0];
  };

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.min(Number(e.target.value), maxVal - 60);
    setMinVal(value);
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(Number(e.target.value), minVal + 60);
    setMaxVal(value);
  };

  const histogramData = useMemo(() => {
    if (commitTimestamps.length === 0) return [];
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

  const histogramTicks = useMemo(() => [
    { label: formatDate(minVal), position: ((minVal - timeRange.min) / (timeRange.max - timeRange.min)) * 100 },
    { label: formatDate(maxVal), position: ((maxVal - timeRange.min) / (timeRange.max - timeRange.min)) * 100 }
  ], [minVal, maxVal, timeRange.min, timeRange.max]);

  const daysInRange = Math.max(1, (maxVal - minVal) / 86400);

  return (
    <div className="row g-4 mb-4">
      {/* Time Frame */}
      <div className="col-12 col-md-6">
        <label className="form-label text-muted small text-uppercase fw-bold mb-4 ls-1 d-block">1. Time Frame</label>
        
        <div className="histogram-container position-relative mb-0 d-flex align-items-end px-2" style={{ height: '60px', gap: '1px' }}>
          {histogramData.map((d, i) => (
            <div 
              key={i}
              className={`histogram-bar flex-grow-1 ${d.inRange ? 'bg-primary' : 'bg-secondary opacity-25'}`}
              style={{ height: `${Math.max(4, d.height)}%`, transition: 'all 0.2s ease', borderRadius: '1px 1px 0 0' }}
              title={`${d.date}: ${d.count} commits`}
            />
          ))}
        </div>

        <div className="range-slider-container px-2 pb-3">
          <div className="dual-range-wrapper position-relative" style={{ height: '35px', marginTop: '-14px' }}>
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

          <div className="histogram-axis position-relative mt-2 px-2" style={{ height: '20px' }}>
            {histogramTicks.map((tick, i) => (
              <span 
                key={i} 
                className="position-absolute text-primary fw-bold smallest bg-primary bg-opacity-10 px-2 py-0.5 rounded-pill" 
                style={{ 
                  left: `${tick.position}%`, 
                  transform: i === 0 ? 'translateX(0%)' : 'translateX(-100%)',
                  whiteSpace: 'nowrap',
                  zIndex: 5
                }}
              >
                {tick.label}
              </span>
            ))}
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
    </div>
  );
};

export default TimeFrameAndPoints;
