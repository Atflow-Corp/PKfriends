import { useRef, useMemo, useCallback } from "react";
import { Line } from "react-chartjs-2";
import { 
  Chart as ChartJS, 
  LineElement, 
  PointElement, 
  LinearScale, 
  CategoryScale, 
  Filler, 
  Tooltip as CJTooltip, 
  Legend as CJLegend, 
  ChartOptions 
} from "chart.js";
import zoomPlugin from "chartjs-plugin-zoom";
import annotationPlugin from "chartjs-plugin-annotation";
import {
  SimulationDataPoint,
  DrugAdministration,
  getConcentrationUnit,
  formatDateTimeForTick,
  calculateYMax
} from "./TDMChartUtils";

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, CJTooltip, CJLegend, Filler, zoomPlugin, annotationPlugin);

export interface ChartDataset {
  label: string;
  dataKey: 'predicted' | 'controlGroup' | 'observed' | 'currentMethod' | 'averageLine';
  borderColor: string;
  backgroundColor?: string;
  pointRadius?: number;
  showLine?: boolean;
  borderDash?: number[];
  borderWidth?: number;
  fill?: boolean;
  tension?: number;
}

interface TDMLineChartProps {
  data: SimulationDataPoint[];
  datasets: ChartDataset[];
  selectedDrug?: string;
  targetMin?: number | null;
  targetMax?: number | null;
  dataTimeExtents: { min: number; max: number };
  lastActualDoseTime?: number | null;
  drugAdministrations: DrugAdministration[];
  averageConcentration?: number | null;
}

