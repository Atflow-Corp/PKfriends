import { useState, useRef, useEffect } from "react";
import { Patient, Prescription, BloodTest, DrugAdministration } from "@/pages/Index";
import PKParameterCard from "./pk/PKParameterCard";
import PKControlPanel from "./pk/PKControlPanel";
import PKCharts from "./pk/PKCharts";
import DosageChart from "./pk/DosageChart";
import PKDataSummary from "./pk/PKDataSummary";
import TDMPatientDetails from "./TDMPatientDetails";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { FileText } from "lucide-react";

interface PKSimulationProps {
  patients: Patient[];
  prescriptions: Prescription[];
  bloodTests: BloodTest[];
  selectedPatient: Patient | null;
  drugAdministrations?: DrugAdministration[];
}

type ChartPoint = { time: number; predicted: number; observed: number | null };

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
  const [tdmChartDataMain, setTdmChartDataMain] = useState<ChartPoint[]>([]);
  const [tdmChartDataDose, setTdmChartDataDose] = useState<ChartPoint[]>([]);
  const [tdmChartDataInterval, setTdmChartDataInterval] = useState<ChartPoint[]>([]);
  const [tdmResultDose, setTdmResultDose] = useState<any | null>(null);
  const [tdmResultInterval, setTdmResultInterval] = useState<any | null>(null);

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
  useEffect(() => {
    if (availableDrugs.length > 0 && !selectedDrug) {
      setSelectedDrug(availableDrugs[0]);
    }
  }, [availableDrugs.length, selectedDrug]);

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

  // Helpers
  const getSelectedRenalInfo = () => {
    try {
      if (!selectedPatientId) return null;
      const raw = window.localStorage.getItem(`tdmfriends:renal:${selectedPatientId}`);
      if (!raw) return null;
      const list = JSON.parse(raw) as Array<{ id: string; creatinine: string; date: string; formula: string; result: string; dialysis: string; renalReplacement: string; isSelected: boolean }>;
      const chosen = list.find(item => item.isSelected) || list[list.length - 1];
      return chosen || null;
    } catch {
      return null;
    }
  };

  const computeCRCL = (weightKg: number, ageYears: number, sex01: number) => {
    const renal = getSelectedRenalInfo();
    if (renal) {
      const parsedResult = parseFloat((renal.result || '').toString().replace(/[^0-9.\-]/g, ''));
      // If result field already has a numeric value, prefer it
      if (!Number.isNaN(parsedResult) && parsedResult > 0) {
        return parsedResult; // assume mL/min
      }
      const scrMgDl = parseFloat((renal.creatinine || '').toString());
      const isFemale = sex01 === 0;
      const heightCm = currentPatient?.height ?? 0;
      const bsa = heightCm > 0 && weightKg > 0 ? Math.sqrt((weightKg * heightCm) / 3600) : 1.73; // Mosteller

      if (!Number.isNaN(scrMgDl) && scrMgDl > 0) {
        if (renal.formula === 'cockcroft-gault') {
          const base = ((140 - ageYears) * weightKg) / (72 * scrMgDl);
          return isFemale ? base * 0.85 : base;
        }
        if (renal.formula === 'mdrd') {
          // MDRD (IDMS-traceable, race ignored)
          const eGFR = 175 * Math.pow(scrMgDl, -1.154) * Math.pow(ageYears, -0.203) * (isFemale ? 0.742 : 1);
          return eGFR * (bsa / 1.73);
        }
        if (renal.formula === 'ckd-epi') {
          // CKD-EPI 2009 (race ignored)
          const k = isFemale ? 0.7 : 0.9;
          const a = isFemale ? -0.329 : -0.411;
          const minScrK = Math.min(scrMgDl / k, 1);
          const maxScrK = Math.max(scrMgDl / k, 1);
          const eGFR = 141 * Math.pow(minScrK, a) * Math.pow(maxScrK, -1.209) * Math.pow(0.993, ageYears) * (isFemale ? 1.018 : 1);
          return eGFR * (bsa / 1.73);
        }
        // Fallback to Cockcroft-Gault if unknown formula label
        const base = ((140 - ageYears) * weightKg) / (72 * scrMgDl);
        return isFemale ? base * 0.85 : base;
      }
    }
    return 90; // fallback if data unavailable
  };

  const parseTargetValue = (target?: string, value?: string) => {
    // returns { auc?: number, trough?: number }
    if (!value) return {} as { auc?: number; trough?: number };
    const nums = (value.match(/\d+\.?\d*/g) || []).map(v => parseFloat(v));
    if (nums.length === 0) return {} as { auc?: number; trough?: number };
    const mid = nums.length === 1 ? nums[0] : (nums[0] + nums[1]) / 2;
    if (target && target.toLowerCase().includes('auc')) {
      return { auc: mid };
    }
    if (target && target.toLowerCase().includes('trough')) {
      return { trough: mid };
    }
    return {} as { auc?: number; trough?: number };
  };

  const toDate = (d: string, t: string) => new Date(`${d}T${t}`);

  const hoursDiff = (later: Date, earlier: Date) => (later.getTime() - earlier.getTime()) / 36e5;

  const computeTauFromAdministrations = (events: DrugAdministration[]) => {
    if (events.length < 2) return undefined;
    const sorted = [...events].sort((a, b) => toDate(a.date, a.time).getTime() - toDate(b.date, b.time).getTime());
    const last = sorted[sorted.length - 1];
    const prev = sorted[sorted.length - 2];
    const tauHours = hoursDiff(toDate(last.date, last.time), toDate(prev.date, prev.time));
    return tauHours > 0 ? tauHours : undefined;
  };

  // TDM API integration
  const buildTdmRequestBody = (overrides?: { amount?: number; tau?: number }) => {
    const currentPatient = patients.find(p => p.id === selectedPatientId);
    const tdmPrescription = prescriptions.find(p => p.patientId === selectedPatientId);
    if (!currentPatient || !tdmPrescription) return null;

    // Map from available data
    const weight = currentPatient.weight;
    const age = currentPatient.age;
    const sex = currentPatient.gender === "male" ? 1 : 0;
    const crcl = computeCRCL(weight, age, sex);

    const patientDoses = (drugAdministrations || []).filter(d => d.patientId === selectedPatientId);
    const uiTau = parseFloat((simulationParams.halfLife || '').toString());
    const tau = overrides?.tau ?? (Number.isFinite(uiTau) && uiTau > 0 ? uiTau : computeTauFromAdministrations(patientDoses) ?? undefined);
    const lastDose = patientDoses.length > 0 ? [...patientDoses].sort((a, b) => toDate(a.date, a.time).getTime() - toDate(b.date, b.time).getTime())[patientDoses.length - 1] : undefined;
    const parseDose = (val: any) => {
      const num = parseFloat((val ?? '').toString().replace(/[^0-9.\-]/g, ''));
      return Number.isFinite(num) && num > 0 ? num : undefined;
    };
    const amount = overrides?.amount ?? (lastDose ? lastDose.dose : parseDose(simulationParams.dose));
    const toxi = 1;
    const { auc: aucTarget, trough: cTroughTarget } = parseTargetValue(tdmPrescription.tdmTarget, tdmPrescription.tdmTargetValue);

    const dataset = [] as any[];
    // Build dosing events relative to first dose time
    const sortedDoses = [...patientDoses].sort((a, b) => toDate(a.date, a.time).getTime() - toDate(b.date, b.time).getTime());
    const anchorDoseTime = sortedDoses.length > 0 ? toDate(sortedDoses[0].date, sortedDoses[0].time) : undefined;
    if (sortedDoses.length > 0 && anchorDoseTime) {
      for (const d of sortedDoses) {
        const t = hoursDiff(toDate(d.date, d.time), anchorDoseTime);
        const rate = d.isIVInfusion && d.infusionTime ? (d.dose / (d.infusionTime / 60)) : 0;
        dataset.push({
          ID: selectedPatientId,
          TIME: Math.max(0, t),
          DV: null,
          AMT: d.dose,
          RATE: rate,
          CMT: 1,
          WT: weight,
          SEX: sex,
          AGE: age,
          CRCL: crcl,
          TOXI: toxi,
          EVID: 1
        });
      }
    } else if (amount !== undefined) {
      // single immediate dose if no history exists
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

    // Observation events
    const anchor = anchorDoseTime || (sortedDoses.length > 0 ? toDate(sortedDoses[0].date, sortedDoses[0].time) : new Date());
    const relatedTests = selectedDrug ? patientBloodTests.filter(b => b.drugName === selectedDrug) : patientBloodTests;
    if (relatedTests.length > 0) {
      for (const b of relatedTests) {
        const t = hoursDiff(b.testDate, anchor);
        // Convert ng/mL -> mg/L if needed
        const dvMgPerL = b.unit && b.unit.toLowerCase().includes('ng/ml') ? (b.concentration / 1000) : b.concentration;
        dataset.push({
          ID: selectedPatientId,
          TIME: t,
          DV: dvMgPerL,
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
    } else {
      // Add one observation point without DV at tau or 2h if tau unavailable
      dataset.push({
        ID: selectedPatientId,
        TIME: (tau ?? 2.0),
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
      input_tau: (tau ?? 12),
      input_amount: (amount ?? 100),
      input_WT: weight,
      input_CRCL: crcl,
      input_AGE: age,
      input_SEX: sex,
      input_TOXI: toxi,
      input_AUC: aucTarget ?? undefined,
      input_CTROUGH: cTroughTarget ?? undefined,
      dataset
    };
  };

  const toChartData = (apiData: any): ChartPoint[] => {
    try {
      const series = (apiData?.IPRED_CONC?.length ? apiData.IPRED_CONC : apiData?.PRED_CONC) || [];
      const base: ChartPoint[] = series.map((p: any) => ({
        time: Number(p.time) || 0,
        // API 예측 단위가 mg/L라고 가정하고 ng/mL로 변환 (×1000)
        predicted: ((Number(p.IPRED ?? p.PRED ?? p.pred ?? 0) || 0) * 1000),
        observed: null
      }));
      // Overlay observed points
      const addObserved = (points: ChartPoint[]) => {
        const obsList = selectedDrug ? patientBloodTests.filter(b => b.drugName === selectedDrug) : patientBloodTests;
        for (const b of obsList) {
          // estimate time relative to first dose anchor used earlier is unknown here; best effort: align by closest time
          const t = b.timeAfterDose ?? undefined;
          if (t !== undefined && t !== null) {
            const dv = b.concentration;
            // find nearest index
            let idx = -1; let minDiff = Infinity;
            for (let i = 0; i < points.length; i++) {
              const d = Math.abs(points[i].time - t);
              if (d < minDiff) { minDiff = d; idx = i; }
            }
            if (idx >= 0) {
              points[idx] = { ...points[idx], observed: dv };
            } else {
              points.push({ time: t, predicted: 0, observed: dv });
            }
          }
        }
        return points.sort((a, b) => a.time - b.time);
      };
      return addObserved(base);
    } catch {
      return [];
    }
  };

  const callTdmApi = async (overrides?: { amount?: number; tau?: number }) => {
    const body = buildTdmRequestBody(overrides);
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
      setTdmChartDataMain(toChartData(data));
      setShowSimulation(true);
      try {
        const key = `tdmfriends:tdmResult:${selectedPatientId}`;
        window.localStorage.setItem(key, JSON.stringify(data));
      } catch {}
    } catch (err) {
      console.error(err);
    }
  };

  // Independent calls for per-tab simulations
  const callTdmApiDose = async (overrides?: { amount?: number }) => {
    const body = buildTdmRequestBody({ amount: overrides?.amount, tau: undefined });
    if (!body) return;
    try {
      const response = await fetch("http://tdm-tdm-1b97e-108747164-7c031844d2ae.kr.lb.naverncp.com/tdm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error(`TDM API error: ${response.status}`);
      const data = await response.json();
      setTdmResultDose(data);
      setTdmChartDataDose(toChartData(data));
    } catch (e) { console.error(e); }
  };

  const callTdmApiInterval = async (overrides?: { tau?: number }) => {
    const body = buildTdmRequestBody({ amount: undefined, tau: overrides?.tau });
    if (!body) return;
    try {
      const response = await fetch("http://tdm-tdm-1b97e-108747164-7c031844d2ae.kr.lb.naverncp.com/tdm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error(`TDM API error: ${response.status}`);
      const data = await response.json();
      setTdmResultInterval(data);
      setTdmChartDataInterval(toChartData(data));
    } catch (e) { console.error(e); }
  };

  // Load persisted TDM result upon entering Let's TDM
  useEffect(() => {
    if (!selectedPatientId) return;
    try {
      const raw = window.localStorage.getItem(`tdmfriends:tdmResult:${selectedPatientId}`);
      if (raw) {
        const data = JSON.parse(raw);
        setTdmResult(data);
        setTdmChartDataMain(toChartData(data));
        setShowSimulation(true);
      } else {
        setTdmChartDataMain([]);
      }
    } catch {}
    // reset per-tab results when patient changes
    setTdmResultDose(null);
    setTdmResultInterval(null);
    setTdmChartDataDose([]);
    setTdmChartDataInterval([]);
  }, [selectedPatientId]);

  const getTargetBand = (): { min?: number; max?: number } => {
    if (tdmResult) {
      const min = typeof tdmResult.CTROUGH_after === 'number' ? tdmResult.CTROUGH_after : undefined;
      const max = typeof tdmResult.CMAX_after === 'number' ? tdmResult.CMAX_after : undefined;
      if (min !== undefined || max !== undefined) return { min, max };
    }
    const cp = patientPrescriptions.find(p => p.drugName === selectedDrug) || patientPrescriptions[0];
    const nums = (cp?.tdmTargetValue || '').match(/\d+\.?\d*/g) || [];
    const min = nums[0] ? parseFloat(nums[0]) : undefined;
    const max = nums[1] ? parseFloat(nums[1]) : undefined;
    return { min, max };
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
      {/* Buttons removed per requirement */}

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
            simulationData={tdmChartDataMain.length > 0 ? tdmChartDataMain : simulationData}
            showSimulation={true}
            currentPatientName={currentPatient.name}
            selectedDrug={selectedDrug}
            targetMin={getTargetBand().min}
            targetMax={getTargetBand().max}
          />
        </div>
      </div>

      {/* 환자 TDM 상세 정보 섹션 */}
      <TDMPatientDetails 
        currentPatient={currentPatient}
        selectedPrescription={selectedPrescription}
        latestBloodTest={latestBloodTest}
      />

      {/* PK Simulation 그래프 (가로 전체) */}
      <div className="w-full">
        <PKCharts
          simulationData={simulationData}
          showSimulation={true}
          currentPatientName={currentPatient.name}
          selectedDrug={selectedDrug}
        />
      </div>

      {/* 용법 조정 시뮬레이션 영역 */}
      <div className="bg-white dark:bg-slate-900 rounded-lg p-6 mt-6 shadow">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">용법 조정 시뮬레이션</h2>
          <p className="text-gray-600 dark:text-gray-300">
            용법을 조정하고 즉시 예측 결과를 확인해보세요.
          </p>
        </div>
      
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* 용량 조정 시 카드 */}
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border-2 border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-12 h-0.5 bg-pink-500"></div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">용량 조정 시</h3>
            </div>
            
            <div className="w-full max-w-5xl mx-auto">
              <PKCharts
                simulationData={tdmChartDataMain.length > 0 ? tdmChartDataMain : simulationData}
                showSimulation={true}
                currentPatientName={currentPatient.name}
                selectedDrug={selectedDrug}
                targetMin={getTargetBand().min}
                targetMax={getTargetBand().max}
              />
            </div>
          </div>

          {/* 투약 간격 조정 시 카드 */}
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border-2 border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-12 h-0.5 bg-cyan-500"></div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">투약 간격 조정 시</h3>
            </div>
            
            <div className="space-y-3 mb-4">
              <div className="flex gap-2 mb-3">
                <button
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedInterval === "6"
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                  onClick={() => {
                    setSelectedInterval("6");
                    setSimulationParams({ ...simulationParams, halfLife: "6" });
                  }}
                >
                  6시간
                </button>
                <button
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedInterval === "8"
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                  onClick={() => {
                    setSelectedInterval("8");
                    setSimulationParams({ ...simulationParams, halfLife: "8" });
                  }}
                >
                  8시간
                </button>
                <button
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedInterval === "10"
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                  onClick={() => {
                    setSelectedInterval("10");
                    setSimulationParams({ ...simulationParams, halfLife: "10" });
                  }}
                >
                  10시간
                </button>
              </div>
            </div>
            
            {/* 예측 약물 농도 카드 */}
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
              <h4 className="font-semibold text-gray-800 dark:text-white mb-3">예측 약물 농도</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">AUC:</span>
                  <span className="font-semibold text-gray-800 dark:text-white">335 mg*h/L</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">max 농도:</span>
                  <span className="font-semibold text-gray-800 dark:text-white">29 mg/L</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">trough 농도:</span>
                  <span className="font-semibold text-gray-800 dark:text-white">5 mg/L</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="w-full">
          <DosageChart
            simulationData={generateSimulationData()}
            showSimulation={true}
            currentPatientName={currentPatient.name}
            selectedDrug={selectedDrug}
            chartTitle="용법 조정 시뮬레이션"
          />
        </div>
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
