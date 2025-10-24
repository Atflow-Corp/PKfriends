import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo, useCallback, useRef } from "react";
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip as CJTooltip, Legend as CJLegend, ChartOptions } from "chart.js";
import zoomPlugin from "chartjs-plugin-zoom";
import annotationPlugin from "chartjs-plugin-annotation";
import { ChartColumnIncreasing } from "lucide-react";

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, CJTooltip, CJLegend, Filler, zoomPlugin, annotationPlugin);

interface SimulationDataPoint {
  time: number;
  predicted: number;
  observed: number | null;
  controlGroup?: number;
  currentMethod?: number;
}

interface DosageChartProps {
  simulationData: SimulationDataPoint[];
  showSimulation: boolean;
  currentPatientName?: string;
  selectedDrug?: string;
  chartTitle?: string;
  targetMin?: number | null;
  targetMax?: number | null;
  recentAUC?: number;
  recentMax?: number;
  recentTrough?: number;
  predictedAUC?: number;
  predictedMax?: number;
  predictedTrough?: number;
  ipredSeries?: { time: number; value: number }[];
  predSeries?: { time: number; value: number }[];
  observedSeries?: { time: number; value: number }[];
  chartColor?: 'pink' | 'green';
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
  // 환자의 현용법 데이터
  currentMethodSeries?: Array<{
    time: number;
    value: number;
  }>;
  // 빈 차트 상태 관리
  isEmptyChart?: boolean;
  selectedButton?: string;
}

