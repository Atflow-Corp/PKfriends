import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Patient, Prescription, BloodTest, DrugAdministration } from "@/pages/Index";
import PKParameterCard from "./pk/PKParameterCard";
import PKControlPanel from "./pk/PKControlPanel";
import PKCharts from "./pk/PKCharts";
import DosageChart from "./pk/DosageChart";
import PKDataSummary from "./pk/PKDataSummary";
import TDMPatientDetails from "./TDMPatientDetails";
import { Button } from "@/components/ui/button";
import { runTdm, buildTdmRequestBody as buildTdmBody } from "@/lib/tdm";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

// TDM 약물 기본 데이터 (PrescriptionStep에서 가져옴)
const TDM_DRUGS = [
  { 
    name: "Vancomycin", 
    indications: ["Not specified/Korean", "Neurosurgical patients/Korean"], 
    targets: [
      { type: "Trough Concentration", value: "10-20 mg/L" },
      { type: "Peak Concentration", value: "25-40 mg/L" },
      { type: "AUC", value: "400-600 mg·h/L" }
    ],
    defaultTargets: {
      "Not specified/Korean": { type: "AUC", value: "400-600 mg·h/L" },
      "Neurosurgical patients/Korean": { type: "AUC", value: "400-600 mg·h/L" }
    }
  },
  { 
    name: "Cyclosporin", 
    indications: ["Renal transplant recipients/Korean", "Allo-HSCT/Korean", "Thoracic transplant recipients/European"], 
    targets: [
      { type: "Trough Concentration", value: "100-400 ng/mL" },
      { type: "Peak Concentration", value: "800-1200 ng/mL" },
      { type: "C2 Concentration", value: "1200-1700 ng/mL" }
    ],
    defaultTargets: {
      "Allo-HSCT/Korean": { type: "Trough Concentration", value: "150-400 ng/mL" },
      "Thoracic transplant recipients/European": { type: "Trough Concentration", value: "170-230 ng/mL" },
      "Renal transplant recipients/Korean": { type: "Trough Concentration", value: "100-400 ng/mL" }
    }
  }
];

