import { useMemo } from "react";
import TDMLineChart, { ChartDataset } from "./shared/TDMLineChart";
import TDMSummary from "./shared/TDMSummary";
import {
  SimulationDataPoint,
  DrugAdministration,
  mergeSeries,
  calculateDataTimeExtents,
  calculateLastActualDoseTime,
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
  tdmIndication,
  tdmTarget,
  tdmTargetValue,
  latestAdministration,
  originalAdministration,
  drugAdministrations = [],
  currentMethodSeries = [],
  isEmptyChart = false,
  selectedButton
}: DosageChartProps) => {
  // 데이터 병합
  const data = useMemo(() => {
    if (isEmptyChart) return [];
    
    if (ipredSeries?.length || predSeries?.length || observedSeries?.length || currentMethodSeries?.length) {
      return mergeSeries(ipredSeries, predSeries, observedSeries, currentMethodSeries);
    }
    
    return simulationData;
  }, [ipredSeries, predSeries, observedSeries, currentMethodSeries, simulationData, isEmptyChart]);

  // 시간 범위 계산
  const dataTimeExtents = useMemo(() => 
    calculateDataTimeExtents(ipredSeries, predSeries, observedSeries, currentMethodSeries),
    [ipredSeries, predSeries, observedSeries, currentMethodSeries]
  );

  // 마지막 투약 시간 계산
  const lastActualDoseTime = useMemo(() => 
    calculateLastActualDoseTime(drugAdministrations, selectedDrug),
    [drugAdministrations, selectedDrug]
  );

  // 평균 농도 계산
  const averageConcentration = useMemo(() => 
    calculateAverageConcentration(data),
    [data]
  );

  // API 응답 값 정리
  const recentAUC = propRecentAUC ?? 335;
  const recentMax = propRecentMax ?? 29;
  const recentTrough = propRecentTrough ?? 5;
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 text-gray-800 dark:text-gray-100">
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
                예측 결과
              </span>
              <div className="flex flex-col gap-1">
                <div className="flex items-baseline gap-2">
                  {tdmTarget && (
                    <span className="text-xl font-bold text-gray-900 dark:text-white">
                      {tdmTarget.split('(')[0]?.trim() || ''}
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
          </div>

          <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">TDM friends Comments</h3>
            <p>
              {tdmIndication || '적응증'}의 {selectedDrug || '약물명'} 처방 시 TDM 목표는{' '}
              <span className="font-semibold text-gray-900 dark:text-white">
                {tdmTarget || '목표 유형'} ({tdmTargetValue || '목표값'})
              </span>
              입니다.
            </p>
            <p className="mt-1">
              <span className="font-semibold text-gray-900 dark:text-white">
                {intervalLabel} 간격으로 {doseLabel}
              </span>{' '}
              투약 시 Steady State까지{' '}
              <span className="font-semibold text-gray-900 dark:text-white">
                {tdmTarget || '목표 유형'}
              </span>{' '}
              <span
                className={`font-semibold ${
                  withinTargetRange
                    ? 'text-blue-600 dark:text-blue-200'
                    : 'text-red-600 dark:text-red-300'
                }`}
              >
                {targetHighlight.value}
              </span>{' '}
              이며,{' '}
              <span
                className={`font-semibold ${
                  withinTargetRange
                    ? 'text-blue-600 dark:text-blue-200'
                    : 'text-red-600 dark:text-red-300'
                }`}
              >
                {withinTargetRange ? '적정 용법입니다.' : '치료 범위를 벗어납니다.'}
              </span>
            </p>
            <p className="mt-1">
              다양한 용법이 궁금하시다면 화면 하단에서 용법 조정 시뮬레이션을 진행해보세요.
            </p>
          </div>
        </>
      )}

      {/* 범례 */}
      {!isEmptyChart && (
        <div className="flex justify-center gap-6 mb-4">
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
      />

      {/* 구분선 */}
      {!isEmptyChart && <div className="border-t border-gray-200 dark:border-gray-700 my-8"></div>}

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
          commentTitle="용법 조정 결과"
        />
      )}
    </div>
  );
};

export default DosageChart;
