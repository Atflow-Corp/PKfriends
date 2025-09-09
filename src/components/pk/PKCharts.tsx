import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea } from "recharts";

interface SimulationDataPoint {
  time: number;
  predicted: number;
  observed: number | null;
}

interface PKChartsProps {
  simulationData: SimulationDataPoint[];
  showSimulation: boolean;
  currentPatientName?: string;
  selectedDrug?: string;
  targetMin?: number | null;
  targetMax?: number | null;
}

const PKCharts = ({
  simulationData,
  showSimulation,
  currentPatientName,
  selectedDrug,
  targetMin,
  targetMax
}: PKChartsProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          PK Simulation & Observed Concentrations
        </CardTitle>
        <CardDescription>
          예측 혈중 농도(선)와 실제 측정값(점)을 한눈에 비교할 수 있습니다.
        </CardDescription>
        <div className="mt-2 text-xs text-muted-foreground">
          그래프 해석: 파란색 선은 예측 혈중 농도 변화를, 빨간색 점은 실제 혈액 검사 결과를 나타냅니다. 두 값의 차이를 참고하여 용법 조정 여부를 판단하세요.
        </div>
      </CardHeader>
      <CardContent>
        {showSimulation && simulationData.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={simulationData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="time" 
                  label={{ value: 'Time (hours)', position: 'insideBottom', offset: -5 }}
                />
                <YAxis 
                  label={{ value: 'Concentration (ng/mL)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  formatter={(value: any, name: string) => [
                    typeof value === 'number' ? `${value.toFixed(2)} ng/mL` : 'N/A', 
                    name === 'predicted' ? '예측값' : '실제값'
                  ]}
                  labelFormatter={(value) => `Time: ${value} hours`}
                />
                {typeof targetMin === 'number' && typeof targetMax === 'number' && targetMax > targetMin && (
                  <ReferenceArea y1={targetMin} y2={targetMax} fill="#93c5fd" fillOpacity={0.25} ifOverflow="extendDomain" />
                )}
                <Line 
                  type="monotone" 
                  dataKey="predicted" 
                  stroke="#2563eb" 
                  strokeWidth={2}
                  name="예측값"
                  dot={false}
                />
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
        ) : (
          <div className="h-80 flex items-center justify-center">
            <div className="text-center">
              <p className="text-muted-foreground">시뮬레이션 데이터가 없습니다</p>
              <p className="text-sm text-muted-foreground">
                시뮬레이션 파라미터를 입력하고 "그래프 출력"을 눌러주세요.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PKCharts;
