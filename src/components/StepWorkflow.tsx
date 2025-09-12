import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Patient, Prescription, BloodTest, DrugAdministration } from "@/pages/Index";
import { CheckCircle, Circle, User, Pill, FlaskConical, Activity, History } from "lucide-react";
import PatientStep from "./workflow/PatientStep";
import PrescriptionStep from "./workflow/PrescriptionStep";
import BloodTestStep from "./workflow/BloodTestStep";
import SimulationStep from "./workflow/SimulationStep";
import DrugAdministrationStep from "./workflow/DrugAdministrationStep";

interface StepWorkflowProps {
  patients: Patient[];
  prescriptions: Prescription[];
  bloodTests: BloodTest[];
  selectedPatient: Patient | null;
  setSelectedPatient: (patient: Patient | null) => void;
  onAddPatient: (patient: Patient) => void;
  onUpdatePatient: (patient: Patient) => void;
  onDeletePatient: (patientId: string) => void;
  onAddPrescription: (prescription: Prescription) => void;
  setPrescriptions: (prescriptions: Prescription[]) => void;
  onAddBloodTest: (bloodTest: BloodTest) => void;
  onDeleteBloodTest: (bloodTestId: string) => void;
  setBloodTests: (bloodTests: BloodTest[]) => void;
  onAddDrugAdministration: (drugAdministration: DrugAdministration) => void;
  drugAdministrations: DrugAdministration[];
  setDrugAdministrations: (drugAdministrations: DrugAdministration[]) => void;
}

