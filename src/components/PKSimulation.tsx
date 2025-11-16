import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Patient,
  Prescription,
  BloodTest,
  DrugAdministration,
} from "@/pages/Index";
import PKParameterCard from "./pk/PKParameterCard";
import PKControlPanel from "./pk/PKControlPanel";
import PKCharts from "./pk/PKCharts";
import DosageChart from "./pk/DosageChart";
import PKDataSummary from "./pk/PKDataSummary";
import TDMPatientDetails from "./TDMPatientDetails";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  runTdmApi,
  buildTdmRequestBody as buildTdmRequestBodyCore,
  isActiveTdmExists,
  setActiveTdm,
  computeTauFromAdministrations,
  parseTargetValue,
  TdmApiMinimal,
} from "@/lib/tdm";
import { getTdmTargetValue, isWithinTargetRange } from "./pk/shared/TDMChartUtils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// TDM 히스토리 타입 (간단 요약 정보만 사용)
type TdmHistorySummary = {
  AUC24h_before?: number;
  AUC24h_after?: number;
  CTROUGH_before?: number;
  CTROUGH_after?: number;
};
type TdmHistoryItem = {
  id: string;
  timestamp: string;
  summary?: TdmHistorySummary;
  data?: TdmApiResponse;
  dataset?: TdmDatasetRow[];
};

// TDM 약물 기본 데이터 (PrescriptionStep에서 가져옴)

const TDM_DRUGS = [
  {
    name: "Vancomycin",
    indications: ["Not specified/Korean", "Neurosurgical patients/Korean"],
    targets: [
      { type: "Trough Concentration", value: "10-20 mg/L" },

      { type: "Peak Concentration", value: "25-40 mg/L" },

      { type: "AUC", value: "400-600 mg·h/L" },
    ],

    defaultTargets: {
      "Not specified/Korean": { type: "AUC", value: "400-600 mg·h/L" },

      "Neurosurgical patients/Korean": { type: "AUC", value: "400-600 mg·h/L" },
    },
  },

  {
    name: "Cyclosporin",

    indications: [
      "Renal transplant recipients/Korean",
      "Allo-HSCT/Korean",
      "Thoracic transplant recipients/European",
    ],

    targets: [
      { type: "Trough Concentration", value: "100-400 ng/mL" },

      { type: "Peak Concentration", value: "800-1200 ng/mL" },

      { type: "C2 Concentration", value: "1200-1700 ng/mL" },
    ],

    defaultTargets: {
      "Allo-HSCT/Korean": {
        type: "Trough Concentration",
        value: "150-400 ng/mL",
      },

      "Thoracic transplant recipients/European": {
        type: "Trough Concentration",
        value: "170-230 ng/mL",
      },

      "Renal transplant recipients/Korean": {
        type: "Trough Concentration",
        value: "100-400 ng/mL",
      },
    },
  },
];

interface PKSimulationProps {
  patients: Patient[];
  prescriptions: Prescription[];
  bloodTests: BloodTest[];
  selectedPatient: Patient | null;
  selectedPrescription?: Prescription | null;
  drugAdministrations?: DrugAdministration[];
  onDownloadPDF?: () => void;
}

type ChartPoint = { time: number; predicted: number; observed: number | null };

// TDM API 응답 및 데이터셋 최소 타입 정의 (필요 필드만 선언)
type ConcentrationPoint = {
  time: number;
  IPRED?: number;
  PRED?: number;
};

interface TdmApiResponse extends TdmApiMinimal {
  // Optional meta
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

const PKSimulation = ({
  patients,
  prescriptions,
  bloodTests,
  selectedPatient,
  selectedPrescription,
  drugAdministrations = [],
  onDownloadPDF,
}: PKSimulationProps) => {
  const [selectedPatientId, setSelectedPatientId] = useState(
    selectedPatient?.id || "",
  );

  const [selectedDrug, setSelectedDrug] = useState(
    selectedPrescription?.drugName || "",
  );

  // 투약기록 데이터 계산 (환자&약품명 기준으로 필터링)
  const patientDrugAdministrations =
    selectedPatient && selectedPrescription
      ? drugAdministrations.filter(
          (d) =>
            d.patientId === selectedPatient.id &&
            d.drugName === selectedPrescription.drugName,
        )
      : [];
  
  // 최신 투약 기록 찾기 및 intervalHours 보완
  const latestAdministration = useMemo(() => {
    if (patientDrugAdministrations.length === 0) return null;
    
    const sorted = [...patientDrugAdministrations].sort(
      (a, b) =>
        new Date(`${a.date}T${a.time}`).getTime() -
        new Date(`${b.date}T${b.time}`).getTime(),
    );
    const latest = sorted[sorted.length - 1];
    
    // intervalHours 우선순위: 1) 저장된 값, 2) Prescription.frequency에서 숫자 추출, 3) 계산
    let intervalHours = latest.intervalHours;
    
    if (!intervalHours) {
      // Prescription.frequency에서 숫자 추출 시도 (예: "12시간" -> 12, "q12h" -> 12)
      if (selectedPrescription?.frequency) {
        const frequencyMatch = selectedPrescription.frequency.match(/\d+/);
        if (frequencyMatch) {
          intervalHours = parseInt(frequencyMatch[0], 10);
        }
      }
      
      // 그래도 없으면 계산 (최후의 수단)
      if (!intervalHours && patientDrugAdministrations.length >= 2) {
        intervalHours = computeTauFromAdministrations(patientDrugAdministrations);
      }
    }
    
    return {
      dose: latest.dose,
      unit: latest.unit,
      intervalHours: intervalHours
    };
  }, [patientDrugAdministrations, selectedPrescription]);

  const [simulationParams, setSimulationParams] = useState({
    dose: "",

    halfLife: "",

    clearance: "",

    volumeDistribution: "",
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
  const [tdmChartDataInterval, setTdmChartDataInterval] = useState<
    ChartPoint[]
  >([]);

  const [tdmExtraSeries, setTdmExtraSeries] = useState<{
    ipredSeries: { time: number; value: number }[];
    predSeries: { time: number; value: number }[];
    observedSeries: { time: number; value: number }[];
    currentMethodSeries: { time: number; value: number }[];
  } | null>(null);

  const [tdmExtraSeriesDose, setTdmExtraSeriesDose] = useState<{
    ipredSeries: { time: number; value: number }[];
    predSeries: { time: number; value: number }[];
    observedSeries: { time: number; value: number }[];
  } | null>(null);

  const [tdmExtraSeriesInterval, setTdmExtraSeriesInterval] = useState<{
    ipredSeries: { time: number; value: number }[];
    predSeries: { time: number; value: number }[];
    observedSeries: { time: number; value: number }[];
  } | null>(null);

  const [tdmResultDose, setTdmResultDose] = useState<TdmApiResponse | null>(
    null,
  );

  const [tdmResultInterval, setTdmResultInterval] =
    useState<TdmApiResponse | null>(null);

  const [adjustmentCards, setAdjustmentCards] = useState<
    Array<{ id: number; type: "dosage" | "interval" | "dosageV2" | "dosageAndInterval" }>
  >([]);

  const [selectedDosage, setSelectedDosage] = useState<{
    [cardId: number]: string;
  }>({});

  const [selectedIntervalOption, setSelectedIntervalOption] = useState<{
    [cardId: number]: string;
  }>({});

  const [customDosageInputs, setCustomDosageInputs] = useState<{
    [cardId: number]: string;
  }>({});

  const [customIntervalInputs, setCustomIntervalInputs] = useState<{
    [cardId: number]: string;
  }>({});

  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [showChartDataTooLargeAlert, setShowChartDataTooLargeAlert] = useState(false);
  
  // 용량&시간 조정 카드의 직접입력 모달 상태 (통합)
  const [showCustomInputDialog, setShowCustomInputDialog] = useState<{
    [cardId: number]: boolean;
  }>({});

  const [cardToDelete, setCardToDelete] = useState<number | null>(null);

  const [cardChartData, setCardChartData] = useState<{
    [cardId: number]: boolean;
  }>({});

  // 카드별 차트 로딩 상태
  const [cardChartLoading, setCardChartLoading] = useState<{
    [cardId: number]: boolean;
  }>({});

  const [dosageSuggestions, setDosageSuggestions] = useState<{
    [cardId: number]: number[];
  }>({});

  const [dosageLoading, setDosageLoading] = useState<{
    [cardId: number]: boolean;
  }>({});

  const [dosageError, setDosageError] = useState<{
    [cardId: number]: boolean;
  }>({});

  const suggestTimersRef = useRef<{ [cardId: number]: number }>({});
  const handleDosageSelectRef = useRef<((cardId: number, dosage: string) => void) | null>(null);

  const [dosageSuggestionResults, setDosageSuggestionResults] = useState<{
    [cardId: number]: {
      [amount: number]: { data: TdmApiResponse; dataset: TdmDatasetRow[] };
    };
  }>({});

  // 각 카드별 독립적인 차트 데이터 (PKCharts와 분리)
  const [cardTdmResults, setCardTdmResults] = useState<{
    [cardId: number]: TdmApiResponse | null;
  }>({});

  const [cardTdmChartData, setCardTdmChartData] = useState<{
    [cardId: number]: ChartPoint[];
  }>({});

  const [cardTdmExtraSeries, setCardTdmExtraSeries] = useState<{
    [cardId: number]: {
      ipredSeries: { time: number; value: number }[];
      predSeries: { time: number; value: number }[];
      observedSeries: { time: number; value: number }[];
      currentMethodSeries: { time: number; value: number }[];
    } | null;
  }>({});

  const currentPatient = patients.find((p) => p.id === selectedPatientId);

  const patientPrescriptions = useMemo(
    () =>
      selectedPatientId
        ? prescriptions.filter((p) => p.patientId === selectedPatientId)
        : [],
    [selectedPatientId, prescriptions],
  );

  const patientBloodTests = useMemo(
    () =>
      selectedPatientId && selectedPrescription
        ? bloodTests.filter(
            (b) =>
              b.patientId === selectedPatientId &&
              b.drugName === selectedPrescription.drugName,
          )
        : [],
    [selectedPatientId, selectedPrescription, bloodTests],
  );

  // TDM 데이터 가져오기 헬퍼 함수

  const getTdmData = useCallback(
    (drugName: string) => {
      const prescription = patientPrescriptions.find(
        (p) => p.drugName === drugName,
      );

      const tdmDrug = TDM_DRUGS.find((d) => d.name === drugName);

      return {
        indication:
          prescription?.indication || tdmDrug?.indications?.[0] || "적응증",

        target:
          prescription?.tdmTarget ||
          tdmDrug?.defaultTargets?.[prescription?.indication || ""]?.type ||
          tdmDrug?.targets?.[0]?.type ||
          "목표 유형",

        targetValue:
          prescription?.tdmTargetValue ||
          tdmDrug?.defaultTargets?.[prescription?.indication || ""]?.value ||
          tdmDrug?.targets?.[0]?.value ||
          "목표값",

        dosage: prescription?.dosage || 0,

        unit: prescription?.unit || "mg",

        frequency: prescription?.frequency || "시간",
      };
    },
    [patientPrescriptions],
  );

  const availableDrugs = useMemo(
    () =>
      Array.from(
        new Set([
          ...patientPrescriptions.map((p) => p.drugName),

          ...patientBloodTests.map((b) => b.drugName),
        ]),
      ),
    [patientPrescriptions, patientBloodTests],
  );

  // 사용 가능한 약물이 있고 선택된 약물이 없으면 첫 번째 약물 자동 선택

  useEffect(() => {
    if (availableDrugs.length > 0 && !selectedDrug) {
      setSelectedDrug(availableDrugs[0]);
    }
  }, [availableDrugs, selectedDrug]);

  const selectedDrugTests = useMemo(
    () =>
      selectedDrug
        ? patientBloodTests.filter((b) => b.drugName === selectedDrug)
        : [],
    [selectedDrug, patientBloodTests],
  );

  // 선택된 약물의 처방 정보 가져오기 (props에서 전달받은 selectedPrescription 사용)

  // 혈청 크레아티닌 정보 가져오기 (가장 최근 검사 결과)

  const latestBloodTest =
    patientBloodTests.length > 0
      ? [...patientBloodTests].sort(
          (a, b) =>
            new Date(b.testDate).getTime() - new Date(a.testDate).getTime(),
        )[0]
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

        observed:
          selectedDrugTests.find(
            (test) => Math.abs(test.timeAfterDose - t) < 0.5,
          )?.concentration || null,
      });
    }

