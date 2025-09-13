import { useState } from "react";
import { Patient, Prescription, BloodTest, DrugAdministration } from "@/pages/Index";
import { ChevronDown, ChevronUp } from "lucide-react";

interface TDMPatientDetailsProps {
  currentPatient: Patient | null;
  selectedPrescription: Prescription | null;
  latestBloodTest: BloodTest | null;
  drugAdministrations?: DrugAdministration[];
}

const TDMPatientDetails = ({ 
  currentPatient, 
  selectedPrescription, 
  latestBloodTest,
  drugAdministrations = []
}: TDMPatientDetailsProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // 투약기록 데이터 계산
  const patientDrugAdministrations = drugAdministrations.filter(d => d.patientId === currentPatient?.id);
  const latestAdministration = patientDrugAdministrations.length > 0 
    ? [...patientDrugAdministrations].sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime())[patientDrugAdministrations.length - 1]
    : null;
  const firstAdministration = patientDrugAdministrations.length > 0 
    ? [...patientDrugAdministrations].sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime())[0]
    : null;
  
  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg p-6 shadow mb-6 border border-gray-200 dark:border-gray-700">
      <div 
        className="flex items-center justify-between cursor-pointer mb-4"
        onClick={() => setIsExpanded(!isExpanded)}
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
              <div className="text-sm text-muted-foreground">추가정보</div>
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

          {/* 처방 내역 섹션 */}
          <div className="space-y-3">
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">처방 내역</div>
            <div className="grid grid-cols-5 gap-4">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">처방 용량</div>
              <div className="font-medium">
                {selectedPrescription ? 
                  `${selectedPrescription.dosage}${selectedPrescription.unit}` : 
                  'N/A'
                }
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">투약 간격</div>
              <div className="font-medium">
                {selectedPrescription?.frequency ? 
                  `${selectedPrescription.frequency}` : 
                  'N/A'
                }
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">투약 경로</div>
              <div className="font-medium">
                {latestAdministration ? 
                  `${latestAdministration.route}${latestAdministration.infusionTime ? ` (${latestAdministration.infusionTime}분)` : ''}` : 
                  'N/A'
                }
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">투약횟수</div>
              <div className="font-medium">
                {patientDrugAdministrations.length > 0 ? 
                  `${patientDrugAdministrations.length}회` : 
                  'N/A'
                }
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">투약 시작 일시</div>
              <div className="font-medium">
                {firstAdministration ? 
                  `${firstAdministration.date} ${firstAdministration.time}` : 
                  'N/A'
                }
              </div>
            </div>
            </div>
          </div>

          {/* 신 기능 데이터 섹션 */}
          <div className="space-y-3">
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">신 기능 데이터</div>
            <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">혈청 크레아티닌</div>
              <div className="font-medium">
                {latestBloodTest?.creatinine ? 
                  `CCr-CG = ${latestBloodTest.creatinine} mL/min` : 
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
                {/* 임시 데이터: 빈값으로 설정, 추후 백엔드에서 연결 예정 */}
                {latestBloodTest?.dialysis === 'Y' && latestBloodTest?.renalReplacement === 'CRRT' ? 
                  '고위험군' : 
                  ''
                }
              </div>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TDMPatientDetails;
