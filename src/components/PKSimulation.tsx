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
import {
  runTdmApi,
  buildTdmRequestBody as buildTdmRequestBodyCore,
  isActiveTdmExists,
  setActiveTdm,
  computeCRCL,
  computeTauFromAdministrations,
  parseTargetValue,
} from "@/lib/tdm";
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

interface TdmApiResponse {
  AUC_before?: number;
  CMAX_before?: number;
  CTROUGH_before?: number;
  AUC_after?: number;
  CMAX_after?: number;
  CTROUGH_after?: number;
  // New detailed AUC fields
  AUCtau_before?: number;
  AUC24h_before?: number;
  AUCtau_after?: number;
  AUC24h_after?: number;
  // Optional meta
  beforeWindowHours?: number;
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
  const latestAdministration =
    patientDrugAdministrations.length > 0
      ? [...patientDrugAdministrations].sort(
          (a, b) =>
            new Date(`${a.date}T${a.time}`).getTime() -
            new Date(`${b.date}T${b.time}`).getTime(),
        )[patientDrugAdministrations.length - 1]
      : null;

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
    Array<{ id: number; type: "dosage" | "interval" }>
  >([]);

  const [selectedDosage, setSelectedDosage] = useState<{
    [cardId: number]: string;
  }>({});

  const [selectedIntervalOption, setSelectedIntervalOption] = useState<{
    [cardId: number]: string;
  }>({});

  const [showDeleteAlert, setShowDeleteAlert] = useState(false);

  const [cardToDelete, setCardToDelete] = useState<number | null>(null);

  const [cardChartData, setCardChartData] = useState<{
    [cardId: number]: boolean;
  }>({});

  const [dosageSuggestions, setDosageSuggestions] = useState<{
    [cardId: number]: number[];
  }>({});

  const [dosageLoading, setDosageLoading] = useState<{
    [cardId: number]: boolean;
  }>({});

  const suggestTimersRef = useRef<{ [cardId: number]: number }>({});

  const [dosageSuggestionResults, setDosageSuggestionResults] = useState<{
    [cardId: number]: {
      [amount: number]: { data: TdmApiResponse; dataset: TdmDatasetRow[] };
    };
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
    triggerDosageSuggestions(newCardNumber);
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

    // 캐시가 있다면 재호출 없이 반영
    const amountMg = parseFloat(dosage.replace(/[^0-9.]/g, ""));
    const cached = dosageSuggestionResults?.[cardId]?.[amountMg];

    if (cached && cached.data) {
      setTdmResult(cached.data);

      setTdmChartDataMain(toChartData(cached.data, cached.dataset || []));

      const currentMethodData = (
        (cached.data?.IPRED_CONC as ConcentrationPoint[] | undefined) || []
      )
        .map((p) => ({
          time: Number(p.time) || 0,
          value: Number(p.IPRED ?? 0) || 0,
        }))
        .filter((p) => p.time >= 0 && p.time <= 72);
      console.log(
        "PKSimulation currentMethodSeries (cached):",
        currentMethodData,
      );
      console.log("PKSimulation PRED_CONC raw:", cached.data?.PRED_CONC);

      setTdmExtraSeries({
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
      });

      return;
    }

    // 캐시가 없으면 기존 로직으로 API 호출

    void applyDoseScenario(amountMg);
  };

  // 간격 선택 핸들러

  const handleIntervalSelect = (cardId: number, interval: string) => {
    setSelectedIntervalOption((prev) => ({
      ...prev,

      [cardId]: interval,
    }));

    // 버튼 선택 시 차트 그리기 활성화

    setCardChartData((prev) => ({ ...prev, [cardId]: true }));

    try {
      const hours = parseInt(interval.replace(/[^0-9]/g, ""), 10);
      if (Number.isFinite(hours)) {
        void applyIntervalScenario(hours);
      }
    } catch {
      /* no-op */
    }
  };

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

