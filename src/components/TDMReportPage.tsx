import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Patient } from "@/pages/Index";
import { FileText, Download } from "lucide-react";
import { useEffect, useState } from "react";
import Header from "./ui/Header";
import Footer from "./ui/Footer";
import jsPDF from "jspdf";
import { storage, STORAGE_KEYS } from "@/lib/storage";

const TDMReportPage = () => {
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [analysisDate, setAnalysisDate] = useState<string>("");
  const [selectedDrug, setSelectedDrug] = useState<string>("");
  const [patients, setPatients] = useState<Patient[]>([]);

  useEffect(() => {
    // localStorage에서 환자 데이터 로드
    const loadData = () => {
      try {
        const savedPatients = storage.getJSON<Patient[]>(STORAGE_KEYS.patients, [] as Patient[]);
        const revivePatients = (savedPatients || []).map((p: any) => ({ ...p, createdAt: p.createdAt ? new Date(p.createdAt) : new Date() }));
        setPatients(revivePatients);

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
      // 빈 PDF 생성
      const pdf = new jsPDF({ 
        orientation: "portrait", 
        unit: "mm", 
        format: "a4" 
      });
      
      // 제목 추가
      pdf.setFontSize(20);
      pdf.text(`${selectedPatient?.name || '환자'} 환자의 ${selectedDrug || '약품'} TDM 분석 보고서`, 20, 30);
      
      // 분석일자 추가
      pdf.setFontSize(12);
      pdf.text(`분석일자: ${analysisDate}`, 20, 40);
      
      // 환자 정보 추가
      pdf.setFontSize(14);
      pdf.text('환자 정보', 20, 60);
      pdf.setFontSize(10);
      pdf.text(`환자명: ${selectedPatient?.name || '-'}`, 20, 70);
      pdf.text(`환자번호: ${selectedPatient?.id || '-'}`, 20, 80);
      
      pdf.save(`${selectedPatient?.name || '환자'}_TDM_분석보고서.pdf`);
    } catch (error) {
      console.error('PDF 생성 중 오류 발생:', error);
      alert('PDF 생성 중 오류가 발생했습니다.');
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
              >
                <Download className="h-4 w-4" />
                Report Download
              </Button>
            </div>
          </CardHeader>
        </Card>

      </div>

      <Footer />
    </div>
  );
};

export default TDMReportPage;
