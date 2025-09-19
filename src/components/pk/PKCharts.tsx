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
  currentDosage?: number;
  currentUnit?: string;
  currentFrequency?: string;
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
  currentDosage,
  currentUnit,
  currentFrequency
}: PKChartsProps) => {
  // Merge separated series if provided; otherwise fall back to simulationData
  const data: SimulationDataPoint[] = useMemo(() => {
    if ((ipredSeries && ipredSeries.length) || (predSeries && predSeries.length) || (observedSeries && observedSeries.length)) {
      const map = new Map<number, SimulationDataPoint & { controlGroup?: number }>();
      const getPoint = (t: number) => {
        const key = Number(t) || 0;
        const existed = map.get(key);
        if (existed) return existed;
        const created: SimulationDataPoint & { controlGroup?: number } = { time: key, predicted: 0, observed: null, controlGroup: 0 };
        map.set(key, created);
        return created;
      };
      for (const p of ipredSeries || []) {
        const pt = getPoint(p.time);
        pt.predicted = p.value;
      }
      for (const p of predSeries || []) {
        const pt = getPoint(p.time) as SimulationDataPoint & { controlGroup?: number };
        pt.controlGroup = p.value;
      }
      for (const p of observedSeries || []) {
        const pt = getPoint(p.time);
        pt.observed = p.value;
      }
      return Array.from(map.values()).sort((a, b) => a.time - b.time);
    }
    return [];
  }, [ipredSeries, predSeries, observedSeries]);

  // API 응답 혹은 기본값 (기본값을 null로 두고 표시 시 단위 없이 '-')
  const recentAUC: number | null = typeof propRecentAUC === 'number' ? propRecentAUC : null;
  const recentMax: number | null = typeof propRecentMax === 'number' ? propRecentMax : null;
  const recentTrough: number | null = typeof propRecentTrough === 'number' ? propRecentTrough : null;
  const predictedAUC: number | null = typeof propPredictedAUC === 'number' ? propPredictedAUC : null;
  const predictedMax: number | null = typeof propPredictedMax === 'number' ? propPredictedMax : null;
  const predictedTrough: number | null = typeof propPredictedTrough === 'number' ? propPredictedTrough : null;

  // 평균 농도(ng/mL): 시간-농도 곡선의 평균값 (구간 평균), 데이터가 충분할 때만 계산
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

  // Y축 상한: 반코마이신 데이터에 최적화된 범위 (0~0.2 mg/L)
  const yMax = useMemo(() => {
    const dataMax = (data || []).reduce((m, p) => {
      const candidates = [p.predicted, p.controlGroup ?? 0, p.observed ?? 0].filter(v => typeof v === 'number') as number[];
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

  const fmtInt = (n: number | null, unit: string) => {
    if (n == null || Number.isNaN(n)) return '-';
    return `${Math.round(n).toLocaleString()} ${unit}`;
  };

  const fmtFixed = (n: number | null, unit: string) => {
    if (n == null || Number.isNaN(n)) return '-';
    return `${Number(n.toFixed(2)).toLocaleString()} ${unit}`;
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
            // 반코마이신 해석 가이드
            <>
              <p><strong>(1)</strong> 차트의 곡선은 TDM Simulation을 통해 예측한 혈중 농도의 변화를 의미합니다.</p>
              <p><strong>(2)</strong> 빨간색 점은 혈액 검사 결과 측정된 실제 혈중 약물 농도입니다.</p>
              <p><strong>(3)</strong> AUC 데이터는 차트의 누적 면적이 목표 범위 내 있을 때 용법이 적절하다고 해석할 수 있습니다.</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                * 현 용법이 적절하다면 일반 대조군의 차트 면적과 유사한 패턴을 보여야 합니다.
              </p>
            </>
          ) : (
            // 사이클로스포린 해석 가이드
            <>
              <p><strong>(1)</strong> 차트의 곡선은 TDM Simulation을 통해 예측한 혈중 농도의 변화를 의미합니다.</p>
              <p><strong>(2)</strong> 빨간색 점은 혈액 검사 결과 측정된 실제 혈중 약물 농도입니다.</p>
              <p><strong>(3)</strong> 파란색 range는 TDM목표치 범위를 의미합니다.</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                * (1)과 (2)가 (3)의 range안에 모두 있다면 현 용법이 적절하다는 의미로 해석될 수 있습니다.
              </p>
            </>
          )}
            </div>
      </div>


      {/* 범례 */}
      <div className="flex justify-center gap-6 mb-4">
      <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-blue-500"></div>
          <span className="text-sm text-gray-600">{currentPatientName || '환자'}님의 현용법</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-orange-500"></div>
          <span className="text-sm text-gray-600">일반 대조군 결과</span>
        </div>

      </div>

      {/* 메인 그래프 - 가로 스크롤 가능 */}
      <div className="mb-2">

        <div className="h-48 overflow-x-auto overflow-y-hidden">
          <div className="min-w-[1800px] h-full" style={{ width: '300%' }}>
            <ResponsiveContainer width="100%" height="100%">
              {selectedDrug === 'Vancomycin' ? (
                // 반코마이신: Area Chart
                <AreaChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="time" 
                  label={{ value: 'Time(hours)', position: 'insideBottom', offset: -5 }}
                  tick={{ fontSize: 12 }}
                  domain={[0, 72]}
                  type="number"
                  scale="linear"
                  ticks={[0, 8, 16, 24, 32, 40, 48, 56, 64, 72]}
                  tickFormatter={(value) => `${value}h`}
                />
                <YAxis 
                  label={{ value: 'Concentration(mg/L)', angle: -90, position: 'insideLeft' }}
                  tick={{ fontSize: 12 }}
                  domain={[0, yMax]}
                    tickCount={6}
                    tickFormatter={(value) => `${value.toFixed(2)}`}
                />
                {/* 목표 범위 (파란색 영역) */}
                {typeof targetMin === 'number' && typeof targetMax === 'number' && targetMax > targetMin && (
                  <ReferenceArea y1={targetMin} y2={targetMax} fill="#3b82f6" fillOpacity={0.1} />
                )}
                {/* 평균 약물 농도 점선 */}
                {typeof averageConcentration === 'number' && (
                  <ReferenceLine y={averageConcentration} stroke="#3b82f6" strokeDasharray="5 5" />
                )}
                <Tooltip 
                  formatter={(value: unknown, name: string) => [
                    typeof value === 'number' ? `${value.toFixed(2)} mg/L` : 'N/A', 
                    name === 'predicted' ? '환자 현용법' : name === 'controlGroup' ? '일반 대조군' : '실제값'
                  ]}
                  labelFormatter={(value) => `Time: ${value} hours`}
                />
                  {/* 대조군 (PRED_CONC, 주황색 영역) */}
                  <Area 
                    type="monotone" 
                    dataKey="controlGroup" 
                    stroke="#f97316" 
                    fill="#f97316"
                    fillOpacity={0.3}
                    name="일반 대조군"
                  />
                  {/* 환자 (IPRED_CONC, 파란색 영역) */}
                  <Area 
                    type="monotone" 
                    dataKey="predicted" 
                    stroke="#3b82f6" 
                    fill="#3b82f6"
                    fillOpacity={0.3}
                    name="환자 현용법"
                  />
                </AreaChart>
              ) : (
                // 사이클로스포린: Line Chart + 목표 범위
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="time" 
                    label={{ value: 'Time(hours)', position: 'insideBottom', offset: -5 }}
                    tick={{ fontSize: 12 }}
                    domain={[0, 72]}
                    type="number"
                    scale="linear"
                    ticks={[0, 8, 16, 24, 32, 40, 48, 56, 64, 72]}
                    tickFormatter={(value) => `${value}h`}
                  />
                  <YAxis 
                    label={{ value: 'Concentration(ng/mL)', angle: -90, position: 'insideLeft' }}
                    tick={{ fontSize: 12 }}
                    domain={[0, yMax]}
                    tickCount={6}
                    tickFormatter={(value) => `${Math.round(value)}`}
                  />
                  {/* 목표 범위 (파란색 영역) */}
                  {typeof targetMin === 'number' && typeof targetMax === 'number' && targetMax > targetMin && (
                    <ReferenceArea y1={targetMin} y2={targetMax} fill="#3b82f6" fillOpacity={0.1} />
                  )}
                  {/* 평균 약물 농도 점선 */}
                  {typeof averageConcentration === 'number' && (
                    <ReferenceLine y={averageConcentration} stroke="#3b82f6" strokeDasharray="5 5" />
                  )}
                  <Tooltip 
                    formatter={(value: unknown, name: string) => [
                      typeof value === 'number' ? `${value.toFixed(2)} ng/mL` : 'N/A', 
                    name === 'predicted' ? '환자 현용법' : name === 'controlGroup' ? '일반 대조군' : '실제값'
                  ]}
                  labelFormatter={(value) => `Time: ${value} hours`}
                />
                {/* 대조군 (PRED_CONC, 주황색) */}
                <Line 
                  type="monotone" 
                  dataKey="controlGroup" 
                  stroke="#f97316" 
                  strokeWidth={2}
                  name="일반 대조군"
                  dot={false}
                />
                {/* 환자 (IPRED_CONC, 파란색) */}
                <Line 
                  type="monotone" 
                  dataKey="predicted" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  name="환자 현용법"
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

      {/* 구분선 */}
      <div className="border-t border-gray-200 dark:border-gray-700 my-8"></div>

      {/* TDM Summary division */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 mb-6 border border-blue-200 dark:border-blue-800 mt-4">
        <h2 className="text-xl font-bold text-blue-800 dark:text-blue-200 mb-4 flex items-center gap-2">
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
                <span className="font-semibold">{fmtInt(recentAUC, 'mg*h/L')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">max 농도:</span>
                <span className="font-semibold">{fmtFixed(recentMax, 'mg/L')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">trough 농도:</span>
                <span className="font-semibold">{fmtFixed(recentTrough, 'mg/L')}</span>
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
                <span className="font-semibold">{fmtInt(predictedAUC, 'mg*h/L')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">max 농도:</span>
                <span className="font-semibold">{fmtFixed(predictedMax, 'mg/L')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">trough 농도:</span>
                <span className="font-semibold">{fmtFixed(predictedTrough, 'mg/L')}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 용법 조정 결과 */}
        <Card className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-blue-800 dark:text-blue-200 flex items-center gap-2">
              TDM friends Comments
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
                <span className="font-semibold text-red-600 dark:text-red-400"> AUC는 {predictedAUC || 0}mg*h/L</span>으로 
                치료 범위 이하로 떨어질 수 있습니다.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 bg-gray-800 dark:bg-gray-200 rounded-full mt-2 flex-shrink-0"></div>
              <p className="leading-relaxed">
                
                <span className="font-semibold text-red-600 dark:text-red-400">투약 용량 조정(증량)</span>을 권장합니다.
              </p>
            </div>
          </CardContent>
        </Card>
          </div>

    </div>
  );
};

export default PKCharts;
