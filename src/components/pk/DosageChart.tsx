import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea } from "recharts";
import { useMemo } from "react";
import { ChartColumnIncreasing } from "lucide-react";

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
  const getFirstDoseDateTime = () => {
    if (!drugAdministrations || drugAdministrations.length === 0) return new Date();
    
    const sortedDoses = drugAdministrations
      .filter(d => d.drugName === selectedDrug)
      .sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime());
    
    return sortedDoses.length > 0 
      ? new Date(`${sortedDoses[0].date}T${sortedDoses[0].time}`)
      : new Date();
  };

  // x축 틱 데이터 생성 (실제 투약 일시 + 예측 투약 일시)
  const xAxisTicks = useMemo(() => {
    if (!drugAdministrations || drugAdministrations.length === 0) {
      return [0, 8, 16, 24, 32, 40, 48, 56, 64, 72]; // 기본 틱
    }
    
    const firstDoseDateTime = getFirstDoseDateTime();
    const selectedDrugDoses = drugAdministrations
      .filter(d => d.drugName === selectedDrug)
      .map(d => {
        const doseDateTime = new Date(`${d.date}T${d.time}`);
        const hoursFromFirst = (doseDateTime.getTime() - firstDoseDateTime.getTime()) / (1000 * 60 * 60);
        return {
          time: hoursFromFirst,
          dateTime: doseDateTime
        };
      })
      .sort((a, b) => a.time - b.time);
    
    // 실제 투약 시간들
    const actualDoseTimes = selectedDrugDoses.map(d => d.time);
    
    // 마지막 투약 시간 이후의 예측 투약 시간들 계산
    if (selectedDrugDoses.length > 0) {
      const lastDoseTime = Math.max(...actualDoseTimes);
      const intervalHours = selectedDrugDoses.length > 1 
        ? selectedDrugDoses[1].time - selectedDrugDoses[0].time // 첫 두 투약 간격
        : 12; // 기본 12시간 간격
      
      // 마지막 투약 시간부터 72시간까지 예측 투약 시간 추가
      const predictedTimes = [];
      let nextPredictedTime = lastDoseTime + intervalHours;
      
      while (nextPredictedTime <= 72) {
        predictedTimes.push(nextPredictedTime);
        nextPredictedTime += intervalHours;
      }
      
      // 실제 투약 시간과 예측 투약 시간 합치기
      return [...actualDoseTimes, ...predictedTimes].sort((a, b) => a - b);
    }
    
    return actualDoseTimes;
  }, [drugAdministrations, selectedDrug]);

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
  }, [drugAdministrations, selectedDrug]);

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
  }, [simulationData, ipredSeries, predSeries, observedSeries, currentMethodSeries, isEmptyChart]);

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

  // 디버깅: observed 데이터 확인
  console.log('DosageChart observedSeries:', observedSeries);
  console.log('DosageChart data with observed:', data.filter(d => d.observed !== null && d.observed !== undefined));
  console.log('DosageChart currentMethodSeries:', currentMethodSeries);
  console.log('DosageChart data with currentMethod:', data.filter(d => d.currentMethod !== null && d.currentMethod !== undefined));

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

       {/* 메인 그래프 */}
       <div className="mb-2">
         {/* 차트 영역 */}
         <div className={`h-96 ${isEmptyChart ? '' : 'overflow-x-auto overflow-y-hidden'}`}>
           <div className={`h-full ${isEmptyChart ? '' : 'min-w-[1800px]'}`} style={isEmptyChart ? {} : { width: '300%' }}>
            <ResponsiveContainer width="100%" height="100%">
               {selectedDrug === 'Vancomycin' && tdmTarget?.toLowerCase().includes('auc') ? (
                 // 반코마이신 + AUC: Area Chart
                 <AreaChart data={dataWithAverage}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="time" 
                  tick={{ fontSize: 12 }}
                  domain={isEmptyChart ? [0, 24] : [0, 72]}
                  type="number"
                  scale="linear"
                  ticks={isEmptyChart ? [0, 4, 8, 12, 16, 20, 24] : xAxisTicks}
                  tickFormatter={formatDateTimeForTick}
                  interval="preserveStartEnd"
                />
                <YAxis 
                   label={{ value: 'Concentration(mg/L)', angle: -90, position: 'outside', style: { textAnchor: 'middle' }, offset: 10 }}
                  tick={{ fontSize: 12 }}
                   domain={[0, yMax]}
                   tickCount={6}
                   tickFormatter={(value) => `${value.toFixed(2)}`}
                   width={80}
                />
                {/* 목표 범위 (파란색 영역) */}
                 {targetMin !== null && targetMax !== null && targetMax > targetMin && (
                   <ReferenceArea y1={targetMin} y2={targetMax} fill="#3b82f6" fillOpacity={0.1} />
                 )}
                {/* 실제 투약과 예측 투약 구분선 */}
                {lastActualDoseTime && (
                  <ReferenceLine 
                    x={lastActualDoseTime} 
                    stroke="#ff6b6b" 
                    strokeWidth={2} 
                    strokeDasharray="5 5"
                    label={{ value: "실제 투약", position: "top", offset: 10 }}
                  />
                )}
                {/* 평균 약물 농도 점선 */}
                {typeof averageConcentration === 'number' && (
                  <Line 
                    type="monotone" 
                    dataKey="averageLine" 
                    stroke="#808080" 
                    strokeDasharray="5 5"
                    strokeWidth={0.5}
                    name="평균 약물 농도"
                    dot={false}
                  />
                )}
                <Tooltip 
                  formatter={(value: any, name: string) => {
                    if (name === '실제 혈중 농도') {
                      return [`${(value as number).toFixed(2)} mg/L`, '실제 혈중 농도'];
                    }
                    
                    return [
                      typeof value === 'number' ? `${value.toFixed(2)} mg/L` : 'N/A', 
                      name === '환자 현용법' ? '용법 조정 후 농도' : name === '평균 약물 농도' ? '평균 농도' : '실제값'
                    ];
                  }}
                  labelFormatter={(value, payload) => {
                    const data = payload && payload[0] && payload[0].payload;
                    const hasObserved = data && data.observed !== null && data.observed !== undefined;
                    
                    if (hasObserved && data.actualTestTime) {
                      return <strong>검사 시간: {data.actualTestTime}</strong>;
                    }
                    
                    // 실제 투약 일시로 변환
                    if (drugAdministrations && drugAdministrations.length > 0) {
                      const firstDoseDateTime = getFirstDoseDateTime();
                      const targetDateTime = new Date(firstDoseDateTime.getTime() + Number(value) * 60 * 60 * 1000);
                      const dateTimeStr = targetDateTime.toLocaleString('ko-KR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                      }).replace(/\. /g, '.');
                      return <strong>투약 일시: {dateTimeStr}</strong>;
                    }
                    
                    return <strong>투약 {Math.round(Number(value))}시간 경과</strong>;
                  }}
                />
                 {/* 환자의 현용법 */}
                 <Line 
                   type="monotone" 
                   dataKey="currentMethod" 
                   stroke="#3b82f6" 
                   strokeWidth={2}
                   name="환자 현용법"
                   dot={false}
                 />
                 {/* 용법 조정 후 농도 */}
                 <Area 
                   type="monotone" 
                   dataKey="predicted" 
                   stroke={selectedColor.stroke}
                   fill={selectedColor.fill}
                   fillOpacity={selectedColor.fillOpacity}
                   strokeWidth={2}
                   name="용법 조정 결과"
                 />
                 {/* 실제 측정값 (빨간 점) */}
                <Line 
                  type="monotone" 
                   dataKey="observed" 
                   stroke="#dc2626" 
                   strokeWidth={0}
                   dot={{ fill: "#dc2626", r: 4 }}
                   name="실제 혈중 농도"
                 />
               </AreaChart>
               ) : (
                 // 기타 약물: Line Chart
                 <LineChart data={dataWithAverage}>
                 <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                 <XAxis 
                   dataKey="time" 
                   tick={{ fontSize: 12 }}
                   domain={isEmptyChart ? [0, 24] : [0, 72]}
                   type="number"
                   scale="linear"
                   ticks={isEmptyChart ? [0, 4, 8, 12, 16, 20, 24] : xAxisTicks}
                   tickFormatter={formatDateTimeForTick}
                   interval="preserveStartEnd"
                 />
                 <YAxis 
                   label={{ value: 'Concentration(ng/mL)', angle: -90, position: 'outside', style: { textAnchor: 'middle' }, offset: 10 }}
                   tick={{ fontSize: 12 }}
                   domain={[0, yMax]}
                   tickCount={6}
                   tickFormatter={(value) => `${Math.round(value)}`}
                   width={80}
                 />
                 {/* 목표 범위 (파란색 영역) */}
                 {targetMin !== null && targetMax !== null && targetMax > targetMin && (
                   <ReferenceArea y1={targetMin} y2={targetMax} fill="#3b82f6" fillOpacity={0.1} />
                 )}
                 {/* 실제 투약과 예측 투약 구분선 */}
                 {lastActualDoseTime && (
                   <ReferenceLine 
                     x={lastActualDoseTime} 
                     stroke="#ff6b6b" 
                     strokeWidth={2} 
                     strokeDasharray="5 5"
                     label={{ value: "실제 투약", position: "top", offset: 10 }}
                   />
                 )}
                 {/* 평균 약물 농도 점선 */}
                 {typeof averageConcentration === 'number' && (
                   <Line 
                     type="monotone" 
                     dataKey="averageLine" 
                     stroke="#808080" 
                     strokeDasharray="5 5"
                     strokeWidth={0.5}
                     name="평균 약물 농도"
                     dot={false}
                   />
                 )}
                 <Tooltip 
                   formatter={(value: any, name: string) => {
                     if (name === '실제 혈중 농도') {
                       return [`${(value as number).toFixed(2)} ng/mL`, '실제 혈중 농도'];
                     }
                     
                     return [
                       typeof value === 'number' ? `${value.toFixed(2)} ng/mL` : 'N/A', 
                       name === '환자 현용법' ? '조정 농도' : name === '평균 약물 농도' ? '평균 농도' : '실제값'
                     ];
                   }}
                   labelFormatter={(value, payload) => {
                     const data = payload && payload[0] && payload[0].payload;
                     const hasObserved = data && data.observed !== null && data.observed !== undefined;
                     
                     if (hasObserved && data.actualTestTime) {
                       return <strong>검사 시간: {data.actualTestTime}</strong>;
                     }
                     
                     // 실제 투약 일시로 변환
                     if (drugAdministrations && drugAdministrations.length > 0) {
                       const firstDoseDateTime = getFirstDoseDateTime();
                       const targetDateTime = new Date(firstDoseDateTime.getTime() + Number(value) * 60 * 60 * 1000);
                       const dateTimeStr = targetDateTime.toLocaleString('ko-KR', {
                         year: 'numeric',
                         month: '2-digit',
                         day: '2-digit',
                         hour: '2-digit',
                         minute: '2-digit',
                         hour12: false
                       }).replace(/\. /g, '.');
                       return <strong>투약 일시: {dateTimeStr}</strong>;
                     }
                     
                     return <strong>투약 {Math.round(Number(value))}시간 경과</strong>;
                   }}
                 />
                 {/* 현용법 */}
                {/* 환자의 현용법 */}
                <Line 
                  type="monotone" 
                  dataKey="currentMethod" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  name="환자 현용법"
                  dot={false}
                />
                {/* 용법 조정 후 농도 */}
                <Line 
                  type="monotone" 
                  dataKey="predicted" 
                   stroke={selectedColor.stroke}
                  strokeWidth={2}
                   name="용법 조정 결과"
                  dot={false}
                />
                {/* 실제 측정값 (빨간 점) */}
                <Line 
                  type="monotone" 
                  dataKey="observed" 
                  stroke="#dc2626" 
                  strokeWidth={2}
                  dot={{ fill: "#dc2626", r: 4, strokeWidth: 0 }}
                  name="실제 혈중 농도"
                  connectNulls={false}
                />
              </LineChart>
               )}
            </ResponsiveContainer>
          </div>
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
