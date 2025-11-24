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
  selectedPrescription: Prescription | null;
  drugAdministrations: DrugAdministration[];
  onPrev: () => void;
}

const SimulationStep = ({
  patients,
  prescriptions,
  bloodTests,
  selectedPatient,
  selectedPrescription,
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
    if (!element) {
      alert('보고서 내용을 찾을 수 없습니다.');
      return;
    }

    // PDF 생성 전에 다크 모드 여부 확인 (try-catch 블록 밖에서 선언)
    const wasDarkMode = document.documentElement.classList.contains('dark');

    try {
      // 로딩 표시를 위한 버튼 비활성화
      const reportButton = document.querySelector('[data-report-button]') as HTMLButtonElement;
      if (reportButton) {
        reportButton.disabled = true;
        reportButton.textContent = 'PDF 생성 중...';
      }

      // 다크 모드인 경우 임시로 light 모드로 전환
      if (wasDarkMode) {
        document.documentElement.classList.remove('dark');
        // 스타일이 적용될 시간을 주기 위해 짧은 대기
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // PDF 생성 전에 "용법 조정 시뮬레이션을 진행하시겠습니까?" 섹션 숨기기
      // 해당 섹션은 h2 태그에 "용법 조정 시뮬레이션을 진행하시겠습니까?" 텍스트가 있는 부모 div
      const allDivs = element.querySelectorAll('div');
      let dosageAdjustmentSection: HTMLElement | null = null;
      for (const div of Array.from(allDivs)) {
        const h2 = div.querySelector('h2');
        if (h2 && h2.textContent?.includes('용법 조정 시뮬레이션을 진행하시겠습니까?')) {
          dosageAdjustmentSection = div;
          break;
        }
      }
      let originalDisplay: string | null = null;
      if (dosageAdjustmentSection) {
        originalDisplay = dosageAdjustmentSection.style.display;
        dosageAdjustmentSection.style.display = 'none';
      }

      // 타이틀 HTML 요소 생성 및 추가
      const downloadDate = new Date().toLocaleString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
      const titleText = `${selectedPatient?.name || '환자'} 환자의 ${selectedPrescription?.drugName || '약품'} TDM분석 보고서 - ${downloadDate}`;
      
      const titleElement = document.createElement('div');
      titleElement.style.cssText = `
        width: 100%;
        padding: 12px 0;
        margin-bottom: 16px;
        font-size: 18px;
        font-weight: bold;
        text-align: center;
        color: #000;
        background-color: #ffffff;
        border-bottom: 2px solid #000;
      `;
      titleElement.textContent = titleText;
      
      // 타이틀을 요소의 맨 위에 추가
      element.insertBefore(titleElement, element.firstChild);

      // html2canvas로 HTML을 이미지로 변환
      const canvas = await html2canvas(element, {
        scale: 1.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: element.scrollWidth,
        height: element.scrollHeight,
        scrollX: 0,
        scrollY: 0
      });

      // 추가한 타이틀 제거
      element.removeChild(titleElement);

      // 숨긴 섹션 다시 보이게 하기
      if (dosageAdjustmentSection) {
        (dosageAdjustmentSection as HTMLElement).style.display = originalDisplay || '';
      }

      const imgData = canvas.toDataURL('image/png', 0.95);
      
      // PDF 생성 (portrait 형식)
      // A4 크기 계산 (210mm x 297mm)
      const pdfWidth = 210; // A4 width in mm
      const pdfHeight = 297; // A4 height in mm
      const margin = 15;
      const contentWidth = pdfWidth - (margin * 2);
      const contentHeight = pdfHeight - (margin * 2);

      // 이미지 크기 계산 (가로폭 고정, 세로는 비율에 맞게 조정)
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      // 가로폭을 contentWidth로 고정하고 비율에 맞게 세로 계산
      const widthRatio = contentWidth / imgWidth;
      const scaledWidth = contentWidth; // 가로폭 고정 (mm)
      const scaledHeight = imgHeight * widthRatio; // 세로는 비율에 맞게 조정 (mm)

      // 페이지 분할 처리
      const pageHeight = contentHeight; // 한 페이지의 높이 (mm)
      const totalPages = Math.ceil(scaledHeight / pageHeight);

      // 픽셀 단위로 변환 (canvas는 픽셀 단위)
      const pageHeightPixels = pageHeight / widthRatio; // 한 페이지의 높이 (픽셀)

      const pdf = new jsPDF({ 
        orientation: "portrait", 
        unit: "mm", 
        format: "a4"
      });
      
      // 페이지 분할하여 이미지 추가 (타이틀은 이미지에 포함됨)
      for (let i = 0; i < totalPages; i++) {
        if (i > 0) {
          pdf.addPage();
        }

        // 현재 페이지에서 표시할 이미지 영역 계산 (픽셀 단위)
        const sourceYPixels = i * pageHeightPixels; // 원본 이미지에서 시작할 y 좌표 (픽셀)
        const sourceHeightPixels = Math.min(pageHeightPixels, imgHeight - sourceYPixels); // 현재 페이지에 표시할 높이 (픽셀)
        
        // 각 페이지에 해당하는 부분을 별도의 canvas로 추출
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = imgWidth;
        pageCanvas.height = sourceHeightPixels;
        const pageCtx = pageCanvas.getContext('2d');
        
        if (pageCtx) {
          // 원본 canvas에서 해당 영역만 복사
          pageCtx.drawImage(
            canvas,
            0, sourceYPixels, imgWidth, sourceHeightPixels, // 원본에서 가져올 영역
            0, 0, imgWidth, sourceHeightPixels // 새 canvas에 그릴 영역
          );
        }

        // 페이지 canvas를 이미지 데이터로 변환
        const pageImgData = pageCanvas.toDataURL('image/png', 0.95);
        
        // 현재 페이지의 높이 (mm 단위)
        const currentPageHeight = sourceHeightPixels * widthRatio;

        // 이미지를 PDF에 추가 (각 페이지에 해당하는 부분만 표시)
        pdf.addImage(
          pageImgData, 
          'PNG', 
          margin, // PDF에서의 x 좌표
          margin, // PDF에서의 y 좌표 (항상 margin부터 시작)
          scaledWidth, // PDF에서의 너비 (고정)
          currentPageHeight, // PDF에서의 높이 (현재 페이지 높이)
          undefined, // alias
          'FAST' // compression
        );
      }
      
      // 파일명 생성
      const fileName = `${selectedPatient?.name || '환자'}_${selectedPrescription?.drugName || '약품'}_TDM_분석보고서_${new Date().toISOString().split('T')[0]}.pdf`;
      
      // PDF 다운로드
      pdf.save(fileName);

      // 버튼 상태 복원
      if (reportButton) {
        reportButton.disabled = false;
        reportButton.textContent = 'TDM 분석 보고서 생성';
      }

      // 다크 모드 복원
      if (wasDarkMode) {
        document.documentElement.classList.add('dark');
      }
    } catch (error) {
      console.error('PDF 생성 중 오류 발생:', error);
      alert('PDF 생성 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : String(error)));
      
      // 버튼 상태 복원
      const reportButton = document.querySelector('[data-report-button]') as HTMLButtonElement;
      if (reportButton) {
        reportButton.disabled = false;
        reportButton.textContent = 'TDM 분석 보고서 생성';
      }

      // 다크 모드 복원 (에러 발생 시에도)
      if (wasDarkMode) {
        document.documentElement.classList.add('dark');
      }
    }
  };

  // 보고서 생성 버튼 클릭 핸들러
  const handleReportButtonClick = () => {
    setShowReportAlert(true);
  };

  // 보고서 생성 확인 핸들러
  const handleConfirmReport = async () => {
    setShowReportAlert(false);
    // 현재 화면의 PKSimulation 내용을 PDF로 저장
    await handleDownloadPDF();
  };

  // 보고서 생성 취소 핸들러
  const handleCancelReport = () => {
    setShowReportAlert(false);
  };
  if (!selectedPatient) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            TDM Simulation
          </CardTitle>
          <CardDescription>
            시뮬레이션을 진행하려면 환자를 먼저 선택해주세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="py-12">
          <div className="text-center">
            <Activity className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-semibold mb-2">환자를 선택해주세요</p>
            <p className="text-muted-foreground">
              환자 등록 및 선택 단계에서 환자를 선택한 후 시뮬레이션을 진행할 수 있습니다.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const patientPrescriptions = prescriptions.filter(p => p.patientId === selectedPatient.id);
  const patientBloodTests = selectedPrescription 
    ? bloodTests.filter(b => b.patientId === selectedPatient.id && b.drugName === selectedPrescription.drugName)
    : [];
  const patientDrugAdministrations = selectedPrescription
    ? drugAdministrations.filter(d => d.patientId === selectedPatient.id && d.drugName === selectedPrescription.drugName)
    : [];

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
              selectedPrescription={selectedPrescription}
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
            <Button 
              onClick={handleReportButtonClick} 
              className="flex items-center gap-2"
              data-report-button
            >
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
              TDM 분석 보고서를 생성하시겠습니까?
            </AlertDialogTitle>
            <AlertDialogDescription>
              현재 화면의 TDM 분석 결과를 PDF 파일로 다운로드합니다. 환자 정보, 차트, 용법 조정 결과가 포함됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelReport}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReport} className="bg-black dark:bg-primary text-white dark:text-primary-foreground hover:bg-gray-800 dark:hover:bg-primary/90">
              보고서 생성
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SimulationStep;