    return timePoints;
  };

  const simulationData = generateSimulationData();

  // Calculate PK parameters

  const calculatePKParameters = () => {
    if (selectedDrugTests.length < 2) return null;

    const sortedTests = [...selectedDrugTests].sort(
      (a, b) => a.timeAfterDose - b.timeAfterDose,
    );
    const firstTest = sortedTests[0];
    const lastTest = sortedTests[sortedTests.length - 1];

    if (firstTest.timeAfterDose === lastTest.timeAfterDose) return null;

    // Simple calculation for demonstration

    const ke =
      Math.log(firstTest.concentration / lastTest.concentration) /
      (lastTest.timeAfterDose - firstTest.timeAfterDose);

    const halfLife = 0.693 / ke;

    const auc = selectedDrugTests.reduce((sum, test, index) => {
      if (index === 0) return 0;

      const prevTest = selectedDrugTests[index - 1];

      const trapezoidArea =
        ((test.concentration + prevTest.concentration) *
          (test.timeAfterDose - prevTest.timeAfterDose)) /
        2;

      return sum + trapezoidArea;
    }, 0);

    return {
      halfLife: halfLife.toFixed(2),
      eliminationRate: ke.toFixed(4),
      auc: auc.toFixed(2),
      maxConcentration: Math.max(
        ...selectedDrugTests.map((t) => t.concentration),
      ).toFixed(2),
      timeToMax:
        selectedDrugTests
          .find(
            (t) =>
              t.concentration ===
              Math.max(...selectedDrugTests.map((test) => test.concentration)),
          )
          ?.timeAfterDose.toFixed(1) || "N/A",
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
    // 용법 조정은 동시 진행 제한을 적용하지 않음
    if (concurrencyNotice) setConcurrencyNotice("");
    const newCardNumber = adjustmentCards.length + 1;
    setAdjustmentCards((prev) => [
      ...prev,
      { id: newCardNumber, type: "dosage" },
    ]);
    setCardChartData((prev) => ({ ...prev, [newCardNumber]: false }));
    // 현용법 데이터 로드
    void loadCurrentMethodForCard(newCardNumber);
    triggerDosageSuggestions(newCardNumber);
  };

  const handleDosageAdjustmentV2 = () => {
    if (concurrencyNotice) setConcurrencyNotice("");
    const newCardNumber = adjustmentCards.length + 1;
    setAdjustmentCards((prev) => [
      ...prev,
      { id: newCardNumber, type: "dosageV2" },
    ]);
    setCardChartData((prev) => ({ ...prev, [newCardNumber]: false }));
    setCustomDosageInputs((prev) => ({ ...prev, [newCardNumber]: "" }));
    // 현용법 데이터 로드
    void loadCurrentMethodForCard(newCardNumber);
  };

  const handleIntervalAdjustment = () => {
    // 용법 조정은 동시 진행 제한을 적용하지 않음
    if (concurrencyNotice) setConcurrencyNotice("");
    const newCardNumber = adjustmentCards.length + 1;
    setAdjustmentCards((prev) => [
      ...prev,
      { id: newCardNumber, type: "interval" },
    ]);
    setCardChartData((prev) => ({ ...prev, [newCardNumber]: false }));
    // 현용법 데이터 로드
    void loadCurrentMethodForCard(newCardNumber);
  };

  const handleDosageAndIntervalAdjustment = () => {
    // 용법 조정은 동시 진행 제한을 적용하지 않음
    if (concurrencyNotice) setConcurrencyNotice("");
    const newCardNumber = adjustmentCards.length + 1;
    setAdjustmentCards((prev) => [
      ...prev,
      { id: newCardNumber, type: "dosageAndInterval" },
    ]);
    setCardChartData((prev) => ({ ...prev, [newCardNumber]: false }));
    setCustomDosageInputs((prev) => ({ ...prev, [newCardNumber]: "" }));
    setCustomIntervalInputs((prev) => ({ ...prev, [newCardNumber]: "" }));
    // 현용법 데이터 로드
    void loadCurrentMethodForCard(newCardNumber);
  };

  const handleRemoveCardClick = (cardId: number) => {
    setCardToDelete(cardId);
    setShowDeleteAlert(true);
  };

  // 카드 삭제 확인

  const handleConfirmDelete = () => {
    if (cardToDelete !== null) {
      setAdjustmentCards((prev) =>
        prev.filter((card) => card.id !== cardToDelete),
      );

      // 카드 삭제 시 해당 카드의 선택 상태도 제거

      setSelectedDosage((prev) => {
        const newState = { ...prev };
        delete newState[cardToDelete];
        return newState;
      });

      setCustomDosageInputs((prev) => {
        const newState = { ...prev };
        delete newState[cardToDelete];
        return newState;
      });

      setSelectedIntervalOption((prev) => {
        const newState = { ...prev };
        delete newState[cardToDelete];
        return newState;
      });

      setCardChartData((prev) => {
        const newState = { ...prev };
        delete newState[cardToDelete];
        return newState;
      });

      // 카드별 차트 데이터도 삭제
      setCardTdmResults((prev) => {
        const newState = { ...prev };
        delete newState[cardToDelete];
        return newState;
      });

      setCardTdmChartData((prev) => {
        const newState = { ...prev };
        delete newState[cardToDelete];
        return newState;
      });

      setCardTdmExtraSeries((prev) => {
        const newState = { ...prev };
        delete newState[cardToDelete];
        return newState;
      });

      // 에러 상태도 삭제
      setDosageError((prev) => {
        const newState = { ...prev };
        delete newState[cardToDelete];
        return newState;
      });

      // if no more cards, unset active
      setTimeout(() => {
        if (adjustmentCards.filter((c) => c.id !== cardToDelete).length === 0) {
          setActiveTdm(selectedPatientId, selectedDrug, false);
        }
      }, 0);
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
    setSelectedDosage((prev) => ({
      ...prev,

      [cardId]: dosage,
    }));

    // 버튼 선택 시 차트 그리기 활성화
    setCardChartData((prev) => ({ ...prev, [cardId]: true }));

    // 현용법 데이터가 없으면 로드
    if (!cardTdmExtraSeries[cardId]?.currentMethodSeries || cardTdmExtraSeries[cardId]?.currentMethodSeries.length === 0) {
      void loadCurrentMethodForCard(cardId);
    }

    // 캐시가 있다면 재호출 없이 반영
    const amountMg = parseFloat(dosage.replace(/[^0-9.]/g, ""));
    const cached = dosageSuggestionResults?.[cardId]?.[amountMg];

    if (cached && cached.data) {
      // 카드별 차트 데이터만 업데이트 (메인 차트는 변경하지 않음)
      setCardTdmResults((prev) => ({ ...prev, [cardId]: cached.data }));
      
      // 데이터 크기 체크
      if (checkChartDataSize(cached.data, cached.dataset || [])) {
        setShowChartDataTooLargeAlert(true);
        return;
      }
      
      setCardTdmChartData((prev) => ({ ...prev, [cardId]: toChartData(cached.data, cached.dataset || []) }));

      const currentMethodData = (
        (cached.data?.IPRED_CONC as ConcentrationPoint[] | undefined) || []
      )
        .map((p) => ({
          time: Number(p.time) || 0,
          value: Number(p.IPRED ?? 0) || 0,
        }))
        .filter((p) => p.time >= 0 && p.time <= 72);

        setCardTdmExtraSeries((prev) => ({
          ...prev,
          [cardId]: {
            ipredSeries: (
              (cached.data?.IPRED_CONC as ConcentrationPoint[] | undefined) || []
            )

            .map((p) => ({
              time: Number(p.time) || 0,
              value: Number(p.IPRED ?? 0) || 0,
            }))

            .filter((p) => p.time >= 0),

            predSeries: (
              (cached.data?.PRED_CONC as ConcentrationPoint[] | undefined) || []
            )

            .map((p) => ({
              time: Number(p.time) || 0,
              value: Number(p.PRED ?? p.IPRED ?? 0) || 0,
            }))

            .filter((p) => p.time >= 0),

            observedSeries: ((cached.dataset as TdmDatasetRow[] | undefined) || [])

            .filter((r) => r.EVID === 0 && r.DV != null)

            .map((r) => ({ time: Number(r.TIME) || 0, value: Number(r.DV) }))

            .filter((p) => p.time >= 0),

            currentMethodSeries: currentMethodData,
          },
        }));

        // 로딩 종료
        setCardChartLoading((prev) => ({ ...prev, [cardId]: false }));

      return;
    }

    // 캐시가 없으면 기존 로직으로 API 호출 (카드별 데이터만 업데이트)
    void applyDoseScenarioForCard(cardId, amountMg);
  };
  
  // handleDosageSelect를 ref에 저장하여 안정적인 참조 유지
  handleDosageSelectRef.current = handleDosageSelect;

  // 간격 선택 핸들러

  const getIntervalHours = (label: string): number | null => {
    const numericMatch = label.match(/([0-9]+(?:\.[0-9]+)?)/);
    if (numericMatch) {
      const value = Number(numericMatch[1]);
      if (!Number.isNaN(value)) {
        if (label.includes("주")) {
          return value * 24 * 7;
        }
        return value;
      }
    }
    return null;
  };

  const handleIntervalSelect = (cardId: number, interval: string) => {
    setSelectedIntervalOption((prev) => ({
      ...prev,

      [cardId]: interval,
    }));

    // 버튼 선택 시 차트 그리기 활성화

    setCardChartData((prev) => ({ ...prev, [cardId]: true }));

    // 현용법 데이터가 없으면 로드
    if (!cardTdmExtraSeries[cardId]?.currentMethodSeries || cardTdmExtraSeries[cardId]?.currentMethodSeries.length === 0) {
      void loadCurrentMethodForCard(cardId);
    }

    try {
      const hours = getIntervalHours(interval);
      if (typeof hours === "number" && Number.isFinite(hours)) {
        setCustomIntervalInputs((prev) => ({
          ...prev,
          [cardId]: String(hours),
        }));
        
        // 용량&시간 조정 카드인 경우
        const card = adjustmentCards.find(c => c.id === cardId);
        if (card?.type === "dosageAndInterval") {
          // 용량과 시간이 모두 선택되었을 때만 API 호출
          const selectedDose = selectedDosage[cardId];
          if (selectedDose) {
            const amountMg = parseFloat(selectedDose.replace(/[^0-9.]/g, ""));
            if (!isNaN(amountMg)) {
              void applyDosageAndIntervalScenarioForCard(cardId, amountMg, hours);
            }
          }
        } else {
          // 카드별 데이터만 업데이트 (메인 차트는 변경하지 않음)
          void applyIntervalScenarioForCard(cardId, hours);
        }
      }
    } catch {
      /* no-op */
    }
  };

  const handleCustomIntervalChange = (cardId: number, value: string) => {
    setCustomIntervalInputs((prev) => ({
      ...prev,
      [cardId]: value,
    }));
  };

  const handleCustomIntervalApply = (cardId: number) => {
    const rawValue = (customIntervalInputs[cardId] ?? "").trim();
    if (rawValue === "") {
      window.alert("투약 간격을 입력해주세요.");
      return;
    }

    const hours = Number(rawValue);
    if (!Number.isFinite(hours) || hours <= 0) {
      window.alert("유효한 숫자를 입력해주세요.");
      return;
    }

    const normalizedValue =
      Number.isInteger(hours) && hours >= 1 ? String(hours) : hours.toString();

    const label = `직접 입력 (${normalizedValue}시간)`;
    
    // 현용법 데이터가 없으면 로드
    if (!cardTdmExtraSeries[cardId]?.currentMethodSeries || cardTdmExtraSeries[cardId]?.currentMethodSeries.length === 0) {
      void loadCurrentMethodForCard(cardId);
    }
    
    // 용량&시간 조정 카드인 경우
    const card = adjustmentCards.find(c => c.id === cardId);
    if (card?.type === "dosageAndInterval") {
      setSelectedIntervalOption((prev) => ({ ...prev, [cardId]: label }));
      setCardChartData((prev) => ({ ...prev, [cardId]: true }));
      setCustomIntervalInputs((prev) => ({
        ...prev,
        [cardId]: normalizedValue,
      }));
      // 용량과 시간이 모두 선택되었을 때만 API 호출
      const selectedDose = selectedDosage[cardId];
      if (selectedDose) {
        const amountMg = parseFloat(selectedDose.replace(/[^0-9.]/g, ""));
        if (!isNaN(amountMg)) {
          void applyDosageAndIntervalScenarioForCard(cardId, amountMg, hours);
        }
      }
    } else {
      handleIntervalSelect(cardId, label);
      setCustomIntervalInputs((prev) => ({
        ...prev,
        [cardId]: normalizedValue,
      }));
    }
  };

  const handleDosagePresetSelectV2 = (cardId: number, amountMg: number) => {
    const label = `${Number(amountMg).toLocaleString()}mg`;
    setCustomDosageInputs((prev) => ({
      ...prev,
      [cardId]: String(amountMg),
    }));
    
    // 현용법 데이터가 없으면 로드
    if (!cardTdmExtraSeries[cardId]?.currentMethodSeries || cardTdmExtraSeries[cardId]?.currentMethodSeries.length === 0) {
      void loadCurrentMethodForCard(cardId);
    }
    
    // 용량&시간 조정 카드인 경우
    const card = adjustmentCards.find(c => c.id === cardId);
    if (card?.type === "dosageAndInterval") {
      setSelectedDosage((prev) => ({ ...prev, [cardId]: label }));
      setCardChartData((prev) => ({ ...prev, [cardId]: true }));
      // 용량과 시간이 모두 선택되었을 때만 API 호출
      const selectedInterval = selectedIntervalOption[cardId];
      if (selectedInterval) {
        const hours = getIntervalHours(selectedInterval);
        if (typeof hours === "number" && Number.isFinite(hours)) {
          void applyDosageAndIntervalScenarioForCard(cardId, amountMg, hours);
        }
      }
    } else {
      handleDosageSelect(cardId, label);
    }
  };

  const handleCustomDosageChange = (cardId: number, value: string) => {
    setCustomDosageInputs((prev) => ({
      ...prev,
      [cardId]: value,
    }));
  };

  const handleCustomDosageApply = (cardId: number) => {
    const rawValue = (customDosageInputs[cardId] ?? "").trim();
    if (rawValue === "") {
      window.alert("투약 용량을 입력해주세요.");
      return;
    }

    const amount = Number(rawValue);
    if (!Number.isFinite(amount) || amount <= 0) {
      window.alert("유효한 숫자를 입력해주세요.");
      return;
    }

    const label = `${Number(amount).toLocaleString()}mg`;
    
    // 현용법 데이터가 없으면 로드
    if (!cardTdmExtraSeries[cardId]?.currentMethodSeries || cardTdmExtraSeries[cardId]?.currentMethodSeries.length === 0) {
      void loadCurrentMethodForCard(cardId);
    }
    
    // 용량&시간 조정 카드인 경우
    const card = adjustmentCards.find(c => c.id === cardId);
    if (card?.type === "dosageAndInterval") {
      setSelectedDosage((prev) => ({ ...prev, [cardId]: label }));
      setCardChartData((prev) => ({ ...prev, [cardId]: true }));
      setCustomDosageInputs((prev) => ({
        ...prev,
        [cardId]: String(amount),
      }));
      // 용량과 시간이 모두 선택되었을 때만 API 호출
      const selectedInterval = selectedIntervalOption[cardId];
      if (selectedInterval) {
        const hours = getIntervalHours(selectedInterval);
        if (typeof hours === "number" && Number.isFinite(hours)) {
          void applyDosageAndIntervalScenarioForCard(cardId, amount, hours);
        }
      }
    } else {
      handleDosageSelect(cardId, label);
      setCustomDosageInputs((prev) => ({
        ...prev,
        [cardId]: String(amount),
      }));
    }
  };

  const intervalOptions = useMemo(
    () => [
      { label: "2시간", helper: "q2h" },
      { label: "3시간", helper: "q3h" },
      { label: "4시간", helper: "q4h" },
      { label: "6시간", helper: "q6h" },
      { label: "8시간", helper: "q8h" },
      { label: "12시간", helper: "q12h" },
      { label: "24시간", helper: "매일" },
      { label: "48시간", helper: "이틀 간격" },
      { label: "1주", helper: "주 1회" },
      { label: "2주", helper: "격주" },
      { label: "4주", helper: "매 4주" },
      { label: "6주", helper: "6주마다" },
      { label: "8주", helper: "8주마다" },
    ],
    [],
  );

  const dosagePresetOptions = useMemo(() => {
    if (selectedDrug === "Vancomycin") {
      return [
        125, 250, 375, 500, 625, 750, 875, 1000, 1125,
      ];
    }
    if (selectedDrug === "Cyclosporin") {
      return [
        25, 50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300,
      ];
    }
    return [];
  }, [selectedDrug]);

  // Helpers

  const getSelectedRenalInfo = useCallback(() => {
    try {
      if (!selectedPatientId) return null;

      const raw = window.localStorage.getItem(
        `tdmfriends:renal:${selectedPatientId}`,
      );

      if (!raw) return null;

      const list = JSON.parse(raw) as Array<{
        id: string;
        creatinine: string;
        date: string;
        formula: string;
        result: string;
        dialysis: string;
        renalReplacement: string;
        isSelected: boolean;
      }>;

      const chosen =
        list.find((item) => item.isSelected) || list[list.length - 1];

      return chosen || null;
    } catch {
      return null;
    }
  }, [selectedPatientId]);

  const toDate = (d: string, t: string) => new Date(`${d}T${t}`);

  const hoursDiff = (later: Date, earlier: Date) =>
    (later.getTime() - earlier.getTime()) / 36e5;

  // 차트 데이터로 변환 (API 응답 -> 시계열)

  // 데이터 크기 체크 함수
  // 실제 차트에 그려질 데이터 포인트 수를 근사치로 계산
  // toChartData 함수는 같은 시간 포인트를 하나로 합치므로, 
  // IPRED_CONC와 PRED_CONC는 같은 시간 범위를 가질 가능성이 높음
  const checkChartDataSize = useCallback(
    (
      apiData: TdmApiResponse | null | undefined,
      obsDataset?: TdmDatasetRow[] | null,
    ): boolean => {
      try {
        const ipred = apiData?.IPRED_CONC || [];
        const pred = apiData?.PRED_CONC || [];
        const ipredLength = Array.isArray(ipred) ? ipred.length : 0;
        const predLength = Array.isArray(pred) ? pred.length : 0;
        
        // dataset에서 실제 차트에 그려질 행만 카운트 (EVID=0인 행)
        const observedCount = Array.isArray(obsDataset) 
          ? obsDataset.filter(row => row.EVID === 0 && row.DV != null).length 
          : 0;
        
        // IPRED_CONC와 PRED_CONC는 같은 시간 포인트를 가질 수 있으므로 최대값 사용
        // 실제 차트 포인트는 시간 포인트의 고유 개수이므로, 
        // IPRED/PRED 중 큰 값 + observed 포인트 수로 근사치 계산
        const maxSeriesLength = Math.max(ipredLength, predLength);
        
        // 실제 차트에 그려질 포인트 수의 근사치
        // 시간 포인트가 겹칠 수 있으므로 약간의 여유를 두고 계산
        const estimatedChartPoints = maxSeriesLength + observedCount;
        
        // 차트 포인트가 50000개 이상이면 너무 방대하다고 판단
        // (실제로는 브라우저에서 렌더링이 어려울 수 있는 수준)
        return estimatedChartPoints >= 50000;
      } catch {
        return false;
      }
    },
    [],
  );

  const toChartData = useCallback(
    (
      apiData: TdmApiResponse | null | undefined,
      obsDataset?: TdmDatasetRow[] | null,
    ): ChartPoint[] => {
      try {
        const ipred = apiData?.IPRED_CONC || [];

        const pred = apiData?.PRED_CONC || [];

        const pointMap = new Map<
          number,
          ChartPoint & { controlGroup?: number }
        >();

        // helper to get or create point

        const getPoint = (
          t: number,
        ): ChartPoint & { controlGroup?: number } => {
          const key = Number(t) || 0;

          const existing = pointMap.get(key);

          if (existing) return existing;

          const created: ChartPoint & { controlGroup?: number } = {
            time: key,
            predicted: 0,
            observed: null,
            controlGroup: 0,
          };

          pointMap.set(key, created);

          return created;
        };

        // IPRED_CONC -> predicted (use API unit as-is)

        for (const p of ipred as Array<{ time: number; IPRED?: number }>) {
          const t = Number(p.time) || 0;

          const y = Number(p.IPRED ?? 0) || 0;

          const pt = getPoint(t);

          pt.predicted = y;
        }

        // PRED_CONC -> controlGroup (prefer PRED field if available)

        for (const p of pred as Array<{
          time: number;
          IPRED?: number;
          PRED?: number;
        }>) {
          const t = Number(p.time) || 0;

          const y = Number(p.PRED ?? p.IPRED ?? 0) || 0;

          const pt = getPoint(t);

          pt.controlGroup = y;
        }

        // Observed from input dataset DV (use as-is, no unit conversion)
        // Vancomycin: mg/L, Cyclosporine: ng/mL

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

        const result = Array.from(pointMap.values()).sort(
          (a, b) => a.time - b.time,
        );

        return result;
      } catch {
        return [];
      }
    },
    [],
  );

  // 선택한 용량으로 메인 차트/요약 업데이트
  const applyDoseScenario = useCallback(
    async (amountMg: number) => {
      try {
        if (!selectedPatientId || !selectedDrug) return;
        setShowSimulation(false);

        const body = buildTdmRequestBodyCore({
          patients,
          prescriptions,
          bloodTests,
          drugAdministrations,
          selectedPatientId,
          selectedDrugName: selectedDrug,
          overrides: { amount: amountMg },
        });

        if (!body) return;

        const data = (await runTdmApi({
          body,
          persist: true,
          patientId: selectedPatientId,
          drugName: selectedDrug,
        })) as TdmApiResponse;

        setTdmResult(data);

        // 데이터 크기 체크
        if (checkChartDataSize(data, (body.dataset as TdmDatasetRow[]) || [])) {
          setShowChartDataTooLargeAlert(true);
          return;
        }

        setTdmChartDataMain(
          toChartData(data, (body.dataset as TdmDatasetRow[]) || []),
        );

        setTdmExtraSeries({
          ipredSeries: ((data?.IPRED_CONC as ConcentrationPoint[]) || [])
            .map((p) => ({
              time: Number(p.time) || 0,
              value: Number(p.IPRED ?? 0) || 0,
            }))
            .filter((p) => p.time >= 0),

          predSeries: ((data?.PRED_CONC as ConcentrationPoint[]) || [])
            .map((p) => ({
              time: Number(p.time) || 0,
              value: Number(p.IPRED ?? 0) || 0,
            }))
            .filter((p) => p.time >= 0),

          observedSeries: ((body.dataset as TdmDatasetRow[]) || [])
            .filter((r: TdmDatasetRow) => r.EVID === 0 && r.DV != null)
            .map((r: TdmDatasetRow) => ({
              time: Number(r.TIME) || 0,
              value: Number(r.DV),
            }))
            .filter((p) => p.time >= 0),

          currentMethodSeries: ((data?.PRED_CONC as ConcentrationPoint[]) || [])
            .map((p) => ({
              time: Number(p.time) || 0,
              value: Number(p.IPRED ?? 0) || 0,
            }))
            .filter((p) => p.time >= 0),
        });
        try {
          const key = `tdmfriends:tdmExtraSeries:${selectedPatientId}:${selectedDrug}`;
          window.localStorage.setItem(
            key,
            JSON.stringify({
              ipredSeries: (data?.IPRED_CONC as ConcentrationPoint[])
                .map((p) => ({
                  time: Number(p.time) || 0,
                  value: Number(p.IPRED ?? 0) || 0,
                }))
                .filter((p) => p.time >= 0),
              predSeries: (data?.PRED_CONC as ConcentrationPoint[])
                .map((p) => ({
                  time: Number(p.time) || 0,
                  value: Number(p.IPRED ?? 0) || 0,
                }))
                .filter((p) => p.time >= 0),
              observedSeries: ((body.dataset as TdmDatasetRow[]) || [])
                .filter((r: TdmDatasetRow) => r.EVID === 0 && r.DV != null)
                .map((r: TdmDatasetRow) => ({
                  time: Number(r.TIME) || 0,
                  value: Number(r.DV),
                }))
                .filter((p) => p.time >= 0),
              currentMethodSeries: (data?.PRED_CONC as ConcentrationPoint[])
                .map((p) => ({
                  time: Number(p.time) || 0,
                  value: Number(p.IPRED ?? 0) || 0,
                }))
                .filter((p) => p.time >= 0),
            }),
          );
        } catch {
          console.warn("failed to persist tdmExtraSeries");
        }
        setShowSimulation(true);
      } catch (e) {
        console.warn("Failed to apply dose scenario", e);
      }
    },
    [
      patients,
      prescriptions,
      bloodTests,
      drugAdministrations,
      selectedPatientId,
      selectedDrug,
      toChartData,
    ],
  );

  // 카드별 용량 조정 시나리오 적용 (메인 차트는 변경하지 않음)
  const applyDoseScenarioForCard = useCallback(
    async (cardId: number, amountMg: number) => {
      try {
        if (!selectedPatientId || !selectedDrug) return;

        // 로딩 시작
        setCardChartLoading((prev) => ({ ...prev, [cardId]: true }));

        const body = buildTdmRequestBodyCore({
          patients,
          prescriptions,
          bloodTests,
          drugAdministrations,
          selectedPatientId,
          selectedDrugName: selectedDrug,
          overrides: { amount: amountMg },
        });

        if (!body) return;

        const data = (await runTdmApi({
          body,
          persist: false, // 카드별 데이터는 저장하지 않음
          patientId: selectedPatientId,
          drugName: selectedDrug,
        })) as TdmApiResponse;

        // 카드별 차트 데이터만 업데이트
        setCardTdmResults((prev) => ({ ...prev, [cardId]: data }));
        
        // 데이터 크기 체크
        if (checkChartDataSize(data, (body.dataset as TdmDatasetRow[]) || [])) {
          setShowChartDataTooLargeAlert(true);
          return;
        }
        
        setCardTdmChartData((prev) => ({
          ...prev,
          [cardId]: toChartData(data, (body.dataset as TdmDatasetRow[]) || []),
        }));

        const currentMethodData = (
          (data?.IPRED_CONC as ConcentrationPoint[] | undefined) || []
        )
          .map((p) => ({
            time: Number(p.time) || 0,
            value: Number(p.IPRED ?? 0) || 0,
          }))
          .filter((p) => p.time >= 0 && p.time <= 72);

        setCardTdmExtraSeries((prev) => ({
          ...prev,
          [cardId]: {
            ipredSeries: ((data?.IPRED_CONC as ConcentrationPoint[]) || [])
              .map((p) => ({
                time: Number(p.time) || 0,
                value: Number(p.IPRED ?? 0) || 0,
              }))
              .filter((p) => p.time >= 0),

            predSeries: ((data?.PRED_CONC as ConcentrationPoint[]) || [])
              .map((p) => ({
                time: Number(p.time) || 0,
                value: Number(p.PRED ?? p.IPRED ?? 0) || 0,
              }))
              .filter((p) => p.time >= 0),

            observedSeries: ((body.dataset as TdmDatasetRow[]) || [])
              .filter((r: TdmDatasetRow) => r.EVID === 0 && r.DV != null)
              .map((r: TdmDatasetRow) => ({
                time: Number(r.TIME) || 0,
                value: Number(r.DV),
              }))
              .filter((p) => p.time >= 0),

            currentMethodSeries: currentMethodData,
          },
        }));
        
        // 로딩 종료
        setCardChartLoading((prev) => ({ ...prev, [cardId]: false }));
      } catch (e) {
        console.warn("Failed to apply dose scenario for card", e);
        // 에러 발생 시에도 로딩 종료
        setCardChartLoading((prev) => ({ ...prev, [cardId]: false }));
      }
    },
    [
      patients,
      prescriptions,
      bloodTests,
      drugAdministrations,
      selectedPatientId,
      selectedDrug,
      toChartData,
      checkChartDataSize,
    ],
  );

  const applyIntervalScenario = useCallback(
    async (tauHours: number) => {
      try {
        if (!selectedPatientId || !selectedDrug) return;
        setShowSimulation(false);
        const body = buildTdmRequestBodyCore({
          patients,
          prescriptions,
          bloodTests,
          drugAdministrations,
          selectedPatientId,
          selectedDrugName: selectedDrug,
          overrides: { tau: tauHours },
        });
        if (!body) return;
        const data = (await runTdmApi({
          body,
          persist: true,
          patientId: selectedPatientId,
          drugName: selectedDrug,
        })) as TdmApiResponse;
        setTdmResult(data);
        
        // 데이터 크기 체크
        if (checkChartDataSize(data, (body.dataset as TdmDatasetRow[]) || [])) {
          setShowChartDataTooLargeAlert(true);
          return;
        }
        
        setTdmChartDataMain(
          toChartData(data, (body.dataset as TdmDatasetRow[]) || []),
        );
        setTdmExtraSeries({
          ipredSeries: ((data?.IPRED_CONC as ConcentrationPoint[]) || [])
            .map((p) => ({
              time: Number(p.time) || 0,
              value: Number(p.IPRED ?? 0) || 0,
            }))
            .filter((p) => p.time >= 0),
          predSeries: ((data?.PRED_CONC as ConcentrationPoint[]) || [])
            .map((p) => ({
              time: Number(p.time) || 0,
              value: Number(p.IPRED ?? 0) || 0,
            }))
            .filter((p) => p.time >= 0),
          observedSeries: ((body.dataset as TdmDatasetRow[]) || [])
            .filter((r: TdmDatasetRow) => r.EVID === 0 && r.DV != null)
            .map((r: TdmDatasetRow) => ({
              time: Number(r.TIME) || 0,
              value: Number(r.DV),
            }))
            .filter((p) => p.time >= 0),
          currentMethodSeries: ((data?.PRED_CONC as ConcentrationPoint[]) || [])
            .map((p) => ({
              time: Number(p.time) || 0,
              value: Number(p.IPRED ?? 0) || 0,
            }))
            .filter((p) => p.time >= 0),
        });
        try {
          const key = `tdmfriends:tdmExtraSeries:${selectedPatientId}:${selectedDrug}`;
          window.localStorage.setItem(
            key,
            JSON.stringify({
              ipredSeries: (data?.IPRED_CONC as ConcentrationPoint[])
                .map((p) => ({
                  time: Number(p.time) || 0,
                  value: Number(p.IPRED ?? 0) || 0,
                }))
                .filter((p) => p.time >= 0),
              predSeries: (data?.PRED_CONC as ConcentrationPoint[])
                .map((p) => ({
                  time: Number(p.time) || 0,
                  value: Number(p.IPRED ?? 0) || 0,
                }))
                .filter((p) => p.time >= 0),
              observedSeries: ((body.dataset as TdmDatasetRow[]) || [])
                .filter((r: TdmDatasetRow) => r.EVID === 0 && r.DV != null)
                .map((r: TdmDatasetRow) => ({
                  time: Number(r.TIME) || 0,
                  value: Number(r.DV),
                }))
                .filter((p) => p.time >= 0),
              currentMethodSeries: (data?.PRED_CONC as ConcentrationPoint[])
                .map((p) => ({
                  time: Number(p.time) || 0,
                  value: Number(p.IPRED ?? 0) || 0,
                }))
                .filter((p) => p.time >= 0),
            }),
          );
        } catch {
          console.warn("failed to persist tdmExtraSeries");
        }
        setShowSimulation(true);
      } catch (e) {
        console.warn("Failed to apply interval scenario", e);
      }
    },
    [
      patients,
      prescriptions,
      bloodTests,
      drugAdministrations,
      selectedPatientId,
      selectedDrug,
      toChartData,
    ],
  );

  // 카드별 용량&시간 조정 시나리오 적용 (메인 차트는 변경하지 않음)
  const applyDosageAndIntervalScenarioForCard = useCallback(
    async (cardId: number, amountMg: number, tauHours: number) => {
      try {
        if (!selectedPatientId || !selectedDrug) return;
        
        // 로딩 시작
        setCardChartLoading((prev) => ({ ...prev, [cardId]: true }));
        
        const body = buildTdmRequestBodyCore({
          patients,
          prescriptions,
          bloodTests,
          drugAdministrations,
          selectedPatientId,
          selectedDrugName: selectedDrug,
          overrides: { amount: amountMg, tau: tauHours },
        });
        if (!body) return;
        const data = (await runTdmApi({
          body,
          persist: false, // 카드별 데이터는 저장하지 않음
          patientId: selectedPatientId,
          drugName: selectedDrug,
        })) as TdmApiResponse;
        
        // 카드별 차트 데이터만 업데이트
        setCardTdmResults((prev) => ({ ...prev, [cardId]: data }));
        
        // 데이터 크기 체크
        if (checkChartDataSize(data, (body.dataset as TdmDatasetRow[]) || [])) {
          setShowChartDataTooLargeAlert(true);
          setCardChartLoading((prev) => ({ ...prev, [cardId]: false }));
          return;
        }
        
        setCardTdmChartData((prev) => ({
          ...prev,
          [cardId]: toChartData(data, (body.dataset as TdmDatasetRow[]) || []),
        }));

        const currentMethodData = (
          (data?.IPRED_CONC as ConcentrationPoint[] | undefined) || []
        )
          .map((p) => ({
            time: Number(p.time) || 0,
            value: Number(p.IPRED ?? 0) || 0,
          }))
          .filter((p) => p.time >= 0 && p.time <= 72);

        setCardTdmExtraSeries((prev) => ({
          ...prev,
          [cardId]: {
            ipredSeries: ((data?.IPRED_CONC as ConcentrationPoint[]) || [])
              .map((p) => ({
                time: Number(p.time) || 0,
                value: Number(p.IPRED ?? 0) || 0,
              }))
              .filter((p) => p.time >= 0),
            predSeries: ((data?.PRED_CONC as ConcentrationPoint[]) || [])
              .map((p) => ({
                time: Number(p.time) || 0,
                value: Number(p.PRED ?? p.IPRED ?? 0) || 0,
              }))
              .filter((p) => p.time >= 0),
            observedSeries: ((body.dataset as TdmDatasetRow[]) || [])
              .filter((r: TdmDatasetRow) => r.EVID === 0 && r.DV != null)
              .map((r: TdmDatasetRow) => ({
                time: Number(r.TIME) || 0,
                value: Number(r.DV),
              }))
              .filter((p) => p.time >= 0),
            currentMethodSeries: currentMethodData,
          },
        }));
        
        // 로딩 종료
        setCardChartLoading((prev) => ({ ...prev, [cardId]: false }));
      } catch (e) {
        console.warn("Failed to apply dosage and interval scenario for card", e);
        // 에러 발생 시에도 로딩 종료
        setCardChartLoading((prev) => ({ ...prev, [cardId]: false }));
      }
    },
    [
      patients,
      prescriptions,
      bloodTests,
      drugAdministrations,
      selectedPatientId,
      selectedDrug,
      toChartData,
      checkChartDataSize,
    ],
  );

  // 카드별 간격 조정 시나리오 적용 (메인 차트는 변경하지 않음)
  const applyIntervalScenarioForCard = useCallback(
    async (cardId: number, tauHours: number) => {
      try {
        if (!selectedPatientId || !selectedDrug) return;
        
        // 로딩 시작
        setCardChartLoading((prev) => ({ ...prev, [cardId]: true }));
        
        const body = buildTdmRequestBodyCore({
          patients,
          prescriptions,
          bloodTests,
          drugAdministrations,
          selectedPatientId,
          selectedDrugName: selectedDrug,
          overrides: { tau: tauHours },
        });
        if (!body) return;
        const data = (await runTdmApi({
          body,
          persist: false, // 카드별 데이터는 저장하지 않음
          patientId: selectedPatientId,
          drugName: selectedDrug,
        })) as TdmApiResponse;
        
        // 카드별 차트 데이터만 업데이트
        setCardTdmResults((prev) => ({ ...prev, [cardId]: data }));
        
        // 데이터 크기 체크
        if (checkChartDataSize(data, (body.dataset as TdmDatasetRow[]) || [])) {
          setShowChartDataTooLargeAlert(true);
          setCardChartLoading((prev) => ({ ...prev, [cardId]: false }));
          return;
        }
        
        setCardTdmChartData((prev) => ({
          ...prev,
          [cardId]: toChartData(data, (body.dataset as TdmDatasetRow[]) || []),
        }));

        const currentMethodData = (
          (data?.IPRED_CONC as ConcentrationPoint[] | undefined) || []
        )
          .map((p) => ({
            time: Number(p.time) || 0,
            value: Number(p.IPRED ?? 0) || 0,
          }))
          .filter((p) => p.time >= 0 && p.time <= 72);

        setCardTdmExtraSeries((prev) => ({
          ...prev,
          [cardId]: {
            ipredSeries: ((data?.IPRED_CONC as ConcentrationPoint[]) || [])
              .map((p) => ({
                time: Number(p.time) || 0,
                value: Number(p.IPRED ?? 0) || 0,
              }))
              .filter((p) => p.time >= 0),
            predSeries: ((data?.PRED_CONC as ConcentrationPoint[]) || [])
              .map((p) => ({
                time: Number(p.time) || 0,
                value: Number(p.PRED ?? p.IPRED ?? 0) || 0,
              }))
              .filter((p) => p.time >= 0),
            observedSeries: ((body.dataset as TdmDatasetRow[]) || [])
              .filter((r: TdmDatasetRow) => r.EVID === 0 && r.DV != null)
              .map((r: TdmDatasetRow) => ({
                time: Number(r.TIME) || 0,
                value: Number(r.DV),
              }))
              .filter((p) => p.time >= 0),
            currentMethodSeries: currentMethodData,
          },
        }));
        
        // 로딩 종료
        setCardChartLoading((prev) => ({ ...prev, [cardId]: false }));
      } catch (e) {
        console.warn("Failed to apply interval scenario for card", e);
        // 에러 발생 시에도 로딩 종료
        setCardChartLoading((prev) => ({ ...prev, [cardId]: false }));
      }
    },
    [
      patients,
      prescriptions,
      bloodTests,
      drugAdministrations,
      selectedPatientId,
      selectedDrug,
      toChartData,
      checkChartDataSize,
    ],
  );

  // 카드 추가 시 현용법 데이터 로드
  const loadCurrentMethodForCard = useCallback(
    async (cardId: number) => {
      try {
        if (!selectedPatientId || !selectedDrug) return;

        // 현용법 데이터 로드 (overrides 없이)
        const body = buildTdmRequestBodyCore({
          patients,
          prescriptions,
          bloodTests,
          drugAdministrations,
          selectedPatientId,
          selectedDrugName: selectedDrug,
          overrides: undefined, // 현용법이므로 overrides 없음
        });

        if (!body) return;

        const data = (await runTdmApi({
          body,
          persist: false, // 카드별 데이터는 저장하지 않음
          patientId: selectedPatientId,
          drugName: selectedDrug,
        })) as TdmApiResponse;

        // 데이터 크기 체크
        if (checkChartDataSize(data, (body.dataset as TdmDatasetRow[]) || [])) {
          setShowChartDataTooLargeAlert(true);
          return;
        }

        // 현용법 차트 데이터 저장
        setCardTdmChartData((prev) => ({
          ...prev,
          [cardId]: toChartData(data, (body.dataset as TdmDatasetRow[]) || []),
        }));

        // 현용법 데이터를 currentMethodSeries로 저장
        const currentMethodData = (
          (data?.IPRED_CONC as ConcentrationPoint[] | undefined) || []
        )
          .map((p) => ({
            time: Number(p.time) || 0,
            value: Number(p.IPRED ?? 0) || 0,
          }))
          .filter((p) => p.time >= 0 && p.time <= 72);

        // 현용법 시리즈 데이터 저장
        const observedSeries = ((body.dataset as TdmDatasetRow[]) || [])
          .filter((r: TdmDatasetRow) => r.EVID === 0 && r.DV != null)
          .map((r: TdmDatasetRow) => ({
            time: Number(r.TIME) || 0,
            value: Number(r.DV),
          }))
          .filter((p) => p.time >= 0);

        // 기존 cardTdmExtraSeries가 있으면 유지하고 currentMethodSeries만 업데이트
        // 없으면 빈 배열로 초기화
        setCardTdmExtraSeries((prev) => ({
          ...prev,
          [cardId]: {
            ipredSeries: prev[cardId]?.ipredSeries || [],
            predSeries: prev[cardId]?.predSeries || [],
            observedSeries: observedSeries,
            currentMethodSeries: currentMethodData,
          },
        }));

        // 현용법 결과도 저장 (나중에 비교용)
        setCardTdmResults((prev) => ({ ...prev, [cardId]: data }));
        
        // 현용법에 해당하는 용량/시간 버튼 자동 선택
        if (latestAdministration) {
          // 용량 버튼 자동 선택
          const currentDose = latestAdministration.dose;
          const currentUnit = latestAdministration.unit || 'mg';
          const doseLabel = `${Number(currentDose).toLocaleString()}${currentUnit}`;
          setSelectedDosage((prev) => ({ ...prev, [cardId]: doseLabel }));
          
          // 시간 버튼 자동 선택
          if (latestAdministration.intervalHours) {
            const intervalHours = latestAdministration.intervalHours;
            // intervalOptions에서 일치하는 시간 찾기
            const matchedOption = intervalOptions.find(opt => {
              const optHours = getIntervalHours(opt.label);
              return optHours === intervalHours;
            });
            
            if (matchedOption) {
              setSelectedIntervalOption((prev) => ({ ...prev, [cardId]: matchedOption.label }));
            } else {
              // 일치하는 옵션이 없으면 직접 입력 형식으로 설정
              const normalizedValue = Number.isInteger(intervalHours) && intervalHours >= 1 
                ? String(intervalHours) 
                : intervalHours.toString();
              const customLabel = `직접 입력 (${normalizedValue}시간)`;
              setSelectedIntervalOption((prev) => ({ ...prev, [cardId]: customLabel }));
              setCustomIntervalInputs((prev) => ({ ...prev, [cardId]: normalizedValue }));
            }
          }
        }
        
        // 현용법 차트 표시
        setCardChartData((prev) => ({ ...prev, [cardId]: true }));
      } catch (e) {
        console.warn("Failed to load current method for card", e);
      }
    },
    [
      patients,
      prescriptions,
      bloodTests,
      drugAdministrations,
      selectedPatientId,
      selectedDrug,
      toChartData,
      checkChartDataSize,
      latestAdministration,
      intervalOptions,
    ],
  );

  // Helper: compute 6 dosage suggestions by sampling around current/last dose and scoring via API
  const computeDosageSuggestions = useCallback(
    async (cardId: number) => {
      try {
        setDosageLoading((prev) => ({ ...prev, [cardId]: true }));
        setDosageError((prev) => ({ ...prev, [cardId]: false }));

        const patient = currentPatient;

        if (!patient) return;

        const prescription =
          patientPrescriptions.find((p) => p.drugName === selectedDrug) ||
          patientPrescriptions[0];

        if (!prescription) return;

        // Determine step size per drug and route/form
        const drug = (prescription.drugName || "").toLowerCase();

        let step = 10; // mg

        if (drug === "cyclosporin" || drug === "cyclosporine") {
          // Try to infer form: look for dosageForm in table_maker conditions via localStorage

          let form: string | null = null;

          try {
            const storageKey = patient
              ? `tdmfriends:conditions:${patient.id}`
              : null;

            if (storageKey) {
              const raw = window.localStorage.getItem(storageKey);

              if (raw) {
                const parsed = JSON.parse(raw) as Array<{
                  route?: string;
                  dosageForm?: string;
                }>;

                const oral = parsed.find(
                  (c) => c.route === "경구" || c.route === "oral",
                );

                form = oral?.dosageForm || null;
              }
            }
          } catch (e) {
            console.warn("Failed to infer dosage form from localStorage", e);
          }

          if (form && form.toLowerCase() === "capsule/tablet") step = 25;
          else step = 10;
        }

        // Base dose: last administration dose or prescription.dosage
        const dosesForPatient = (drugAdministrations || []).filter(
          (d) =>
            d.patientId === patient.id && d.drugName === prescription.drugName,
        );

        const lastDose =
          dosesForPatient.length > 0
            ? [...dosesForPatient].sort(
                (a, b) =>
                  toDate(a.date, a.time).getTime() -
                  toDate(b.date, b.time).getTime(),
              )[dosesForPatient.length - 1]
            : undefined;

        const baseDose = Number(lastDose?.dose || prescription.dosage || 100);

        // Target range for ranking
        const target = (prescription.tdmTarget || "").toLowerCase();
        const nums =
          (prescription.tdmTargetValue || "").match(/\d+\.?\d*/g) || [];
        const targetMin = nums[0] ? parseFloat(nums[0]) : undefined;
        const targetMax = nums[1] ? parseFloat(nums[1]) : undefined;

        // quick sanity: ensure we can build a body
        const bodyBase = buildTdmRequestBodyCore({
          patients,
          prescriptions,
          bloodTests,
          drugAdministrations,
          selectedPatientId: patient.id,
          selectedDrugName: prescription.drugName,
        });

        if (!bodyBase) return;

        // Helper function to calculate score
        const calculateScore = (
          resp: TdmApiResponse | null,
          targetMin?: number,
          targetMax?: number,
        ): number => {
          if (!resp) return Number.POSITIVE_INFINITY;
          const trough = Number(
            ((resp?.CTROUGH_after ?? resp?.CTROUGH_before) as number) || 0,
          );
          const auc = Number(
            ((resp?.AUC_24_after ?? resp?.AUC_24_before) as number) || 0,
          );
          let value = 0;
          if (target.includes("auc") && (targetMin || targetMax)) {
            const mid = auc || 0;
            const cmin = targetMin ?? mid;
            const cmax = targetMax ?? mid;
            value = mid < cmin ? cmin - mid : mid > cmax ? mid - cmax : 0;
          } else if (
            (target.includes("trough") || target.includes("cmax")) &&
            (targetMin || targetMax)
          ) {
            const mid = trough || 0;
            const cmin = targetMin ?? mid;
            const cmax = targetMax ?? mid;
            value = mid < cmin ? cmin - mid : mid > cmax ? mid - cmax : 0;
          } else {
            value = Math.abs(
              (trough || 0) - (tdmResult?.CTROUGH_before || 0),
            );
          }
          return value;
        };

        // Helper function to get target value using TDMChartUtils
        const getTargetValue = (resp: TdmApiResponse | null): number | null => {
          if (!resp) return null;
          const targetValue = getTdmTargetValue(
            prescription.tdmTarget,
            resp.AUC_24_after ?? resp.AUC_24_before ?? null,
            resp.CMAX_after ?? resp.CMAX_before ?? null,
            resp.CTROUGH_after ?? resp.CTROUGH_before ?? null,
            prescription.drugName
          );
          return targetValue.numericValue;
        };

        // Helper function to check if value is within target range using TDMChartUtils
        const checkWithinTargetRange = (resp: TdmApiResponse | null): boolean => {
          if (!resp) return false;
          return isWithinTargetRange(
            prescription.tdmTarget,
            prescription.tdmTargetValue,
            resp.AUC_24_after ?? resp.AUC_24_before ?? null,
            resp.CMAX_after ?? resp.CMAX_before ?? null,
            resp.CTROUGH_after ?? resp.CTROUGH_before ?? null,
            prescription.drugName
          );
        };

        // Helper function to calculate distance to target range (for direction determination)
        const getDistanceToTarget = (
          resp: TdmApiResponse | null,
        ): number => {
          if (!resp || !targetMin || !targetMax) return Number.POSITIVE_INFINITY;
          const value = getTargetValue(resp);
          if (value === null) return Number.POSITIVE_INFINITY;
          if (value >= targetMin && value <= targetMax) return 0; // Within range
          if (value < targetMin) return targetMin - value; // Below range
          return value - targetMax; // Above range
        };

        // Helper function to call API for a single amount with retry logic
        const callApiForAmount = async (
          amt: number,
          retries: number = 3,
        ): Promise<{
          amt: number;
          score: number;
          resp: TdmApiResponse | null;
          dataset: TdmDatasetRow[];
        }> => {
          const body = buildTdmRequestBodyCore({
            patients,
            prescriptions,
            bloodTests,
            drugAdministrations,
            selectedPatientId: patient.id,
            selectedDrugName: prescription.drugName,
            overrides: { amount: amt },
          });

          try {
            // runTdmApi already has retry logic for 503 errors
            const resp = (await runTdmApi({ body, retries })) as TdmApiResponse;
            const score = calculateScore(resp, targetMin, targetMax);
            return {
              amt,
              score,
              resp,
              dataset: (body?.dataset as TdmDatasetRow[]) || [],
            };
          } catch (error) {
            // 503 에러는 runTdmApi에서 재시도하므로, 여기 도달하면 모든 재시도 실패
            console.warn(`Failed to get result for amount ${amt}mg after ${retries} retries:`, error);
            return {
              amt,
              score: Number.POSITIVE_INFINITY,
              resp: null,
              dataset: (body?.dataset as TdmDatasetRow[]) || [],
            };
          }
        };

        // Step 1: Try +1 step and -1 step in parallel to determine direction and calculate dose-response relationship
        // 초기 방향 체크는 중요하므로 tryCount 만큼 재시도
        const tryCount = 5;
        const [upResult, downResult] = await Promise.all([
          callApiForAmount(Math.max(1, baseDose + step), tryCount),
          callApiForAmount(Math.max(1, baseDose - step), tryCount),
        ]);

        // Check if both results failed after all retries
        if (upResult.resp === null || downResult.resp === null) {
          console.warn(`[Dosage Search] Failed to get initial results after 5 retries. upResult: ${upResult.resp === null ? 'failed' : 'success'}, downResult: ${downResult.resp === null ? 'failed' : 'success'}`);
          setDosageError((prev) => ({ ...prev, [cardId]: true }));
          setDosageLoading((prev) => ({ ...prev, [cardId]: false }));
          return;
        }

        // Clear error state if successful
        setDosageError((prev) => ({ ...prev, [cardId]: false }));

        // Step 2: Calculate dose-response relationship from before/after comparison
        const upDose = baseDose + step;
        const downDose = baseDose - step;
        const upValue = getTargetValue(upResult.resp);
        const downValue = getTargetValue(downResult.resp);
        
        // Calculate how much the target value changes per unit dose change
        let doseResponseRatio: number | null = null;
        if (upValue !== null && downValue !== null && step > 0) {
          const valueDiff = upValue - downValue;
          const doseDiff = upDose - downDose; // 2 * step
          if (doseDiff !== 0) {
            doseResponseRatio = valueDiff / doseDiff; // Change in target value per mg
          }
        }

        // Step 3: Predict doses that reach targetMin and targetMax
        let predictedMinDose: number | null = null;
        let predictedMaxDose: number | null = null;
        
        if (doseResponseRatio !== null && targetMin !== undefined && targetMax !== undefined) {
          // Use downValue as baseline (smaller dose)
          if (downValue !== null && Math.abs(doseResponseRatio) > 0.0001) {
            // Calculate dose needed to reach targetMin
            const valueDiffMin = targetMin - downValue;
            const doseChangeMin = valueDiffMin / doseResponseRatio;
            predictedMinDose = Math.max(1, downDose + doseChangeMin);
            
            // Calculate dose needed to reach targetMax
            const valueDiffMax = targetMax - downValue;
            const doseChangeMax = valueDiffMax / doseResponseRatio;
            predictedMaxDose = Math.max(1, downDose + doseChangeMax);
            
            // Round to nearest step
            predictedMinDose = Math.round(predictedMinDose / step) * step;
            predictedMaxDose = Math.round(predictedMaxDose / step) * step;
          }
        }

        // Step 4: Determine starting dose and direction
        // Start from the smaller predicted dose (min) and go up, or from larger (max) and go down
        let startDose = baseDose;
        let direction = 1; // Default: go up
        
        if (predictedMinDose !== null && predictedMaxDose !== null) {
          // Start from smaller dose and go up to find all values in range
          startDose = Math.min(predictedMinDose, predictedMaxDose);
          direction = 1; // Always go up from min dose
        } else {
          // Fallback: determine direction based on which gets closer to target
          const upDistance = getDistanceToTarget(upResult.resp);
          const downDistance = getDistanceToTarget(downResult.resp);
          direction = upDistance < downDistance ? 1 : -1;
        }

        // Combine initial results
        const allResults: Array<{
          amt: number;
          score: number;
          resp: TdmApiResponse | null;
          dataset: TdmDatasetRow[];
        }> = [upResult, downResult];

        const withinRangeResults: Array<{
          amt: number;
          score: number;
          resp: TdmApiResponse | null;
          dataset: TdmDatasetRow[];
        }> = [];

        // Check initial results
        for (const result of allResults) {
          if (checkWithinTargetRange(result.resp)) {
            withinRangeResults.push(result);
          }
        }

        // Step 5: Start from predicted dose and search in batches of 4
        // Calculate starting step offset from baseDose
        const startStepOffset = Math.round((startDose - baseDose) / step);
        const testedOffsets = new Set([1, -1]); // Already tested +step and -step
        let batchStart = startStepOffset;
        const batchSize = 3;
        let hasEnteredRange = withinRangeResults.length > 0; // Check if we're already in range
        let loopCount = 0; // Track number of loops, not step offset
        const maxLoops = 20; // Maximum number of batch iterations

        while (true) {
          loopCount++;
          if (loopCount > maxLoops) {
            console.log(`[Dosage Search] Reached max loops (${maxLoops}), stopping`);
            break;
          }
          // Create batch of 4 candidates starting from batchStart in the determined direction
          const batchSteps: number[] = [];
          for (let i = 0; i < batchSize; i++) {
            const stepOffset = batchStart + i * direction;
            // Skip already tested offsets
            if (!testedOffsets.has(stepOffset)) {
              batchSteps.push(stepOffset);
            }
          }

          // If no new candidates in this batch, move to next batch
          if (batchSteps.length === 0) {
            batchStart += batchSize * direction;
            // Safety limit to prevent infinite loops
            if (Math.abs(batchStart) > 50) break;
            continue;
          }

          const batchCandidates = batchSteps
            .map((k) => Math.max(1, baseDose + k * step))
            .filter((amt) => amt > 0);

          if (batchCandidates.length === 0) break;

          // Test batch in parallel
          const batchResults = await Promise.all(
            batchCandidates.map((amt) => callApiForAmount(amt)),
          );

          // Retry failed requests (503 errors) - resp is null means all retries failed
          const retryPromises: Promise<void>[] = [];
          for (let i = 0; i < batchResults.length; i++) {
            if (batchResults[i].resp === null) {
              console.log(`[Dosage Search] Retrying failed request for ${batchResults[i].amt}mg`);
              retryPromises.push(
                callApiForAmount(batchResults[i].amt).then((retryResult) => {
                  batchResults[i] = retryResult;
                })
              );
            }
          }
          
          // Wait for all retries to complete
          if (retryPromises.length > 0) {
            await Promise.all(retryPromises);
            console.log(`[Dosage Search] Completed ${retryPromises.length} retry requests`);
          }

          // Mark offsets as tested
          for (const offset of batchSteps) {
            testedOffsets.add(offset);
          }

          // Add to all results
          allResults.push(...batchResults);

          // Sort batch results by amount based on direction
          // Up direction (1): ascending (small to large)
          // Down direction (-1): descending (large to small)
          const sortedBatchResults = [...batchResults].sort((a, b) => 
            direction === 1 ? a.amt - b.amt : b.amt - a.amt
          );
          
          // Debug logging
          console.log(`[Dosage Search] Loop ${loopCount}/${maxLoops}, Batch start offset: ${batchStart}, direction: ${direction}`);
          console.log(`[Dosage Search] Batch doses:`, sortedBatchResults.map(r => r.amt));
          
          // Check results sequentially to determine range entry/exit
          let foundInRange = false;
          let firstInRangeIndex = -1;
          let lastInRangeIndex = -1;
          const rangeStatus: Array<{ amt: number; inRange: boolean }> = [];
          
          // Check each result in order (based on direction)
          const batchInRangeResults: Array<{
            amt: number;
            score: number;
            resp: TdmApiResponse | null;
            dataset: TdmDatasetRow[];
          }> = [];
          
          for (let i = 0; i < sortedBatchResults.length; i++) {
            const result = sortedBatchResults[i];
            const isInRange = checkWithinTargetRange(result.resp);
            rangeStatus.push({ amt: result.amt, inRange: isInRange });
            
            if (isInRange) {
              withinRangeResults.push(result);
              batchInRangeResults.push(result);
              if (firstInRangeIndex === -1) {
                firstInRangeIndex = i;
                hasEnteredRange = true; // We've entered the range
              }
              lastInRangeIndex = i;
              foundInRange = true;
            }
          }

          // Progressive UI 업데이트: 이번 batch에서 range에 해당하는 결과가 있으면 즉시 UI에 반영
          if (batchInRangeResults.length > 0) {
            // 현재까지의 suggestions 가져오기
            setDosageSuggestions((prev) => {
              const currentAmounts = prev[cardId] || [];
              const newAmounts = batchInRangeResults.map((r) => r.amt);
              // 중복 제거하고 오름차순 정렬
              const mergedAmounts = [...new Set([...currentAmounts, ...newAmounts])].sort((a, b) => a - b);
              return { ...prev, [cardId]: mergedAmounts };
            });

            // 결과 캐싱도 progressive하게 업데이트
            setDosageSuggestionResults((prev) => {
              const next: {
                [cardId: number]: {
                  [amount: number]: {
                    data: TdmApiResponse;
                    dataset: TdmDatasetRow[];
                  };
                };
              } = { ...(prev || {}) } as {
                [cardId: number]: {
                  [amount: number]: {
                    data: TdmApiResponse;
                    dataset: TdmDatasetRow[];
                  };
                };
              };

              next[cardId] = next[cardId] || {};

              // 이번 batch의 range 결과만 캐싱
              for (const r of batchInRangeResults) {
                if (r && r.resp) {
                  next[cardId][r.amt] = {
                    data: r.resp as TdmApiResponse,
                    dataset: r.dataset as TdmDatasetRow[],
                  };
                }
              }

              return next;
            });

            // 첫 번째 range 결과가 나왔고 아직 자동 선택이 안 된 경우 자동 선택
            if (withinRangeResults.length === batchInRangeResults.length) {
              // 첫 번째 batch에서 range 결과가 나온 경우
              const firstAmount = batchInRangeResults.sort((a, b) => a.amt - b.amt)[0].amt;
              
              // handleDosageSelect를 직접 호출하여 차트가 제대로 렌더링되도록 함
              // 약간의 지연을 두어 상태 업데이트가 완료된 후 호출
              setTimeout(() => {
                if (handleDosageSelectRef.current) {
                  handleDosageSelectRef.current(cardId, `${firstAmount}mg`);
                }
              }, 100);
            }
          }

          // Debug logging
          console.log(`[Dosage Search] Range status:`, rangeStatus);
          console.log(`[Dosage Search] hasEnteredRange: ${hasEnteredRange}, foundInRange: ${foundInRange}, firstInRangeIndex: ${firstInRangeIndex}, lastInRangeIndex: ${lastInRangeIndex}`);
          if (batchInRangeResults.length > 0) {
            console.log(`[Dosage Search] Progressive update: ${batchInRangeResults.length} new options added to UI`);
          }

          // Determine next action based on sequential checking
          if (hasEnteredRange) {
            // We've entered the range (or were already in it)
            if (foundInRange) {
              // Check if the last item in the sorted order is within range
              // For up direction: last = largest dose
              // For down direction: last = smallest dose
              const lastResult = sortedBatchResults[sortedBatchResults.length - 1];
              const lastIsInRange = checkWithinTargetRange(lastResult.resp);
              
              console.log(`[Dosage Search] Last dose: ${lastResult.amt}, lastIsInRange: ${lastIsInRange}`);
              
              if (lastIsInRange) {
                // Last item (in direction order) is in range, continue to next batch
                console.log(`[Dosage Search] Continuing to next batch...`);
                batchStart += batchSize * direction;
              } else {
                // Last item is out of range, we've exited the range, stop
                console.log(`[Dosage Search] Last item out of range, stopping`);
                break;
              }
            } else {
              // No items in range in this batch, we've exited the range, stop
              console.log(`[Dosage Search] No items in range in this batch, stopping`);
              break;
            }
          } else {
            // Haven't entered range yet, continue searching
            console.log(`[Dosage Search] Haven't entered range yet, continuing...`);
            batchStart += batchSize * direction;
          }
        }

        // Step 4: Show all results within target range, or best results if none
        const finalResults = withinRangeResults.length > 0
          ? withinRangeResults.sort((a, b) => a.amt - b.amt)
          : allResults.sort((a, b) => a.score - b.score).slice(0, 6);

        const results: Array<{
          amt: number;
          score: number;
          resp: TdmApiResponse | null;
          dataset: TdmDatasetRow[];
        }> = finalResults;

        // Extract amounts from results (all results, not just top 3)
        const allAmounts = results
          .map((r) => r.amt)
          .sort((a, b) => a - b); // 오름차순 정렬

        setDosageSuggestions((prev) => ({ ...prev, [cardId]: allAmounts }));

        // 결과 캐싱
        setDosageSuggestionResults((prev) => {
          const next: {
            [cardId: number]: {
              [amount: number]: {
                data: TdmApiResponse;
                dataset: TdmDatasetRow[];
              };
            };
          } = { ...(prev || {}) } as {
            [cardId: number]: {
              [amount: number]: {
                data: TdmApiResponse;
                dataset: TdmDatasetRow[];
              };
            };
          };

          next[cardId] = next[cardId] || {};

          // Cache all results
          for (const r of results) {
            if (r && r.resp) {
              next[cardId][r.amt] = {
                data: r.resp as TdmApiResponse,
                dataset: r.dataset as TdmDatasetRow[],
              };
            }
          }

          return next;
        });

        // 최초 자동 선택: 첫 번째 추천 용량을 활성화하여 즉시 반영
        // 단, 이미 progressive 업데이트에서 자동 선택이 된 경우는 스킵

        if (allAmounts.length > 0) {
          let shouldAutoSelect = false;
          setSelectedDosage((prev) => {
            // 이미 선택된 용량이 있으면 스킵
            if (prev[cardId]) {
              return prev;
            }
            shouldAutoSelect = true;
            const first = allAmounts[0];
            return { ...prev, [cardId]: `${first}mg` };
          });

          // 자동 선택이 실제로 이루어진 경우에만 차트 업데이트
          if (shouldAutoSelect) {
            const first = allAmounts[0];
            
            // handleDosageSelect를 직접 호출하여 차트가 제대로 렌더링되도록 함
            // 약간의 지연을 두어 상태 업데이트가 완료된 후 호출
            setTimeout(() => {
              if (handleDosageSelectRef.current) {
                handleDosageSelectRef.current(cardId, `${first}mg`);
              }
            }, 100);
          }
        }
      } catch (e) {
        console.warn("computeDosageSuggestions failed", e);
      } finally {
        setDosageLoading((prev) => ({ ...prev, [cardId]: false }));
      }
    },
    [
      patients,
      prescriptions,
      bloodTests,
      drugAdministrations,
      currentPatient,
      selectedDrug,
      patientPrescriptions,
      tdmResult,
      toChartData,
    ],
  );

  // Debounced trigger for dosage suggestions to avoid redundant API calls

  const triggerDosageSuggestions = useCallback(
    (cardId: number) => {
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
    },
    [computeDosageSuggestions],
  );

  // 선택한 용량으로 메인 차트/요약 업데이트 (정의 위치: toChartData 이후)

  // TDM API integration - using unified buildTdmRequestBody from tdm.ts
  
  const buildTdmRequestBody = useCallback(
    (overrides?: { amount?: number; tau?: number }) => {
      if (!selectedPatientId) return null;
      
      return buildTdmRequestBodyCore({
        patients,
        prescriptions,
        bloodTests,
        drugAdministrations,
        selectedPatientId,
        selectedDrugName: selectedDrug,
        overrides,
      });
    },
    [
      patients,
      prescriptions,
      bloodTests,
      drugAdministrations,
      selectedPatientId,
      selectedDrug,
    ],
  );

  // Load persisted TDM result upon entering Let's TDM

  useEffect(() => {
    if (!selectedPatientId) return;

    try {
      // Prefer patient+drug history latest entry
      if (selectedDrug) {
        const histKey = `tdmfriends:tdmResults:${selectedPatientId}:${selectedDrug}`;
        const rawHist = window.localStorage.getItem(histKey);
        if (rawHist) {
          const list = JSON.parse(rawHist) as Array<{
            id: string;
            timestamp: string;
            data?: TdmApiResponse;
          }>;
          const latest = [...list].sort(
            (a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
          )[0];
          if (latest && (latest as { data?: TdmApiResponse }).data) {
            const data = (latest as { data?: TdmApiResponse })
              .data as TdmApiResponse;
            setTdmResult(data);
            const bodyForObs = buildTdmRequestBody();
            setTdmChartDataMain(
              toChartData(data, (bodyForObs?.dataset as TdmDatasetRow[]) || []),
            );
            setTdmExtraSeries({
              ipredSeries: (
                (data?.IPRED_CONC as ConcentrationPoint[] | undefined) || []
              )
                .map((p) => ({
                  time: Number(p.time) || 0,
                  value: Number(p.IPRED ?? 0) || 0,
                }))
                .filter((p) => p.time >= 0),
              predSeries: (
                (data?.PRED_CONC as ConcentrationPoint[] | undefined) || []
              )
                .map((p) => ({
                  time: Number(p.time) || 0,
                  value: Number(p.IPRED ?? 0) || 0,
                }))
                .filter((p) => p.time >= 0),
              observedSeries: (
                (bodyForObs?.dataset as TdmDatasetRow[] | undefined) || []
              )
                .filter((r) => r.EVID === 0 && r.DV != null)
                .map((r) => ({
                  time: Number(r.TIME) || 0,
                  value: Number(r.DV),
                }))
                .filter((p) => p.time >= 0),
              currentMethodSeries: (
                (data?.PRED_CONC as ConcentrationPoint[] | undefined) || []
              )
                .map((p) => ({
                  time: Number(p.time) || 0,
                  value: Number(p.IPRED ?? 0) || 0,
                }))
                .filter((p) => p.time >= 0),
            });
            setShowSimulation(true);
            return;
          }
        }
      }
      // Legacy single-result fallback
      const raw = window.localStorage.getItem(
        `tdmfriends:tdmResult:${selectedPatientId}`,
      );
      if (raw) {
        const data = JSON.parse(raw);
        setTdmResult(data);
        const bodyForObs = buildTdmRequestBody();
        
        // 데이터 크기 체크
        if (checkChartDataSize(data, (bodyForObs?.dataset as TdmDatasetRow[]) || [])) {
          setShowChartDataTooLargeAlert(true);
          return;
        }
        
        setTdmChartDataMain(
          toChartData(data, (bodyForObs?.dataset as TdmDatasetRow[]) || []),
        );
        setTdmExtraSeries({
          ipredSeries: (
            (data?.IPRED_CONC as ConcentrationPoint[] | undefined) || []
          )
            .map((p: { time: number; IPRED?: number }) => ({
              time: Number(p.time) || 0,
              value: Number(p.IPRED ?? 0) || 0,
            }))
            .filter((p) => p.time >= 0),
          predSeries: (
            (data?.PRED_CONC as ConcentrationPoint[] | undefined) || []
          )
            .map((p: { time: number; IPRED?: number }) => ({
              time: Number(p.time) || 0,
              value: Number(p.IPRED ?? 0) || 0,
            }))
            .filter((p) => p.time >= 0),
          observedSeries: (
            (bodyForObs?.dataset as TdmDatasetRow[] | undefined) || []
          )
            .filter((r) => r.EVID === 0 && r.DV != null)
            .map((r) => ({ time: Number(r.TIME) || 0, value: Number(r.DV) }))
            .filter((p) => p.time >= 0),
          currentMethodSeries: (
            (data?.PRED_CONC as ConcentrationPoint[] | undefined) || []
          )
            .map((p: { time: number; PRED?: number; IPRED?: number }) => ({
              time: Number(p.time) || 0,
              value: Number(p.IPRED ?? 0) || 0,
            }))
            .filter((p) => p.time >= 0),
        });
        setShowSimulation(true);
      } else {
        setTdmChartDataMain([]);
      }
    } catch (e) {
      console.warn("Failed to read TDM result from localStorage", e);
    }
    // reset per-tab results when patient changes
    setTdmResultDose(null);
    setTdmResultInterval(null);
    setTdmChartDataDose([]);
    setTdmChartDataInterval([]);
  }, [selectedPatientId, selectedDrug, toChartData, buildTdmRequestBody, checkChartDataSize]);

  // 최근 선택한 약물 복원
  useEffect(() => {
    if (!selectedPatientId) return;
    try {
      const saved = window.localStorage.getItem(
        `tdmfriends:selectedDrug:${selectedPatientId}`,
      );
      if (saved) setSelectedDrug(saved);
    } catch {
      console.warn("failed to restore selectedDrug from localStorage");
    }
  }, [selectedPatientId]);

  // 약물 변경 시 저장
  useEffect(() => {
    if (!selectedPatientId || !selectedDrug) return;
    try {
      window.localStorage.setItem(
        `tdmfriends:selectedDrug:${selectedPatientId}`,
        selectedDrug,
      );
    } catch {
      console.warn("failed to persist selectedDrug to localStorage");
    }
  }, [selectedPatientId, selectedDrug]);

  // 환자+약물별 최근 TDM 히스토리(최대 5개)
  const [tdmHistory, setTdmHistory] = useState<TdmHistoryItem[]>([]);
  const [isCompletedView, setIsCompletedView] = useState<boolean>(false);
  const [concurrencyNotice, setConcurrencyNotice] = useState<string>("");
  const loadCompletedView = useCallback(
    (item: TdmHistoryItem) => {
      if (!item?.data) return;
      setIsCompletedView(true);
      const data = item.data as TdmApiResponse;
      setTdmResult(data);
      // 우선 저장된 dataset을 사용(없으면 현재 데이터로 대체)
      const obsDataset = ((item?.dataset as TdmDatasetRow[] | undefined) ||
        (buildTdmRequestBody()?.dataset as TdmDatasetRow[] | undefined) ||
        []) as TdmDatasetRow[];
      
      // 데이터 크기 체크
      if (checkChartDataSize(data, obsDataset)) {
        setShowChartDataTooLargeAlert(true);
        return;
      }
      
      setTdmChartDataMain(toChartData(data, obsDataset));
      setTdmExtraSeries({
        ipredSeries: (
          (data?.IPRED_CONC as ConcentrationPoint[] | undefined) || []
        )
          .map((p) => ({
            time: Number(p.time) || 0,
            value: Number(p.IPRED ?? 0) || 0,
          }))
          .filter((p) => p.time >= 0),
        predSeries: (
          (data?.PRED_CONC as ConcentrationPoint[] | undefined) || []
        )
          .map((p) => ({
            time: Number(p.time) || 0,
            value: Number(p.IPRED ?? 0) || 0,
          }))
          .filter((p) => p.time >= 0),
        observedSeries: (obsDataset || [])
          .filter((r) => r.EVID === 0 && r.DV != null)
          .map((r) => ({ time: Number(r.TIME) || 0, value: Number(r.DV) }))
          .filter((p) => p.time >= 0),
        currentMethodSeries: (
          (data?.PRED_CONC as ConcentrationPoint[] | undefined) || []
        )
          .map((p) => ({
            time: Number(p.time) || 0,
            value: Number(p.IPRED ?? 0) || 0,
          }))
          .filter((p) => p.time >= 0),
      });
    },
    [buildTdmRequestBody, toChartData, checkChartDataSize],
  );
  const exitCompletedView = useCallback(() => setIsCompletedView(false), []);
  useEffect(() => {
    try {
      if (!selectedPatientId || !selectedDrug) {
        setTdmHistory([]);
        return;
      }
      const key = `tdmfriends:tdmResults:${selectedPatientId}:${selectedDrug}`;
      const raw = window.localStorage.getItem(key);
      const list: TdmHistoryItem[] = raw
        ? (JSON.parse(raw) as TdmHistoryItem[])
        : [];
      const latest = [...list]
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        )
        .slice(0, 5);
      setTdmHistory(latest);
    } catch {
      setTdmHistory([]);
    }
  }, [selectedPatientId, selectedDrug, tdmResult]);

  const getTargetBand = (): { min?: number; max?: number } => {
    const cp =
      patientPrescriptions.find((p) => p.drugName === selectedDrug) ||
      patientPrescriptions[0];

    const target = (cp?.tdmTarget || "").toLowerCase();

    // AUC 목표는 제외
    if (!target || target.includes("auc")) return {};

    // Ctrough 또는 Cmax인 경우만 범위 표시
    if (target.includes("trough") || target.includes("cmax")) {
      const nums = (cp?.tdmTargetValue || "").match(/\d+\.?\d*/g) || [];
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
        <p className="text-lg font-semibold">
          환자와 약물을 먼저 선택해 주세요.
        </p>

        <p className="text-sm mt-2">
          이전 단계에서 환자, TDM 약물, 혈액검사 정보를 모두 입력해야
          시뮬레이션이 가능합니다.
        </p>
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
        {tdmHistory.length > 0 && (
          <div className="mb-4 text-xs text-muted-foreground">
            <div className="font-semibold mb-1">
              최근 TDM 히스토리 (최대 5개)
            </div>
            <ul className="list-disc pl-5 space-y-1">
              {tdmHistory.map((h) => (
                <li key={h.id} className="flex items-center gap-2">
                  <span>
                    {new Date(h.timestamp).toLocaleString()} —
                    AUC24h(before/after): {h.summary?.AUC24h_before ?? "-"} /{" "}
                    {h.summary?.AUC24h_after ?? "-"}, Ctrough(before/after):{" "}
                    {h.summary?.CTROUGH_before ?? "-"} /{" "}
                    {h.summary?.CTROUGH_after ?? "-"}
                  </span>
                  <button
                    className="underline"
                    onClick={() => loadCompletedView(h)}
                  >
                    불러오기
                  </button>
                  {onDownloadPDF && (
                    <button
                      className="underline"
                      onClick={() => {
                        loadCompletedView(h);
                        setTimeout(() => {
                          try {
                            onDownloadPDF?.();
                          } catch {
                            console.warn("failed to open PDF");
                          }
                        }, 0);
                      }}
                    >
                      리포트
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {isCompletedView && (
              <div className="mt-2 text-[11px]">
                완료 보기 모드: 용법 조정 UI가 숨겨집니다.{" "}
                <button className="underline" onClick={exitCompletedView}>
                  종료
                </button>{" "}
                {onDownloadPDF && (
                  <button
                    className="underline ml-2"
                    onClick={() => {
                      try {
                        onDownloadPDF?.();
                      } catch {
                        console.warn("failed to open PDF");
                      }
                    }}
                  >
                    리포트 보기
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        <PKCharts
          showSimulation={true}
          currentPatientName={currentPatient.name}
          selectedDrug={selectedDrug}
          targetMin={getTargetBand().min}
          targetMax={getTargetBand().max}
          recentAUC={tdmResult?.AUC_24_before}
          recentMax={tdmResult?.CMAX_before}
          recentTrough={tdmResult?.CTROUGH_before}
          predictedAUC={
            isCompletedView
              ? null
              : tdmResult?.AUC_24_after
          }
          predictedMax={isCompletedView ? null : tdmResult?.CMAX_after}
          predictedTrough={isCompletedView ? null : tdmResult?.CTROUGH_after}
          ipredSeries={tdmExtraSeries?.ipredSeries}
          predSeries={tdmExtraSeries?.predSeries}
          observedSeries={tdmExtraSeries?.observedSeries}
          // TDM 내역 데이터
          tdmIndication={getTdmData(selectedDrug).indication}
          tdmTarget={getTdmData(selectedDrug).target}
          tdmTargetValue={getTdmData(selectedDrug).targetValue}
          // 투약기록 데이터
          latestAdministration={latestAdministration}
          drugAdministrations={drugAdministrations}
        />
      </div>

      {/* 용법 조정 카드들 */}

      {!isCompletedView &&
        adjustmentCards.map((card) => {
          const isDosageCard =
            card.type === "dosage" || card.type === "dosageV2" || card.type === "dosageAndInterval";
          return (
            <div
              key={`adjustment-${card.id}`}
              className={`bg-white dark:bg-slate-900 rounded-lg p-6 mt-6 shadow-lg border-2 ${
                isDosageCard
                  ? "border-pink-200 dark:border-pink-800"
                  : "border-green-200 dark:border-green-800"
              }`}
            >
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  용법 조정 {card.id}
                </h2>

                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {card.type === "dosage"
                    ? "투약 용량을 조정하고 즉시 예측 결과를 확인해보세요"
                    : card.type === "dosageV2"
                      ? "사전 정의된 용량 버튼 또는 직접 입력으로 투약 용량을 조정해보세요"
                      : card.type === "dosageAndInterval"
                        ? "투약 용량과 시간을 동시에 조정하고 즉시 예측 결과를 확인해보세요"
                        : "투약 시간의 간격을 조정하고 즉시 예측 결과를 확인해보세요"}
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

            <div className="mb-6 px-4">
              {card.type === "dosageAndInterval" ? (
                // 용량&시간 조정 카드 버튼
                <>
                  <div className="space-y-6">
                    {/* 용량 선택 섹션 */}
                    <div
                      className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"
                      role="group"
                      aria-label="투약 용량 옵션"
                    >
                      <div className="flex-1 md:pr-6">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                            투약 용량 선택
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {dosagePresetOptions.length > 0 ? (
                            dosagePresetOptions.map((amount) => {
                              const label = `${Number(amount).toLocaleString()}mg`;
                              const isSelected = selectedDosage[card.id] === label;
                              return (
                                <Button
                                  key={`${card.id}-${amount}`}
                                  variant={isSelected ? "default" : "outline"}
                                  size="default"
                                  onClick={() => handleDosagePresetSelectV2(card.id, amount)}
                                  className={`${
                                    isSelected
                                      ? "bg-black text-white hover:bg-gray-800"
                                      : "bg-white dark:bg-slate-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-slate-700"
                                  } rounded-full px-4 py-2 text-sm font-semibold transition h-auto flex flex-col items-center justify-center gap-0.5`}
                                  title={`${amount}mg`}
                                  aria-pressed={isSelected}
                                >
                                  <span>{Number(amount).toLocaleString()}</span>
                                  <span className={`text-xs font-normal ${isSelected ? "text-gray-200" : "text-muted-foreground"}`}>
                                    mg
                                  </span>
                                </Button>
                              );
                            })
                          ) : (
                            <div className="text-sm text-muted-foreground text-center py-6">
                              현재 선택한 약물에 대해 제공되는 기본 용량 프리셋이 없습니다.
                            </div>
                          )}
                        </div>
                      </div>

                    </div>

                    {/* 시간 선택 섹션 */}
                    <div className="flex flex-col gap-4" role="group" aria-label="투약 간격 옵션">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                            투약 시간 선택
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {intervalOptions.map((option) => {
                            const isSelected =
                              selectedIntervalOption[card.id] === option.label;
                            return (
                              <Button
                                key={`${card.id}-${option.label}`}
                                variant={isSelected ? "default" : "outline"}
                                size="default"
                                onClick={() =>
                                  handleIntervalSelect(card.id, option.label)
                                }
                                className={`${
                                  isSelected
                                    ? "bg-black text-white hover:bg-gray-800"
                                    : "bg-white dark:bg-slate-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-slate-700"
                                } rounded-full px-4 py-2 text-sm font-semibold transition h-auto flex flex-col items-center justify-center gap-0.5`}
                                title={option.helper}
                                aria-pressed={isSelected}
                              >
                                <span>{option.label}</span>
                                <span className={`text-xs font-normal ${isSelected ? "text-gray-200" : "text-muted-foreground"}`}>
                                  {option.helper}
                                </span>
                              </Button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex w-full flex-col gap-2 border-t pt-4">
                        <div className="flex justify-end">
                          <Button
                            variant="outline"
                            className="w-[150px] h-[40px] px-4 py-2 text-sm leading-tight"
                            onClick={() => {
                              // 모달 열 때 default 값 설정
                              if (latestAdministration) {
                                if (!customDosageInputs[card.id] && latestAdministration.dose) {
                                  setCustomDosageInputs(prev => ({ ...prev, [card.id]: String(latestAdministration.dose) }));
                                }
                                if (!customIntervalInputs[card.id] && latestAdministration.intervalHours) {
                                  setCustomIntervalInputs(prev => ({ ...prev, [card.id]: String(latestAdministration.intervalHours) }));
                                }
                              }
                              setShowCustomInputDialog(prev => ({ ...prev, [card.id]: true }));
                            }}
                          >
                            + 직접 입력
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* 용량&시간 직접입력 통합 모달 */}
                  <Dialog open={showCustomInputDialog[card.id] || false} onOpenChange={(open) => {
                    setShowCustomInputDialog(prev => ({ ...prev, [card.id]: open }));
                    // 모달이 열릴 때 default 값 설정
                    if (open && latestAdministration) {
                      if (!customDosageInputs[card.id] && latestAdministration.dose) {
                        setCustomDosageInputs(prev => ({ ...prev, [card.id]: String(latestAdministration.dose) }));
                      }
                      if (!customIntervalInputs[card.id] && latestAdministration.intervalHours) {
                        setCustomIntervalInputs(prev => ({ ...prev, [card.id]: String(latestAdministration.intervalHours) }));
                      }
                    }
                  }}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>직접 입력</DialogTitle>
                      </DialogHeader>
                      <div className="py-4 space-y-4">
                        <div>
                          <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2 block">
                            투약 용량 (mg)
                          </label>
                          <Input
                            type="number"
                            min="0"
                            step="0.1"
                            className="w-full h-[80px] px-4 py-3 text-4xl font-semibold leading-tight text-center placeholder:text-2xl [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            placeholder="용량 (mg)"
                            value={customDosageInputs[card.id] ?? (latestAdministration?.dose ? String(latestAdministration.dose) : "")}
                            onChange={(e) =>
                              handleCustomDosageChange(card.id, e.target.value)
                            }
                          />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2 block">
                            투약 시간 (시간)
                          </label>
                          <Input
                            type="number"
                            min="0"
                            step="0.1"
                            className="w-full h-[80px] px-4 py-3 text-4xl font-semibold leading-tight text-center placeholder:text-2xl [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            placeholder="시간 (h)"
                            value={customIntervalInputs[card.id] ?? (latestAdministration?.intervalHours ? String(latestAdministration.intervalHours) : "")}
                            onChange={(e) =>
                              handleCustomIntervalChange(card.id, e.target.value)
                            }
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setShowCustomInputDialog(prev => ({ ...prev, [card.id]: false }))}
                        >
                          취소
                        </Button>
                        <Button
                          onClick={() => {
                            // 용량과 시간 모두 적용
                            if (customDosageInputs[card.id]) {
                              handleCustomDosageApply(card.id);
                            }
                            if (customIntervalInputs[card.id]) {
                              handleCustomIntervalApply(card.id);
                            }
                            setShowCustomInputDialog(prev => ({ ...prev, [card.id]: false }));
                          }}
                        >
                          확인
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </>
              ) : card.type === "dosage" ? (
                // 투약 용량 조정 카드 버튼 - API 기반 제안값 사용 (여러 줄로 표시)

                <>
                  {/* 상태 메시지 영역 (위쪽) */}
                  <div className="flex justify-center mb-4">
                    {/* 에러 상태: API 호출 실패 시 재시도 버튼 표시 */}
                    {dosageError[card.id] && !dosageLoading[card.id] && (
                      <div className="flex flex-col items-center gap-3 w-full">
                        <div className="text-sm text-red-600 dark:text-red-400">
                          제안 계산에 실패했습니다. 네트워크 상태를 확인하고 다시 시도해주세요.
                        </div>
                        <Button
                          variant="outline"
                          size="default"
                          onClick={() => {
                            setDosageError((prev) => ({ ...prev, [card.id]: false }));
                            triggerDosageSuggestions(card.id);
                          }}
                          className="text-base px-6 py-3"
                        >
                          다시 시도
                        </Button>
                      </div>
                    )}

                    {/* 계산 중 UI: 옵션이 없거나 계산이 진행 중일 때 표시 (에러가 아닐 때만) */}
                    {!dosageError[card.id] && ((!dosageSuggestions[card.id] ||
                      dosageSuggestions[card.id].length === 0) ||
                      dosageLoading[card.id]) && (
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                          ></path>
                        </svg>
                        제안을 계산 중...
                      </span>
                    )}
                  </div>

                  {/* 옵션 버튼 영역 (아래쪽) */}
                  {(dosageSuggestions[card.id] || []).length > 0 && (
                    <div className="flex flex-wrap justify-center gap-4">
                      {(dosageSuggestions[card.id] || []).map((amt) => {
                        const label = `${Number(amt).toLocaleString()}mg`;

                        return (
                          <Button
                            key={`${card.id}-${amt}`}
                            variant={
                              selectedDosage[card.id] === label
                                ? "default"
                                : "outline"
                            }
                            size="default"
                            onClick={() => handleDosageSelect(card.id, label)}
                            className={`${selectedDosage[card.id] === label ? "bg-black text-white hover:bg-gray-800" : ""} text-base px-6 py-3 flex-shrink-0`}
                          >
                            {label}
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : card.type === "interval" ? (
                // 투약 시간 조정 카드 버튼

                <>
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between" role="group" aria-label="투약 간격 옵션">
                    <div className="flex-1 md:pr-6">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                          투약 시간 선택
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
                        {intervalOptions.map((option) => {
                          const isSelected =
                            selectedIntervalOption[card.id] === option.label;
                          return (
                            <Button
                              key={`${card.id}-${option.label}`}
                              variant={isSelected ? "default" : "outline"}
                              size="default"
                              onClick={() =>
                                handleIntervalSelect(card.id, option.label)
                              }
                              className={`${
                                isSelected
                                  ? "bg-black text-white hover:bg-gray-800"
                                  : ""
                              } flex h-auto w-full min-w-0 flex-col items-center justify-center gap-1 px-4 py-3 text-sm font-semibold leading-tight transition`}
                              title={option.helper}
                              aria-pressed={isSelected}
                            >
                              <span>{option.label}</span>
                              <span className="text-xs font-normal text-muted-foreground">
                                {option.helper}
                              </span>
                            </Button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex w-full flex-col gap-2 border-t pt-4 md:w-64 md:self-stretch md:border-t-0 md:border-l md:border-gray-200 md:pl-6 md:pt-0">
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                        직접 입력 (시간)
                      </span>
                      <div className="flex flex-col items-stretch gap-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.1"
                          className="w-full h-[80px] px-4 py-3 text-lg font-semibold leading-tight text-center"
                          placeholder="시간 (h)"
                          value={customIntervalInputs[card.id] ?? ""}
                          onChange={(e) =>
                            handleCustomIntervalChange(card.id, e.target.value)
                          }
                        />
                        <div className="flex">
                          <Button
                            className="w-full h-[50px] px-4 py-3 text-sm font-semibold leading-tight"
                            onClick={() => handleCustomIntervalApply(card.id)}
                          >
                            확인
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div
                    className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"
                    role="group"
                    aria-label="투약 용량 옵션"
                  >
                    <div className="flex-1 md:pr-6">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                          투약 용량 선택
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        {dosagePresetOptions.length > 0 ? (
                          dosagePresetOptions.map((amount) => {
                            const label = `${Number(amount).toLocaleString()}mg`;
                            const isSelected = selectedDosage[card.id] === label;
                            return (
                              <Button
                                key={`${card.id}-${amount}`}
                                variant={isSelected ? "default" : "outline"}
                                size="default"
                                onClick={() => handleDosagePresetSelectV2(card.id, amount)}
                                className={`${
                                  isSelected
                                    ? "bg-black text-white hover:bg-gray-800"
                                    : ""
                                } flex h-auto w-full min-w-0 flex-col items-center justify-center gap-1 px-4 py-3 text-sm font-semibold leading-tight transition`}
                                title={`${amount}mg`}
                                aria-pressed={isSelected}
                              >
                                <span>{label}</span>
                                <span className="text-xs font-normal text-muted-foreground">
                                  mg
                                </span>
                              </Button>
                            );
                          })
                        ) : (
                          <div className="col-span-2 sm:col-span-3 lg:col-span-6 text-sm text-muted-foreground text-center py-6">
                            현재 선택한 약물에 대해 제공되는 기본 용량 프리셋이 없습니다.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex w-full flex-col gap-2 border-t pt-4 md:w-64 md:self-stretch md:border-t-0 md:border-l md:border-gray-200 md:pl-6 md:pt-0">
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                        직접 입력 (mg)
                      </span>
                      <div className="flex flex-col items-stretch gap-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.1"
                          className="w-full h-[80px] px-4 py-3 text-lg font-semibold leading-tight text-center"
                          placeholder="용량 (mg)"
                          value={customDosageInputs[card.id] ?? ""}
                          onChange={(e) =>
                            handleCustomDosageChange(card.id, e.target.value)
                          }
                        />
                        <div className="flex">
                          <Button
                            className="w-full h-[50px] px-4 py-3 text-sm font-semibold leading-tight"
                            onClick={() => handleCustomDosageApply(card.id)}
                          >
                            확인
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* 차트 섹션 */}

            <div className="mb-8">
              <DosageChart
                simulationData={[]}
                showSimulation={showSimulation}
                currentPatientName={currentPatient?.name}
                selectedDrug={selectedDrug}
                chartTitle={`용법 조정 ${card.id}`}
                targetMin={getTargetBand().min}
                targetMax={getTargetBand().max}
                drugAdministrations={drugAdministrations}
                // DosageChart의 "현 용법 유지 시" 카드는 PKCharts의 "현 용법의 항정상태 예측 결과"와 동일한 값을 사용
                recentAUC={tdmResult?.AUC_24_after}
                recentMax={tdmResult?.CMAX_after}
                recentTrough={tdmResult?.CTROUGH_after}
                // "용법 변경 시" 카드는 카드별 조정 후 결과를 사용
                predictedAUC={cardTdmResults[card.id]?.AUC_24_after}
                predictedMax={cardTdmResults[card.id]?.CMAX_after}
                predictedTrough={cardTdmResults[card.id]?.CTROUGH_after}
                ipredSeries={cardTdmExtraSeries[card.id]?.ipredSeries}
                predSeries={cardTdmExtraSeries[card.id]?.predSeries}
                observedSeries={cardTdmExtraSeries[card.id]?.observedSeries}
                currentMethodSeries={cardTdmExtraSeries[card.id]?.currentMethodSeries}
                chartColor={isDosageCard ? "pink" : "green"}
                isLoading={cardChartLoading[card.id] || false}
                // TDM 내역 데이터
                tdmIndication={getTdmData(selectedDrug).indication}
                tdmTarget={getTdmData(selectedDrug).target}
                tdmTargetValue={getTdmData(selectedDrug).targetValue}
                // 투약기록 데이터 - 용법 조정 카드에서 선택된 값 반영
                originalAdministration={latestAdministration}
                latestAdministration={(() => {
                  if (!latestAdministration) return null;
                  
                  let updated = { ...latestAdministration };
                  
                  // 용량 조정 카드: 선택된 dose 반영
                  if (isDosageCard && selectedDosage[card.id]) {
                    const selectedDose = parseFloat(selectedDosage[card.id].replace(/[^0-9.]/g, ""));
                    if (!isNaN(selectedDose)) {
                      updated.dose = selectedDose;
                    }
                  }
                  
                  // 간격 조정 카드 또는 용량&시간 조정 카드: 선택된 intervalHours 반영
                  if ((card.type === "interval" || card.type === "dosageAndInterval") && selectedIntervalOption[card.id]) {
                    const selectedInterval = getIntervalHours(selectedIntervalOption[card.id]);
                    if (typeof selectedInterval === "number" && !Number.isNaN(selectedInterval)) {
                      updated.intervalHours = selectedInterval;
                    }
                  }
                  
                  // 선택된 옵션이 없으면 원래 값 반환
                  return updated;
                })()}
                // 빈 차트 상태 관리: 제안 계산 중에는 숨김, 완성 후 첫 번째 자동선택 시 표시
                isEmptyChart={
                  !cardChartData[card.id] ||
                  (dosageLoading[card.id] &&
                    (!dosageSuggestions[card.id] ||
                      dosageSuggestions[card.id].length === 0))
                }
                selectedButton={
                  card.type === "interval"
                    ? selectedIntervalOption[card.id]
                    : card.type === "dosageAndInterval"
                      ? `${selectedDosage[card.id] || ""} / ${selectedIntervalOption[card.id] || ""}`
                      : selectedDosage[card.id]
                }
              />
            </div>
          </div>
        );
      })}

      {!isCompletedView && (
        <div className="bg-white dark:bg-slate-900 rounded-lg p-6 mt-6">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              용법 조정 시뮬레이션을 진행하시겠습니까?
            </h2>
            {concurrencyNotice && (
              <div className="text-sm text-red-600 mb-2">
                {concurrencyNotice}
              </div>
            )}
            <div className="flex justify-center gap-4 flex-wrap">
              <Button
                onClick={handleDosageAdjustmentV2}
                className="w-[300px] bg-black text-white font-bold text-lg py-3 px-6 justify-center"
              >
                투약용량조정(ver2)
              </Button>
              <Button
                onClick={handleIntervalAdjustment}
                className="w-[300px] bg-black text-white font-bold text-lg py-3 px-6 justify-center"
              >
                투약시간조정
              </Button>
              <Button
                onClick={handleDosageAndIntervalAdjustment}
                className="w-[300px] bg-black text-white font-bold text-lg py-3 px-6 justify-center"
              >
                용량&시간 조정
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 카드 삭제 확인 다이얼로그 */}
      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>용법 조정 카드 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              이 용법 조정 카드를 삭제하시겠습니까? 삭제된 카드의 설정은 복구할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDelete}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 차트 데이터가 너무 방대할 때 안내 모달 */}
      <AlertDialog open={showChartDataTooLargeAlert} onOpenChange={setShowChartDataTooLargeAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>차트 그리기 불가</AlertDialogTitle>
            <AlertDialogDescription>
              데이터가 방대하여 차트를 그릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowChartDataTooLargeAlert(false)}>
              확인
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PKSimulation;
