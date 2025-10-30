import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useMemo, useCallback, useRef } from "react";
import { ChartColumnIncreasing } from "lucide-react";
import { Chart as ChartJS, LineElement, PointElement, LinearScale, Tooltip as CJTooltip, Legend as CJLegend, Filler, CategoryScale, ChartOptions } from "chart.js";
import zoomPlugin from "chartjs-plugin-zoom";
import annotationPlugin from "chartjs-plugin-annotation";
import { Line } from "react-chartjs-2";

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, CJTooltip, CJLegend, Filler, zoomPlugin, annotationPlugin);

interface SimulationDataPoint {
  time: number;
  predicted: number;
  observed: number | null;
  controlGroup?: number;
  actualTestTime?: string; // 실제 검사 시간 (YYYY-MM-DD HH:MM 형식)
}

interface PKChartsProps {
  showSimulation: boolean;
  currentPatientName?: string;
  selectedDrug?: string;
  targetMin?: number | null;
  targetMax?: number | null;
  recentAUC?: number;
  recentMax?: number;
  recentTrough?: number;
  predictedAUC?: number;
  predictedMax?: number;
  predictedTrough?: number;
  // Optional: pass separated series from API (ng/mL)
  ipredSeries?: { time: number; value: number }[];
  predSeries?: { time: number; value: number }[];
  observedSeries?: { time: number; value: number }[];
  // TDM 내역 데이터
  tdmIndication?: string;
  tdmTarget?: string;
  tdmTargetValue?: string;
  // 투약기록 데이터
  latestAdministration?: {
    dose: number;
    unit: string;
    intervalHours?: number;
  } | null;
  drugAdministrations?: Array<{
    id: string;
    patientId: string;
    drugName: string;
    date: string; // YYYY-MM-DD
    time: string; // HH:mm
  }>;
}

