import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getConcentrationUnit, getTdmTargetValue, isWithinTargetRange, formatInt, formatFixed } from "./TDMChartUtils";

interface TDMSummaryProps {
  selectedDrug?: string;
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
  } | null; // 원래 값과 비교하기 위한 필드
  recentAUC?: number | null;
  recentMax?: number | null;
  recentTrough?: number | null;
  predictedAUC?: number | null;
  predictedMax?: number | null;
  predictedTrough?: number | null;
  commentTitle?: string; // "TDM friends Comments" 또는 "용법 조정 결과"
  currentResultTitle?: string; // 좌측 카드 제목 (기본: 현 시점 약동학 분석 결과)
  predictedResultTitle?: string; // 우측 카드 제목 (기본: 현 용법의 항정상태 예측 결과)
  showSteadyStateComment?: boolean; // 항정상태 조건부 문장 표시 여부 (기본: true)
  steadyState?: boolean | string; // Steady_state 값 (API 응답에서 받아옴, boolean 또는 문자열 "true"/"false")
  input_TOXI?: number; // 신독성 고위험군 여부 (1: 고위험군, 0 또는 undefined: 일반)
  isLoading?: boolean; // API 결과 로딩 중 여부
}

const TDMSummary = ({
  selectedDrug,
  tdmIndication,
  tdmTarget,
  tdmTargetValue,
  latestAdministration,
  originalAdministration,
  recentAUC,
  recentMax,
  recentTrough,
  predictedAUC,
  predictedMax,
  predictedTrough,
  commentTitle = "TDM friends Comments",
  currentResultTitle = "현 시점 약동학 분석 결과",
  predictedResultTitle = "현 용법의 항정상태 예측 결과",
  showSteadyStateComment = true,
  steadyState,
  input_TOXI,
  isLoading = false
}: TDMSummaryProps) => {
  const concentrationUnit = getConcentrationUnit(selectedDrug);
  // 로딩 중이거나 예측값이 없으면 "결과를 예측 중" 표시
  const isPredicting = isLoading || (predictedAUC == null && predictedMax == null && predictedTrough == null);
  const targetValue = isPredicting 
    ? { value: "결과를 예측 중", unit: "", numericValue: null }
    : getTdmTargetValue(tdmTarget, predictedAUC, predictedMax, predictedTrough, selectedDrug);
  const withinRange = isPredicting 
    ? false 
    : isWithinTargetRange(tdmTarget, tdmTargetValue, predictedAUC, predictedMax, predictedTrough, selectedDrug);
  
  // Steady_state가 문자열로 올 수 있으므로 boolean으로 변환
  const isSteadyState = typeof steadyState === 'boolean' 
    ? steadyState 
    : String(steadyState).toLowerCase() === 'true';
  
  // 변경된 값 확인
  const isDoseChanged = originalAdministration && latestAdministration && 
    originalAdministration.dose !== latestAdministration.dose;
  const isIntervalChanged = originalAdministration && latestAdministration && 
    originalAdministration.intervalHours !== latestAdministration.intervalHours;

  const intervalValueText =
    latestAdministration?.intervalHours != null
      ? latestAdministration.intervalHours.toLocaleString()
      : "-";
  const doseValueText =
    latestAdministration?.dose != null
      ? `${Number(latestAdministration.dose).toLocaleString()}${latestAdministration.unit || "mg"}`
      : "-";
  const hasInterval = intervalValueText !== "-";
  const hasDose = doseValueText !== "-";
  const intervalDisplay = hasInterval ? `${intervalValueText} 시간` : "-";
  const doseDisplay = doseValueText;
  const intervalLabel = hasInterval ? `${intervalValueText} 시간` : "투약 간격 정보 없음";
  const doseLabel = hasDose ? doseValueText : "투약 용량 정보 없음";

  // 목표 범위 상태 판단 (초과/도달/미달)
  const getTargetRangeStatus = (): string => {
    if (!tdmTargetValue || !targetValue.numericValue) return '도달';
    
    // 다양한 범위 형식 지원: "400-600", "400 - 600", "400~600" 등
    const rangeMatch = tdmTargetValue.match(/(\d+(?:\.\d+)?)\s*[-~–]\s*(\d+(?:\.\d+)?)/);
    if (!rangeMatch) return '도달';
    
    const minValue = parseFloat(rangeMatch[1]);
    const maxValue = parseFloat(rangeMatch[2]);
    const currentValue = targetValue.numericValue;
    
    if (currentValue > maxValue) return '초과';
    if (currentValue < minValue) return '미달';
    return '도달';
  };

  const targetRangeStatus = getTargetRangeStatus();

  const cyclosporinTroughWarningThresholds: Record<string, number> = {
    "Renal transplant recipients/Korean": 10,
    "Allo-HSCT/Korean": 50,
    "Thoracic transplant recipients/European": 20
  };

  // 신독성 고위험군 추가 문구 생성 (도달 케이스에서만)
  const getToxicityWarningText = (): string | null => {
    // 도달 케이스가 아니면 null 반환
    const status = getTargetRangeStatus();
    if (status !== '도달') return null;
    
    // input_TOXI가 1이 아니면 null 반환
    if (input_TOXI !== 1) return null;
    
    // 필수 값 체크
    if (!tdmTargetValue || targetValue.numericValue == null) return null;
    
    // 다양한 범위 형식 지원: "400-600", "400 - 600", "400~600", "400–600" 등
    // 중간점(·)이나 다른 특수문자가 있어도 숫자 범위를 추출
    const rangeMatch = tdmTargetValue.match(/(\d+(?:\.\d+)?)\s*[-~–]\s*(\d+(?:\.\d+)?)/);
    if (!rangeMatch) return null;
    
    const maxValue = parseFloat(rangeMatch[2]);
    const currentValue = targetValue.numericValue;
    
    // 유효하지 않은 값 체크
    if (!Number.isFinite(maxValue) || !Number.isFinite(currentValue)) return null;
    
    const diffFromMax = maxValue - currentValue;
    
    // 반코마이신 + AUC: 100 이내
    const isVancomycinAUC = selectedDrug === 'Vancomycin' && 
      (tdmTarget?.toLowerCase().includes('auc') || tdmTarget?.toLowerCase().includes('auc24'));
    
    if (isVancomycinAUC) {
      if (diffFromMax <= 100 && diffFromMax >= 0) {
        return "환자가 신독성 약물을 복용 중인 경우, 예측 결과가 목표 범위 상한에 가까운 노출임을 고려하여 임상의 재량에 따라 보수적 감량 여부를 검토할 수 있습니다.";
      }
    }
    
    // 사이클로스포린 + Trough: 적응증별 상한 근접 기준
    if (selectedDrug === 'Cyclosporin' && tdmTarget?.toLowerCase().includes('trough')) {
      const normalizedIndication = (tdmIndication || '').trim();
      const indicationThreshold = cyclosporinTroughWarningThresholds[normalizedIndication] ?? 50;
      if (diffFromMax <= indicationThreshold && diffFromMax >= 0) {
        return "환자가 신독성 고위험군인 경우, 상한에 가까운 노출임을 고려하여 임상의 재량에 따라 보수적 감량 여부를 검토할 수 있습니다.";
      }
    }
    
    return null;
  };

  // 목표 범위 초과/미달 판단 및 조건부 문장 생성
  const getRecommendationText = (): string | null => {
    if (!tdmTargetValue || !targetValue.numericValue) return null;
    
    const status = getTargetRangeStatus();
    
    if (status === '도달') {
      return "예측 결과가 목표범위 내에 있어 현 용법 유지를 권장합니다.";
    }
    
    if (status === '미달') {
      return "현 용법으로는 목표범위에 도달하기 어려운 저노출 상태입니다. 현 용법 대비 용량 증가 또는 투약 간격 단축을 권장합니다.";
    }
    
    if (status === '초과') {
      return "현 용법으로는 목표범위를 초과하는 과노출 상태입니다. 현 용법 대비 용량 감량 혹은 투약 간격 확대를 권장합니다.";
    }
    
    return null;
  };

  const recommendationText = getRecommendationText();
  const toxicityWarningText = getToxicityWarningText();

  return (
    <div className="bg-gray-100 dark:bg-gray-800/40 rounded-lg p-6 mb-6 mt-4">
      <h2 className="text-xl font-bold text-blue-800 dark:text-blue-200 mb-4 flex items-center gap-2">
        TDM Summary
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* 최신 혈중 약물 농도 */}
        <Card className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-gray-800 dark:text-gray-200">{currentResultTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">AUC:</span>
              <span className="font-semibold text-gray-900 dark:text-white">{formatInt(recentAUC ?? null, 'mg*h/L')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">max 농도:</span>
              <span className="font-semibold text-gray-900 dark:text-white">{formatFixed(recentMax ?? null, concentrationUnit)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">trough 농도:</span>
              <span className="font-semibold text-gray-900 dark:text-white">{formatFixed(recentTrough ?? null, concentrationUnit)}</span>
            </div>
          </CardContent>
        </Card>

        {/* 예측 약물 농도 */}
        <Card className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-gray-800 dark:text-gray-200">{predictedResultTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">AUC:</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {isPredicting ? "결과를 예측 중" : formatInt(predictedAUC ?? null, 'mg*h/L')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">max 농도:</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {isPredicting ? "결과를 예측 중" : formatFixed(predictedMax ?? null, concentrationUnit)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">trough 농도:</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {isPredicting ? "결과를 예측 중" : formatFixed(predictedTrough ?? null, concentrationUnit)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Comments / 용법 조정 결과 */}
      {commentTitle && (
        <Card className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-gray-900 dark:text-white flex items-center gap-2">
              {commentTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
          {/* 항정상태 조건부 문장 (옵션) */}
          {showSteadyStateComment && steadyState !== undefined && (
            <div className="leading-relaxed">
              {isSteadyState ? (
                null
                // {/* <p className="text-base font-bold text-black dark:text-white">현재 항정상태에 도달하였습니다.</p> */}
              ) : (
                <>
                  <p className="text-base font-bold text-black dark:text-white">항정 상태에 아직 도달하지 않은 상태입니다.</p>
                  <p className="text-base font-bold text-black dark:text-white">항정 상태에 도달한 후 약동학 파라미터를 산출할 때 정확도가 올라갑니다.</p>

                </>
              )}
            </div>
          )}
          <div className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 bg-gray-800 dark:bg-gray-200 rounded-full mt-2 flex-shrink-0"></div>
            <p className="leading-relaxed">
              {tdmIndication || '적응증'}의 {selectedDrug || '약물명'} 처방 시 TDM 목표는{' '}
              <span className="font-semibold text-gray-900 dark:text-white">
                {tdmTarget || '목표 유형'} ({tdmTargetValue || '목표값'})
              </span>입니다.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 bg-gray-800 dark:bg-gray-200 rounded-full mt-2 flex-shrink-0"></div>
            <p className="leading-relaxed">
              {isPredicting ? (
                <span className="font-semibold text-gray-600 dark:text-gray-400">결과를 예측 중입니다...</span>
              ) : (
                <>
                  현 용법의 항정상태 {' '}
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {tdmTarget || '목표 유형'}
                  </span>는{' '}
                  <span className={withinRange ? "font-semibold text-blue-600 dark:text-blue-200" : "font-semibold text-red-600 dark:text-red-400"}>
                    {targetValue.value}
                  </span>으로{' '}
                  목표 범위를{' '}
                  <span className={targetRangeStatus === '도달' ? "font-bold text-gray-900 dark:text-white" : "font-bold text-red-600 dark:text-red-400"}>
                    {targetRangeStatus}
                  </span>할 것으로 예측됩니다.
                </>
              )}
            </p>
          </div>
          {/* 조건부 추천 문장 */}
          {recommendationText && (
            <div className="flex items-start gap-2 mt-3">
              <div className="w-1.5 h-1.5 bg-gray-800 dark:bg-gray-200 rounded-full mt-2 flex-shrink-0"></div>
              <p className="leading-relaxed">
                {recommendationText}
              </p>
            </div>
          )}
          {/* 신독성 고위험군 추가 문구 */}
          {toxicityWarningText && (
            <div className="flex items-start gap-2 mt-3">
              <div className="w-1.5 h-1.5 bg-gray-800 dark:bg-gray-200 rounded-full mt-2 flex-shrink-0"></div>
              <p className="leading-relaxed">
                {toxicityWarningText}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      )}

    
    </div>
  );
};

export default TDMSummary;

