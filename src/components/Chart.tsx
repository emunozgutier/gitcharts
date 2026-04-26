import React, { useEffect, useRef, useState } from 'react';
import embed from 'vega-embed';
import { type BlameDataPoint } from '../store/useStore';
import FileList from './Chart/FileList';
import Tooltip from './Chart/Tooltip';

interface ChartProps {
  data: BlameDataPoint[];
}

const Chart: React.FC<ChartProps> = ({ data }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [selectedDateData, setSelectedDateData] = useState<{ commitDate: string; filesData: Record<string, number> } | null>(null);
  
  // Custom tooltip state
  const [tooltipInfo, setTooltipInfo] = useState<{ date: string; periods: {period: string, count: number, added: number}[] } | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

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
            mark: { type: 'area', line: { color: '#fff', strokeWidth: 0.5 } },
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
              }
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

      embed(chartRef.current, spec, { actions: false, tooltip: false }).then(result => {
        result.view.addEventListener('click', (_event, item) => {
          if (item && item.datum && item.datum.commit_date) {
            const commitDate = item.datum.commit_date;
            
            const filesForDate: Record<string, number> = {};
            data.forEach(d => {
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
            // Hide tooltip when modal opens
            setTooltipInfo(null);
          }
        });

        result.view.addEventListener('mousemove', (event: any) => {
          setTooltipPos({ x: event.clientX, y: event.clientY });
        });

        result.view.addSignalListener('hover', (_name, value) => {
           if (value && Object.keys(value).length > 0 && value.commit_date && value.commit_date[0]) {
             const hoveredTime = value.commit_date[0];
             
             // Find previous commit time to compute added lines
             const allDates = Array.from(new Set(data.map(d => new Date(d.commit_date).getTime()))).sort((a,b) => a - b);
             const currentIndex = allDates.indexOf(hoveredTime);
             const prevTime = currentIndex > 0 ? allDates[currentIndex - 1] : null;

             const matchedData = data.filter(d => new Date(d.commit_date).getTime() === hoveredTime);
             const prevData = prevTime ? data.filter(d => new Date(d.commit_date).getTime() === prevTime) : [];

             if (matchedData.length > 0) {
               const dateStr = matchedData[0].commit_date;
               const periods = matchedData
                  .map(d => {
                     const prevCount = prevData.find(pd => pd.period === d.period)?.line_count || 0;
                     const currentCount = Number(d.line_count) || 0;
                     const added = currentCount - Number(prevCount);
                     return { 
                       period: d.period, 
                       count: currentCount,
                       added: added
                     };
                  })
                  .filter(p => {
                    const isZeroCount = Math.abs(p.count) < 0.001;
                    const isZeroAdded = Math.abs(p.added) < 0.001;
                    return !(isZeroCount && isZeroAdded);
                  })
                  .sort((a,b) => new Date(a.period).getTime() - new Date(b.period).getTime()); // early to late
                  
               setTooltipInfo({ date: dateStr, periods });
             } else {
               setTooltipInfo(null);
             }
           } else {
             setTooltipInfo(null);
           }
        });

        result.view.addEventListener('mouseout', () => {
           setTooltipInfo(null);
        });

      }).catch(console.error);
    }
  }, [data]);

  return (
    <div className="chart-wrapper h-100 w-100 position-relative">
      <div ref={chartRef} className="w-100 h-100" style={{ cursor: 'pointer' }}></div>
      
      {tooltipInfo && !selectedDateData && (
        <Tooltip 
          x={tooltipPos.x} 
          y={tooltipPos.y} 
          date={tooltipInfo.date} 
          periods={tooltipInfo.periods} 
        />
      )}

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
