import { useState, useRef } from "react";
import { Patient, Prescription, BloodTest } from "@/pages/Index";
import PKParameterCard from "./pk/PKParameterCard";
import PKControlPanel from "./pk/PKControlPanel";
import PKCharts from "./pk/PKCharts";
import PKDataSummary from "./pk/PKDataSummary";
import TDMPatientDetails from "./TDMPatientDetails";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { FileText } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface PKSimulationProps {
  patients: Patient[];
  prescriptions: Prescription[];
  bloodTests: BloodTest[];
  selectedPatient: Patient | null;
}

const PKSimulation = ({ patients, prescriptions, bloodTests, selectedPatient }: PKSimulationProps) => {
  const [selectedPatientId, setSelectedPatientId] = useState(selectedPatient?.id || "");
  const [selectedDrug, setSelectedDrug] = useState("");
  const [simulationParams, setSimulationParams] = useState({
    dose: "",
    halfLife: "",
    clearance: "",
    volumeDistribution: ""
  });
  const [showSimulation, setShowSimulation] = useState(false);
  const simulationRef = useRef<HTMLDivElement>(null);
  const [doseAdjust, setDoseAdjust] = useState("");
  const [doseUnit, setDoseUnit] = useState("mg");
  const [intervalAdjust, setIntervalAdjust] = useState("");
  const [tab, setTab] = useState("current");

  const currentPatient = patients.find(p => p.id === selectedPatientId);
  const patientPrescriptions = selectedPatientId 
    ? prescriptions.filter(p => p.patientId === selectedPatientId)
    : [];
  const patientBloodTests = selectedPatientId 
    ? bloodTests.filter(b => b.patientId === selectedPatientId)
    : [];

  const availableDrugs = Array.from(new Set([
    ...patientPrescriptions.map(p => p.drugName),
    ...patientBloodTests.map(b => b.drugName)
  ]));

  // 사용 가능한 약물이 있고 선택된 약물이 없으면 첫 번째 약물 자동 선택
  if (availableDrugs.length > 0 && !selectedDrug) {
    setSelectedDrug(availableDrugs[0]);
  }

  const selectedDrugTests = selectedDrug 
    ? patientBloodTests.filter(b => b.drugName === selectedDrug)
    : [];

  // 선택된 약물의 처방 정보 가져오기
  const selectedPrescription = selectedDrug 
    ? patientPrescriptions.find(p => p.drugName === selectedDrug)
    : null;

  // 혈청 크레아티닌 정보 가져오기 (가장 최근 검사 결과)
  const latestBloodTest = patientBloodTests.length > 0 
    ? patientBloodTests.sort((a, b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime())[0]
    : null;

  // Generate PK simulation data
  const generateSimulationData = () => {
    if (!simulationParams.dose || !simulationParams.halfLife) return [];
    
    const dose = parseFloat(simulationParams.dose);
    const halfLife = parseFloat(simulationParams.halfLife);
    const ke = 0.693 / halfLife; // elimination rate constant
    
    const timePoints = [];
    for (let t = 0; t <= 24; t += 0.5) {
      const concentration = dose * Math.exp(-ke * t);
      timePoints.push({
        time: t,
        predicted: concentration,
        observed: selectedDrugTests.find(test => Math.abs(test.timeAfterDose - t) < 0.5)?.concentration || null
      });
    }
    return timePoints;
  };

  const simulationData = generateSimulationData();

  // Calculate PK parameters
  const calculatePKParameters = () => {
    if (selectedDrugTests.length < 2) return null;
    
    const sortedTests = [...selectedDrugTests].sort((a, b) => a.timeAfterDose - b.timeAfterDose);
    const firstTest = sortedTests[0];
    const lastTest = sortedTests[sortedTests.length - 1];
    
    if (firstTest.timeAfterDose === lastTest.timeAfterDose) return null;
    
    // Simple calculation for demonstration
    const ke = Math.log(firstTest.concentration / lastTest.concentration) / (lastTest.timeAfterDose - firstTest.timeAfterDose);
    const halfLife = 0.693 / ke;
    const auc = selectedDrugTests.reduce((sum, test, index) => {
      if (index === 0) return 0;
      const prevTest = selectedDrugTests[index - 1];
      const trapezoidArea = (test.concentration + prevTest.concentration) * (test.timeAfterDose - prevTest.timeAfterDose) / 2;
      return sum + trapezoidArea;
    }, 0);
    
    return {
      halfLife: halfLife.toFixed(2),
      eliminationRate: ke.toFixed(4),
      auc: auc.toFixed(2),
      maxConcentration: Math.max(...selectedDrugTests.map(t => t.concentration)).toFixed(2),
      timeToMax: selectedDrugTests.find(t => t.concentration === Math.max(...selectedDrugTests.map(test => test.concentration)))?.timeAfterDose.toFixed(1) || "N/A"
    };
  };

  const pkParameters = calculatePKParameters();

  // PK Parameter 예시 (실제 계산 로직 필요시 추가)
  const pkParameterText = `TVCL = 10\nCL = TVCL × exp(η1) = 7.8`;

  const handleGenerateSimulation = () => {
    setShowSimulation(true);
  };

  // PDF 저장 함수
  const handleDownloadPDF = async () => {
    if (!simulationRef.current) return;
    const canvas = await html2canvas(simulationRef.current);
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [canvas.width, canvas.height] });
    pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
    pdf.save("PK_simulation_report.pdf");
  };

  // 진입 조건: 환자, 처방, 혈액검사, 약물명, 파라미터 등 없을 때 안내
  if (!selectedPatientId || !currentPatient || availableDrugs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-muted-foreground">
        <p className="text-lg font-semibold">환자와 약물을 먼저 선택해 주세요.</p>
        <p className="text-sm mt-2">이전 단계에서 환자, TDM 약물, 혈액검사 정보를 모두 입력해야 시뮬레이션이 가능합니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* PK Parameter 섹션 */}
      <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4 mb-2">
        <div className="font-bold mb-1">PK Parameter</div>
        <pre className="text-sm whitespace-pre-line text-slate-700 dark:text-slate-200">{pkParameterText}</pre>
      </div>

      {/* TDM Summary 섹션 */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 mb-6">
        <div className="font-bold text-lg mb-3">TDM Summary</div>
        <div className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
          {/* 추후 분석엔진을 통해 전달되는 분석의견을 노출합니다. */}
          현 용법으로 Steady State까지 ACUC는 340mg*h/L으로 투약 6시간 이후 약물 농도가 치료 범위 이하로 떨어질 수 있습니다. 증량 및 투약 간격 조절이 필요할 수 있습니다.
        </div>
      </div>

      {/* 환자 TDM 상세 정보 섹션 */}
      <TDMPatientDetails 
        currentPatient={currentPatient}
        selectedPrescription={selectedPrescription}
        latestBloodTest={latestBloodTest}
      />

      {/* PK Simulation 그래프 (가로 전체) */}
      <div className="w-full bg-white dark:bg-slate-900 rounded-lg p-6 shadow flex flex-col items-center">
        <div className="w-full max-w-5xl">
          <PKCharts
            simulationData={simulationData}
            showSimulation={true}
            currentPatientName={currentPatient.name}
            selectedDrug={selectedDrug}
          />
        </div>
      </div>

      {/* 용법 탐색 영역 (그래프 넓게) */}
      <div className="bg-white dark:bg-slate-900 rounded-lg p-6 mt-6 shadow">
        <div className="font-bold text-lg mb-4">용법 탐색</div>
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="current">현 용법 유지</TabsTrigger>
            <TabsTrigger value="dose">용량 조정</TabsTrigger>
            <TabsTrigger value="interval">투여 간격 조정</TabsTrigger>
          </TabsList>
          <TabsContent value="current">
            <div className="mb-2 font-semibold">1. 현 용법 유지</div>
            <div className="mb-2 text-sm text-muted-foreground">
              현재 용법을 유지할 경우, 투약 6시간 이후 약물 농도가 치료 범위 아래로 떨어질 수 있습니다.<br />
              용량 또는 투여 간격 조정이 필요할 수 있습니다.
            </div>
            <div className="w-full max-w-5xl mx-auto">
              <PKCharts
                simulationData={simulationData}
                showSimulation={true}
                currentPatientName={currentPatient.name}
                selectedDrug={selectedDrug}
              />
            </div>
          </TabsContent>
          <TabsContent value="dose">
            <div className="mb-2 font-semibold">2. 용량 조정</div>
            <div className="flex gap-2 items-center mb-2">
              <span>용량:</span>
              <select
                className="border rounded px-2 py-1 w-24"
                value={doseAdjust || simulationParams.dose.split(' ')[0]}
                onChange={e => setDoseAdjust(e.target.value + ' ' + doseUnit)}
              >
                {[50, 100, 200, 250, 500, 1000].map(val => (
                  <option key={val} value={val}>{val}</option>
                ))}
              </select>
              <select
                className="border rounded px-2 py-1 w-16"
                value={doseUnit}
                onChange={e => {
                  setDoseUnit(e.target.value);
                  setDoseAdjust((doseAdjust || simulationParams.dose.split(' ')[0]) + ' ' + e.target.value);
                }}
              >
                <option value="mg">mg</option>
                <option value="정">정</option>
              </select>
              <button className="ml-2 px-3 py-1 bg-blue-600 text-white rounded" onClick={() => setSimulationParams({ ...simulationParams, dose: doseAdjust || simulationParams.dose })}>그래프 출력</button>
            </div>
            <div className="w-full max-w-5xl mx-auto">
              <PKCharts
                simulationData={generateSimulationData()}
                showSimulation={true}
                currentPatientName={currentPatient.name}
                selectedDrug={selectedDrug}
              />
            </div>
          </TabsContent>
          <TabsContent value="interval">
            <div className="mb-2 font-semibold">3. 투여 간격 조정</div>
            <div className="flex gap-2 items-center mb-2">
              <span>투여 간격 (half-life, h):</span>
              <select
                className="border rounded px-2 py-1 w-24"
                value={intervalAdjust || simulationParams.halfLife}
                onChange={e => setIntervalAdjust(e.target.value)}
              >
                {[1,2,3,6,8,12,24,48].map(val => (
                  <option key={val} value={val}>{val}</option>
                ))}
              </select>
              <button className="ml-2 px-3 py-1 bg-blue-600 text-white rounded" onClick={() => setSimulationParams({ ...simulationParams, halfLife: intervalAdjust || simulationParams.halfLife })}>그래프 출력</button>
            </div>
            <div className="w-full max-w-5xl mx-auto">
              <PKCharts
                simulationData={generateSimulationData()}
                showSimulation={true}
                currentPatientName={currentPatient.name}
                selectedDrug={selectedDrug}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* PDF 보고서 생성 버튼 (하단 우측, 문서 아이콘 포함) */}
      <div className="flex justify-end">
        <button
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded shadow mt-4"
          onClick={handleDownloadPDF}
        >
          <FileText className="h-5 w-5" />
          약물등록학 해석 보고서 생성
        </button>
      </div>
    </div>
  );
};

export default PKSimulation;
