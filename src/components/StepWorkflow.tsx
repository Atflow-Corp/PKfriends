import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Patient, Prescription, BloodTest, DrugAdministration } from "@/pages/Index";
import { CheckCircle, Circle, User, Pill, FlaskConical, Activity, History } from "lucide-react";
import { cn } from "@/lib/utils";
import PatientStep from "./workflow/PatientStep";
import PrescriptionStep from "./workflow/PrescriptionStep";
import BloodTestStep from "./workflow/BloodTestStep";
import SimulationStep from "./workflow/SimulationStep";
import DrugAdministrationStep from "./workflow/DrugAdministrationStep";
import { buildTdmRequestBody, runTdmApi, hasTdmResult } from "@/lib/tdm";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  onResetWorkflow: () => void;
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
  setDrugAdministrations,
  onResetWorkflow
}: StepWorkflowProps) => {
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoadingTdm, setIsLoadingTdm] = useState(false);
  const [showTdmResultAlert, setShowTdmResultAlert] = useState(false);

  // Hydrate selectedPrescription from localStorage so steps 3/4/5 can work after refresh
  useEffect(() => {
    if (!selectedPatient) { setSelectedPrescription(null); return; }
    try {
      const raw = window.localStorage.getItem(`tdmfriends:prescription:${selectedPatient.id}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { selectedTdmId?: string; newlyAddedTdmId?: string };
      const targetId = parsed.selectedTdmId || parsed.newlyAddedTdmId;
      if (!targetId) return;
      const found = prescriptions.find(p => p.id === targetId && p.patientId === selectedPatient.id) || null;
      if (found) setSelectedPrescription(found);
    } catch (_err) { /* no-op */ }
  }, [selectedPatient, selectedPatient?.id, prescriptions]);

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

  // 선택된 약품에 대한 Lab 데이터 확인
  const selectedDrugBloodTests = selectedPatient && selectedPrescription
    ? bloodTests.filter(b => 
        b.patientId === selectedPatient.id && 
        b.drugName === selectedPrescription.drugName
      )
    : [];

  // 선택된 약품에 대한 투약 기록 확인
  const selectedDrugAdministrations = selectedPatient && selectedPrescription
    ? drugAdministrations.filter(d => 
        d.patientId === selectedPatient.id && 
        d.drugName === selectedPrescription.drugName
      )
    : [];

  const isStepCompleted = (stepId: number) => {
    switch (stepId) {
      case 1: return selectedPatient !== null;
      case 2: return selectedPatient && selectedPrescription !== null;
      case 3: return selectedPatient && selectedPrescription && selectedDrugBloodTests.length > 0;
      case 4: return selectedPatient && selectedPrescription && selectedDrugAdministrations.length > 0;
      case 5: return selectedPatient && selectedPrescription && selectedDrugBloodTests.length > 0 && selectedDrugAdministrations.length > 0;
      default: return false;
    }
  };

  const canAccessStep = (stepId: number) => {
    if (stepId === 1) return true;
    if (stepId === 2) return isStepCompleted(1);
    if (stepId === 3) return isStepCompleted(2);
    if (stepId === 4) {
      // 투약기록 단계 접근: Lab 단계 완료 (선택된 약품의 Lab 데이터 존재)
      return selectedPatient && selectedPrescription && selectedDrugBloodTests.length > 0;
    }
    if (stepId === 5) return isStepCompleted(4);
    return false;
  };

  // 워크플로우 확인 함수
  const hasOngoingWorkflow = (patient: Patient | null): boolean => {
    if (!patient) return false;
    const patientPrescriptions = prescriptions.filter(p => p.patientId === patient.id);
    return patientPrescriptions.length > 0;
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

  const handleResetWorkflow = () => {
    // 워크플로우 데이터 초기화
    clearLaterStepData();
    // 부모 컴포넌트의 워크플로우 리셋 함수 호출
    onResetWorkflow();
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
                    className={cn(
                      "flex flex-col items-center gap-1 h-auto py-3",
                      !canAccess && "opacity-50 cursor-not-allowed"
                    )}
                    disabled={!canAccess || (step.id === 5 && isLoadingTdm)}
                    onClick={async () => {
                      if (!canAccess) return;
                      
                      // Let's TDM (step 5) 버튼 클릭 시 API 호출
                      if (step.id === 5 && selectedPatient && selectedPrescription) {
                        // TDM 결과가 이미 있는지 확인
                        const hasResult = hasTdmResult(selectedPatient.id, selectedPrescription.drugName);
                        
                        if (hasResult) {
                          // 이미 결과가 있는 경우 얼럿 표시하고 API 호출 안 함
                          setShowTdmResultAlert(true);
                          return;
                        }
                        
                        // 결과가 없는 경우 API 호출
                        setIsLoadingTdm(true);
                        let apiCallSuccess = false;
                        try {
                          const body = buildTdmRequestBody({
                            patients,
                            prescriptions,
                            bloodTests,
                            drugAdministrations,
                            selectedPatientId: selectedPatient.id,
                            selectedDrugName: selectedPrescription.drugName,
                          });
                          if (body) {
                            await runTdmApi({ body, persist: true, patientId: selectedPatient.id, drugName: selectedPrescription.drugName });
                            apiCallSuccess = true;
                          } else {
                            // body가 null인 경우 (데이터 부족 등)
                            alert('TDM 요청 데이터를 생성할 수 없습니다. 환자 정보와 처방 정보를 확인해주세요.');
                          }
                        } catch (e) {
                          console.error("TDM API 호출 실패:", e);
                          const errorMessage = e instanceof Error ? e.message : '알 수 없는 오류';
                          const errorName = e instanceof Error ? e.name : 'Unknown';
                          
                          // 오류 상세 정보 로깅
                          console.error("오류 상세 정보:", {
                            name: errorName,
                            message: errorMessage,
                            error: e
                          });
                          
                          const isCorsError = errorMessage.includes("CORS 오류") || errorMessage.includes("cors");
                          const isNetworkError = errorMessage.includes("네트워크 오류") || errorMessage.includes("failed to fetch");
                          const is503Error = errorMessage.includes("503") || errorMessage.includes("일시적");
                          const isValidationError = errorMessage.includes("반코마이신은 현재 정맥 투약 모델만 지원됩니다") || 
                                                    errorMessage.includes("투약 경로를 정맥으로 변경");
                          
                          let userMessage = `TDM 분석 중 오류가 발생했습니다.\n\n`;
                          if (isValidationError) {
                            // 검증 오류인 경우 (예: 반코마이신 경구 투약 선택)
                            userMessage = errorMessage;
                          } else if (isCorsError || isNetworkError) {
                            userMessage += `서버 접근 오류가 발생했습니다.\n`;
                            userMessage += `오류 유형: ${errorName}\n`;
                            userMessage += `오류 메시지: ${errorMessage.split('\n')[0]}\n\n`;
                            userMessage += `서버 관리자에게 문의하거나 잠시 후 다시 시도해주세요.\n\n`;
                            userMessage += `이전에 저장된 결과가 있다면 그것을 표시합니다.`;
                          } else if (is503Error) {
                            userMessage += `서버 일시적 오류 (503): 서버가 일시적으로 사용 불가능한 상태입니다.\n`;
                            userMessage += `잠시 후 다시 시도해주세요.\n\n`;
                            userMessage += `이전에 저장된 결과가 있다면 그것을 표시합니다.`;
                          } else {
                            userMessage += `오류 유형: ${errorName}\n`;
                            userMessage += `오류 메시지: ${errorMessage}\n\n`;
                            userMessage += `이전에 저장된 결과가 있다면 그것을 표시합니다.`;
                          }
                          alert(userMessage);
                        } finally {
                          setIsLoadingTdm(false);
                        }
                        
                        // API 호출 성공한 경우에만 단계 이동
                        // 검증 오류나 데이터 부족 등으로 실패한 경우에는 현재 단계 유지
                        if (apiCallSuccess) {
                          setCurrentStep(step.id);
                        }
                        // apiCallSuccess가 false인 경우 단계 이동하지 않음 (현재 단계 유지)
                      } else {
                        setCurrentStep(step.id);
                      }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      {isCompleted ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <StepIcon className="h-4 w-4" />
                      )}
                    </div>
                    <span className="text-xs text-center leading-tight">
                      {step.id === 5 && isLoadingTdm ? "처리 중..." : step.title}
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
            selectedPrescription={selectedPrescription}
            setSelectedPrescription={setSelectedPrescription}
            onAddPrescription={(prescription, updatedPrescriptions) => {
              if (prescription) {
                onAddPrescription(prescription);
                setSelectedPrescription(prescription);
              } else {
                // 삭제의 경우 - updatedPrescriptions를 사용하여 prescriptions 상태 업데이트
                setPrescriptions(updatedPrescriptions);
              }
            }}
            onNext={handleNextStep}
            onPrev={handlePrevStep}
            isCompleted={isStepCompleted(2)}
            bloodTests={bloodTests}
            setBloodTests={setBloodTests}
            drugAdministrations={drugAdministrations}
            setDrugAdministrations={setDrugAdministrations}
            onClearLaterStepData={clearLaterStepData}
            onResetWorkflow={handleResetWorkflow}
          />
        )}
        
        {currentStep === 3 && (
          <BloodTestStep
            patients={patients}
            bloodTests={bloodTests}
            selectedPatient={selectedPatient}
            selectedPrescription={selectedPrescription}
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
            selectedPrescription={selectedPrescription}
            onAddDrugAdministration={onAddDrugAdministration}
            setDrugAdministrations={setDrugAdministrations}
            drugAdministrations={drugAdministrations}
            bloodTests={bloodTests}
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
            selectedPrescription={selectedPrescription}
            drugAdministrations={drugAdministrations}
            onPrev={handlePrevStep}
          />
        )}
      </div>

      {/* TDM 결과 이미 존재 알림 AlertDialog */}
      <AlertDialog open={showTdmResultAlert} onOpenChange={setShowTdmResultAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>TDM Workflow 완료 안내</AlertDialogTitle>
            <AlertDialogDescription>
              TDM Workflow를 완료한 상태입니다. 새로운 예측 결과를 확인하시려면 투약 기록 단계에서 하단의 TDM Simulation 버튼을 선택해 주세요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowTdmResultAlert(false)}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowTdmResultAlert(false);
              // 신규 API 호출 없이 Let's TDM 결과 화면(step 5)으로 이동
              setCurrentStep(5);
            }}>
              결과 보기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StepWorkflow;