const TDMLineChart = ({
  data,
  datasets,
  selectedDrug,
  targetMin,
  targetMax,
  dataTimeExtents,
  lastActualDoseTime,
  drugAdministrations,
  averageConcentration
}: TDMLineChartProps) => {
  const chartRef = useRef<ChartJS<'line'> | null>(null);

  // Y축 최대값 계산
  const yMax = useMemo(() => calculateYMax(data, targetMax), [data, targetMax]);

  // 줌 컨트롤
  const zoomByFactor = useCallback((factor: number) => {
    const chart = chartRef.current;
    if (!chart) return;
    
    const options = chart.options as ChartOptions<'line'>;
    const scales = (options.scales ?? {}) as Record<string, { min?: number; max?: number; type?: string; ticks?: unknown }>;
    const baseMin = dataTimeExtents.min;
    const baseMax = dataTimeExtents.max;
    const curMin = (scales.x?.min ?? baseMin);
    const curMax = (scales.x?.max ?? baseMax);
    const center = (curMin + curMax) / 2;
    const half = (curMax - curMin) / 2;
    const newHalf = Math.max(0.5, half / factor);
    const nmin = Math.max(baseMin, center - newHalf);
    const nmax = Math.min(baseMax, center + newHalf);
    options.scales = { ...scales, x: { ...(scales.x || {}), type: 'linear', min: nmin, max: nmax } };
    chart.update('none');
  }, [dataTimeExtents]);

  const resetZoom = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) return;
    
    const chartWithPlugin = chart as unknown as { resetZoom?: () => void };
    if (typeof chartWithPlugin.resetZoom === 'function') {
      chartWithPlugin.resetZoom();
    }
    
    const options = chart.options as ChartOptions<'line'>;
    const scales = (options.scales ?? {}) as Record<string, { min?: number; max?: number; type?: string; ticks?: unknown }>;
    options.scales = { 
      ...scales, 
      x: { 
        ...(scales.x || {}), 
        type: 'linear', 
        min: dataTimeExtents.min, 
        max: dataTimeExtents.max 
      } 
    };
    chart.update('none');
  }, [dataTimeExtents]);

  // Chart.js 데이터셋 생성
  const chartData = useMemo(() => {
    return {
      datasets: datasets.map(ds => {
        let dataPoints;
        if (ds.dataKey === 'averageLine' && averageConcentration !== null && averageConcentration !== undefined) {
          dataPoints = data.map(d => ({ x: d.time, y: averageConcentration }));
        } else {
          dataPoints = data.map(d => ({ x: d.time, y: d[ds.dataKey] }));
        }

        return {
          label: ds.label,
          data: dataPoints,
          borderColor: ds.borderColor,
          backgroundColor: ds.backgroundColor ?? 'transparent',
          pointRadius: ds.pointRadius ?? 0,
          showLine: ds.showLine ?? true,
          borderDash: ds.borderDash,
          borderWidth: ds.borderWidth ?? 2,
          fill: ds.fill ?? false,
          tension: ds.tension ?? 0.25
        };
      })
    };
  }, [data, datasets, averageConcentration]);

  // Chart.js 옵션
  const chartOptions = useMemo<ChartOptions<'line'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    parsing: false,
    animation: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          title: (ctx) => {
            if (ctx.length > 0) {
              const timeValue = ctx[0].parsed.x;
              return formatDateTimeForTick(timeValue, drugAdministrations, selectedDrug);
            }
            return '';
          },
          label: (ctx) => {
            const label = ctx.dataset.label || '';
            const v = ctx.parsed.y as number;
            const unit = getConcentrationUnit(selectedDrug);
            return `${label}: ${typeof v === 'number' ? v.toFixed(2) : v} ${unit}`;
          },
          afterBody: (ctx) => {
            const result: string[] = [];
            
            // 목표치 범위 먼저 표시
            if (typeof targetMin === 'number' && typeof targetMax === 'number' && targetMax > targetMin) {
              const unit = getConcentrationUnit(selectedDrug);
              result.push(``);
              result.push(`TDM 목표치: ${targetMin.toFixed(1)} - ${targetMax.toFixed(1)} ${unit}`);
            }
            
            // 실제 혈중 농도 찾기 (x축 근처 범위 내)
            if (ctx.length > 0) {
              const hoverX = ctx[0].parsed.x;
              
              const observedPoints = data.filter(d => 
                d.observed !== null && 
                typeof d.observed === 'number' && 
                !isNaN(d.observed)
              );
              
              if (observedPoints.length > 0) {
                const closest = observedPoints.reduce((prev, curr) => 
                  Math.abs(curr.time - hoverX) < Math.abs(prev.time - hoverX) ? curr : prev
                );
                
                // 1시간 범위 내에 있으면 표시
                if (Math.abs(closest.time - hoverX) < 1) {
                  const unit = getConcentrationUnit(selectedDrug);
                  result.push(`실제 혈중 농도: ${closest.observed!.toFixed(2)} ${unit}`);
                }
              }
            }
            
            return result;
          }
        }
      },
      annotation: {
        annotations: {
          targetBand: (typeof targetMin === 'number' && typeof targetMax === 'number' && targetMax > targetMin) ? {
            type: 'box', 
            yMin: targetMin, 
            yMax: targetMax, 
            backgroundColor: 'rgba(59,130,246,0.08)', 
            borderWidth: 0
          } : undefined,
          lastDose: (lastActualDoseTime != null) ? {
            type: 'line', 
            xMin: lastActualDoseTime, 
            xMax: lastActualDoseTime, 
            borderColor: '#ff6b6b', 
            borderWidth: 2, 
            borderDash: [5, 5]
          } : undefined
        }
      },
      zoom: {
        limits: { 
          x: { min: dataTimeExtents.min, max: dataTimeExtents.max, minRange: 0.5 },
        },
        zoom: { 
          wheel: { enabled: true }, 
          mode: 'x' 
        },
        pan: { 
          enabled: true, 
          mode: 'x',
          onPanStart: (context: { chart: { scales?: { x?: { min?: number; max?: number } } } }) => {
            const xScale = context.chart.scales?.x;
            if (!xScale) return false;
            
            const currentMin = xScale.min ?? dataTimeExtents.min;
            const currentMax = xScale.max ?? dataTimeExtents.max;
            const isZoomed = Math.abs(currentMin - dataTimeExtents.min) > 0.01 || 
                            Math.abs(currentMax - dataTimeExtents.max) > 0.01;
            
            return isZoomed;
          }
        }
      }
    },
    scales: {
      x: {
        type: 'linear',
        ticks: { 
          callback: (v) => formatDateTimeForTick(Number(v), drugAdministrations, selectedDrug) 
        }
      },
      y: {
        min: 0,
        max: yMax,
        title: {
          display: true,
          text: `Concentration (${getConcentrationUnit(selectedDrug)})`
        },
        ticks: { callback: (v) => `${Number(v).toFixed(2)}` }
      }
    }
  }), [data, selectedDrug, targetMin, targetMax, dataTimeExtents, lastActualDoseTime, drugAdministrations, yMax]);

  return (
    <div className="mb-2">
      {/* 상단 줌 컨트롤 */}
      <div className="flex justify-end gap-2 mb-2">
        <button className="px-2 py-1 border rounded" onClick={() => zoomByFactor(1.25)}>+</button>
        <button className="px-2 py-1 border rounded" onClick={() => zoomByFactor(0.8)}>-</button>
        <button className="px-2 py-1 border rounded" onClick={resetZoom}>Reset</button>
      </div>
      
      <div className="relative h-96">
        <Line
          ref={chartRef}
          data={chartData}
          options={chartOptions}
        />
      </div>
      
      <div className="flex justify-center mt-2">
        <div className="text-sm text-gray-600 font-medium">투약 일시</div>
      </div>
    </div>
  );
};

export default TDMLineChart;

