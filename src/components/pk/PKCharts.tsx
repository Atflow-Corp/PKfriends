import { useMemo } from "react";
import { ChartColumnIncreasing } from "lucide-react";
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
  ipredSeries?: { time: number; value: number }[];
  predSeries?: { time: number; value: number }[];
  observedSeries?: { time: number; value: number }[];
  tdmIndication?: string;
  tdmTarget?: string;
  tdmTargetValue?: string;
  latestAdministration?: {
    dose: number;
    unit: string;
    intervalHours?: number;
  } | null;
  drugAdministrations?: DrugAdministration[];
}

const PKCharts = ({
  showSimulation,
  currentPatientName,
  selectedDrug,
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
  tdmIndication,
  tdmTarget,
  tdmTargetValue,
  latestAdministration,
  drugAdministrations = []
}: PKChartsProps) => {
  // 데이터 병합
  const data = useMemo(() => 
    mergeSeries(ipredSeries, predSeries, observedSeries), 
    [ipredSeries, predSeries, observedSeries]
  );

  // 시간 범위 계산
  const dataTimeExtents = useMemo(() => 
    calculateDataTimeExtents(ipredSeries, predSeries, observedSeries),
    [ipredSeries, predSeries, observedSeries]
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

  const predictedAUC: number | null = typeof propPredictedAUC === 'number' ? propPredictedAUC : null;
  const predictedMax: number | null = typeof propPredictedMax === 'number' ? propPredictedMax : null;
  const predictedTrough: number | null = typeof propPredictedTrough === 'number' ? propPredictedTrough : null;

  const intervalHours = latestAdministration?.intervalHours ?? null;
  const emphasizedInterval = intervalHours != null ? intervalHours.toLocaleString() : '-';
  const doseValue = latestAdministration?.dose ?? null;
  const emphasizedDose = doseValue != null ? Number(doseValue).toLocaleString() : '-';
  const doseUnit = latestAdministration?.unit || 'mg';
  const intervalLabel = intervalHours != null ? `${intervalHours.toLocaleString()} 시간` : '투약 간격 정보 없음';
  const doseLabel = doseValue != null ? `${Number(doseValue).toLocaleString()}${doseUnit}` : '투약 용량 정보 없음';

  const targetHighlight = useMemo(
    () => getTdmTargetValue(tdmTarget, predictedAUC, predictedMax, predictedTrough, selectedDrug),
    [tdmTarget, predictedAUC, predictedMax, predictedTrough, selectedDrug]
  );

  const withinTargetRange = useMemo(
    () => isWithinTargetRange(tdmTarget, tdmTargetValue, predictedAUC, predictedMax, predictedTrough, selectedDrug),
    [tdmTarget, tdmTargetValue, predictedAUC, predictedMax, predictedTrough, selectedDrug]
  );

  const targetLabel = useMemo(
    () => tdmTarget?.split('(')[0]?.trim() || '',
    [tdmTarget]
  );

  // 차트 데이터셋 정의
  const datasets: ChartDataset[] = useMemo(() => {
    const result: ChartDataset[] = [
      {
        label: '현용법',
        dataKey: 'predicted',
        borderColor: '#3b82f6',
        borderWidth: 2
      },
      {
        label: '대조군',
        dataKey: 'controlGroup',
        borderColor: '#f97316',
        borderWidth: 2
      },
      {
        label: '실제 혈중 농도',
        dataKey: 'observed',
        borderColor: '#ef4444',
        backgroundColor: '#ef4444',
        pointRadius: 4,
        showLine: false
      }
    ];

    // 평균 농도 추가 (Vancomycin AUC 모드가 아닐 때)
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
  }, [selectedDrug, tdmTarget, averageConcentration]);

  return (
    <div className="w-full bg-white dark:bg-slate-900 rounded-lg p-6 shadow">
      {/* TDM Simulator 헤더 */}
      <div className="text-left mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
          <ChartColumnIncreasing className="w-8 h-8 text-blue-600" />
          {currentPatientName ? `${currentPatientName} 환자의 현용법 TDM 결과` : 'TDM 분석 결과'}
        </h1>
      </div>

      {/* TDM 결과 요약 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 text-gray-800 dark:text-gray-100">
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
          <span className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">
            투약 간격
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-gray-900 dark:text-white">
              {emphasizedInterval}
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
              {emphasizedDose}
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

      <div className="border-t border-gray-200 dark:border-gray-700 my-8"></div>

      {/* 그래프 해석 가이드 */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mt-6">
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

      {/* TDM Summary */}
      <TDMSummary
        selectedDrug={selectedDrug}
        tdmIndication={tdmIndication}
        tdmTarget={tdmTarget}
        tdmTargetValue={tdmTargetValue}
        latestAdministration={latestAdministration}
        recentAUC={recentAUC}
        recentMax={recentMax}
        recentTrough={recentTrough}
        predictedAUC={predictedAUC}
        predictedMax={predictedMax}
        predictedTrough={predictedTrough}
        commentTitle="TDM friends Comments"
      />
    </div>
  );
};

export default PKCharts;
