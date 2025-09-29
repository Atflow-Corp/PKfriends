import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Patient, Prescription, BloodTest, DrugAdministration } from "@/pages/Index";
import { FileText, Download } from "lucide-react";
import { useEffect, useState } from "react";
import Header from "./ui/Header";
import Footer from "./ui/Footer";
import TDMPatientDetails from "./TDMPatientDetails";
import PKCharts from "./pk/PKCharts";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { storage, STORAGE_KEYS } from "@/lib/storage";

const TDMReportPage = () => {
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [analysisDate, setAnalysisDate] = useState<string>("");
  const [selectedDrug, setSelectedDrug] = useState<string>("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [bloodTests, setBloodTests] = useState<BloodTest[]>([]);
  const [drugAdministrations, setDrugAdministrations] = useState<DrugAdministration[]>([]);
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  
  // PKCharts에 필요한 상태들
  const [tdmResults, setTdmResults] = useState<any>(null);
  const [tdmExtraSeries, setTdmExtraSeries] = useState<any>(null);

  useEffect(() => {
    // localStorage에서 모든 데이터 로드
    const loadData = () => {
      try {
        // 환자 데이터 로드
        const savedPatients = storage.getJSON<Patient[]>(STORAGE_KEYS.patients, [] as Patient[]);
        const revivePatients = (savedPatients || []).map((p: any) => ({ ...p, createdAt: p.createdAt ? new Date(p.createdAt) : new Date() }));
        setPatients(revivePatients);

        // 처방전 데이터 로드
        const savedPrescriptions = storage.getJSON<Prescription[]>(STORAGE_KEYS.prescriptions, [] as Prescription[]);
        const revivePrescriptions = (savedPrescriptions || []).map((pr: any) => ({
          ...pr,
          startDate: pr.startDate ? new Date(pr.startDate) : new Date(),
        }));
        setPrescriptions(revivePrescriptions);

        // 혈중 약물 농도 데이터 로드
        const savedBloodTests = storage.getJSON<BloodTest[]>(STORAGE_KEYS.bloodTests, [] as BloodTest[]);
        const reviveBloodTests = (savedBloodTests || []).map((bt: any) => ({
          ...bt,
          testDate: bt.testDate ? new Date(bt.testDate) : new Date(),
        }));
        setBloodTests(reviveBloodTests);

        // 투약 기록 데이터 로드
        const savedDrugAdministrations = storage.getJSON<DrugAdministration[]>(STORAGE_KEYS.drugAdministrations, [] as DrugAdministration[]);
        const reviveDrugAdministrations = (savedDrugAdministrations || []).map((da: any) => ({
          ...da,
          date: da.date ? new Date(da.date) : new Date(),
        }));
        setDrugAdministrations(reviveDrugAdministrations);

        // URL에서 환자 ID 가져오기
        const urlParams = new URLSearchParams(window.location.search);
        const patientIdFromUrl = urlParams.get('patientId');
        
        if (patientIdFromUrl && revivePatients.length > 0) {
          // 환자 정보 찾기
          const patient = revivePatients.find(p => p.id === patientIdFromUrl);
          if (patient) {
            setSelectedPatient(patient);
          }

          // 선택된 약품 정보 가져오기
          try {
            const savedDrug = window.localStorage.getItem(`tdmfriends:selectedDrug:${patientIdFromUrl}`);
            if (savedDrug) {
              setSelectedDrug(savedDrug);
              
              // 선택된 처방전 찾기
              const prescription = revivePrescriptions.find(p => 
                p.patientId === patientIdFromUrl && p.drugName === savedDrug
              );
              if (prescription) {
                setSelectedPrescription(prescription);
              }

              // TDM 결과 데이터 로드
              try {
                const savedTdmResults = window.localStorage.getItem(`tdmfriends:tdmResults:${patientIdFromUrl}:${savedDrug}`);
                if (savedTdmResults) {
                  const parsedResults = JSON.parse(savedTdmResults);
                  setTdmResults(parsedResults);
                }
              } catch (error) {
                console.error('TDM 결과 로드 실패:', error);
              }

              // TDM 시리즈 데이터 로드
              try {
                const savedTdmExtraSeries = window.localStorage.getItem(`tdmfriends:tdmExtraSeries:${patientIdFromUrl}:${savedDrug}`);
                if (savedTdmExtraSeries) {
                  const parsedSeries = JSON.parse(savedTdmExtraSeries);
                  setTdmExtraSeries(parsedSeries);
                }
              } catch (error) {
                console.error('TDM 시리즈 로드 실패:', error);
              }
            }
          } catch (error) {
            console.error('약품 정보 로드 실패:', error);
          }
        }
      } catch (error) {
        console.error('데이터 로드 실패:', error);
      }
    };

    loadData();

    // 분석 일시 설정 (현재 시간)
    setAnalysisDate(new Date().toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }));
  }, []);

  // PDF 다운로드 함수
  const handleDownloadPDF = async () => {
    try {
      // 보고서 내용 영역 선택
      const reportContent = document.getElementById('report-content');
      if (!reportContent) {
        alert('보고서 내용을 찾을 수 없습니다.');
        return;
      }

      // 로딩 표시
      const downloadButton = document.querySelector('[data-download-button]') as HTMLButtonElement;
      if (downloadButton) {
        downloadButton.disabled = true;
        downloadButton.textContent = 'PDF 생성 중...';
      }

      // html2canvas로 HTML을 이미지로 변환
      const canvas = await html2canvas(reportContent, {
        scale: 1.5, // 적절한 해상도로 조정
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: reportContent.scrollWidth,
        height: reportContent.scrollHeight,
        scrollX: 0,
        scrollY: 0
      });

      const imgData = canvas.toDataURL('image/png', 0.95); // JPEG 품질 조정
      
      // PDF 생성
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      // A4 크기 계산 (210mm x 297mm)
      const pdfWidth = 210;
      const pdfHeight = 297;
      const margin = 15;
      const contentWidth = pdfWidth - (margin * 2);
      const contentHeight = pdfHeight - (margin * 2);

      // 이미지 크기 계산
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(contentWidth / imgWidth, contentHeight / imgHeight);
      const finalWidth = imgWidth * ratio;
      const finalHeight = imgHeight * ratio;

      // 페이지 분할 처리
      const pageHeight = contentHeight;
      const totalPages = Math.ceil(finalHeight / pageHeight);

      for (let i = 0; i < totalPages; i++) {
        if (i > 0) {
          pdf.addPage();
        }

        const yOffset = -(i * pageHeight);
        const sourceY = i * pageHeight;
        const sourceHeight = Math.min(pageHeight, finalHeight - sourceY);

        // 이미지를 PDF에 추가 (페이지별로 분할)
        pdf.addImage(
          imgData, 
          'PNG', 
          margin, 
          margin + yOffset, 
          finalWidth, 
          finalHeight,
          undefined,
          'FAST'
        );
      }

      // 파일명 생성
      const fileName = `${selectedPatient?.name || '환자'}_${selectedDrug || '약품'}_TDM_분석보고서_${new Date().toISOString().split('T')[0]}.pdf`;
      
      // PDF 다운로드
      pdf.save(fileName);

      // 버튼 상태 복원
      if (downloadButton) {
        downloadButton.disabled = false;
        downloadButton.textContent = 'Report Download';
      }

    } catch (error) {
      console.error('PDF 생성 중 오류 발생:', error);
      alert('PDF 생성 중 오류가 발생했습니다: ' + error.message);
      
      // 버튼 상태 복원
      const downloadButton = document.querySelector('[data-download-button]') as HTMLButtonElement;
      if (downloadButton) {
        downloadButton.disabled = false;
        downloadButton.textContent = 'Report Download';
      }
    }
  };


  if (!selectedPatient) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">환자 정보를 찾을 수 없습니다.</p>
                <p className="text-sm text-gray-500 mt-2">
                  URL: {window.location.href}
                </p>
                <p className="text-sm text-gray-500">
                  환자 수: {patients.length}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        {/* 안내문 */}
        <Card className="mb-6">
          <CardContent className="py-4">
            <p className="text-sm text-gray-600 text-center">
              Report를 조회한 후 이 탭을 닫고 이전 창으로 복귀하면 계속해서 서비스를 이용하실 수 있습니다.
            </p>
          </CardContent>
        </Card>

        {/* 보고서 제목 */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-xl">
                  {selectedPatient.name} 환자의 {selectedDrug} TDM 분석 보고서 - 분석일자: {analysisDate}
                </CardTitle>
                <CardDescription className="mt-2">
                  {selectedPatient.name} 환자({selectedPatient.id})의 Report를 조회하고 다운로드할 수 있습니다.
                </CardDescription>
              </div>
              <Button 
                onClick={handleDownloadPDF}
                className="flex items-center gap-2"
                data-download-button
              >
                <Download className="h-4 w-4" />
                Report Download
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* 보고서 내용용 */}
        <Card className="mb-6" id="report-content">
          <CardHeader>
           {/*} <CardTitle>환자 정보</CardTitle> */}
          </CardHeader>
          {/* 첫 번째 카드: 환자 정보 */}
          <CardContent>
            <TDMPatientDetails
              currentPatient={selectedPatient}
              selectedPrescription={selectedPrescription}
              latestBloodTest={bloodTests
                .filter(bt => bt.patientId === selectedPatient.id && bt.drugName === selectedDrug)
                .sort((a, b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime())[0] || null}
              drugAdministrations={drugAdministrations.filter(da => 
                da.patientId === selectedPatient.id && da.drugName === selectedDrug
              )}
              isExpanded={true}
              onToggleExpanded={() => {}} // 빈 함수로 클릭 이벤트 무시
              disableHover={true} // 마우스 오버 이벤트 비활성화
            />
          </CardContent>
          {/* 두 번째 카드: 현용법 결과과 */}
          <CardContent>
            <PKCharts
              showSimulation={false} // 보고서에서는 시뮬레이션 영역 숨김
              currentPatientName={selectedPatient?.name}
              selectedDrug={selectedDrug}
              targetMin={tdmResults?.targetMin}
              targetMax={tdmResults?.targetMax}
              recentAUC={tdmResults?.recentAUC}
              recentMax={tdmResults?.recentMax}
              recentTrough={tdmResults?.recentTrough}
              predictedAUC={tdmResults?.predictedAUC}
              predictedMax={tdmResults?.predictedMax}
              predictedTrough={tdmResults?.predictedTrough}
              ipredSeries={tdmExtraSeries?.ipredSeries}
              predSeries={tdmExtraSeries?.predSeries}
              observedSeries={tdmExtraSeries?.observedSeries}
              tdmIndication={selectedPrescription?.indication}
              tdmTarget={selectedPrescription?.tdmTarget}
              tdmTargetValue={selectedPrescription?.tdmTargetValue}
              latestAdministration={drugAdministrations
                .filter(da => da.patientId === selectedPatient.id && da.drugName === selectedDrug)
                .sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime())
                .slice(-1)[0] ? {
                  dose: drugAdministrations
                    .filter(da => da.patientId === selectedPatient.id && da.drugName === selectedDrug)
                    .sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime())
                    .slice(-1)[0].dose,
                  unit: drugAdministrations
                    .filter(da => da.patientId === selectedPatient.id && da.drugName === selectedDrug)
                    .sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime())
                    .slice(-1)[0].unit,
                  intervalHours: drugAdministrations
                    .filter(da => da.patientId === selectedPatient.id && da.drugName === selectedDrug)
                    .sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime())
                    .slice(-1)[0].intervalHours
                } : null}
              drugAdministrations={drugAdministrations
                .filter(da => da.patientId === selectedPatient.id && da.drugName === selectedDrug)
                .map(da => ({
                  id: da.id,
                  patientId: da.patientId,
                  drugName: da.drugName,
                  date: da.date,
                  time: da.time
                }))}
            />
          </CardContent>
        </Card>

      </div>

      <Footer />
    </div>
  );
};

export default TDMReportPage;
