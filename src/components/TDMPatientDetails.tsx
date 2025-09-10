import { useState } from "react";
import { Patient, Prescription, BloodTest } from "@/pages/Index";
import { ChevronDown, ChevronUp } from "lucide-react";

interface TDMPatientDetailsProps {
  currentPatient: Patient | null;
  selectedPrescription: Prescription | null;
  latestBloodTest: BloodTest | null;
}

const TDMPatientDetails = ({ 
  currentPatient, 
  selectedPrescription, 
  latestBloodTest 
}: TDMPatientDetailsProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg p-6 shadow mb-6 border border-gray-200 dark:border-gray-700">
      <div 
        className="flex items-center justify-between cursor-pointer mb-4"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="text-md">{currentPatient?.name || '환자'} 환자의 TDM 상세 정보 보기</div>
        <div className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </div>
      </div>
      {isExpanded && (
        <div className="space-y-4 p-4">
          {/* 1행: 나이, 성별, 체중, 신장, BMI, BSA */}
          <div className="grid grid-cols-6 gap-4">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">나이</div>
              <div className="font-medium">
                {currentPatient?.age ? `${currentPatient.age}세` : 'N/A'}
                {currentPatient?.createdAt ? 
                  ` (${new Date(currentPatient.createdAt).toLocaleDateString('ko-KR')})` : 
                  ''
                }
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">성별</div>
              <div className="font-medium">{currentPatient?.gender || 'N/A'}</div>
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

          {/* 2행: 약물정보, 처방용량, 적응증, TDM목표 */}
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">약물 정보</div>
              <div className="font-medium">
                {selectedPrescription?.drugName || 'N/A'}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">처방용량</div>
              <div className="font-medium">
                {selectedPrescription ? 
                  `${selectedPrescription.dosage}${selectedPrescription.unit}` : 
                  'N/A'
                }
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">적응증</div>
              <div className="font-medium">{selectedPrescription?.indication || 'N/A'}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">TDM목표</div>
              <div className="font-medium">
                {selectedPrescription?.tdmTarget ? 
                  `${selectedPrescription.tdmTarget} (${selectedPrescription.tdmTargetValue || 'N/A'})` : 
                  'N/A'
                }
              </div>
            </div>
          </div>

          {/* 3행: 혈청크레아티닌, 투석정보, 모니터링 레벨 */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">혈청 크레아티닌</div>
              <div className="font-medium">
                {latestBloodTest?.creatinine ? 
                  `eGFR = ${latestBloodTest.creatinine}` : 
                  '-'
                }
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">투석 정보</div>
              <div className="font-medium">
                {latestBloodTest?.dialysis === 'Y' ? 
                  latestBloodTest?.renalReplacement || '-' : 
                  '-'
                }
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">모니터링 레벨</div>
              <div className="font-medium">
                {/* 임시작업: 투석 여부와 신 대체요법에 따른 모니터링 레벨 분류 */}
                {latestBloodTest?.dialysis === 'Y' && latestBloodTest?.renalReplacement === 'CRRT' ? 
                  '고위험군' : 
                  '일반'
                }
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TDMPatientDetails;
