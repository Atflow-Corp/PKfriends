import { useState, useRef, useEffect, useCallback, useMemo } from "react";
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

// TDM API 응답 및 데이터셋 최소 타입 정의 (필요 필드만 선언)
type ConcentrationPoint = {
  time: number;
  IPRED?: number;
};

interface TdmApiResponse {
  AUC_before?: number;
  CMAX_before?: number;
  CTROUGH_before?: number;
  AUC_after?: number;
  CMAX_after?: number;
  CTROUGH_after?: number;
  IPRED_CONC?: ConcentrationPoint[];
  PRED_CONC?: ConcentrationPoint[];
}

interface TdmDatasetRow {
  ID: string;
  TIME: number;
  DV: number | null;
  AMT: number;
  RATE: number;
  CMT: number;
  WT: number;
  SEX: number;
  AGE: number;
  CRCL: number;
  TOXI: number;
  EVID: number;
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
  const [selectedDose, setSelectedDose] = useState("250");
  const [doseAdjust, setDoseAdjust] = useState("");
  const [doseUnit, setDoseUnit] = useState("mg");
  const [intervalAdjust, setIntervalAdjust] = useState("");
  const [selectedInterval, setSelectedInterval] = useState("6");
  const [tab, setTab] = useState("current");
  const [tdmResult, setTdmResult] = useState<TdmApiResponse | null>(null);
  const [tdmChartDataMain, setTdmChartDataMain] = useState<ChartPoint[]>([]);
  const [tdmChartDataDose, setTdmChartDataDose] = useState<ChartPoint[]>([]);
  const [tdmChartDataInterval, setTdmChartDataInterval] = useState<ChartPoint[]>([]);
  const [tdmExtraSeries, setTdmExtraSeries] = useState<{ ipredSeries: { time: number; value: number }[]; predSeries: { time: number; value: number }[]; observedSeries: { time: number; value: number }[] } | null>(null);
  const [tdmExtraSeriesDose, setTdmExtraSeriesDose] = useState<{ ipredSeries: { time: number; value: number }[]; predSeries: { time: number; value: number }[]; observedSeries: { time: number; value: number }[] } | null>(null);
  const [tdmExtraSeriesInterval, setTdmExtraSeriesInterval] = useState<{ ipredSeries: { time: number; value: number }[]; predSeries: { time: number; value: number }[]; observedSeries: { time: number; value: number }[] } | null>(null);
  const [tdmResultDose, setTdmResultDose] = useState<TdmApiResponse | null>(null);
  const [tdmResultInterval, setTdmResultInterval] = useState<TdmApiResponse | null>(null);

  const currentPatient = patients.find(p => p.id === selectedPatientId);
  const patientPrescriptions = useMemo(() => (
    selectedPatientId ? prescriptions.filter(p => p.patientId === selectedPatientId) : []
  ), [selectedPatientId, prescriptions]);
  const patientBloodTests = useMemo(() => (
    selectedPatientId ? bloodTests.filter(b => b.patientId === selectedPatientId) : []
  ), [selectedPatientId, bloodTests]);

  const availableDrugs = useMemo(() => Array.from(new Set([
    ...patientPrescriptions.map(p => p.drugName),
    ...patientBloodTests.map(b => b.drugName)
  ])), [patientPrescriptions, patientBloodTests]);

  // 사용 가능한 약물이 있고 선택된 약물이 없으면 첫 번째 약물 자동 선택
  useEffect(() => {
    if (availableDrugs.length > 0 && !selectedDrug) {
      setSelectedDrug(availableDrugs[0]);
    }
  }, [availableDrugs, selectedDrug]);

  const selectedDrugTests = useMemo(() => (
    selectedDrug ? patientBloodTests.filter(b => b.drugName === selectedDrug) : []
  ), [selectedDrug, patientBloodTests]);

  // 선택된 약물의 처방 정보 가져오기
  const selectedPrescription = selectedDrug 
    ? patientPrescriptions.find(p => p.drugName === selectedDrug)
    : null;

