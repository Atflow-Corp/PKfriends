import { useMemo } from "react";
import TDMLineChart, { ChartDataset } from "./shared/TDMLineChart";
import TDMSummary from "./shared/TDMSummary";
import {
  SimulationDataPoint,
  DrugAdministration,
  mergeSeries,
  calculateDataTimeExtents,
  calculateLastActualDoseTime,
  calculateCurrentTimeOffset,
  calculateAverageConcentration,
  getTdmTargetValue,
  isWithinTargetRange
} from "./shared/TDMChartUtils";

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
  tdmIndication?: string;
  tdmTarget?: string;
  tdmTargetValue?: string;
  latestAdministration?: {
    dose: number;
    unit: string;
    intervalHours?: number;
  } | null;
  originalAdministration?: {
    dose: number;
    unit: string;
    intervalHours?: number;
  } | null;
  drugAdministrations?: DrugAdministration[];
  currentMethodSeries?: Array<{
    time: number;
    value: number;
  }>;
  isEmptyChart?: boolean;
  selectedButton?: string;
  isLoading?: boolean;
}

const DosageChart = ({
  simulationData,
  showSimulation,
  currentPatientName,
  selectedDrug,
  chartTitle = "용법 조정 시뮬레이션",
  targetMin,
  targetMax,
  recentAUC,
  recentMax,
  recentTrough,
  predictedAUC: propPredictedAUC,
  predictedMax: propPredictedMax,
  predictedTrough: propPredictedTrough,
  ipredSeries,
  predSeries,
  observedSeries,
  chartColor = 'pink',
  tdmIndication,
  tdmTarget,
  tdmTargetValue,
  latestAdministration,
  originalAdministration,
  drugAdministrations = [],
  currentMethodSeries = [],
  isEmptyChart = false,
  selectedButton,
  isLoading = false
}: DosageChartProps) => {
  // 데이터 병합
  const data = useMemo(() => {
    if (isEmptyChart) return [];
    
    if (ipredSeries?.length || predSeries?.length || observedSeries?.length || currentMethodSeries?.length) {
      return mergeSeries(ipredSeries, predSeries, observedSeries, currentMethodSeries);
    }
    
    return simulationData;
  }, [ipredSeries, predSeries, observedSeries, currentMethodSeries, simulationData, isEmptyChart]);

  // 기본 시간 범위 계산 (모든 시리즈 기준)
  const baseTimeExtents = useMemo(
    () =>
      calculateDataTimeExtents(
        ipredSeries,
        predSeries,
        observedSeries,
        currentMethodSeries
      ),
    [ipredSeries, predSeries, observedSeries, currentMethodSeries]
  );

  // 용법 조정 결과(ipredSeries)가 있는 경우, 그 max time을 기준으로 x축 상한을 맞춘다.
  const dataTimeExtents = useMemo(() => {
    if (ipredSeries && ipredSeries.length > 0) {
      // 큰 배열에서 call stack 초과를 방지하기 위해 reduce 사용
      const adjMax = ipredSeries.reduce((max, p) => (p.time > max ? p.time : max), ipredSeries[0].time);
      return {
        min: baseTimeExtents.min,
        max: Math.min(baseTimeExtents.max, adjMax),
      };
    }
    return baseTimeExtents;
  }, [ipredSeries, baseTimeExtents]);

  // 현재 시간 계산 (빨간색 점선 "now" 표시용)
  const currentTime = useMemo(
    () => calculateCurrentTimeOffset(drugAdministrations, selectedDrug),
    [drugAdministrations, selectedDrug]
  );

  // 마지막 투약 기록 시간 계산 (파란색 점선 "last dosage" 표시용)
  const lastActualDoseTime = useMemo(
    () => calculateLastActualDoseTime(drugAdministrations, selectedDrug),
    [drugAdministrations, selectedDrug]
  );

  // 평균 농도 계산
  const averageConcentration = useMemo(() => 
    calculateAverageConcentration(data),
    [data]
  );

  // API 응답 값 정리
  const predictedAUC = propPredictedAUC ?? 490;
  const predictedMax = propPredictedMax ?? 38;
  const predictedTrough = propPredictedTrough ?? 18;
  const intervalHours = latestAdministration?.intervalHours ?? null;
  const doseValue = latestAdministration?.dose ?? null;
  const doseUnit = latestAdministration?.unit || "mg";
  const intervalLabel = intervalHours != null ? `${intervalHours.toLocaleString()} 시간` : "투약 간격 정보 없음";
  const doseLabel = doseValue != null ? `${Number(doseValue).toLocaleString()}${doseUnit}` : "투약 용량 정보 없음";

  const targetHighlight = useMemo(
    () => getTdmTargetValue(tdmTarget, predictedAUC, predictedMax, predictedTrough, selectedDrug),
    [tdmTarget, predictedAUC, predictedMax, predictedTrough, selectedDrug]
  );

  const withinTargetRange = useMemo(
    () => isWithinTargetRange(tdmTarget, tdmTargetValue, predictedAUC, predictedMax, predictedTrough, selectedDrug),
    [tdmTarget, tdmTargetValue, predictedAUC, predictedMax, predictedTrough, selectedDrug]
  );

  // 색상 설정
  const chartColors = {
    pink: '#ec4899',
    green: '#22c55e'
  };
  const selectedColor = chartColors[chartColor];

  // 차트 데이터셋 정의
  const datasets: ChartDataset[] = useMemo(() => {
    const result: ChartDataset[] = [];

    // 환자 현용법
    if (currentMethodSeries && currentMethodSeries.length > 0) {
      result.push({
        label: '현용법',
        dataKey: 'currentMethod',
        borderColor: '#3b82f6',
        borderWidth: 2
      });
    }

    // 용법 조정 결과
    result.push({
      label: '용법 조정 결과',
      dataKey: 'predicted',
      borderColor: selectedColor,
      borderWidth: 2,
      fill: selectedDrug === 'Vancomycin' && (tdmTarget?.toLowerCase().includes('auc') || false)
    });

    // 실제 혈중 농도
    if (observedSeries && observedSeries.length > 0) {
      result.push({
        label: '실제 혈중 농도',
        dataKey: 'observed',
        borderColor: '#ef4444',
        backgroundColor: '#ef4444',
        pointRadius: 4,
        showLine: false
      });
    }

    // 평균 농도 (Vancomycin AUC 모드가 아닐 때)
    if (!(selectedDrug === 'Vancomycin' && tdmTarget?.toLowerCase().includes('auc')) && typeof averageConcentration === 'number') {
      result.push({
        label: '평균 농도',
        dataKey: 'averageLine',
        borderColor: '#6b7280',
        borderDash: [5, 5],
        borderWidth: 2
      });
    }

    return result;
  }, [currentMethodSeries, selectedColor, selectedDrug, tdmTarget, observedSeries, averageConcentration]);

  return (
    <div className="w-full">
      {/* 프렌드 코멘트 */}
      {!isEmptyChart && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 text-gray-800 dark:text-gray-100">
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
              <span className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">
                투약 간격
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-gray-900 dark:text-white">
                  {intervalHours != null ? intervalHours.toLocaleString() : '-'}
                </span>
                <span className="text-base font-semibold text-gray-700 dark:text-gray-300">시간</span>
              </div>
            </div>

            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
              <span className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">
                1회 투약 용량
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-gray-900 dark:text-white">
                  {doseValue != null ? Number(doseValue).toLocaleString() : '-'}
                </span>
                <span className="text-base font-semibold text-gray-700 dark:text-gray-300">{doseUnit}</span>
              </div>
            </div>

            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
              <span className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">
                용법 변경 시
              </span>
              <div className="flex flex-col gap-1">
                <div className="flex items-baseline gap-2">
                  {tdmTarget && (
                    <span className="text-xl font-bold text-gray-900 dark:text-white">
                      {tdmTarget.split('(')[0]?.trim().replace(/Concentration/gi, '').trim() || ''}
                    </span>
                  )}
                  <span
                    className={`text-xl font-bold ${
                      withinTargetRange
                        ? 'text-blue-700 dark:text-blue-200'
                        : 'text-red-600 dark:text-red-300'
                    }`}
                  >
                    {targetHighlight.value}
                  </span>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-500">
                  목표 범위: {tdmTargetValue || '-'}
                </span>
              </div>
            </div>

            <div
              className={`rounded-lg p-4 ${
                withinTargetRange === undefined
                  ? 'bg-gray-100 dark:bg-gray-800'
                  : withinTargetRange
                  ? 'bg-blue-100 dark:bg-blue-900/40'
                  : 'bg-red-100 dark:bg-red-900/40'
              }`}
            >
              <span className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">
                적합 여부
              </span>
              <div className="text-2xl font-extrabold text-gray-900 dark:text-white">
                {withinTargetRange === undefined ? '-' : withinTargetRange ? '적합' : '부적합'}
              </div>
            </div>
          </div>
        </>
      )}

      {/* 범례 */}
      {!isEmptyChart && (
        <div className="flex justify-center flex-wrap gap-6 mb-4">
          {/* 환자의 현용법 */}
          {currentMethodSeries && currentMethodSeries.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-blue-500"></div>
              <span className="text-sm text-gray-600">{currentPatientName || '환자'}의 현용법</span>
            </div>
          )}
          
          {/* 용법 조정 결과 */}
          {ipredSeries && ipredSeries.length > 0 && (
            <div className="flex items-center gap-2">
              <div 
                className="w-8 h-0.5" 
                style={{ backgroundColor: selectedColor }}
              ></div>
              <span className="text-sm text-gray-600">용법 조정 결과</span>
            </div>
          )}
          
          {/* 실제 혈중 농도 */}
          {observedSeries && observedSeries.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <span className="text-sm text-gray-600">실제 혈중 농도</span>
            </div>
          )}
          
          {/* 현재 시점 기준선 - 차트에만 표시, 범례에서는 제거 */}
          
          {/* 평균 농도 */}
          {!(selectedDrug === 'Vancomycin' && tdmTarget?.toLowerCase().includes('auc')) && typeof averageConcentration === 'number' && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 border-dashed border-t-2 border-gray-500"></div>
              <span className="text-sm text-gray-600">평균 농도</span>
            </div>
          )}
          
          {/* TDM 목표치 */}
          {targetMin !== null && targetMax !== null && targetMax > targetMin && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-4 bg-blue-500 bg-opacity-20"></div>
              <span className="text-sm text-gray-600">TDM 목표치</span>
            </div>
          )}
        </div>
      )}

      {/* 메인 그래프 */}
      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 z-10 rounded-lg">
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                차트를 다시 그리는 중입니다.
              </div>
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            </div>
          </div>
        )}
        <TDMLineChart
          data={data}
          datasets={datasets}
          selectedDrug={selectedDrug}
          targetMin={targetMin}
          targetMax={targetMax}
          dataTimeExtents={dataTimeExtents}
          lastActualDoseTime={lastActualDoseTime}
          drugAdministrations={drugAdministrations}
          averageConcentration={averageConcentration}
          currentTime={currentTime}
          lastDoseColor="#3b82f6" // 파란색 점선
        />
      </div>

      {/* TDM Summary */}
      {!isEmptyChart && (
        <TDMSummary
          selectedDrug={selectedDrug}
          tdmIndication={tdmIndication}
          tdmTarget={tdmTarget}
          tdmTargetValue={tdmTargetValue}
          latestAdministration={latestAdministration}
          originalAdministration={originalAdministration}
          recentAUC={recentAUC}
          recentMax={recentMax}
          recentTrough={recentTrough}
          predictedAUC={predictedAUC}
          predictedMax={predictedMax}
          predictedTrough={predictedTrough}
          commentTitle="TDM friends Comments"
          currentResultTitle="현 용법 유지 시"
          predictedResultTitle="용법 변경 시"
          showSteadyStateComment={false}
        />
      )}

    </div>
  );
};

export default DosageChart;