const DosageChart = ({
  simulationData,
  showSimulation,
  currentPatientName,
  selectedDrug,
  chartTitle = "용법 조정 시뮬레이션",
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
  chartColor = 'pink',
  // TDM 내역 데이터
  tdmIndication,
  tdmTarget,
  tdmTargetValue,
  // 투약기록 데이터
  latestAdministration,
  drugAdministrations = [],
  // 환자의 현용법 데이터
  currentMethodSeries = [],
  // 빈 차트 상태 관리
  isEmptyChart = false,
  selectedButton
}: DosageChartProps) => {
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

  // 전체 시계열 범위 (줌 한계 계산용)
  const dataTimeExtents = useMemo(() => {
    const candidates: number[] = [];
    for (const p of ipredSeries || []) candidates.push(p.time);
    for (const p of predSeries || []) candidates.push(p.time);
    for (const p of observedSeries || []) candidates.push(p.time);
    for (const p of currentMethodSeries || []) candidates.push(p.time);
    const maxSeriesTime = candidates.length > 0 ? Math.max(...candidates) : 72;
    const minSeriesTime = candidates.length > 0 ? Math.min(...candidates) : 0;
    return { min: Math.max(0, minSeriesTime), max: Math.max(24, maxSeriesTime) };
  }, [ipredSeries, predSeries, observedSeries, currentMethodSeries]);

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

  // 간단한 날짜/시간 포맷터 (24시간 방식)
  const formatDateTimeForTick = (timeInHours: number) => {
    if (!drugAdministrations || drugAdministrations.length === 0) {
      return `${timeInHours}h`;
    }
    
    const firstDoseDateTime = getFirstDoseDateTime();
    const targetDateTime = new Date(firstDoseDateTime.getTime() + timeInHours * 60 * 60 * 1000);
    
    return targetDateTime.toLocaleString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).replace(/\. /g, '.');
  };

  // Merge separated series if provided; otherwise fall back to simulationData
  const data: (SimulationDataPoint & { controlGroup?: number; averageLine?: number; currentMethod?: number })[] = useMemo(() => {
    // 빈 차트 상태일 때는 빈 데이터 반환
    if (isEmptyChart) {
      return [];
    }

    if ((ipredSeries && ipredSeries.length) || (predSeries && predSeries.length) || (observedSeries && observedSeries.length) || (currentMethodSeries && currentMethodSeries.length)) {
      const map = new Map<number, SimulationDataPoint & { controlGroup?: number; averageLine?: number; currentMethod?: number }>();

      // helper to get or create point
      const getPoint = (t: number): SimulationDataPoint & { controlGroup?: number; averageLine?: number; currentMethod?: number } => {
        const key = Number(t) || 0;
        const existing = map.get(key);
        if (existing) return existing;
        const created: SimulationDataPoint & { controlGroup?: number; averageLine?: number; currentMethod?: number } = { time: key, predicted: 0, observed: null, controlGroup: 0, averageLine: 0, currentMethod: 0 };
        map.set(key, created);
        return created;
      };

      // 약물 단위 스케일: Cyclosporin은 ng/mL로 표기하므로 mg/L 데이터를 1000배
      const scale = selectedDrug === 'Cyclosporin' ? 1000 : 1;

      // IPRED_CONC -> predicted (용법 조정 후 농도)
      for (const p of ipredSeries || []) {
        const t = Number(p.time) || 0;
        const y = (Number(p.value) || 0) * scale;
        const pt = getPoint(t);
        pt.predicted = y;
      }
      // 환자의 현용법 데이터
      for (const p of currentMethodSeries || []) {
        const t = Number(p.time) || 0;
        const y = (Number(p.value) || 0) * scale;
        const pt = getPoint(t);
        pt.currentMethod = y;
      }
      // Observed from input dataset DV (mg/L -> ng/mL)
      for (const p of observedSeries || []) {
        const t = Number(p.time) || 0;
        const y = Number(p.value) * scale;
        const pt = getPoint(t);
        pt.observed = y;
      }
      const result = Array.from(map.values()).sort((a, b) => a.time - b.time);
      return result;
    }
    return simulationData;
  }, [simulationData, ipredSeries, predSeries, observedSeries, currentMethodSeries, isEmptyChart, selectedDrug]);

  // Calculate recent and predicted values
  const recentAUC = propRecentAUC ?? 335;
  const recentMax = propRecentMax ?? 29;
  const recentTrough = propRecentTrough ?? 5;
  const predictedAUC = propPredictedAUC ?? 490;
  const predictedMax = propPredictedMax ?? 38;
  const predictedTrough = propPredictedTrough ?? 18;

  // 평균 농도 계산 (PKCharts와 동일한 로직)
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
      // predicted 라인을 기준으로 계산 (ng/mL)
      const cPrev = sorted[i - 1].predicted ?? 0;
      const cCurr = sorted[i].predicted ?? 0;
      auc += ((cPrev + cCurr) / 2) * dt;
    }
    return auc / duration;
  })();

  // 평균값을 데이터에 추가
  const dataWithAverage = useMemo(() => {
    if (!averageConcentration) return data;
    return data.map(point => ({
      ...point,
      averageLine: averageConcentration
    }));
  }, [data, averageConcentration]);

  // Chart.js 인스턴스 및 줌 컨트롤
  const chartRef = useRef<ChartJS<'line'> | null>(null);
  const zoomByFactor = (factor: number) => {
    const chart = chartRef.current;
    if (!chart) return;
    const options = chart.options as ChartOptions<'line'>;
    const scales = (options.scales ?? {}) as Record<string, { min?: number; max?: number; type?: string; ticks?: unknown }>
    const baseMin = dataTimeExtents.min;
    const baseMax = dataTimeExtents.max;
    const curMin = (scales.x?.min ?? baseMin) as number;
    const curMax = (scales.x?.max ?? baseMax) as number;
    const center = (curMin + curMax) / 2;
    const half = (curMax - curMin) / 2;
    const newHalf = Math.max(0.5, half / factor);
    const nmin = Math.max(baseMin, center - newHalf);
    const nmax = Math.min(baseMax, center + newHalf);
    options.scales = { ...scales, x: { ...(scales.x || {}), type: 'linear', min: nmin, max: nmax } };
    chart.update('none');
  };
  const resetZoom = () => {
    const chartWithPlugin = chartRef.current as unknown as { resetZoom?: () => void } | null;
    if (!chartWithPlugin) return;
    if (typeof chartWithPlugin.resetZoom === 'function') {
      chartWithPlugin.resetZoom();
      return;
    }
    const realChart = chartRef.current;
    if (!realChart) return;
    const options = realChart.options as ChartOptions<'line'>;
    const scales = (options.scales ?? {}) as Record<string, { min?: number; max?: number; type?: string; ticks?: unknown }>;
    options.scales = { ...scales, x: { ...(scales.x || {}), type: 'linear', min: undefined, max: undefined } };
    realChart.update('none');
  };

  // Y축 상한: PKCharts와 동일한 로직
  const yMax = useMemo(() => {
    const dataMax = (data || []).reduce((m, p) => {
      const candidates = [p.predicted, p.observed ?? 0].filter(v => typeof v === 'number') as number[];
      const localMax = candidates.length ? Math.max(...candidates) : 0;
      return Math.max(m, localMax);
    }, 0);
    const targetMaxNum = typeof targetMax === 'number' ? targetMax : 0;
    
    // 반코마이신 데이터에 최적화된 Y축 범위 설정
    const calculatedMax = Math.max(dataMax, targetMaxNum);
    
    // 데이터가 0.2 mg/L 이하인 경우 0.2로 고정, 그 이상인 경우 1.2배 여유분 제공
    if (calculatedMax <= 0.2) {
      return 0.2;
    } else {
      return Math.ceil(calculatedMax * 1.2 * 10) / 10; // 0.1 단위로 반올림
    }
  }, [data, targetMax]);

  // 색상 설정
  const chartColors = {
    pink: {
      stroke: '#ec4899',
      fill: '#ec4899',
      fillOpacity: 0.3
    },
    green: {
      stroke: '#22c55e',
      fill: '#22c55e',
      fillOpacity: 0.3
    }
  };

  const selectedColor = chartColors[chartColor];

  // 약물별 농도 단위 결정
  const getConcentrationUnit = (drug?: string) => {
    switch (drug) {
      case 'Vancomycin':
        return 'mg/L';
      case 'Cyclosporin':
        return 'ng/mL';
      default:
        return 'mg/L'; // 기본값
    }
  };

  // TDM 목표에 따른 예측값과 단위 결정
  const getTdmTargetValue = () => {
    const target = tdmTarget?.toLowerCase() || '';
    
    if (target.includes('auc')) {
      return {
        value: predictedAUC != null ? `${Math.round(predictedAUC).toLocaleString()} mg*h/L` : '-',
        unit: 'mg*h/L',
        numericValue: predictedAUC
      };
    } else if (target.includes('max') || target.includes('peak')) {
      return {
        value: predictedMax != null ? `${predictedMax} ${getConcentrationUnit(selectedDrug)}` : '-',
        unit: getConcentrationUnit(selectedDrug),
        numericValue: predictedMax
      };
    } else if (target.includes('trough')) {
      return {
        value: predictedTrough != null ? `${predictedTrough} ${getConcentrationUnit(selectedDrug)}` : '-',
        unit: getConcentrationUnit(selectedDrug),
        numericValue: predictedTrough
      };
    } else {
      // 기본값은 AUC
      return {
        value: predictedAUC != null ? `${Math.round(predictedAUC).toLocaleString()} mg*h/L` : '-',
        unit: 'mg*h/L',
        numericValue: predictedAUC
      };
    }
  };

  // 목표 범위 파싱 및 범위 내 여부 확인
  const isWithinTargetRange = () => {
    const targetValue = getTdmTargetValue();
    const targetRange = tdmTargetValue || '';
    
    if (!targetRange || !targetValue.numericValue) return true; // 범위 정보가 없으면 true로 처리
    
    // 범위 파싱 (예: "10-20 mg/L", "400-600 mg·h/L")
    const rangeMatch = targetRange.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
    if (!rangeMatch) return true; // 파싱 실패 시 true로 처리
    
    const minValue = parseFloat(rangeMatch[1]);
    const maxValue = parseFloat(rangeMatch[2]);
    const currentValue = targetValue.numericValue;
    
    return currentValue >= minValue && currentValue <= maxValue;
  };

  return (
    <div className="w-full">


       {/* 범례 - 스크롤에 영향받지 않음 */}
       {!isEmptyChart && (
         <div className="flex justify-center gap-6 mb-4">
        {/* 환자의 현용법 - currentMethodSeries가 있을 때만 표시 */}
        {currentMethodSeries && currentMethodSeries.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-blue-500"></div>
            <span className="text-sm text-gray-600">{currentPatientName || '환자'}의 현용법</span>
          </div>
        )}
           {/* 용법 조정 결과 - ipredSeries가 있을 때만 표시 */}
           {ipredSeries && ipredSeries.length > 0 && (
             <div className="flex items-center gap-2">
               <div 
                 className="w-8 h-0.5" 
                 style={{ 
                   backgroundColor: selectedColor.stroke,
                   opacity: 1
                 }}
               ></div>
               <span className="text-sm text-gray-600">용법 조정 결과</span>
             </div>
           )}
           {/* 실제 혈중 농도 - observedSeries가 있을 때만 표시 */}
           {observedSeries && observedSeries.length > 0 && (
             <div className="flex items-center gap-2">
               <div 
                 className="w-2 h-2 rounded-full" 
                 style={{ backgroundColor: '#dc2626' }}
               ></div>
               <span className="text-sm text-gray-600">실제 혈중 농도</span>
             </div>
           )}
           {/* 평균 농도 - Area Chart가 아닐 때만 표시 */}
           {!(selectedDrug === 'Vancomycin' && tdmTarget?.toLowerCase().includes('auc')) && typeof averageConcentration === 'number' && (
             <div className="flex items-center gap-2">
               <div className="w-8 h-0.5 border-dashed border-t-2 border-gray-500"></div>
               <span className="text-sm text-gray-600">평균 농도</span>
             </div>
           )}
           {/* TDM 목표치 - targetMin/targetMax가 있을 때만 표시 */}
           {targetMin !== null && targetMax !== null && targetMax > targetMin && (
             <div className="flex items-center gap-2">
               <div className="w-8 h-4 bg-blue-500 bg-opacity-20"></div>
               <span className="text-sm text-gray-600">TDM 목표치</span>
             </div>
           )}
         </div>
       )}

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
                // 환자 현용법
                ...(currentMethodSeries && currentMethodSeries.length > 0 ? [{
                  label: '환자 현용법',
                  data: data.map(d => ({ x: d.time, y: (d.currentMethod ?? null) as number | null })),
                  borderColor: '#3b82f6',
                  backgroundColor: 'rgba(59,130,246,0.25)',
                  pointRadius: 0,
                  fill: false,
                  tension: 0.25,
                }] : []),
                // 용법 조정 결과
                {
                  label: '용법 조정 결과',
                  data: data.map(d => ({ x: d.time, y: d.predicted })),
                  borderColor: chartColor === 'pink' ? '#ec4899' : '#22c55e',
                  backgroundColor: chartColor === 'pink' ? 'rgba(236,72,153,0.25)' : 'rgba(34,197,94,0.25)',
                  pointRadius: 0,
                  fill: selectedDrug === 'Vancomycin' && (tdmTarget?.toLowerCase().includes('auc') || false),
                  tension: 0.25,
                },
                // 실제 혈중 농도
                ...(observedSeries && observedSeries.length > 0 ? [{
                  label: '실제 혈중 농도',
                  data: data.map(d => ({ x: d.time, y: d.observed as number | null })),
                  borderColor: '#dc2626',
                  backgroundColor: '#dc2626',
                  showLine: false,
                  pointRadius: 3,
                }] : []),
                // 평균 농도 (특정 케이스 제외)
                ...(!(selectedDrug === 'Vancomycin' && tdmTarget?.toLowerCase().includes('auc')) && typeof averageConcentration === 'number' ? [{
                  label: '평균 농도',
                  data: data.map(d => ({ x: d.time, y: averageConcentration })),
                  borderColor: '#808080',
                  pointRadius: 0,
                  fill: false,
                  borderDash: [5, 5] as unknown as number[],
                }] : [])
              ]
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              parsing: true,
              animation: false,
              plugins: {
                legend: { display: true },
                tooltip: {
                  callbacks: {
                    label: (ctx) => {
                      const label = ctx.dataset.label || '';
                      const v = ctx.parsed.y as number;
                      const unit = (label === '평균 농도') ? getConcentrationUnit(selectedDrug) : getConcentrationUnit(selectedDrug);
                      const fmt = typeof v === 'number' ? (label === '실제 혈중 농도' ? v.toFixed(2) : v.toFixed(2)) : v;
                      return `${label}: ${fmt} ${unit}`;
                    }
                  }
                },
                annotation: {
                  annotations: {
                    targetBand: (targetMin !== null && targetMax !== null && targetMax > targetMin) ? {
                      type: 'box', yMin: targetMin!, yMax: targetMax!, backgroundColor: 'rgba(59,130,246,0.08)', borderWidth: 0
                    } : undefined,
                    lastDose: (lastActualDoseTime != null) ? {
                      type: 'line', xMin: lastActualDoseTime, xMax: lastActualDoseTime, borderColor: '#ff6b6b', borderWidth: 2, borderDash: [5,5]
                    } : undefined
                  }
                },
                zoom: {
                  limits: { x: { min: dataTimeExtents.min, max: dataTimeExtents.max, minRange: 0.5 } },
                  zoom: {
                    mode: 'x',
                    wheel: { enabled: true, modifierKey: 'ctrl' },
                    drag: { enabled: true, backgroundColor: 'rgba(59,130,246,0.08)', borderColor: '#3b82f6', borderWidth: 1 }
                  },
                  pan: { enabled: true, mode: 'x' }
                },
                decimation: { enabled: true, algorithm: 'min-max' }
              },
              scales: {
                x: {
                  type: 'linear',
                  ticks: { callback: (v) => formatDateTimeForTick(Number(v)) }
                },
                y: {
                  min: 0,
                  max: yMax,
                  ticks: { callback: (v) => `${Number(v).toFixed(2)}` }
                }
              }
            }}
          />
        </div>
        
        {/* 고정된 X축 라벨 */}
        {!isEmptyChart && (
          <div className="flex justify-center mt-2">
            <div className="text-sm text-gray-600 font-medium">투약 일시</div>
          </div>
        )}
      </div>

      {/* 구분선 - 빈 차트일 때는 숨김 */}
      {!isEmptyChart && <div className="border-t border-gray-200 dark:border-gray-700 my-8"></div>}

      {/* TDM Summary division - 빈 차트일 때는 숨김 */}
      {!isEmptyChart && (
        <div className="bg-slate-50 dark:bg-slate-800/30 rounded-lg p-6 mb-6 border border-slate-200 dark:border-slate-700 mt-4">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
            TDM Summary
          </h2>
          
          {/* 요약 카드 섹션 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* 최근 혈중 약물 농도 */}
            <Card className="bg-white border-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-gray-800">최근 혈중 약물 농도</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">AUC:</span>
                  <span className="font-semibold">{recentAUC != null ? `${Math.round(recentAUC).toLocaleString()} mg*h/L` : '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">max 농도:</span>
                  <span className="font-semibold">{recentMax != null ? `${recentMax} ${getConcentrationUnit(selectedDrug)}` : '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">trough 농도:</span>
                  <span className="font-semibold">{recentTrough != null ? `${recentTrough} ${getConcentrationUnit(selectedDrug)}` : '-'}</span>
                </div>
              </CardContent>
            </Card>

            {/* 예측 약물 농도 */}
            <Card className="bg-white border-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-gray-800">예측 약물 농도</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">AUC:</span>
                  <span className="font-semibold">{predictedAUC != null ? `${Math.round(predictedAUC).toLocaleString()} mg*h/L` : '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">max 농도:</span>
                  <span className="font-semibold">{predictedMax != null ? `${predictedMax} ${getConcentrationUnit(selectedDrug)}` : '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">trough 농도:</span>
                  <span className="font-semibold">{predictedTrough != null ? `${predictedTrough} ${getConcentrationUnit(selectedDrug)}` : '-'}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 용법 조정 결과 */}
          <Card className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-slate-800 dark:text-slate-200 flex items-center gap-2">
                용법 조정 결과
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 bg-gray-800 dark:bg-gray-200 rounded-full mt-2 flex-shrink-0"></div>
                <p className="leading-relaxed">
                  {tdmIndication || '적응증'}의 {selectedDrug || '약물명'} 처방 시 TDM 목표는 
                  <span className="font-semibold text-blue-600 dark:text-blue-400"> {tdmTarget || '목표 유형'} ({tdmTargetValue || '목표값'})</span>입니다.
                </p>
        </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 bg-gray-800 dark:bg-gray-200 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="leading-relaxed">
                    <span className="font-semibold">현 용법 {latestAdministration?.intervalHours || '시간'} 간격으로 {latestAdministration?.dose || 0}{latestAdministration?.unit || 'mg'} 투약 시</span> Steady State까지 
                    TDM 목표 <span className="font-semibold text-blue-600 dark:text-blue-400">{tdmTarget || '목표 유형'}</span>는 
                    <span className="font-semibold text-red-600 dark:text-red-400"> {getTdmTargetValue().value}</span>으로 
                    {isWithinTargetRange() ? (
                      <> 적절한 용법입니다.</>
                    ) : (
                      <> 치료 범위를 벗어납니다.</>
                    )}
                  </p>
      </div>

            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default DosageChart;
