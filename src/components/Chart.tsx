import React, { useEffect, useRef, useState } from 'react';
import embed from 'vega-embed';
import { type BlameDataPoint } from '../store/useStore';
import FileList from './Chart/FileList';

interface ChartProps {
  data: BlameDataPoint[];
}

const Chart: React.FC<ChartProps> = ({ data }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [selectedDateData, setSelectedDateData] = useState<{ commitDate: string; filesData: Record<string, number> } | null>(null);

  useEffect(() => {
    if (data.length > 0 && chartRef.current) {
      const spec: any = {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        width: 'container',
        height: 'container',
        autosize: { type: 'fit', contains: 'padding' },
        data: { values: data },
        layer: [
          {
            mark: { type: 'area', line: { color: '#fff', strokeWidth: 0.5 }, tooltip: true },
            encoding: {
              x: {
                field: 'commit_date',
                type: 'temporal',
                title: null,
                axis: { format: '%Y-%m', grid: false, labelColor: '#6e7781' }
              },
              y: {
                field: 'line_count',
                type: 'quantitative',
                title: 'Lines of Code',
                stack: 'zero',
                axis: { grid: true, gridOpacity: 0.1, labelColor: '#6e7781' }
              },
              color: {
                field: 'period',
                type: 'nominal',
                title: 'Period Added',
                scale: { scheme: 'magma' },
                sort: 'descending',
                legend: { 
                  orient: 'right', 
                  offset: 20,
                  titleFontSize: 12,
                  labelFontSize: 10,
                  symbolType: 'square'
                }
              },
              order: {
                 field: 'period',
                 sort: 'ascending'
              },
              tooltip: [
                { field: 'commit_date', title: 'Snapshot', type: 'temporal', format: '%b %Y' },
                { field: 'period', title: 'Code from' },
                { field: 'line_count', title: 'Lines', format: ',' }
              ]
            }
          },
          {
            mark: { type: "rule", color: "gray", strokeWidth: 1.5 },
            params: [{
              name: "hover",
              select: {
                type: "point",
                fields: ["commit_date"],
                nearest: true,
                on: "mouseover",
                clear: "mouseout"
              }
            }],
            encoding: {
              x: { field: "commit_date", type: "temporal" },
              opacity: {
                condition: { param: "hover", empty: false, value: 1 },
                value: 0
              }
            }
          }
        ],
        config: {
          view: { stroke: null },
          font: 'Outfit, sans-serif'
        }
      };

      embed(chartRef.current, spec, { actions: false }).then(result => {
        result.view.addEventListener('click', (_event, item) => {
          if (item && item.datum && item.datum.commit_date) {
            const commitDate = item.datum.commit_date;
            
            // Aggregate all files for this commit_date
            const filesForDate: Record<string, number> = {};
            data.forEach(d => {
              // Convert both to time to compare accurately in case format varies
              if (new Date(d.commit_date).getTime() === new Date(commitDate).getTime() && d.files) {
                for (const [filename, count] of Object.entries(d.files)) {
                  filesForDate[filename] = (filesForDate[filename] || 0) + count;
                }
              }
            });

            setSelectedDateData({
              commitDate,
              filesData: filesForDate
            });
          }
        });
      }).catch(console.error);
    }
  }, [data]);

  return (
    <div className="chart-wrapper h-100 w-100 position-relative">
      <div ref={chartRef} className="w-100 h-100" style={{ cursor: 'pointer' }}></div>
      {selectedDateData && (
        <FileList 
          commitDate={selectedDateData.commitDate}
          filesData={selectedDateData.filesData}
          onClose={() => setSelectedDateData(null)} 
        />
      )}
    </div>
  );
};

export default Chart;