  // 혈청 크레아티닌 정보 가져오기 (가장 최근 검사 결과)
  const latestBloodTest = patientBloodTests.length > 0 
    ? [...patientBloodTests].sort((a, b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime())[0]
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
  const getSelectedRenalInfo = useCallback(() => {
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
  }, [selectedPatientId]);

  const computeCRCL = useCallback((weightKg: number, ageYears: number, sex01: number) => {
    const renal = getSelectedRenalInfo();
    if (renal) {
      const parsedResult = parseFloat((renal.result || '').toString().replace(/[^0-9.-]/g, ''));
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
  }, [currentPatient, getSelectedRenalInfo]);

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

  const computeTauFromAdministrations = useCallback((events: DrugAdministration[]) => {
    if (events.length < 2) return undefined;
    const sorted = [...events].sort((a, b) => toDate(a.date, a.time).getTime() - toDate(b.date, b.time).getTime());
    const last = sorted[sorted.length - 1];
    const prev = sorted[sorted.length - 2];
    const tauHours = hoursDiff(toDate(last.date, last.time), toDate(prev.date, prev.time));
    return tauHours > 0 ? tauHours : undefined;
  }, []);

  // TDM API integration
  const buildTdmRequestBody = useCallback((overrides?: { amount?: number; tau?: number }) => {
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
    const parseDose = (val: unknown) => {
      const num = parseFloat((val ?? '').toString().replace(/[^0-9.-]/g, ''));
      return Number.isFinite(num) && num > 0 ? num : undefined;
    };
    const amount = overrides?.amount ?? (lastDose ? lastDose.dose : parseDose(simulationParams.dose));
    const toxi = 1;
    const { auc: aucTarget, trough: cTroughTarget } = parseTargetValue(tdmPrescription.tdmTarget, tdmPrescription.tdmTargetValue);

    const dataset: TdmDatasetRow[] = [];
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
          TIME: Math.max(0, t),
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
  }, [patients, selectedPatientId, prescriptions, drugAdministrations, simulationParams, selectedDrug, patientBloodTests, computeCRCL, computeTauFromAdministrations]);

  const toChartData = useCallback((apiData: TdmApiResponse | null | undefined, obsDataset?: TdmDatasetRow[] | null): ChartPoint[] => {
    try {
      const ipred = apiData?.IPRED_CONC || [];
      const pred = apiData?.PRED_CONC || [];
      const pointMap = new Map<number, (ChartPoint & { controlGroup?: number })>();

      // helper to get or create point
      const getPoint = (t: number): ChartPoint & { controlGroup?: number } => {
        const key = Number(t) || 0;
        const existing = pointMap.get(key);
        if (existing) return existing;
        const created: ChartPoint & { controlGroup?: number } = { time: key, predicted: 0, observed: null, controlGroup: 0 };
        pointMap.set(key, created);
        return created;
      };

      // IPRED_CONC -> predicted (use API unit as-is)
      for (const p of ipred as Array<{ time: number; IPRED?: number }>) {
        const t = Number(p.time) || 0;
        const y = (Number((p.IPRED ?? 0)) || 0);
        const pt = getPoint(t);
        pt.predicted = y;
      }
      // PRED_CONC -> controlGroup
      for (const p of pred as Array<{ time: number; IPRED?: number }>) {
        const t = Number(p.time) || 0;
        const y = (Number((p.IPRED ?? 0)) || 0);
        const pt = getPoint(t);
        pt.controlGroup = y;
      }
      // Observed from input dataset DV (mg/L -> ng/mL)
      if (obsDataset && obsDataset.length > 0) {
        for (const row of obsDataset) {
          if (row.EVID === 0 && row.DV != null) {
            const t = Number(row.TIME) || 0;
            const y = Number(row.DV);
            const pt = getPoint(t);
            pt.observed = y;
          }
        }
      }
      const result = Array.from(pointMap.values()).sort((a, b) => a.time - b.time);
      return result;
    } catch {
      return [];
    }
  }, []);


  // Load persisted TDM result upon entering Let's TDM
  useEffect(() => {
    if (!selectedPatientId) return;
    try {
      const raw = window.localStorage.getItem(`tdmfriends:tdmResult:${selectedPatientId}`);
      if (raw) {
        const data = JSON.parse(raw);
        setTdmResult(data);
        const bodyForObs = buildTdmRequestBody();
        setTdmChartDataMain(toChartData(data, (bodyForObs?.dataset as TdmDatasetRow[]) || []));
        setTdmExtraSeries({
          ipredSeries: (data?.IPRED_CONC || [])
            .map((p: { time: number; IPRED?: number }) => ({ time: Number(p.time) || 0, value: (Number(p.IPRED ?? 0) || 0) }))
            .filter(p => p.time >= 0 && p.time <= 72),
          predSeries: (data?.PRED_CONC || [])
            .map((p: { time: number; IPRED?: number }) => ({ time: Number(p.time) || 0, value: (Number(p.IPRED ?? 0) || 0) }))
            .filter(p => p.time >= 0 && p.time <= 72),
          observedSeries: ((bodyForObs?.dataset as TdmDatasetRow[]) || [])
            .filter(r => r.EVID === 0 && r.DV != null)
            .map(r => ({ time: Number(r.TIME) || 0, value: Number(r.DV) }))
            .filter(p => p.time >= 0 && p.time <= 72)
        });
        setShowSimulation(true);
      } else {
        setTdmChartDataMain([]);
      }
    } catch (e) {
      console.warn('Failed to read TDM result from localStorage', e);
    }
    // reset per-tab results when patient changes
    setTdmResultDose(null);
    setTdmResultInterval(null);
    setTdmChartDataDose([]);
    setTdmChartDataInterval([]);
  }, [selectedPatientId, toChartData, buildTdmRequestBody]);

  const getTargetBand = (): { min?: number; max?: number } => {
    const cp = patientPrescriptions.find(p => p.drugName === selectedDrug) || patientPrescriptions[0];
    const target = (cp?.tdmTarget || '').toLowerCase();
    // AUC 목표는 제외
    if (!target || target.includes('auc')) return {};
    // Ctrough 또는 Cmax인 경우만 범위 표시
    if (target.includes('trough') || target.includes('cmax')) {
      const nums = (cp?.tdmTargetValue || '').match(/\d+\.?\d*/g) || [];
      const min = nums[0] ? parseFloat(nums[0]) : undefined;
      const max = nums[1] ? parseFloat(nums[1]) : undefined;
      // 숫자 2개일 때만 표시되도록 PKCharts 쪽 조건과 맞춤 (max > min)
      return { min, max };
    }
    return {};
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
        drugAdministrations={drugAdministrations}
      />

      {/* PK Simulation 그래프 (가로 전체) */}
      <div className="w-full">
        <PKCharts
          showSimulation={true}
          currentPatientName={currentPatient.name}
          selectedDrug={selectedDrug}
          targetMin={getTargetBand().min}
          targetMax={getTargetBand().max}
          recentAUC={tdmResult?.AUC_before}
          recentMax={tdmResult?.CMAX_before}
          recentTrough={tdmResult?.CTROUGH_before}
          predictedAUC={tdmResult?.AUC_after}
          predictedMax={tdmResult?.CMAX_after}
          predictedTrough={tdmResult?.CTROUGH_after}
          ipredSeries={tdmExtraSeries?.ipredSeries}
          predSeries={tdmExtraSeries?.predSeries}
          observedSeries={tdmExtraSeries?.observedSeries}
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

            <div className="space-y-3 mb-4">
              <div className="flex gap-2 mb-3">
                <button
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedDose === "125"
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                  onClick={() => {
                    setSelectedDose("125");
                    setSimulationParams({ ...simulationParams, dose: "125 mg" });
                  }}
                >
                  125 mg
                </button>
                <button
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedDose === "250"
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                  onClick={() => {
                    setSelectedDose("250");
                    setSimulationParams({ ...simulationParams, dose: "250 mg" });
                  }}
                >
                  250 mg
                </button>
                <button
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedDose === "500"
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                  onClick={() => {
                    setSelectedDose("500");
                    setSimulationParams({ ...simulationParams, dose: "500 mg" });
                  }}
                >
                  500 mg
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
