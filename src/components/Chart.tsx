import React, { useEffect, useRef, useState } from 'react';
import embed from 'vega-embed';
import { type BlameDataPoint } from '../store/useStore';
import FileExploration from './Chart/FileExploration';

interface ChartProps {
  data: BlameDataPoint[];
}

const Chart: React.FC<ChartProps> = ({ data }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [selectedDatum, setSelectedDatum] = useState<BlameDataPoint | null>(null);

  useEffect(() => {
    if (data.length > 0 && chartRef.current) {
      const spec: any = {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        width: 'container',
        height: 'container',
        autosize: { type: 'fit', contains: 'padding' },
        data: { values: data },
        mark: { type: 'area', line: { color: '#fff', strokeWidth: 0.5 }, tooltip: true },
        selection: {
          layer_click: {
            type: "point",
            on: "click"
          }
        },
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
        },
        config: {
          view: { stroke: null },
          font: 'Outfit, sans-serif'
        }
      };

      embed(chartRef.current, spec, { actions: false }).then(result => {
        result.view.addEventListener('click', (event, item) => {
          if (item && item.datum) {
            setSelectedDatum(item.datum as BlameDataPoint);
          }
        });
      }).catch(console.error);
    }
  }, [data]);

  return (
    <div className="chart-wrapper h-100 w-100 position-relative">
      <div ref={chartRef} className="w-100 h-100" style={{ cursor: 'pointer' }}></div>
      {selectedDatum && (
        <FileExploration 
          datum={selectedDatum} 
          onClose={() => setSelectedDatum(null)} 
        />
      )}
    </div>
  );
};

export default Chart;
