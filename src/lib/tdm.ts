import {
  Patient,
  Prescription,
  BloodTest,
  DrugAdministration,
} from "@/pages/Index";

type RenalInfo = {
  id: string;
  creatinine: string;
  date: string;
  formula: string; // 'cockcroft-gault' | 'mdrd' | 'ckd-epi'
  result: string;
  dialysis: "Y" | "N";
  renalReplacement: string;
  isSelected: boolean;
};

const toDate = (d: string, t: string) => new Date(`${d}T${t}`);
const hoursDiff = (later: Date, earlier: Date) =>
  (later.getTime() - earlier.getTime()) / 36e5;

const getSelectedRenalInfo = (
  selectedPatientId: string | null | undefined
): RenalInfo | null => {
  try {
    if (!selectedPatientId) return null;
    const raw = window.localStorage.getItem(
      `tdmfriends:renal:${selectedPatientId}`
    );
    if (!raw) return null;
    const list = JSON.parse(raw) as RenalInfo[];
    const chosen =
      list.find((item) => item.isSelected) || list[list.length - 1];
    return chosen || null;
  } catch {
    return null;
  }
};

const mostellerBsa = (heightCm: number, weightKg: number): number => {
  if (!heightCm || !weightKg) return 1.73;
  return Math.sqrt((weightKg * heightCm) / 3600);
};

// Normalize model code per requirement: first letter lowercase, '-' -> '_'
const normalizeModelCode = (code: string): string => {
  if (!code) return code;
  const firstLower = code.charAt(0).toLowerCase() + code.slice(1);
  return firstLower.replace(/-/g, "_");
};

// Mapping table from drug/indication/(optional) additional info to model code
// Codes are taken from the provided spec image. We normalize on return.
const MODEL_CODE_TABLE = {
  Vancomycin: {
    "Not specified/Korean": {
      default: "Vancomycin1-1",
      CRRT: "Vancomycin1-2",
    },
    "Neurosurgical patients/Korean": {
      default: "Vancomycin2-1",
      within72h: "Vancomycin2-2", // within 72h of last dosing time
    },
  },
  Cyclosporin: {
    "Renal transplant recipients/Korean": {
      "POD ~2": "Cyclosporin1-1",
      "POD 3~6": "Cyclosporin1-2",
      "POD 7~": "Cyclosporin1-3",
      default: "Cyclosporin1-1",
    },
    "Allo-HSCT/Korean": "Cyclosporin2",
    "Thoracic transplant recipients/European": "Cyclosporin3",
  },
} as const;

const inferModelName = (args: {
  patientId: string;
  drugName?: string;
  indication?: string;
  additionalInfo?: string;
  lastDoseDate?: Date | undefined;
}): string | undefined => {
  const { patientId, drugName, indication, additionalInfo, lastDoseDate } =
    args;
  if (!drugName || !indication) return undefined;
  const table: unknown = (MODEL_CODE_TABLE as unknown)[drugName];
  if (!table) return undefined;

  // Detect CRRT from saved renal info
  const renal = getSelectedRenalInfo(patientId);
  const isCRRT = /crrt/i.test(renal?.renalReplacement || "");

  // Compute within 72h from last dosing time
  const within72h = lastDoseDate
    ? (new Date().getTime() - lastDoseDate.getTime()) / 36e5 <= 72
    : false;

  const entry = table[indication];
  if (!entry) return undefined;

  // If entry is a string, return it
  if (typeof entry === "string") {
    return normalizeModelCode(entry);
  }

  // Vancomycin branches
  if (drugName === "Vancomycin") {
    if (isCRRT && entry.CRRt) {
      // keep for robustness if case differs
      return normalizeModelCode(entry.CRRt);
    }
    if (isCRRT && entry.CRRT) {
      return normalizeModelCode(entry.CRRT);
    }
    if (within72h && entry.within72h) {
      return normalizeModelCode(entry.within72h);
    }
    return normalizeModelCode(entry.default);
  }

  // Cyclosporin(e) POD branches
  if (drugName === "Cyclosporin") {
    const podKey = additionalInfo?.trim();
    const podMapped = (podKey && entry[podKey]) || entry.default;
    return podMapped ? normalizeModelCode(podMapped) : undefined;
  }

  // Fallback if structure unknown
  return typeof entry.default === "string"
    ? normalizeModelCode(entry.default)
    : undefined;
};

