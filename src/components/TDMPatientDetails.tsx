import { useState, useEffect, useMemo } from "react";
import { Patient, Prescription, BloodTest, DrugAdministration } from "@/pages/Index";
import { ChevronDown, ChevronUp } from "lucide-react";

interface TDMPatientDetailsProps {
  currentPatient: Patient | null;
  selectedPrescription: Prescription | null;
  latestBloodTest: BloodTest | null;
  drugAdministrations?: DrugAdministration[];
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
  disableHover?: boolean;
}

const TDMPatientDetails = ({ 
  currentPatient, 
  selectedPrescription, 
  latestBloodTest,
  drugAdministrations = [],
  isExpanded: externalIsExpanded,
  onToggleExpanded,
  disableHover = false
}: TDMPatientDetailsProps) => {
  const [internalIsExpanded, setInternalIsExpanded] = useState(false);
  
  // 외부에서 isExpanded를 제어하는 경우 외부 값을 사용, 아니면 내부 상태 사용
  const isExpanded = externalIsExpanded !== undefined ? externalIsExpanded : internalIsExpanded;
  const setIsExpanded = onToggleExpanded || setInternalIsExpanded;
  
  // 투약기록 데이터 계산
  const patientDrugAdministrations = drugAdministrations.filter(d => 
    d.patientId === currentPatient?.id && 
    d.drugName === selectedPrescription?.drugName
  );
  const latestAdministration = patientDrugAdministrations.length > 0 
    ? [...patientDrugAdministrations].sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime())[patientDrugAdministrations.length - 1]
    : null;
  const firstAdministration = patientDrugAdministrations.length > 0 
    ? [...patientDrugAdministrations].sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime())[0]
    : null;

  // localStorage에서 저장된 처방 내역 conditions 가져오기 (시계열상 과거부터 정렬)
  const prescriptionConditions = useMemo(() => {
    if (!currentPatient?.id || !selectedPrescription?.drugName) return [];
    
    const storageKey = `tdmfriends:conditions:${currentPatient.id}:${selectedPrescription.drugName}`;
    try {
      const savedConditions = localStorage.getItem(storageKey);
      if (savedConditions) {
        const conditions = JSON.parse(savedConditions);
        
        // 시계열상 과거부터 정렬 (firstDoseDate와 firstDoseTime 기준)
        return [...conditions].sort((a, b) => {
          // 날짜와 시간이 모두 있는 경우만 정렬
          if (!a.firstDoseDate || !a.firstDoseTime || !b.firstDoseDate || !b.firstDoseTime) {
            // 날짜/시간이 없는 항목은 뒤로
            if (!a.firstDoseDate || !a.firstDoseTime) return 1;
            if (!b.firstDoseDate || !b.firstDoseTime) return -1;
            return 0;
          }
          
          // 날짜와 시간을 결합하여 비교
          const dateTimeA = new Date(`${a.firstDoseDate}T${a.firstDoseTime}`).getTime();
          const dateTimeB = new Date(`${b.firstDoseDate}T${b.firstDoseTime}`).getTime();
          
          return dateTimeA - dateTimeB; // 오름차순 (과거 → 현재)
        });
      }
    } catch (error) {
      console.error('Failed to restore conditions from localStorage:', error);
    }
    return [];
  }, [currentPatient?.id, selectedPrescription?.drugName]);

  // 처방 내역 summary 생성 함수
  const getConditionSummary = (condition: any) => {
    if (!condition.firstDoseDate || !condition.firstDoseTime) {
      return "날짜와 시간을 입력해주세요";
    }
    
    // 약물명
    const drugName = selectedPrescription?.drugName || "약물";
    
    // 용량과 단위
    const unitText = condition.unit ? condition.unit : "mg";
    const dosageText = condition.dosage ? `${condition.dosage} ${unitText}` : `0 ${unitText}`;
    
    // 투약 경로 변환 (경구 -> PO, 정맥 -> IV)
    let routeText = "";
    if (condition.route === "경구" || condition.route === "oral") {
      routeText = "PO";
      // 경구 투약이고 dosageForm이 있는 경우 함께 표시
      if (condition.dosageForm) {
        const formLabel = condition.dosageForm === "capsule/tablet" ? "Cap/Tab" : 
                         condition.dosageForm === "oral liquid" ? "현탁/액제" : 
                         condition.dosageForm;
        routeText = `PO (${formLabel})`;
      }
    } else if (condition.route === "정맥" || condition.route === "IV") {
      routeText = "IV";
      // 정맥 투약이고 주입시간이 있는 경우 함께 표시
      if (condition.injectionTime && condition.injectionTime !== "-" && condition.injectionTime !== "") {
        routeText = `IV (${condition.injectionTime}분 주입)`;
      }
    } else {
      routeText = condition.route || "-";
    }
    
    // 간격 (12h 간격 형식)
    const intervalText = condition.intervalHours ? `${condition.intervalHours}h 간격` : "간격 정보 없음";
    
    // 총 횟수
    const dosesText = condition.totalDoses ? `총 ${condition.totalDoses}회` : "횟수 정보 없음";
    
    // 시작 날짜/시간
    const startDate = condition.firstDoseDate || "날짜 정보 없음";
    const startTime = condition.firstDoseTime || "";
    const startDateTime = `${startDate} ${startTime}`;

    // 형식: 약물명 용량 단위 | 투약경로 (제형정보 또는 주입시간) | 간격 | 총 횟수 (시작: 날짜 시간)
    return `${drugName} ${dosageText} | ${routeText} | ${intervalText} | ${dosesText} (시작: ${startDateTime})`.trim();
  };

  // localStorage에서 저장된 신기능 데이터 가져오기
  const renalInfo = useMemo(() => {
    if (!currentPatient?.id || !selectedPrescription?.drugName) return null;
    
    const storageKey = `tdmfriends:renal:${currentPatient.id}:${selectedPrescription.drugName}`;
    try {
      const savedRenalInfo = localStorage.getItem(storageKey);
      if (savedRenalInfo) {
        const renalInfoList = JSON.parse(savedRenalInfo) as Array<{
          id: string;
          creatinine: string;
          date: string;
          formula: string;
          result: string;
          isSelected?: boolean;
        }>;
        
        // 선택된 항목이 있으면 선택된 항목, 없으면 가장 최근 항목 반환
        const selected = renalInfoList.find(r => r.isSelected);
        if (selected) return selected;
        
        // 날짜 기준으로 정렬하여 가장 최근 항목 반환
        if (renalInfoList.length > 0) {
          const sorted = [...renalInfoList].sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            return dateB - dateA; // 최신순
          });
          return sorted[0];
        }
      }
    } catch (error) {
      console.error('Failed to restore renal info from localStorage:', error);
    }
    return null;
  }, [currentPatient?.id, selectedPrescription?.drugName]);

  // 계산식 한글 변환 함수
  const getFormulaName = (formula: string): string => {
    switch (formula) {
      case 'cockcroft-gault':
        return 'Cockcroft-Gault';
      case 'mdrd':
        return 'MDRD';
      case 'ckd-epi':
        return 'CKD-EPI';
      default:
        return formula;
    }
  };
  
  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg p-6 shadow mb-6 border border-gray-200 dark:border-gray-700">
      <div 
        className={`flex items-center justify-between mb-4 ${!disableHover ? 'cursor-pointer' : ''}`}
        onClick={!disableHover ? () => setIsExpanded(!isExpanded) : undefined}
      >
        <div className="text-md">{currentPatient?.name || '환자'} 환자의 정보 보기</div>
        <div className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </div>
      </div>
      {isExpanded && (
        <div className="space-y-4 p-4">
          {/* 환자 정보 섹션 */}
          <div className="space-y-3">
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">환자 정보</div>
            <div className="grid grid-cols-7 gap-4">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">나이</div>
              <div className="font-medium">
                {currentPatient?.age ? `${currentPatient.age}` : 'N/A'}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">생년월일</div>
              <div className="font-medium">
                {currentPatient?.birthDate ? 
                  new Date(currentPatient.birthDate).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                  }).replace(/\./g, '.').replace(/\s/g, '') : 
                  'N/A'
                }
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">성별</div>
              <div className="font-medium">
                {currentPatient?.gender
                  ? currentPatient.gender === "male"
                    ? "남성"
                    : currentPatient.gender === "female"
                      ? "여성"
                      : "-"
                  : "N/A"}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">체중</div>
              <div className="font-medium">
                {currentPatient?.weight ? `${currentPatient.weight}kg` : 'N/A'}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">신장</div>
              <div className="font-medium">
                {currentPatient?.height ? `${currentPatient.height}cm` : 'N/A'}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">BMI</div>
              <div className="font-medium">
                {currentPatient?.weight && currentPatient?.height ? 
                  (currentPatient.weight / Math.pow(currentPatient.height / 100, 2)).toFixed(1) : 
                  'N/A'
                }
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">BSA</div>
              <div className="font-medium">
                {currentPatient?.weight && currentPatient?.height ? 
                  Math.sqrt((currentPatient.height * currentPatient.weight) / 3600).toFixed(2) : 
                  'N/A'
                }
              </div>
            </div>
            </div>
          </div>

          {/* TDM 내역 섹션 */}
          <div className="space-y-3">
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">TDM 내역</div>
            <div className="grid grid-cols-4 gap-4">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">약물 정보</div>
              <div className="font-medium">
                {selectedPrescription?.drugName || 'N/A'}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">적응증</div>
              <div className="font-medium">{selectedPrescription?.indication || 'N/A'}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">추가 정보</div>
              <div className="font-medium">{selectedPrescription?.additionalInfo || '-'}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">TDM 목표치</div>
              <div className="font-medium">
                {selectedPrescription?.tdmTarget && selectedPrescription?.tdmTargetValue ? 
                  `${selectedPrescription.tdmTarget}: ${selectedPrescription.tdmTargetValue}` : 
                  'N/A'
                }
              </div>
            </div>
            </div>
          </div>

          {/* 신 기능 데이터 섹션 */}
          <div className="space-y-3">
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">신기능 데이터</div>
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">검사일자</div>
                <div className="font-medium">
                  {renalInfo?.date ? 
                    renalInfo.date : 
                    <span className="text-gray-400 italic">미입력</span>
                  }
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">혈청 크레아티닌</div>
                <div className="font-medium">
                  {renalInfo?.creatinine ? 
                    `${renalInfo.creatinine} mg/dL` : 
                    <span className="text-gray-400 italic">미입력</span>
                  }
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">계산식</div>
                <div className="font-medium">
                  {renalInfo?.formula ? 
                    getFormulaName(renalInfo.formula) : 
                    <span className="text-gray-400 italic">미입력</span>
                  }
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">결과값</div>
                <div className="font-medium">
                  {renalInfo?.result ? 
                    renalInfo.result : 
                    <span className="text-gray-400 italic">미입력</span>
                  }
                </div>
              </div>
            </div>
          </div>

          {/* 처방 내역 섹션 */}
          <div className="space-y-3">
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">처방 내역</div>
            {prescriptionConditions.length > 0 ? (
              <div className="space-y-1">
                {prescriptionConditions.map((condition: any, index: number) => (
                  <div 
                    key={condition.id || index} 
                    className="py-1"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 min-w-[60px]">
                        기록 {index + 1}:
                      </span>
                      <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                        {getConditionSummary(condition)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                처방내역을 찾을 수 없습니다. 투약 기록 단계로 돌아가 다시 작성해주세요.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TDMPatientDetails;
