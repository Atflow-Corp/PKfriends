import { useState, useRef } from "react";
import { Patient, Prescription, BloodTest, DrugAdministration } from "@/pages/Index";
import PKParameterCard from "./pk/PKParameterCard";
import PKControlPanel from "./pk/PKControlPanel";
import PKCharts from "./pk/PKCharts";
import PKDataSummary from "./pk/PKDataSummary";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { FileText } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface PKSimulationProps {
  patients: Patient[];
  prescriptions: Prescription[];
  bloodTests: BloodTest[];
  selectedPatient: Patient | null;
  drugAdministrations?: DrugAdministration[];
}

const PKSimulation = ({ patients, prescriptions, bloodTests, selectedPatient, drugAdministrations = [] }: PKSimulationProps) => {
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
  const [tdmResult, setTdmResult] = useState<any | null>(null);

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

  const selectedDrugTests = selectedDrug 
    ? patientBloodTests.filter(b => b.drugName === selectedDrug)
    : [];

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

  // TDM API integration
  const buildTdmRequestBody = () => {
    const currentPatient = patients.find(p => p.id === selectedPatientId);
    const tdmPrescription = prescriptions.find(p => p.patientId === selectedPatientId);
    if (!currentPatient || !tdmPrescription) return null;

    // Infer some defaults; map from available data
    const weight = currentPatient.weight;
    const age = currentPatient.age;
    const sex = currentPatient.gender === "male" ? 1 : 0;
    const crcl = 90; // no explicit CRCL entry in model; could be derived later
    const tau = 12; // default dosing interval hours
    const amount = Number(simulationParams.dose || 0) || 100; // mg
    const toxi = 1;
    const aucTarget = 400; // default example
    const cTroughTarget = 10; // default example

    const dataset = [] as any[];
    // Build at least one dosing and one observation event based on drugAdministrations and bloodTests
    const patientDose = (drugAdministrations || []).find(d => d.patientId === selectedPatientId);
    if (patientDose) {
      const rate = patientDose.isIVInfusion && patientDose.infusionTime
        ? (patientDose.dose / (patientDose.infusionTime / 60))
        : 0;
      dataset.push({
        ID: selectedPatientId,
        TIME: 0.0,
        DV: null,
        AMT: patientDose.dose,
        RATE: rate,
        CMT: 1,
        WT: weight,
        SEX: sex,
        AGE: age,
        CRCL: crcl,
        TOXI: toxi,
        EVID: 1
      });
    } else {
      dataset.push({
        ID: selectedPatientId,
        TIME: 0.0,
        DV: null,
        AMT: amount,
        RATE: 0,
        CMT: 1,
        WT: weight,
        SEX: sex,
        AGE: age,
        CRCL: crcl,
        TOXI: toxi,
        EVID: 1
      });
    }

    const blood = patientBloodTests[0];
    if (blood) {
      dataset.push({
        ID: selectedPatientId,
        TIME: 2.0,
        DV: blood.concentration,
        AMT: 0,
        RATE: 0,
        CMT: 1,
        WT: weight,
        SEX: sex,
        AGE: age,
        CRCL: crcl,
        TOXI: toxi,
        EVID: 0
      });
    } else {
      dataset.push({
        ID: selectedPatientId,
        TIME: 2.0,
        DV: null,
        AMT: 0,
        RATE: 0,
        CMT: 1,
        WT: weight,
        SEX: sex,
        AGE: age,
        CRCL: crcl,
        TOXI: toxi,
        EVID: 0
      });
    }

    return {
      input_tau: tau,
      input_amount: amount,
      input_WT: weight,
      input_CRCL: crcl,
      input_AGE: age,
      input_SEX: sex,
      input_TOXI: toxi,
      input_AUC: aucTarget,
      input_CTROUGH: cTroughTarget,
      dataset
    };
  };

  const callTdmApi = async () => {
    const body = buildTdmRequestBody();
    if (!body) return;
    try {
      const response = await fetch("http://tdm-tdm-1b97e-108747164-7c031844d2ae.kr.lb.naverncp.com/tdm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        throw new Error(`TDM API error: ${response.status}`);
      }
      const data = await response.json();
      setTdmResult(data);
      try {
        const key = `tdmfriends:tdmResult:${selectedPatientId}`;
        window.localStorage.setItem(key, JSON.stringify(data));
      } catch {}
    } catch (err) {
      console.error(err);
    }
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
      {/* TDM API Actions */}
      <div className="flex gap-2 justify-end">
        <button
          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded"
          onClick={callTdmApi}
          disabled={!selectedPatientId}
        >
          TDM API 실행 및 저장
        </button>
        {tdmResult && (
          <button
            className="px-3 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded"
            onClick={() => {
              const key = `tdmfriends:tdmResult:${selectedPatientId}`;
              const raw = window.localStorage.getItem(key);
              if (raw) {
                try { setTdmResult(JSON.parse(raw)); } catch {}
              }
            }}
          >
            저장된 결과 불러오기
          </button>
        )}
      </div>

      {/* PK Parameter 섹션 */}
      <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4 mb-2">
        <div className="font-bold mb-1">PK Parameter</div>
        <pre className="text-sm whitespace-pre-line text-slate-700 dark:text-slate-200">{pkParameterText}</pre>
      </div>

      {tdmResult && (
        <div className="bg-emerald-50 dark:bg-emerald-900/30 rounded-lg p-4">
          <div className="font-bold mb-2 text-emerald-800 dark:text-emerald-200">최근 TDM 결과 (로컬 저장)</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div>AUC_before: {tdmResult.AUC_before ?? '-'}</div>
            <div>CMAX_before: {tdmResult.CMAX_before ?? '-'}</div>
            <div>CTROUGH_before: {tdmResult.CTROUGH_before ?? '-'}</div>
            <div>AUC_after: {tdmResult.AUC_after ?? '-'}</div>
            <div>CMAX_after: {tdmResult.CMAX_after ?? '-'}</div>
            <div>CTROUGH_after: {tdmResult.CTROUGH_after ?? '-'}</div>
          </div>
        </div>
      )}

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