export const computeCRCL = (
  selectedPatientId: string | null | undefined,
  weightKg: number,
  ageYears: number,
  sex01: number,
  heightCm: number
): number => {
  const renal = getSelectedRenalInfo(selectedPatientId);
  if (renal) {
    const parsedResult = parseFloat(
      (renal.result || "").toString().replace(/[^0-9.-]/g, "")
    );
    if (!Number.isNaN(parsedResult) && parsedResult > 0) {
      return parsedResult;
    }
    const scrMgDl = parseFloat((renal.creatinine || "").toString());
    if (!Number.isNaN(scrMgDl) && scrMgDl > 0) {
      const isFemale = sex01 === 0;
      if (renal.formula === "cockcroft-gault") {
        const base = ((140 - ageYears) * weightKg) / (72 * scrMgDl);
        return isFemale ? base * 0.85 : base;
      }
      if (renal.formula === "mdrd") {
        const bsa = mostellerBsa(heightCm, weightKg);
        const eGFR =
          175 *
          Math.pow(scrMgDl, -1.154) *
          Math.pow(ageYears, -0.203) *
          (isFemale ? 0.742 : 1);
        return eGFR * (bsa / 1.73);
      }
      if (renal.formula === "ckd-epi") {
        const bsa = mostellerBsa(heightCm, weightKg);
        const k = isFemale ? 0.7 : 0.9;
        const a = isFemale ? -0.329 : -0.411;
        const minScrK = Math.min(scrMgDl / k, 1);
        const maxScrK = Math.max(scrMgDl / k, 1);
        const eGFR =
          141 *
          Math.pow(minScrK, a) *
          Math.pow(maxScrK, -1.209) *
          Math.pow(0.993, ageYears) *
          (isFemale ? 1.018 : 1);
        return eGFR * (bsa / 1.73);
      }
      // fallback
      const base = ((140 - ageYears) * weightKg) / (72 * scrMgDl);
      return isFemale ? base * 0.85 : base;
    }
  }
  return 90;
};

export const computeTauFromAdministrations = (
  events: DrugAdministration[]
): number | undefined => {
  if (!events || events.length < 2) return undefined;
  const sorted = [...events].sort(
    (a, b) =>
      toDate(a.date, a.time).getTime() - toDate(b.date, b.time).getTime()
  );
  const last = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];
  const tauHours = hoursDiff(
    toDate(last.date, last.time),
    toDate(prev.date, prev.time)
  );
  return tauHours > 0 ? tauHours : undefined;
};

export const parseTargetValue = (
  target?: string,
  value?: string
): { auc?: number; trough?: number } => {
  if (!value) return {};
  const nums = (value.match(/\d+\.?\d*/g) || []).map((v) => parseFloat(v));
  if (nums.length === 0) return {};
  const mid = nums.length === 1 ? nums[0] : (nums[0] + nums[1]) / 2;
  if (target && target.toLowerCase().includes("auc")) return { auc: mid };
  if (target && target.toLowerCase().includes("trough")) return { trough: mid };
  return {};
};

type ExtendedDrugAdministration = DrugAdministration & {
  isIVInfusion?: boolean;
  infusionTime?: number; // minutes
};

const computeInfusionRateFromAdministration = (
  admin?: ExtendedDrugAdministration
): number => {
  if (!admin) return 0;
  const { isIVInfusion, infusionTime, dose } = admin;
  // 정맥 주사/수액 IV 통합: 정맥(IV)이고 infusionTime 지정 시 rate 계산, bolus는 0으로 간주
  if (isIVInfusion) {
    if (typeof infusionTime === "number") {
      if (infusionTime > 0) return dose / (infusionTime / 60); // mg per hour
      // bolus (infusionTime === 0)
      return 0;
    }
    // 명시되지 않은 경우도 주입시간 없음으로 간주
    return 0;
  }
  return 0;
};

