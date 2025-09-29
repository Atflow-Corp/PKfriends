import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Patient, Prescription, BloodTest, DrugAdministration } from "@/pages/Index";
import { Activity, ArrowLeft, CheckCircle, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import PKSimulation from "../PKSimulation";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface SimulationStepProps {
  patients: Patient[];
  prescriptions: Prescription[];
  bloodTests: BloodTest[];
  selectedPatient: Patient | null;
  drugAdministrations: DrugAdministration[];
  onPrev: () => void;
}

const SimulationStep = ({
  patients,
  prescriptions,
  bloodTests,
  selectedPatient,
  drugAdministrations,
  onPrev
}: SimulationStepProps) => {
  const [tdmResult, setTdmResult] = useState<unknown | null>(null);
  const [showReportAlert, setShowReportAlert] = useState(false);
  
  useEffect(() => {
    if (!selectedPatient) { setTdmResult(null); return; }
    try {
      const raw = window.localStorage.getItem(`tdmfriends:tdmResult:${selectedPatient.id}`);
      if (raw) setTdmResult(JSON.parse(raw)); else setTdmResult(null);
    } catch { setTdmResult(null); }
  }, [selectedPatient?.id]);

  // PDF 저장 함수
  const handleDownloadPDF = async () => {
    const element = document.getElementById('pk-simulation-content');
    if (!element) return;
    const canvas = await html2canvas(element);
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [canvas.width, canvas.height] });
    pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
    pdf.save("PK_simulation_report.pdf");
  };

  // 보고서 생성 버튼 클릭 핸들러
  const handleReportButtonClick = () => {
    setShowReportAlert(true);
  };

  // 보고서 생성 확인 핸들러
  const handleConfirmReport = () => {
    setShowReportAlert(false);
    // 새 탭에서 보고서 페이지 열기 (동적 URL 구성)
    const baseUrl = window.location.origin + window.location.pathname.split('/').slice(0, -1).join('/');
    const reportUrl = `${baseUrl}/report?patientId=${selectedPatient.id}`;
    window.open(reportUrl, '_blank');
  };

  // 보고서 생성 취소 핸들러
  const handleCancelReport = () => {
    setShowReportAlert(false);
  };
  if (!selectedPatient) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <Activity className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Please select a patient first</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const patientPrescriptions = prescriptions.filter(p => p.patientId === selectedPatient.id);
  const patientBloodTests = bloodTests.filter(b => b.patientId === selectedPatient.id);
  const patientDrugAdministrations = drugAdministrations.filter(d => d.patientId === selectedPatient.id);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            TDM Simulation
            <CheckCircle className="h-5 w-5 text-green-600" />
          </CardTitle>
          <CardDescription>
            {selectedPatient.name} 환자의 TDM 분석 결과를 확인하고 약물 요법을 직접 시뮬레이션 해보세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* PK Simulation Component */}
          <div id="pk-simulation-content">
            <PKSimulation
              patients={patients}
              prescriptions={prescriptions}
              bloodTests={bloodTests}
              selectedPatient={selectedPatient}
              drugAdministrations={patientDrugAdministrations}
              onDownloadPDF={handleDownloadPDF}
            />
          </div>

          {/* Navigation */}
          <div className="flex justify-between mt-6">
            <Button variant="outline" onClick={onPrev} className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              투약 기록
            </Button>
            <Button onClick={handleReportButtonClick} className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              TDM 분석 보고서 생성
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 보고서 생성 확인 다이얼로그 */}
      <AlertDialog open={showReportAlert} onOpenChange={setShowReportAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedPatient.name} 환자의 TDM 분석을 종료하시겠습니까?
            </AlertDialogTitle>
            <AlertDialogDescription>
              분석 종료 후 데이터 수정은 불가하며 새 탭에서 PDF 파일로 보고서를 다운로드할 수 있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelReport}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReport} className="bg-black text-white hover:bg-gray-800">
              보고서 생성
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SimulationStep;
