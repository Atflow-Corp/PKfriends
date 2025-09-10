import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea } from "recharts";
import { Button } from "@/components/ui/button";

interface SimulationDataPoint {
  time: number;
  predicted: number;
  observed: number | null;
  controlGroup?: number;
}

interface PKChartsProps {
  simulationData: SimulationDataPoint[];
  showSimulation: boolean;
  currentPatientName?: string;
  selectedDrug?: string;
}

const PKCharts = ({
  simulationData,
  showSimulation,
  currentPatientName,
  selectedDrug
}: PKChartsProps) => {
  // 72시간까지 샘플 데이터 생성 (실제로는 props에서 받아야 함)
  const generate72HourData = () => {
    const data = [];
    for (let t = 0; t <= 72; t += 0.5) {
      // 24시간 주기로 반복되는 패턴 생성
      const cycleTime = t % 24;
      const cycle = Math.floor(t / 24);
      
      // 각 주기마다 약간의 변화를 주어 더 현실적으로 만들기
      const cycleFactor = Math.pow(0.95, cycle); // 각 주기마다 5% 감소
      
      let predicted, controlGroup;
      
      if (cycleTime <= 8) {
        // 첫 8시간: 감소 구간
        predicted = (27 - cycleTime * 2.5) * cycleFactor;
        controlGroup = (30 - cycleTime * 2.5) * cycleFactor;
      } else if (cycleTime <= 9) {
        // 8-9시간: 급상승 (투약)
        const riseTime = cycleTime - 8;
        predicted = (5 + riseTime * 23) * cycleFactor;
        controlGroup = (10 + riseTime * 25) * cycleFactor;
      } else {
        // 9-24시간: 감소 구간
        const decayTime = cycleTime - 9;
        predicted = (28 - decayTime * 1.4) * cycleFactor;
        controlGroup = (35 - decayTime * 1.5) * cycleFactor;
      }
      
      // 실제 측정값은 첫 24시간에만 배치
      let observed = null;
      if (cycle === 0) {
        if (Math.abs(cycleTime - 6) < 0.5) observed = 25 * cycleFactor;
        if (Math.abs(cycleTime - 13) < 0.5) observed = 20 * cycleFactor;
        if (Math.abs(cycleTime - 18) < 0.5) observed = 25 * cycleFactor;
      }
      
      data.push({
        time: t,
        predicted: Math.max(0, predicted),
        observed,
        controlGroup: Math.max(0, controlGroup)
      });
    }
    return data;
  };

  const sampleData = simulationData.length > 0 ? simulationData : generate72HourData();

  // PK 파라미터 계산 (샘플 데이터)
  const recentAUC = 335;
  const recentMax = 29;
  const recentTrough = 5;
  const predictedAUC = 490;
  const predictedMax = 38;
  const predictedTrough = 18;
  const averageConcentration = 15.9;

  return (
    <div className="w-full bg-white dark:bg-slate-900 rounded-lg p-6 shadow">
      {/* TDM Simulator 헤더 */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">TDM Simulator</h1>
        <p className="text-gray-600 dark:text-gray-300">
          현 용법의 예측 결과를 확인하고 시뮬레이션을 추가해보세요.
        </p>
      </div>

      {/* 요약 카드 섹션 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* 최근 혈중 약물 농도 */}
        <Card className="bg-white border-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-gray-800">최근 혈중 약물 농도</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">AUC:</span>
              <span className="font-semibold">{recentAUC} mg*h/L</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">max 농도:</span>
              <span className="font-semibold">{recentMax} mg/L</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">trough 농도:</span>
              <span className="font-semibold">{recentTrough} mg/L</span>
            </div>
          </CardContent>
        </Card>

        {/* 예측 약물 농도 */}
        <Card className="bg-white border-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-gray-800">예측 약물 농도</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">AUC:</span>
              <span className="font-semibold">{predictedAUC} mg*h/L</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">max 농도:</span>
              <span className="font-semibold">{predictedMax} mg/L</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">trough 농도:</span>
              <span className="font-semibold">{predictedTrough} mg/L</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 범례 */}
      <div className="flex justify-center gap-6 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-orange-500"></div>
          <span className="text-sm text-gray-600">일반 대조군 결과</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-blue-500"></div>
          <span className="text-sm text-gray-600">{currentPatientName || '환자'}의 현용법</span>
        </div>
      </div>

      {/* 메인 그래프 - 가로 스크롤 가능 */}
      <div className="mb-6">
        <div className="text-sm text-gray-600 mb-2">
          📊 72시간까지 조회 가능 (가로 스크롤로 24시간 이후 데이터 확인)
        </div>
        <div className="h-96 overflow-x-auto overflow-y-hidden">
          <div className="min-w-[1800px] h-full" style={{ width: '300%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sampleData}>
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
                  domain={[0, 36]}
                />
                {/* 목표 범위 (파란색 영역) */}
                <ReferenceArea y1={12} y2={24} fill="#3b82f6" fillOpacity={0.1} />
                {/* 평균 약물 농도 점선 */}
                <ReferenceLine y={averageConcentration} stroke="#3b82f6" strokeDasharray="5 5" />
                <Tooltip 
                  formatter={(value: any, name: string) => [
                    typeof value === 'number' ? `${value.toFixed(2)} mg/L` : 'N/A', 
                    name === 'predicted' ? '환자 현용법' : name === 'controlGroup' ? '일반 대조군' : '실제값'
                  ]}
                  labelFormatter={(value) => `Time: ${value} hours`}
                />
                {/* 일반 대조군 결과 (주황색) */}
                <Line 
                  type="monotone" 
                  dataKey="controlGroup" 
                  stroke="#f97316" 
                  strokeWidth={2}
                  name="일반 대조군"
                  dot={false}
                />
                {/* 환자 현용법 (파란색) */}
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
            </ResponsiveContainer>
          </div>
        </div>
      </div>



      {/* 그래프 해석 가이드 */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-gray-800 dark:text-white mb-3">그래프 해석</h3>
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
          <p><strong>(1)</strong> 차트의 곡선은 TDM Simulation을 통해 예측한 혈중 농도의 변화를, 점선은 평균 약물 농도를 의미합니다.</p>
          <p><strong>(2)</strong> 빨간색 점은 혈액 검사 결과 측정된 실제 혈중 약물 농도입니다.</p>
          <p><strong>(3)</strong> 파란 range는 TDM 목표치의 범위로 참고할 수 있습니다.</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            * 일반적으로 목표치를 Trough로 했을 때 (1)과 (2)가 (3)의 range 안에 모두 있다면 현 용법이 적절하다는 의미로 해석될 수 있습니다.
              </p>
            </div>
          </div>

    </div>
  );
};

export default PKCharts;