  // Helper: compute 6 dosage suggestions by sampling around current/last dose and scoring via API
  const computeDosageSuggestions = useCallback(
    async (cardId: number) => {
      try {
        setDosageLoading((prev) => ({ ...prev, [cardId]: true }));

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

        // Build 6 candidates: +/- 3 steps
        const candidates = [-3, -2, -1, 1, 2, 3].map((k) =>
          Math.max(1, baseDose + k * step),
        );

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

        // For each candidate, call API with override amount

        const results: Array<{
          amt: number;
          score: number;
          resp: TdmApiResponse | null;
          dataset: TdmDatasetRow[];
        }> = await Promise.all(
          candidates.map(async (amt) => {
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
              const resp = (await runTdmApi({ body })) as TdmApiResponse;
              const trough = Number(
                ((resp?.CTROUGH_after ?? resp?.CTROUGH_before) as number) || 0,
              );
              const auc = Number(
                ((resp?.AUC24h_after ??
                  resp?.AUC_after ??
                  resp?.AUC24h_before ??
                  resp?.AUC_before) as number) || 0,
              );
              // score: distance to target range (prefer within range)
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
                // fallback: smaller trough distance to previous result
                value = Math.abs(
                  (trough || 0) - (tdmResult?.CTROUGH_before || 0),
                );
              }
              return {
                amt,
                score: value,
                resp,
                dataset: (body?.dataset as TdmDatasetRow[]) || [],
              };
            } catch {
              return {
                amt,
                score: Number.POSITIVE_INFINITY,
                resp: null,
                dataset: (body?.dataset as TdmDatasetRow[]) || [],
              };
            }
          }),
        );

        const top = results
          .sort((a, b) => a.score - b.score)
          .slice(0, 3)
          .map((r) => r.amt)
          .sort((a, b) => a - b); // 오름차순 정렬

        setDosageSuggestions((prev) => ({ ...prev, [cardId]: top }));

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

          for (const r of results) {
            if (r && r.resp && top.includes(r.amt)) {
              next[cardId][r.amt] = {
                data: r.resp as TdmApiResponse,
                dataset: r.dataset as TdmDatasetRow[],
              };
            }
          }

          return next;
        });

        // 최초 자동 선택: 첫 번째 추천 용량을 활성화하여 즉시 반영

        if (top.length > 0) {
          const first = top[0];

          setSelectedDosage((prev) => ({ ...prev, [cardId]: `${first}mg` }));

          const cached = results.find((r) => r.amt === first);

          if (cached && cached.resp) {
            setTdmResult(cached.resp as TdmApiResponse);

            setTdmChartDataMain(
              toChartData(
                cached.resp as TdmApiResponse,
                (cached.dataset as TdmDatasetRow[]) || [],
              ),
            );

            setTdmExtraSeries({
              ipredSeries: (
                ((cached.resp as TdmApiResponse)?.IPRED_CONC as
                  | ConcentrationPoint[]
                  | undefined) || []
              )
                .map((p) => ({
                  time: Number(p.time) || 0,
                  value: Number(p.IPRED ?? 0) || 0,
                }))
                .filter((p) => p.time >= 0 && p.time <= 72),

              predSeries: (
                ((cached.resp as TdmApiResponse)?.PRED_CONC as
                  | ConcentrationPoint[]
                  | undefined) || []
              )
                .map((p) => ({
                  time: Number(p.time) || 0,
                  value: Number(p.IPRED ?? 0) || 0,
                }))
                .filter((p) => p.time >= 0 && p.time <= 72),

              observedSeries: (
                (cached.dataset as TdmDatasetRow[] | undefined) || []
              )
                .filter((r) => r.EVID === 0 && r.DV != null)
                .map((r) => ({
                  time: Number(r.TIME) || 0,
                  value: Number(r.DV),
                }))
                .filter((p) => p.time >= 0 && p.time <= 72),

              currentMethodSeries: (
                ((cached.resp as TdmApiResponse)?.PRED_CONC as
                  | ConcentrationPoint[]
                  | undefined) || []
              )
                .map((p) => ({
                  time: Number(p.time) || 0,
                  value: Number(p.IPRED ?? 0) || 0,
                }))
                .filter((p) => p.time >= 0 && p.time <= 72),
            });

            setCardChartData((prev) => ({ ...prev, [cardId]: true }));
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
  }, [selectedPatientId, selectedDrug, toChartData, buildTdmRequestBody]);

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
    [buildTdmRequestBody, toChartData],
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
        {tdmResult && (
          <div className="mb-2 text-[11px] text-muted-foreground">
            Before window: {Number(tdmResult.beforeWindowHours ?? 72)}h
          </div>
        )}
        <PKCharts
          showSimulation={true}
          currentPatientName={currentPatient.name}
          selectedDrug={selectedDrug}
          targetMin={getTargetBand().min}
          targetMax={getTargetBand().max}
          recentAUC={tdmResult?.AUC24h_before ?? tdmResult?.AUC_before}
          recentMax={tdmResult?.CMAX_before}
          recentTrough={tdmResult?.CTROUGH_before}
          predictedAUC={
            isCompletedView
              ? null
              : (tdmResult?.AUC24h_after ?? tdmResult?.AUC_after)
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
        adjustmentCards.map((card) => (
          <div
            key={`adjustment-${card.id}`}
            className={`bg-white dark:bg-slate-900 rounded-lg p-6 mt-6 shadow-lg border-2 ${
              card.type === "dosage"
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

            <div className="flex justify-center gap-4 mb-6">
              {card.type === "dosage" ? (
                // 투약 용량 조정 카드 버튼 - API 기반 제안값 사용 (최대 3개)

                <>
                  {(dosageSuggestions[card.id] || []).map((amt) => {
                    const label = `${amt}mg`;

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
                        className={`${selectedDosage[card.id] === label ? "bg-black text-white hover:bg-gray-800" : ""} text-base px-6 py-3`}
                      >
                        {label}
                      </Button>
                    );
                  })}

                  {(!dosageSuggestions[card.id] ||
                    dosageSuggestions[card.id].length === 0) && (
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
                </>
              ) : (
                // 투약 시간 조정 카드 버튼

                <>
                  <Button
                    variant={
                      selectedIntervalOption[card.id] === "4시간"
                        ? "default"
                        : "outline"
                    }
                    size="default"
                    onClick={() => handleIntervalSelect(card.id, "4시간")}
                    className={`${selectedIntervalOption[card.id] === "4시간" ? "bg-black text-white hover:bg-gray-800" : ""} text-base px-6 py-3`}
                  >
                    4시간
                  </Button>

                  <Button
                    variant={
                      selectedIntervalOption[card.id] === "6시간"
                        ? "default"
                        : "outline"
                    }
                    size="default"
                    onClick={() => handleIntervalSelect(card.id, "6시간")}
                    className={`${selectedIntervalOption[card.id] === "6시간" ? "bg-black text-white hover:bg-gray-800" : ""} text-base px-6 py-3`}
                  >
                    6시간
                  </Button>

                  <Button
                    variant={
                      selectedIntervalOption[card.id] === "8시간"
                        ? "default"
                        : "outline"
                    }
                    size="default"
                    onClick={() => handleIntervalSelect(card.id, "8시간")}
                    className={`${selectedIntervalOption[card.id] === "8시간" ? "bg-black text-white hover:bg-gray-800" : ""} text-base px-6 py-3`}
                  >
                    8시간
                  </Button>

                  <Button
                    variant={
                      selectedIntervalOption[card.id] === "12시간"
                        ? "default"
                        : "outline"
                    }
                    size="default"
                    onClick={() => handleIntervalSelect(card.id, "12시간")}
                    className={`${selectedIntervalOption[card.id] === "12시간" ? "bg-black text-white hover:bg-gray-800" : ""} text-base px-6 py-3`}
                  >
                    12시간
                  </Button>
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
                recentAUC={tdmResult?.AUC24h_before ?? tdmResult?.AUC_before}
                recentMax={tdmResult?.CMAX_before}
                recentTrough={tdmResult?.CTROUGH_before}
                predictedAUC={tdmResult?.AUC24h_after ?? tdmResult?.AUC_after}
                predictedMax={tdmResult?.CMAX_after}
                predictedTrough={tdmResult?.CTROUGH_after}
                ipredSeries={tdmExtraSeries?.ipredSeries}
                predSeries={tdmExtraSeries?.predSeries}
                observedSeries={tdmExtraSeries?.observedSeries}
                currentMethodSeries={tdmExtraSeries?.currentMethodSeries}
                chartColor={card.type === "dosage" ? "pink" : "green"}
                // 빈 차트 상태 관리: 제안 계산 중에는 숨김, 완성 후 첫 번째 자동선택 시 표시

                isEmptyChart={
                  !cardChartData[card.id] ||
                  (dosageLoading[card.id] &&
                    (!dosageSuggestions[card.id] ||
                      dosageSuggestions[card.id].length === 0))
                }
                selectedButton={
                  card.type === "dosage"
                    ? selectedDosage[card.id]
                    : selectedIntervalOption[card.id]
                }
              />
            </div>
          </div>
        ))}

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
      )}
    </div>
  );
};

export default PKSimulation;
