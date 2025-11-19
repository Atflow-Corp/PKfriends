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
  steadyState
}: TDMSummaryProps) => {
  const concentrationUnit = getConcentrationUnit(selectedDrug);
  const targetValue = getTdmTargetValue(tdmTarget, predictedAUC, predictedMax, predictedTrough, selectedDrug);
  const withinRange = isWithinTargetRange(tdmTarget, tdmTargetValue, predictedAUC, predictedMax, predictedTrough, selectedDrug);
  
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

  return (
    <div className="bg-gray-100 dark:bg-gray-800/40 rounded-lg p-6 mb-6 mt-4">
      <h2 className="text-xl font-bold text-blue-800 dark:text-blue-200 mb-4 flex items-center gap-2">
        TDM Summary
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* 최신 혈중 약물 농도 */}
        <Card className="bg-white border-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-gray-800">{currentResultTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-600">AUC:</span>
              <span className="font-semibold text-gray-900 dark:text-white">{formatInt(recentAUC ?? null, 'mg*h/L')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">max 농도:</span>
              <span className="font-semibold text-gray-900 dark:text-white">{formatFixed(recentMax ?? null, concentrationUnit)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">trough 농도:</span>
              <span className="font-semibold text-gray-900 dark:text-white">{formatFixed(recentTrough ?? null, concentrationUnit)}</span>
            </div>
          </CardContent>
        </Card>

        {/* 예측 약물 농도 */}
        <Card className="bg-white border-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-gray-800">{predictedResultTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-600">AUC:</span>
              <span className="font-semibold text-gray-900 dark:text-white">{formatInt(predictedAUC ?? null, 'mg*h/L')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">max 농도:</span>
              <span className="font-semibold text-gray-900 dark:text-white">{formatFixed(predictedMax ?? null, concentrationUnit)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">trough 농도:</span>
              <span className="font-semibold text-gray-900 dark:text-white">{formatFixed(predictedTrough ?? null, concentrationUnit)}</span>
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
                <p className="text-base font-bold text-black dark:text-white">현재 항정상태에 도달하였습니다.</p>
              ) : (
                <>
                  <p className="text-base font-bold text-black dark:text-white">항정 상태에 아직 도달하지 않은 상태입니다.</p>
                  <p className="text-base font-bold text-black dark:text-white">항정상태에 도달한 후 약동학 파라미터를 산출할 때 정확도가 올라갑니다.</p>
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
              <span className="font-semibold text-gray-900 dark:text-white">
                <span className={isIntervalChanged ? "text-red-600 dark:text-red-400" : ""}>
                  {intervalLabel}
                </span>
                {' '}간격으로{' '}
                <span className={isDoseChanged ? "text-red-600 dark:text-red-400" : ""}>
                  {doseLabel}
                </span>{' '}
                투약 시
              </span>{' '}
              Steady State까지 TDM 목표{' '}
              <span className="font-semibold text-gray-900 dark:text-white">
                {tdmTarget || '목표 유형'}
              </span>는{' '}
              <span className={withinRange ? "font-semibold text-blue-600 dark:text-blue-200" : "font-semibold text-red-600 dark:text-red-400"}>
                {targetValue.value}
              </span>으로{' '}
              {withinRange ? (
                <>적절한 용법입니다.</>
              ) : (
                <>치료 범위를 벗어납니다.</>
              )}
            </p>
          </div>
        </CardContent>
      </Card>
      )}

    
    </div>
  );
};

export default TDMSummary;