const StepWorkflow = ({
  patients,
  prescriptions,
  bloodTests,
  selectedPatient,
  setSelectedPatient,
  onAddPatient,
  onUpdatePatient,
  onDeletePatient,
  onAddPrescription,
  setPrescriptions,
  onAddBloodTest,
  onDeleteBloodTest,
  setBloodTests,
  onAddDrugAdministration,
  drugAdministrations,
  setDrugAdministrations
}: StepWorkflowProps) => {
  const [currentStep, setCurrentStep] = useState(1);

  const steps = [
    { id: 1, title: "환자 등록 및 선택", icon: User, description: "환자를 선택하거나 신규 등록해주세요." },
    { id: 2, title: "TDM 선택", icon: Pill, description: "TDM 약물 정보를 입력합니다." },
    { id: 3, title: "Lab", icon: FlaskConical, description: "신기능 및 혈중 약물 농도 정보를 입력합니다." },
    { id: 4, title: "투약 기록", icon: History, description: "투약 기록을 입력합니다." },
    { id: 5, title: "Let's TDM", icon: Activity, description: "정밀의료 시뮬레이션 결과를 확인해보세요." }
  ];

  const patientPrescriptions = selectedPatient 
    ? prescriptions.filter(p => p.patientId === selectedPatient.id)
    : [];
  
  const patientBloodTests = selectedPatient 
    ? bloodTests.filter(b => b.patientId === selectedPatient.id)
    : [];

  const isStepCompleted = (stepId: number) => {
    switch (stepId) {
      case 1: return selectedPatient !== null;
      case 2: return selectedPatient && patientPrescriptions.length > 0;
      case 3: return selectedPatient && patientBloodTests.length > 0;
      case 4: return selectedPatient && drugAdministrations.length > 0;
      case 5: return selectedPatient && patientBloodTests.length > 0 && patientPrescriptions.length > 0 && drugAdministrations.length > 0;
      default: return false;
    }
  };

  const canAccessStep = (stepId: number) => {
    if (stepId === 1) return true;
    return isStepCompleted(stepId - 1);
  };

  const handleNextStep = () => {
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // 후속 단계 데이터 초기화 함수
  const clearLaterStepData = () => {
    if (selectedPatient) {
      // 혈중 약물 농도 데이터 초기화
      const filteredBloodTests = bloodTests.filter(test => test.patientId !== selectedPatient.id);
      setBloodTests(filteredBloodTests);
      
      // 투약기록 데이터 초기화
      const filteredDrugAdministrations = drugAdministrations.filter(admin => admin.patientId !== selectedPatient.id);
      setDrugAdministrations(filteredDrugAdministrations);
      
      console.log("Cleared later step data for patient:", selectedPatient.id);
    }
  };

  const completedSteps = steps.filter(step => isStepCompleted(step.id)).length;
  const progressPercentage = (completedSteps / steps.length) * 100;

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            TDM 분석 워크플로우
          </CardTitle>
          <CardDescription>
            각 단계를 순서대로 진행해 주세요
            {selectedPatient && ` (${selectedPatient.name} 환자)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>진행률: {completedSteps} / {steps.length}단계 완료</span>
              <span>{Math.round(progressPercentage)}%</span>
            </div>
            <Progress value={progressPercentage} className="w-full" />
            
            {/* Step Navigation */}
            <div className="grid grid-cols-5 gap-2">
              {steps.map((step) => {
                const StepIcon = step.icon;
                const isCompleted = isStepCompleted(step.id);
                const isActive = currentStep === step.id;
                const canAccess = canAccessStep(step.id);
                
                return (
                  <Button
                    key={step.id}
                    variant={isActive ? "default" : isCompleted ? "secondary" : "outline"}
                    className={`flex flex-col items-center gap-1 h-auto py-3 ${
                      !canAccess ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                    disabled={!canAccess}
                    onClick={() => canAccess && setCurrentStep(step.id)}
                  >
                    <div className="flex items-center gap-1">
                      {isCompleted ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <StepIcon className="h-4 w-4" />
                      )}
                    </div>
                    <span className="text-xs text-center leading-tight">
                      {step.title}
                    </span>
                  </Button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      <div className="min-h-[600px]">
        {currentStep === 1 && (
          <PatientStep
            patients={patients}
            selectedPatient={selectedPatient}
            setSelectedPatient={setSelectedPatient}
            onAddPatient={onAddPatient}
            onUpdatePatient={onUpdatePatient}
            onDeletePatient={onDeletePatient}
            onNext={handleNextStep}
            isCompleted={isStepCompleted(1)}
          />
        )}
        
        {currentStep === 2 && (
          <PrescriptionStep
            patients={patients}
            prescriptions={prescriptions}
            selectedPatient={selectedPatient}
            onAddPrescription={(prescription, updatedPrescriptions) => {
              if (prescription) {
                onAddPrescription(prescription);
              } else {
                // 삭제의 경우 - updatedPrescriptions를 사용하여 prescriptions 상태 업데이트
                setPrescriptions(updatedPrescriptions);
              }
            }}
            onNext={handleNextStep}
            onPrev={handlePrevStep}
            isCompleted={isStepCompleted(2)}
            bloodTests={bloodTests}
            drugAdministrations={drugAdministrations}
            onClearLaterStepData={clearLaterStepData}
          />
        )}
        
        {currentStep === 3 && (
          <BloodTestStep
            patients={patients}
            bloodTests={bloodTests}
            selectedPatient={selectedPatient}
            onAddBloodTest={onAddBloodTest}
            onDeleteBloodTest={onDeleteBloodTest}
            onNext={handleNextStep}
            onPrev={handlePrevStep}
            isCompleted={isStepCompleted(3)}
            prescriptions={prescriptions}
          />
        )}
        
        {currentStep === 4 && (
          <DrugAdministrationStep
            patients={patients}
            prescriptions={prescriptions}
            selectedPatient={selectedPatient}
            onAddDrugAdministration={onAddDrugAdministration}
            setDrugAdministrations={setDrugAdministrations}
            drugAdministrations={drugAdministrations}
            onNext={handleNextStep}
            onPrev={handlePrevStep}
            isCompleted={isStepCompleted(4)}
          />
        )}
        
        {currentStep === 5 && (
          <SimulationStep
            patients={patients}
            prescriptions={prescriptions}
            bloodTests={bloodTests}
            selectedPatient={selectedPatient}
            drugAdministrations={drugAdministrations}
            onPrev={handlePrevStep}
          />
        )}
      </div>
    </div>
  );
};

export default StepWorkflow;
