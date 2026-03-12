import React, { useState, useEffect, useRef } from 'react';
import { GitArchaeology, type BlameDataPoint } from './git_archeology';
import embed from 'vega-embed';

interface GitArchaeologyDisplayProps {
  repoFullName: string;
}

const GitArchaeologyDisplay: React.FC<GitArchaeologyDisplayProps> = ({ repoFullName }) => {
  const [stats, setStats] = useState<{ size: number; language: string; forks: number } | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [data, setData] = useState<BlameDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setProgress("Fetching repository metadata...");
      setData([]);
      
      try {
        const repoRes = await fetch(`https://api.github.com/repos/${repoFullName}`);
        const repoData = await repoRes.json();
        setStats({
          size: repoData.size,
          language: repoData.language,
          forks: repoData.forks_count
        });

        const archaeology = new GitArchaeology(repoFullName);
        const results = await archaeology.runLegacy((msg) => setProgress(msg));
        
        setData(results);
        setProgress(null);
      } catch (err) {
        setProgress("Error: Failed to perform archaeology.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [repoFullName]);

  useEffect(() => {
    if (data.length > 0 && chartRef.current) {
      const spec: any = {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        width: 'container',
        height: 'container', // Make chart fill available height
        autosize: { type: 'fit', contains: 'padding' },
        data: { values: data },
        mark: { type: 'area', line: true, tooltip: true },
        encoding: {
          x: {
            field: 'commit_date',
            type: 'nominal',
            title: null,
            axis: { labelAngle: -45, grid: false }
          },
          y: {
            field: 'line_count',
            type: 'quantitative',
            title: 'Lines of Code',
            stack: 'zero',
            axis: { grid: true, gridOpacity: 0.1 }
          },
          color: {
            field: 'period',
            type: 'nominal',
            title: 'Period Added',
            scale: { scheme: 'viridis' },
            sort: 'descending' // 2024 top, 2020 bottom of legend
          },
          order: {
             field: 'period',
             sort: 'ascending' // 2020 bottom of stack
          },
          tooltip: [
            { field: 'commit_date', title: 'Snapshot' },
            { field: 'period', title: 'Code from' },
            { field: 'line_count', title: 'Lines', format: ',' }
          ]
        },
        config: {
          view: { stroke: null },
          axis: { labelFontSize: 10, titleFontSize: 12 }
        }
      };

      embed(chartRef.current, spec, { actions: false, theme: 'fivethirtyeight' }).catch(console.error);
    }
  }, [data]);

  return (
    <div className="d-flex flex-column h-100 w-100">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0 fw-bold">{repoFullName} archaeology</h4>
        <div className="d-flex gap-3">
          {stats && (
            <>
              <div className="small"><span className="text-muted">Size:</span> {Math.round(stats.size / 1024)}MB</div>
              <div className="small"><span className="text-muted">Lang:</span> {stats.language}</div>
              <div className="small"><span className="text-muted">Forks:</span> {stats.forks}</div>
            </>
          )}
        </div>
      </div>

      <div className="flex-grow-1 bg-white rounded-3 shadow-sm border p-3 chart-wrapper position-relative">
        {progress && (
          <div className="position-absolute top-50 start-50 translate-middle text-center">
            <div className="spinner-border text-primary mb-2" role="status"></div>
            <div className="text-muted small">{progress}</div>
          </div>
        )}
        
        <div ref={chartRef} className="w-100 h-100" style={{ minHeight: '300px' }}></div>
      </div>
      
      <div className="d-flex justify-content-between align-items-center mt-2 px-1">
        <small className="text-muted">Older code is stacked at the bottom (sediment).</small>
        {loading && <small className="text-primary fw-bold">Updating...</small>}
      </div>
    </div>
  );
};

export default GitArchaeologyDisplay;
