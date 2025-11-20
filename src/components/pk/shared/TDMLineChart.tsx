import { useRef, useMemo, useCallback, useEffect } from "react";
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
  currentTime?: number | null; // 현재 시간 (빨간색 점선 "now" 표시용)
  lastDoseColor?: string; // 마지막 투약 시간 선 색상 (기본값: 빨간색)
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
  averageConcentration,
  currentTime,
  lastDoseColor = '#ff6b6b' // 기본값: 빨간색
}: TDMLineChartProps) => {
  const chartRef = useRef<ChartJS<'line'> | null>(null);

  // Y축 최대값 계산
  const yMax = useMemo(() => calculateYMax(data, targetMax), [data, targetMax]);

  // 데이터나 Y축 스케일이 변경될 때 차트를 강제로 업데이트
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    
    // 차트 옵션 업데이트
    const options = chart.options as ChartOptions<'line'>;
    
    // Y축 범위 업데이트
    if (options.scales && options.scales.y) {
      (options.scales.y as { min?: number; max?: number }).min = 0;
      (options.scales.y as { min?: number; max?: number }).max = yMax;
    }
    
    // X축 범위는 초기 렌더링 시에만 설정 (사용자가 줌 조정한 경우 유지)
    if (options.scales && options.scales.x) {
      const xScale = options.scales.x as { min?: number; max?: number };
      const currentMin = xScale.min ?? dataTimeExtents.min;
      const currentMax = xScale.max ?? dataTimeExtents.max;
      const isInitialState = Math.abs(currentMin - dataTimeExtents.min) < 0.01 && 
                            Math.abs(currentMax - dataTimeExtents.max) < 0.01;
      
      // 초기 상태이거나 범위가 dataTimeExtents를 벗어난 경우에만 업데이트
      if (isInitialState || currentMin < dataTimeExtents.min || currentMax > dataTimeExtents.max) {
        xScale.min = dataTimeExtents.min;
        xScale.max = dataTimeExtents.max;
      }
    }
    
    // 차트 업데이트 (애니메이션 없이)
    chart.update('none');
  }, [data, yMax, dataTimeExtents]);

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

  // 안전한 숫자 값 변환 유틸리티 함수
  // undefined, null, NaN, 문자열 등을 null로 변환하여 Chart.js가 안전하게 처리하도록 함
  const safeNumberValue = useCallback((value: unknown): number | null => {
    // null 또는 undefined는 null로 반환 (Chart.js가 스킵)
    if (value === null || value === undefined) return null;
    
    // 숫자가 아니면 null 반환 (문자열, 객체 등 필터링)
    if (typeof value !== 'number') return null;
    
    // NaN 체크
    if (isNaN(value)) return null;
    
    // 유효한 숫자만 반환
    return value;
  }, []);

  // 데이터 샘플링 함수 (너무 많은 포인트일 때 성능 최적화)
  const sampleData = useCallback((points: Array<{ x: number; y: number | null }>, maxPoints: number = 2000) => {
    if (points.length <= maxPoints) return points;
    
    // 간단한 균등 샘플링
    const step = Math.ceil(points.length / maxPoints);
    const sampled: Array<{ x: number; y: number | null }> = [];
    
    for (let i = 0; i < points.length; i += step) {
      sampled.push(points[i]);
    }
    
    // 마지막 포인트는 항상 포함
    if (sampled[sampled.length - 1] !== points[points.length - 1]) {
      sampled.push(points[points.length - 1]);
    }
    
    return sampled;
  }, []);

  // Chart.js 데이터셋 생성
  const chartData = useMemo(() => {
    // 데이터 포인트 수 확인 및 로깅
    const totalPoints = data.length;
    if (totalPoints > 1000) {
      console.log(`[TDMLineChart] Large dataset detected: ${totalPoints} points. This may cause performance issues.`);
    }
    
    return {
      datasets: datasets.map(ds => {
        let dataPoints;
        if (ds.dataKey === 'averageLine' && averageConcentration !== null && averageConcentration !== undefined) {
          dataPoints = data.map(d => ({ x: d.time, y: averageConcentration }));
        } else {
          // 실제 혈중농도는 null이 아닌 포인트만 포함
          if (ds.dataKey === 'observed') {
            dataPoints = data
              .filter(d => d.observed !== null && typeof d.observed === 'number' && !isNaN(d.observed))
              .map(d => ({ x: d.time, y: d.observed! }));
          } else {
            // controlGroup, predicted, currentMethod 등의 경우
            // 숫자가 아닌 값(undefined, NaN, 문자열 등)을 null로 변환하여 Chart.js가 안전하게 처리하도록 함
            dataPoints = data.map(d => ({ 
              x: d.time, 
              y: safeNumberValue(d[ds.dataKey]) 
            }));
          }
        }

        // 실제 혈중농도 데이터셋은 샘플링하지 않음 (모든 포인트가 중요함)
        // 다른 데이터셋은 너무 많은 포인트일 때 샘플링 적용 (2000개 제한)
        const sampledPoints = ds.dataKey === 'observed' 
          ? dataPoints 
          : sampleData(dataPoints, 2000);
        
        if (ds.dataKey !== 'observed' && dataPoints.length > 2000) {
          console.log(`[TDMLineChart] Dataset "${ds.label}" has ${dataPoints.length} points, sampling to ${sampledPoints.length} points for performance.`);
        }

        return {
          label: ds.label,
          data: sampledPoints,
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
  }, [data, datasets, averageConcentration, sampleData, safeNumberValue]);

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
          // 현재 시간 (빨간색 점선 "now")
          currentTime: (currentTime != null) ? {
            type: 'line',
            xMin: currentTime,
            xMax: currentTime,
            borderColor: '#ff6b6b',
            borderWidth: 2,
            borderDash: [5, 5],
            label: {
              display: true,
              content: 'now',
              position: 'end',
              backgroundColor: 'rgba(254,202,202,0.9)', // red-200 계열 배경
              color: '#b91c1c', // red 계열 폰트 색
              font: {
                size: 12,
                weight: 'bold'
              },
              padding: 4,
              xAdjust: 20,
              yAdjust: 0
            }
          } : undefined,
          // 마지막 투약 기록 (파란색 점선 "last dosage")
          lastDose: (lastActualDoseTime != null) ? {
            type: 'line',
            xMin: lastActualDoseTime,
            xMax: lastActualDoseTime,
            borderColor: lastDoseColor,
            borderWidth: 2,
            borderDash: [5, 5],
            label: {
              display: true,
              content: 'last dose',
              position: 'end',
              backgroundColor: lastDoseColor === '#3b82f6' ? 'rgba(59,130,246,0.3)' : 'rgba(254,202,202,0.3)',
              color: lastDoseColor === '#3b82f6' ? '#1e40af' : '#b91c1c',
              font: {
                size: 12,
                weight: 'bold'
              },
              padding: 4,
              xAdjust: -40,
              yAdjust: 0
            }
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
        min: dataTimeExtents.min,
        max: dataTimeExtents.max,
        ticks: { 
          // 첫 투약 시점을 0h로 보고, 24시간 단위로 틱을 표시
          stepSize: 24,
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
  }), [data, selectedDrug, targetMin, targetMax, dataTimeExtents, lastActualDoseTime, currentTime, drugAdministrations, yMax]);

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

