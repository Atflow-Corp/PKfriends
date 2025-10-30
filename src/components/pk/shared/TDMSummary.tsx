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
  recentAUC?: number | null;
  recentMax?: number | null;
  recentTrough?: number | null;
  predictedAUC?: number | null;
  predictedMax?: number | null;
  predictedTrough?: number | null;
  commentTitle?: string; // "TDM friends Comments" 또는 "용법 조정 결과"
}

const TDMSummary = ({
  selectedDrug,
  tdmIndication,
  tdmTarget,
  tdmTargetValue,
  latestAdministration,
  recentAUC,
  recentMax,
  recentTrough,
  predictedAUC,
  predictedMax,
  predictedTrough,
  commentTitle = "TDM friends Comments"
}: TDMSummaryProps) => {
  const concentrationUnit = getConcentrationUnit(selectedDrug);
  const targetValue = getTdmTargetValue(tdmTarget, predictedAUC, predictedMax, predictedTrough, selectedDrug);
  const withinRange = isWithinTargetRange(tdmTarget, tdmTargetValue, predictedAUC, predictedMax, predictedTrough, selectedDrug);

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 mb-6 border border-blue-200 dark:border-blue-800 mt-4">
      <h2 className="text-xl font-bold text-blue-800 dark:text-blue-200 mb-4 flex items-center gap-2">
        TDM Summary
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* 최신 혈중 약물 농도 */}
        <Card className="bg-white border-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-gray-800">최신 혈중 약물 농도</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-600">AUC:</span>
              <span className="font-semibold">{formatInt(recentAUC ?? null, 'mg*h/L')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">max 농도:</span>
              <span className="font-semibold">{formatFixed(recentMax ?? null, concentrationUnit)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">trough 농도:</span>
              <span className="font-semibold">{formatFixed(recentTrough ?? null, concentrationUnit)}</span>
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
              <span className="font-semibold">{formatInt(predictedAUC ?? null, 'mg*h/L')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">max 농도:</span>
              <span className="font-semibold">{formatFixed(predictedMax ?? null, concentrationUnit)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">trough 농도:</span>
              <span className="font-semibold">{formatFixed(predictedTrough ?? null, concentrationUnit)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Comments / 용법 조정 결과 */}
      <Card className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-blue-800 dark:text-blue-200 flex items-center gap-2">
            {commentTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
          <div className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 bg-gray-800 dark:bg-gray-200 rounded-full mt-2 flex-shrink-0"></div>
            <p className="leading-relaxed">
              {tdmIndication || '적응증'}의 {selectedDrug || '약물명'} 처방 시 TDM 목표는{' '}
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {tdmTarget || '목표 유형'} ({tdmTargetValue || '목표값'})
              </span>입니다.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 bg-gray-800 dark:bg-gray-200 rounded-full mt-2 flex-shrink-0"></div>
            <p className="leading-relaxed">
              <span className="font-semibold">
                현 용법 {latestAdministration?.intervalHours || '시간'} 간격으로{' '}
                {latestAdministration?.dose || 0}{latestAdministration?.unit || 'mg'} 투약 시
              </span>{' '}
              Steady State까지 TDM 목표{' '}
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {tdmTarget || '목표 유형'}
              </span>는{' '}
              <span className="font-semibold text-red-600 dark:text-red-400">
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
    </div>
  );
};

export default TDMSummary;

