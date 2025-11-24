import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Patient } from "@/pages/Index";
import { User, ArrowRight, CheckCircle } from "lucide-react";
import PatientInformation from "@/components/PatientInformation";

interface PatientStepProps {
  patients: Patient[];
  selectedPatient: Patient | null;
  setSelectedPatient: (patient: Patient | null) => void;
  onAddPatient: (patient: Patient) => void;
  onUpdatePatient: (patient: Patient) => void;
  onDeletePatient: (patientId: string) => void;
  onNext: () => void;
  isCompleted: boolean;
}

const PatientStep = ({
  patients,
  selectedPatient,
  setSelectedPatient,
  onAddPatient,
  onUpdatePatient,
  onDeletePatient,
  onNext,
  isCompleted
}: PatientStepProps) => {
  return (
    <div className="space-y-6">
      {/* Step 1: Patient Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            1단계: 환자 선택
            {isCompleted && <CheckCircle className="h-5 w-5 text-green-600" />}
          </CardTitle>
          <CardDescription>
            기존 환자를 선택하거나 신규 환자를 등록하세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* PatientInformation 컴포넌트 호출 */}
          <PatientInformation
            onAddPatient={onAddPatient}
            onUpdatePatient={onUpdatePatient}
            onDeletePatient={onDeletePatient}
            patients={patients}
            selectedPatient={selectedPatient}
            setSelectedPatient={setSelectedPatient}
            showHeader={false}
          />

          {/* Selected Patient Info */}
          {selectedPatient && (
            <Card className="border-[#8EC5FF] bg-[#EFF6FF]">
              <CardHeader>
                <CardTitle className="text-[#1C398E]">환자 상세정보</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">이름</p>
                    <p className="text-sm text-foreground">{selectedPatient.name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">생년월일</p>
                    <p className="text-sm text-foreground">{selectedPatient.birthDate}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">나이</p>
                    <p className="text-sm text-foreground">{selectedPatient.age}세</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">성별</p>
                    <p className="text-sm text-foreground">{selectedPatient.gender === "male" ? "남성" : selectedPatient.gender === "female" ? "여성" : "기타"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">체중</p>
                    <p className="text-sm text-foreground">{selectedPatient.weight} kg</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">신장</p>
                    <p className="text-sm text-foreground">{selectedPatient.height} cm</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">BMI</p>
                    <p className="text-sm text-foreground">
                      {(selectedPatient.weight && selectedPatient.height ? (selectedPatient.weight / Math.pow(selectedPatient.height / 100, 2)).toFixed(1) : "-")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">BSA</p>
                    <p className="text-sm text-foreground">
                      {(selectedPatient.weight && selectedPatient.height ? Math.sqrt((selectedPatient.weight * selectedPatient.height) / 3600).toFixed(2) : "-")} m²
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Next Button */}
          {isCompleted && (
            <div className="flex justify-end">
              <Button onClick={onNext} className="flex items-center gap-2 w-[300px] bg-black dark:bg-primary text-white dark:text-primary-foreground font-bold text-lg py-3 px-6 justify-center hover:bg-gray-800 dark:hover:bg-primary/90">
                TDM 선택
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PatientStep;