interface PKSimulationProps {
  patients: Patient[];
  prescriptions: Prescription[];
  bloodTests: BloodTest[];
  selectedPatient: Patient | null;
  drugAdministrations?: DrugAdministration[];
  onDownloadPDF?: () => void;
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

const PKSimulation = ({ patients, prescriptions, bloodTests, selectedPatient, drugAdministrations = [], onDownloadPDF }: PKSimulationProps) => {
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
  const [adjustmentCards, setAdjustmentCards] = useState<Array<{ id: number; type: 'dosage' | 'interval' }>>([]);
  const [selectedDosage, setSelectedDosage] = useState<{ [cardId: number]: string }>({});
  const [selectedIntervalOption, setSelectedIntervalOption] = useState<{ [cardId: number]: string }>({});
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<number | null>(null);
  const [cardChartData, setCardChartData] = useState<{ [cardId: number]: boolean }>({});
  const [dosageSuggestions, setDosageSuggestions] = useState<{ [cardId: number]: number[] }>({});
  const [dosageLoading, setDosageLoading] = useState<{ [cardId: number]: boolean }>({});
  const suggestTimersRef = useRef<{ [cardId: number]: number }>(() => ({} as any)) as any;

  const currentPatient = patients.find(p => p.id === selectedPatientId);
  const patientPrescriptions = useMemo(() => (
    selectedPatientId ? prescriptions.filter(p => p.patientId === selectedPatientId) : []
  ), [selectedPatientId, prescriptions]);
  const patientBloodTests = useMemo(() => (
    selectedPatientId ? bloodTests.filter(b => b.patientId === selectedPatientId) : []
  ), [selectedPatientId, bloodTests]);

  // TDM 데이터 가져오기 헬퍼 함수
  const getTdmData = useCallback((drugName: string) => {
    const prescription = patientPrescriptions.find(p => p.drugName === drugName);
    const tdmDrug = TDM_DRUGS.find(d => d.name === drugName);
    
    return {
      indication: prescription?.indication || tdmDrug?.indications?.[0] || '적응증',
      target: prescription?.tdmTarget || tdmDrug?.defaultTargets?.[prescription?.indication || '']?.type || tdmDrug?.targets?.[0]?.type || '목표 유형',
      targetValue: prescription?.tdmTargetValue || tdmDrug?.defaultTargets?.[prescription?.indication || '']?.value || tdmDrug?.targets?.[0]?.value || '목표값',
      dosage: prescription?.dosage || 0,
      unit: prescription?.unit || 'mg',
      frequency: prescription?.frequency || '시간'
    };
  }, [patientPrescriptions]);

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

  // 용법 조정 버튼 핸들러
  const handleDosageAdjustment = () => {
    const newCardNumber = adjustmentCards.length + 1;
    setAdjustmentCards(prev => [...prev, { id: newCardNumber, type: 'dosage' }]);
    setCardChartData(prev => ({ ...prev, [newCardNumber]: false })); // 빈 차트로 초기화
    // compute suggestions asynchronously (debounced)
    triggerDosageSuggestions(newCardNumber);
  };

  const handleIntervalAdjustment = () => {
    const newCardNumber = adjustmentCards.length + 1;
    setAdjustmentCards(prev => [...prev, { id: newCardNumber, type: 'interval' }]);
    setCardChartData(prev => ({ ...prev, [newCardNumber]: false })); // 빈 차트로 초기화
  };

  // 카드 삭제 확인 다이얼로그 열기
  const handleRemoveCardClick = (cardId: number) => {
    setCardToDelete(cardId);
    setShowDeleteAlert(true);
  };

  // 카드 삭제 확인
  const handleConfirmDelete = () => {
    if (cardToDelete !== null) {
      setAdjustmentCards(prev => prev.filter(card => card.id !== cardToDelete));
      // 카드 삭제 시 해당 카드의 선택 상태도 제거
      setSelectedDosage(prev => {
        const newState = { ...prev };
        delete newState[cardToDelete];
        return newState;
      });
      setSelectedIntervalOption(prev => {
        const newState = { ...prev };
        delete newState[cardToDelete];
        return newState;
      });
      setCardChartData(prev => {
        const newState = { ...prev };
        delete newState[cardToDelete];
        return newState;
      });
    }
    setShowDeleteAlert(false);
    setCardToDelete(null);
  };

  // 카드 삭제 취소
  const handleCancelDelete = () => {
    setShowDeleteAlert(false);
    setCardToDelete(null);
  };

  // 용량 선택 핸들러
  const handleDosageSelect = (cardId: number, dosage: string) => {
    setSelectedDosage(prev => ({
      ...prev,
      [cardId]: dosage
    }));
    // 버튼 선택 시 차트 그리기 활성화
    setCardChartData(prev => ({ ...prev, [cardId]: true }));
    // 시나리오 적용 (API 호출로 예측값 갱신)
    const amountMg = parseFloat(dosage.replace(/[^0-9.]/g, ''));
    void applyDoseScenario(amountMg);
  };

  // 간격 선택 핸들러
  const handleIntervalSelect = (cardId: number, interval: string) => {
    setSelectedIntervalOption(prev => ({
      ...prev,
      [cardId]: interval
    }));
    // 버튼 선택 시 차트 그리기 활성화
    setCardChartData(prev => ({ ...prev, [cardId]: true }));
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

  // 선택한 용량으로 메인 차트/요약 업데이트
  const applyDoseScenario = useCallback(async (amountMg: number) => {
    try {
      if (!selectedPatientId || !selectedDrug) return;
      const body = buildTdmBody({
        patients,
        prescriptions,
        bloodTests,
        drugAdministrations,
        selectedPatientId,
        selectedDrugName: selectedDrug,
        overrides: { amount: amountMg }
      });
      if (!body) return;
      const data = (await runTdm({ body })) as TdmApiResponse;
      setTdmResult(data);
      setTdmChartDataMain(toChartData(data, (body.dataset as TdmDatasetRow[]) || []));
      setTdmExtraSeries({
        ipredSeries: (data?.IPRED_CONC || []).map((p: any) => ({ time: Number(p.time) || 0, value: Number(p.IPRED ?? 0) || 0 })).filter(p => p.time >= 0 && p.time <= 72),
        predSeries: (data?.PRED_CONC || []).map((p: any) => ({ time: Number(p.time) || 0, value: Number(p.IPRED ?? 0) || 0 })).filter(p => p.time >= 0 && p.time <= 72),
        observedSeries: ((body.dataset as TdmDatasetRow[]) || []).filter((r: any) => r.EVID === 0 && r.DV != null).map((r: any) => ({ time: Number(r.TIME) || 0, value: Number(r.DV) })).filter((p: any) => p.time >= 0 && p.time <= 72)
      });
    } catch (e) {
      console.warn('Failed to apply dose scenario', e);
    }
  }, [patients, prescriptions, bloodTests, drugAdministrations, selectedPatientId, selectedDrug, toChartData]);

  // Helper: compute 6 dosage suggestions by sampling around current/last dose and scoring via API
  const computeDosageSuggestions = useCallback(async (cardId: number) => {
    try {
      setDosageLoading(prev => ({ ...prev, [cardId]: true }));
      const patient = currentPatient;
      if (!patient) return;
      const prescription = patientPrescriptions.find(p => p.drugName === selectedDrug) || patientPrescriptions[0];
      if (!prescription) return;

      // Determine step size per drug and route/form
      const drug = (prescription.drugName || "").toLowerCase();
      let step = 10; // mg
      if (drug === "cyclosporin" || drug === "cyclosporine") {
        // Try to infer form: look for dosageForm in table_maker conditions via localStorage
        let form: string | null = null;
        try {
          const storageKey = patient ? `tdmfriends:conditions:${patient.id}` : null;
          if (storageKey) {
            const raw = window.localStorage.getItem(storageKey);
            if (raw) {
              const parsed = JSON.parse(raw) as Array<{ route?: string; dosageForm?: string }>;
              const oral = parsed.find(c => (c.route === "경구" || c.route === "oral"));
              form = oral?.dosageForm || null;
            }
          }
        } catch {}
        if (form && form.toLowerCase() === "capsule/tablet") step = 25; else step = 10;
      }

      // Base dose: last administration dose or prescription.dosage
      const dosesForPatient = (drugAdministrations || []).filter(d => d.patientId === patient.id && d.drugName === prescription.drugName);
      const lastDose = dosesForPatient.length > 0 ? [...dosesForPatient].sort((a,b) => toDate(a.date,a.time).getTime() - toDate(b.date,b.time).getTime())[dosesForPatient.length-1] : undefined;
      const baseDose = Number(lastDose?.dose || prescription.dosage || 100);

      // Build 6 candidates: +/- 3 steps
      const candidates = [ -3, -2, -1, 1, 2, 3 ].map(k => Math.max(1, baseDose + k * step));

      // Target range for ranking
      const target = (prescription.tdmTarget || '').toLowerCase();
      const nums = (prescription.tdmTargetValue || '').match(/\d+\.?\d*/g) || [];
      const targetMin = nums[0] ? parseFloat(nums[0]) : undefined;
      const targetMax = nums[1] ? parseFloat(nums[1]) : undefined;

      // quick sanity: ensure we can build a body
      const bodyBase = buildTdmBody({
        patients,
        prescriptions,
        bloodTests,
        drugAdministrations,
        selectedPatientId: patient.id,
        selectedDrugName: prescription.drugName,
      });
      if (!bodyBase) return;

      // For each candidate, call API with override amount
      const results = await Promise.all(
        candidates.map(async amt => {
          const body = buildTdmBody({
            patients,
            prescriptions,
            bloodTests,
            drugAdministrations,
            selectedPatientId: patient.id,
            selectedDrugName: prescription.drugName,
            overrides: { amount: amt }
          });
          try {
            const resp = (await runTdm({ body })) as any;
            const trough = Number(((resp?.CTROUGH_after ?? resp?.CTROUGH_before) as number) || 0);
            const auc = Number(((resp?.AUC_after ?? resp?.AUC_before) as number) || 0);
            // score: distance to target range (prefer within range)
            let value = 0;
            if (target.includes('auc') && (targetMin || targetMax)) {
              const mid = (auc || 0);
              const cmin = targetMin ?? mid; const cmax = targetMax ?? mid;
              value = mid < cmin ? (cmin - mid) : (mid > cmax ? (mid - cmax) : 0);
            } else if ((target.includes('trough') || target.includes('cmax')) && (targetMin || targetMax)) {
              const mid = (trough || 0);
              const cmin = targetMin ?? mid; const cmax = targetMax ?? mid;
              value = mid < cmin ? (cmin - mid) : (mid > cmax ? (mid - cmax) : 0);
            } else {
              // fallback to smaller predicted trough distance to previous result
              value = Math.abs((trough || 0) - (tdmResult?.CTROUGH_before || 0));
            }
            return { amt, score: value };
          } catch {
            return { amt, score: Number.POSITIVE_INFINITY };
          }
        })
      );

      const top = results
        .sort((a,b) => a.score - b.score)
        .slice(0, 3)
        .map(r => r.amt)
        .sort((a,b) => a - b); // 오름차순 정렬
      setDosageSuggestions(prev => ({ ...prev, [cardId]: top }));
    } catch {}
    finally {
      setDosageLoading(prev => ({ ...prev, [cardId]: false }));
    }
  }, [patients, prescriptions, bloodTests, drugAdministrations, currentPatient, selectedDrug, patientPrescriptions, tdmResult]);

  // Debounced trigger for dosage suggestions to avoid redundant API calls
  const triggerDosageSuggestions = useCallback((cardId: number) => {
    try {
      if (suggestTimersRef.current?.[cardId]) {
        window.clearTimeout(suggestTimersRef.current[cardId]);
      }
      const timer = window.setTimeout(() => {
        void computeDosageSuggestions(cardId);
      }, 250);
      suggestTimersRef.current[cardId] = timer as unknown as number;
    } catch {
      void computeDosageSuggestions(cardId);
    }
  }, [computeDosageSuggestions]);

  // 선택한 용량으로 메인 차트/요약 업데이트 (정의 위치: toChartData 이후)

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

      {/* PK Parameter 섹션 - 주석처리 */}
      {/* <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4 mb-2">
        <div className="font-bold mb-1">PK Parameter</div>
        <pre className="text-sm whitespace-pre-line text-slate-700 dark:text-slate-200">{pkParameterText}</pre>
      </div> */}

     

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
          // TDM 내역 데이터
          tdmIndication={getTdmData(selectedDrug).indication}
          tdmTarget={getTdmData(selectedDrug).target}
          tdmTargetValue={getTdmData(selectedDrug).targetValue}
          // 투약기록 데이터
          currentDosage={getTdmData(selectedDrug).dosage}
          currentUnit={getTdmData(selectedDrug).unit}
          currentFrequency={getTdmData(selectedDrug).frequency}
        />
      </div>

      {/* 용법 조정 카드들 */}
      {adjustmentCards.map((card) => (
        <div key={`adjustment-${card.id}`} className={`bg-white dark:bg-slate-900 rounded-lg p-6 mt-6 shadow-lg border-2 ${
          card.type === 'dosage' 
            ? 'border-pink-200 dark:border-pink-800' 
            : 'border-green-200 dark:border-green-800'
        }`}>
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">용법 조정 {card.id}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {card.type === 'dosage' 
                  ? '투약 용량을 조정하고 즉시 예측 결과를 확인해보세요'
                  : '투약 시간의 간격을 조정하고 즉시 예측 결과를 확인해보세요'
                }
          </p>
        </div>
            <button 
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl font-bold flex-shrink-0"
              onClick={() => handleRemoveCardClick(card.id)}
            >
              ×
            </button>
            </div>

          {/* 버튼 섹션 */}
          <div className="flex justify-center gap-4 mb-6">
            {card.type === 'dosage' ? (
              // 투약 용량 조정 카드 버튼 - API 기반 제안값 사용 (최대 3개)
              <>
                {(dosageSuggestions[card.id] || []).map((amt) => {
                  const label = `${amt}mg`;
                  return (
                    <Button
                      key={`${card.id}-${amt}`}
                      variant={selectedDosage[card.id] === label ? 'default' : 'outline'}
                      size="default"
                      onClick={() => handleDosageSelect(card.id, label)}
                      className={`${selectedDosage[card.id] === label ? 'bg-black text-white hover:bg-gray-800' : ''} text-base px-6 py-3`}
                    >
                      {label}
                    </Button>
                  );
                })}
                {(!dosageSuggestions[card.id] || dosageSuggestions[card.id].length === 0) && (
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path></svg>
                    제안을 계산 중...
                  </span>
                )}
              </>
            ) : (
              // 투약 시간 조정 카드 버튼
              <>
                <Button 
                  variant={selectedIntervalOption[card.id] === '4시간' ? 'default' : 'outline'} 
                  size="default"
                  onClick={() => handleIntervalSelect(card.id, '4시간')}
                  className={`${selectedIntervalOption[card.id] === '4시간' ? 'bg-black text-white hover:bg-gray-800' : ''} text-base px-6 py-3`}
                >
                  4시간
                </Button>
                <Button 
                  variant={selectedIntervalOption[card.id] === '6시간' ? 'default' : 'outline'} 
                  size="default"
                  onClick={() => handleIntervalSelect(card.id, '6시간')}
                  className={`${selectedIntervalOption[card.id] === '6시간' ? 'bg-black text-white hover:bg-gray-800' : ''} text-base px-6 py-3`}
                >
                  6시간
                </Button>
                <Button 
                  variant={selectedIntervalOption[card.id] === '8시간' ? 'default' : 'outline'} 
                  size="default"
                  onClick={() => handleIntervalSelect(card.id, '8시간')}
                  className={`${selectedIntervalOption[card.id] === '8시간' ? 'bg-black text-white hover:bg-gray-800' : ''} text-base px-6 py-3`}
                >
                  8시간
                </Button>
                <Button 
                  variant={selectedIntervalOption[card.id] === '10시간' ? 'default' : 'outline'} 
                  size="default"
                  onClick={() => handleIntervalSelect(card.id, '10시간')}
                  className={`${selectedIntervalOption[card.id] === '10시간' ? 'bg-black text-white hover:bg-gray-800' : ''} text-base px-6 py-3`}
                >
                  10시간
                </Button>
              </>
            )}
            </div>
            
          {/* 차트 섹션 */}
          <div className="mb-8">
            <DosageChart
              simulationData={[]}
              showSimulation={true}
              currentPatientName={currentPatient?.name}
              selectedDrug={selectedDrug}
              chartTitle={`용법 조정 ${card.id}`}
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
              chartColor={card.type === 'dosage' ? 'pink' : 'green'}
              // TDM 내역 데이터
              tdmIndication={getTdmData(selectedDrug).indication}
              tdmTarget={getTdmData(selectedDrug).target}
              tdmTargetValue={getTdmData(selectedDrug).targetValue}
              // 투약기록 데이터
              currentDosage={getTdmData(selectedDrug).dosage}
              currentUnit={getTdmData(selectedDrug).unit}
              currentFrequency={getTdmData(selectedDrug).frequency}
              // 빈 차트 상태 관리
              isEmptyChart={!cardChartData[card.id]}
              selectedButton={card.type === 'dosage' ? selectedDosage[card.id] : selectedIntervalOption[card.id]}
            />
                </div>
              </div>
      ))}

      {/* 용법 조정 시뮬레이션 영역 */}
      <div className="bg-white dark:bg-slate-900 rounded-lg p-6 mt-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">용법 조정 시뮬레이션을 진행하시겠습니까?</h2>
          
          <div className="flex justify-center gap-4">
            <Button 
              onClick={handleDosageAdjustment}
              className="w-[300px] bg-black text-white font-bold text-lg py-3 px-6 justify-center"
            >
              투약 용량 조정
            </Button>
            <Button 
              onClick={handleIntervalAdjustment}
              className="w-[300px] bg-black text-white font-bold text-lg py-3 px-6 justify-center"
            >
              투약 시간 조정
            </Button>
            </div>
        </div>
      </div>


      {/* 카드 삭제 확인 다이얼로그 */}
      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              용법조정 {cardToDelete} 데이터를 삭제할까요?
            </AlertDialogTitle>
            <AlertDialogDescription>
              이 작업은 되돌릴 수 없습니다. 용법조정 카드와 관련된 모든 데이터가 영구적으로 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={handleCancelDelete}
              className="bg-black text-white hover:bg-gray-800"
            >
              취소
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PKSimulation;
