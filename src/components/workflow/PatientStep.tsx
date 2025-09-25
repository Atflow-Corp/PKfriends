import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Patient, Prescription } from "@/pages/Index";
import { User, ArrowRight, CheckCircle } from "lucide-react";
import PatientInformation from "@/components/PatientInformation";

interface PatientStepProps {
  patients: Patient[];
  prescriptions: Prescription[];
  selectedPatient: Patient | null;
  setSelectedPatient: (patient: Patient | null) => void;
  onAddPatient: (patient: Patient) => void;
  onUpdatePatient: (patient: Patient) => void;
  onDeletePatient: (patientId: string) => void;
  onNext: () => void;
  onResetWorkflow: () => void;
  isCompleted: boolean;
}

const PatientStep = ({
  patients,
  prescriptions,
  selectedPatient,
  setSelectedPatient,
  onAddPatient,
  onUpdatePatient,
  onDeletePatient,
  onNext,
  onResetWorkflow,
  isCompleted
}: PatientStepProps) => {
  const [showWorkflowAlert, setShowWorkflowAlert] = useState(false);

  // 진행 중인 워크플로우가 있는지 확인하는 함수
  const hasOngoingWorkflow = (patient: Patient | null): boolean => {
    if (!patient) return false;
    // 해당 환자에게 prescriptions 데이터가 있는지 확인
    const patientPrescriptions = prescriptions.filter(p => p.patientId === patient.id);
    return patientPrescriptions.length > 0;
  };

  // TDM 선택 버튼 클릭 핸들러
  const handleTDMSelect = () => {
    if (hasOngoingWorkflow(selectedPatient)) {
      setShowWorkflowAlert(true);
    } else {
      onNext();
    }
  };

  // 새로 시작 버튼 클릭 핸들러
  const handleNewStart = () => {
    onResetWorkflow();
    setShowWorkflowAlert(false);
    onNext();
  };

  // 계속 진행 버튼 클릭 핸들러
  const handleContinue = () => {
    setShowWorkflowAlert(false);
    onNext();
  };
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
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="text-green-800">Selected Patient</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">이름</p>
                    <p className="text-sm">{selectedPatient.name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">생년월일</p>
                    <p className="text-sm">{selectedPatient.birthDate}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">나이</p>
                    <p className="text-sm">{selectedPatient.age}세</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">성별</p>
                    <p className="text-sm">{selectedPatient.gender === "male" ? "남성" : selectedPatient.gender === "female" ? "여성" : "기타"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">체중</p>
                    <p className="text-sm">{selectedPatient.weight} kg</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">신장</p>
                    <p className="text-sm">{selectedPatient.height} cm</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">BMI</p>
                    <p className="text-sm">
                      {(selectedPatient.weight && selectedPatient.height ? (selectedPatient.weight / Math.pow(selectedPatient.height / 100, 2)).toFixed(1) : "-")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">BSA</p>
                    <p className="text-sm">
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
              <Button onClick={handleTDMSelect} className="flex items-center gap-2 w-[300px] bg-black text-white font-bold text-lg py-3 px-6 justify-center">
                TDM 선택
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 워크플로우 진행 중 알림 다이얼로그 */}
      <Dialog open={showWorkflowAlert} onOpenChange={setShowWorkflowAlert}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              진행 중인 TDM 분석 워크플로우가 있습니다.
            </DialogTitle>
          </DialogHeader>
          <DialogDescription className="text-base">
            {selectedPatient?.createdAt.toISOString().split('T')[0]}에 등록된 {selectedPatient?.name}환자의 워크플로우가 있습니다. 분석을 계속 진행할까요?
          </DialogDescription>
          <div className="flex gap-3 mt-6">
            <Button 
              variant="outline" 
              onClick={handleNewStart}
              className="flex-1"
            >
              새로 시작
            </Button>
            <Button 
              onClick={handleContinue}
              className="flex-1 bg-black text-white"
            >
              계속 진행
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PatientStep;