export const buildTdmRequestBody = (args: {
  patients: Patient[];
  prescriptions: Prescription[];
  bloodTests: BloodTest[];
  drugAdministrations: DrugAdministration[];
  selectedPatientId: string;
  selectedDrugName?: string;
  overrides?: { amount?: number; tau?: number };
}) => {
  const {
    patients,
    prescriptions,
    bloodTests,
    drugAdministrations,
    selectedPatientId,
    selectedDrugName,
    overrides,
  } = args;
  const patient = patients.find((p) => p.id === selectedPatientId);
  const tdmPrescription =
    prescriptions.find(
      (p) =>
        p.patientId === selectedPatientId &&
        (selectedDrugName ? p.drugName === selectedDrugName : true)
    ) || prescriptions.find((p) => p.patientId === selectedPatientId);
  if (!patient || !tdmPrescription) return null;

  const weight = patient.weight;
  const age = patient.age;
  const sex = patient.gender === "male" ? 1 : 0;
  const height = patient.height;
  const crcl = computeCRCL(selectedPatientId, weight, age, sex, height);

  const patientDoses = (drugAdministrations || []).filter(
    (d) => d.patientId === selectedPatientId
  );
  const inferredTau = computeTauFromAdministrations(patientDoses);
  const lastDose =
    patientDoses.length > 0
      ? [...patientDoses].sort(
          (a, b) =>
            toDate(a.date, a.time).getTime() - toDate(b.date, b.time).getTime()
        )[patientDoses.length - 1]
      : undefined;
  const amountBefore = lastDose ? lastDose.dose : undefined;
  const amount = overrides?.amount ?? amountBefore;
  const tauBefore = inferredTau;
  const tau = overrides?.tau ?? tauBefore;
  const toxi = 1;
  const { auc: aucTarget, trough: cTroughTarget } = parseTargetValue(
    tdmPrescription.tdmTarget,
    tdmPrescription.tdmTargetValue
  );

  // dose rate (mg/h) for IV infusion; 0 for bolus/oral
  const rateBefore = computeInfusionRateFromAdministration(
    lastDose as ExtendedDrugAdministration
  );
  const rateAfter = rateBefore;

  // cmt mapping: IV -> 1, PO -> 2; fallback to 1 if unknown
  const route = (tdmPrescription as Prescription & { route?: string }).route;
  const routeNorm = (route || "").toLowerCase();
  const cmtMapped =
    routeNorm.includes("po") || routeNorm.includes("경구") ? 2 : 1;

  const dataset: Array<{
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
  }> = [];
  // Dosing events
  const sortedDoses = [...patientDoses].sort(
    (a, b) =>
      toDate(a.date, a.time).getTime() - toDate(b.date, b.time).getTime()
  );
  const anchorDoseTime =
    sortedDoses.length > 0
      ? toDate(sortedDoses[0].date, sortedDoses[0].time)
      : undefined;
  if (sortedDoses.length > 0 && anchorDoseTime) {
    for (const d of sortedDoses) {
      const ext = d as ExtendedDrugAdministration;
      const t = Math.max(0, hoursDiff(toDate(d.date, d.time), anchorDoseTime));
      const rate = computeInfusionRateFromAdministration(ext);
      const cmt =
        ext.route.includes("po") || ext.route.includes("경구") ? 2 : 1;
      dataset.push({
        ID: selectedPatientId,
        TIME: t,
        DV: null,
        AMT: d.dose,
        RATE: rate,
        CMT: cmt,
        WT: weight,
        SEX: sex,
        AGE: age,
        CRCL: crcl,
        TOXI: toxi,
        EVID: 1,
      });
    }
  } else if (amount !== undefined) {
    dataset.push({
      ID: selectedPatientId,
      TIME: 0.0,
      DV: null,
      AMT: amount,
      RATE: 0,
      CMT: cmtMapped,
      WT: weight,
      SEX: sex,
      AGE: age,
      CRCL: crcl,
      TOXI: toxi,
      EVID: 1,
    });
  }

  const anchor =
    anchorDoseTime ||
    (sortedDoses.length > 0
      ? toDate(sortedDoses[0].date, sortedDoses[0].time)
      : new Date());
  const relatedTests = selectedDrugName
    ? bloodTests.filter(
        (b) =>
          b.patientId === selectedPatientId && b.drugName === selectedDrugName
      )
    : bloodTests.filter((b) => b.patientId === selectedPatientId);

  // 관찰 이벤트는 시간순(오름차순)으로 정렬하여 추가해, 마지막 행이 항상 혈중농도(EVID:0) 되도록 보장
  const testsSorted = [...relatedTests].sort(
    (a, b) => a.testDate.getTime() - b.testDate.getTime()
  );

  if (testsSorted.length > 0) {
    for (const b of testsSorted) {
      const t = hoursDiff(b.testDate, anchor);
      const dvMgPerL =
        b.unit && b.unit.toLowerCase().includes("ng/ml")
          ? b.concentration / 1000
          : b.concentration;
      dataset.push({
        ID: selectedPatientId,
        TIME: t,
        DV: dvMgPerL,
        AMT: 0,
        RATE: 0,
        CMT: cmtMapped,
        WT: weight,
        SEX: sex,
        AGE: age,
        CRCL: crcl,
        TOXI: toxi,
        EVID: 0,
      });
    }
  } else {
    dataset.push({
      ID: selectedPatientId,
      TIME: tau ?? 2.0,
      DV: null,
      AMT: 0,
      RATE: 0,
      CMT: cmtMapped,
      WT: weight,
      SEX: sex,
      AGE: age,
      CRCL: crcl,
      TOXI: toxi,
      EVID: 0,
    });
  }

  // Infer model name from drug/indication and context
  const modelName = inferModelName({
    patientId: selectedPatientId,
    drugName: tdmPrescription.drugName,
    indication: tdmPrescription.indication,
    additionalInfo: tdmPrescription.additionalInfo as string | undefined,
    lastDoseDate: lastDose ? toDate(lastDose.date, lastDose.time) : undefined,
  });

  // New API fields (_before/_after) with legacy fields for compatibility
  const body = {
    // legacy
    input_tau: tau ?? 12,
    input_amount: amount ?? 100,
    input_WT: weight,
    input_CRCL: crcl,
    input_AGE: age,
    input_SEX: sex,
    input_TOXI: toxi,
    input_AUC: aucTarget ?? undefined,
    input_CTROUGH: cTroughTarget ?? undefined,

    // new before/after
    input_tau_before: tauBefore ?? tau ?? 12,
    input_amount_before: amountBefore ?? amount ?? 100,
    input_rate_before: rateBefore,
    input_cmt_before: cmtMapped,
    input_tau_after: tau ?? tauBefore ?? 12,
    input_amount_after: amount ?? amountBefore ?? 100,
    input_rate_after: rateAfter,
    input_cmt_after: cmtMapped,
    model_name: modelName,
    dataset,
  };

  return body;
};

