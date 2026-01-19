import { useMemo, useState, useEffect } from "react";
import { ChartColumnIncreasing } from "lucide-react";
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
  steadyState?: boolean | string;
  input_TOXI?: number;
  tauBefore?: number;
  amountBefore?: number;
  // 특이 케이스 코멘트용 props
  prescriptionAdditionalInfo?: string; // Prescription의 additionalInfo
  renalReplacement?: string; // BloodTest의 renalReplacement
  patientAge?: number; // Patient의 age
  currentCrCl?: number; // 현재 CrCl 값
  crclHistory?: Array<{ value: number; date: Date }>; // CrCl 히스토리 (48-72시간 내 데이터 비교용)
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
  drugAdministrations = [],
  steadyState,
  input_TOXI,
  tauBefore,
  amountBefore,
  prescriptionAdditionalInfo,
  renalReplacement,
  patientAge,
  currentCrCl,
  crclHistory = []
}: PKChartsProps) => {
  // 다크모드 감지
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });

  useEffect(() => {
    const updateDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    
    updateDarkMode();
    const observer = new MutationObserver(updateDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

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

  const predictedAUC: number | null = typeof propPredictedAUC === 'number' ? propPredictedAUC : null;
  const predictedMax: number | null = typeof propPredictedMax === 'number' ? propPredictedMax : null;
  const predictedTrough: number | null = typeof propPredictedTrough === 'number' ? propPredictedTrough : null;

  // tauBefore가 있으면 우선 사용 (API의 input_tau_before와 동일)
  // 없으면 latestAdministration의 intervalHours 사용 (하위 호환성)
  const intervalHours = tauBefore ?? latestAdministration?.intervalHours ?? null;
  const emphasizedInterval = intervalHours != null ? intervalHours.toLocaleString() : '-';
  
  // amountBefore가 있으면 우선 사용 (API의 input_amount_before와 동일)
  // 없으면 latestAdministration의 dose 사용 (하위 호환성)
  const doseValue = amountBefore ?? latestAdministration?.dose ?? null;
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

  // TDM 목표 유형 추출 (AUC, Max, Trough)
  const targetTypeLabel = useMemo(() => {
    if (!tdmTarget) return '';
    const target = tdmTarget.toLowerCase();
    if (target.includes('auc')) return 'AUC';
    if (target.includes('max') || target.includes('peak')) return 'Max';
    if (target.includes('trough')) return 'Trough';
    return '';
  }, [tdmTarget]);

  // 목표 범위 상태 판단 (초과/미달/도달) 및 퍼센트 계산
  const targetRangeStatus = useMemo(() => {
    if (!tdmTargetValue || !targetHighlight.numericValue) return null;
    
    const rangeMatch = tdmTargetValue.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
    if (!rangeMatch) return null;
    
    const minValue = parseFloat(rangeMatch[1]);
    const maxValue = parseFloat(rangeMatch[2]);
    const currentValue = targetHighlight.numericValue;
    
    if (currentValue > maxValue) {
      const percentOver = ((currentValue - maxValue) / maxValue) * 100;
      return `${percentOver.toFixed(0)}% 초과`;
    }
    if (currentValue < minValue) {
      const percentUnder = ((minValue - currentValue) / minValue) * 100;
      return `${percentUnder.toFixed(0)}% 미달`;
    }
    return '도달';
  }, [tdmTargetValue, targetHighlight.numericValue]);

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
        borderColor: isDarkMode ? '#9ca3af' : '#d1d5db', // 다크모드에서 더 밝은 회색
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
        borderColor: isDarkMode ? '#9ca3af' : '#6b7280', // 다크모드에서 더 밝은 회색
        borderDash: [5, 5],
        borderWidth: 2
      });
    }

    return result;
  }, [selectedDrug, tdmTarget, averageConcentration, isDarkMode]);

  return (
    <div className="w-full bg-white dark:bg-slate-900 rounded-lg p-6 shadow">
      {/* TDM Simulator 헤더 */}
      <div className="text-left mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
          <ChartColumnIncreasing className="w-8 h-8 text-blue-600" />
          {currentPatientName && selectedDrug ? `${currentPatientName} 환자의 ${selectedDrug} TDM 결과` : currentPatientName ? `${currentPatientName} 환자의 TDM 결과` : 'TDM 분석 결과'}
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
            TDM 목표
          </span>
          <div className="flex flex-col gap-2">
            {targetHighlight.numericValue != null && targetRangeStatus && (
              <div className="text-xl font-bold">
                <span
                  className={`${
                    withinTargetRange
                      ? 'text-blue-700 dark:text-blue-200'
                      : 'text-red-600 dark:text-red-300'
                  }`}
                >
                  {targetHighlight.value}
                </span>
                <span className="text-gray-900 dark:text-white">
                  {' '}으로 목표범위 {targetRangeStatus}
                </span>
              </div>
            )}
            <div className="text-sm text-gray-700 dark:text-gray-300">
              목표 범위 {targetTypeLabel} {tdmTargetValue || '-'}
            </div>
          </div>
        </div>

        <div
          className={`rounded-lg p-4 ${
            steadyState === undefined
              ? 'bg-gray-100 dark:bg-gray-800'
              : (typeof steadyState === 'boolean' ? steadyState : String(steadyState).toLowerCase() === 'true')
              ? 'bg-blue-100 dark:bg-blue-900/40'
              : 'bg-red-100 dark:bg-red-900/40'
          }`}
        >
          <span className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">
            항정 상태
          </span>
          <div className="text-2xl font-extrabold text-gray-900 dark:text-white">
            {steadyState === undefined 
              ? '-' 
              : (typeof steadyState === 'boolean' ? steadyState : String(steadyState).toLowerCase() === 'true')
              ? '도달'
              : '미도달'}
          </div>
        </div>
      </div>

      {/* 범례 */}
      <div className="flex justify-center flex-wrap gap-6 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-0.5 bg-blue-500"></div>
          <span className="text-sm text-muted-foreground">{currentPatientName || '환자'}님의 현 용법</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-0.5 bg-gray-300 dark:bg-gray-600"></div>
          <span className="text-sm text-muted-foreground">인구집단 평균</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
          <span className="text-sm text-muted-foreground">실제 혈중 농도</span>
        </div>
        {!(selectedDrug === 'Vancomycin' && tdmTarget?.toLowerCase().includes('auc')) && typeof averageConcentration === 'number' && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 border-dashed border-t-2 border-gray-500 dark:border-gray-400"></div>
            <span className="text-sm text-muted-foreground">평균 농도</span>
          </div>
        )}
        {typeof targetMin === 'number' && typeof targetMax === 'number' && targetMax > targetMin && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-4 bg-blue-500 bg-opacity-20 dark:bg-opacity-30"></div>
            <span className="text-sm text-muted-foreground">TDM 목표치</span>
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
        currentTime={currentTime}
        lastDoseColor="#3b82f6" // 파란색 점선
      />

      <div className="border-t border-gray-200 dark:border-gray-700 my-8"></div>

      {/* 그래프 해석 가이드 */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mt-6">
        <h3 className="font-semibold text-gray-800 dark:text-white mb-3">그래프 해석 Tip - 임의 작성된 내용입니다.</h3>
        <div className="space-y-2 text-sm text-muted-foreground">
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
      {(() => {
        // 특이 케이스 판단 로직
        // case1: CRRT 여부
        const isCRRT = /crrt/i.test(renalReplacement || "") || /crrt/i.test(prescriptionAdditionalInfo || "");
        
        // case2: 신독성 약물 복용 여부 ("네")
        const isNephrotoxicDrug = prescriptionAdditionalInfo === "네";
        
        // case3: 신기능 불안정 여부
        let isUnstableRenalFunction = false;
        if (currentCrCl !== undefined && currentCrCl < 60) {
          isUnstableRenalFunction = true;
        } else if (crclHistory.length >= 2) {
          // 48-72시간 이내 데이터 필터링
          const now = new Date();
          const recentCrclData = crclHistory.filter(item => {
            const hoursDiff = (now.getTime() - item.date.getTime()) / (1000 * 60 * 60);
            return hoursDiff >= 48 && hoursDiff <= 72;
          });
          
          if (recentCrclData.length >= 2) {
            // 최신 2개 값 비교
            const sorted = [...recentCrclData].sort((a, b) => b.date.getTime() - a.date.getTime());
            const latest = sorted[0].value;
            const previous = sorted[1].value;
            const diffPercent = Math.abs((latest - previous) / previous) * 100;
            if (diffPercent >= 20) {
              isUnstableRenalFunction = true;
            }
          }
        }
        
        // case4: 이식수술 후 초기 회복 단계 (POD ~2, POD 3~6)
        const isPostTransplantEarly = prescriptionAdditionalInfo === "POD ~2" || prescriptionAdditionalInfo === "POD 3~6";
        
        return (
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
            steadyState={steadyState}
            isCRRT={isCRRT}
            isNephrotoxicDrug={isNephrotoxicDrug}
            isUnstableRenalFunction={isUnstableRenalFunction}
            isPostTransplantEarly={isPostTransplantEarly}
            patientAge={patientAge}
          />
        );
      })()}
    </div>
  );
};

export default PKCharts;
