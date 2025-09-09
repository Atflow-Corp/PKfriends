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
  const [tdmChartData, setTdmChartData] = useState<ChartPoint[]>([]);

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
        // Assume API returns mg/L; convert to ng/mL for chart label consistency if needed
        predicted: Number(p.IPRED ?? p.PRED ?? p.pred ?? 0) || 0,
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
      setTdmChartData(toChartData(data));
      setShowSimulation(true);
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
            simulationData={tdmChartData.length > 0 ? tdmChartData : simulationData}
            showSimulation={true}
            currentPatientName={currentPatient.name}
            selectedDrug={selectedDrug}
            targetMin={(() => {
              const cp = patientPrescriptions.find(p => p.drugName === selectedDrug) || patientPrescriptions[0];
              const nums = (cp?.tdmTargetValue || '').match(/\d+\.?\d*/g);
              return nums && nums.length >= 1 ? parseFloat(nums[0]) : undefined;
            })()}
            targetMax={(() => {
              const cp = patientPrescriptions.find(p => p.drugName === selectedDrug) || patientPrescriptions[0];
              const nums = (cp?.tdmTargetValue || '').match(/\d+\.?\d*/g);
              return nums && nums.length >= 2 ? parseFloat(nums[1]) : undefined;
            })()}
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
              <button
                className="ml-2 px-3 py-1 bg-blue-600 text-white rounded"
                onClick={() => {
                  const parsedDose = parseFloat((doseAdjust || simulationParams.dose).toString().replace(/[^0-9.\-]/g, ''));
                  setSimulationParams({ ...simulationParams, dose: doseAdjust || simulationParams.dose });
                  callTdmApi({ amount: Number.isFinite(parsedDose) && parsedDose > 0 ? parsedDose : undefined });
                }}
              >그래프 출력</button>
            </div>
            <div className="w-full max-w-5xl mx-auto">
              <PKCharts
                simulationData={tdmChartData.length > 0 ? tdmChartData : generateSimulationData()}
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
              <button
                className="ml-2 px-3 py-1 bg-blue-600 text-white rounded"
                onClick={() => {
                  const parsedTau = parseFloat((intervalAdjust || simulationParams.halfLife).toString());
                  setSimulationParams({ ...simulationParams, halfLife: intervalAdjust || simulationParams.halfLife });
                  callTdmApi({ tau: Number.isFinite(parsedTau) && parsedTau > 0 ? parsedTau : undefined });
                }}
              >그래프 출력</button>
            </div>
            <div className="w-full max-w-5xl mx-auto">
              <PKCharts
                simulationData={tdmChartData.length > 0 ? tdmChartData : generateSimulationData()}
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
