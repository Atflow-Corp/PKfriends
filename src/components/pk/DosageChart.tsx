import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea } from "recharts";
import { useMemo } from "react";
import { ChartColumnIncreasing } from "lucide-react";

interface SimulationDataPoint {
  time: number;
  predicted: number;
  observed: number | null;
  controlGroup?: number;
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
  currentDosage?: number;
  currentUnit?: string;
  currentFrequency?: string;
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
  currentDosage,
  currentUnit,
  currentFrequency,
  // 빈 차트 상태 관리
  isEmptyChart = false,
  selectedButton
}: DosageChartProps) => {
  // Merge separated series if provided; otherwise fall back to simulationData
  const data: SimulationDataPoint[] = useMemo(() => {
    // 빈 차트 상태일 때는 빈 데이터 반환
    if (isEmptyChart) {
      return [];
    }

    if ((ipredSeries && ipredSeries.length) || (predSeries && predSeries.length) || (observedSeries && observedSeries.length)) {
      const map = new Map<number, SimulationDataPoint & { controlGroup?: number }>();

      // helper to get or create point
      const getPoint = (t: number): SimulationDataPoint & { controlGroup?: number } => {
        const key = Number(t) || 0;
        const existing = map.get(key);
        if (existing) return existing;
        const created: SimulationDataPoint & { controlGroup?: number } = { time: key, predicted: 0, observed: null, controlGroup: 0 };
        map.set(key, created);
        return created;
      };

      // IPRED_CONC -> predicted (use API unit as-is)
      for (const p of ipredSeries || []) {
        const t = Number(p.time) || 0;
        const y = (Number(p.value) || 0);
        const pt = getPoint(t);
        pt.predicted = y;
      }
      // Observed from input dataset DV (mg/L -> ng/mL)
      for (const p of observedSeries || []) {
        const t = Number(p.time) || 0;
        const y = Number(p.value);
        const pt = getPoint(t);
        pt.observed = y;
      }
      const result = Array.from(map.values()).sort((a, b) => a.time - b.time);
      return result;
    }
    return simulationData;
  }, [simulationData, ipredSeries, predSeries, observedSeries, isEmptyChart]);

  // Calculate recent and predicted values
  const recentAUC = propRecentAUC ?? 335;
  const recentMax = propRecentMax ?? 29;
  const recentTrough = propRecentTrough ?? 5;
  const predictedAUC = propPredictedAUC ?? 490;
  const predictedMax = propPredictedMax ?? 38;
  const predictedTrough = propPredictedTrough ?? 18;

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

  return (
    <div className="w-full">


       {/* 메인 그래프 */}
       <div className="mb-2">
         <div className={`h-48 ${isEmptyChart ? '' : 'overflow-x-auto overflow-y-hidden'}`}>
           <div className={`h-full ${isEmptyChart ? '' : 'min-w-[1800px]'}`} style={isEmptyChart ? {} : { width: '300%' }}>
            <ResponsiveContainer width="100%" height="100%">
               {selectedDrug === 'Vancomycin' ? (
                 // 반코마이신: Area Chart
                 <AreaChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="time" 
                  label={{ value: 'Time(hours)', position: 'insideBottom', offset: -5 }}
                  tick={{ fontSize: 12 }}
                   domain={isEmptyChart ? [0, 24] : [0, 72]}
                  type="number"
                  scale="linear"
                   ticks={isEmptyChart ? [0, 4, 8, 12, 16, 20, 24] : [0, 8, 16, 24, 32, 40, 48, 56, 64, 72]}
                  tickFormatter={(value) => `${value}h`}
                   interval="preserveStartEnd"
                />
                <YAxis 
                   label={{ value: 'Concentration(mg/L)', angle: -90, position: 'insideLeft' }}
                  tick={{ fontSize: 12 }}
                   domain={[0, yMax]}
                   tickCount={6}
                   tickFormatter={(value) => `${value.toFixed(2)}`}
                />
                {/* 목표 범위 (파란색 영역) */}
                 {targetMin !== null && targetMax !== null && targetMax > targetMin && (
                   <ReferenceArea y1={targetMin} y2={targetMax} fill="#3b82f6" fillOpacity={0.1} />
                 )}
                <Tooltip 
                  formatter={(value: any, name: string) => [
                    typeof value === 'number' ? `${value.toFixed(2)} mg/L` : 'N/A', 
                     name === 'predicted' ? '현용법' : '실제값'
                  ]}
                  labelFormatter={(value) => `Time: ${value} hours`}
                />
                 {/* 현용법 */}
                 <Area 
                   type="monotone" 
                   dataKey="predicted" 
                   stroke={selectedColor.stroke}
                   fill={selectedColor.fill}
                   fillOpacity={selectedColor.fillOpacity}
                   strokeWidth={2}
                   name="현용법"
                 />
                 {/* 실제 측정값 (빨간 점) */}
                <Line 
                  type="monotone" 
                   dataKey="observed" 
                   stroke="#dc2626" 
                   strokeWidth={0}
                   dot={{ fill: "#dc2626", r: 4 }}
                   name="실제값"
                 />
               </AreaChart>
               ) : (
                 // 기타 약물: Line Chart
                 <LineChart data={data}>
                 <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                 <XAxis 
                   dataKey="time" 
                   label={{ value: 'Time(hours)', position: 'insideBottom', offset: -5 }}
                   tick={{ fontSize: 12 }}
                   domain={isEmptyChart ? [0, 24] : [0, 72]}
                   type="number"
                   scale="linear"
                   ticks={isEmptyChart ? [0, 4, 8, 12, 16, 20, 24] : [0, 8, 16, 24, 32, 40, 48, 56, 64, 72]}
                   tickFormatter={(value) => `${value}h`}
                   interval="preserveStartEnd"
                 />
                 <YAxis 
                   label={{ value: 'Concentration(ng/mL)', angle: -90, position: 'insideLeft' }}
                   tick={{ fontSize: 12 }}
                   domain={[0, yMax]}
                   tickCount={6}
                   tickFormatter={(value) => `${Math.round(value)}`}
                 />
                 {/* 목표 범위 (파란색 영역) */}
                 {targetMin !== null && targetMax !== null && targetMax > targetMin && (
                   <ReferenceArea y1={targetMin} y2={targetMax} fill="#3b82f6" fillOpacity={0.1} />
                 )}
                 <Tooltip 
                   formatter={(value: any, name: string) => [
                     typeof value === 'number' ? `${value.toFixed(2)} ng/mL` : 'N/A', 
                     name === 'predicted' ? '현용법' : '실제값'
                   ]}
                   labelFormatter={(value) => `Time: ${value} hours`}
                 />
                 {/* 현용법 */}
                <Line 
                  type="monotone" 
                  dataKey="predicted" 
                   stroke={selectedColor.stroke}
                  strokeWidth={2}
                   name="현용법"
                  dot={false}
                />
                {/* 실제 측정값 (빨간 점) */}
                <Line 
                  type="monotone" 
                  dataKey="observed" 
                  stroke="#dc2626" 
                  strokeWidth={0}
                  dot={{ fill: "#dc2626", r: 4 }}
                  name="실제값"
                />
              </LineChart>
               )}
            </ResponsiveContainer>
          </div>
        </div>
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
                  <span className="font-semibold">{recentMax != null ? `${recentMax} mg/L` : '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">trough 농도:</span>
                  <span className="font-semibold">{recentTrough != null ? `${recentTrough} mg/L` : '-'}</span>
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
                  <span className="font-semibold">{predictedMax != null ? `${predictedMax} mg/L` : '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">trough 농도:</span>
                  <span className="font-semibold">{predictedTrough != null ? `${predictedTrough} mg/L` : '-'}</span>
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
                    현 용법 {currentFrequency || '시간'} 간격으로 {currentDosage || 0}{currentUnit || 'mg'} 투약 시 Steady State까지 
                  <span className="font-semibold text-red-600 dark:text-red-400"> AUC는 {Math.round(predictedAUC || 0).toLocaleString()}mg*h/L</span>으로 
                    치료 범위 이하로 떨어질 수 있습니다.
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
