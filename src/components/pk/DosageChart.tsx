import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea } from "recharts";

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
}

const DosageChart = ({
  simulationData,
  showSimulation,
  currentPatientName,
  selectedDrug,
  chartTitle = "용법 조정 시뮬레이션"
}: DosageChartProps) => {
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
                    name === 'predicted' ? '투약시간 조정시' : name === 'controlGroup' ? '용량조정시' : '실제값'
                  ]}
                  labelFormatter={(value) => `Time: ${value} hours`}
                />
                {/* 용량조정시 (핑크색) */}
                <Line 
                  type="monotone" 
                  dataKey="controlGroup" 
                  stroke="#ec4899" 
                  strokeWidth={2}
                  name="용량조정시"
                  dot={false}
                />
                {/* 투약시간 조정시 (시안색) */}
                <Line 
                  type="monotone" 
                  dataKey="predicted" 
                  stroke="#06b6d4" 
                  strokeWidth={2}
                  name="투약시간 조정시"
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

    </div>
  );
};

export default DosageChart;