const PKCharts = ({
  showSimulation,
  currentPatientName,
  selectedDrug,
  targetMin,
  targetMax,
  recentAUC: propRecentAUC,
  recentMax: propRecentMax,
  recentTrough: propRecentTrough,
  predictedAUC: propPredictedAUC,
  predictedMax: propPredictedMax,
  predictedTrough: propPredictedTrough,
  ipredSeries,
  predSeries,
  observedSeries,
  // TDM 내역 데이터
  tdmIndication,
  tdmTarget,
  tdmTargetValue,
  // 투약기록 데이터
  latestAdministration,
  drugAdministrations = []
}: PKChartsProps) => {
  // 첫 투약 시간 기준점 설정
  const getFirstDoseDateTime = useCallback(() => {
    if (!drugAdministrations || drugAdministrations.length === 0) return new Date();
    const sortedDoses = drugAdministrations
      .filter(d => d.drugName === selectedDrug)
      .sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime());
    return sortedDoses.length > 0 
      ? new Date(`${sortedDoses[0].date}T${sortedDoses[0].time}`)
      : new Date();
  }, [drugAdministrations, selectedDrug]);

  // 데이터 병합 전 series 기반 최소/최대 시간 계산
  const dataTimeExtents = useMemo(() => {
    const candidates: number[] = [];
    for (const p of ipredSeries || []) candidates.push(p.time);
    for (const p of predSeries || []) candidates.push(p.time);
    for (const p of observedSeries || []) candidates.push(p.time);
    const maxSeriesTime = candidates.length > 0 ? Math.max(...candidates) : 72;
    const minSeriesTime = candidates.length > 0 ? Math.min(...candidates) : 0;
    return { min: Math.max(0, minSeriesTime), max: Math.max(24, maxSeriesTime) };
  }, [ipredSeries, predSeries, observedSeries]);

  // 마지막 실제 투약 시간 계산 (구분선용)
  const lastActualDoseTime = useMemo(() => {
    if (!drugAdministrations || drugAdministrations.length === 0) return null;
    const selectedDrugDoses = drugAdministrations
      .filter(d => d.drugName === selectedDrug)
      .map(d => {
        const doseDateTime = new Date(`${d.date}T${d.time}`);
        const firstDoseDateTime = getFirstDoseDateTime();
        return (doseDateTime.getTime() - firstDoseDateTime.getTime()) / (1000 * 60 * 60);
      })
      .sort((a, b) => a - b);
    return selectedDrugDoses.length > 0 ? Math.max(...selectedDrugDoses) : null;
  }, [drugAdministrations, selectedDrug, getFirstDoseDateTime]);

  // 간단한 날짜/시간 포맷터 (mm.dd HH)
  const formatDateTimeForTick = (timeInHours: number) => {
    if (!drugAdministrations || drugAdministrations.length === 0) {
      return `${timeInHours}h`;
    }
    const firstDoseDateTime = getFirstDoseDateTime();
    const targetDateTime = new Date(firstDoseDateTime.getTime() + timeInHours * 60 * 60 * 1000);
    
    const month = String(targetDateTime.getMonth() + 1).padStart(2, '0');
    const day = String(targetDateTime.getDate()).padStart(2, '0');
    const hour = String(targetDateTime.getHours()).padStart(2, '0');
    
    return `${month}.${day} ${hour}시`;
  };

  // Merge separated series
  const data: SimulationDataPoint[] = useMemo(() => {
    if ((ipredSeries && ipredSeries.length) || (predSeries && predSeries.length) || (observedSeries && observedSeries.length)) {
      const map = new Map<number, SimulationDataPoint & { controlGroup?: number; averageLine?: number }>();
      const getPoint = (t: number) => {
        const key = Number(t) || 0;
        const existed = map.get(key);
        if (existed) return existed;
        const created: SimulationDataPoint & { controlGroup?: number; averageLine?: number } = { time: key, predicted: 0, observed: null, controlGroup: 0, averageLine: 0 };
        map.set(key, created);
        return created;
      };
      // API returns values in correct units already (Vancomycin: mg/L, Cyclosporin: ng/mL)
      // No scaling needed
      for (const p of ipredSeries || []) {
        const pt = getPoint(p.time);
        pt.predicted = p.value ?? 0;
      }
      for (const p of predSeries || []) {
        const pt = getPoint(p.time) as SimulationDataPoint & { controlGroup?: number; averageLine?: number };
        pt.controlGroup = p.value ?? 0;
      }
      for (const p of observedSeries || []) {
        const pt = getPoint(p.time);
        pt.observed = p.value ?? 0;
      }
      return Array.from(map.values()).sort((a, b) => a.time - b.time);
    }
    return [];
  }, [ipredSeries, predSeries, observedSeries]);

  // API 응답 혹은 기본값
  const recentAUC: number | null = typeof propRecentAUC === 'number' ? propRecentAUC : null;
  const recentMax: number | null = typeof propRecentMax === 'number' ? propRecentMax : null;
  const recentTrough: number | null = typeof propRecentTrough === 'number' ? propRecentTrough : null;
  const predictedAUC: number | null = typeof propPredictedAUC === 'number' ? propPredictedAUC : null;
  const predictedMax: number | null = typeof propPredictedMax === 'number' ? propPredictedMax : null;
  const predictedTrough: number | null = typeof propPredictedTrough === 'number' ? propPredictedTrough : null;

  // 평균 농도(ng/mL): predicted 라인을 기준
  const averageConcentration: number | null = (() => {
    if (!data || data.length < 2) return null;
    const sorted = [...data].sort((a, b) => a.time - b.time);
    const t0 = sorted[0].time;
    const tn = sorted[sorted.length - 1].time;
    const duration = tn - t0;
    if (duration <= 0) return null;
    let auc = 0; // ng·h/mL
    for (let i = 1; i < sorted.length; i++) {
      const dt = sorted[i].time - sorted[i - 1].time;
      if (dt <= 0) continue;
      const cPrev = sorted[i - 1].predicted ?? 0;
      const cCurr = sorted[i].predicted ?? 0;
      auc += ((cPrev + cCurr) / 2) * dt;
    }
    return auc / duration;
  })();

  // Y축 상한
  const yMax = useMemo(() => {
    const dataMax = (data || []).reduce((m, p) => {
      const candidates = [p.predicted, p.controlGroup ?? 0, p.observed ?? 0].filter(v => typeof v === 'number') as number[];
      const localMax = candidates.length ? Math.max(...candidates) : 0;
      return Math.max(m, localMax);
    }, 0);
    const targetMaxNum = typeof targetMax === 'number' ? targetMax : 0;
    const calculatedMax = Math.max(dataMax, targetMaxNum);
    if (calculatedMax <= 0.2) {
      return 0.2;
    } else {
      return Math.ceil(calculatedMax * 1.2 * 10) / 10;
    }
  }, [data, targetMax]);

  const fmtInt = (n: number | null, unit: string) => {
    if (n == null || Number.isNaN(n)) return '-';
    return `${Math.round(n).toLocaleString()} ${unit}`;
  };

  const fmtFixed = (n: number | null, unit: string) => {
    if (n == null || Number.isNaN(n)) return '-';
    return `${Number(n.toFixed(2)).toLocaleString()} ${unit}`;
  };

  // 약물별 농도 단위 결정
  const getConcentrationUnit = (drug?: string) => {
    switch (drug) {
      case 'Vancomycin':
        return 'mg/L';
      case 'Cyclosporin':
        return 'ng/mL';
      default:
        return 'mg/L';
    }
  };

  const getTdmTargetValue = () => {
    const target = tdmTarget?.toLowerCase() || '';
    if (target.includes('auc')) {
      return { value: fmtFixed(predictedAUC, 'mg*h/L'), unit: 'mg*h/L', numericValue: predictedAUC };
    } else if (target.includes('max') || target.includes('peak')) {
      return { value: fmtFixed(predictedMax, getConcentrationUnit(selectedDrug)), unit: getConcentrationUnit(selectedDrug), numericValue: predictedMax };
    } else if (target.includes('trough')) {
      return { value: fmtFixed(predictedTrough, getConcentrationUnit(selectedDrug)), unit: getConcentrationUnit(selectedDrug), numericValue: predictedTrough };
    } else {
      return { value: fmtFixed(predictedAUC, 'mg*h/L'), unit: 'mg*h/L', numericValue: predictedAUC };
    }
  };

  const isWithinTargetRange = () => {
    const targetValue = getTdmTargetValue();
    const targetRange = tdmTargetValue || '';
    if (!targetRange || !targetValue.numericValue) return true;
    const rangeMatch = targetRange.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
    if (!rangeMatch) return true;
    const minValue = parseFloat(rangeMatch[1]);
    const maxValue = parseFloat(rangeMatch[2]);
    const currentValue = targetValue.numericValue;
    return currentValue >= minValue && currentValue <= maxValue;
  };

  // Chart.js 인스턴스 참조 및 줌 버튼 구현
  const chartRef = useRef<ChartJS<'line'> | null>(null);
  const zoomByFactor = (factor: number) => {
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
  };
  const resetZoom = () => {
    const chart = chartRef.current;
    if (!chart) return;
    
    // 플러그인 resetZoom 시도
    const chartWithPlugin = chart as unknown as { resetZoom?: () => void };
    if (typeof chartWithPlugin.resetZoom === 'function') {
      chartWithPlugin.resetZoom();
    }
    
    // +/- 버튼으로 줌한 경우를 위해 명시적으로 초기 범위로 리셋
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
  };

  return (
    <div className="w-full bg-white dark:bg-slate-900 rounded-lg p-6 shadow">
      {/* TDM Simulator 헤더 */}
      <div className="text-left mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
          <ChartColumnIncreasing className="w-8 h-8 text-blue-600" />
          {currentPatientName ? `${currentPatientName} 환자의 TDM 분석 결과` : 'TDM 분석 결과'}
        </h1>
      </div>

      {/* 그래프 해석 가이드 */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-gray-800 dark:text-white mb-3">그래프 해석 Tip</h3>
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
          {selectedDrug === 'Vancomycin' ? (
            <>
              <p><strong>(1)</strong> 차트의 곡선은 TDM Simulation을 통해 예측한 혈중 농도의 변화를 의미합니다.</p>
              <p><strong>(2)</strong> AUC 데이터는 차트의 누적 면적이 목표 범위 내 있을 때 용법이 적절하다고 해석할 수 있습니다.</p>
              <p><strong>(3)</strong> 현 용법이 적절하다면 일반 대조군의 차트 면적과 유사한 패턴을 보여야 합니다.</p>
            </>
          ) : (
            <>
              <p><strong>(1)</strong> 차트의 곡선은 TDM Simulation을 통해 예측한 혈중 농도의 변화를 의미합니다.</p>
              <p><strong>(2)</strong> 일반 대조군 차트와 유사한 패턴을 보이고 TDM목표치 범위를 유지한다면 현용법이 적절하다고 해석할 수 있습니다.</p>
              <p><strong>(3)</strong> 차트에서 빨간 점선을 기점으로 예측 데이터를 확인할 수 있습니다.</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2"></p>
            </>
          )}
            </div>
      </div>

      {/* 범례 */}
      <div className="flex justify-center gap-6 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-0.5 bg-blue-500"></div>
          <span className="text-sm text-gray-600">{currentPatientName || '환자'}님의 현용법</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-0.5 bg-orange-500"></div>
          <span className="text-sm text-gray-600">일반 대조군</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
          <span className="text-sm text-gray-600">실제 혈중 농도</span>
        </div>
        {!(selectedDrug === 'Vancomycin' && tdmTarget?.toLowerCase().includes('auc')) && typeof averageConcentration === 'number' && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 border-dashed border-t-2 border-gray-500"></div>
            <span className="text-sm text-gray-600">평균 농도</span>
          </div>
        )}
        {typeof targetMin === 'number' && typeof targetMax === 'number' && targetMax > targetMin && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-4 bg-blue-500 bg-opacity-20"></div>
            <span className="text-sm text-gray-600">TDM 목표치</span>
          </div>
        )}
      </div>

      {/* 메인 그래프 (Chart.js) */}
      <div className="mb-2">
        {/* 상단 줌 컨트롤 */}
        <div className="flex justify-end gap-2 mb-2">
          <button className="px-2 py-1 border rounded" onClick={() => zoomByFactor(1.25)}>+
          </button>
          <button className="px-2 py-1 border rounded" onClick={() => zoomByFactor(0.8)}>-</button>
          <button className="px-2 py-1 border rounded" onClick={resetZoom}>Reset</button>
        </div>
        <div className="relative h-96">
          <Line
            ref={chartRef}
            data={{
              datasets: [
                {
                  label: '현용법',
                  data: data.map(d => ({ x: d.time, y: d.predicted })),
                  borderColor: '#3b82f6', // blue-500
                  backgroundColor: 'transparent',
                  pointRadius: 0,
                  fill: false,
                  tension: 0.25,
                  borderWidth: 2
                },
                {
                  label: '대조군',
                  data: data.map(d => ({ x: d.time, y: d.controlGroup ?? null })),
                  borderColor: '#f97316', // orange-500
                  backgroundColor: 'transparent',
                  pointRadius: 0,
                  fill: false,
                  tension: 0.25,
                  borderWidth: 2
                },
                {
                  label: '실제 혈중 농도',
                  data: data.map(d => ({ x: d.time, y: d.observed })),
                  borderColor: '#ef4444', // red-500
                  backgroundColor: '#ef4444',
                  showLine: false,
                  pointRadius: 4
                },
                // 평균 농도 (특정 케이스 제외)
                ...(!(selectedDrug === 'Vancomycin' && tdmTarget?.toLowerCase().includes('auc')) && typeof averageConcentration === 'number' ? [{
                  label: '평균 농도',
                  data: data.map(d => ({ x: d.time, y: averageConcentration })),
                  borderColor: '#6b7280', // gray-500
                  pointRadius: 0,
                  borderDash: [5, 5],
                  borderWidth: 2,
                  fill: false
                }] : [])
              ]
            }}
            options={{
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
                      // x축 좌표 (시간)을 날짜/시간으로 표시
                      if (ctx.length > 0) {
                        const timeValue = ctx[0].parsed.x;
                        return formatDateTimeForTick(timeValue);
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
                        result.push(`목표 범위: ${targetMin.toFixed(1)} - ${targetMax.toFixed(1)} ${unit}`);
                      }
                      
                      // 실제 혈중 농도 찾기 (x축 근처 범위 내)
                      if (ctx.length > 0) {
                        const hoverX = ctx[0].parsed.x;
                        
                        // 가장 가까운 측정 데이터 찾기
                        const observedPoints = data.filter(d => 
                          d.observed !== null && 
                          typeof d.observed === 'number' && 
                          !isNaN(d.observed)
                        );
                        
                        if (observedPoints.length > 0) {
                          // hover 위치에서 가장 가까운 점 찾기
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
                      type: 'box', yMin: targetMin, yMax: targetMax, backgroundColor: 'rgba(59,130,246,0.08)', borderWidth: 0
                    } : undefined,
                    lastDose: (lastActualDoseTime != null) ? {
                      type: 'line', xMin: lastActualDoseTime, xMax: lastActualDoseTime, borderColor: '#ff6b6b', borderWidth: 2, borderDash: [5,5]
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
                      // 줌되지 않은 초기 상태에서는 pan 비활성화
                      const xScale = context.chart.scales?.x;
                      if (!xScale) return false;
                      
                      const currentMin = xScale.min ?? dataTimeExtents.min;
                      const currentMax = xScale.max ?? dataTimeExtents.max;
                      const isZoomed = Math.abs(currentMin - dataTimeExtents.min) > 0.01 || 
                                      Math.abs(currentMax - dataTimeExtents.max) > 0.01;
                      
                      // 줌된 상태에서만 pan 허용
                      return isZoomed;
                    }
                  }
                }
              },
              scales: {
                x: {
                  type: 'linear',
                  ticks: { callback: (v) => formatDateTimeForTick(Number(v)) }
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
            }}
          />
        </div>
        <div className="flex justify-center mt-2">
          <div className="text-sm text-gray-600 font-medium">투약 일시</div>
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 my-8"></div>

      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 mb-6 border border-blue-200 dark:border-blue-800 mt-4">
        <h2 className="text-xl font-bold text-blue-800 dark:text-blue-200 mb-4 flex items-center gap-2">TDM Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <Card className="bg-white border-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-gray-800">최신 혈중 약물 농도</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="flex justify-between"><span className="text-gray-600">AUC:</span><span className="font-semibold">{fmtInt(recentAUC, 'mg*h/L')}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">max 농도:</span><span className="font-semibold">{fmtFixed(recentMax, getConcentrationUnit(selectedDrug))}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">trough 농도:</span><span className="font-semibold">{fmtFixed(recentTrough, getConcentrationUnit(selectedDrug))}</span></div>
            </CardContent>
          </Card>
          <Card className="bg-white border-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-gray-800">예측 약물 농도</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="flex justify-between"><span className="text-gray-600">AUC:</span><span className="font-semibold">{fmtInt(predictedAUC, 'mg*h/L')}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">max 농도:</span><span className="font-semibold">{fmtFixed(predictedMax, getConcentrationUnit(selectedDrug))}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">trough 농도:</span><span className="font-semibold">{fmtFixed(predictedTrough, getConcentrationUnit(selectedDrug))}</span></div>
            </CardContent>
          </Card>
        </div>
        <Card className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-blue-800 dark:text-blue-200 flex items-center gap-2">TDM friends Comments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
            <div className="flex items-start gap-2"><div className="w-1.5 h-1.5 bg-gray-800 dark:bg-gray-200 rounded-full mt-2 flex-shrink-0"></div><p className="leading-relaxed">{tdmIndication || '적응증'}의 {selectedDrug || '약물명'} 처방 시 TDM 목표는 <span className="font-semibold text-blue-600 dark:text-blue-400"> {tdmTarget || '목표 유형'} ({tdmTargetValue || '목표값'})</span>입니다.</p></div>
            <div className="flex items-start gap-2"><div className="w-1.5 h-1.5 bg-gray-800 dark:bg-gray-200 rounded-full mt-2 flex-shrink-0"></div><p className="leading-relaxed"><span className="font-semibold">현 용법 {latestAdministration?.intervalHours || '시간'} 간격으로 {latestAdministration?.dose || 0}{latestAdministration?.unit || 'mg'} 투약 시</span> Steady State까지 TDM 목표 <span className="font-semibold text-blue-600 dark:text-blue-400">{tdmTarget || '목표 유형'}</span>는 <span className="font-semibold text-red-600 dark:text-red-400"> {getTdmTargetValue().value}</span>으로 {isWithinTargetRange() ? (<> 적절한 용법입니다.</>) : (<> 치료 범위를 벗어납니다.</>)}</p></div>
          </CardContent>
        </Card>
          </div>
    </div>
  );
};

export default PKCharts;