type TdmHistoryEntry = {
  id: string;
  timestamp: string;
  model_name?: string;
  summary: {
    AUCtau_before?: number;
    AUC24h_before?: number;
    CMAX_before?: number;
    CTROUGH_before?: number;
    AUCtau_after?: number;
    AUC24h_after?: number;
    CMAX_after?: number;
    CTROUGH_after?: number;
  };
  dataset: unknown[];
  data: unknown;
};

type TdmApiMinimal = {
  AUCtau_before?: number;
  AUC_before?: number;
  AUC24h_before?: number;
  CMAX_before?: number;
  CTROUGH_before?: number;
  AUCtau_after?: number;
  AUC_after?: number;
  AUC24h_after?: number;
  CMAX_after?: number;
  CTROUGH_after?: number;
};

type TdmRequestBodyWithOptionalModel = {
  model_name?: string;
  dataset?: unknown[];
} & Record<string, unknown>;

// Unified TDM API caller. If persist=true and patientId provided, the result is saved to localStorage.
export const runTdmApi = async (args: {
  body: unknown;
  persist?: boolean;
  patientId?: string;
  drugName?: string;
}): Promise<unknown> => {
  const { body, persist, patientId, drugName } = args;
  const response = await fetch(
    "https://b74ljng162.apigw.ntruss.com/tdm/prod/",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!response.ok) throw new Error(`TDM API error: ${response.status}`);
  const data: TdmApiMinimal = await response.json();

  if (persist && patientId) {
    try {
      window.localStorage.setItem(
        `tdmfriends:tdmResult:${patientId}`,
        JSON.stringify(data)
      );

      if (drugName) {
        const historyKey = `tdmfriends:tdmResults:${patientId}:${drugName}`;
        const raw = window.localStorage.getItem(historyKey);
        const list: TdmHistoryEntry[] = raw
          ? (JSON.parse(raw) as TdmHistoryEntry[])
          : [];
        const typedBody = body as TdmRequestBodyWithOptionalModel;
        const entry: TdmHistoryEntry = {
          id: `${Date.now()}`,
          timestamp: new Date().toISOString(),
          model_name: typedBody?.model_name,
          summary: {
            AUCtau_before: data?.AUCtau_before ?? data?.AUC_before,
            AUC24h_before: data?.AUC24h_before,
            CMAX_before: data?.CMAX_before,
            CTROUGH_before: data?.CTROUGH_before,
            AUCtau_after: data?.AUCtau_after ?? data?.AUC_after,
            AUC24h_after: data?.AUC24h_after,
            CMAX_after: data?.CMAX_after,
            CTROUGH_after: data?.CTROUGH_after,
          },
          dataset: (typedBody?.dataset as unknown[]) || [],
          data,
        };
        list.push(entry);
        window.localStorage.setItem(historyKey, JSON.stringify(list));
        // Also persist latest result per patient+drug
        window.localStorage.setItem(
          `tdmfriends:tdmResult:${patientId}:${drugName}`,
          JSON.stringify(data)
        );
      }
    } catch (e) {
      console.error("Failed to save TDM result/history to localStorage", e);
    }
  }
  return data;
};

export const setActiveTdm = (
  patientId: string,
  drugName: string | undefined,
  active: boolean
) => {
  try {
    if (!patientId || !drugName) return;
    const key = `tdmfriends:activeTdm:${patientId}:${drugName}`;
    if (active)
      window.localStorage.setItem(
        key,
        JSON.stringify({ active: true, at: Date.now() })
      );
    else window.localStorage.removeItem(key);
  } catch {
    console.warn("setActiveTdm failed");
  }
};

export const isActiveTdmExists = (
  patientId: string,
  drugName: string | undefined
): boolean => {
  try {
    if (!patientId || !drugName) return false;
    const key = `tdmfriends:activeTdm:${patientId}:${drugName}`;
    return !!window.localStorage.getItem(key);
  } catch {
    return false;
  }
};
